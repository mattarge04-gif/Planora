// Dauerhafter Update-Automat (§8, §14.4). Nur node:-Module: das Werkzeug laeuft auf dem Host.
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import type { Release } from "../release.js";
import { rueckwegMitAltemImage } from "../release.js";

export type Zustand = {
  format: 1; id: string; instanz: string; bundle: string; altesBundle: string;
  altEnv: Record<string, string>; release: Release;
  /** Letzter bestaetigter Schritt; -1 = noch keiner. `begonnen` wird VOR dem Seiteneffekt geschrieben. */
  bestaetigt: number; begonnen: number | null;
  status: "bereit" | "aktiv" | "abgebrochen" | "migration_abgebrochen" | "rueckweg" | "zurueck" | "fertig";
  backupId?: string; fehler?: string; geaendert: string;
};

/** Tempdatei im selben Verzeichnis, fsync vor rename, danach Verzeichnis-fsync (Linux). */
export function atomar(datei: string, wert: unknown) {
  mkdirSync(dirname(datei), { recursive: true, mode: 0o700 });
  const tmp = `${datei}.${randomUUID()}.tmp`;
  const fd = openSync(tmp, "wx", 0o600);
  try { writeFileSync(fd, JSON.stringify(wert, null, 2) + "\n"); fsyncSync(fd); }
  finally { closeSync(fd); }
  try {
    renameSync(tmp, datei);
    if (process.platform !== "win32") { const d = openSync(dirname(datei), "r"); try { fsyncSync(d); } finally { closeSync(d); } }
  } finally { if (existsSync(tmp)) unlinkSync(tmp); }
}

export function leseZustand(datei: string): Zustand | null {
  if (!existsSync(datei)) return null;
  const z = JSON.parse(readFileSync(datei, "utf8")) as Zustand;
  if (z.format !== 1 || !z.id || !Number.isInteger(z.bestaetigt) || z.bestaetigt < -1 || z.bestaetigt > 7) throw new Error("update.json ungueltig");
  return z;
}

const gehalten = new Set<string>();
/**
 * Dateisperre fuer Update, Restore, Sicherung und Zertifikatswechsel. Eine liegengebliebene Sperre wird nur bei
 * nachgewiesen totem lokalen PID uebernommen, und nur:
 * - mit uebernehmen=true (--fortsetzen/--rueckweg) jede Sperre,
 * - mit einer Liste nur Sperren dieser Zwecke (Sicherung uebernimmt nur Sicherungssperren, PP11a-N-1),
 * - immer eine verwaiste Sicherungssperre (Sicherung per SIGTERM beendet; blockiert sonst Update/Restore, PP11a-N-2).
 */
export function dateiSperre(datei: string, uebernehmen: boolean | readonly string[], zweck = "update") {
  if (gehalten.has(datei)) throw new Error(`${zweck === "update" ? "Update" : zweck} laeuft bereits (Dateisperre)`);
  mkdirSync(dirname(datei), { recursive: true, mode: 0o700 });
  if (existsSync(datei)) {
    const alt = JSON.parse(readFileSync(datei, "utf8")) as { pid: number; host: string; zweck?: string };
    const altZweck = alt.zweck ?? "update";
    const erlaubt = altZweck === "Sicherung" || uebernehmen === true || (Array.isArray(uebernehmen) && uebernehmen.includes(altZweck));
    if (!erlaubt) throw new Error(altZweck === "update" ? "Update-Lock vorhanden; --fortsetzen oder --rueckweg verwenden" : `Sperre durch ${altZweck} (PID ${alt.pid}) vorhanden; keine automatische Uebernahme`);
    if (alt.host !== hostname() || !Number.isInteger(alt.pid) || alt.pid <= 0) throw new Error("Lock-Eigentuemer unbekannt; keine automatische Uebernahme");
    let lebt = true;
    try { process.kill(alt.pid, 0); } catch (e) { if ((e as NodeJS.ErrnoException).code === "ESRCH") lebt = false; else throw e; }
    // Derselbe Prozess darf nach einem fehlgeschlagenen Update erneut starten (keine aktive lokale Sperre);
    // (in diesem Prozess aktive Sperren lehnt bereits "gehalten" ab).
    const eigener = alt.pid === process.pid;
    if (lebt && !eigener) throw new Error(altZweck === "Sicherung" ? `Sperre durch laufende Sicherung (PID ${alt.pid}); spaeter erneut versuchen` : `${altZweck === "update" ? "Update-Prozess" : `Prozess der ${altZweck}`} lebt noch`);
    unlinkSync(datei);
  }
  const fd = openSync(datei, "wx", 0o600);
  try { writeFileSync(fd, JSON.stringify({ pid: process.pid, host: hostname(), zweck })); fsyncSync(fd); } finally { closeSync(fd); }
  gehalten.add(datei);
  return (erfolgreich: boolean) => { gehalten.delete(datei); if (erfolgreich) unlinkSync(datei); };
}

