// M1-Abnahme Punkt 4: Alarmkanal (Konfiguration, Signatur, Spool/Journal/Wiederholung, Webhook, SMTP, Host-Anbindung).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer as httpsServer, type Server } from "node:https";
import { createServer as netServer, type Socket } from "node:net";
import { TLSSocket } from "node:tls";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { alarmSpool, ladeAlarmKonfiguration, mitAlarm, pruefeAlarmKonfiguration, pruefeSignatur, signiere, webhookSenden, type Ereignis } from "../src/betrieb/alarm/alarm.js";
import { smtpSenden } from "../src/betrieb/alarm/smtp.js";
import { reconcileMitAlarm, sicherungHost } from "../src/betrieb/host.js";
import type { Ausfuehrer } from "../src/betrieb/update/docker.js";
import { findeOpenssl, testCa, type TestCa } from "./hilfe/test-ca.js";

const SCHLUESSEL = "k".repeat(40);
const WEBHOOK = { webhook: { url: "https://alarm.kunde.test/planora" } };
const ereignis = (): Ereignis => ({ format: 1, id: "e1", instanz: "kunde-a", host: "h", art: "backup", schwere: "fehler", text: "x", zeit: new Date().toISOString() });
let dir: string;
beforeAll(() => { dir = mkdtempSync(join(tmpdir(), "planora-alarm-")); });
afterAll(() => { rmSync(dir, { recursive: true, force: true }); });

describe("Konfiguration", () => {
  it("akzeptiert Webhook und SMTP, lehnt HTTP, Zugangsdaten in der URL, unbekannte Felder und leere Konfiguration ab", () => {
    expect(() => pruefeAlarmKonfiguration(WEBHOOK)).not.toThrow();
    expect(() => pruefeAlarmKonfiguration({ smtp: { host: "mail.kunde.test", port: 587, absender: "planora@kunde.test", empfaenger: ["it@kunde.test"], starttls: true, benutzer: "planora" } })).not.toThrow();
    expect(() => pruefeAlarmKonfiguration({ webhook: { url: "http://alarm.kunde.test" } })).toThrow(/HTTPS/);
    expect(() => pruefeAlarmKonfiguration({ webhook: { url: "https://u:p@alarm.kunde.test" } })).toThrow(/Zugangsdaten/);
    expect(() => pruefeAlarmKonfiguration({ webhook: { url: "https://a.test", secret: "x" } })).toThrow(/nur url/);
    expect(() => pruefeAlarmKonfiguration({ smtp: { host: "m", port: 587, absender: "a@b", empfaenger: ["c@d"], starttls: true, passwort: "x" } })).toThrow(/Passwort gehoert/);
    expect(() => pruefeAlarmKonfiguration({})).toThrow(/mindestens ein Kanal/);
  });
  it("laedt alarm.json und verlangt das HMAC-Secret ausserhalb der Konfiguration", () => {
    const etc = join(dir, "etc-a"); mkdirSync(join(etc, "secrets"), { recursive: true });
    expect(ladeAlarmKonfiguration(etc)).toEqual({ secrets: {} });
    writeFileSync(join(etc, "alarm.json"), JSON.stringify(WEBHOOK));
    expect(() => ladeAlarmKonfiguration(etc)).toThrow(/alarm_hmac/);
    writeFileSync(join(etc, "secrets", "alarm_hmac"), SCHLUESSEL + "\n");
    expect(ladeAlarmKonfiguration(etc).secrets.hmac).toBe(SCHLUESSEL);
  });
});

describe("Signatur", () => {
  it("HMAC-SHA256 ueber Zeit und Body; Manipulation und alte Zeitstempel werden abgelehnt", () => {
    const zeit = String(Math.floor(Date.now() / 1000)), body = JSON.stringify(ereignis()), sig = signiere(SCHLUESSEL, zeit, body);
    expect(sig).toMatch(/^v1=[0-9a-f]{64}$/);
    expect(pruefeSignatur(SCHLUESSEL, zeit, body, sig)).toBe(true);
    expect(pruefeSignatur(SCHLUESSEL, zeit, body.replace('"x"', '"y"'), sig)).toBe(false);
    expect(pruefeSignatur("anderer-schluessel".repeat(3), zeit, body, sig)).toBe(false);
    expect(pruefeSignatur(SCHLUESSEL, zeit, body, sig, Date.now() + 600_000)).toBe(false);
  });
});

