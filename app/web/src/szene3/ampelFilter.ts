import { TOKENS } from "../design/tokens";
import type { Ampel } from "../lebensdauer/typen";
import type { Bereich, V3 } from "../szene2/huelle";
import { bereichWeiten, type AmpelAnlage } from "./ampelSockel";

/**
 * Legende als Filter im 3D (Entscheid 22.11.2026, Ansatz C Stufe 3; PO: mehrere Filter kombinierbar, ODER). Twin bildet
 * aus den gewählten Legendenposten die Trefferschlüssel; die Szene hebt hervor, dimmt den Rest und rahmt die Treffer.
 * Reine, deterministische Ableitungen.
 */
const F = TOKENS.erneuerung.filter;

export type FilterStufe = Ampel | "ohnePreis";
export interface AmpelFilter {
  /** Symbol-Schlüssel der Treffer (wie in `ampel`): voll, mit Auswahlumriss; alle übrigen treten zurück. */
  treffer: ReadonlySet<string>;
  /** Symbol-Schlüssel mit grauer Banderole an der Manschette («ohne Preis», «Baujahr fehlt»; Kritik r6 statt Anhänger). */
  anhaenger: ReadonlySet<string>;
  /** Gewählte Stufen: Pegelband-Segmente dieser Stufen voll, übrige zurück. «ohnePreis» hat kein Segment. */
  stufen: ReadonlySet<FilterStufe>;
}

/** Hex-Farbe auf `deckkraft` zurückgenommen: zu `grund` gemischt (keine Abdunkelung, Regel 7). */
export function zurueck(hex: string, deckkraft: number = F.deckkraft, grund: string = TOKENS.farbe.grund): string {
  const a = parseInt(hex.slice(1), 16), b = parseInt(grund.slice(1), 16);
  const k = (x: number, y: number) => Math.round(x * deckkraft + y * (1 - deckkraft));
  const r = k(a >> 16, b >> 16), g = k((a >> 8) & 255, (b >> 8) & 255), bl = k(a & 255, b & 255);
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, "0")}`;
}

/** Ist ein Schlüssel im Filter zurückgenommen? Ohne Filter nie. */
export const istZurueck = (filter: AmpelFilter | null | undefined, schluessel: string) => !!filter && !filter.treffer.has(schluessel);

/** Pegelband: Segment voll? Ohne Filter immer. */
export const segmentVoll = (filter: AmpelFilter | null | undefined, ampel: Ampel) => !filter || filter.stufen.has(ampel);

/**
 * Kamerabereich der Treffer: Hüllbox, Grundriss nur auf filter.kameraMinM erweitert, damit die Treffer das Bild füllen
 * (Kritik r5: >= 55 % der freien Breite statt Raumdistanz); null ohne Treffer.
 */
export function trefferBereich(anlagen: AmpelAnlage[], treffer: ReadonlySet<string>, minM: number = F.kameraMinM): Bereich | null {
  return bereichWeiten(anlagen.filter((a) => treffer.has(a.schluessel)), minM);
}

/** Gemerkter Bereich einer Fokusfahrt: gilt, bis sich der Filter ändert oder aufgehoben wird. */
export interface FokusMerker { filterKey: string; bereich: Bereich }

/**
 * Bereich der Fokusfahrt (Kritik r7): bei `fahrt` der neue Einzelbereich; endet die Fahrt (Maus-Hover nach Tastatur),
 * bleibt der gemerkte Bereich, solange der Filter gleich ist – kein Rücksprung auf Geschossdistanz. Ohne Filter null.
 */
export function fokusFahrtBereich(gemerkt: FokusMerker | null, filterKey: string, fahrt: boolean, neu: Bereich | null): FokusMerker | null {
  if (!filterKey) return null;
  if (fahrt && neu) return { filterKey, bereich: neu };
  return gemerkt && gemerkt.filterKey === filterKey ? gemerkt : null;
}

/**
 * Skalierung eines Umrisses (BackSide-Hülle um die Bauteilmitte), damit er etwa `px` Bildschirmpixel breit erscheint;
 * Bezug ist die grösste Achse (Mindestzuschlag 1 %).
 */
export function umrissSkala(masse: V3, zoom: number, px: number): number {
  const gross = Math.max(...masse, 1e-3);
  return zoom > 0 ? Math.max(1.01, 1 + (2 * px) / (zoom * gross)) : 1.04;
}
