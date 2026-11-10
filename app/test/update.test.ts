import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { aktualisiere, atomar, dateiSperre, leseZustand, type Betriebsumgebung, type Zustand } from "../src/betrieb/update/zustand.js";
import { erzeugeRelease } from "../src/betrieb/release.js";

const release = () => erzeugeRelease({
  version: "2", architektur: "amd64", migrationsVerzeichnis: fileURLToPath(new URL("../src/db/migrationen", import.meta.url)), modulmanifestVersion: "m1",
  images: [{ dienst: "app", referenz: `planora-app:2@sha256:${"a".repeat(64)}`, digest: null, imageId: `sha256:${"a".repeat(64)}`, architektur: "amd64" }],
  vonVersionen: ["1"], schemaVorher: ["007_ablage.sql"], rueckwegAltesImage: ["1"],
});
let dir: string;
const optionen = () => ({ datei: join(dir, "update.json"), sperre: join(dir, "update.lock"), neu: { instanz: "a-test", bundle: "/neu", altesBundle: "/alt", altEnv: { PLANORA_RELEASE: "1" }, release: release() } });

function fake(fehlerSchritt = -1) {
  const aufrufe: string[] = [], lage = { wartung: false, app: true, worker: true, schema: "alt", image: "alt", dbLock: false, backup: false, verloren: false };
  const punkt = async (n: number) => {
    aufrufe.push(String(n));
    if (n === fehlerSchritt) throw new Error(`Abbruch ${n}`);
  };
  const u: Betriebsumgebung = {
    async sperren() { if (lage.dbLock) throw new Error("DB gesperrt"); lage.dbLock = true; return { async pruefen() { if (lage.verloren) throw new Error("DB-Lock verloren"); }, async loesen() { lage.dbLock = false; } }; },
    async vorpruefen() { await punkt(0); },
    async wartung(aktiv) { if (aktiv) await punkt(1); lage.wartung = aktiv; },
    async stoppen() { await punkt(2); lage.app = false; lage.worker = false; },
    async backup() { await punkt(3); lage.backup = true; return "11111111-1111-4111-8111-111111111111"; },
    async laden() { await punkt(4); },
    async migrieren() { lage.schema = "neu"; await punkt(5); }, // Teilmigration kann vor Fehler bereits committet sein.
    async startenUndPruefen() { lage.app = true; lage.image = "neu"; await punkt(6); lage.worker = true; },
    async freigeben() { await punkt(7); lage.wartung = false; },
    async zurueck(_z, modus) { aufrufe.push(modus); lage.image = "alt"; lage.app = true; lage.worker = true; if (modus === "restore") lage.schema = "alt"; },
    async audit() {},
  };
  return { u, lage, aufrufe };
}

beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "planora-update-")); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe("Update-Zustandsmaschine (§8 / §14.4)", () => {
  // Dokumentierte Endzustaende: Fehler vor Effekt n; Migration kann schon einzelne Dateien committet haben.
  const abbrueche = [
    { n: 0, wartung: false, app: true, worker: true, schema: "alt", status: "abgebrochen" },
    { n: 1, wartung: false, app: true, worker: true, schema: "alt", status: "abgebrochen" },
    { n: 2, wartung: true, app: true, worker: true, schema: "alt", status: "abgebrochen" },
    { n: 3, wartung: true, app: false, worker: false, schema: "alt", status: "abgebrochen" },
    { n: 4, wartung: true, app: false, worker: false, schema: "alt", status: "abgebrochen" },
    { n: 5, wartung: true, app: false, worker: false, schema: "neu", status: "migration_abgebrochen" },
    { n: 6, wartung: true, app: true, worker: false, schema: "neu", status: "abgebrochen" },
  ];
  it.each(abbrueche)("Abbruch $n: dauerhafter Status $status, wartung=$wartung, app=$app, worker=$worker, schema=$schema", async ({ n, status, ...end }) => {
    const f = fake(n), o = optionen();
    await expect(aktualisiere(o, f.u)).rejects.toThrow(`Abbruch ${n}`);
    expect(f.lage).toMatchObject({ ...end, dbLock: false });
    expect(leseZustand(o.datei)).toMatchObject({ bestaetigt: n - 1, begonnen: n, status });
    expect(existsSync(o.sperre)).toBe(true); // Sperre bleibt bis Abschluss oder explizitem Rueckweg.
    expect(readdirSync(dir).some((n) => n.endsWith(".tmp"))).toBe(false);
  });
  it.each([0, 1, 2, 3, 4, 5, 6])("Wiederaufnahme nach Schritt %i wiederholt nur den unbestaetigten Schritt", async (n) => {
    const o = optionen(), f = fake(n);
    await expect(aktualisiere(o, f.u)).rejects.toThrow();
    const weiter = fake();
    const z = await aktualisiere({ ...o, neu: undefined, modus: "fortsetzen" }, weiter.u);
    expect(weiter.aufrufe).toEqual(Array.from({ length: 8 - n }, (_, j) => String(n + j)));
    expect(z).toMatchObject({ bestaetigt: 7, status: "fertig", begonnen: null });
    expect(existsSync(o.sperre)).toBe(false);
  });
  it("Wartung bleibt bis eigenem Schritt 7 gesetzt; Backup-ID wird vor Laden dauerhaft gespeichert", async () => {
    const o = optionen(), f = fake();
    f.u.laden = async () => { expect(leseZustand(o.datei)?.backupId).toBe("11111111-1111-4111-8111-111111111111"); };
    const freigabe = f.u.freigeben;
    f.u.freigeben = async (z) => { expect(f.lage.wartung).toBe(true); expect(f.lage.worker).toBe(true); expect(leseZustand(o.datei)?.begonnen).toBe(7); await freigabe(z); };
    await aktualisiere(o, f.u);
    expect(f.lage.wartung).toBe(false);
  });
  it("Rueckweg nach Teilmigration stoppt erneut und nutzt nur bei kompatibler Matrix das alte Image", async () => {
    const o = optionen(), f = fake(5);
    await expect(aktualisiere(o, f.u)).rejects.toThrow();
    const r = fake();
    expect((await aktualisiere({ ...o, neu: undefined, modus: "rueckweg" }, r.u)).status).toBe("zurueck");
    expect(r.aufrufe).toEqual(["1", "2", "image"]);
    expect(r.lage.wartung).toBe(false);
    expect(existsSync(o.sperre)).toBe(false);
  });
  it("inkompatibles neues Schema erzwingt Restore des Satzes aus Schritt 3", async () => {
    const o = optionen(); o.neu.release.matrix.rueckwegAltesImage = [];
    await expect(aktualisiere(o, fake(6).u)).rejects.toThrow();
    const r = fake(); let backup: string | undefined;
    r.u.zurueck = async (z, modus) => { expect(modus).toBe("restore"); backup = z.backupId; };
    await aktualisiere({ ...o, neu: undefined, modus: "rueckweg" }, r.u);
    expect(backup).toBe("11111111-1111-4111-8111-111111111111");
  });
  it("Rueckweg nach Freigabebeginn verweigert (moegliches Datenverlustfenster)", async () => {
    const o = optionen(), f = fake(7);
    await expect(aktualisiere(o, f.u)).rejects.toThrow();
    const r = fake();
    await expect(aktualisiere({ ...o, neu: undefined, modus: "rueckweg" }, r.u)).rejects.toThrow(/Datenverlustfenster/);
    expect(r.aufrufe).toEqual([]);
    expect(existsSync(o.sperre)).toBe(true);
  });
  it("Crash nach Effekt und vor Bestaetigung wird idempotent wiederholt", async () => {
    const o = optionen(), f = fake(4);
    await expect(aktualisiere(o, f.u)).rejects.toThrow();
    const z = leseZustand(o.datei)!; z.bestaetigt = 5; z.begonnen = 6; atomar(o.datei, z);
    const r = fake(); await aktualisiere({ ...o, neu: undefined, modus: "fortsetzen" }, r.u);
    expect(r.aufrufe).toEqual(["6", "7"]);
  });
  it("DB-Lock-Verlust nach Start verhindert Freigabe", async () => {
    const o = optionen(), f = fake();
    f.u.startenUndPruefen = async () => { f.lage.verloren = true; };
    await expect(aktualisiere(o, f.u)).rejects.toThrow(/DB-Lock verloren/);
    expect(leseZustand(o.datei)).toMatchObject({ bestaetigt: 5, begonnen: 6 });
    expect(f.lage.wartung).toBe(true);
  });
  it("konkurrierender Prozess/zweiter Aufruf darf bestehende Sperre nicht loeschen", async () => {
    const o = optionen(), frei = dateiSperre(o.sperre, false);
    const vor = readFileSync(o.sperre, "utf8");
    await expect(aktualisiere(o, fake().u)).rejects.toThrow(/bereits/);
    expect(readFileSync(o.sperre, "utf8")).toBe(vor);
    frei(true);
  });
  it("neuer Vorgang darf ein unabgeschlossenes Update nicht ueberschreiben", async () => {
    const o = optionen(); await expect(aktualisiere(o, fake(4).u)).rejects.toThrow();
    const vor = readFileSync(o.datei, "utf8");
    await expect(aktualisiere(o, fake().u)).rejects.toThrow(/Lock vorhanden/);
    expect(readFileSync(o.datei, "utf8")).toBe(vor);
  });
});
