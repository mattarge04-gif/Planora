export type Dreiwertig = "ja" | "nein" | "unbekannt";
export type HeizArt = "hk" | "fbh" | "tabs";
export const HEIZ_ARTEN: readonly HeizArt[] = ["hk", "fbh", "tabs"];
export type Heizung = Record<HeizArt, Dreiwertig>;
export type Grundform = "quader" | "quadrat" | "l_form" | "u_form";
export type GruppenArt = "ungeregelt" | "beimisch" | "drossel" | "einspritz" | "umlenk";
export const GRUPPEN_ARTEN: readonly GruppenArt[] = ["ungeregelt", "beimisch", "drossel", "einspritz", "umlenk"];
export type BauteilStatus = "vorgeschlagen" | "bestaetigt";
export interface Rechteck { x: number; z: number; breite: number; tiefe: number }
export interface Punkt { x: number; z: number }
export interface Fehler { pfad: string; code: string; meldung: string }
export interface Hinweis { code: string; bezug: string }

export interface Huelle {
  name: string; grundform: Grundform; breiteM?: number; tiefeM?: number; // Pflicht nur bei Regelwerk v1 (prueft pruefeHuelle)
  geschosse: { id?: string; code: string; hoeheM?: number }[];
}
export interface HuelleGespeichert {
  gebaeudeId: string; liegenschaftId: string; name: string; grundform: Grundform; breiteM: number | null; tiefeM: number | null;
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
/** Bestehendes Bauteil per ID oder im selben Request neues per Index in `bauteile`. Genau eines setzen. */
export interface BauteilVerweis { bauteilId?: string; bauteilIndex?: number }
export interface GruppeVerweis { gruppeId?: string; gruppeIndex?: number }
export type Ort = { gruppe: GruppeVerweis } | { vorBauteil: BauteilVerweis };
export interface GruppeEingabe {
  id?: string; verteiler: BauteilVerweis; nummer: number; art: GruppenArt; bezeichnung: string; verbraucher: BauteilVerweis[];
}
export interface BauteilEingabe {
  id?: string; katalogId: string; standort: Standort; menge: number | null; status: BauteilStatus;
  hersteller?: string | null; typ?: string | null; baujahr?: number | null;
  positionManuell?: Punkt | null; versorgt: EinheitVerweis[];
  ort?: Ort | null;
}
export interface Beschreibung {
  gebaeudeId: string; stand: number;
  geschosse?: { id: string; code: string }[]; // nur lesend
  heizungStandard: Heizung;
  einheiten: EinheitEingabe[]; bauteile: BauteilEingabe[];
  gruppen?: GruppeEingabe[];                   // fehlt = [] = alle Gruppen loeschen
  hinweise?: Hinweis[];                        // nur lesend
}

export type WeltOrt = { gruppe: string } | { vorBauteil: string }; // Gruppen-ID bzw. Symbolschluessel
export interface WeltGruppe {
  id: string; verteiler: string; nummer: number; art: GruppenArt; bezeichnung: string;
  verbraucher: string[]; zubehoer: string[]; // Symbolschluessel
}
export interface WeltSymbol {
  schluessel: string; katalogId: string; hersteller: string | null; typ: string | null;
  bauteilIds: string[]; mengeSumme: number; mengeUnbekannt: boolean; status: BauteilStatus;
  position: { x: number; y: number; z: number }; versorgt: string[];
  ort?: WeltOrt; // nur v2
}
export interface Welt {
  regelwerkVersion: number; hash: string; grundriss: Rechteck[];
  geschosse: { id: string; code: string; yUnten: number; hoehe: number }[];
  einheiten: { id: string; geschossId: string; bezeichnung: string; art: string; rechteck: Rechteck; quelle: "schematisch" | "manuell" }[];
  symbole: WeltSymbol[]; hinweise: Hinweis[];
  gruppen?: WeltGruppe[]; steigzone?: { x: number; z: number } | null; // nur v2
}
