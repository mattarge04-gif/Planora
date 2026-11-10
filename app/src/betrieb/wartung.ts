import type pg from "pg";

type Abfrage = Pick<pg.Pool, "query">;
const SQL = "select wert from instanz_einstellung where schluessel = 'wartung'";
/** Obergrenze fuer die Flag-Abfrage: eine DB, die Verbindungen annimmt und nie antwortet, gilt danach als nicht erreichbar (PP9-5). */
export const WARTUNG_TIMEOUT_MS = 3000;

/**
 * Fuer Health: unterscheidet "DB nicht erreichbar" von "Wartung gesetzt". DB-Fehler oder keine Antwort innerhalb von
 * timeoutMs gelten als Wartung (geschlossen). Die Zeitgrenze liegt hier und nicht nur in der Pool-Konfiguration, damit
 * Health und Mutationen unabhaengig vom uebergebenen Pool zeitbegrenzt antworten.
 */
export async function wartungsLage(pool: Abfrage, timeoutMs = WARTUNG_TIMEOUT_MS): Promise<{ db: boolean; wartung: boolean }> {
  let timer: NodeJS.Timeout | undefined;
  try {
    const abfrage = pool.query(SQL);
    abfrage.catch(() => {}); // spaeter Fehler der abgehaengten Abfrage darf nicht unbehandelt bleiben
    const r = await Promise.race([
      abfrage,
      new Promise<never>((_, fehler) => { timer = setTimeout(() => fehler(new Error("Zeitueberschreitung")), timeoutMs); }),
    ]);
    // geschlossen bei Zweifel: fehlende Zeile oder jeder Wert ausser JSON false gilt als aktiv
    return { db: true, wartung: r.rows[0]?.wert !== false };
  } catch { return { db: false, wartung: true }; }
  finally { clearTimeout(timer); }
}

/**
 * Wartungsflag aus instanz_einstellung('wartung') (Spec §8 Schritt 1, §14.4). Read pro Aufruf, kein Prozess-Cache.
 * DB-Fehler oder Zeitueberschreitung → true (geschlossen).
 */
export async function wartungAktiv(pool: Abfrage, timeoutMs = WARTUNG_TIMEOUT_MS): Promise<boolean> {
  return (await wartungsLage(pool, timeoutMs)).wartung;
}
