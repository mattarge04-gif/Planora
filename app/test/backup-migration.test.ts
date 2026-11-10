import { beforeAll, afterAll, beforeEach, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { frischeDb } from "./hilfe.js";
import { reconcile } from "../src/betrieb/backup/reconcile.js";
import pg from "pg";
let db: Awaited<ReturnType<typeof frischeDb>>;
beforeAll(async () => { db = await frischeDb(); });
afterAll(async () => { await db.ende(); });
beforeEach(async () => { await db.pool.query("truncate backup_lauf, loesch_journal; update journal_zaehler set seq=0"); });
async function als(rolle: string, sql: string, werte: unknown[] = []) {
  const c = await db.pool.connect();
  try { await c.query("begin"); await c.query(`set local role ${rolle}`); const r = await c.query(sql, werte); await c.query("commit"); return r; }
  catch (e) { await c.query("rollback"); throw e; } finally { c.release(); }
}
it("verweigert direkte Schreibrechte und Funktionsaufrufe der App", async () => {
  for (const rolle of ["planora_app", "planora_betrieb", "planora_backup"]) {
    await expect(als(rolle, "insert into backup_lauf(id,zustand) values ($1,'laufend')", [randomUUID()])).rejects.toThrow(/permission denied/);
    await expect(als(rolle, "update loesch_journal set zustand='quittiert'")).rejects.toThrow(/permission denied/);
  }
  for (const rolle of ["planora_app", "planora_backup"]) {
    await expect(als(rolle, "select backup_lauf_start($1)", [randomUUID()])).rejects.toThrow(/permission denied/);
  }
});
it("erzwingt Zustaende, Heartbeat und idempotente geordnete Journal-Quittungen", async () => {
  const id = randomUUID();
  await als("planora_betrieb", "select backup_lauf_start($1)", [id]);
  await expect(als("planora_betrieb", "select backup_lauf_setze($1,'geprueft')", [id])).rejects.toThrow(/Zustandswechsel/);
  await als("planora_betrieb", "select backup_lauf_heartbeat($1)", [id]);
  for (const zustand of ["gesichert", "geprueft"]) await als("planora_betrieb", "select backup_lauf_setze($1,$2)", [id,zustand]);
  await expect(als("planora_betrieb", "select backup_lauf_setze($1,'laufend')", [id])).rejects.toThrow();
  await db.pool.query("select journal_eintrag('konto.sperren','x'); select journal_eintrag('konto.sperren','y')");
  await expect(als("planora_betrieb", "select journal_quittiere(2)")).rejects.toThrow(/Reihenfolge/);
  for (const seq of [1,1,2]) await als("planora_betrieb", "select journal_quittiere($1)", [seq]);
  expect((await db.pool.query("select count(*)::int n from loesch_journal where zustand='quittiert'")).rows[0].n).toBe(2);
});
it("reconciliert nur alte Heartbeats bei nachweislich gestopptem Container", async () => {
  const alt = randomUUID(), frisch = randomUUID();
  for (const id of [alt,frisch]) await als("planora_betrieb", "select backup_lauf_start($1)", [id]);
  await db.pool.query("update backup_lauf set start=now()-interval '1 day', heartbeat=case when id=$1 then now()-interval '11 minutes' else heartbeat end", [alt]);
  for (const laeuft of [true,null]) expect((await als("planora_betrieb", "select backup_reconcile($1) n", [laeuft])).rows[0].n).toBe(0);
  expect((await als("planora_betrieb", "select backup_reconcile(false) n")).rows[0].n).toBe(1);
  expect((await db.pool.query("select zustand from backup_lauf where id=$1", [frisch])).rows[0].zustand).toBe("laufend");
});
it("laesst nach Crash und Wiederanlauf GC wieder zu und frische Laeufe weiterlaufen",async()=>{
  const id=randomUUID();await als("planora_betrieb","select backup_lauf_start($1)",[id]);
  await db.pool.query("update backup_lauf set heartbeat=now()-interval '11 minutes' where id=$1",[id]);
  const pool=new pg.Pool({...db.cfg,options:"-c role=planora_betrieb"});
  try {
    expect(await reconcile(pool,true)).toBe(0);
    expect(await reconcile(pool,false)).toBe(1);
    expect(await reconcile(pool,false)).toBe(0);
    expect((await db.pool.query("select count(*)::int n from backup_lauf where zustand='laufend'")).rows[0].n).toBe(0);
    await pool.query("select backup_lauf_start($1)",[randomUUID()]);
    expect(await reconcile(pool,false)).toBe(0);
  } finally {await pool.end();}
});
