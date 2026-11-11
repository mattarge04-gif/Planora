import { leseArgumente } from "./install/argumente.js";
import { instanzPfade, leseEnv } from "./install/plan.js";
import { composeDateien } from "./install/install.js";
import { composeArgs, dockerAusfuehrer, mussGelingen } from "./update/docker.js";
import { reconcileHost } from "./host.js";
import { restoreHost } from "./restore/host.js";
import { sql } from "./update/docker.js";
import { dateiSperre, leseZustand } from "./update/zustand.js";
import { dbSperre } from "./update/sperre.js";
import { ausgeliefertesZertifikat, rotiereKundenzertifikat } from "./install/zertifikat.js";

async function haupt() {
  const { werte, positionen } = leseArgumente(process.argv.slice(2), ["instanz", "tls-zertifikat", "tls-schluessel"]);
  if (!/^[a-z][a-z0-9-]{1,31}$/.test(werte.instanz ?? "") || !["start", "reconcile", "dienst", "restore", "zertifikat"].includes(positionen[0]) || positionen.length !== (positionen[0] === "restore" ? 2 : 1)) throw new Error("Aufruf: start|reconcile|dienst|restore [backup-id]|zertifikat --instanz <name>");
  const p = instanzPfade(werte.instanz), w = leseEnv(p.envDatei), docker = dockerAusfuehrer();
  const i = { projekt: `planora-${werte.instanz}`, envDatei: p.envDatei, composeDateien: composeDateien(w.PLANORA_BUNDLE_DIR) };
  if (positionen[0] === "zertifikat") {
    // Rotation des Kunden-Zertifikats: pruefen, ersetzen, Proxy neu starten, ausgeliefertes Zertifikat vergleichen.
    if (!werte["tls-zertifikat"] || !werte["tls-schluessel"] || !w.PLANORA_TLS_VERZEICHNIS) throw new Error("Aufruf: zertifikat --instanz <name> --tls-zertifikat <kette.pem> --tls-schluessel <key.pem> (nur bei --tls kundenzertifikat)");
    const r = await rotiereKundenzertifikat({ verzeichnis: w.PLANORA_TLS_VERZEICHNIS, domain: w.PLANORA_DOMAIN, zertifikatDatei: werte["tls-zertifikat"], schluesselDatei: werte["tls-schluessel"],
      neustart: async () => { await mussGelingen(docker, [...composeArgs(i), "restart", "proxy"]); },
      pruefe: async (fp) => (await ausgeliefertesZertifikat(Number(w.PLANORA_HTTPS_PORT ?? 443), w.PLANORA_DOMAIN)) === fp });
    console.log(JSON.stringify(r));
    return;
  }
  if (positionen[0] === "restore") {
    const update = leseZustand(p.zustand);
    if (update && !["fertig", "zurueck"].includes(update.status)) throw new Error("Unabgeschlossenes Update: dessen --rueckweg verwenden");
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
    return;
  }
  if (positionen[0] === "start") await mussGelingen(docker, [...composeArgs(i), "up", "-d", "--pull", "never", "--wait"]);
  await reconcileHost(docker, i);
  await mussGelingen(docker, [...composeArgs(i), "up", "-d", "--no-deps", "--pull", "never", "journal"]);
  if (positionen[0] === "dienst") {
    const ende = new AbortController();
    for (const s of ["SIGINT", "SIGTERM"] as const) process.once(s, () => ende.abort());
    const { setTimeout } = await import("node:timers/promises");
    while (!ende.signal.aborted) {
      await setTimeout(3_600_000, undefined, { signal: ende.signal }).catch(() => {});
      if (!ende.signal.aborted) await reconcileHost(docker, i);
    }
  }
}
haupt().catch(() => { console.error("Betriebsdienst fehlgeschlagen; Reconcile nicht bestaetigt"); process.exitCode = 1; });
