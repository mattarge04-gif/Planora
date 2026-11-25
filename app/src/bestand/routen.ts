import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { auditEreignis } from "../audit/audit.js";
import { ID_PARAMS, UUID } from "../welt/schema.js";
import { KATALOG_V2 } from "../welt/katalog.v2.js";
import { inTx, verweigert, zugriff } from "../rechte/zugriff.js";
import { pruefeDatenblatt } from "./datenblatt.js";

const WERT = { anyOf: [{ type: "number" }, { type: "string", maxLength: 200 }, { type: "null" }] };
const DATENBLATT_SCHEMA = { type: "object", additionalProperties: false, required: ["bauteilIds", "werte"], properties: {
  bauteilIds: { type: "array", minItems: 1, maxItems: 500, items: UUID },
  werte: { type: "object", maxProperties: 50, additionalProperties: WERT } } } as const;
const U = UUID.pattern.slice(1, -1);
const GRUPPE_QUERY = { type: "object", additionalProperties: false, properties: { gruppe: { type: "string", maxLength: 18_500, pattern: `^${U}(,${U})*$` } } } as const;
type Werte = Record<string, number | string>;

/**
 * E48: Datenblatt gehoert zum Typ. Zielmenge = uebergebene Bauteile plus alle Bauteile des Gebaeudes mit gleicher
 * Katalog-ID, gleichem Hersteller und Typ (ohne Gross-/Kleinschreibung, getrimmt). Ohne Hersteller oder Typ nur das Bauteil selbst.
 */
async function zielmenge(c: pg.ClientBase, ids: string[]) {
  return (await c.query(
    `select distinct b2.id, b2.liegenschaft_id, b2.reihenfolge, a.datenblatt from bauteil b
       join bauteil b2 on b2.id = b.id or (b2.gebaeude_id = b.gebaeude_id and b2.katalog_id = b.katalog_id
         and nullif(btrim(b.hersteller), '') is not null and nullif(btrim(b.typ), '') is not null
         and lower(btrim(b2.hersteller)) = lower(btrim(b.hersteller)) and lower(btrim(b2.typ)) = lower(btrim(b.typ)))
       left join bauteil_akte a on a.bauteil_id = b2.id
      where b.id = any($1::uuid[]) order by b2.reihenfolge`, [ids])).rows as { id: string; liegenschaft_id: string; datenblatt: Werte | null }[];
}
/** Felder, deren Wert in der Zielmenge nicht ueberall gleich ist (G7: Anzeige "unterschiedlich" statt stillem Ueberschreiben). */
function abweichend(menge: { datenblatt: Werte | null }[]): string[] {
  const schluessel = new Set(menge.flatMap((m) => Object.keys(m.datenblatt ?? {})));
  return [...schluessel].filter((k) => new Set(menge.map((m) => JSON.stringify(m.datenblatt?.[k] ?? null))).size > 1).sort();
}

