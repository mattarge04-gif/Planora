import * as THREE from "three";
import type { V3 } from "../szene2/huelle";
import { geschossBeiY } from "../szene2/leitungen";
import type { Welt, WeltSymbol } from "../typen";
import { geschossSchnitt } from "./schnitt";

/** Schematische Rohrmasse [A], Meter; Bodenoberkante liegt bei +0.025 m. */
export const ROHR = { haupt: 0.07, verteil: 0.045, flaeche: 0.014, anschluss: 0.018, bodenAbstand: 0.06, bogenFaktor: 2.5, durchgangHoehe: 0.3, deckenAbstand: 0.4 } as const;
/** Leitungsebene unter der Decke [A]: Achse 0.40 m unter Geschossoberkante, damit Rohr samt Isolation unter der 0.25-m-Platte liegt. */
export const deckenLauf = (g: { yUnten: number; hoehe: number }) => g.yUnten + g.hoehe - ROHR.deckenAbstand;
export const rohrAchse = (boden: number, radius: number) => boden + radius + ROHR.bodenAbstand;

const MASSE: Record<string, V3> = {
  "heizung.waermepumpe": [1, 1.2, 0.6], "heizung.gaskessel": [0.6, 1.6, 0.6],
  "heizung.oelkessel": [0.7, 1.4, 0.8], "heizung.fernwaerme_uebergabe": [1, 1.4, 0.35],
  "heizung.speicher": [0.9, 1.8, 0.9], "heizung.umwaelzpumpe": [0.35, 0.45, 0.3],
  "heizung.verteiler": [1.2, 1, 0.3], "heizung.heizkoerper": [1, 0.65, 0.12],
  "heizung.fbh_kreis": [0.6, 0.8, 0.15],
};

export function modellFuer(katalogId: string): { pfad: string | null; masse: V3 } {
  const id = katalogId === "heizung.tabs_feld" ? "heizung.fbh_kreis" : katalogId;
  return Object.hasOwn(MASSE, id) ? { pfad: `/modelle/${id}.glb`, masse: MASSE[id] } : { pfad: null, masse: [0.6, 0.6, 0.6] };
}

export const anlagenDaten = (s: WeltSymbol) => ({ schluessel: s.schluessel, bauteilIds: s.bauteilIds, katalogId: s.katalogId });

/** Untere Geschosse bleiben vorhanden; die geschlossene Hülle verdeckt sie per Tiefentest. */
export function anlageSichtbar(welt: Welt, fokusId: string | null, s: WeltSymbol): boolean {
  const id = geschossBeiY(welt, s.position.y);
  return geschossSchnitt(welt, fokusId).geschosse.some((g) => g.id === id);
}

/** Trennt Steigleitungen am oberen Schnitt, statt das höhere Zielgeschoss mitzuzeichnen. */
export function rohrSchnitt(punkte: V3[], yMax: number): V3[][] {
  const teile: V3[][] = [];
  let teil: V3[] = [];
  for (let i = 1; i < punkte.length; i++) {
    let a = punkte[i - 1], b = punkte[i];
    if (a[1] > yMax && b[1] > yMax) continue;
    const schnitt = (): V3 => {
      const t = (yMax - a[1]) / (b[1] - a[1]);
      return [a[0] + (b[0] - a[0]) * t, yMax, a[2] + (b[2] - a[2]) * t];
    };
    if (a[1] > yMax) a = schnitt();
    if (b[1] > yMax) b = schnitt();
    if (!teil.length) teil.push(a);
    teil.push(b);
    if (punkte[i][1] > yMax) { teile.push(teil); teil = []; }
  }
  if (teil.length > 1) teile.push(teil);
  return teile;
}

