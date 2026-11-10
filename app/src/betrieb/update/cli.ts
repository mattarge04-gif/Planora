import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { leseArgumente } from "../install/argumente.js";
import { instanzPfade, leseEnv } from "../install/plan.js";
import { pruefeRelease } from "../release.js";
import { dockerAusfuehrer } from "./docker.js";
import { aktualisiere, leseZustand } from "./zustand.js";
import { dockerBetriebsumgebung } from "./umgebung.js";

async function haupt() {
  const { werte: w, positionen } = leseArgumente(process.argv.slice(2), ["instanz"], ["fortsetzen", "rueckweg", "status"]);
  if (!/^[a-z][a-z0-9-]{1,31}$/.test(w.instanz ?? "")) throw new Error("--instanz <name> fehlt oder ist ungueltig");
  if ([w.fortsetzen, w.rueckweg, w.status].filter(Boolean).length > 1 || positionen.length > 1 || (positionen.length && (w.fortsetzen || w.rueckweg || w.status))) throw new Error("Genau Bundle oder --fortsetzen oder --rueckweg oder --status angeben");
  const pfade = instanzPfade(w.instanz);
  if (w.status) { console.log(JSON.stringify(leseZustand(pfade.zustand), null, 2)); return; }
  if (!existsSync(pfade.envDatei)) throw new Error("Instanz nicht installiert");
  const altEnv = leseEnv(pfade.envDatei);
  const vorhanden = leseZustand(pfade.zustand);
  const altesBundle = vorhanden && (w.fortsetzen || w.rueckweg) ? vorhanden.altesBundle : altEnv.PLANORA_BUNDLE_DIR ?? process.env.PLANORA_BUNDLE;
  if (!altesBundle) throw new Error("Pfad zum installierten Bundle fehlt (PLANORA_BUNDLE_DIR)");
  const modus = w.fortsetzen ? "fortsetzen" : w.rueckweg ? "rueckweg" : undefined;
  let neu;
  if (!modus) {
    if (!positionen[0]) throw new Error("Aufruf: planora update --instanz <name> <bundle>|--fortsetzen|--rueckweg|--status");
    const bundle = resolve(positionen[0]);
    const release = pruefeRelease(readFileSync(join(bundle, "release.json"), "utf8"), readFileSync(pfade.schluessel, "utf8"));
    neu = { instanz: w.instanz, bundle, altesBundle: resolve(altesBundle), altEnv, release };
  }
  const z = await aktualisiere({ datei: pfade.zustand, sperre: pfade.sperre, modus, neu }, dockerBetriebsumgebung(dockerAusfuehrer(), w.instanz, resolve(altesBundle)));
  console.log(JSON.stringify({ updateId: z.id, status: z.status, bestaetigt: z.bestaetigt, release: z.release.version, backupId: z.backupId }));
}
haupt().catch((e) => { console.error(`Update abgebrochen: ${(e as Error).message}`); process.exitCode = 1; });
