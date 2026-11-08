// S10 Wegwerf-Prototyp des Rechenkerns nach 03-architektur.md Kap. 8 (KEIN Produktivcode).
// Reine Funktion: kein IO, kein Date.now(), kein Math.random(), kein Gleitkomma fuer Geld/Faktoren.
// Dezimalarithmetik: BigInt-Festkomma mit 30 Nachkommastellen (03 verlangt >= 20).
import { createHash } from "node:crypto";

// Vergleich nach Codepunkten: localeCompare haengt von der ICU-Locale ab -> im Kern verboten.
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

// ---------- Festkomma-Dezimal ----------
const SKALA = 10n ** 30n;
export type Dez = bigint; // Wert * 10^30
export const dez = (s: string | number): Dez => {
  const t = String(s); const neg = t.startsWith("-"); const [g, f = ""] = (neg ? t.slice(1) : t).split(".");
  const v = BigInt(g || "0") * SKALA + BigInt((f + "0".repeat(30)).slice(0, 30));
  return neg ? -v : v;
};
const mul = (a: Dez, b: Dez): Dez => (a * b) / SKALA;
const div = (a: Dez, b: Dez): Dez => (a * SKALA) / b;
const sqrt = (a: Dez): Dez => { // Newton auf a*10^30, Ergebnis abgeschnitten
  if (a <= 0n) return 0n; const n = a * SKALA; let x = n; let y = (x + 1n) / 2n;
  while (y < x) { x = y; y = (x + n / x) / 2n; } return x;
};
/** kaufmaennisch half-up auf ganze Zahl (fuer positive und negative Werte: weg von 0) */
export const rundGanz = (a: Dez): bigint => (a >= 0n ? (a + SKALA / 2n) / SKALA : -((-a + SKALA / 2n) / SKALA));
const rundZehntel = (a: Dez): Dez => rundGanz(a * 10n) * SKALA / 10n;
const potenz = (b: Dez, e: number): Dez => { let r = SKALA; const n = Math.abs(e); for (let i = 0; i < n; i++) r = mul(r, b); return e >= 0 ? r : div(SKALA, r); };
const zeig = (a: Dez, stellen = 1): string => { const r = rundGanz(a * 10n ** BigInt(stellen)); const s = (r < 0n ? -r : r).toString().padStart(stellen + 1, "0"); return (r < 0n ? "-" : "") + s.slice(0, -stellen) + "." + s.slice(-stellen); };

// ---------- Eingabe ----------
export interface LebensdauerBand { min: string; mittel: string; max: string }
export interface Angabe { quelle_art: "manuell" | "ki" | "import" | "abgeleitet"; status: "vorgeschlagen" | "bestaetigt" | "verworfen" | "ersetzt"; dokumentart?: "datenblatt" | "protokoll" | "liste"; jahre?: string; stunden?: string; entschieden_am?: string; id: string }
export interface Elementtyp { id: string; katalog_id: string; gruppe: string; lebensdauer_tabelle: LebensdauerBand & { quelle: "planora_standard" | "manuell" }; planora_standard: LebensdauerBand; angaben_lebensdauer: Angabe[]; betriebsstunden_pro_jahr?: string; nutzungsgrenze?: string; ampel_gelb_jahre?: number; preis?: { rappen: string; preisjahr: number } | null }
export interface Element { id: string; gebaeude: string; typ_id: string; menge: number; einbaujahr?: number | null; angaben_lebensdauer: Angabe[]; betriebsstunden_pro_jahr?: string; bewertung?: { jahr: number; zustandswert: string } | null; geplantes_jahr?: number | null }
export interface Eingabe { regelwerk_version: "zhaw_v1-spike"; stichtag_jahr: number; horizont: 10 | 20; uebergabejahr: Record<string, number | null>; parameter: { knick: string; nutzungsgrenze_default: string; teuerung: string; ampel_gelb_default: number; betriebsstunden_default?: string }; typen: Elementtyp[]; elemente: Element[] }

