import { TOKENS } from "../design/tokens";
import type { Ampel } from "../lebensdauer/typen";
import type { V3 } from "../szene2/huelle";
import type { Rechteck } from "../typen";

/**
 * Pegelband (Entscheid 22.11.2026, Ansatz C Stufe 2): Die Stirn der Bodenplatte jedes Geschosses trägt ein Band, segmentiert
 * nach den Anteilen der Ampelstufen der Bauteile dieses Geschosses (Dringendstes links). Reine, deterministische Ableitungen.
 */
const P = TOKENS.erneuerung.pegel;
/** Reihenfolge wie die Legende (karten/TwinErneuerung): Dringendstes links. */
export const PEGEL_FOLGE: Ampel[] = ["rot", "gelb", "gruen", "grau"];
/** Überstand der Bodenplatte über den Grundriss (Gebaeude3: Platte breite + 0.3). */
export const PLATTE_UEBERSTAND = 0.15;
export const PLATTE_DICKE = 0.25;

export type Zaehler = Record<Ampel, number>;
export const leer = (): Zaehler => ({ rot: 0, gelb: 0, gruen: 0, grau: 0 });

/** Zähler je Geschoss aus Ampelstufe und Geschoss je Bauteil (Symbol). */
export function pegelZaehler(eintraege: { geschossId: string | null | undefined; ampel: Ampel }[]): Map<string, Zaehler> {
  const z = new Map<string, Zaehler>();
  for (const e of eintraege) {
    if (!e.geschossId) continue;
    const r = z.get(e.geschossId) ?? leer();
    r[e.ampel]++;
    z.set(e.geschossId, r);
  }
  return z;
}

export interface Segment { ampel: Ampel; von: number; bis: number }

/**
 * Segmente als Anteile [von, bis] der Bandlänge 0..1, Reihenfolge PEGEL_FOLGE. Jede vorhandene Stufe erhält mindestens
 * `minAnteil`, der Rest proportional zur Anzahl; zwischen Segmenten `luecke` (Anteil).
 */
export function pegelSegmente(z: Zaehler, minAnteil: number = P.minAnteil, luecke = 0): Segment[] {
  const da = PEGEL_FOLGE.filter((a) => z[a] > 0);
  if (!da.length) return [];
  const netto = 1 - luecke * (da.length - 1), summe = da.reduce((s, a) => s + z[a], 0);
  // Mindestanteile iterativ festlegen: Stufen unter dem Minimum erhalten es, der Rest teilt sich den verbleibenden Platz.
  const anteil = new Map<Ampel, number>();
  let frei = da, rest = netto, restSumme = summe;
  for (let runde = 0; runde < da.length; runde++) {
    const klein = frei.filter((a) => (z[a] / restSumme) * rest < minAnteil * netto);
    if (!klein.length) break;
    for (const a of klein) { anteil.set(a, Math.min(minAnteil * netto, netto / da.length)); rest -= anteil.get(a)!; restSumme -= z[a]; }
    frei = frei.filter((a) => !klein.includes(a));
  }
  for (const a of frei) anteil.set(a, restSumme > 0 ? (z[a] / restSumme) * rest : 0);
  let x = 0;
  return da.map((a) => {
    const s = { ampel: a, von: x, bis: x + anteil.get(a)! };
    x = s.bis + luecke;
    return s;
  });
}

/** Stirnfläche, die das Band trägt: Ebene (Weltkoordinate der Achse senkrecht zur Stirn), Lauf links -> rechts am Bildschirm. */
export interface Stirn {
  /** Achse der Flächennormalen. */ normale: "x" | "z";
  /** Vorzeichen der Normalen. */ seite: 1 | -1;
  /** Koordinate der Stirnfläche (inkl. Plattenüberstand). */ ebene: number;
  /** Anfang (links am Bildschirm) und Ende entlang der Laufachse. */ start: number; ende: number;
}

/**
 * Kameraseitige Stirn der Bodenplatte: von den beiden zur Kamera zeigenden Seiten die längere Aussenkante (Grundriss aus
 * Rechtecken; massgeblich ist die äusserste Kante je Seite). `kamera`: Seiten der Kamera (schnitt.kameraSeiten, ±1).
 */