export interface Betriebsumgebung {
  /** Haelt eine offene DB-Sitzung mit Exklusiv-Advisory-Lock; pruefen wirft bei Verbindungsverlust. */
  sperren(): Promise<{ pruefen(): Promise<void>; loesen(): Promise<void> }>;
  vorpruefen(z: Zustand): Promise<void>;
  wartung(aktiv: boolean, z: Zustand): Promise<void>;
  stoppen(z: Zustand): Promise<void>;
  backup(z: Zustand): Promise<string>;
  laden(z: Zustand): Promise<void>;
  migrieren(z: Zustand): Promise<void>;
  startenUndPruefen(z: Zustand): Promise<void>;
  freigeben(z: Zustand): Promise<void>;
  /** Altes Image nur laut Matrix; sonst Restore des geprueften Satzes aus Schritt 3. */
  zurueck(z: Zustand, modus: "image" | "restore"): Promise<void>;
  audit(art: string, z: Zustand): Promise<void>;
}

export type UpdateOptionen = { datei: string; sperre: string; neu?: Omit<Zustand, "format" | "id" | "bestaetigt" | "begonnen" | "status" | "geaendert">; modus?: "fortsetzen" | "rueckweg" };

export async function aktualisiere(o: UpdateOptionen, u: Betriebsumgebung): Promise<Zustand> {
  const frei = dateiSperre(o.sperre, !!o.modus);
  let fertig = false, lock: Awaited<ReturnType<Betriebsumgebung["sperren"]>> | undefined;
  let z: Zustand | null = null;
  const speichern = () => { z!.geaendert = new Date().toISOString(); atomar(o.datei, z); };
  try {
    z = leseZustand(o.datei);
    if (o.modus) {
      if (!z) { fertig = true; throw new Error("Kein Update zum Fortsetzen vorhanden"); }
      if (["fertig", "zurueck"].includes(z.status)) { fertig = true; throw new Error("Update bereits abgeschlossen; neuer Vorgang noetig"); }
    } else {
      if (z && !["fertig", "zurueck"].includes(z.status)) throw new Error("Unabgeschlossenes Update; --fortsetzen oder --rueckweg verwenden");
      if (!o.neu) { fertig = true; throw new Error("Neues Release fehlt"); }
      z = { ...o.neu, format: 1, id: randomUUID(), bestaetigt: -1, begonnen: null, status: "bereit", geaendert: new Date().toISOString() };
      speichern();
    }
    lock = await u.sperren();
    await lock.pruefen();
    if (o.modus === "rueckweg") {
      // Schon der Beginn von Schritt 7 kann Schreibzugriffe zugelassen haben: kein verlustfreier Rueckweg mehr.
      if (z.bestaetigt >= 7 || z.begonnen === 7) throw new Error("Freigabe begonnen; Rueckweg braucht neuen Vorgang mit Datenverlustfenster");
      z.status = "rueckweg"; speichern();
      if (z.bestaetigt >= 0 || z.begonnen !== null) {
        await u.wartung(true, z);
        await u.stoppen(z);
        const migrationBegonnen = z.bestaetigt >= 5 || z.begonnen === 5 || z.begonnen === 6;
        const modus = !migrationBegonnen || rueckwegMitAltemImage(z.release, z.altEnv.PLANORA_RELEASE) ? "image" : "restore";
        if (modus === "restore" && !z.backupId) throw new Error("Rueckweg ohne geprueften Sicherungssatz verweigert");
        await u.zurueck(z, modus);
        await lock.pruefen();
        await u.wartung(false, z);
      }
      await u.audit("update.rueckweg", z);
      z.status = "zurueck"; z.begonnen = null; delete z.fehler; speichern(); fertig = true; return z;
    }
    if (z.status === "rueckweg") throw new Error("Unterbrochenen Rueckweg mit --rueckweg wiederholen");
    const schritte: (() => Promise<void>)[] = [
      () => u.vorpruefen(z!), () => u.wartung(true, z!), () => u.stoppen(z!),
      async () => { z!.backupId = await u.backup(z!); }, () => u.laden(z!), () => u.migrieren(z!),
      () => u.startenUndPruefen(z!), () => u.freigeben(z!),
    ];
    for (let n = z.bestaetigt + 1; n <= 7; n++) {
      await lock.pruefen();
      z.begonnen = n; z.status = "aktiv"; delete z.fehler; speichern();
      await schritte[n]();
      await lock.pruefen();
      await u.audit(`update.schritt.${n}`, z);
      z.bestaetigt = n; z.begonnen = null; speichern();
    }
    z.status = "fertig"; speichern(); fertig = true; return z;
  } catch (e) {
    if (z && z.status !== "fertig" && z.status !== "zurueck") {
      z.status = z.status === "rueckweg" ? "rueckweg" : z.begonnen === 5 ? "migration_abgebrochen" : "abgebrochen";
      z.fehler = (e as Error).message; speichern();
    }
    throw e;
  } finally {
    try { await lock?.loesen(); } finally { frei(fertig); }
  }
}
