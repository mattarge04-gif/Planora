// M1-Abnahme Punkt 4: Alarmkanal gegen einen lokalen Mock-Empfaenger in Docker (HTTPS mit Test-CA, eigene
// HMAC-Pruefung). Echte Sicherung ueber das Host-Werkzeug: Erfolg erzeugt keinen Alarm, Fehler schon; ein
// Zustellfehler (503) wird journalisiert und wiederholt. Projekt pa-alarm, DB-Port 18406, Empfaenger 18410.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { request } from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { alarmSpool, signiere } from "../src/betrieb/alarm/alarm.js";
import { sicherungHost } from "../src/betrieb/host.js";
import { dockerAusfuehrer, type InstanzPfad } from "../src/betrieb/update/docker.js";
import { findeOpenssl, testCa, type TestCa } from "../test/hilfe/test-ca.js";
import { backupUmgebung, dockerAus, type BackupUmgebung } from "./backup-hilfe.js";

const projekt = process.env.PLANORA_TEST_ALARM_PROJEKT ?? "pa-alarm";
const dbPort = Number(process.env.PLANORA_TEST_ALARM_DBPORT ?? "18406");
const mockPort = Number(process.env.PLANORA_TEST_ALARM_PORT ?? "18410");
const MOCK = `${projekt}-empfaenger`;
const aktiv = process.env.PLANORA_DOCKER_TESTS === "1" || process.env.PLANORA_DOCKER_TEST === "b";

// Unabhaengige Empfaenger-Implementierung (nur node:-Module im Container): prueft Signatur und Zeitfenster selbst,
// antwortet die ersten N Anfragen mit 503 (Datei /w/fehler), protokolliert jede Anfrage als JSON-Zeile auf stdout.
const EMPFAENGER = `
import { createServer } from "node:https";
import { createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
const schluessel = readFileSync("/w/hmac", "utf8").trim();
createServer({ key: readFileSync("/w/key.pem"), cert: readFileSync("/w/cert.pem") }, (req, res) => {
  let body = ""; req.setEncoding("utf8"); req.on("data", (d) => { body += d; });
  req.on("end", () => {
    const zeit = String(req.headers["x-planora-zeit"] ?? ""), sig = Buffer.from(String(req.headers["x-planora-signatur"] ?? ""));
    const soll = Buffer.from("v1=" + createHmac("sha256", schluessel).update(zeit + "." + body).digest("hex"));
    const gueltig = sig.length === soll.length && timingSafeEqual(sig, soll) && Math.abs(Date.now() / 1000 - Number(zeit)) <= 300;
    let fehler = 0; try { fehler = Number(readFileSync("/w/fehler", "utf8")) || 0; } catch {}
    const status = !gueltig ? 401 : fehler > 0 ? 503 : 204;
    console.log(JSON.stringify({ gueltig, status, ereignis: req.headers["x-planora-ereignis"], body: gueltig ? JSON.parse(body) : null }));
    if (gueltig && fehler > 0) writeFileSync("/w/zaehler-" + Date.now(), "");
    res.writeHead(status).end();
  });
}).listen(8443, () => console.log(JSON.stringify({ bereit: true })));
`;