describe("Spool, Journal und Wiederholung", () => {
  const journal = (spool: string) => readFileSync(join(spool, "journal.jsonl"), "utf8").trim().split("\n").map((z) => JSON.parse(z));
  it("Zustellfehler wird journalisiert, Alarm bleibt offen und wird nach der Wartezeit zugestellt", async () => {
    const spool = join(dir, "spool-1"); let jetzt = Date.parse("2026-11-11T02:00:00Z"), versuche = 0; const gesendet: Ereignis[] = [];
    const a = alarmSpool({ instanz: "kunde-a", spool, konfiguration: WEBHOOK, secrets: { hmac: SCHLUESSEL }, jetzt: () => jetzt, protokoll: () => {},
      sender: { webhook: async (_w, k, e) => { expect(k).toBe(SCHLUESSEL); if (++versuche <= 2) throw new Error("Webhook antwortet 503"); gesendet.push(e); } } });
    const e = await a.alarmieren("backup", "Sicherung fehlgeschlagen: Exit 1");
    expect(readdirSync(join(spool, "offen"))).toHaveLength(1);
    expect(journal(spool).map((j) => j.art)).toEqual(["erzeugt", "zustellfehler"]);
    expect(await a.zustellen()).toEqual({ zugestellt: 0, offen: 1 }); // Wartezeit 1 min noch nicht abgelaufen
    jetzt += 61_000;
    expect(await a.zustellen()).toEqual({ zugestellt: 0, offen: 1 });
    const offen = JSON.parse(readFileSync(join(spool, "offen", readdirSync(join(spool, "offen"))[0]), "utf8"));
    expect(offen).toMatchObject({ versuche: 2, letzterFehler: "webhook: Webhook antwortet 503" });
    expect(Date.parse(offen.naechsterVersuch) - jetzt).toBe(120_000);
    jetzt += 121_000;
    expect(await a.zustellen()).toEqual({ zugestellt: 1, offen: 0 });
    expect(readdirSync(join(spool, "offen"))).toEqual([]);
    expect(gesendet.map((x) => x.id)).toEqual([e.id]);
    expect(journal(spool).map((j) => j.art)).toEqual(["erzeugt", "zustellfehler", "zustellfehler", "zugestellt"]);
  });
  it("Mehrere Kanaele: nur der fehlgeschlagene Kanal wird wiederholt", async () => {
    const spool = join(dir, "spool-2"); let smtpOk = false; const webhook: string[] = [], smtp: string[] = [];
    const a = alarmSpool({ instanz: "kunde-a", spool, konfiguration: { ...WEBHOOK, smtp: { host: "m", port: 25, absender: "a@b", empfaenger: ["c@d"], starttls: false } }, secrets: { hmac: SCHLUESSEL }, protokoll: () => {},
      sender: { webhook: async (_w, _k, e) => { webhook.push(e.id); }, smtp: async (_k, _p, betreff) => { if (!smtpOk) throw new Error("SMTP weg"); smtp.push(betreff); } } });
    await a.alarmieren("update", "Update abgebrochen");
    smtpOk = true; await a.zustellen(true);
    expect(webhook).toHaveLength(1);
    expect(smtp).toEqual(["[Planora kunde-a] fehler: update"]);
  });
  it("ohne Kanal nur Journal, kein Spool", async () => {
    const spool = join(dir, "spool-3");
    await alarmSpool({ instanz: "kunde-a", spool, secrets: {}, protokoll: () => {} }).alarmieren("reconcile", "x");
    expect(journal(spool).map((j) => j.art)).toEqual(["erzeugt", "kein_kanal"]);
    expect(existsSync(join(spool, "offen"))).toBe(false);
  });
  it("mitAlarm: Erfolg loest keinen Alarm aus, Fehler alarmiert und wird weitergereicht", async () => {
    const alarme: string[] = [];
    const a = { alarmieren: async (art: string, text: string) => { alarme.push(`${art}|${text}`); } };
    expect(await mitAlarm(a, "backup", "Sicherung", async () => 7)).toBe(7);
    expect(alarme).toEqual([]);
    await expect(mitAlarm(a, "backup", "Sicherung fehlgeschlagen", async () => { throw new Error("docker → Exit 1: x\nzweite Zeile"); })).rejects.toThrow(/Exit 1/);
    expect(alarme).toEqual(["backup|Sicherung fehlgeschlagen: docker → Exit 1: x"]);
  });
});

