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

export function registriereBestandRouten(app: FastifyInstance, pool: pg.Pool) {
  const felderVon = (katalogId: string) => KATALOG_V2.eintraege.find((e) => e.id === katalogId)?.datenblatt ?? [];
  async function antwort(c: pg.ClientBase, benutzerId: string, bauteilId: string) {
    const b = (await c.query("select b.katalog_id, b.gebaeude_id, a.datenblatt from bauteil b left join bauteil_akte a on a.bauteil_id=b.id where b.id=$1", [bauteilId])).rows[0];
    return { bauteilId, katalogId: b.katalog_id as string, felder: felderVon(b.katalog_id), werte: (b.datenblatt ?? {}) as Record<string, number | string>,
      darfAendern: (await zugriff(c, benutzerId, b.gebaeude_id, true)) === 200 };
  }

  app.get<{ Params: { id: string } }>("/api/bestand/bauteile/:id/datenblatt", { schema: { params: ID_PARAMS } }, async (req, reply) =>
    inTx(pool, "begin isolation level repeatable read read only", async (c) => {
      const g = (await c.query("select gebaeude_id from bauteil where id=$1", [req.params.id])).rows[0]?.gebaeude_id as string | undefined;
      const z = g ? await zugriff(c, req.kontext!.benutzerId, g, false) : 404;
      if (z !== 200) return verweigert(reply, z);
      return antwort(c, req.kontext!.benutzerId, req.params.id);
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
      for (const r of rows) {
        await c.query(`insert into bauteil_akte(bauteil_id, liegenschaft_id, datenblatt) values ($1,$2,$3)
          on conflict (bauteil_id) do update set datenblatt=excluded.datenblatt`, [r.id, r.liegenschaft_id, p.werte === null ? null : JSON.stringify(p.werte)]);
        await c.query(`delete from bauteil_akte where bauteil_id=$1 and zustand is null and lebensdauer_jahre is null and stueckpreis is null
          and notiz is null and datenblatt is null`, [r.id]);
      }
      await auditEreignis(c, k.auditId, "bestand.datenblatt", { gebaeudeId: rows[0].gebaeude_id, anzahl: rows.length, felder: Object.keys(p.werte ?? {}).length });
      return antwort(c, k.benutzerId, ids[0]);
    });
  });
}
