export type Dreiwertig = "ja" | "nein" | "unbekannt";
export type HeizArt = "hk" | "fbh" | "tabs";
export const HEIZ_ARTEN: readonly HeizArt[] = ["hk", "fbh", "tabs"];
export type Heizung = Record<HeizArt, Dreiwertig>;
export type Grundform = "quader" | "l_form" | "u_form";
export type BauteilStatus = "vorgeschlagen" | "bestaetigt";
export interface Rechteck { x: number; z: number; breite: number; tiefe: number }
export interface Punkt { x: number; z: number }
export interface Fehler { pfad: string; code: string; meldung: string }
export interface Hinweis { code: string; bezug: string }

export interface Huelle {
  name: string; grundform: Grundform; breiteM: number; tiefeM: number;
  geschosse: { id?: string; code: string; hoeheM?: number }[];
}
export interface HuelleGespeichert {
  gebaeudeId: string; liegenschaftId: string; name: string; grundform: Grundform; breiteM: number; tiefeM: number;
  regelwerkVersion: number; stand: number;
  geschosse: { id: string; code: string; hoeheM: number }[]; // sortiert nach Rang (UG3 … DACH)
}

/** Verweis auf eine Einheit: bestehende per ID, im selben Request neue per Index in `einheiten`. Genau eines setzen. */
export interface EinheitVerweis { einheitId?: string; einheitIndex?: number }
export interface Standort extends EinheitVerweis { geschossId?: string }
export interface EinheitEingabe {
  id?: string; geschossId: string; bezeichnung: string; art: string; flaecheM2: number | null;
  layoutManuell?: Rechteck | null;
  heizungAusnahme?: Partial<Heizung>; // nur Abweichungen vom Gebaeudestandard
  heizungWirksam?: Heizung;           // nur in Antworten; beim Schreiben ignoriert
}
export interface BauteilEingabe {
  id?: string; katalogId: string; standort: Standort; menge: number | null; status: BauteilStatus;
  hersteller?: string | null; typ?: string | null; baujahr?: number | null;
  positionManuell?: Punkt | null; versorgt: EinheitVerweis[];
}
export interface Beschreibung {
  gebaeudeId: string; stand: number;
  geschosse?: { id: string; code: string }[]; // nur lesend
  heizungStandard: Heizung;
  einheiten: EinheitEingabe[]; bauteile: BauteilEingabe[];
  hinweise?: Hinweis[];                        // nur lesend
}

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
