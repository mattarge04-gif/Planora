import type { Fenster, Quader } from "../szene2/huelle";

/** Vier achsparallele Leisten (oben, unten, links, rechts) um ein Fenster. Fassaden sind achsparallel. */
export function rahmenFuer(f: Fenster, staerke = 0.06, tiefe = 0.08): Quader[] {
  const [x, y, z] = f.mitte;
  const entlangX = Math.abs(Math.sin(f.drehungY)) < 0.5; // Normale entlang z -> Fassade verlaeuft in x
  const quer = f.breite + 2 * staerke;
  const yOben = y + f.hoehe / 2 + staerke / 2, yUnten = y - f.hoehe / 2 - staerke / 2;
  const seite = f.breite / 2 + staerke / 2;
  if (entlangX) {
    return [
      { mitte: [x, yOben, z], groesse: [quer, staerke, tiefe] },
      { mitte: [x, yUnten, z], groesse: [quer, staerke, tiefe] },
      { mitte: [x - seite, y, z], groesse: [staerke, f.hoehe, tiefe] },
      { mitte: [x + seite, y, z], groesse: [staerke, f.hoehe, tiefe] },
    ];
  }
  return [
    { mitte: [x, yOben, z], groesse: [tiefe, staerke, quer] },
    { mitte: [x, yUnten, z], groesse: [tiefe, staerke, quer] },
    { mitte: [x, y, z - seite], groesse: [tiefe, f.hoehe, staerke] },
    { mitte: [x, y, z + seite], groesse: [tiefe, f.hoehe, staerke] },
  ];
}
