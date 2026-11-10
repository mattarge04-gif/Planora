import type pg from "pg";

type Abfrage = Pick<pg.Pool, "query">;
const SQL = "select wert from instanz_einstellung where schluessel = 'wartung'";

/** Fuer Health: unterscheidet "DB nicht erreichbar" von "Wartung gesetzt". DB-Fehler gilt als Wartung (geschlossen). */
export async function wartungsLage(pool: Abfrage): Promise<{ db: boolean; wartung: boolean }> {
  try {
    const r = await pool.query(SQL);
    // geschlossen bei Zweifel: fehlende Zeile oder jeder Wert ausser JSON false gilt als aktiv
    return { db: true, wartung: r.rows[0]?.wert !== false };
  } catch { return { db: false, wartung: true }; }
}

/**
 * Wartungsflag aus instanz_einstellung('wartung') (Spec §8 Schritt 1, §14.4). Read pro Aufruf, kein Prozess-Cache.
 * DB-Fehler → true (geschlossen).
 */
export async function wartungAktiv(pool: Abfrage): Promise<boolean> {
  return (await wartungsLage(pool)).wartung;
}
