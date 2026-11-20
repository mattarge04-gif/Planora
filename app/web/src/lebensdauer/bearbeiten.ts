import { eingabeZahl, preisText } from "./ansicht";
import type { LdStand, Zustand } from "./typen";

export interface Formular { baujahr: string; zustand: "" | Zustand; lebensdauer: string; preis: string; notiz: string }
const text = (n: number | null | undefined) => (n == null ? "" : String(n));

export function formularAus(s: LdStand, id: string): Formular {
  const b = s.bauteile.find((x) => x.id === id)!;
  return { baujahr: text(b.baujahr), zustand: b.akte?.zustand ?? "", lebensdauer: text(b.akte?.lebensdauerJahre), preis: preisText(b.akte?.stueckpreis), notiz: b.akte?.notiz ?? "" };
}

export type Koerper = { body: { stand: number; bauteile: [Record<string, unknown>] } } | { fehler: Partial<Record<keyof Formular, string>> };

export function koerperAus(s: LdStand, id: string, f: Formular): Koerper {
  const alt = formularAus(s, id), fehler: Partial<Record<keyof Formular, string>> = {};
  const baujahr = eingabeZahl(f.baujahr, 1800, 2100), lebensdauer = eingabeZahl(f.lebensdauer, 1, 150), preis = eingabeZahl(f.preis, 0, 9999999999);
  if (baujahr === "ungueltig" || (typeof baujahr === "number" && !Number.isInteger(baujahr))) fehler.baujahr = "Jahr zwischen 1800 und 2100";
  if (lebensdauer === "ungueltig" || (typeof lebensdauer === "number" && !Number.isInteger(lebensdauer))) fehler.lebensdauer = "1 bis 150 Jahre";
  if (preis === "ungueltig") fehler.preis = "Betrag in CHF, z. B. 1200 oder 1'200.50";
  if (f.notiz.length > 2000) fehler.notiz = "Höchstens 2000 Zeichen";
  if (Object.keys(fehler).length) return { fehler };
  const b: Record<string, unknown> = { id };
  if (f.baujahr !== alt.baujahr) b.baujahr = baujahr;
  if (f.zustand !== alt.zustand) b.zustand = f.zustand || null;
  if (f.lebensdauer !== alt.lebensdauer) b.lebensdauerJahre = lebensdauer;
  // Preis numerisch vergleichen: "35000" und "35'000" sind derselbe Wert
  if (preis !== (s.bauteile.find((x) => x.id === id)?.akte?.stueckpreis ?? null)) b.stueckpreis = preis;
  if (f.notiz !== alt.notiz) b.notiz = f.notiz.trim() || null;
  return { body: { stand: s.stand, bauteile: [b] as [Record<string, unknown>] } };
}
