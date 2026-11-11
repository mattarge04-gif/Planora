// PO-Entscheid 2026-11-11: SMTP-Alarme an Planora-Kundenadresse + Konto-Adressen aus der App-DB, mit Cache bei DB-Ausfall.
// (Die SQL-Seite "deaktiviertes Konto faellt heraus" prueft test/backup-migration.test.ts gegen echtes Postgres.)
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { alarmSpool, ermittleEmpfaenger, pruefeAlarmKonfiguration, type AlarmSmtp } from "../src/betrieb/alarm/alarm.js";

let dir: string;
beforeAll(() => { dir = mkdtempSync(join(tmpdir(), "planora-empfaenger-")); });
afterAll(() => rmSync(dir, { recursive: true, force: true }));
const SMTP: AlarmSmtp = { host: "mail.planora.test", port: 587, starttls: true, absender: "alarm@planora.test", planoraAdresse: "kunde-a@planora.test", benutzer: "alarm" };

describe("Empfaengerermittlung", () => {
  it("Standard: Planora-Kundenadresse + aktive Admins aus der DB; Cache wird geschrieben", async () => {
    const cache = join(dir, "e1.json"), abfragen: boolean[] = [];
    const r = await ermittleEmpfaenger(SMTP, cache, async (alle) => { abfragen.push(alle); return ["Admin@Kunde.test", "kein-mail", "admin@kunde.test"]; });
    expect(abfragen).toEqual([false]);
    expect(r).toEqual({ adressen: ["kunde-a@planora.test", "admin@kunde.test"], quelle: "db" });
    expect(JSON.parse(readFileSync(cache, "utf8"))).toMatchObject({ modus: "admins", adressen: ["admin@kunde.test"] });
  });
  it("kontoEmpfaenger 'alle' fragt alle aktiven Konten ab; 'keine' nur feste Adressen", async () => {
    const abfragen: boolean[] = [];
    await ermittleEmpfaenger({ ...SMTP, kontoEmpfaenger: "alle" }, join(dir, "e2.json"), async (alle) => { abfragen.push(alle); return []; });
    expect(abfragen).toEqual([true]);
    const r = await ermittleEmpfaenger({ ...SMTP, kontoEmpfaenger: "keine", empfaenger: ["pikett@planora.test"] }, join(dir, "e3.json"), async () => { throw new Error("darf nicht gefragt werden"); });
    expect(r).toEqual({ adressen: ["kunde-a@planora.test", "pikett@planora.test"], quelle: "keine" });
  });
  it("DB nicht erreichbar: zuletzt bekannte Liste aus dem Cache plus Planora-Adresse; ohne Cache nur Planora-Adresse", async () => {
    const cache = join(dir, "e4.json");
    await ermittleEmpfaenger(SMTP, cache, async () => ["admin@kunde.test", "zweit@kunde.test"]);
    const r = await ermittleEmpfaenger(SMTP, cache, async () => { throw new Error("docker compose exec db → Exit 1: DB weg"); });
    expect(r).toMatchObject({ adressen: ["kunde-a@planora.test", "admin@kunde.test", "zweit@kunde.test"], quelle: "cache" });
    expect(r.fehler).toMatch(/DB weg/);
    // Cache eines anderen Modus wird nicht verwendet (sonst gingen Betriebsalarme an normale Nutzer)
    expect((await ermittleEmpfaenger({ ...SMTP, kontoEmpfaenger: "alle" }, cache, async () => { throw new Error("weg"); })).adressen).toEqual(["kunde-a@planora.test"]);
    expect((await ermittleEmpfaenger(SMTP, join(dir, "fehlt.json"), async () => { throw new Error("weg"); })).adressen).toEqual(["kunde-a@planora.test"]);
  });
  it("Konfiguration verlangt planoraAdresse und prueft kontoEmpfaenger", () => {
    expect(() => pruefeAlarmKonfiguration({ smtp: SMTP })).not.toThrow();
    const { planoraAdresse: _weg, ...ohne } = SMTP;
    expect(() => pruefeAlarmKonfiguration({ smtp: ohne })).toThrow(/planoraAdresse/);
    expect(() => pruefeAlarmKonfiguration({ smtp: { ...SMTP, kontoEmpfaenger: "jeder" } })).toThrow(/kontoEmpfaenger/);
  });
  it("Spool: SMTP-Alarm bei DB-Ausfall geht an Cache + Planora-Adresse, Ersatz wird journalisiert", async () => {
    const spool = join(dir, "spool"), versand: string[][] = [];
    let dbDa = true;
    const a = alarmSpool({ instanz: "kunde-a", spool, konfiguration: { smtp: SMTP }, secrets: { smtpPasswort: "geheim" }, protokoll: () => {},
      kontoAdressen: async () => { if (!dbDa) throw new Error("DB weg"); return ["admin@kunde.test"]; },
      sender: { smtp: async (k) => { versand.push(k.empfaenger); } } });
    await a.alarmieren("test", "DB erreichbar", "warnung");
    dbDa = false;
    await a.alarmieren("backup", "Sicherung fehlgeschlagen: DB weg");
    expect(versand).toEqual([["kunde-a@planora.test", "admin@kunde.test"], ["kunde-a@planora.test", "admin@kunde.test"]]);
    expect(readFileSync(join(spool, "journal.jsonl"), "utf8")).toContain('"art":"empfaenger_ersatz","quelle":"cache"');
    expect(existsSync(join(spool, "empfaenger.json"))).toBe(true);
  });
});
