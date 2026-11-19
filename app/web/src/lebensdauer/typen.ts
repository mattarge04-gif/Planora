// Spiegel der Backend-Antwort von GET /api/lebensdauer/gebaeude/:id (app/src/lebensdauer/speicher.ts, rechnung.ts).

export type Ampel = "gruen" | "gelb" | "rot" | "grau";
export type Zustand = "gut" | "mittel" | "schlecht" | "kritisch";
export type PreisHerkunft = "kunde" | "dokument";

export interface LdAkte {
  zustand: Zustand | null;
  lebensdauerJahre: number | null;
  stueckpreis: number | null;
  quellePreis: PreisHerkunft | null;
  notiz: string | null;
}

export interface LdBauteil {
  id: string;
  katalogId: string;
  menge: number | null;
  baujahr: number | null;
  hersteller: string | null;
  typ: string | null;
  ort: string;
  akte: LdAkte | null;
}

export interface LdTyp {
  katalogId: string;
  lMittel: number | null;
  stueckpreis: number | null;
  quellePreis: PreisHerkunft | null;
  gelbJahre: number | null;
  standard: number;
  bereich: { min: number; max: number };
}

export interface LdErgebnisBauteil {
  id: string;
  ampel: Ampel;
  baujahr: number | null;
  ersatzjahr: number | null;
  restjahre: number | null;
  lebensdauer: number;
  stueckpreis: number | null;
  kosten: number | null;
  mengeAngenommen: boolean;
  quellen: {
    baujahr: "bauteil" | "gebaeude" | null;
    lebensdauer: "bauteil" | "typ" | "planora";
    preis: "bauteil" | "typ" | null;
    preisHerkunft: PreisHerkunft | null;
  };
}

export interface LdJahr {
  jahr: number;
  betrag: number;
  ohnePreis: number;
  anzahl: number;
}

export interface LdErgebnis {
  stichtag: number;
  bauteile: LdErgebnisBauteil[];
  jahre: LdJahr[];
  summe5: { betrag: number; ohnePreis: number };
  zaehler: Record<Ampel, number>;
}

export interface LdStand {
  gebaeudeId: string;
  stand: number;
  heizungBaujahr: number | null;
  typen: LdTyp[];
  bauteile: LdBauteil[];
  ergebnis: LdErgebnis;
  /** Nur in GET/PUT-Antwort der Gebaeude-Route: darf der Benutzer aendern (fach.aendern). */
  darfAendern?: boolean;
}
