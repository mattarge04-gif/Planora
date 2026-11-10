import pg from "pg";
import { wartungsLage } from "../betrieb/wartung.js";
import { beendeBegrenzt, dbKonfig, env, logge, release, starte } from "./konfig.js";

/** Wartet ms oder bis zum Abbruch; ein bereits abgebrochenes Signal kehrt sofort zurueck (PP9-5: kein verpasster Abbruch). */
export function warte(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise<void>((weiter) => {
    if (signal.aborted) return weiter();
    const fertig = () => { clearTimeout(t); signal.removeEventListener("abort", fertig); weiter(); };
    const t = setTimeout(fertig, ms);
    signal.addEventListener("abort", fertig, { once: true });
  });
}

/** Ergebnis von p oder "abbruch", sobald das Signal kommt – auch wenn p nie fertig wird (haengende DB). */
function oderAbbruch<T>(p: Promise<T>, signal: AbortSignal): Promise<T | "abbruch"> {
  if (signal.aborted) return Promise.resolve("abbruch");
  return new Promise((ok, fehler) => {
    const ab = () => ok("abbruch");
    signal.addEventListener("abort", ab, { once: true });
    p.then((w) => { signal.removeEventListener("abort", ab); ok(w); }, (e) => { signal.removeEventListener("abort", ab); fehler(e); });
  });
}

/**
 * Einstieg des Containers `worker`. M1 liefert keine Job-Handler (pg-boss-Handler kommen mit den Fachmodulen); der
 * Platzhalter prueft alle 5 s das Wartungsflag und haelt damit die Regel aus §14.4 fest: solange das Flag gesetzt ist
 * (oder die DB nicht antwortet), werden keine Jobs geholt. SIGTERM beendet sauber (Update Schritt 2, Grace 60 s) –
 * auch waehrend einer laufenden oder haengenden DB-Abfrage.
 */
export async function workerSchleife(pool: Pick<pg.Pool, "query">, o: { intervallMs: number; signal: AbortSignal; melde?: (status: string) => void; abfrageTimeoutMs?: number }) {
  let letzter = "";
  while (!o.signal.aborted) {
    const lage = await oderAbbruch(wartungsLage(pool, o.abfrageTimeoutMs, true), o.signal);
    if (lage === "abbruch" || o.signal.aborted) break;
    const status = !lage.db ? "db_nicht_erreichbar" : lage.restoreGesperrt ? "restore_gesperrt" : lage.wartung ? "wartung" : "bereit";
    if (status !== letzter) { letzter = status; (o.melde ?? ((s) => logge("status", { status: s, verarbeitet: 0 })))(status); }
    // status === "bereit": hier holen spaetere Module ihre Jobs; in M1 gibt es nichts zu verarbeiten.
    await warte(o.intervallMs, o.signal);
  }
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("/start/worker.js")) starte(async () => {
  const pool = new pg.Pool({ ...dbKonfig("planora_app"), max: 2 });
  pool.on("error", (e) => logge("db.fehler", { fehler: e.message }));
  const stopp = new AbortController();
  for (const s of ["SIGTERM", "SIGINT"] as const) process.on(s, () => { logge("stopp", { signal: s }); stopp.abort(); });
  logge("gestartet", { release: release() });
  await workerSchleife(pool, { intervallMs: Number(env("PLANORA_WORKER_INTERVALL_MS", "5000")), signal: stopp.signal });
  // haengende Verbindungen nicht abwarten: begrenzt schliessen, dann sauber enden
  await beendeBegrenzt([() => pool.end()], 5000);
  logge("beendet");
  process.exit(0);
});