describe("Host-Anbindung", () => {
  const i = { projekt: "planora-kunde-a", envDatei: "instanz.env", composeDateien: ["compose.yaml", "compose.backup.yaml"] };
  const fake = (fehler: Record<string, boolean>) => {
    const aufrufe: string[] = [];
    const docker: Ausfuehrer = async (args) => {
      const befehl = args.includes("sichern") ? "sichern" : args.includes("aufbewahren") ? "aufbewahren" : args.includes("reconcile") ? "reconcile" : args[0];
      aufrufe.push(befehl);
      if (fehler[befehl]) return { code: 1, stdout: "", stderr: "Betriebsbefehl fehlgeschlagen" };
      return { code: 0, stdout: befehl === "ps" ? "" : befehl === "reconcile" ? JSON.stringify({ fehlgeschlagen: fehler.abgebrochen ? 2 : 0 }) : JSON.stringify({ ok: befehl }), stderr: "" };
    };
    const alarme: string[] = [];
    return { docker, aufrufe, alarme, alarm: { alarmieren: async (art: string, text: string, schwere = "fehler") => { alarme.push(`${art}|${schwere}|${text}`); } } };
  };
  it("Sicherung erfolgreich: Retention laeuft, kein Alarm", async () => {
    const f = fake({});
    expect(await sicherungHost(f.docker, i, "nacht", f.alarm)).toEqual({ sicherung: { ok: "sichern" }, retention: { ok: "aufbewahren" } });
    expect(f.aufrufe).toEqual(["sichern", "aufbewahren"]);
    expect(f.alarme).toEqual([]);
  });
  it("Sicherung fehlgeschlagen: Alarm backup, keine Retention", async () => {
    const f = fake({ sichern: true });
    await expect(sicherungHost(f.docker, i, "nacht", f.alarm)).rejects.toThrow();
    expect(f.aufrufe).toEqual(["sichern"]);
    expect(f.alarme).toHaveLength(1);
    expect(f.alarme[0]).toMatch(/^backup\|fehler\|Sicherung fehlgeschlagen: docker compose .* Exit 1: Betriebsbefehl fehlgeschlagen$/);
  });
  it("Retention fehlgeschlagen: Alarm retention", async () => {
    const f = fake({ aufbewahren: true });
    await expect(sicherungHost(f.docker, i, "nacht", f.alarm)).rejects.toThrow();
    expect(f.alarme.map((x) => x.split("|")[0])).toEqual(["retention"]);
  });
  it("Reconcile: Fehler alarmiert; bereinigte abgebrochene Sicherungen melden eine Warnung", async () => {
    const f = fake({ reconcile: true });
    await expect(reconcileMitAlarm(f.docker, i, f.alarm)).rejects.toThrow();
    expect(f.alarme.map((x) => x.split("|")[0])).toEqual(["reconcile"]);
    const g = fake({ abgebrochen: true });
    expect(await reconcileMitAlarm(g.docker, i, g.alarm)).toBe(2);
    expect(g.alarme).toEqual(["backup|warnung|2 abgebrochene Sicherung(en) vom Reconcile als fehlgeschlagen markiert"]);
    const h = fake({});
    expect(await reconcileMitAlarm(h.docker, i, h.alarm)).toBe(0);
    expect(h.alarme).toEqual([]);
  });
});

