import type { Bereich, V3 } from "../szene2/huelle";
import { Vector3, type Camera, type OrthographicCamera } from "three";
import type { Welt } from "../typen";
import { POLAR_GRENZEN } from "./schnitt";

export function tastaturSchritt(key: string, azimut: number, polar: number, zoom: number) {
  const winkel = Math.PI / 18;
  if (key === "ArrowLeft") return { azimut: azimut - winkel, polar, zoom };
  if (key === "ArrowRight") return { azimut: azimut + winkel, polar, zoom };
  if (key === "ArrowUp") return { azimut, polar: Math.max(POLAR_GRENZEN.min, polar - winkel / 2), zoom };
  if (key === "ArrowDown") return { azimut, polar: Math.min(POLAR_GRENZEN.max, polar + winkel / 2), zoom };
  if (key === "+" || key === "=") return { azimut, polar, zoom: zoom * 1.15 };
  if (key === "-" || key === "_") return { azimut, polar, zoom: zoom / 1.15 };
  return null;
}

/** Blickrichtung von Ziel zu Kamera: isometrisch 3/4 (45 Grad gedreht, ca. 35 Grad Neigung). */
export const ISO_RICHTUNG: V3 = (() => { const l = Math.sqrt(3); return [1 / l, 1 / l, 1 / l] as V3; })();
export interface Freiraum { links: number; rechts: number; oben: number; unten: number }
export interface Einpassung { ziel: V3; position: V3; zoom: number }
export interface SzenenZiel { geschossId: string; position?: { x: number; y: number; z: number } }
/** CSS-Kartenränder in WebGL-Koordinaten; unten schliesst die Kulisse direkt an die Tabellenoberkante an. */
export function freiraumScissor(breite: number, hoehe: number, frei: Freiraum, faktor = 1, rand = 12): [number, number, number, number] {
  const x = Math.min(breite, Math.max(0, frei.links + rand)), y = Math.min(hoehe, Math.max(0, frei.unten));
  return [Math.round(x * faktor), Math.round(y * faktor), Math.max(0, Math.floor((breite - x - frei.rechts - rand) * faktor)),
    Math.max(0, Math.floor((hoehe - y - frei.oben - rand) * faktor))];
}
export const FIT_ANTEIL = 0.7;
export interface BildschirmPunkt { x: number; y: number }
export function bildpunkt(camera: Camera, breite: number, hoehe: number, punkt: Vector3): BildschirmPunkt | null {
  const p = punkt.clone().project(camera);
  if (!Number.isFinite(p.x + p.y + p.z) || p.z < -1 || p.z > 1 || Math.abs(p.x) > 1 || Math.abs(p.y) > 1) return null;
  return { x: Math.round((p.x + 1) * breite * 5) / 10, y: Math.round((1 - p.y) * hoehe * 5) / 10 };
}
export function punktImFreiraum(p: { x: number; y: number } | null, breite: number, hoehe: number, frei: Freiraum, rand = 12): boolean {
  return !!p && p.x >= frei.links + rand && p.x <= breite - frei.rechts - rand && p.y >= frei.oben + rand && p.y <= hoehe - frei.unten - rand;
}

