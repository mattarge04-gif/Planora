import { TOKENS } from "../design/tokens";
import type { V3 } from "../szene2/huelle";

/** Eine Anlage mit Ampel im Modus Erneuerung (Achsmasse in Einbaulage). */
export interface SockelAnlage { schluessel: string; mitte: V3; masse: V3; inline: boolean; farbe: string; grau: boolean;
  /** Dringlichkeit (AMPEL_RANG): bei Überlappung liegt der höhere Rang oben. */
  rang?: number }
export interface Scheibe { schluessel: string; position: V3; breite: number; tiefe: number; farbe: string }
export interface Strich { position: V3; laenge: number; achse: "x" | "z" }

/**
 * Ampel am Boden: farbige Sockelscheibe unter jeder stehenden Anlage, «Baujahr fehlt» als gestrichelter Rand
 * (Form statt nur Farbe, analog CircleDashed). Teile in der Leitung erhalten keinen Sockel (nur die Hülle).
 * Rein und deterministisch; Werte aus TOKENS.erneuerung.
 */
export function ampelSockel(anlagen: SockelAnlage[], bodenY: number, rand: number = TOKENS.erneuerung.sockelRandM): { scheiben: Scheibe[]; striche: Strich[]; strichBreite: number } {
  const e = TOKENS.erneuerung, y0 = bodenY + e.sockelBodenM + e.sockelHoeheM / 2;
  const scheiben: Scheibe[] = [], striche: Strich[] = [];
  // Striche wachsen mit dem Rand (aus der Distanz breiter), damit «Baujahr fehlt» als gestrichelt lesbar bleibt.
  const k = Math.max(1, rand / e.sockelRandM), sb = e.strichBreiteM * k;
  const gesehen = new Set<string>();
  for (const a of anlagen) {
    if (a.inline || gesehen.has(a.schluessel)) continue;
    gesehen.add(a.schluessel);
    const breite = a.masse[0] + 2 * rand, tiefe = a.masse[2] + 2 * rand, y = y0 + (a.rang ?? 0) * e.rangVersatzM;
    const [x, , z] = a.mitte;
    if (!a.grau) { scheiben.push({ schluessel: a.schluessel, position: [x, y, z], breite, tiefe, farbe: a.farbe }); continue; }
    const r = sb / 2;
    for (const [achse, laenge, fest] of [["x", breite, tiefe], ["z", tiefe, breite]] as const) {
      for (const seite of [-1, 1]) for (const [mitte, l] of striche1D(laenge - sb, k)) {
        const quer = seite * (fest / 2 - r);
        striche.push({ achse, laenge: l, position: achse === "x" ? [x + mitte, y, z + quer] : [x + quer, y, z + mitte] });
      }
    }
  }
  return { scheiben, striche, strichBreite: sb };
}

/** Striche entlang einer Strecke der Länge `laenge` (zentriert): beide Enden voll, Lücken gleichmässig verteilt. */
export function striche1D(laenge: number, k = 1): [number, number][] {
  const s = TOKENS.erneuerung.strichM * k, l = TOKENS.erneuerung.lueckeM * k;
  if (laenge <= s * 1.5) return [[0, laenge]];
  const n = Math.max(2, Math.round((laenge + l) / (s + l)));
  const strich = (laenge - (n - 1) * l) / n;
  return Array.from({ length: n }, (_, i) => [-laenge / 2 + strich / 2 + i * (strich + l), strich]);
}

/**
 * Zuschläge je Seite aus dem orthografischen Zoom (px pro Meter): nah die Meterwerte, aus der Distanz mindestens
 * `…RandPx` Bildschirm-px, gedeckelt. Auf 1 cm gerundet, damit Geometrie nur bei spürbarem Zoomwechsel neu entsteht.
 */
export function ampelRaender(zoom: number): { sockel: number; huelle: number } {
  const e = TOKENS.erneuerung, px = (p: number) => (zoom > 0 ? p / zoom : 0);
  const runde = (m: number) => Math.round(m * 100) / 100;
  return {
    sockel: runde(Math.min(e.sockelRandMaxM, Math.max(e.sockelRandM, px(e.sockelRandPx)))),
    huelle: runde(Math.min(e.huelleRandMaxM, Math.max(e.huelleZuschlagM, px(e.huelleRandPx)))),
  };
}
