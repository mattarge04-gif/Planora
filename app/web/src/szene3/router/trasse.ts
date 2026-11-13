import type { Rechteck } from "../../typen";
import type { V3 } from "../../szene2/huelle";
import { SPUR } from "../gruppenNetz";
import { ROUTER } from "./typen";

export interface Lage { achse: 0 | 2; wand: number; innen: 1 | -1 }
export interface Auftrag { netz: string; von: number; bis: number }
const EPS = 1e-6;
const vergleich = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Trasse laeuft entlang der laengeren Raumseite an der Wand mit der kleinsten Abstandssumme zu den Anschluessen [A]. */
export function trassenLage(raum: Rechteck, punkte: V3[]): Lage {
  const achse: 0 | 2 = raum.breite >= raum.tiefe ? 0 : 2, q = achse === 0 ? 2 : 0;
  const w1 = achse === 0 ? raum.z : raum.x, w2 = achse === 0 ? raum.z + raum.tiefe : raum.x + raum.breite;
  const summe = (w: number) => punkte.reduce((s, p) => s + Math.abs(p[q] - w), 0);
  return summe(w2) < summe(w1) - EPS ? { achse, wand: w2, innen: -1 } : { achse, wand: w1, innen: 1 };
}
export const spurWert = (l: Lage, index: number) => +(l.wand + l.innen * (ROUTER.trasseWand + index * SPUR)).toFixed(6);

/**
 * Left-Edge fuer einseitige Anschluesse: Intervalle nach Laenge absteigend; umfassende Intervalle liegen wandnah,
 * enthaltene eine Spur weiter innen, disjunkte teilen sich eine Spur. Verschraenkte erhalten keine Spur (Rueckfall A*).
 */
export function spurenZuteilen(auftraege: Auftrag[]): Map<string, number> {
  const iv = auftraege.map((a) => ({ netz: a.netz, lo: Math.min(a.von, a.bis), hi: Math.max(a.von, a.bis) }))
    .sort((a, b) => (b.hi - b.lo) - (a.hi - a.lo) || vergleich(a.netz, b.netz));
  const gesetzt: { netz: string; lo: number; hi: number; spur: number }[] = [];
  for (const a of iv) {
    const enthalten = (x: { lo: number; hi: number }, y: { lo: number; hi: number }) => x.lo >= y.lo - EPS && x.hi <= y.hi + EPS;
    const verschraenkt = gesetzt.some((g) => Math.min(a.hi, g.hi) - Math.max(a.lo, g.lo) > EPS && !enthalten(a, g) && !enthalten(g, a));
    if (verschraenkt) continue;
    const umfassend = gesetzt.filter((g) => enthalten(a, g) && Math.min(a.hi, g.hi) - Math.max(a.lo, g.lo) > EPS);
    gesetzt.push({ ...a, spur: umfassend.length ? Math.max(...umfassend.map((g) => g.spur)) + 1 : 0 });
  }
  return new Map(gesetzt.sort((a, b) => vergleich(a.netz, b.netz)).map((g) => [g.netz, g.spur]));
}
