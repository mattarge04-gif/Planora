// M1-Abnahme Punkt 4: Alarmkanal (Konfiguration, Signatur, Spool/Journal/Wiederholung, Webhook, SMTP, Host-Anbindung).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer as httpsServer, type Server } from "node:https";
import { createServer as netServer, type Socket } from "node:net";
import { TLSSocket } from "node:tls";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JOURNAL_MAX_BYTES, MAX_OFFEN, alarmSpool, instanzAlarm, ladeAlarmKonfiguration, mitAlarm, pruefeAlarmKonfiguration, pruefeSignatur, signiere, webhookSenden, type Ereignis } from "../src/betrieb/alarm/alarm.js";
import { smtpSenden } from "../src/betrieb/alarm/smtp.js";
import { betriebsDienst, reconcileMitAlarm, sicherungHost } from "../src/betrieb/host.js";
import { dateiSperre } from "../src/betrieb/update/zustand.js";
import { hostname } from "node:os";
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
    expect(() => pruefeAlarmKonfiguration({ smtp: { host: "mail.kunde.test", port: 587, absender: "planora@kunde.test", planoraAdresse: "kunde-a@planora.test", empfaenger: ["it@kunde.test"], starttls: true, benutzer: "planora" } })).not.toThrow();
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
    const a = alarmSpool({ instanz: "kunde-a", spool, konfiguration: { ...WEBHOOK, smtp: { host: "m", port: 25, absender: "a@b.test", planoraAdresse: "kunde-a@planora.test", empfaenger: ["c@d.test"], starttls: false } }, secrets: { hmac: SCHLUESSEL }, protokoll: () => {},
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
  it("PP11a-4: ungueltige Konfiguration: offene Alarme werden weder zugestellt noch geloescht; nach Korrektur zugestellt", async () => {
    const etc = join(dir, "etc-pp4"), varDir = join(dir, "var-pp4"); mkdirSync(join(etc, "secrets"), { recursive: true });
    writeFileSync(join(etc, "alarm.json"), JSON.stringify(WEBHOOK)); writeFileSync(join(etc, "secrets", "alarm_hmac"), SCHLUESSEL);
    let gesendet = 0, ok = false;
    const sender = { webhook: async () => { if (!ok) throw new Error("Webhook antwortet 503"); gesendet++; } };
    const mit = () => { const a = instanzAlarm("kunde-a", etc, varDir, () => {}); return a; };
    // gueltig, Zustellung scheitert: bleibt offen
    const erst = alarmSpool({ instanz: "kunde-a", spool: join(varDir, "alarm"), ...ladeAlarmKonfiguration(etc), sender, protokoll: () => {} });
    await erst.alarmieren("backup", "Sicherung fehlgeschlagen");
    const offen = () => readdirSync(join(varDir, "alarm", "offen")).filter((n) => n.endsWith(".json"));
    expect(offen()).toHaveLength(1);
    expect(JSON.parse(readFileSync(join(varDir, "alarm", "offen", offen()[0]), "utf8")).kanaele).toEqual(["webhook"]);
    // Konfiguration wird ungueltig: nichts zustellen, nichts loeschen; neuer Alarm wird trotzdem gespoolt
    writeFileSync(join(etc, "alarm.json"), "{kaputt");
    ok = true;
    expect(await mit().zustellen(true)).toEqual({ zugestellt: 0, offen: 1 });
    await mit().alarmieren("reconcile", "Reconcile fehlgeschlagen");
    expect(offen()).toHaveLength(2);
    expect(gesendet).toBe(0);
    // Kanalwechsel auf nur SMTP: der webhook-pflichtige Alarm bleibt offen (kein stilles Quittieren)
    writeFileSync(join(etc, "alarm.json"), JSON.stringify({ smtp: { host: "m", port: 25, absender: "a@b.test", planoraAdresse: "kunde-a@planora.test", empfaenger: ["c@d.test"], starttls: false } }));
    const nurSmtp = alarmSpool({ instanz: "kunde-a", spool: join(varDir, "alarm"), ...ladeAlarmKonfiguration(etc), sender: { smtp: async () => { gesendet++; } }, protokoll: () => {} });
    expect(await nurSmtp.zustellen(true)).toEqual({ zugestellt: 1, offen: 1 }); // der waehrend ungueltiger Konfig erzeugte geht ueber SMTP
    expect(readFileSync(join(varDir, "alarm", "journal.jsonl"), "utf8")).toContain("Kanal nicht mehr konfiguriert");
    // Konfiguration wieder mit Webhook: Rest wird zugestellt
    writeFileSync(join(etc, "alarm.json"), JSON.stringify(WEBHOOK));
    const wieder = alarmSpool({ instanz: "kunde-a", spool: join(varDir, "alarm"), ...ladeAlarmKonfiguration(etc), sender, protokoll: () => {} });
    expect(await wieder.zustellen(true)).toEqual({ zugestellt: 1, offen: 0 });
    expect(gesendet).toBe(2);
  });
  it("PP11a-8: gleiche Stoerung wird aggregiert (Erinnerung nach 24 h), Spool ist begrenzt", async () => {
    const spool = join(dir, "spool-agg"); let jetzt = Date.parse("2026-11-11T02:00:00Z"); const gesendet: string[] = [];
    const a = alarmSpool({ instanz: "kunde-a", spool, konfiguration: WEBHOOK, secrets: { hmac: SCHLUESSEL }, jetzt: () => jetzt, protokoll: () => {}, sender: { webhook: async (_w, _k, e) => { gesendet.push(e.text); } } });
    for (let n = 0; n < 5; n++) { await a.alarmieren("reconcile", "Reconcile fehlgeschlagen", "fehler", "reconcile"); jetzt += 60_000; }
    expect(gesendet).toEqual(["Reconcile fehlgeschlagen"]);
    jetzt += 24 * 3_600_000;
    await a.alarmieren("reconcile", "Reconcile fehlgeschlagen", "fehler", "reconcile");
    expect(gesendet[1]).toMatch(/andauernd seit 2026-11-11T02:00:00.000Z, 6 Vorkommen/);
    await a.behoben("reconcile", "Reconcile");
    expect(gesendet[2]).toMatch(/^Behoben: Reconcile/);
    await a.behoben("reconcile", "Reconcile"); // ohne Stoerung keine weitere Meldung
    expect(gesendet).toHaveLength(3);
    // Begrenzung: Empfaenger dauerhaft weg, mehr als MAX_OFFEN Alarme
    const voll = alarmSpool({ instanz: "kunde-a", spool: join(dir, "spool-voll"), konfiguration: WEBHOOK, secrets: { hmac: SCHLUESSEL }, protokoll: () => {}, sender: { webhook: async () => { throw new Error("weg"); } } });
    for (let n = 0; n < MAX_OFFEN + 5; n++) await voll.alarmieren("backup", `Fehler ${n}`);
    expect(readdirSync(join(dir, "spool-voll", "offen")).filter((x) => x.endsWith(".json"))).toHaveLength(MAX_OFFEN);
    expect(readFileSync(join(dir, "spool-voll", "journal.jsonl"), "utf8").match(/"art":"verworfen"/g)).toHaveLength(5);
  }, 60_000);
  it("PP11a-N-5: Erinnerung schon nach 20 h; geaenderte Fehlermeldung wird sofort neu gemeldet", async () => {
    const spool = join(dir, "spool-n5"); let jetzt = Date.parse("2026-11-11T02:00:00Z"); const gesendet: string[] = [];
    const a = alarmSpool({ instanz: "kunde-a", spool, konfiguration: WEBHOOK, secrets: { hmac: SCHLUESSEL }, jetzt: () => jetzt, protokoll: () => {}, sender: { webhook: async (_w, _k, e) => { gesendet.push(e.text); } } });
    await a.alarmieren("backup", "Sicherung fehlgeschlagen: Exit 1", "fehler", "sicherung");
    jetzt += 21 * 3_600_000; // Folgenacht, Timer 3 h frueher gestartet: trotzdem melden
    await a.alarmieren("backup", "Sicherung fehlgeschlagen: Exit 1", "fehler", "sicherung");
    expect(gesendet).toHaveLength(2);
    jetzt += 60_000;
    await a.alarmieren("backup", "Sicherung fehlgeschlagen: Exit 1", "fehler", "sicherung");
    expect(gesendet).toHaveLength(2);
    await a.alarmieren("backup", "Sicherung fehlgeschlagen: Speicher voll", "fehler", "sicherung");
    expect(gesendet).toHaveLength(3);
    expect(gesendet[2]).toMatch(/^Sicherung fehlgeschlagen: Speicher voll \(andauernd seit/);
    expect(existsSync(join(spool, "stoerungen.json.lock"))).toBe(false);
  });
  it("PP11a-N-6: verworfene Alarme werden nach Wiederherstellung als Sammelmeldung nachgereicht; Journal rotiert", async () => {
    const spool = join(dir, "spool-n6"); let erreichbar = false; const gesendet: string[] = [];
    const a = alarmSpool({ instanz: "kunde-a", spool, konfiguration: WEBHOOK, secrets: { hmac: SCHLUESSEL }, protokoll: () => {}, sender: { webhook: async (_w, _k, e) => { if (!erreichbar) throw new Error("weg"); gesendet.push(e.text); } } });
    for (let n = 0; n < MAX_OFFEN + 3; n++) await a.alarmieren("backup", `Fehler ${n}`);
    erreichbar = true;
    await a.zustellen(true);
    expect(gesendet.filter((t) => /3 Alarme wurden wegen Spool-Ueberlauf/.test(t))).toHaveLength(1);
    expect(existsSync(join(spool, "verworfen.json"))).toBe(false);
    writeFileSync(join(spool, "journal.jsonl"), "x".repeat(JOURNAL_MAX_BYTES + 1));
    await a.alarmieren("test", "nach Rotation", "warnung");
    expect(existsSync(join(spool, "journal.1.jsonl"))).toBe(true);
    expect(readFileSync(join(spool, "journal.jsonl"), "utf8").length).toBeLessThan(10_000);
  }, 60_000);
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
    const aufrufe: string[] = [], argumente: string[][] = [];
    const docker: Ausfuehrer = async (args) => {
      const befehl = args.includes("sichern") ? "sichern" : args.includes("aufbewahren") ? "aufbewahren" : args.includes("reconcile") ? "reconcile" : args.includes("psql") ? "wartung" : args[0];
      if (befehl !== "wartung") { aufrufe.push(befehl); argumente.push(args); }
      if (fehler[befehl]) return { code: 1, stdout: "", stderr: "Betriebsbefehl fehlgeschlagen" };
      if (befehl === "wartung") return { code: 0, stdout: fehler.inWartung ? "true" : "false", stderr: "" };
      if (befehl === "aufbewahren") return { code: 0, stdout: JSON.stringify({ ok: befehl, offeneSaetze: fehler.offen ? 1 : 0 }), stderr: "" };
      return { code: 0, stdout: befehl === "ps" ? "" : befehl === "reconcile" ? JSON.stringify({ fehlgeschlagen: fehler.abgebrochen ? 2 : 0 }) : JSON.stringify({ ok: befehl }), stderr: "" };
    };
    const alarme: string[] = [], behoben: string[] = [];
    return { docker, aufrufe, argumente, alarme, behoben, fehler, alarm: { alarmieren: async (art: string, text: string, schwere = "fehler") => { alarme.push(`${art}|${schwere}|${text}`); }, behoben: async (k: string) => { behoben.push(k); } } };
  };
  const koordination = () => { const d = mkdtempSync(join(dir, "host-")); return { zustandDatei: join(d, "update.json"), sperrDatei: join(d, "update.lock") }; };
  it("Sicherung erfolgreich: Retention laeuft, kein Alarm, Sperre wieder frei", async () => {
    const f = fake({}), k = koordination();
    expect(await sicherungHost(f.docker, i, f.alarm, k)).toEqual({ ausgesetzt: null, sicherung: { ok: "sichern" }, retention: { ok: "aufbewahren", offeneSaetze: 0 }, reserviert: [] });
    expect(f.aufrufe).toEqual(["sichern", "aufbewahren"]);
    expect(f.alarme).toEqual([]);
    expect(existsSync(k.sperrDatei)).toBe(false);
  });
  it("Sicherung fehlgeschlagen: Alarm backup, keine Retention", async () => {
    const f = fake({ sichern: true }), k = koordination();
    await expect(sicherungHost(f.docker, i, f.alarm, k)).rejects.toThrow();
    expect(f.aufrufe).toEqual(["sichern"]);
    expect(f.alarme).toHaveLength(1);
    expect(f.alarme[0]).toMatch(/^backup\|fehler\|Sicherung fehlgeschlagen: docker compose .* Exit 1: Betriebsbefehl fehlgeschlagen$/);
    expect(existsSync(k.sperrDatei)).toBe(false);
  });
  it("Retention fehlgeschlagen: Alarm retention", async () => {
    const f = fake({ aufbewahren: true });
    await expect(sicherungHost(f.docker, i, f.alarm, koordination())).rejects.toThrow();
    expect(f.alarme.map((x) => x.split("|")[0])).toEqual(["retention"]);
  });
  it("PP11a-3: offenes Update: keine neue Sicherung, Retention reserviert dessen Satz", async () => {
    const f = fake({}), k = koordination(), backupId = "11111111-2222-4333-8444-555555555555";
    writeFileSync(k.zustandDatei, JSON.stringify({ format: 1, id: "u1", bestaetigt: 5, begonnen: 6, status: "abgebrochen", backupId }));
    const r = await sicherungHost(f.docker, i, f.alarm, k);
    expect(f.aufrufe).toEqual(["aufbewahren"]);
    expect(f.argumente[0].slice(-3)).toEqual(["aufbewahren", "--reserviert", backupId]);
    expect(r).toMatchObject({ sicherung: null, reserviert: [backupId] });
    expect(f.alarme).toEqual([`backup|fehler|Sicherung ausgesetzt: Update u1 ist abgebrochen (Schritt 6); zuerst --fortsetzen oder --rueckweg`]);
    // abgeschlossenes Update reserviert nichts
    writeFileSync(k.zustandDatei, JSON.stringify({ format: 1, id: "u1", bestaetigt: 7, begonnen: null, status: "fertig", backupId }));
    const g = fake({});
    expect((await sicherungHost(g.docker, i, g.alarm, k)).reserviert).toEqual([]);
    expect(g.aufrufe).toEqual(["sichern", "aufbewahren"]);
  });
  it("PP11a-N-4: Update-Abbruch vor der Wartung (Schritt 0) blockiert die Sicherung nicht", async () => {
    const f = fake({}), k = koordination();
    writeFileSync(k.zustandDatei, JSON.stringify({ format: 1, id: "u0", bestaetigt: -1, begonnen: 0, status: "abgebrochen" }));
    const r = await sicherungHost(f.docker, i, f.alarm, k);
    expect(f.aufrufe).toEqual(["sichern", "aufbewahren"]);
    expect(r.sicherung).toEqual({ ok: "sichern" });
    expect(f.alarme).toEqual([]);
    expect(f.behoben).toContain("update-offen");
    // ab Schritt 1 (Wartung begonnen) blockiert es mit Alarm 'fehler'
    writeFileSync(k.zustandDatei, JSON.stringify({ format: 1, id: "u0", bestaetigt: 0, begonnen: 1, status: "abgebrochen" }));
    const g = fake({});
    await sicherungHost(g.docker, i, g.alarm, k);
    expect(g.aufrufe).toEqual(["aufbewahren"]);
    expect(g.alarme[0]).toMatch(/^backup\|fehler\|Sicherung ausgesetzt: Update u0/);
  });
  it("PP11a-N-1: Wartung (z.B. abgestuerzter Restore) verhindert die Sicherung; verwaiste Restore-Sperre wird nicht uebernommen", async () => {
    const f = fake({ inWartung: true }), k = koordination();
    const r = await sicherungHost(f.docker, i, f.alarm, k);
    expect(r.sicherung).toBeNull();
    expect(f.aufrufe).toEqual(["aufbewahren"]);
    expect(f.alarme[0]).toMatch(/^backup\|fehler\|Sicherung ausgesetzt: Instanz steht in Wartung/);
    // Sperre eines abgestuerzten Restores (toter PID): Sicherung uebernimmt sie nicht
    writeFileSync(k.sperrDatei, JSON.stringify({ pid: 2 ** 22 + 12345, host: hostname(), zweck: "Restore" }));
    const g = fake({});
    expect((await sicherungHost(g.docker, i, g.alarm, k)).ausgesetzt).toMatch(/Sperre durch Restore .* keine automatische Uebernahme/);
    expect(g.aufrufe).toEqual([]);
    // ebenso eine alte Update-Sperre ohne Zweck
    writeFileSync(k.sperrDatei, JSON.stringify({ pid: 2 ** 22 + 12345, host: hostname() }));
    expect((await sicherungHost(fake({}).docker, i, g.alarm, k)).ausgesetzt).toMatch(/Update-Lock vorhanden/);
    // geordnet abgebrochenes Update (update.json 'abgebrochen', PID tot): Sperre uebernehmen, Retention mit Reservierung
    const backupId = "11111111-2222-4333-8444-555555555555";
    writeFileSync(k.zustandDatei, JSON.stringify({ format: 1, id: "u2", bestaetigt: 5, begonnen: 6, status: "abgebrochen", backupId }));
    const h = fake({});
    expect((await sicherungHost(h.docker, i, h.alarm, k)).reserviert).toEqual([backupId]);
    expect(h.aufrufe).toEqual(["aufbewahren"]);
    // Absturz mitten im Update (Status 'aktiv'): nicht uebernehmen, Alarm 'fehler'
    writeFileSync(k.zustandDatei, JSON.stringify({ format: 1, id: "u3", bestaetigt: 5, begonnen: 6, status: "aktiv", backupId }));
    writeFileSync(k.sperrDatei, JSON.stringify({ pid: 2 ** 22 + 12345, host: hostname(), zweck: "update" }));
    const x = fake({});
    expect((await sicherungHost(x.docker, i, x.alarm, k)).ausgesetzt).toMatch(/Update-Lock vorhanden/);
    expect(x.alarme[0]).toMatch(/^backup\|fehler\|Sicherung\/Retention ausgesetzt/);
    rmSync(k.sperrDatei);
  });
  it("PP11a-N-2: SIGTERM gibt die Sicherungssperre frei; verwaiste Sicherungssperre blockiert Update/Restore nicht", async () => {
    const { EventEmitter } = await import("node:events");
    const k = koordination(), signale = new EventEmitter(), codes: number[] = [];
    let weiter!: () => void;
    const f = fake({});
    const docker: Ausfuehrer = async (args) => { if (args.includes("sichern")) await new Promise<void>((ok) => { weiter = ok; }); return f.docker(args); };
    const lauf = sicherungHost(docker, i, f.alarm, { ...k, signale: signale as unknown as NodeJS.Process, beenden: (c) => { codes.push(c); } });
    await new Promise((r) => setTimeout(r, 20));
    expect(existsSync(k.sperrDatei)).toBe(true);
    signale.emit("SIGTERM");
    expect(codes).toEqual([143]);
    expect(existsSync(k.sperrDatei)).toBe(false);
    weiter(); await lauf;
    expect(signale.listenerCount("SIGTERM")).toBe(0);
    // Ohne Handler (kill -9): Restore uebernimmt eine Sicherungssperre mit totem PID, eine lebende nicht
    writeFileSync(k.sperrDatei, JSON.stringify({ pid: 2 ** 22 + 12345, host: hostname(), zweck: "Sicherung" }));
    const frei = dateiSperre(k.sperrDatei, false, "Restore");
    expect(JSON.parse(readFileSync(k.sperrDatei, "utf8")).zweck).toBe("Restore");
    frei(true);
  });
  it("PP11a-N-3: dauerhaft offene Saetze blockieren die Journal-Kuerzung -> Warnung, danach behoben", async () => {
    const f = fake({ offen: true });
    await sicherungHost(f.docker, i, f.alarm, koordination());
    expect(f.alarme).toEqual(["retention|warnung|Journal-Kuerzung ausgesetzt: 1 laufende/ungepruefte Sicherungssaetze (Reconcile pruefen)"]);
    const g = fake({});
    await sicherungHost(g.docker, i, g.alarm, koordination());
    expect(g.behoben).toContain("journal-kuerzung");
  });
  it("PP11a-3: laufendes Update/Restore (lebende Sperre) setzt Sicherung und Retention aus", async () => {
    const f = fake({}), k = koordination();
    const frei = dateiSperre(k.sperrDatei, false); // dieser Prozess haelt die Update-Sperre
    try {
      const r = await sicherungHost(f.docker, i, f.alarm, k);
      expect(r.ausgesetzt).toMatch(/laeuft bereits/);
      expect(f.aufrufe).toEqual([]);
      expect(f.alarme[0]).toMatch(/^backup\|warnung\|Sicherung\/Retention ausgesetzt/);
    } finally { frei(true); }
    // Umgekehrt: waehrend einer Sicherung erhaelt ein Update eine klare Meldung.
    writeFileSync(k.sperrDatei, JSON.stringify({ pid: process.ppid, host: hostname(), zweck: "Sicherung" }));
    expect(() => dateiSperre(k.sperrDatei, false)).toThrow(/Sperre durch laufende Sicherung/);
    rmSync(k.sperrDatei);
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
  it("PP11a-8: Betriebsdienst ueberlebt Start-/Reconcile-Fehler, wiederholt alle 5 min und meldet die Stoerung einmal", async () => {
    const spool = join(dir, "dienst"), gesendet: Ereignis[] = [];
    let jetzt = Date.parse("2026-11-11T02:00:00Z");
    const a = alarmSpool({ instanz: "kunde-a", spool, konfiguration: WEBHOOK, secrets: { hmac: SCHLUESSEL }, jetzt: () => jetzt, protokoll: () => {}, sender: { webhook: async (_w, _k, e) => { gesendet.push(e); } } });
    const f = fake({ reconcile: true }), wartezeiten: number[] = [];
    let runden = 0, journalStarts = 0;
    await betriebsDienst({
      reconcile: () => reconcileMitAlarm(f.docker, i, a, "reconcile"), journalStarten: async () => { journalStarts++; }, alarm: a,
      warte: async (ms) => { wartezeiten.push(ms); jetzt += ms; if (++runden === 4) f.fehler.reconcile = false; },
      beendet: () => runden >= 30,
    });
    // 4 Fehlversuche, dann (nach Behebung) Erfolg; danach nur noch stuendlich
    expect(wartezeiten.every((w) => w === 300_000)).toBe(true);
    expect(gesendet.filter((e) => e.art === "reconcile" && e.schwere === "fehler")).toHaveLength(1);
    expect(journalStarts).toBe(1);
    expect(gesendet.filter((e) => e.text.startsWith("Behoben:"))).toHaveLength(1);
    expect(f.aufrufe.filter((x) => x === "reconcile").length).toBeLessThan(10);
    const journal = readFileSync(join(spool, "journal.jsonl"), "utf8");
    expect(journal).toContain('"art":"aggregiert"');
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