/** [A] Alle manuellen Zoomwege verankern die freie Mitte; eine Auswahl wird vollständig im Freiraum gehalten. */
export function zoomImFreiraum(camera: OrthographicCamera, target: Vector3, breite: number, hoehe: number, frei: Freiraum, zoom: number, auswahl?: Bereich): void {
  camera.updateMatrixWorld();
  const richtung = camera.position.clone().sub(target).toArray() as V3;
  if (auswahl) zoom = Math.min(zoom, einpassen(auswahl, breite, hoehe, frei, 0.9, richtung).zoom);
  const ndc = new Vector3((frei.links - frei.rechts) / breite, (frei.unten - frei.oben) / hoehe, 0);
  const vorher = ndc.clone().unproject(camera);
  camera.zoom = Math.max(1e-6, zoom); camera.updateProjectionMatrix();
  const versatz = vorher.sub(ndc.clone().unproject(camera));
  camera.position.add(versatz); target.add(versatz); camera.updateMatrixWorld();
  if (!auswahl) return;
  const punkte = [];
  for (const x of [auswahl.xMin, auswahl.xMax]) for (const y of [auswahl.yMin, auswahl.yMax]) for (const z of [auswahl.zMin, auswahl.zMax]) {
    const p = new Vector3(x, y, z).project(camera);
    punkte.push({ x: (p.x + 1) * breite / 2, y: (1 - p.y) * hoehe / 2 });
  }
  const x0 = Math.min(...punkte.map((p) => p.x)), x1 = Math.max(...punkte.map((p) => p.x));
  const y0 = Math.min(...punkte.map((p) => p.y)), y1 = Math.max(...punkte.map((p) => p.y));
  const dx = x0 < frei.links + 12 ? frei.links + 12 - x0 : x1 > breite - frei.rechts - 12 ? breite - frei.rechts - 12 - x1 : 0;
  const dy = y0 < frei.oben + 12 ? frei.oben + 12 - y0 : y1 > hoehe - frei.unten - 12 ? hoehe - frei.unten - 12 - y1 : 0;
  const korrektur = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(-dx / camera.zoom)
    .addScaledVector(new Vector3().setFromMatrixColumn(camera.matrixWorld, 1), dy / camera.zoom);
  camera.position.add(korrektur); target.add(korrektur); camera.updateMatrixWorld();
}

/** [A] Kulisse verschwindet ab doppeltem Geschoss-Fit-Zoom; 1.8-fach zum Wiedereinblenden verhindert Flackern. */
export const nahZoom = (zoom: number, basis: number, vorher = false) => zoom / Math.max(basis, 1e-6) > (vorher ? 1.8 : 2);

const kreuz = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; };
const punkt = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** [A] 96 px Zielgrösse lässt Umriss und Details erkennen; mindestens 60 px bei ausreichend grossem Freiraum. */
export function anlageEinpassen(b: Bereich, breite: number, hoehe: number, frei: Freiraum, richtung: V3): Einpassung {
  const iso = norm(richtung), rechts = norm(kreuz([0, 1, 0], iso)), oben = kreuz(iso, rechts);
  const d: V3 = [b.xMax - b.xMin, b.yMax - b.yMin, b.zMax - b.zMin];
  const span = (achse: V3) => d.reduce((summe, v, i) => summe + Math.abs(achse[i]) * v, 0);
  const zielZoom = 96 / Math.max(span(rechts), span(oben), 1e-6);
  const passend = einpassen(b, breite, hoehe, frei, 0.8, richtung);
  const zoom = Math.min(zielZoom, passend.zoom);
  return einpassen(b, breite, hoehe, frei, 0.8 * zoom / passend.zoom, richtung);
}

export function ortBereich(welt: Welt, ziel: SzenenZiel, offsets: Record<string, number>): Bereich | null {
  const g = welt.geschosse.find((g) => g.id === ziel.geschossId);
  if (!g) return null;
  const y = (ziel.position?.y ?? g.yUnten) + (offsets[g.id] ?? 0);
  if (ziel.position) {
    // [A] Ortsziele ohne Anlage erhalten ein sechs Meter breites Umfeld; keine erfundene Anlage.
    return { xMin: ziel.position.x - 3, xMax: ziel.position.x + 3, zMin: ziel.position.z - 3, zMax: ziel.position.z + 3, yMin: y, yMax: y + 1 };
  }
  if (!welt.grundriss.length) return null;
  return { xMin: Math.min(...welt.grundriss.map((r) => r.x)), xMax: Math.max(...welt.grundriss.map((r) => r.x + r.breite)),
    zMin: Math.min(...welt.grundriss.map((r) => r.z)), zMax: Math.max(...welt.grundriss.map((r) => r.z + r.tiefe)), yMin: y, yMax: y + g.hoehe };
}

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