export function registriereBestandRouten(app: FastifyInstance, pool: pg.Pool) {
  const felderVon = (katalogId: string) => KATALOG_V2.eintraege.find((e) => e.id === katalogId)?.datenblatt ?? [];
  async function antwort(c: pg.ClientBase, benutzerId: string, bauteilId: string, gruppe: string[] = []) {
    const b = (await c.query("select b.katalog_id, b.gebaeude_id, b.hersteller, b.typ, a.datenblatt from bauteil b left join bauteil_akte a on a.bauteil_id=b.id where b.id=$1", [bauteilId])).rows[0];
    // Gruppe der Karte: nur Bauteile gleichen Typs im gleichen Gebaeude zaehlen (andere werden ignoriert).
    const dazu = gruppe.length ? (await c.query("select id from bauteil where id = any($1::uuid[]) and gebaeude_id=$2 and katalog_id=$3", [gruppe, b.gebaeude_id, b.katalog_id])).rows.map((r) => r.id as string) : [];
    const menge = await zielmenge(c, [bauteilId, ...dazu]);
    const typweit = !!(b.hersteller?.trim() && b.typ?.trim());
    return { bauteilId, katalogId: b.katalog_id as string, felder: felderVon(b.katalog_id), werte: (b.datenblatt ?? {}) as Werte,
      bauteilIds: menge.map((m) => m.id), typ: typweit ? `${b.hersteller.trim()} ${b.typ.trim()}` : null, abweichend: abweichend(menge),
      darfAendern: (await zugriff(c, benutzerId, b.gebaeude_id, true)) === 200 };
  }

  app.get<{ Params: { id: string }; Querystring: { gruppe?: string } }>("/api/bestand/bauteile/:id/datenblatt", { schema: { params: ID_PARAMS, querystring: GRUPPE_QUERY } }, async (req, reply) =>
    inTx(pool, "begin isolation level repeatable read read only", async (c) => {
      const g = (await c.query("select gebaeude_id from bauteil where id=$1", [req.params.id])).rows[0]?.gebaeude_id as string | undefined;
      const z = g ? await zugriff(c, req.kontext!.benutzerId, g, false) : 404;
      if (z !== 200) return verweigert(reply, z);
      return antwort(c, req.kontext!.benutzerId, req.params.id, req.query.gruppe ? req.query.gruppe.toLowerCase().split(",") : []);
    }));

  app.put<{ Body: { bauteilIds: string[]; werte: Record<string, unknown> } }>("/api/bestand/datenblatt", { schema: { body: DATENBLATT_SCHEMA } }, async (req, reply) => {
    const k = req.kontext!;
    const ids = [...new Set(req.body.bauteilIds.map((x) => x.toLowerCase()))];
    return inTx(pool, "begin", async (c) => {
      const rows = (await c.query("select id, katalog_id, liegenschaft_id, gebaeude_id from bauteil where id = any($1::uuid[])", [ids])).rows;
      if (rows.length !== ids.length) return verweigert(reply, 404);
      for (const g of new Set(rows.map((r) => r.gebaeude_id as string))) {
        const z = await zugriff(c, k.benutzerId, g, true);
        if (z !== 200) return verweigert(reply, z);
      }
      if (new Set(rows.map((r) => r.katalog_id)).size > 1 || new Set(rows.map((r) => r.gebaeude_id)).size > 1)
        return reply.code(400).send({ fehler: [{ pfad: "bauteilIds", code: "bauteil_gemischt", meldung: "Bauteile muessen gleichen Typ und gleiches Gebaeude haben" }] });
      const p = pruefeDatenblatt(felderVon(rows[0].katalog_id), req.body.werte);
      if (!p.ok) return reply.code(400).send({ fehler: p.fehler });
      // Mischen statt Ersetzen (G7): gesendete Werte setzen, gesendet leer/null loescht das Feld, nicht gesendete bleiben.
      const geloescht = Object.keys(req.body.werte).filter((x) => !(x in (p.werte ?? {})));
      const menge = await zielmenge(c, ids);
      for (const r of menge) {
        const neu: Werte = { ...(r.datenblatt ?? {}), ...(p.werte ?? {}) };
        for (const x of geloescht) delete neu[x];
        await c.query(`insert into bauteil_akte(bauteil_id, liegenschaft_id, datenblatt) values ($1,$2,$3)
          on conflict (bauteil_id) do update set datenblatt=excluded.datenblatt`, [r.id, r.liegenschaft_id, Object.keys(neu).length ? JSON.stringify(neu) : null]);
        await c.query(`delete from bauteil_akte where bauteil_id=$1 and zustand is null and lebensdauer_jahre is null and stueckpreis is null
          and notiz is null and datenblatt is null`, [r.id]);
      }
      await auditEreignis(c, k.auditId, "bestand.datenblatt", { gebaeudeId: rows[0].gebaeude_id, anzahl: menge.length, felder: Object.keys(req.body.werte).length });
      return antwort(c, k.benutzerId, ids[0], ids);
    });
  });
}