const openssl = findeOpenssl();
describe.skipIf(!openssl)("Webhook und SMTP gegen lokale Empfaenger (Test-CA)", () => {
  let ca: TestCa, zert: ReturnType<TestCa["ausstellen"]>;
  beforeAll(() => { ca = testCa(openssl!); zert = ca.ausstellen("empfaenger", { dns: ["localhost"] }); });
  afterAll(() => ca?.aufraeumen());
  const caDatei = () => { const p = join(dir, "ca.pem"); writeFileSync(p, ca.caPem); return p; };

  it("Webhook: signierter POST, Empfaenger prueft Signatur; 5xx und fremde CA gelten als Zustellfehler", async () => {
    const empfangen: { gueltig: boolean; ereignis: string }[] = []; let status = 204;
    const server: Server = httpsServer({ key: zert.keyPem, cert: zert.certPem }, (req, res) => {
      let body = ""; req.setEncoding("utf8"); req.on("data", (d) => { body += d; });
      req.on("end", () => {
        empfangen.push({ gueltig: pruefeSignatur(SCHLUESSEL, String(req.headers["x-planora-zeit"]), body, String(req.headers["x-planora-signatur"])), ereignis: String(req.headers["x-planora-ereignis"]) });
        res.writeHead(status).end();
      });
    });
    await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
    const url = `https://localhost:${(server.address() as { port: number }).port}/alarm`;
    try {
      await webhookSenden({ url, ca: caDatei() }, SCHLUESSEL, ereignis());
      expect(empfangen).toEqual([{ gueltig: true, ereignis: "e1" }]);
      status = 503;
      await expect(webhookSenden({ url, ca: caDatei() }, SCHLUESSEL, ereignis())).rejects.toThrow(/503/);
      await expect(webhookSenden({ url }, SCHLUESSEL, ereignis())).rejects.toThrow(/nicht erreichbar/);
    } finally { server.close(); }
  });
  it("SMTP mit STARTTLS und AUTH PLAIN; ohne STARTTLS-Angebot Abbruch", async () => {
    const protokoll: string[] = []; let bietetStarttls = true;
    const server = netServer((roh) => {
      let s: Socket | TLSSocket = roh; let puffer = "", inData = false, nachricht = "";
      const schreibe = (z: string) => s.write(z + "\r\n");
      const verarbeite = (zeile: string) => {
        if (inData) { if (zeile === ".") { inData = false; protokoll.push(`NACHRICHT ${nachricht}`); schreibe("250 ok"); } else nachricht += zeile + "\n"; return; }
        protokoll.push(zeile.split(" ")[0]);
        if (zeile.startsWith("EHLO")) schreibe(bietetStarttls && !(s instanceof TLSSocket) ? "250-mock\r\n250 STARTTLS" : "250-mock\r\n250 AUTH PLAIN");
        else if (zeile === "STARTTLS") {
          schreibe("220 los"); roh.removeAllListeners("data");
          s = new TLSSocket(roh, { isServer: true, key: zert.keyPem, cert: zert.certPem }); s.setEncoding("utf8"); s.on("data", lies);
        } else if (zeile.startsWith("AUTH PLAIN")) { protokoll.push(Buffer.from(zeile.slice(11), "base64").toString().split("\0").join("|")); schreibe("235 ok"); }
        else if (zeile === "DATA") { inData = true; schreibe("354 los"); }
        else if (zeile === "QUIT") { schreibe("221 tschuess"); s.end(); }
        else schreibe("250 ok");
      };
      const lies = (d: string) => { puffer += d; let i; while ((i = puffer.indexOf("\r\n")) >= 0) { const z = puffer.slice(0, i); puffer = puffer.slice(i + 2); verarbeite(z); } };
      roh.setEncoding("utf8"); roh.on("data", lies); roh.on("error", () => {});
      schreibe("220 mock");
    });
    await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
    const port = (server.address() as { port: number }).port;
    const k = { host: "localhost", port, absender: "planora@kunde.test", empfaenger: ["it@kunde.test", "pikett@kunde.test"], starttls: true, benutzer: "planora", ca: caDatei() };
    try {
      await smtpSenden(k, "geheim", "[Planora kunde-a] fehler: backup", "Sicherung fehlgeschlagen\n.punkt am Zeilenanfang");
      await new Promise((r) => setTimeout(r, 100));
      expect(protokoll.slice(0, 7)).toEqual(["EHLO", "STARTTLS", "EHLO", "AUTH", "|planora|geheim", "MAIL", "RCPT"]);
      const nachricht = protokoll.find((z) => z.startsWith("NACHRICHT"))!;
      expect(nachricht).toContain("Subject: [Planora kunde-a] fehler: backup");
      expect(nachricht).toContain("\n..punkt am Zeilenanfang\n");
      bietetStarttls = false;
      await expect(smtpSenden(k, "geheim", "x", "y")).rejects.toThrow(/kein STARTTLS/);
    } finally { server.close(); }
  });
});
