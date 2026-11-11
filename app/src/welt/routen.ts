import type { FastifyInstance, FastifyReply } from "fastify";
import type pg from "pg";
import { pruefe } from "../rechte/rechte.js";
import { auditEreignis } from "../audit/audit.js";
import { REGELWERK_V1 } from "./regelwerk.v1.js";
import { KATALOG_V1 } from "./katalog.v1.js";
import { weltErzeugen } from "./generator.js";
import { FachFehler, aendereHuelle, ladeBeschreibung, ladeHuelle, legeGebaeudeAn, schreibeBeschreibung } from "./speicher.js";
import { BESCHREIBUNG_SCHEMA, HUELLE_SCHEMA, ID_PARAMS, LID_PARAMS } from "./schema.js";
import type { Beschreibung, EinheitVerweis, Huelle } from "./typen.js";

/** UUIDs kanonisch klein: Postgres liefert IDs klein, der Abgleich vergleicht Texte. */
const klein = (id: string | undefined) => id?.toLowerCase();
function kanonischeHuelle(h: Huelle): Huelle {
  return { ...h, geschosse: h.geschosse.map((g) => (g.id === undefined ? g : { ...g, id: klein(g.id) })) };
}
function kanonischeBeschreibung(b: Beschreibung): Beschreibung {
  const verweis = <T extends EinheitVerweis>(v: T): T => (v.einheitId === undefined ? v : { ...v, einheitId: klein(v.einheitId) });
  return {
    ...b,
    einheiten: b.einheiten.map((e) => ({ ...e, ...(e.id !== undefined && { id: klein(e.id) }), geschossId: klein(e.geschossId)! })),
    bauteile: b.bauteile.map((t) => ({
      ...t, ...(t.id !== undefined && { id: klein(t.id) }),
      standort: { ...verweis(t.standort), ...(t.standort.geschossId !== undefined && { geschossId: klein(t.standort.geschossId) }) },
      versorgt: t.versorgt.map(verweis),
    })),
  };
}

