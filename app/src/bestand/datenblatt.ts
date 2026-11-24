import type { DatenblattFeld } from "../welt/regelwerk.js";
export type DatenblattWert = number | string;
type Fehler = { pfad: string; code: string; meldung: string };
const MAX_ZAHL = 1e9, MAX_TEXT = 200;

/** Prueft Werte gegen die Katalog-Felder: unbekannte Schluessel und falsche Typen sind Fehler; null/leer faellt weg. */
export function pruefeDatenblatt(felder: DatenblattFeld[], werte: Record<string, unknown>):
  { ok: true; werte: Record<string, DatenblattWert> | null } | { ok: false; fehler: Fehler[] } {
  const je = new Map(felder.map((f) => [f.schluessel, f]));
  const aus: Record<string, DatenblattWert> = {}; const fehler: Fehler[] = [];
  for (const [k, v] of Object.entries(werte)) {
    const f = je.get(k);
    if (!f) { fehler.push({ pfad: `werte/${k}`, code: "feld_unbekannt", meldung: "Feld gibt es fuer diesen Typ nicht" }); continue; }
    if (v === null || (typeof v === "string" && !v.trim())) continue;
    if (f.art === "zahl" && typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= MAX_ZAHL) aus[k] = v;
    else if (f.art === "text" && typeof v === "string" && v.trim().length <= MAX_TEXT) aus[k] = v.trim();
    else fehler.push({ pfad: `werte/${k}`, code: "feld_typ", meldung: f.art === "zahl" ? "Zahl erwartet" : `Text bis ${MAX_TEXT} Zeichen erwartet` });
  }
  if (fehler.length) return { ok: false, fehler };
  return { ok: true, werte: Object.keys(aus).length ? aus : null };
}
