import { ERSATZ_LEBENSDAUER, GELB_JAHRE, STANDARD_LEBENSDAUER, ZUSTAND_ABZUG } from "./standard.js";

export type Zustand = "gut" | "mittel" | "schlecht" | "kritisch";
export type Ampel = "gruen" | "gelb" | "rot" | "grau";
export type PreisHerkunft = "kunde" | "dokument";
export interface RechenBauteil { id: string; katalogId: string; menge: number | null; baujahr: number | null;
  akte: { zustand: Zustand | null; lebensdauerJahre: number | null; stueckpreis: number | null; quellePreis: PreisHerkunft | null } | null }
export interface RechenTyp { katalogId: string; lMittel: number | null; stueckpreis: number | null; quellePreis: PreisHerkunft | null; gelbJahre: number | null }
export interface BauteilErgebnis { id: string; ampel: Ampel; baujahr: number | null; ersatzjahr: number | null; restjahre: number | null;
  lebensdauer: number; stueckpreis: number | null; kosten: number | null; mengeAngenommen: boolean;
  quellen: { baujahr: "bauteil" | "gebaeude" | null; lebensdauer: "bauteil" | "typ" | "planora"; preis: "bauteil" | "typ" | null; preisHerkunft: PreisHerkunft | null } }
export interface JahresSumme { jahr: number; betrag: number; ohnePreis: number; anzahl: number }
export interface Ergebnis { stichtag: number; bauteile: BauteilErgebnis[]; jahre: JahresSumme[];
  summe5: { betrag: number; ohnePreis: number }; zaehler: Record<Ampel, number> }

const JAHRE = 10;
const rund = (x: number) => Math.round(x * 100) / 100;

/** Reine Rechnung (Spec Abschnitt 4). Keine Uhr, keine DB: der Stichtag kommt vom Aufrufer. */
export function rechne(e: { stichtag: number; heizungBaujahr: number | null; bauteile: RechenBauteil[]; typen: RechenTyp[] }): Ergebnis {
  const typ = new Map(e.typen.map((t) => [t.katalogId, t]));
  const jahre: JahresSumme[] = Array.from({ length: JAHRE }, (_, i) => ({ jahr: e.stichtag + i, betrag: 0, ohnePreis: 0, anzahl: 0 }));
  const zaehler: Record<Ampel, number> = { gruen: 0, gelb: 0, rot: 0, grau: 0 };
  const bauteile = e.bauteile.map((b): BauteilErgebnis => {
    const t = typ.get(b.katalogId), a = b.akte;
    const baujahr = b.baujahr ?? e.heizungBaujahr;
    const qBaujahr = b.baujahr !== null ? "bauteil" : e.heizungBaujahr !== null ? "gebaeude" : null;
    const lebensdauer = a?.lebensdauerJahre ?? t?.lMittel ?? STANDARD_LEBENSDAUER[b.katalogId] ?? ERSATZ_LEBENSDAUER;
    const qLebensdauer = a?.lebensdauerJahre != null ? "bauteil" : t?.lMittel != null ? "typ" : "planora";
    const preisAkte = a?.stueckpreis ?? null;
    const stueckpreis = preisAkte ?? t?.stueckpreis ?? null;
    const qPreis = preisAkte !== null ? "bauteil" : stueckpreis !== null ? "typ" : null;
    const preisHerkunft = qPreis === "bauteil" ? a!.quellePreis : qPreis === "typ" ? t!.quellePreis : null;
    const mengeAngenommen = b.menge === null;
    const kosten = stueckpreis === null ? null : rund((b.menge ?? 1) * stueckpreis);
    let ersatzjahr: number | null = null, ampel: Ampel = "grau";
    if (baujahr !== null) {
      ersatzjahr = a?.zustand === "kritisch" ? e.stichtag : baujahr + lebensdauer - (a?.zustand ? ZUSTAND_ABZUG[a.zustand] : 0);
      const gelb = t?.gelbJahre ?? GELB_JAHRE;
      ampel = ersatzjahr <= e.stichtag ? "rot" : ersatzjahr <= e.stichtag + gelb ? "gelb" : "gruen";
      const j = jahre[Math.max(ersatzjahr, e.stichtag) - e.stichtag];
      if (j) { j.anzahl++; if (kosten === null) j.ohnePreis++; else j.betrag = rund(j.betrag + kosten); }
    }
    zaehler[ampel]++;
    return { id: b.id, ampel, baujahr, ersatzjahr, restjahre: ersatzjahr === null ? null : Math.max(0, ersatzjahr - e.stichtag),
      lebensdauer, stueckpreis, kosten, mengeAngenommen,
      quellen: { baujahr: qBaujahr, lebensdauer: qLebensdauer, preis: qPreis, preisHerkunft } };
  });
  const fuenf = jahre.slice(0, 5);
  return { stichtag: e.stichtag, bauteile, jahre, zaehler,
    summe5: { betrag: rund(fuenf.reduce((s, j) => s + j.betrag, 0)), ohnePreis: fuenf.reduce((s, j) => s + j.ohnePreis, 0) } };
}
