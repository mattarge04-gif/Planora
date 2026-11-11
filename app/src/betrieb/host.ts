import { composeArgs, letzteZeile, mussGelingen, sql, type Ausfuehrer, type InstanzPfad } from "./update/docker.js";
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
  /** Fuer Tests austauschbar: Signalquelle und Prozessende (Standard: process). */
  signale?: Pick<NodeJS.Process, "once" | "removeListener">; beenden?: (code: number) => void;
};

/**
 * Naechtlicher Lauf (systemd) und manuelle Befehle `planora sichern|aufbewahren` (PP11a-6). Koordination (PP11a-3):
 * - dieselbe Dateisperre wie Update und Restore; laeuft eines davon, wird der Lauf ausgesetzt (Warnung, aggregiert).
 *   Uebernommen wird nur eine verwaiste Sicherungssperre, nie die eines abgestuerzten Restores/Updates (PP11a-N-1).
 *   SIGTERM/SIGINT geben die Sperre frei (PP11a-N-2).
 * - Ist ein Update offen, das bereits Wartung/Stopp begonnen hat, entsteht keine neue Sicherung (Alarm 'fehler'),
 *   und dessen Satz wird fuer die Retention reserviert. Ein Abbruch vor der Wartung blockiert nicht (PP11a-N-4).
 * - Steht die Instanz in Wartung (z.B. abgestuerzter Restore), wird nicht gesichert (Alarm 'fehler', PP11a-N-1).
 * Sicherung vor Retention; Retention nur nach erfolgreicher Sicherung. Fehler alarmieren, Erfolg nicht.
 */
export async function sicherungHost(docker: Ausfuehrer, i: InstanzPfad, alarm: Alarm, o: SicherungsKoordination) {
  const anlass = o.anlass ?? "nacht";
  if (!/^[a-z0-9-]{1,40}$/.test(anlass)) throw new Error("--anlass: Kleinbuchstaben, Ziffern, Bindestrich");
  const backup = (...args: string[]) => mussGelingen(docker, [...composeArgs(i), "run", "--pull", "never", "--rm", "-T", "--no-deps", "backup", ...args], { timeoutMs: 6 * 3_600_000 });
  let frei: (erfolgreich: boolean) => void;
  // Uebernommen werden nur verwaiste Sicherungssperren und die Sperre eines GEORDNET abgebrochenen Updates
  // (Status in update.json geschrieben, Prozess beendet). Ein Absturz mitten in Update/Restore bleibt gesperrt.
  const vorher = (() => { try { return leseZustand(o.zustandDatei); } catch { return null; } })();
  const geordnet = !!vorher && ["abgebrochen", "migration_abgebrochen"].includes(vorher.status);
  try { const f = dateiSperre(o.sperrDatei, geordnet ? ["Sicherung", "update"] : ["Sicherung"], "Sicherung"); let offen = true; frei = (x) => { if (offen) { offen = false; f(x); } }; }
  catch (e) {
    // Laufender Vorgang: Warnung. Verwaiste fremde Sperre (Absturz in Update/Restore): Fehler, Betreiber muss handeln.
    const laeuft = /lebt noch|laeuft bereits|laufende Sicherung/.test(kurz(e));
    await alarm.alarmieren("backup", `Sicherung/Retention ausgesetzt: ${kurz(e)}`, laeuft ? "warnung" : "fehler", "sicherung-gesperrt");
    return { ausgesetzt: kurz(e), sicherung: null, retention: null, reserviert: [] as string[] };
  }
  const signale = o.signale ?? process, beenden = o.beenden ?? ((c: number) => process.exit(c));
  const abbruch = (signal: string) => () => { frei(true); beenden(signal === "SIGINT" ? 130 : 143); };
  const handler = { SIGTERM: abbruch("SIGTERM"), SIGINT: abbruch("SIGINT") };
  for (const [n, h] of Object.entries(handler)) signale.once(n as "SIGTERM", h);
  try {
    await alarm.behoben?.("sicherung-gesperrt", "Sicherungssperre wieder verfuegbar");
    // Erst unter der Sperre lesen: ein Update legt update.json nur unter derselben Sperre an.
    const update = leseZustand(o.zustandDatei);
    const offen = !!update && !["fertig", "zurueck"].includes(update.status);
    // Schritt 1 = Wartung: davor ist die Instanz unveraendert in Betrieb.
    const vorWartung = offen && update!.bestaetigt < 1 && (update!.begonnen === null || update!.begonnen <= 0);
    const blockiert = offen && !vorWartung;
    const reserviert = offen && update!.backupId ? [update!.backupId] : [];
    let sicherung: { zustand?: string; backupId?: string } | null = null;
    if (!o.nurRetention) {
      if (blockiert) await alarm.alarmieren("backup", `Sicherung ausgesetzt: Update ${update!.id} ist ${update!.status} (Schritt ${update!.begonnen ?? update!.bestaetigt}); zuerst --fortsetzen oder --rueckweg`, "fehler", "update-offen");
      else {
        await alarm.behoben?.("update-offen", "Kein blockierendes Update mehr");
        sicherung = await mitAlarm(alarm, "backup", "Sicherung fehlgeschlagen", async () => {
          if ((await sql(docker, i, "planora_betrieb", "select wert from instanz_einstellung where schluessel='wartung'")).trim() === "true") return null;
          return JSON.parse(letzteZeile((await backup("sichern", "--anlass", anlass)).stdout));
        }, "sicherung");
        if (!sicherung) await alarm.alarmieren("backup", "Sicherung ausgesetzt: Instanz steht in Wartung (abgebrochener Restore oder Update?); Ursache pruefen", "fehler", "wartung");
        else await alarm.behoben?.("wartung", "Instanz nicht mehr in Wartung");
      }
    }
    const r = await mitAlarm(alarm, "retention", "Retention fehlgeschlagen", () => backup("aufbewahren", ...reserviert.flatMap((id) => ["--reserviert", id])), "retention");
    const retention = JSON.parse(letzteZeile(r.stdout));
    // PP11a-N-3: dauerhaft offene Saetze verhindern die Journal-Kuerzung; das muss auffallen.
    if (retention.offeneSaetze > 0) await alarm.alarmieren("retention", `Journal-Kuerzung ausgesetzt: ${retention.offeneSaetze} laufende/ungepruefte Sicherungssaetze (Reconcile pruefen)`, "warnung", "journal-kuerzung");
    else await alarm.behoben?.("journal-kuerzung", "Journal-Kuerzung wieder moeglich");
    return { ausgesetzt: null, sicherung, retention, reserviert };
  } finally {
    for (const [n, h] of Object.entries(handler)) signale.removeListener(n as "SIGTERM", h);
    frei(true);
  }
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
