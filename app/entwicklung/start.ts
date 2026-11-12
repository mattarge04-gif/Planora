// Nur Entwicklung: frische Wegwerf-Datenbank und Beispieldaten; nicht im Docker-Image.
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { migriere } from "../src/db/migrator.js";
import { baueServer } from "../src/server.js";
import { erzeugeSetupToken, loeseSetupTokenEin } from "../src/auth/setup.js";
import { beispielAnlegen } from "../src/welt/beispiel.js";

if (process.env.NODE_ENV === "production") throw new Error("Entwicklungsstart ist in Produktion gesperrt");
const port = Number(process.env.PLANORA_PORT ?? 3000);
const pgPort = Number(process.env.PLANORA_PG_PORT ?? 54500);
for (const p of [port, pgPort]) {
  if (!Number.isInteger(p) || p < 1 || p > 65535) throw new Error("Port muss zwischen 1 und 65535 liegen");
}
const dbDir = join(mkdtempSync(join(tmpdir(), "planora-entwicklung-")), "db");
const ablage = mkdtempSync(join(tmpdir(), "planora-ablage-"));
const pgPasswort = randomBytes(18).toString("hex");
const instanz = new EmbeddedPostgres({ databaseDir: dbDir, user: "postgres", password: pgPasswort,
  port: pgPort, persistent: false, onLog: () => {}, onError: console.error });
const cfg = { host: "localhost", port: pgPort, user: "postgres", password: pgPasswort, database: "postgres" };
const pool = new pg.Pool(cfg);
let app: Awaited<ReturnType<typeof baueServer>> | undefined;
let gestartet = false;
let beendet = false;
const ende = async () => {
  if (beendet) return;
  beendet = true;
  try { await app?.close(); } finally {
    try { await pool.end(); } finally { if (gestartet) await instanz.stop(); }
  }
};

try {
  await instanz.initialise();
  await instanz.start();
  gestartet = true;
  await migriere(cfg);
  const passwort = randomBytes(12).toString("base64url");
  await loeseSetupTokenEin(pool, await erzeugeSetupToken(pool), "admin@planora.invalid", "Admin", passwort);
  await beispielAnlegen(pool);
  const baseURL = `http://localhost:${port}`;
  app = await baueServer({ pool, stufe: 2, baseURL, secret: randomBytes(32).toString("hex"), ablageWurzel: ablage,
    webWurzel: fileURLToPath(new URL("../web/dist", import.meta.url)) });
  await app.listen({ host: "127.0.0.1", port });
  console.log(`Planora Entwicklung: ${baseURL}\nLogin: admin@planora.invalid / ${passwort}`);
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => { void ende().catch((e) => { console.error(e); process.exitCode = 1; }); });
  }
} catch (e) {
  try { await ende(); } finally { throw e; }
}
