// Spiegel der API-Typen aus app/src/welt/typen.ts (Welt, Beschreibung). Bei Aenderungen dort hier nachziehen.
export type BauteilStatus = "vorgeschlagen" | "bestaetigt";
export interface Rechteck { x: number; z: number; breite: number; tiefe: number }
export interface Hinweis { code: string; bezug: string }
export interface WeltSymbol {
  schluessel: string; katalogId: string; hersteller: string | null; typ: string | null;
  bauteilIds: string[]; mengeSumme: number; mengeUnbekannt: boolean; status: BauteilStatus;
  position: { x: number; y: number; z: number }; versorgt: string[];
}
export interface Welt {
  regelwerkVersion: number; hash: string; grundriss: Rechteck[];
  geschosse: { id: string; code: string; yUnten: number; hoehe: number }[];
  einheiten: { id: string; geschossId: string; bezeichnung: string; art: string; rechteck: Rechteck; quelle: "schematisch" | "manuell" }[];
  symbole: WeltSymbol[]; hinweise: Hinweis[];
}
export interface BauteilZeile {
  id?: string; katalogId: string; standort: { einheitId?: string; geschossId?: string };
  menge: number | null; status: BauteilStatus; hersteller?: string | null; typ?: string | null; baujahr?: number | null;
}
export interface Beschreibung { gebaeudeId: string; stand: number; bauteile: BauteilZeile[]; hinweise?: Hinweis[] }
export interface KatalogEintrag { id: string; name: string; bereich: "zentrale" | "verteilung" | "einheit" }
export interface Katalog { version: number; eintraege: KatalogEintrag[] }
export interface GebaeudeEintrag { id: string; name: string; liegenschaftId: string; liegenschaftName: string; geschosse: number }
