import type { FastifyInstance, FastifyReply } from "fastify";
import type pg from "pg";
import { pruefe } from "../rechte/rechte.js";
import { auditEreignis } from "../audit/audit.js";
import { FachFehler } from "../welt/speicher.js";
import { ID_PARAMS } from "../welt/schema.js";
import { LEBENSDAUER_SCHEMA } from "./schema.js";
import { ladeLebensdauer, schreibeLebensdauer, type LebensdauerEingabe } from "./speicher.js";
import { erneuerungCsv } from "./csv.js";
import { KATALOG_V2 } from "../welt/katalog.v2.js";

export function registriereLebensdauerRouten(app: FastifyInstance, pool: pg.Pool, stichtag = () => new Date().getFullYear()) {
  const mitClient = async <T>(f: (c: pg.PoolClient) => Promise<T>) => { const c = await pool.connect(); try { return await f(c); } finally { c.release(); } };
  const inTx = <T>(art: string, f: (c: pg.PoolClient) => Promise<T>) => mitClient(async (c) => {
    await c.query(art);
    try { const r = await f(c); await c.query("commit"); return r; } catch (e) { await c.query("rollback"); throw e; }
  });
  async function zugriff(c: pg.ClientBase, benutzerId: string, gebaeudeId: string, schreiben: boolean): Promise<200 | 403 | 404> {
    const r = (await c.query("select liegenschaft_id from gebaeude where id=$1", [gebaeudeId])).rows[0];
    if (!r || !(await pruefe(c, benutzerId, "fach.lesen", r.liegenschaft_id))) return 404;
    if (schreiben && !(await pruefe(c, benutzerId, "fach.aendern", r.liegenschaft_id))) return 403;
    return 200;
  }
  const verweigert = (reply: FastifyReply, code: 403 | 404) => reply.code(code).send({ fehler: code === 404 ? "nicht gefunden" : "keine Berechtigung" });

  app.get<{ Params: { id: string } }>("/api/lebensdauer/gebaeude/:id", { schema: { params: ID_PARAMS } }, async (req, reply) =>
    inTx("begin isolation level repeatable read read only", async (c) => {
      const z = await zugriff(c, req.kontext!.benutzerId, req.params.id, false);
      if (z !== 200) return verweigert(reply, z);
      const stand = await ladeLebensdauer(c, req.params.id, stichtag());
      const darfAendern = (await zugriff(c, req.kontext!.benutzerId, req.params.id, true)) === 200;
      return { ...stand, darfAendern };
    }));

  const NAMEN = Object.fromEntries(KATALOG_V2.eintraege.map((e) => [e.id, e.name]));
  app.get<{ Params: { id: string } }>("/api/lebensdauer/gebaeude/:id/export.csv", { schema: { params: ID_PARAMS } }, async (req, reply) =>
    inTx("begin isolation level repeatable read read only", async (c) => {
      const z = await zugriff(c, req.kontext!.benutzerId, req.params.id, false);
      if (z !== 200) return verweigert(reply, z);
      const s = (await ladeLebensdauer(c, req.params.id, stichtag()))!;
      return reply.type("text/csv; charset=utf-8")
        .header("content-disposition", `attachment; filename="erneuerungsplan-${req.params.id.slice(0, 8)}-${s.ergebnis.stichtag}.csv"`)
        .send(erneuerungCsv(s, NAMEN));
    }));

  app.put<{ Params: { id: string }; Body: LebensdauerEingabe }>("/api/lebensdauer/gebaeude/:id",
    { schema: { params: ID_PARAMS, body: LEBENSDAUER_SCHEMA } }, async (req, reply) => {
      const k = req.kontext!;
      const z = await mitClient((c) => zugriff(c, k.benutzerId, req.params.id, true));
      if (z !== 200) return verweigert(reply, z);
      try {
        return await inTx("begin", async (c) => {
          const n = await schreibeLebensdauer(c, req.params.id, req.body);
          await auditEreignis(c, k.auditId, "lebensdauer.geaendert", { gebaeudeId: req.params.id, ...n });
          return { ...(await ladeLebensdauer(c, req.params.id, stichtag())), darfAendern: true };
        });
      } catch (e) {
        if (e instanceof FachFehler) return reply.code(e.status).send({ fehler: e.fehler });
        throw e;
      }
    });
}
