import type { FastifyInstance, FastifyReply } from "fastify";
import type pg from "pg";
import { ladeDokumente, uebernimm, verwirf, uebernimmAlleSicheren } from "./speicher.js";
import { UEBERNEHMEN_SCHEMA, STAND_SCHEMA } from "./schema.js";
import { FachFehler } from "../welt/speicher.js";
import { ID_PARAMS } from "../welt/schema.js";
import { auditEreignis } from "../audit/audit.js";
import { inTx as inTxPool, mitClient as mitClientPool, verweigert, zugriff, zugriffDokument } from "../rechte/zugriff.js";

import type { Laeufer } from "./laeufer.js";

export function registrierePreisdokumentRouten(app: FastifyInstance, pool: pg.Pool, laeufer?: Laeufer) {
  const mitClient = <T>(f: (c: pg.PoolClient) => Promise<T>) => mitClientPool(pool, f);
  const inTx = <T>(art: string, f: (c: pg.PoolClient) => Promise<T>) => inTxPool(pool, art, f);
  async function uebersicht(c: pg.ClientBase, benutzerId: string, gebaeudeId: string) {
    const darfAendern = (await zugriff(c, benutzerId, gebaeudeId, true)) === 200;
    const zs = laeufer?.zustand();
    const stand = (await c.query("select stand from gebaeude where id=$1", [gebaeudeId])).rows[0].stand as number;
    return {
      stand, dokumente: await ladeDokumente(c, gebaeudeId), darfAendern,
      auslesen: zs?.auslesen ?? "kein_schluessel",
      budget: { verbrauchtUsd: zs ? await zs.verbrauchtUsd() : 0, limitUsd: zs?.limitUsd ?? 0 },
    };
  }
  app.register(async (scope) => {
    scope.get<{ Params: { id: string } }>("/api/preisdokument/gebaeude/:id", { schema: { params: ID_PARAMS } }, async (req, reply) =>
      inTx("begin isolation level repeatable read read only", async (c) => {
        const z = await zugriff(c, req.kontext!.benutzerId, req.params.id, false);
        if (z !== 200) return verweigert(reply, z);
        return uebersicht(c, req.kontext!.benutzerId, req.params.id);
      }));

    // Entscheidungen: Schreibrecht ueber das Gebaeude, Antwort wie GET Uebersicht. gebaeude.stand wird nicht erhoeht
    // (Preise in Lebensdauer tun das auch nicht; nur Baujahr-Aenderungen).
    async function entscheide(reply: FastifyReply, gebaeudeId: string, benutzerId: string, f: (c: pg.PoolClient) => Promise<void>) {
      try {
        return await inTx("begin", async (c) => { await f(c); return uebersicht(c, benutzerId, gebaeudeId); });
      } catch (e) {
        if (e instanceof FachFehler) return reply.code(e.status).send({ fehler: e.fehler });
        throw e;
      }
    }
    async function vorschlagGebaeude(id: string): Promise<string> {
      const r = (await pool.query("select d.gebaeude_id from preis_vorschlag v join dokument d on d.id=v.dokument_id where v.id=$1", [id])).rows[0];
      return r?.gebaeude_id ?? "";
    }

    scope.post<{ Params: { id: string }; Body: { bauteilIds: string[]; alsTyppreis: boolean; stand: number; ueberschreibeHandeingabe?: boolean } }>(
      "/api/preisdokument/vorschlaege/:id/uebernehmen", { schema: { params: ID_PARAMS, body: UEBERNEHMEN_SCHEMA } }, async (req, reply) => {
        const k = req.kontext!;
        const gid = await vorschlagGebaeude(req.params.id);
        const z = gid ? await mitClient((c) => zugriff(c, k.benutzerId, gid, true)) : 404;
        if (z !== 200) return verweigert(reply, z);
        return entscheide(reply, gid, k.benutzerId, async (c) => {
          const n = await uebernimm(c, { vorschlagId: req.params.id, gebaeudeId: gid, bauteilIds: req.body.bauteilIds, alsTyppreis: req.body.alsTyppreis,
            stand: req.body.stand, ueberschreibeHandeingabe: req.body.ueberschreibeHandeingabe ?? false, von: k.benutzerId });
          await auditEreignis(c, k.auditId, "preisdokument.uebernommen", { gebaeudeId: gid, vorschlagId: req.params.id, ...n });
        });
      });

    scope.post<{ Params: { id: string } }>("/api/preisdokument/vorschlaege/:id/verwerfen", { schema: { params: ID_PARAMS } }, async (req, reply) => {
      const k = req.kontext!;
      const gid = await vorschlagGebaeude(req.params.id);
      const z = gid ? await mitClient((c) => zugriff(c, k.benutzerId, gid, true)) : 404;
      if (z !== 200) return verweigert(reply, z);
      return entscheide(reply, gid, k.benutzerId, async (c) => {
        await verwirf(c, req.params.id, gid, k.benutzerId);
        await auditEreignis(c, k.auditId, "preisdokument.verworfen", { gebaeudeId: gid, vorschlagId: req.params.id });
      });
    });

    scope.post<{ Params: { id: string }; Body: { stand: number } }>("/api/preisdokument/gebaeude/:id/alle-sicheren", { schema: { params: ID_PARAMS, body: STAND_SCHEMA } }, async (req, reply) => {
      const k = req.kontext!;
      const z = await mitClient((c) => zugriff(c, k.benutzerId, req.params.id, true));
      if (z !== 200) return verweigert(reply, z);
      return entscheide(reply, req.params.id, k.benutzerId, async (c) => {
        const n = await uebernimmAlleSicheren(c, req.params.id, req.body.stand, k.benutzerId);
        await auditEreignis(c, k.auditId, "preisdokument.alle_sicheren", { gebaeudeId: req.params.id, ...n });
      });
    });

    scope.post<{ Params: { id: string } }>("/api/preisdokument/dokumente/:id/neu-lesen", { schema: { params: ID_PARAMS } }, async (req, reply) => {
      const k = req.kontext!;
      const r = await mitClient((c) => zugriffDokument(c, k.benutzerId, req.params.id, true));
      if (r.code !== 200) return verweigert(reply, r.code as 403 | 404);
      if (laeufer?.zustand().auslesen !== "an") return reply.code(409).send({ fehler: "auslesen_aus" });
      // Offene und verworfene Vorschlaege entfallen, uebernommene bleiben; ein laufender Lesevorgang wird nicht doppelt gestartet.
      const gestartet = await inTx("begin", async (c) => {
        const l = await c.query("update dokument set auslesen_status='neu', auslesen_fehler=null where id=$1 and auslesen_status <> 'liest' returning id", [req.params.id]);
        if (!l.rowCount) return false;
        await c.query("delete from preis_vorschlag where dokument_id=$1 and status <> 'uebernommen'", [req.params.id]);
        await auditEreignis(c, k.auditId, "preisdokument.neu_lesen", { gebaeudeId: r.gebaeudeId, dokumentId: req.params.id });
        return true;
      });
      if (!gestartet) return reply.code(409).send({ fehler: "liest_bereits" });
      laeufer.starte(req.params.id);
      return reply.code(202).send((await mitClient((c) => ladeDokumente(c, r.gebaeudeId))).find((d) => d.id === req.params.id));
    });
  });
}
