// Spiegel von app/src/dokumente/speicher.ts
export type Art = "pdf" | "bild" | "office";
export type Kategorie = "datenblatt" | "plan" | "offerte" | "foto" | "protokoll" | "sonstiges";
export type ScanStatus = "quarantaene" | "sauber" | "abgelehnt" | "scan_fehler";
export interface AblageZeile {
  id: string; dateiname: string; art: Art; mime: string; kategorie: Kategorie; groesse: number; seiten: number | null;
  hochgeladenAm: string; scanStatus: ScanStatus; scanGrund: string | null; gescanntAm: string | null; bauteilIds: string[];
}
export interface AblageBauteil { id: string; katalogId: string; geschoss: string; ort: string; hersteller: string | null; typ: string | null }
export interface AblageAntwort { dokumente: AblageZeile[]; bauteile: AblageBauteil[]; darfAendern: boolean }
/** Meldung je Datei nach dem Ablegen (Seite Dokumente und Anlagenkarte). */
export interface AblageMeldung { datei: string; text: string; art: "fehler" | "hinweis" }
