import { ersetzeJson, holeJson } from "../api";
export interface DatenblattFeld { schluessel: string; bezeichnung: string; einheit: string | null; art: "zahl" | "text" }
/** E48: `bauteilIds` = alle Bauteile, fuer die die Werte gelten (Gruppe der Karte plus gleicher Hersteller + Typ); `abweichend` = Felder mit unterschiedlichen Werten. */
export interface DatenblattAntwort { bauteilId: string; katalogId: string; felder: DatenblattFeld[]; werte: Record<string, number | string>; darfAendern: boolean;
  bauteilIds: string[]; typ: string | null; abweichend: string[] }
export const ladeDatenblatt = (bauteilId: string, gruppe: string[] = []) =>
  holeJson<DatenblattAntwort>(`/api/bestand/bauteile/${bauteilId}/datenblatt${gruppe.length > 1 ? `?gruppe=${gruppe.join(",")}` : ""}`);
export const speichereDatenblatt = (bauteilIds: string[], werte: Record<string, number | string | null>) =>
  ersetzeJson<DatenblattAntwort>("/api/bestand/datenblatt", { bauteilIds, werte });
/** Nur geaenderte Felder senden (der Server mischt): sonst ueberschriebe ein Speichern abweichende Werte anderer Bauteile (G7). */
export const geaendert = (eingabe: Record<string, string>, start: Record<string, string>) =>
  Object.fromEntries(Object.entries(eingabe).filter(([k, v]) => v.trim() !== (start[k] ?? "").trim()));
/** Text unter dem Datenblatt: fuer wen die Werte gelten. */
export function geltungText(d: Pick<DatenblattAntwort, "bauteilIds" | "typ">): string | null {
  const n = d.bauteilIds.length;
  if (d.typ) return n > 1 ? `Gilt für alle ${n} Bauteile vom Typ ${d.typ}.` : `Gilt für alle Bauteile vom Typ ${d.typ}.`;
  return n > 1 ? `Gilt für alle ${n} Bauteile dieser Gruppe.` : null;
}
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
