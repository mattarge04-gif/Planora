import type { Bereich, V3 } from "../szene2/huelle";

/** Blickrichtung von Ziel zu Kamera: isometrisch 3/4 (45 Grad gedreht, ca. 35 Grad Neigung). */
export const ISO_RICHTUNG: V3 = (() => { const l = Math.sqrt(3); return [1 / l, 1 / l, 1 / l] as V3; })();
export interface Freiraum { links: number; rechts: number; oben: number; unten: number }
export interface Einpassung { ziel: V3; position: V3; zoom: number }

const kreuz = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; };
const punkt = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * Passt eine Orthokamera so ein, dass der Bereich `fuellung` (0..1) der freien Flaeche fuellt
 * (Ansicht minus Freiraum fuer Karten, in px) und in deren Mitte liegt. zoom = px pro Welteinheit.
 */
export function einpassen(b: Bereich, breite: number, hoehe: number, frei: Freiraum, fuellung = 0.7, richtung: V3 = ISO_RICHTUNG): Einpassung {
  const iso = norm(richtung);
  const rechts = norm(kreuz([0, 1, 0], iso));   // Bildschirm-rechts
  const oben = kreuz(iso, rechts);               // Bildschirm-oben
  const mitte: V3 = [(b.xMin + b.xMax) / 2, (b.yMin + b.yMax) / 2, (b.zMin + b.zMax) / 2];
  let r0 = Infinity, r1 = -Infinity, o0 = Infinity, o1 = -Infinity;
  for (const x of [b.xMin, b.xMax]) for (const y of [b.yMin, b.yMax]) for (const z of [b.zMin, b.zMax]) {
    const p: V3 = [x - mitte[0], y - mitte[1], z - mitte[2]];
    const r = punkt(p, rechts), o = punkt(p, oben);
    r0 = Math.min(r0, r); r1 = Math.max(r1, r); o0 = Math.min(o0, o); o1 = Math.max(o1, o);
  }
  const freiB = Math.max(1, breite - frei.links - frei.rechts), freiH = Math.max(1, hoehe - frei.oben - frei.unten);
  const zoom = fuellung * Math.min(freiB / Math.max(r1 - r0, 1e-6), freiH / Math.max(o1 - o0, 1e-6));
  // Bildmitte des Bereichs (Projektion) soll in die Mitte der freien Flaeche:
  const projMitteR = (r0 + r1) / 2, projMitteO = (o0 + o1) / 2;
  const dxPx = (frei.links - frei.rechts) / 2, dyPx = (frei.unten - frei.oben) / 2; // + = Inhalt nach rechts / oben
  const sR = projMitteR - dxPx / zoom, sO = projMitteO - dyPx / zoom;
  const ziel: V3 = [mitte[0] + rechts[0] * sR + oben[0] * sO, mitte[1] + rechts[1] * sR + oben[1] * sO, mitte[2] + rechts[2] * sR + oben[2] * sO];
  const abstand = 200;
  const position: V3 = [ziel[0] + iso[0] * abstand, ziel[1] + iso[1] * abstand, ziel[2] + iso[2] * abstand];
  return { ziel, position, zoom };
}
