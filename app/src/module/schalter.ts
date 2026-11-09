import type pg from "pg";
import type { FastifyInstance } from "fastify";
import { MANIFEST_VERSION, modul, kaskadeAbschalten, modulFuerRoute, pruefeEinschalten, type ModulId, type Stufe } from "./manifest.js";
import { auditEreignis } from "../audit/audit.js";

export async function aktiveOptionen(c: pg.ClientBase) {
  return new Set<ModulId>((await c.query("select modul_id from modul_schalter where aktiv")).rows.map((r) => r.modul_id));
}
export async function modulAktiv(c: pg.ClientBase, id: ModulId, stufe: Stufe): Promise<boolean> {
  const m = modul(id);
  if (!m || m.lieferstufe > stufe) return false;
  if (m.art === "kern") return true;
  return (await c.query("select aktiv from modul_schalter where modul_id=$1", [id])).rows[0]?.aktiv === true;
}

export async function schalteEin(pool: pg.Pool, id: ModulId, stufe: Stufe, auditId: string) {
  const c = await pool.connect();
  try {
    await c.query("begin"); await c.query("lock table modul_schalter in share row exclusive mode");
    const r = pruefeEinschalten(await aktiveOptionen(c), id, stufe); if (!r.ok) throw new Error(r.grund);
    await c.query(`insert into modul_schalter(modul_id, aktiv, geaendert_von, manifest_version) values ($1,true,$2,$3)
      on conflict (modul_id) do update set aktiv=true, geaendert_am=now(), geaendert_von=$2, manifest_version=$3`, [id, auditId, MANIFEST_VERSION]);
    await auditEreignis(c, auditId, "modul.ein", { id }); await c.query("commit");
  } catch (e) { await c.query("rollback"); throw e; } finally { c.release(); }
}
export async function schalteAus(pool: pg.Pool, id: ModulId, auditId: string) {
  const m = modul(id);
  if (!m) throw new Error("nicht geliefert");
  if (m.art === "kern") throw new Error("kern nicht schaltbar");
  const c = await pool.connect();
  try {
    await c.query("begin"); await c.query("lock table modul_schalter in share row exclusive mode");
    const raus = kaskadeAbschalten(await aktiveOptionen(c), id);
    for (const m of raus) { await c.query("update modul_schalter set aktiv=false, geaendert_am=now(), geaendert_von=$2 where modul_id=$1", [m, auditId]); await auditEreignis(c, auditId, "modul.aus", { id: m, ausgeloest_durch: id }); }
    await c.query("commit"); return raus;
  } catch (e) { await c.query("rollback"); throw e; } finally { c.release(); }
}
export function registriereModulGuard(app: FastifyInstance, pool: pg.Pool, stufe: Stufe) {
  app.addHook("onRequest", async (req, reply) => {
    const m = modulFuerRoute(req.url); if (!m) return;
    if (m.lieferstufe > stufe) return reply.code(404).send({ fehler: "nicht gefunden" });
    if (m.art === "kern") return;
    let aktiv: boolean;
    try { const c = await pool.connect(); try { aktiv = await modulAktiv(c, m.id, stufe); } finally { c.release(); } }
    catch { return reply.code(503).send({ fehler: "Modulstatus nicht pruefbar" }); }
    if (!aktiv) return reply.code(404).send({ fehler: "nicht gefunden" });
  });
}
