import type pg from "pg";
import type { Ablage } from "./ablage.js";
export const GC_LOCK = 7_310_002;
export async function sammleMuell(pool: pg.Pool, ablage: Ablage, aufbewahrungTage = 30) {
  const c = await pool.connect(); const entfernt: string[] = [];
  try {
    if (!(await c.query("select pg_try_advisory_lock($1) ok", [GC_LOCK])).rows[0].ok) return entfernt;
    try {
      if ((await c.query("select 1 from backup_lauf where zustand='laufend'")).rowCount) return entfernt;
      const r = await c.query(
        `select d.schluessel from datei d
          where not exists (select 1 from datei_referenz r where r.schluessel = d.schluessel)
            and exists (select 1 from loesch_journal j where j.ziel = d.schluessel and j.zustand = 'quittiert' and j.zeit < now() - make_interval(days => $1))
            and not exists (select 1 from loesch_journal j where j.ziel = d.schluessel and j.zustand = 'offen')`, [aufbewahrungTage]);
      for (const { schluessel } of r.rows) { await ablage.entferne(schluessel); await c.query("delete from datei where schluessel=$1", [schluessel]); entfernt.push(schluessel); }
    } finally { await c.query("select pg_advisory_unlock($1)", [GC_LOCK]); }
  } finally { c.release(); }
  return entfernt;
}
