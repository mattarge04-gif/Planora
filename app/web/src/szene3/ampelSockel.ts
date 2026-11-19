import { TOKENS } from "../design/tokens";
import { AMPEL_FARBE, AMPEL_RANG } from "../lebensdauer/ansicht";
import type { Ampel } from "../lebensdauer/typen";
import type { Bereich, V3 } from "../szene2/huelle";

/**
 * Modus Erneuerung (Runde 2, Kritik 19.11.): Ampel als Bildschirm-Marker konstanter Pixelgrösse (Fläche nach
 * Dringlichkeit) plus schmaler Bodenring konstanter Breite. Reine, deterministische Ableitungen; Werte aus TOKENS.erneuerung.
 */
const E = TOKENS.erneuerung;
const AMPEL_JE_FARBE = new Map(Object.entries(AMPEL_FARBE).map(([a, f]) => [f.toLowerCase(), a as Ampel]));

/** Ampelstufe zu einer Ampelfarbe (Hex aus AMPEL_FARBE); unbekannt -> grau. */
export function ampelVonFarbe(farbe: string): Ampel {
  return AMPEL_JE_FARBE.get(farbe.toLowerCase()) ?? "grau";
}

/** Eine Anlage mit Ampel (Achsmasse in Einbaulage). */
export interface AmpelAnlage { schluessel: string; mitte: V3; masse: V3; inline: boolean; farbe: string }
export interface Strich { position: V3; laenge: number; achse: "x" | "z"; farbe: string }

/**
 * Bodenring je stehender Anlage: vier Streifen konstanter Breite mit Abstand zum Grundriss; «Baujahr fehlt»
 * gestrichelt (Form statt nur Farbe). Teile in der Leitung erhalten keinen Ring (nur den Marker).
 */
export function ampelRinge(anlagen: AmpelAnlage[], bodenY: number, breite: number = E.ringBreiteM): Strich[] {
  const y = bodenY + E.ringBodenM + E.ringHoeheM / 2, striche: Strich[] = [], gesehen = new Set<string>();
  // Dringendere Ringe zuletzt: bei Überlappung liegen sie oben (gleiche Höhe, Zeichenreihenfolge).
  const sortiert = [...anlagen].sort((a, b) => AMPEL_RANG[ampelVonFarbe(a.farbe)] - AMPEL_RANG[ampelVonFarbe(b.farbe)]);
  for (const a of sortiert) {
    if (a.inline || gesehen.has(a.schluessel)) continue;
    gesehen.add(a.schluessel);
    const grau = ampelVonFarbe(a.farbe) === "grau";
    const aussenX = a.masse[0] + 2 * (E.ringAbstandM + breite), aussenZ = a.masse[2] + 2 * (E.ringAbstandM + breite);
    const [x, , z] = a.mitte;
    for (const [achse, laenge, fest] of [["x", aussenX, aussenZ], ["z", aussenZ - 2 * breite, aussenX]] as const) {
      const teile = grau ? striche1D(laenge, breite / E.ringBreiteM) : [[0, laenge] as [number, number]];
      for (const seite of [-1, 1]) for (const [m, l] of teile) {
        const quer = seite * (fest / 2 - breite / 2);
        striche.push({ achse, laenge: l, farbe: a.farbe, position: achse === "x" ? [x + m, y, z + quer] : [x + quer, y, z + m] });
      }
    }
  }
  return striche;
}

/** Striche entlang einer Strecke der Länge `laenge` (zentriert): beide Enden voll, Lücken gleichmässig verteilt. */
export function striche1D(laenge: number, k = 1): [number, number][] {
  const s = E.strichM * Math.max(1, k), l = E.lueckeM * Math.max(1, k);
  if (laenge <= s * 1.5) return [[0, laenge]];
  const n = Math.max(2, Math.round((laenge + l) / (s + l)));
  const strich = (laenge - (n - 1) * l) / n;
  return Array.from({ length: n }, (_, i) => [-laenge / 2 + strich / 2 + i * (strich + l), strich]);
}

/** Ringbreite aus dem orthografischen Zoom (px pro Meter): nah konstant in Metern, aus der Distanz Mindest-px, gedeckelt; auf 5 mm gerundet. */
export function ringBreite(zoom: number): number {
  const px = zoom > 0 ? E.ringBreitePx / zoom : 0;
  return Math.round(Math.min(E.ringBreiteMaxM, Math.max(E.ringBreiteM, px)) * 200) / 200;
}

export interface Marker { schluessel: string; anker: V3; geschossId: string; inline: boolean; ampel: Ampel; farbe: string; px: number }

/** Marker je Anlage über der Oberkante; nach Dringlichkeit aufsteigend sortiert (Rot wird zuletzt, also oben gezeichnet). */
export function ampelMarker(anlagen: (AmpelAnlage & { geschossId: string })[]): Marker[] {
  const gesehen = new Set<string>(), eindeutig: typeof anlagen = [];
  for (const a of anlagen) {
    const k = `${a.schluessel}:${a.mitte.join(":")}`;
    if (!gesehen.has(k)) { gesehen.add(k); eindeutig.push(a); }
  }
  return eindeutig.map((a) => {
      const ampel = ampelVonFarbe(a.farbe);
      return { schluessel: a.schluessel, geschossId: a.geschossId, inline: a.inline, ampel, farbe: AMPEL_FARBE[ampel], px: E.markerPx[ampel],
        anker: [a.mitte[0], a.mitte[1] + a.masse[1] / 2, a.mitte[2]] as V3 };
    })
    .sort((a, b) => AMPEL_RANG[a.ampel] - AMPEL_RANG[b.ampel] || a.schluessel.localeCompare(b.schluessel));
}

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