// ---------- Lebensdauer-Rangfolge (03 Kap. 8.1) ----------
interface LdErgebnis { band: { min: Dez; mittel: Dez; max: Dez }; rang: 1 | 2 | 3 | 4; weg: string[] }
const bestaetigt = (a: Angabe[]) => a.filter((x) => x.status === "bestaetigt").sort((x, y) => cmp(y.entschieden_am ?? "", x.entschieden_am ?? "") || cmp(x.id, y.id));
function stundenZuJahren(stunden: string, ha: string | undefined, weg: string[]): Dez | null {
  if (!ha) { weg.push(`${stunden} h ohne Betriebsstunden/Jahr: nicht verwendbar`); return null; }
  const j = rundZehntel(div(dez(stunden), dez(ha)));
  weg.push(`${stunden} h / ${ha} h/a = ${zeig(j)} J.`); return j;
}
function skaliert(wert: Dez, std: LebensdauerBand) {
  const m = dez(std.mittel);
  return { min: div(mul(wert, dez(std.min)), m), mittel: wert, max: div(mul(wert, dez(std.max)), m) };
}
export function lebensdauer(el: Element, typ: Elementtyp, p: Eingabe["parameter"]): LdErgebnis {
  const weg: string[] = []; const ha = el.betriebsstunden_pro_jahr ?? typ.betriebsstunden_pro_jahr ?? p.betriebsstunden_default;
  // Rang 1: manuell am Element
  for (const a of bestaetigt(el.angaben_lebensdauer).filter((x) => x.quelle_art === "manuell")) {
    const w = a.jahre ? dez(a.jahre) : a.stunden ? stundenZuJahren(a.stunden, ha, weg) : null;
    if (w !== null) { weg.push(`Rang 1 manuell am Element: ${zeig(w)} J.`); return { band: skaliert(w, typ.planora_standard), rang: 1, weg }; }
  }
  // Rang 2: Lebensdauer-Tabelle des Mandanten, manuell angepasst
  if (typ.lebensdauer_tabelle.quelle === "manuell") {
    const t = typ.lebensdauer_tabelle; weg.push(`Rang 2 Lebensdauer-Tabelle manuell: ${t.mittel} J.`);
    return { band: { min: dez(t.min), mittel: dez(t.mittel), max: dez(t.max) }, rang: 2, weg };
  }
  // Rang 3: Herstellerdatenblatt am Typ (nur bestaetigt)
  for (const a of bestaetigt(typ.angaben_lebensdauer).filter((x) => x.dokumentart === "datenblatt" && x.quelle_art !== "manuell")) {
    const w = a.jahre ? dez(a.jahre) : a.stunden ? stundenZuJahren(a.stunden, ha, weg) : null;
    if (w !== null) { weg.push(`Rang 3 Datenblatt: ${zeig(w)} J.`); return { band: skaliert(w, typ.planora_standard), rang: 3, weg }; }
  }
  const t = typ.lebensdauer_tabelle; weg.push(`Rang 4 Planora-Standard: ${t.mittel} J.`);
  return { band: { min: dez(t.min), mittel: dez(t.mittel), max: dez(t.max) }, rang: 4, weg };
}

// ---------- ZHAW-Kurve (03 Kap. 8.3) ----------
const Z04 = dez("0.4"); const Z06 = dez("0.6");
export function zustand(a: Dez, L: Dez, k: Dez, g: Dez): Dez {
  const ak = mul(k, L);
  if (a <= ak) return SKALA - div(mul(Z06, a), ak);
  const q = div(a - ak, L - ak); return Z04 - mul(Z04 - g, mul(q, q));
}
export function aequivalenzalter(z: Dez, L: Dez, k: Dez, g: Dez): Dez {
  const ak = mul(k, L);
  if (z >= Z04) return div(mul(ak, SKALA - z), Z06);
  if (z > g) return ak + mul(L - ak, sqrt(div(Z04 - z, Z04 - g)));
  return L;
}
function ersatzjahr(E: number | null | undefined, bew: Element["bewertung"], L: Dez, k: Dez, g: Dez): { j: number | null; weg: string } {
  if (bew) { const a = aequivalenzalter(dez(bew.zustandswert), L, k, g); const rl = L - a; const r = Number(rundGanz(rl < 0n ? 0n : rl)); return { j: bew.jahr + r, weg: `Bewertung ${bew.jahr} z=${bew.zustandswert} -> Aequivalenzalter ${zeig(a, 2)} J., RL ${zeig(rl, 2)} -> ${bew.jahr}+${r}` }; }
  if (E == null) return { j: null, weg: "kein Einbaujahr, keine Bewertung: unvollstaendig" };
  const r = Number(rundGanz(L)); return { j: E + r, weg: `${E} + rund(${zeig(L)}) = ${E + r}` };
}

// ---------- Ergebnis ----------
export interface Ereignis { element: string; gebaeude: string; gruppe: string; katalog_id: string; jahr: number; zyklus: number; ueberfaellig_seit: number | null; kosten_rappen: string | null }
export interface Zeile { element: string; status: "ok" | "unvollstaendig"; lebensdauer_rang: number | null; L_mittel: string | null; J1: number | null; J1_frueh: number | null; J1_spaet: number | null; J_effektiv: number | null; RL: number | null; ampel: "rot" | "gelb" | "gruen" | "grau"; rechenweg: string[] }
export interface Ergebnis { regelwerk_version: string; eingabe_hash: string; zeilen: Zeile[]; ereignisse: Ereignis[]; plan: Record<string, Record<string, string>>; summe_rappen: string; ohne_kosten: number }

