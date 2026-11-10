import pg from "pg";
import { wartungsLage } from "../betrieb/wartung.js";
import { dbKonfig, env, logge, release, starte } from "./konfig.js";

/**
 * Einstieg des Containers `worker`. M1 liefert keine Job-Handler (pg-boss-Handler kommen mit den Fachmodulen); der
 * Platzhalter prueft alle 5 s das Wartungsflag und haelt damit die Regel aus §14.4 fest: solange das Flag gesetzt ist
 * (oder die DB nicht antwortet), werden keine Jobs geholt. SIGTERM beendet sauber (Update Schritt 2, Grace 60 s).
 */
export async function workerSchleife(pool: Pick<pg.Pool, "query">, o: { intervallMs: number; signal: AbortSignal; melde?: (status: string) => void }) {
  let letzter = "";
  while (!o.signal.aborted) {
    const lage = await wartungsLage(pool);
    const status = !lage.db ? "db_nicht_erreichbar" : lage.wartung ? "wartung" : "bereit";
    if (status !== letzter) { letzter = status; (o.melde ?? ((s) => logge("status", { status: s, verarbeitet: 0 })))(status); }
    // status === "bereit": hier holen spaetere Module ihre Jobs; in M1 gibt es nichts zu verarbeiten.
    await new Promise<void>((weiter) => {
      const t = setTimeout(fertig, o.intervallMs);
      function fertig() { clearTimeout(t); o.signal.removeEventListener("abort", fertig); weiter(); }
      o.signal.addEventListener("abort", fertig, { once: true });
    });
  }
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("/start/worker.js")) starte(async () => {
  const pool = new pg.Pool({ ...dbKonfig("planora_app"), max: 2 });
  pool.on("error", (e) => logge("db.fehler", { fehler: e.message }));
  const stopp = new AbortController();
  for (const s of ["SIGTERM", "SIGINT"] as const) process.on(s, () => { logge("stopp", { signal: s }); stopp.abort(); });
  logge("gestartet", { release: release() });
  await workerSchleife(pool, { intervallMs: Number(env("PLANORA_WORKER_INTERVALL_MS", "5000")), signal: stopp.signal });
  await pool.end().catch(() => {});
  logge("beendet");
});
