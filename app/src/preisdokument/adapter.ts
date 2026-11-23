export interface KontextBauteil { id: string; katalogId: string; name: string; ort: string; hersteller: string | null; typ: string | null; menge: number | null }
export interface LeseKontext { bauteile: KontextBauteil[]; katalog: { id: string; name: string }[] }
export interface RohVorschlag {
  position: string; seite: number; zitat: string; materialNetto: number | null; rabattText: string | null;
  montageAnteil: number | null; ersatzpreis: number; rechenweg: string; katalogId: string | null; bauteilIds: string[]; sicherheit: "hoch" | "mittel" | "tief";
}
// roh wird erst von pruefeVorschlaege zu RohVorschlag[]
export interface LeseErgebnis { roh: unknown; modell: string; tokensEin: number; tokensAus: number }
export interface LeseAdapter { lies(pdf: Buffer, dateiname: string, kontext: LeseKontext): Promise<LeseErgebnis> }
/** Verbrauch einer Antwort; bei Fehlern nach erhaltener (verrechneter) Antwort am LeseFehler mitgegeben. */
export interface LeseVerbrauch { modell: string; tokensEin: number; tokensAus: number }
export class LeseFehler extends Error {
  constructor(public grund: "ablehnung" | "schema" | "abgeschnitten" | "api", meldung: string, public verbrauch?: LeseVerbrauch) { super(meldung); }
}
export function kostenUsd(tokensEin: number, tokensAus: number, preisEin = 2.0, preisAus = 10.0): number {
  return Math.round(((tokensEin * preisEin + tokensAus * preisAus) / 1_000_000) * 10_000) / 10_000;
}
// Entfernt Schluessel (exakt und im sk-...-Muster) aus Fehlermeldungen; Laenge begrenzt.
export function bereinigeFehler(meldung: string, apiKey: string, status?: number): string {
  let m = meldung;
  if (apiKey) m = m.split(apiKey).join("[key]");
  m = m.replace(/sk-[A-Za-z0-9_*-]+/g, "[key]").slice(0, 300);
  return status ? `API-Fehler (Status ${status}): ${m}` : m || "API-Fehler";
}