/** Gleich viele Abtastungen je Teilstück halten auch kleine Bögen an langen Geraden rund. */
class Rohrkurve extends THREE.CurvePath<THREE.Vector3> {
  private teil(t: number) {
    const n = this.curves.length, i = Math.min(n - 1, Math.floor(t * n));
    return { kurve: this.curves[i], t: t === 1 ? 1 : t * n - i };
  }
  override getPointAt(t: number, ziel = new THREE.Vector3()): THREE.Vector3 {
    const teil = this.teil(t);
    return teil.kurve.getPoint(teil.t, ziel);
  }
  override getTangentAt(t: number, ziel = new THREE.Vector3()): THREE.Vector3 {
    const teil = this.teil(t);
    return teil.kurve.getTangent(teil.t, ziel);
  }
}

/** Viertelkreisbögen (kubische Kreisnäherung), tangential an geraden Rohrstücken. */
export function rohrPfad(punkte: V3[], radius: number): THREE.CurvePath<THREE.Vector3> {
  const p: THREE.Vector3[] = [];
  for (const punkt of punkte) {
    const v = new THREE.Vector3(...punkt);
    if (!p.length || v.distanceToSquared(p[p.length - 1]) > 1e-12) p.push(v);
    while (p.length >= 3) {
      const n = p.length, a = p[n - 2].clone().sub(p[n - 3]).normalize(), b = p[n - 1].clone().sub(p[n - 2]).normalize();
      if (a.dot(b) < 1 - 1e-9) break;
      p.splice(n - 2, 1);
    }
  }
  const pfad = new Rohrkurve();
  if (p.length < 2) return pfad;
  let start = p[0];
  const linie = (ende: THREE.Vector3) => {
    if (start.distanceToSquared(ende) > 1e-12) pfad.add(new THREE.LineCurve3(start, ende));
    start = ende;
  };
  for (let i = 1; i < p.length - 1; i++) {
    const ein = p[i].clone().sub(p[i - 1]), aus = p[i + 1].clone().sub(p[i]);
    const r = Math.min(Math.max(0, radius * ROHR.bogenFaktor), ein.length() / 2, aus.length() / 2);
    ein.normalize(); aus.normalize();
    if (Math.abs(ein.dot(aus)) > 1e-6 || r < 1e-9) { linie(p[i]); continue; }
    const a = p[i].clone().addScaledVector(ein, -r), b = p[i].clone().addScaledVector(aus, r);
    linie(a);
    const k = 4 / 3 * Math.tan(Math.PI / 8) * r;
    pfad.add(new THREE.CubicBezierCurve3(a, a.clone().addScaledVector(ein, k), b.clone().addScaledVector(aus, -k), b));
    start = b;
  }
  linie(p[p.length - 1]);
  return pfad;
}

export interface ModellAnschluss { symbol: WeltSymbol; lokal: V3 }
/** [A] Vier vorhandene Vorlaufstutzen des eigenen Verteiler-GLB; weitere Räume teilen diese Anschlüsse. */
export function verteilerAbgang(index: number): V3 { return [-0.36 + 0.24 * (index % 4), 1, 0.02]; }

