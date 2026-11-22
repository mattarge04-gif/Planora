import { Color } from "three";
import { TOKENS } from "../design/tokens";
import { AMPEL_FARBE, AMPEL_RANG } from "../lebensdauer/ansicht";
import type { Ampel } from "../lebensdauer/typen";
import type { Bereich, V3 } from "../szene2/huelle";

/**
 * Modus Erneuerung: gemeinsame Ableitungen der Ampel im 3D (Stufe aus Farbe, Kamerabereich, Farbtreue nach F9).
 * Die Darstellung am Bauteil liegt in manschette.ts (Entscheid 22.11.2026). Werte aus TOKENS.erneuerung.
 */
const E = TOKENS.erneuerung;
const AMPEL_JE_FARBE = new Map(Object.entries(AMPEL_FARBE).map(([a, f]) => [f.toLowerCase(), a as Ampel]));

/** Ampelstufe zu einer Ampelfarbe (Hex aus AMPEL_FARBE); unbekannt -> grau. */
export function ampelVonFarbe(farbe: string): Ampel {
  return AMPEL_JE_FARBE.get(farbe.toLowerCase()) ?? "grau";
}

/** Eine Anlage mit Ampel (Achsmasse in Einbaulage). */
export interface AmpelAnlage { schluessel: string; mitte: V3; masse: V3; inline: boolean; farbe: string }

/**
 * Kamerabereich beim Einschalten: die dringendsten Anlagen (Rot, sonst Gelb, sonst alle mit Ampel), auf mindestens
 * `kameraMinM` je Grundrissachse erweitert, damit die Umgebung lesbar bleibt. Null ohne Anlage.
 */
export function ampelBereich(anlagen: AmpelAnlage[]): Bereich | null {
  if (!anlagen.length) return null;
  const rang = (a: AmpelAnlage) => AMPEL_RANG[ampelVonFarbe(a.farbe)];
  const max = Math.max(...anlagen.map(rang));
  // Rot oder Gelb rahmen; nur Grün/Grau -> alle.
  const auswahl = max >= AMPEL_RANG.gelb ? anlagen.filter((a) => rang(a) >= AMPEL_RANG.gelb) : anlagen;
  const b: Bereich = { xMin: Infinity, xMax: -Infinity, yMin: Infinity, yMax: -Infinity, zMin: Infinity, zMax: -Infinity };
  for (const a of auswahl) {
    b.xMin = Math.min(b.xMin, a.mitte[0] - a.masse[0] / 2); b.xMax = Math.max(b.xMax, a.mitte[0] + a.masse[0] / 2);
    b.yMin = Math.min(b.yMin, a.mitte[1] - a.masse[1] / 2); b.yMax = Math.max(b.yMax, a.mitte[1] + a.masse[1] / 2);
    b.zMin = Math.min(b.zMin, a.mitte[2] - a.masse[2] / 2); b.zMax = Math.max(b.zMax, a.mitte[2] + a.masse[2] / 2);
  }
  const weiten = (min: number, max: number): [number, number] => {
    const fehlt = E.kameraMinM - (max - min);
    return fehlt > 0 ? [min - fehlt / 2, max + fehlt / 2] : [min, max];
  };
  [b.xMin, b.xMax] = weiten(b.xMin, b.xMax);
  [b.zMin, b.zMax] = weiten(b.zMin, b.zMax);
  return b;
}

/** Neutral-Tone-Mapping von three/postprocessing (Khronos PBR Neutral), linear -> linear; nur zur Prüfung und Umkehr. */
export function neutralToneMapping([r, g, b]: [number, number, number]): [number, number, number] {
  const x = Math.min(r, g, b), offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  const c: [number, number, number] = [r - offset, g - offset, b - offset];
  const peak = Math.max(...c), start = 0.8 - 0.04;
  if (peak < start) return c;
  const d = 1 - start, neu = 1 - (d * d) / (peak + d - start), k = neu / peak;
  const f = 1 - 1 / (0.15 * (peak - neu) + 1);
  return c.map((v) => v * k * (1 - f) + neu * f) as [number, number, number];
}

/**
 * Lineare Farbe, die nach dem Neutral-Tone-Mapping des Effektdurchlaufs genau `linear` ergibt (Kritik 19.11.: der
 * ToneMapping-Effekt wirkt auch auf `toneMapped={false}`-Materialien und dunkelte Ampelringe ab). Gültig unterhalb der
 * Kompressionsschwelle (alle Ampeltöne).
 */
export function vorNeutralToneMapping([r, g, b]: [number, number, number]): [number, number, number] {
  const min = Math.min(r, g, b);
  const offset = min >= 0.04 ? 0.04 : (() => { const m = Math.sqrt(min / 6.25); return m - 6.25 * m * m; })();
  return [r + offset, g + offset, b + offset];
}

/**
 * Lineare Materialfarbe einer Ampelstufe für ungetönte MeshBasic-Flächen: mit Effektdurchlauf um Neutral-Tone-Mapping und
 * Umgebungsverdeckung vorab korrigiert (F9, aoAusgleich), sonst die Tokenfarbe.
 */
export function ampelMaterialFarbe(farbe: string, effekte: boolean): [number, number, number] {
  const c = new Color(farbe);
  if (!effekte) return [c.r, c.g, c.b];
  return vorNeutralToneMapping([c.r, c.g, c.b]).map((x) => x * TOKENS.erneuerung.manschette.aoAusgleich) as [number, number, number];
}
