/** Planora-Richtwerte Lebensdauer in Jahren (Spec 2026-11-19 Abschnitt 3) [A, fachlich nicht freigegeben].
 *  Keine Standardpreise (PO 19.11.). Neue Katalog-IDs brauchen hier einen Eintrag (Test prueft das). */
export const STANDARD_LEBENSDAUER: Record<string, number> = {
  "heizung.waermepumpe": 20, "heizung.gaskessel": 20, "heizung.oelkessel": 20,
  "heizung.fernwaerme_uebergabe": 30, "heizung.speicher": 25, "heizung.umwaelzpumpe": 12,
  "heizung.verteiler": 30, "heizung.wmz": 10, "heizung.heizkoerper": 40,
  "heizung.fbh_kreis": 50, "heizung.tabs_feld": 50, "heizung.ventil_3weg": 20, "heizung.ventil_2weg": 20,
};
export const ERSATZ_LEBENSDAUER = 20; // unbekannte Katalog-ID [A]
export const GELB_JAHRE = 3;          // [A]
export const ZUSTAND_ABZUG = { gut: 0, mittel: 2, schlecht: 5 } as const; // kritisch = sofort [A]
export const lebensdauerBereich = (mittel: number) => ({ min: Math.round(mittel * 0.75), max: Math.round(mittel * 1.25) });
