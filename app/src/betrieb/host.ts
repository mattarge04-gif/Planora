import { composeArgs, letzteZeile, mussGelingen, type Ausfuehrer, type InstanzPfad } from "./update/docker.js";
import { kurz, mitAlarm, type Alarmierer } from "./alarm/alarm.js";
import { dateiSperre, leseZustand } from "./update/zustand.js";

/** One-offs und pausierte Container mitpruefen; ein unbekannter Engine-Status belegt keinen Stillstand. */
export async function backupLaeuft(docker: Ausfuehrer, projekt: string): Promise<boolean> {
  const r = await mussGelingen(docker, ["ps", "-aq", "--filter", `label=com.docker.compose.project=${projekt}`, "--filter", "label=com.docker.compose.service=backup"]);
  const ids = r.stdout.trim().split(/\s+/).filter(Boolean);
  if (!ids.length) return false;
  const status = await mussGelingen(docker, ["inspect", ...ids, "--format", "{{.State.Status}}"]);
  const z = status.stdout.trim().split(/\s+/);
  return z.length !== ids.length || z.some((s) => !["exited", "dead"].includes(s));
}

export async function reconcileHost(docker: Ausfuehrer, i: InstanzPfad) {
  const aktiv = await backupLaeuft(docker, i.projekt);
  return mussGelingen(docker, [...composeArgs(i), "run", "--pull", "never", "--rm", "-T", "--no-deps", "backup", "reconcile", "--container-laeuft", String(aktiv)]);
}

type Alarm = Alarmierer;

/** Reconcile mit Alarm: Fehler des Abgleichs und bereinigte abgebrochene Sicherungen werden gemeldet. */
export async function reconcileMitAlarm(docker: Ausfuehrer, i: InstanzPfad, alarm: Alarm, stoerung?: string) {
  const r = await mitAlarm(alarm, "reconcile", "Backup-Reconcile fehlgeschlagen", () => reconcileHost(docker, i), stoerung);
  const anzahl = Number((() => { try { return JSON.parse(letzteZeile(r.stdout)).fehlgeschlagen; } catch { return 0; } })());
  if (anzahl > 0) await alarm.alarmieren("backup", `${anzahl} abgebrochene Sicherung(en) vom Reconcile als fehlgeschlagen markiert`, "warnung");
  return anzahl;
}

export type SicherungsKoordination = {
  /** update.json und update.lock der Instanz (/var/lib/planora/<instanz>/). */
  zustandDatei: string; sperrDatei: string;
  anlass?: string; nurRetention?: boolean;
};

/**
 * Naechtlicher Lauf (systemd) und manuelle Befehle `planora sichern|aufbewahren` (PP11a-6). Koordination (PP11a-3):
 * - dieselbe Dateisperre wie Update und Restore; laeuft eines davon, wird der Lauf ausgesetzt (Warnung, aggregiert);
 * - ist ein Update offen (abgebrochen, Rueckweg ausstehend), wird keine neue Sicherung erstellt und dessen Satz
 *   fuer die Retention reserviert.
 * Sicherung vor Retention; Retention nur nach erfolgreicher Sicherung. Fehler alarmieren, Erfolg nicht.
 */
export async function sicherungHost(docker: Ausfuehrer, i: InstanzPfad, alarm: Alarm, o: SicherungsKoordination) {
  const anlass = o.anlass ?? "nacht";
  if (!/^[a-z0-9-]{1,40}$/.test(anlass)) throw new Error("--anlass: Kleinbuchstaben, Ziffern, Bindestrich");
  const backup = (...args: string[]) => mussGelingen(docker, [...composeArgs(i), "run", "--pull", "never", "--rm", "-T", "--no-deps", "backup", ...args], { timeoutMs: 6 * 3_600_000 });
  let frei: (erfolgreich: boolean) => void;
  try { frei = dateiSperre(o.sperrDatei, true, "Sicherung"); }
  catch (e) {
    await alarm.alarmieren("backup", `Sicherung/Retention ausgesetzt: ${kurz(e)}`, "warnung", "sicherung-gesperrt");
    return { ausgesetzt: kurz(e), sicherung: null, retention: null, reserviert: [] as string[] };
  }
  try {
    // Erst unter der Sperre lesen: ein Update legt update.json nur unter derselben Sperre an.
    const update = leseZustand(o.zustandDatei);
    const offen = !!update && !["fertig", "zurueck"].includes(update.status);
    const reserviert = offen && update!.backupId ? [update!.backupId] : [];
    let sicherung: { zustand?: string; backupId?: string } | null = null;
    if (!o.nurRetention) {
      if (offen) await alarm.alarmieren("backup", `Sicherung ausgesetzt: Update ${update!.id} ist ${update!.status}; zuerst --fortsetzen oder --rueckweg`, "warnung", "update-offen");
      else sicherung = JSON.parse(letzteZeile((await mitAlarm(alarm, "backup", "Sicherung fehlgeschlagen", () => backup("sichern", "--anlass", anlass), "sicherung")).stdout));
    }
    const r = await mitAlarm(alarm, "retention", "Retention fehlgeschlagen", () => backup("aufbewahren", ...reserviert.flatMap((id) => ["--reserviert", id])), "retention");
    return { ausgesetzt: null, sicherung, retention: JSON.parse(letzteZeile(r.stdout)), reserviert };
  } finally { frei(true); }
}

export type DienstOptionen = {
  /** Reconcile inkl. eigenem Alarm (Stoerungsschluessel), wirft bei Fehler. */
  reconcile: () => Promise<unknown>;
  /** Journal-Container starten (roh, ohne Alarm). */
  journalStarten: () => Promise<unknown>;
  alarm: Alarm & { zustellen(): Promise<unknown> };
  warte: (ms: number) => Promise<void>;
  beendet: () => boolean;
};

/**
 * Betriebsdienst (PP11a-8): ein Fehler beim Start oder im Reconcile beendet den Dienst nicht. Solange der Start nicht
 * gelungen ist, wird alle 5 Minuten wiederholt, danach stuendlich reconciliert. Gleiche Stoerungen werden aggregiert.
 */
export async function betriebsDienst(o: DienstOptionen) {
  let bereit = false;
  for (let runde = 0; !o.beendet(); runde++) {
    if (runde > 0) { await o.warte(300_000); if (o.beendet()) break; }
    await o.alarm.zustellen().catch(() => {});
    if (bereit && runde % 12 !== 0) continue;
    try {
      await o.reconcile();
      if (!bereit) await mitAlarm(o.alarm, "start", "Journal-Dienst konnte nicht gestartet werden", o.journalStarten, "journal-start");
      bereit = true;
    } catch { bereit = false; }
  }
}