export function pegelStirn(grundriss: Rechteck[], kamera: V3, ueberstand = PLATTE_UEBERSTAND): Stirn | null {
  if (!grundriss.length) return null;
  const sx = kamera[0] >= 0 ? 1 : -1, sz = kamera[2] >= 0 ? 1 : -1;
  // Bildschirm-rechts einer Kamera aus Richtung (sx, sz) mit Blick auf das Ziel: (sz, 0, -sx).
  const rechts = { x: sz, z: -sx };
  const kanten: (Stirn & { laenge: number })[] = [];
  for (const normale of ["x", "z"] as const) {
    const seite = (normale === "x" ? sx : sz) as 1 | -1;
    const lage = (r: Rechteck) => normale === "x" ? (seite > 0 ? r.x + r.breite : r.x) : (seite > 0 ? r.z + r.tiefe : r.z);
    const aussen = Math.max(...grundriss.map((r) => seite * lage(r)));
    const traeger = grundriss.filter((r) => Math.abs(seite * lage(r) - aussen) < 1e-6);
    const lauf = (r: Rechteck): [number, number] => normale === "x" ? [r.z, r.z + r.tiefe] : [r.x, r.x + r.breite];
    const a = Math.min(...traeger.map((r) => lauf(r)[0])) - ueberstand, b = Math.max(...traeger.map((r) => lauf(r)[1])) + ueberstand;
    const richtung = normale === "x" ? rechts.z : rechts.x;
    kanten.push({ normale, seite, ebene: seite * aussen + seite * ueberstand, start: richtung >= 0 ? a : b, ende: richtung >= 0 ? b : a,
      laenge: b - a });
  }
  const k = kanten[0].laenge >= kanten[1].laenge - 1e-6 ? kanten[0] : kanten[1];
  return { normale: k.normale, seite: k.seite, ebene: k.ebene, start: k.start, ende: k.ende };
}

/** Bandhöhe aus dem Zoom (px pro Meter): nah hoeheM, aus der Distanz minPx, höchstens maxM. */
export function pegelHoehe(zoom: number): number {
  const px = zoom > 0 ? P.minPx / zoom : P.maxM;
  return Math.round(Math.min(P.maxM, Math.max(P.hoeheM, px)) * 1000) / 1000;
}

/**
 * Quader eines Bandstücks: Segmentanteile [von, bis] (0..1) auf der Stirn, Mitte der Plattenstirn bei `yMitte`. Segmente
 * liegen eine Bandtiefe vor dem Träger (`zurueck` = −tiefeM legt den Träger direkt auf abstandM vor die Stirn).
 */
export function pegelQuader(stirn: Stirn, von: number, bis: number, yMitte: number, hoehe: number, zurueck = 0): { mitte: V3; groesse: V3 } {
  const s0 = stirn.start + Math.sign(stirn.ende - stirn.start) * P.randM, s1 = stirn.ende - Math.sign(stirn.ende - stirn.start) * P.randM;
  const a = s0 + (s1 - s0) * von, b = s0 + (s1 - s0) * bis, mitteLauf = (a + b) / 2, laenge = Math.abs(b - a);
  const vor = stirn.ebene + stirn.seite * (P.abstandM + P.tiefeM / 2 + P.tiefeM + zurueck);
  return stirn.normale === "x"
    ? { mitte: [vor, yMitte, mitteLauf], groesse: [P.tiefeM, hoehe, laenge] }
    : { mitte: [mitteLauf, yMitte, vor], groesse: [laenge, hoehe, P.tiefeM] };
}

/** Bandlänge zwischen den Rändern. */
export const bandLaenge = (stirn: Stirn) => Math.max(0, Math.abs(stirn.ende - stirn.start) - 2 * P.randM);

/** Stücke eines Segments: Grau gestrichelt (Strich max(strichM, 2 × Bandhöhe), Anteil 0.5), sonst eines; Anteile der Bandlänge. */
export function segmentStuecke(seg: Segment, laenge: number, hoehe: number): [number, number][] {
  if (seg.ampel !== "grau" || laenge <= 0) return [[seg.von, seg.bis]];
  const strich = Math.max(P.strichM, 2 * hoehe) / laenge, schritt = 2 * strich, stuecke: [number, number][] = [];
  for (let x = seg.von; x < seg.bis - 1e-9; x += schritt) stuecke.push([x, Math.min(seg.bis, x + strich)]);
  return stuecke;
}
