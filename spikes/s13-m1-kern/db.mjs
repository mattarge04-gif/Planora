// Gemeinsam: startet ein lokales PostgreSQL (embedded-postgres) unter ./.pgdata-<name>.
// Passwort pro Lauf zufaellig, nirgends gespeichert. Nach dem Lauf wird das Verzeichnis geloescht.
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import { randomBytes } from "node:crypto";
import { rmSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export async function startePg(name, port) {
  const dir = fileURLToPath(new URL(`./.pgdata-${name}`, import.meta.url));
  const pw = randomBytes(18).toString("hex");
  rmSync(dir, { recursive: true, force: true });
  const inst = new EmbeddedPostgres({ databaseDir: dir, user: "postgres", password: pw, port, persistent: false, onLog: () => {}, onError: () => {} });
  await inst.initialise(); await inst.start();
  const cfg = { host: "localhost", port, user: "postgres", password: pw, database: "postgres" };
  const c = new pg.Client(cfg); await c.connect();
  const version = (await c.query("show server_version")).rows[0].server_version; await c.end();
  return {
    cfg, version, pg,
    async stop() { await inst.stop(); rmSync(dir, { recursive: true, force: true }); },
  };
}

export const perzentil = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]; };

export function speichereErgebnis(teil, daten) {
  const f = fileURLToPath(new URL("./ergebnis.json", import.meta.url));
  const alt = existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : {};
  alt[teil] = { gemessen: new Date().toISOString(), node: process.version, ...daten };
  writeFileSync(f, JSON.stringify(alt, null, 2) + "\n");
}
