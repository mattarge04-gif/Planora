import type { Bereich, Quader, V3 } from "../szene2/huelle";

/** Gestalterische Kulisse [A]: rein aus dem Bereich abgeleitet, deterministisch. Masse in m. */
export const KULISSE = {
  rand: 9, platteHoehe: 0.4, wegBreite: 2, wegAbstand: 1.5, wegHoehe: 0.04,
  parkBreite: 2.5, parkTiefe: 5, parkAbstand: 3, parkHoehe: 0.02,
  baumAbstand: 6, baumHoehe: 4, baumRadius: 1.4, baumRand: 4,
} as const;

export interface Baum { position: V3; hoehe: number; radius: number }
export interface Kulisse { platte: Quader; wege: Quader[]; parkfelder: Quader[]; baeume: Baum[] }

export function kulisse(b: Bereich): Kulisse {
  const K = KULISSE;
  const breite = b.xMax - b.xMin, tiefe = b.zMax - b.zMin;
  const cx = (b.xMin + b.xMax) / 2, cz = (b.zMin + b.zMax) / 2;
  const platte: Quader = { mitte: [cx, -K.platteHoehe / 2, cz], groesse: [breite + 2 * K.rand, K.platteHoehe, tiefe + 2 * K.rand] };

  // Gehweg vor der Suedfassade (z < zMin) und entlang der Ostfassade (x > xMax), L-foermig
  const wz = b.zMin - K.wegAbstand - K.wegBreite / 2;
  const wx = b.xMax + K.wegAbstand + K.wegBreite / 2;
  const wege: Quader[] = [
    { mitte: [cx + K.wegAbstand / 2, K.wegHoehe / 2, wz], groesse: [breite + K.wegAbstand + K.wegBreite, K.wegHoehe, K.wegBreite] },
    { mitte: [wx, K.wegHoehe / 2, cz], groesse: [K.wegBreite, K.wegHoehe, tiefe] },
  ];

  // Parkfelder westlich des Gebaeudes, eine Reihe entlang z
  const px = b.xMin - K.parkAbstand - K.parkTiefe / 2;
  const anzahl = Math.max(1, Math.floor(tiefe / K.parkBreite));
  const start = cz - (anzahl * K.parkBreite) / 2 + K.parkBreite / 2;
  const parkfelder: Quader[] = Array.from({ length: anzahl }, (_, i) => ({
    mitte: [px, K.parkHoehe / 2, start + i * K.parkBreite] as V3,
    groesse: [K.parkTiefe, K.parkHoehe, K.parkBreite - 0.15] as V3,
  }));

  // Baumreihe noerdlich (z > zMax), ausserhalb des Gebaeudes, innerhalb der Platte
  const bz = b.zMax + K.baumRand;
  const n = Math.max(2, Math.floor((breite + 2 * K.baumRand) / K.baumAbstand));
  const x0 = cx - ((n - 1) * K.baumAbstand) / 2;
  const baeume: Baum[] = Array.from({ length: n }, (_, i) => ({
    position: [x0 + i * K.baumAbstand, 0, bz] as V3,
    hoehe: K.baumHoehe * (i % 3 === 1 ? 1.15 : i % 3 === 2 ? 0.9 : 1),
    radius: K.baumRadius,
  }));

  return { platte, wege, parkfelder, baeume };
}