describe.runIf(aktiv)("Alarmkanal gegen Mock-Empfaenger (Docker)", () => {
  let u: BackupUmgebung, ca: TestCa, mockDir: string, arbeit: string, i: InstanzPfad, alarm: ReturnType<typeof alarmSpool>;
  const hmac = randomBytes(32).toString("hex");
  const empfangen = async () => (await dockerAus(["logs", MOCK])).trim().split(/\r?\n/).map((z) => JSON.parse(z)).filter((z) => !z.bereit);
  const journal = () => existsSync(join(arbeit, "spool", "journal.jsonl")) ? readFileSync(join(arbeit, "spool", "journal.jsonl"), "utf8").trim().split("\n").map((z) => JSON.parse(z)) : [];
  const offen = () => existsSync(join(arbeit, "spool", "offen")) ? readdirSync(join(arbeit, "spool", "offen")).filter((n) => n.endsWith(".json")) : [];
  const setzeFehler = (n: number) => writeFileSync(join(mockDir, "fehler"), String(n));

  beforeAll(async () => {
    const openssl = findeOpenssl();
    if (!openssl) throw new Error("openssl fehlt (PLANORA_OPENSSL setzen)");
    if ((await dockerAus(["ps", "-aq", "--filter", `name=^${MOCK}$`])).trim()) throw new Error(`Container ${MOCK} existiert bereits; nichts veraendert`);
    ca = testCa(openssl, "Planora Test-Alarm-CA");
    const zert = ca.ausstellen("empfaenger", { dns: ["localhost"] });
    mockDir = mkdtempSync(join(tmpdir(), `${MOCK}-`)); arbeit = mkdtempSync(join(tmpdir(), `${projekt}-host-`));
    writeFileSync(join(mockDir, "empfaenger.mjs"), EMPFAENGER); writeFileSync(join(mockDir, "hmac"), hmac);
    writeFileSync(join(mockDir, "key.pem"), zert.keyPem); writeFileSync(join(mockDir, "cert.pem"), zert.certPem); setzeFehler(0);
    writeFileSync(join(arbeit, "ca.pem"), ca.caPem);
    await dockerAus(["run", "-d", "--name", MOCK, "--label", "planora-test=m1-abnahme-a", "-p", `127.0.0.1:${mockPort}:8443`, "-v", `${mockDir.replace(/\\/g, "/")}:/w`, "node:24-bookworm-slim", "node", "/w/empfaenger.mjs"]);
    u = await backupUmgebung(projekt, dbPort);
    i = await u.envDatei(join(arbeit, "instanz.env"));
    // Gleicher Aufbau wie host-cli: Konfiguration ohne Secrets, HMAC getrennt.
    alarm = alarmSpool({ instanz: projekt, spool: join(arbeit, "spool"), konfiguration: { webhook: { url: `https://localhost:${mockPort}/planora`, ca: join(arbeit, "ca.pem") } }, secrets: { hmac }, protokoll: () => {} });
    for (let n = 0; n < 50 && !(await dockerAus(["logs", MOCK])).includes("bereit"); n++) await new Promise((r) => setTimeout(r, 200));
  });
  afterAll(async () => {
    await dockerAus(["rm", "-f", MOCK]).catch(() => {});
    await u?.aufraeumen();
    ca?.aufraeumen();
    for (const d of [mockDir, arbeit]) if (d) rmSync(d, { recursive: true, force: true });
  });

  it("Erfolgreiche Sicherung (inkl. Retention) loest keinen Alarm aus", async () => {
    const r = await sicherungHost(dockerAusfuehrer(), i, alarm, { anlass: "alarmtest", zustandDatei: join(arbeit, "update.json"), sperrDatei: join(arbeit, "update.lock") });
    expect(r.sicherung?.zustand).toBe("geprueft");
    expect(r.retention.entfernt).toEqual([]);
    expect(await empfangen()).toEqual([]);
    expect(journal()).toEqual([]);
  });
  it("Fehlgeschlagene Sicherung loest einen signierten, pruefbaren Alarm aus", async () => {
    await u.compose("stop", "db");
    await expect(sicherungHost(dockerAusfuehrer(), i, alarm, { anlass: "alarmtest", zustandDatei: join(arbeit, "update.json"), sperrDatei: join(arbeit, "update.lock") })).rejects.toThrow(/Exit 1/);
    const e = await empfangen();
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ gueltig: true, status: 204, body: { format: 1, instanz: projekt, art: "backup", schwere: "fehler" } });
    expect(e[0].body.text).toMatch(/^Sicherung fehlgeschlagen: /);
    expect(e[0].ereignis).toBe(e[0].body.id);
    expect(journal().map((j) => j.art)).toEqual(["erzeugt", "zugestellt"]);
    expect(offen()).toEqual([]);
  });
  it("Falsche Signatur wird vom Empfaenger abgewiesen", async () => {
    const body = JSON.stringify({ format: 1, id: "gefaelscht" }), zeit = String(Math.floor(Date.now() / 1000));
    const status = await new Promise<number>((ok, f) => {
      const req = request(`https://localhost:${mockPort}/planora`, { method: "POST", ca: ca.caPem, headers: { "content-type": "application/json", "x-planora-zeit": zeit, "x-planora-signatur": signiere("falscher-schluessel-".repeat(3), zeit, body), "x-planora-ereignis": "gefaelscht" } }, (res) => { res.resume(); ok(res.statusCode ?? 0); });
      req.on("error", f); req.end(body);
    });
    expect(status).toBe(401);
    expect((await empfangen()).at(-1)).toMatchObject({ gueltig: false, status: 401, ereignis: "gefaelscht" });
  });
  it("PP11a-8: dieselbe andauernde Stoerung wird nicht erneut gesendet, sondern aggregiert", async () => {
    const vorher = (await empfangen()).length;
    await expect(sicherungHost(dockerAusfuehrer(), i, alarm, { anlass: "alarmtest", zustandDatei: join(arbeit, "update.json"), sperrDatei: join(arbeit, "update.lock") })).rejects.toThrow(/Exit 1/);
    expect((await empfangen()).length).toBe(vorher);
    expect(journal().at(-1)).toMatchObject({ art: "aggregiert", stoerung: "sicherung", anzahl: 2 });
  });
  it("Zustellfehler wird journalisiert und wiederholt, bis der Empfaenger annimmt", async () => {
    setzeFehler(1);
    // Manueller Retention-Aufruf (planora aufbewahren) bei gestoppter DB: eigene Stoerung, eigener Alarm.
    await expect(sicherungHost(dockerAusfuehrer(), i, alarm, { nurRetention: true, zustandDatei: join(arbeit, "update.json"), sperrDatei: join(arbeit, "update.lock") })).rejects.toThrow();
    expect(offen()).toHaveLength(1);
    const fehler = journal().filter((j) => j.art === "zustellfehler");
    expect(fehler).toHaveLength(1);
    expect(fehler[0].fehler).toMatch(/503/);
    expect(await alarm.zustellen()).toEqual({ zugestellt: 0, offen: 1 }); // Wartezeit laeuft noch
    expect(await alarm.zustellen(true)).toEqual({ zugestellt: 0, offen: 1 }); // Empfaenger weiterhin 503
    setzeFehler(0);
    expect(await alarm.zustellen(true)).toEqual({ zugestellt: 1, offen: 0 });
    const e = (await empfangen()).filter((x) => x.gueltig && x.body?.art === "retention").slice(-3);
    expect(e.map((x) => x.status)).toEqual([503, 503, 204]);
    expect(new Set(e.map((x) => x.ereignis)).size).toBe(1);
    expect(journal().slice(-4).map((j) => j.art)).toEqual(["erzeugt", "zustellfehler", "zustellfehler", "zugestellt"]);
    await u.compose("start", "db");
  });
});
