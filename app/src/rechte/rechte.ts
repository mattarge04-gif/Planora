import type pg from "pg";
import { entzieheSitzungen } from "../auth/sitzung.js";
import { auditEreignis } from "../audit/audit.js";
export type Rolle = "betreiber"|"admin"|"bearbeiter"|"leser";
export type Recht = "module.schalten"|"benutzer.verwalten"|"fach.lesen"|"fach.aendern"|"dokument.loeschen"|"audit.lesen"|"huelle.verwalten";
export const MATRIX: Record<Recht, Rolle[]> = {
  "module.schalten": ["betreiber"], "benutzer.verwalten": ["admin"], "fach.lesen": ["admin", "bearbeiter", "leser"],
  "fach.aendern": ["admin", "bearbeiter"], "dokument.loeschen": ["admin"], "audit.lesen": ["admin", "betreiber"],
  "huelle.verwalten": ["betreiber"], // Planora bereitet die Huelle vor (ADR 0032), ohne Zugriff auf Fachdaten
};
const FACH = new Set<Recht>(["fach.lesen", "fach.aendern", "dokument.loeschen"]);
export async function pruefe(c: pg.ClientBase, benutzerId: string, recht: Recht, liegenschaftId?: string) {
  const r = await c.query("select rolle from rolle_zuordnung where benutzer_id=$1", [benutzerId]);
  const rolle = r.rows[0]?.rolle as Rolle | undefined;
  if (!rolle || !MATRIX[recht].includes(rolle)) return false;
  if (!FACH.has(recht) || rolle === "admin") return true;
  if (!liegenschaftId) return false;
  return (await c.query("select 1 from rolle_liegenschaft where benutzer_id=$1 and liegenschaft_id=$2", [benutzerId, liegenschaftId])).rowCount === 1;
}
export async function setzeRolle(pool: pg.Pool, benutzerId: string, rolle: Rolle, liegenschaften: string[], auditIdAusloeser: string) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("insert into rolle_zuordnung(benutzer_id, rolle) values ($1,$2) on conflict (benutzer_id) do update set rolle=$2", [benutzerId, rolle]);
    await c.query("delete from rolle_liegenschaft where benutzer_id=$1", [benutzerId]);
    for (const l of liegenschaften) await c.query("insert into rolle_liegenschaft values ($1,$2)", [benutzerId, l]);
    await entzieheSitzungen(c, benutzerId);
    await auditEreignis(c, auditIdAusloeser, "rolle.gesetzt", { rolle, anzahlLiegenschaften: liegenschaften.length });
    await c.query("commit");
  } catch (e) { await c.query("rollback"); throw e; } finally { c.release(); }
}
