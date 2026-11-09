import type pg from "pg";
export async function auditEreignis(c: pg.ClientBase, auditId: string | null, art: string, daten: object = {}) {
  await c.query("select audit_schreiben($1,$2,$3)", [auditId, art, JSON.stringify(daten)]);
}
