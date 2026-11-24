// Spiegel der Backend-Antworten von /api/preisdokument (app/src/preisdokument/speicher.ts, routen.ts).

export type DokumentStatus = "neu" | "liest" | "fertig" | "fehler" | "abgebrochen" | "aus";
export type Sicherheit = "hoch" | "mittel" | "tief";
export type VorschlagStatus = "offen" | "uebernommen" | "verworfen";

export interface VorschlagZeile {
  id: string;
  position: string;
  seite: number;
  zitat: string;
  materialNetto: number | null;
  rabattText: string | null;
  montageAnteil: number | null;
  ersatzpreis: number;
  rechenweg: string;
  katalogId: string | null;
  bauteilIds: string[];
  /** Bauteile, die es nicht mehr gibt. */
  fehlendeBauteile: string[];
  sicherheit: Sicherheit;
  status: VorschlagStatus;
  alsTyppreis: boolean;
}

export interface DokumentZeile {
  id: string;
  dateiname: string;
  groesse: number;
  seiten: number;
  hochgeladenAm: string;
  status: DokumentStatus;
  fehler: string | null;
  scanStatus: "quarantaene" | "sauber" | "abgelehnt" | "scan_fehler";
  vorschlaege: VorschlagZeile[];
}

export interface Uebersicht {
  dokumente: DokumentZeile[];
  darfAendern: boolean;
  auslesen: "an" | "kein_schluessel";
  budget: { verbrauchtUsd: number; limitUsd: number };
  /** Gebaeude-Stand fuer uebernehmen / alleSicheren (Konfliktpruefung). */
  stand: number;
}

export interface UebernehmenEingabe {
  bauteilIds: string[];
  alsTyppreis: boolean;
  stand: number;
  ueberschreibeHandeingabe?: boolean;
}
