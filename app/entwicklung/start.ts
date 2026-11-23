// Nur Entwicklung: frische Wegwerf-Datenbank und Beispieldaten; nicht im Docker-Image.
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { migriere } from "../src/db/migrator.js";
import { baueServer } from "../src/server.js";
import { clamdScanner } from "../src/dokumente/clamd.js";
import { fakeScanner, scannerKonfig } from "../src/dokumente/scanner.js";
import { erzeugeSetupToken, loeseSetupTokenEin } from "../src/auth/setup.js";
import { hashPasswort } from "../src/auth/auth.js";
import { schalteEin } from "../src/module/schalter.js";
import { beispielAnlegen, musterAnlegen, testgebaeudeAnlegen } from "../src/welt/beispiel.js";

if (process.env.NODE_ENV === "production") throw new Error("Entwicklungsstart ist in Produktion gesperrt");
const port = Number(process.env.PLANORA_PORT ?? 3000);
const pgPort = Number(process.env.PLANORA_PG_PORT ?? 54500);
for (const p of [port, pgPort]) {
  if (!Number.isInteger(p) || p < 1 || p > 65535) throw new Error("Port muss zwischen 1 und 65535 liegen");
}
const dbDir = join(mkdtempSync(join(tmpdir(), "planora-entwicklung-")), "db");
const ablage = mkdtempSync(join(tmpdir(), "planora-ablage-"));
const STUFE = 4 as const;
const pgPasswort = randomBytes(18).toString("hex");
const instanz = new EmbeddedPostgres({ databaseDir: dbDir, user: "postgres", password: pgPasswort,
  port: pgPort, persistent: false,
  // Windows-Standard waere WIN1252; Produktion (Docker postgres) ist UTF8. KI-Texte enthalten Zeichen wie U+2212.
  initdbFlags: ["--encoding=UTF8", "--locale=C"], onLog: () => {}, onError: console.error });
const cfg = { host: "localhost", port: pgPort, user: "postgres", password: pgPasswort, database: "postgres" };
const pool = new pg.Pool(cfg);
let app: Awaited<ReturnType<typeof baueServer>> | undefined;
let gestartet = false;
let beendet = false;
const ende = async () => {
  if (beendet) return;
  beendet = true;
  try { await app?.close(); } finally {
    try { await pool.end(); } finally {
      try { if (gestartet) await instanz.stop(); } finally { aufraeumen(); }
    }
  }
};
/** Wegwerf-Datenbank und Ablage loeschen; sonst bleiben je Start rund 40 MB in %TEMP% liegen (15.11.: 112 Ordner). */
function aufraeumen() {
  for (const ordner of [dirname(dbDir), ablage]) {
    try { rmSync(ordner, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 }); } catch { /* gesperrte Datei: Ordner bleibt */ }
  }
}

try {
  await instanz.initialise();
  await instanz.start();
  gestartet = true;
  await migriere(cfg);
  const passwort = randomBytes(12).toString("base64url");
  await loeseSetupTokenEin(pool, await erzeugeSetupToken(pool), "admin@planora.invalid", "Admin", passwort);
  // Zweites Konto mit Rolle Betreiber, damit "Neues Gebäude" (Recht huelle.verwalten) lokal ausprobiert werden kann.
  const betreiberId = randomUUID(), betreiberPasswort = randomBytes(12).toString("base64url");
  await pool.query(`insert into "user"(id,name,email,email_verified,created_at,updated_at) values($1,'Betreiber',$2,true,now(),now())`, [betreiberId, "betreiber@planora.invalid"]);
  await pool.query("insert into account(id,account_id,provider_id,user_id,password,created_at,updated_at) values($1,$2,'credential',$2,$3,now(),now())", [randomUUID(), betreiberId, await hashPasswort(betreiberPasswort)]);
  await pool.query("insert into konto_status(benutzer_id,status,audit_id) values($1,'aktiv',$2)", [betreiberId, randomUUID()]);
  await pool.query("insert into rolle_zuordnung(benutzer_id,rolle) values($1,'betreiber')", [betreiberId]);
  // Demo (E43): Lebensdauer/Ampel im Entwicklungsstart eingeschaltet.
  await schalteEin(pool, "lebensdauer", STUFE, randomUUID());
  // Demo E44/E45: Preis aus Dokument; liest nur mit OPENAI_API_KEY.
  await schalteEin(pool, "preisdokument", STUFE, randomUUID());
  // PO 17.11.: standardmaessig nur ein leeres Testgebaeude; Beispiel und Muster (Design-Szenarien) mit PLANORA_MUSTER=1.
  if (process.env.PLANORA_MUSTER === "1") {
    await beispielAnlegen(pool);
    await musterAnlegen(pool);
  } else {
    await testgebaeudeAnlegen(pool);
  }
  const baseURL = `http://localhost:${port}`;
  const clamd = scannerKonfig(process.env);
  const virenScanner = clamd ? clamdScanner(clamd) : fakeScanner(); // Entwicklung: ohne clamd der Fake, ausdruecklich hier
  app = await baueServer({ pool, stufe: STUFE, baseURL, secret: randomBytes(32).toString("hex"), ablageWurzel: ablage, virenScanner: virenScanner,
    webWurzel: fileURLToPath(new URL("../web/dist", import.meta.url)) });
  // Nur Entwicklung (PO 15.11.): /entwicklung/anmelden meldet ohne Formular als Admin an und leitet zur App weiter.
  // Abschalten mit PLANORA_OHNE_LOGIN=0. Nicht im Produkt: dieser Start ist in Produktion gesperrt und nicht im Docker-Image.
  if (process.env.PLANORA_OHNE_LOGIN !== "0") {
    app.get("/entwicklung/anmelden", async (_req, reply) => {
      const r = await app!.inject({ method: "POST", url: "/api/auth/sign-in/email", headers: { origin: baseURL },
        payload: { email: "admin@planora.invalid", password: passwort } });
      const cookies = r.headers["set-cookie"];
      if (r.statusCode !== 200 || !cookies) return reply.code(502).type("text/plain").send(`Anmeldung fehlgeschlagen (${r.statusCode})`);
      return reply.header("set-cookie", cookies).redirect("/");
    });
  }
  await app.listen({ host: "127.0.0.1", port });
  console.log(`Planora Entwicklung: ${baseURL}\nOhne Login: ${baseURL}/entwicklung/anmelden\nLogin: admin@planora.invalid / ${passwort}\nLogin Betreiber (neue Gebäude): betreiber@planora.invalid / ${betreiberPasswort}`);
  console.log(process.env.PLANORA_CLAMD_HOST ? "Virenprüfung: clamd " + process.env.PLANORA_CLAMD_HOST : "Virenprüfung: Fake-Scanner (EICAR wird abgelehnt)");
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => { void ende().catch((e) => { console.error(e); process.exitCode = 1; }); });
  }
} catch (e) {
  try { await ende(); } finally { throw e; }
}
