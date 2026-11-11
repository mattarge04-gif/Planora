import { composeArgs, letzteZeile, mussGelingen, type Ausfuehrer, type InstanzPfad } from "./update/docker.js";
import { mitAlarm, type Alarmierer } from "./alarm/alarm.js";

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
export async function reconcileMitAlarm(docker: Ausfuehrer, i: InstanzPfad, alarm: Alarm) {
  const r = await mitAlarm(alarm, "reconcile", "Backup-Reconcile fehlgeschlagen", () => reconcileHost(docker, i));
  const anzahl = Number((() => { try { return JSON.parse(letzteZeile(r.stdout)).fehlgeschlagen; } catch { return 0; } })());
  if (anzahl > 0) await alarm.alarmieren("backup", `${anzahl} abgebrochene Sicherung(en) vom Reconcile als fehlgeschlagen markiert`, "warnung");
  return anzahl;
}

/** Naechtlicher Lauf (systemd): Sicherung, danach Retention nur bei Erfolg. Jeder Fehler alarmiert; Erfolg nicht. */
export async function sicherungHost(docker: Ausfuehrer, i: InstanzPfad, anlass: string, alarm: Alarm) {
  if (!/^[a-z0-9-]{1,40}$/.test(anlass)) throw new Error("--anlass: Kleinbuchstaben, Ziffern, Bindestrich");
  const backup = (...args: string[]) => mussGelingen(docker, [...composeArgs(i), "run", "--pull", "never", "--rm", "-T", "--no-deps", "backup", ...args], { timeoutMs: 6 * 3_600_000 });
  const s = await mitAlarm(alarm, "backup", "Sicherung fehlgeschlagen", () => backup("sichern", "--anlass", anlass));
  const r = await mitAlarm(alarm, "retention", "Retention nach erfolgreicher Sicherung fehlgeschlagen", () => backup("aufbewahren"));
  return { sicherung: JSON.parse(letzteZeile(s.stdout)), retention: JSON.parse(letzteZeile(r.stdout)) };
}