/** Kurze Geräteabgänge bleiben innerhalb der Einheit und steigen auf die Leitungsebene `laufY` (lokal zum Gerät). */
export function anschlussFuehrung(punkte: V3[], anschluss: ModellAnschluss, radius: number, raum?: import("../typen").Rechteck, laufY: number = ROHR.durchgangHoehe, zielZ?: number): { rohr: V3[]; adapter: V3[]; adapterRadius: number } {
  const { symbol: s, lokal: a } = anschluss;
  const masse = modellFuer(s.katalogId).masse;
  let adapterRadius = 0.035;
  const rand = 0.22, y = laufY;
  const richtungZ = raum && s.position.z + masse[2] / 2 + rand > raum.z + raum.tiefe - 0.15 ? -1 : 1;
  const z = richtungZ * (masse[2] / 2 + rand);
  let adapter: V3[];
  const unten = ["heizung.fernwaerme_uebergabe", "heizung.heizkoerper", "heizung.fbh_kreis", "heizung.tabs_feld"].includes(s.katalogId);
  if (unten) {
    // Abgaben unter der Deckenleitung erhalten einen direkten Fallstrang neben dem Gerät, ohne Umweg über den Boden.
    adapter = y > a[1] + 0.3 ? [a, [a[0], a[1], z], [a[0], y, z]] : [a, [a[0], Math.max(0.035, a[1] - 0.03), a[2]], [a[0], Math.max(0.035, a[1] - 0.03), z], [a[0], y, z]];
  } else if (s.katalogId === "heizung.verteiler" && a[1] > 0.95) {
    // Abgänge oben am Balken steigen gerade zur Deckenleitung auf.
    adapter = y > a[1] + 0.3 ? [a, [a[0], y, a[2]]] : [a, [a[0], a[1] + 0.14, a[2]], [a[0], a[1] + 0.14, z], [a[0], y, z]];
  } else if (s.katalogId === "heizung.verteiler") {
    adapterRadius = radius;
    // [A] Steht der linke Balkenstutzen wandnah, führt die Zuleitung gerade durch die Wand auf Stutzenhöhe statt mit einem gequetschten Bogen.
    const wandnah = raum && s.position.x + a[0] - raum.x < radius * 3 + 0.15;
    const x = wandnah ? raum.x - s.position.x - 0.3 - radius * ROHR.bogenFaktor : a[0] - 0.35;
    adapter = [a, [x, a[1], a[2]], [x, y, a[2]], [x, y, z]];
  } else if (s.katalogId === "heizung.umwaelzpumpe") {
    const richtung = 1;
    const platz = raum ? (richtung > 0 ? raum.x + raum.breite - s.position.x - a[0] : s.position.x + a[0] - raum.x) - 0.13 : 0.16;
    const x = a[0] + richtung * Math.max(0.02, Math.min(0.16, platz));
    adapter = [a, [x, a[1], a[2]], [x, y, a[2]], [x, y, z]];
  } else if (s.katalogId === "heizung.speicher") {
    const vorne = Math.max(a[2] + 0.12, masse[2] / 2 + rand);
    adapter = [a, [a[0], a[1], vorne], [a[0], y, vorne]];
  } else {
    const oben = Math.max(masse[1], a[1]) + 0.16;
    adapter = [a, [a[0], oben, a[2]], [a[0], oben, z], [a[0], y, z]];
  }
  const ausgang = adapter.at(-1)!;
  // Der kurze Abgang auf der Leitungsebene zeigt zum Ziel; so entsteht keine Schlaufe zurück über das Gerät.
  const abgangZ = zielZ === undefined || Math.abs(zielZ - s.position.z - ausgang[2]) < 0.6 ? richtungZ : Math.sign(zielZ - s.position.z - ausgang[2]);
  adapter.push([ausgang[0], ausgang[1], ausgang[2] + abgangZ * 0.22]);
  const welt = ([x, y, z]: V3): V3 => [x + s.position.x, y + s.position.y, z + s.position.z];
  adapter = adapter.map(welt);
  const start = adapter.at(-1)!;
  const ziel = punkte.at(-1) ?? start;
  const lauf = Math.max(start[2], ziel[2]) + 0.4;
  return { rohr: [start, [start[0], start[1], lauf], [ziel[0], start[1], lauf], [ziel[0], ziel[1], lauf], ziel], adapter, adapterRadius };
}

export function rohrAbschluesse(punkte: V3[]): { position: V3; richtung: V3 }[] {
  if (punkte.length < 2) return [];
  return [false, true].flatMap((ende) => {
    const p = ende ? [...punkte].reverse() : punkte;
    const nachbar = p.slice(1).find((v) => new THREE.Vector3(...v).distanceToSquared(new THREE.Vector3(...p[0])) > 1e-12);
    if (!nachbar) return [];
    return [{ position: p[0], richtung: new THREE.Vector3(...p[0]).sub(new THREE.Vector3(...nachbar)).normalize().toArray() as V3 }];
  });
}
