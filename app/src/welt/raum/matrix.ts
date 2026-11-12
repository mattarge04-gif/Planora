import type { RegelwerkV2 } from "../regelwerk.js";

/** Raumgroesse in Modulen: Laenge entlang der Reihe, Tiefe quer dazu. */
export interface RaumGroesse { laenge: number; tiefe: number }

/**
 * Raumgroesse aus der Modulmatrix (Spec 5.1). `symbole` zaehlt Symbole (nicht Mengen) ohne Gruppenzubehoer;
 * `geraete` gilt nur fuer Technik (gleiche Zaehlung). Kern ist fix, Raeume ohne Symbol erhalten `leer`.
 */
export function raumModule(art: string, symbole: number, geraete: number, rw: RegelwerkV2): RaumGroesse {
  const m = rw.raum;
  const groesse = ([laenge, tiefe]: [number, number]): RaumGroesse => ({ laenge, tiefe });
  if (art === "kern") return groesse(m.kern);
  if (art === "technik") return { laenge: Math.max(m.technik.minLaenge, geraete), tiefe: m.technik.tiefe };
  if (symbole <= 0) return groesse(m.leer);
  if (symbole === 1) return groesse(m.abgabe.eins);
  if (symbole === 2) return groesse(m.abgabe.zwei);
  const [laenge, tiefe] = m.abgabe.dreiVier;
  return { laenge: laenge + Math.ceil(Math.max(0, symbole - 4) / 2) * m.abgabe.jeZweiWeitere, tiefe };
}
