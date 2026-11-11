import { leseArgumente } from "./install/argumente.js";
import { instanzPfade, leseEnv } from "./install/plan.js";
import { composeDateien } from "./install/install.js";
import { composeArgs, dockerAusfuehrer, mussGelingen } from "./update/docker.js";
import { betriebsDienst, reconcileMitAlarm, sicherungHost } from "./host.js";
import { restoreHost } from "./restore/host.js";
import { sql } from "./update/docker.js";
import { dateiSperre, leseZustand } from "./update/zustand.js";
import { dbSperre } from "./update/sperre.js";
import { ausgeliefertesZertifikat, rotiereKundenzertifikat } from "./install/zertifikat.js";
import { instanzAlarm, kurz, mitAlarm } from "./alarm/alarm.js";

const BEFEHLE = ["start", "reconcile", "dienst", "restore", "zertifikat", "sichern", "aufbewahren", "alarm"];

async function haupt() {
  const { werte, positionen } = leseArgumente(process.argv.slice(2), ["instanz", "tls-zertifikat", "tls-schluessel", "anlass"], ["test", "wiederholen"]);
  if (!/^[a-z][a-z0-9-]{1,31}$/.test(werte.instanz ?? "") || !BEFEHLE.includes(positionen[0]) || positionen.length !== (positionen[0] === "restore" ? 2 : 1)) throw new Error("Aufruf: start|reconcile|dienst|sichern|aufbewahren|restore [backup-id]|zertifikat|alarm --instanz <name>");
  const p = instanzPfade(werte.instanz), w = leseEnv(p.envDatei), docker = dockerAusfuehrer();
  const i = { projekt: `planora-${werte.instanz}`, envDatei: p.envDatei, composeDateien: composeDateien(w.PLANORA_BUNDLE_DIR) };
  // Alarmkanal (M1-Abnahme Punkt 4). Eine ungueltige alarm.json haelt die Zustellung an, verhindert aber keinen Befehl.
  const alarm = instanzAlarm(werte.instanz, p.etc, p.var);
  // Offene Alarme bei jedem Host-Befehl erneut versuchen (Wartezeit beachten).
  await alarm.zustellen().catch(() => {});

  if (positionen[0] === "alarm") {
    if (!!werte.test === !!werte.wiederholen) throw new Error("Aufruf: alarm --instanz <name> --test|--wiederholen");
    if (werte.test) await alarm.alarmieren("test", "Testalarm des Betreibers (planora alarm --test)", "warnung");
    console.log(JSON.stringify(werte.test ? await alarm.zustellen() : await alarm.zustellen(true)));
    return;
  }
  if (positionen[0] === "sichern" || positionen[0] === "aufbewahren") {
    // Auch manuelle Aufrufe laufen ueber Sperre, Update-Koordination und Alarm (PP11a-3, PP11a-6).
    const r = await sicherungHost(docker, i, alarm, { zustandDatei: p.zustand, sperrDatei: p.sperre, anlass: werte.anlass, nurRetention: positionen[0] === "aufbewahren" });
    console.log(JSON.stringify(r));
    if (r.ausgesetzt) process.exitCode = 75; // EX_TEMPFAIL: spaeter erneut
    return;
  }
  if (positionen[0] === "zertifikat") {
    // Rotation des Kunden-Zertifikats: pruefen, ersetzen, Proxy neu starten, ausgeliefertes Zertifikat vergleichen.
    if (!werte["tls-zertifikat"] || !werte["tls-schluessel"] || !w.PLANORA_TLS_VERZEICHNIS) throw new Error("Aufruf: zertifikat --instanz <name> --tls-zertifikat <kette.pem> --tls-schluessel <key.pem> (nur bei --tls kundenzertifikat)");
    const r = await mitAlarm(alarm, "zertifikat", "Zertifikatsrotation fehlgeschlagen", () => rotiereKundenzertifikat({ verzeichnis: w.PLANORA_TLS_VERZEICHNIS, domain: w.PLANORA_DOMAIN, zertifikatDatei: werte["tls-zertifikat"], schluesselDatei: werte["tls-schluessel"],
      neustart: async () => { await mussGelingen(docker, [...composeArgs(i), "restart", "proxy"]); },
      pruefe: async (fp) => (await ausgeliefertesZertifikat(Number(w.PLANORA_HTTPS_PORT ?? 443), w.PLANORA_DOMAIN)) === fp }));
    console.log(JSON.stringify(r));
    return;
  }
  if (positionen[0] === "restore") {
    const update = leseZustand(p.zustand);
    if (update && !["fertig", "zurueck"].includes(update.status)) throw new Error("Unabgeschlossenes Update: dessen --rueckweg verwenden");
    await mitAlarm(alarm, "restore", "Restore fehlgeschlagen; Instanz bleibt in Wartung", async () => {
      const frei = dateiSperre(p.sperre, false);
      let lock: Awaited<ReturnType<typeof dbSperre>> | undefined;
      try {
        lock = await dbSperre(i);
        await sql(docker, i, "planora_betrieb", "select setze_wartung(true)");
        await mussGelingen(docker, [...composeArgs(i), "stop", "api", "worker", "journal"]);
        console.log(JSON.stringify(await restoreHost(docker, i, werte.instanz, positionen[1], w.PLANORA_BUNDLE_DIR, w.PLANORA_RELEASE, w.PLANORA_RECOVERY_BUNDLE_DIR ?? w.PLANORA_BUNDLE_DIR)));
        await lock.pruefen();
        await mussGelingen(docker, [...composeArgs(i), "up", "-d", "--no-deps", "--pull", "never", "--wait", "api", "worker", "journal"]);
        await lock.pruefen();
        await sql(docker, i, "planora_betrieb", "select setze_wartung(false)");
      } finally { try { await lock?.loesen(); } finally { frei(true); } }
    });
    return;
  }
  const journalStarten = () => mussGelingen(docker, [...composeArgs(i), "up", "-d", "--no-deps", "--pull", "never", "journal"]);
  if (positionen[0] === "dienst") {
    // PP11a-8: Start- und Reconcile-Fehler beenden den Dienst nicht (kein systemd-Neustart im Minutentakt).
    const ende = new AbortController();
    for (const s of ["SIGINT", "SIGTERM"] as const) process.once(s, () => ende.abort());
    const { setTimeout } = await import("node:timers/promises");
    await betriebsDienst({ reconcile: () => reconcileMitAlarm(docker, i, alarm, "reconcile"), journalStarten, alarm,
      warte: (ms) => setTimeout(ms, undefined, { signal: ende.signal }).catch(() => {}), beendet: () => ende.signal.aborted });
    return;
  }
  if (positionen[0] === "start") await mitAlarm(alarm, "start", "Start der Instanz fehlgeschlagen", () => mussGelingen(docker, [...composeArgs(i), "up", "-d", "--pull", "never", "--wait"]));
  await reconcileMitAlarm(docker, i, alarm, "reconcile");
  await journalStarten();
}
haupt().catch((e) => { console.error(`Betriebsbefehl fehlgeschlagen: ${kurz(e)}`); process.exitCode = 1; });