export function kanonisch(x: unknown): string {
  if (Array.isArray(x)) return "[" + x.map(kanonisch).join(",") + "]";
  if (x && typeof x === "object") return "{" + Object.keys(x).sort().map((k) => JSON.stringify(k) + ":" + kanonisch((x as any)[k])).join(",") + "}";
  return JSON.stringify(x);
}

export function berechne(e: Eingabe): Ergebnis {
  const p = e.parameter; const s = e.stichtag_jahr; const k = dez(p.knick); const i = dez(p.teuerung);
  const typen = new Map(e.typen.map((t) => [t.id, t]));
  // stabile Reihenfolge: Gebaeude, Gruppe, Katalog-ID, Element-ID (03 Kap. 8.7)
  const els = [...e.elemente].sort((a, b) => {
    const ta = typen.get(a.typ_id)!, tb = typen.get(b.typ_id)!;
    return cmp(a.gebaeude, b.gebaeude) || cmp(ta.gruppe, tb.gruppe) || cmp(ta.katalog_id, tb.katalog_id) || cmp(a.id, b.id);
  });
  const zeilen: Zeile[] = []; const ereignisse: Ereignis[] = [];
  for (const el of els) {
    const typ = typen.get(el.typ_id)!; const g = dez(typ.nutzungsgrenze ?? p.nutzungsgrenze_default);
    const ld = lebensdauer(el, typ, p); const weg = [...ld.weg];
    const E = el.einbaujahr ?? e.uebergabejahr[el.gebaeude] ?? null;
    if (el.einbaujahr == null && E != null) weg.push(`Einbaujahr abgeleitet = Uebergabejahr ${E}`);
    const m = ersatzjahr(E, el.bewertung, ld.band.mittel, k, g); weg.push(m.weg);
    if (m.j === null) { zeilen.push({ element: el.id, status: "unvollstaendig", lebensdauer_rang: ld.rang, L_mittel: zeig(ld.band.mittel), J1: null, J1_frueh: null, J1_spaet: null, J_effektiv: null, RL: null, ampel: "grau", rechenweg: weg }); continue; }
    const fr = ersatzjahr(E, el.bewertung, ld.band.min, k, g).j!; const sp = ersatzjahr(E, el.bewertung, ld.band.max, k, g).j!;
    const J = el.geplantes_jahr ?? m.j; const N = typ.ampel_gelb_jahre ?? p.ampel_gelb_default;
    const ampel = J <= s ? "rot" : J <= s + N ? "gelb" : "gruen";
    zeilen.push({ element: el.id, status: "ok", lebensdauer_rang: ld.rang, L_mittel: zeig(ld.band.mittel), J1: m.j, J1_frueh: fr, J1_spaet: sp, J_effektiv: J, RL: Math.max(0, m.j - s), ampel, rechenweg: weg });
    // Zyklen (03 Kap. 8.4): Folgejahre ab J(n) mit L_neu = L_mittel der Lebensdauer-Tabelle
    const Lneu = Number(rundGanz(dez(typ.lebensdauer_tabelle.mittel)));
    let Jn = J; let n = 1;
    while (Jn <= s + e.horizont - 1) {
      const planJahr = Jn < s ? s : Jn;
      let kosten: string | null = null;
      if (typ.preis) { const f = potenz(SKALA + i, planJahr - typ.preis.preisjahr); kosten = rundGanz(mul(dez(typ.preis.rappen) * BigInt(el.menge), f)).toString(); }
      ereignisse.push({ element: el.id, gebaeude: el.gebaeude, gruppe: typ.gruppe, katalog_id: typ.katalog_id, jahr: planJahr, zyklus: n, ueberfaellig_seit: Jn < s ? Jn : null, kosten_rappen: kosten });
      if (Lneu <= 0) break; Jn += Lneu; n++;
    }
  }
  const plan: Record<string, Record<string, string>> = {}; let summe = 0n; let ohne = 0;
  for (const ev of ereignisse) {
    if (ev.kosten_rappen === null) { ohne++; continue; }
    const key = `${ev.gebaeude}|${ev.gruppe}`; plan[key] ??= {};
    plan[key][ev.jahr] = (BigInt(plan[key][ev.jahr] ?? "0") + BigInt(ev.kosten_rappen)).toString(); summe += BigInt(ev.kosten_rappen);
  }
  const eingabe_hash = createHash("sha256").update(kanonisch(e)).digest("hex");
  return { regelwerk_version: e.regelwerk_version, eingabe_hash, zeilen, ereignisse, plan, summe_rappen: summe.toString(), ohne_kosten: ohne };
}
