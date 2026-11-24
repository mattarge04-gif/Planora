import { ersetzeJson, holeJson } from "../api";
export interface DatenblattFeld { schluessel: string; bezeichnung: string; einheit: string | null; art: "zahl" | "text" }
export interface DatenblattAntwort { bauteilId: string; katalogId: string; felder: DatenblattFeld[]; werte: Record<string, number | string>; darfAendern: boolean }
export const ladeDatenblatt = (bauteilId: string) => holeJson<DatenblattAntwort>(`/api/bestand/bauteile/${bauteilId}/datenblatt`);
export const speichereDatenblatt = (bauteilIds: string[], werte: Record<string, number | string | null>) =>
  ersetzeJson<DatenblattAntwort>("/api/bestand/datenblatt", { bauteilIds, werte });
/** Eingabe (Textfelder) -> Werte fuer PUT; Zahlen mit Komma oder Punkt, leer = null. */
export function werteAusEingabe(felder: DatenblattFeld[], eingabe: Record<string, string>) {
  const werte: Record<string, number | string | null> = {}; const fehler: Record<string, string> = {};
  for (const f of felder) {
    if (!(f.schluessel in eingabe)) continue;
    const roh = eingabe[f.schluessel].trim();
    if (!roh) { werte[f.schluessel] = null; continue; }
    if (f.art === "text") { werte[f.schluessel] = roh; continue; }
    const n = Number(roh.replace(",", ".").replace(/'/g, ""));
    if (Number.isFinite(n)) werte[f.schluessel] = n; else fehler[f.schluessel] = "Zahl eingeben";
  }
  return { werte, fehler };
}
export function wertText(f: DatenblattFeld, w: number | string | undefined): string {
  if (w === undefined || w === "") return "–";
  if (f.art === "text" || typeof w === "string") return String(w);
  const z = new Intl.NumberFormat("de-CH", { maximumFractionDigits: 2 }).format(w);
  return f.einheit === "DN" ? `DN ${z}` : f.einheit ? `${z} ${f.einheit}` : z;
}