export function registriereWeltRouten(app: FastifyInstance, pool: pg.Pool) {
  async function mitClient<T>(f: (c: pg.PoolClient) => Promise<T>): Promise<T> {
    const c = await pool.connect();
    try { return await f(c); } finally { c.release(); }
  }
  const inTransaktion = <T>(f: (c: pg.PoolClient) => Promise<T>) => mitClient(async (c) => {
    await c.query("begin");
    try { const r = await f(c); await c.query("commit"); return r; } catch (e) { await c.query("rollback"); throw e; }
  });
  /** Mehrere Lese-Statements auf einem Stand (kein gemischtes Bild bei parallelem Schreiben). */
  const inSnapshot = <T>(f: (c: pg.PoolClient) => Promise<T>) => mitClient(async (c) => {
    await c.query("begin isolation level repeatable read read only");
    try { const r = await f(c); await c.query("commit"); return r; } catch (e) { await c.query("rollback"); throw e; }
  });
  /** 404 ohne Leserecht (keine Existenz-Auskunft), 403 mit Leserecht aber ohne Schreibrecht. */
  async function zugriff(c: pg.ClientBase, benutzerId: string, gebaeudeId: string, schreiben: boolean): Promise<200 | 403 | 404> {
    const r = (await c.query("select liegenschaft_id from gebaeude where id=$1", [gebaeudeId])).rows[0];
    if (!r || !(await pruefe(c, benutzerId, "fach.lesen", r.liegenschaft_id))) return 404;
    if (schreiben && !(await pruefe(c, benutzerId, "fach.aendern", r.liegenschaft_id))) return 403;
    return 200;
  }
  const verweigert = (reply: FastifyReply, code: 403 | 404) => reply.code(code).send({ fehler: code === 404 ? "nicht gefunden" : "keine Berechtigung" });
  const fachAntwort = (reply: FastifyReply, e: unknown) => {
    if (e instanceof FachFehler) return reply.code(e.status).send({ fehler: e.fehler });
    throw e;
  };
  const darfHuelle = (benutzerId: string) => mitClient((c) => pruefe(c, benutzerId, "huelle.verwalten"));

  app.post<{ Params: { lid: string }; Body: Huelle }>("/api/struktur/liegenschaften/:lid/gebaeude",
    { schema: { params: LID_PARAMS, body: HUELLE_SCHEMA } }, async (req, reply) => {
      const k = req.kontext!;
      if (!(await darfHuelle(k.benutzerId))) return verweigert(reply, 403);
      try {
        const id = await inTransaktion(async (c) => {
          if (!(await c.query("select 1 from liegenschaft where id=$1", [req.params.lid])).rowCount) return null;
          const neu = await legeGebaeudeAn(c, req.params.lid, req.body, REGELWERK_V1);
          await auditEreignis(c, k.auditId, "gebaeude.angelegt", { gebaeudeId: neu, geschosse: req.body.geschosse.length });
          return neu;
        });
        return id === null ? verweigert(reply, 404) : reply.code(201).send({ id });
      } catch (e) { return fachAntwort(reply, e); }
    });

  app.get<{ Params: { id: string } }>("/api/struktur/gebaeude/:id/huelle", { schema: { params: ID_PARAMS } }, async (req, reply) => {
    if (!(await darfHuelle(req.kontext!.benutzerId))) return verweigert(reply, 403);
    const h = await mitClient((c) => ladeHuelle(c, req.params.id));
    return h ?? verweigert(reply, 404);
  });

  app.put<{ Params: { id: string }; Body: Huelle }>("/api/struktur/gebaeude/:id/huelle",
    { schema: { params: ID_PARAMS, body: HUELLE_SCHEMA } }, async (req, reply) => {
      const k = req.kontext!;
      if (!(await darfHuelle(k.benutzerId))) return verweigert(reply, 403);
      try {
        const h = await inTransaktion(async (c) => {
          if (!(await ladeHuelle(c, req.params.id))) return null;
          await aendereHuelle(c, req.params.id, kanonischeHuelle(req.body), REGELWERK_V1);
          await auditEreignis(c, k.auditId, "gebaeude.huelle", { gebaeudeId: req.params.id, geschosse: req.body.geschosse.length });
          return ladeHuelle(c, req.params.id);
        });
        return h ?? verweigert(reply, 404);
      } catch (e) { return fachAntwort(reply, e); }
    });

  app.get<{ Params: { id: string } }>("/api/struktur/gebaeude/:id/beschreibung", { schema: { params: ID_PARAMS } }, async (req, reply) => {
    return inSnapshot(async (c) => {
      const z = await zugriff(c, req.kontext!.benutzerId, req.params.id, false);
      if (z !== 200) return verweigert(reply, z);
      return ladeBeschreibung(c, req.params.id);
    });
  });

  app.put<{ Params: { id: string }; Body: Beschreibung }>("/api/struktur/gebaeude/:id/beschreibung",
    { schema: { params: ID_PARAMS, body: BESCHREIBUNG_SCHEMA } }, async (req, reply) => {
      const k = req.kontext!;
      const z = await mitClient((c) => zugriff(c, k.benutzerId, req.params.id, true));
      if (z !== 200) return verweigert(reply, z);
      try {
        return await inTransaktion(async (c) => {
          const zaehler = await schreibeBeschreibung(c, req.params.id, kanonischeBeschreibung(req.body), REGELWERK_V1, KATALOG_V1);
          await auditEreignis(c, k.auditId, "gebaeude.beschreibung", { gebaeudeId: req.params.id, ...zaehler });
          return ladeBeschreibung(c, req.params.id);
        });
      } catch (e) { return fachAntwort(reply, e); }
    });

  app.get<{ Params: { id: string } }>("/api/szene/gebaeude/:id/welt", { schema: { params: ID_PARAMS } }, async (req, reply) => {
    return inSnapshot(async (c) => {
      const z = await zugriff(c, req.kontext!.benutzerId, req.params.id, false);
      if (z !== 200) return verweigert(reply, z);
      const h = (await ladeHuelle(c, req.params.id))!;
      const b = (await ladeBeschreibung(c, req.params.id))!;
      return weltErzeugen(h, b, REGELWERK_V1); // nur Regelwerk v1 vorhanden; Verhalten bei v2 offen (Spec §11)
    });
  });
}
