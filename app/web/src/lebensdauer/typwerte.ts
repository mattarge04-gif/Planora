import { eingabeZahl } from "./ansicht";
import type { LdStand } from "./typen";

const t = (n: number | null) => (n === null ? "" : String(n));

export type TypAenderungen = Record<string, { lMittel: string; preis: string }>;

/** Aenderungsbody fuer die Typwerte; nur geaenderte Felder, leer = null (zurueck auf Richtwert/kein Preis). */
export function typKoerper(s: LdStand, aenderungen: TypAenderungen):
  { body: { stand: number; typen: Record<string, unknown>[] } } | { fehler: Record<string, string> } {
  const typen: Record<string, unknown>[] = [], fehler: Record<string, string> = {};
  for (const [katalogId, f] of Object.entries(aenderungen)) {
    const alt = s.typen.find((x) => x.katalogId === katalogId);
    const l = eingabeZahl(f.lMittel, 1, 150), p = eingabeZahl(f.preis, 0, 9999999999);
    if (l === "ungueltig" || (typeof l === "number" && !Number.isInteger(l))) { fehler[katalogId] = "Lebensdauer 1 bis 150 Jahre"; continue; }
    if (p === "ungueltig") { fehler[katalogId] = "Preis in CHF mit Dezimalpunkt, z. B. 1200 oder 1'200.50"; continue; }
    const z: Record<string, unknown> = { katalogId };
    if (f.lMittel !== t(alt?.lMittel ?? null)) z.lMittel = l;
    if (p !== (alt?.stueckpreis ?? null)) z.stueckpreis = p; // numerisch: Tausendertrenner egal
    if (Object.keys(z).length > 1) typen.push(z);
  }
  return Object.keys(fehler).length ? { fehler } : { body: { stand: s.stand, typen } };
}

export function baujahrKoerper(s: LdStand, text: string):
  { body: { stand: number; heizungBaujahr: number | null } } | { fehler: string } {
  const j = eingabeZahl(text, 1800, 2100);
  if (j === "ungueltig" || (typeof j === "number" && !Number.isInteger(j))) return { fehler: "Jahr zwischen 1800 und 2100" };
  return { body: { stand: s.stand, heizungBaujahr: j } };
}
