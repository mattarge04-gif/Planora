// Spiegel der API-Typen aus app/src/welt/typen.ts (Welt, Beschreibung). Bei Aenderungen dort hier nachziehen.
export type BauteilStatus = "vorgeschlagen" | "bestaetigt";
export type Dreiwertig = "ja" | "nein" | "unbekannt";
export type HeizArt = "hk" | "fbh" | "tabs";
export type Heizung = Record<HeizArt, Dreiwertig>;
export type Grundform = "quader" | "quadrat" | "l_form" | "u_form";
export type GruppenArt = "ungeregelt" | "beimisch" | "drossel" | "einspritz" | "umlenk";
export interface Punkt { x: number; z: number }
export interface Rechteck { x: number; z: number; breite: number; tiefe: number }
export interface Hinweis { code: string; bezug: string }
export type WeltOrt = { gruppe: string } | { vorBauteil: string };
export interface WeltGruppe {
  id: string; verteiler: string; nummer: number; art: GruppenArt; bezeichnung: string;
  verbraucher: string[]; zubehoer: string[];
}
export interface WeltSymbol {
  schluessel: string; katalogId: string; hersteller: string | null; typ: string | null;
  bauteilIds: string[]; mengeSumme: number; mengeUnbekannt: boolean; status: BauteilStatus;
  position: { x: number; y: number; z: number }; versorgt: string[];
  ort?: WeltOrt;
}
export interface Welt {
  regelwerkVersion: number; hash: string; grundriss: Rechteck[];
  geschosse: { id: string; code: string; yUnten: number; hoehe: number }[];
  einheiten: { id: string; geschossId: string; bezeichnung: string; art: string; rechteck: Rechteck; quelle: "schematisch" | "manuell" }[];
  symbole: WeltSymbol[]; hinweise: Hinweis[];
  gruppen?: WeltGruppe[]; steigzone?: { x: number; z: number } | null;
}
export interface Huelle {
  name: string; grundform: Grundform; breiteM?: number; tiefeM?: number;
  geschosse: { id?: string; code: string; hoeheM?: number }[];
}
export interface EinheitVerweis { einheitId?: string; einheitIndex?: number }
export interface Standort extends EinheitVerweis { geschossId?: string }
export interface EinheitEingabe {
  id?: string; geschossId: string; bezeichnung: string; art: string; flaecheM2: number | null;
  layoutManuell?: Rechteck | null; heizungAusnahme?: Partial<Heizung>; heizungWirksam?: Heizung;
}
export interface BauteilVerweis { bauteilId?: string; bauteilIndex?: number }
export interface GruppeVerweis { gruppeId?: string; gruppeIndex?: number }
export type Ort = { gruppe: GruppeVerweis } | { vorBauteil: BauteilVerweis };
export interface GruppeEingabe {
  id?: string; verteiler: BauteilVerweis; nummer: number; art: GruppenArt; bezeichnung: string; verbraucher: BauteilVerweis[];
}
export interface BauteilEingabe {
  id?: string; katalogId: string; standort: Standort; menge: number | null; status: BauteilStatus;
  hersteller?: string | null; typ?: string | null; baujahr?: number | null;
  positionManuell?: Punkt | null; versorgt: EinheitVerweis[]; ort?: Ort | null;
}
/** Bauteilzeile wie vom Backend; `versorgt` optional, damit bestehende Leser/Testdaten (Dashboard, Panel) unveraendert bleiben. */
export type BauteilZeile = Omit<BauteilEingabe, "versorgt"> & { versorgt?: EinheitVerweis[] };
export interface Beschreibung {
  gebaeudeId: string; stand: number;
  geschosse?: { id: string; code: string }[]; // nur lesend
  heizungStandard?: Heizung;
  einheiten?: EinheitEingabe[];
  bauteile: BauteilZeile[];
  gruppen?: GruppeEingabe[];
  hinweise?: Hinweis[];
}
/** Vollstaendiger Spiegel der Backend-Beschreibung (Ein-/Ausgabeformat des Assistenten). */
export interface BeschreibungEingabe {
  gebaeudeId: string; stand: number;
  geschosse?: { id: string; code: string }[]; // nur lesend
  heizungStandard: Heizung;
  einheiten: EinheitEingabe[]; bauteile: BauteilEingabe[];
  gruppen?: GruppeEingabe[];
  hinweise?: Hinweis[]; // nur lesend
}
export interface KatalogEintrag { id: string; name: string; bereich: "zentrale" | "verteilung" | "einheit" | "zubehoer"; masse?: [number, number, number] }
export interface Katalog { version: number; eintraege: KatalogEintrag[] }
export interface GebaeudeEintrag { id: string; name: string; liegenschaftId: string; liegenschaftName: string; geschosse: number }
