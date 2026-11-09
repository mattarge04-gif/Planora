import pg from "pg";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const STANDARD = fileURLToPath(new URL("./migrationen", import.meta.url));
const LOCK_ID = 7_310_001; // fester Advisory-Lock fuer Migrationen

export async function migriere(cfg: pg.ClientConfig, verzeichnis = STANDARD) {
  const c = new pg.Client(cfg); await c.connect();
  const angewendet: string[] = [];
  try {
    await c.query("select pg_advisory_lock($1)", [LOCK_ID]);
    await c.query(`create table if not exists migration_journal(name text primary key, pruefsumme text not null, angewendet_am timestamptz not null default now())`);
    const dateien = readdirSync(verzeichnis).filter((f) => f.endsWith(".sql")).sort();
    const bekannt = new Map((await c.query("select name, pruefsumme from migration_journal")).rows.map((r) => [r.name, r.pruefsumme]));
    for (const f of dateien) {
      const sql = readFileSync(join(verzeichnis, f), "utf8");
      const summe = createHash("sha256").update(sql).digest("hex");
      if (bekannt.has(f)) { if (bekannt.get(f) !== summe) throw new Error(`Pruefsumme geaendert: ${f}`); continue; }
      await c.query("begin");
      try { await c.query(sql); await c.query("insert into migration_journal(name, pruefsumme) values ($1,$2)", [f, summe]); await c.query("commit"); }
      catch (e) { await c.query("rollback"); throw e; }
      angewendet.push(f);
    }
  } finally { await c.query("select pg_advisory_unlock($1)", [LOCK_ID]).catch(() => {}); await c.end(); }
  return { angewendet };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  migriere({ connectionString: process.env.PLANORA_MIGRATOR_DB }).then((r) => console.log(r), (e) => { console.error(e.message); process.exit(1); });
}
