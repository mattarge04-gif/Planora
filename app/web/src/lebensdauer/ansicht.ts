import { TOKENS } from "../design/tokens";
import type { Ampel, LdErgebnisBauteil, LdStand, Zustand } from "./typen";

export const AMPEL_FARBE: Record<Ampel, string> = { gruen: TOKENS.farbe.statusOk, gelb: TOKENS.farbe.statusWarnung, rot: TOKENS.farbe.statusStoerung, grau: TOKENS.farbe.grau3 };
export const AMPEL_TEXT: Record<Ampel, string> = { gruen: "In Ordnung", gelb: "Bald ersetzen", rot: "Ersetzen", grau: "Baujahr fehlt" };
export const ZUSTAND_TEXT: Record<Zustand, string> = { gut: "Gut", mittel: "Mittel", schlecht: "Schlecht", kritisch: "Kritisch" };
const RANG: Record<Ampel, number> = { rot: 3, gelb: 2, grau: 1, gruen: 0 };

export const chf = (b: number) => `CHF ${Math.round(b).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'")}`;

export function ampelJeSymbol(stand: LdStand, symbole: { schluessel: string; bauteilIds: string[] }[]): Map<string, Ampel> {
  const je = new Map(stand.ergebnis.bauteile.map((b) => [b.id, b.ampel]));
  const m = new Map<string, Ampel>();
  for (const s of symbole) {
    const a = s.bauteilIds.map((id) => je.get(id)).filter((x): x is Ampel => !!x);
    if (a.length) m.set(s.schluessel, a.reduce((x, y) => (RANG[y] > RANG[x] ? y : x)));
  }
  return m;
}

const Q_BAUJAHR = { bauteil: "Eigene Angabe", gebaeude: "Gebäudestandard" } as const;
const Q_LD = { bauteil: "Eigene Angabe", typ: "Typwert", planora: "Planora-Richtwert" } as const;
function preisQuelle(e: LdErgebnisBauteil) {
  if (e.quellen.preis === null) return "Preis fehlt";
  if (e.quellen.preisHerkunft === "dokument") return "Aus Dokument";
  return e.quellen.preis === "bauteil" ? "Eigene Angabe" : "Typwert";
}

export interface AkteZeile { id: string; ort: string; menge: string; ampel: Ampel; ersatzjahr: string; restjahre: string; kosten: string;
  baujahr: { wert: string; quelle: string }; lebensdauer: { wert: string; quelle: string }; preis: { wert: string; quelle: string; fehlt: boolean } }
export function akteZeilen(stand: LdStand, bauteilIds: string[]): AkteZeile[] {
  const erg = new Map(stand.ergebnis.bauteile.map((b) => [b.id, b]));
  return bauteilIds.flatMap((id) => {
    const b = stand.bauteile.find((x) => x.id === id), e = erg.get(id);
    if (!b || !e) return [];
    return [{ id, ort: b.ort, menge: b.menge === null ? "unbekannt (1 angenommen)" : String(b.menge), ampel: e.ampel,
      ersatzjahr: e.ersatzjahr === null ? "–" : String(e.ersatzjahr),
      restjahre: e.restjahre === null ? "–" : e.restjahre === 0 ? "fällig" : `${e.restjahre} Jahre`,
      kosten: e.kosten === null ? "–" : chf(e.kosten),
      baujahr: { wert: e.baujahr === null ? "–" : String(e.baujahr), quelle: e.quellen.baujahr ? Q_BAUJAHR[e.quellen.baujahr] : "fehlt" },
      lebensdauer: { wert: `${e.lebensdauer} Jahre`, quelle: Q_LD[e.quellen.lebensdauer] },
      preis: { wert: e.stueckpreis === null ? "–" : chf(e.stueckpreis), quelle: preisQuelle(e), fehlt: e.stueckpreis === null } }];
  });
}

export interface Legende { zaehler: Record<Ampel, number>; summe5: string; ohnePreis: number }
export const legende = (s: LdStand): Legende => ({ zaehler: s.ergebnis.zaehler, summe5: chf(s.ergebnis.summe5.betrag), ohnePreis: s.ergebnis.summe5.ohnePreis });

export interface Balken { jahr: number; betrag: number; text: string; ohnePreis: number; anteil: number }
export function balken(s: LdStand): Balken[] {
  const max = Math.max(0, ...s.ergebnis.jahre.map((j) => j.betrag));
  return s.ergebnis.jahre.map((j) => ({ jahr: j.jahr, betrag: j.betrag, ohnePreis: j.ohnePreis,
    text: j.betrag > 0 ? chf(j.betrag) : "–", anteil: max > 0 ? j.betrag / max : 0 }));
}

export interface PlanZeile extends AkteZeile { name: string; ersatzjahrZahl: number | null }
export function planZeilen(s: LdStand, name: (katalogId: string) => string, jahr: number | null): PlanZeile[] {
  const erg = new Map(s.ergebnis.bauteile.map((b) => [b.id, b]));
  const zeilen = akteZeilen(s, s.bauteile.map((b) => b.id)).map((z) => ({ ...z,
    name: name(s.bauteile.find((b) => b.id === z.id)!.katalogId), ersatzjahrZahl: erg.get(z.id)!.ersatzjahr }));
  const faellig = (z: PlanZeile) => z.ersatzjahrZahl === null ? null : Math.max(z.ersatzjahrZahl, s.ergebnis.stichtag);
  return zeilen.filter((z) => jahr === null || faellig(z) === jahr)
    .sort((a, b) => (a.ersatzjahrZahl ?? Infinity) - (b.ersatzjahrZahl ?? Infinity));
}

export function eingabeZahl(text: string, min: number, max: number): number | null | "ungueltig" {
  const t = text.trim().replace(/['’\s]/g, "");
  if (t === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return "ungueltig";
  const n = Number(t);
  return n < min || n > max ? "ungueltig" : n;
}
