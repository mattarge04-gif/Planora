// Gemeinsame Test-Hilfen und Zufallsgenerator fuer S10 (seeded, deterministisch).
import { createHash } from "node:crypto";
import { berechne, kanonisch, type Eingabe, type Elementtyp, type Element, type Angabe } from "./kern.ts";
export const PARAM = { knick: "0.75", nutzungsgrenze_default: "0.25", teuerung: "0.01", ampel_gelb_default: 3, betriebsstunden_default: "2500" };
export const typ = (o: Partial<Elementtyp> & { L: string }): Elementtyp => ({
  id: o.id ?? "T", katalog_id: o.katalog_id ?? "leuchte.panel", gruppe: o.gruppe ?? "Elektro",
  lebensdauer_tabelle: o.lebensdauer_tabelle ?? { min: o.L, mittel: o.L, max: o.L, quelle: "planora_standard" },
  planora_standard: o.planora_standard ?? { min: o.L, mittel: o.L, max: o.L },
  angaben_lebensdauer: o.angaben_lebensdauer ?? [], preis: o.preis ?? null, betriebsstunden_pro_jahr: o.betriebsstunden_pro_jahr,
});
export const eingabe = (typen: Elementtyp[], elemente: Element[], extra: Partial<Eingabe> = {}): Eingabe => ({
  regelwerk_version: "zhaw_v1-spike", stichtag_jahr: 2026, horizont: 20, uebergabejahr: { G1: null }, parameter: { ...PARAM }, typen, elemente, ...extra,
});
export const ang = (o: Partial<Angabe>): Angabe => ({ id: o.id ?? "a", quelle_art: o.quelle_art ?? "ki", status: o.status ?? "bestaetigt", dokumentart: o.dokumentart, jahre: o.jahre, stunden: o.stunden, entschieden_am: o.entschieden_am ?? "2026-01-01" });
export function prng(seed: number) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function zufallsEingabe(seed: number): Eingabe {
  const r = prng(seed); const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const typen: Elementtyp[] = []; const nt = 1 + Math.floor(r() * 4);
  for (let i = 0; i < nt; i++) {
    const L = (5 + Math.floor(r() * 400) / 10).toFixed(1); const lo = (Number(L) * 0.75).toFixed(1); const hi = (Number(L) * 1.25).toFixed(1);
    typen.push(typ({ id: `T${i}`, katalog_id: pick(["leuchte.panel", "pumpe.umwaelz", "lueftung.monoblock"]), gruppe: pick(["Elektro", "Heizung", "Lueftung"]), L,
      lebensdauer_tabelle: { min: lo, mittel: L, max: hi, quelle: r() < 0.3 ? "manuell" : "planora_standard" }, planora_standard: { min: lo, mittel: L, max: hi },
      angaben_lebensdauer: r() < 0.5 ? [ang({ dokumentart: "datenblatt", stunden: String(10000 + Math.floor(r() * 90000)), status: pick(["bestaetigt", "vorgeschlagen"]) })] : [],
      preis: r() < 0.8 ? { rappen: String(Math.floor(r() * 5_000_000)), preisjahr: 2020 + Math.floor(r() * 8) } : null }));
  }
  const elemente: Element[] = []; const ne = 1 + Math.floor(r() * 6);
  for (let i = 0; i < ne; i++) elemente.push({ id: `E${seed}-${i}`, gebaeude: pick(["G1", "G2"]), typ_id: `T${Math.floor(r() * nt)}`, menge: 1 + Math.floor(r() * 50),
    einbaujahr: r() < 0.15 ? null : 1980 + Math.floor(r() * 46), angaben_lebensdauer: r() < 0.2 ? [ang({ quelle_art: "manuell", jahre: String(3 + Math.floor(r() * 30)) })] : [],
    bewertung: r() < 0.4 ? { jahr: 2015 + Math.floor(r() * 12), zustandswert: (Math.floor(r() * 11) / 10).toFixed(1) } : null, geplantes_jahr: r() < 0.1 ? 2026 + Math.floor(r() * 10) : null });
  return eingabe(typen, elemente, { uebergabejahr: { G1: r() < 0.5 ? 2005 : null, G2: 2012 }, horizont: pick([10, 20] as const), parameter: { ...PARAM, teuerung: pick(["0.0", "0.01", "0.025"]) } });
}
export const N_ZUFALL = 10_000;
export function gesamtHash(n: number): string {
  const h = createHash("sha256"); for (let s = 1; s <= n; s++) h.update(kanonisch(berechne(zufallsEingabe(s)))); return h.digest("hex");
}
