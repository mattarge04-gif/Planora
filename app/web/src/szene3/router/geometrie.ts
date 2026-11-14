import { GRENZEN, type V3 } from "./typen";

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const clamp = (x: number) => Math.min(1, Math.max(0, x));
export const EPS = 1e-6;

/** Kuerzester Abstand zweier Strecken (Ericson, Real-Time Collision Detection 5.1.9). */
export function segAbstand(p1: V3, q1: V3, p2: V3, q2: V3): { d: number; a: V3; b: V3 } {
  const d1 = sub(q1, p1), d2 = sub(q2, p2), r = sub(p1, p2);
  const a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r);
  let s = 0, t = 0;
  if (a <= 1e-12 && e <= 1e-12) { s = 0; t = 0; }
  else if (a <= 1e-12) { s = 0; t = clamp(f / e); }
  else {
    const c = dot(d1, r);
    if (e <= 1e-12) { t = 0; s = clamp(-c / a); }
    else {
      const b = dot(d1, d2), den = a * e - b * b;
      s = den > 1e-12 ? clamp((b * f - c * e) / den) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = clamp(-c / a); } else if (t > 1) { t = 1; s = clamp((b - c) / a); }
    }
  }
  const pa = add(p1, mul(d1, s)), pb = add(p2, mul(d2, t));
  return { d: Math.hypot(...sub(pa, pb)), a: pa, b: pb };
}

/** Achsen, in denen sich zwei Punkte unterscheiden. */
export const achsen = (a: V3, b: V3) => [0, 1, 2].filter((i) => Math.abs(a[i] - b[i]) > EPS);

/** Schneidet die Strecke den (offenen) Quader? Slab-Test. */
export function schneidetQuader(p: V3, q: V3, min: V3, max: V3): boolean {
  let t0 = 0, t1 = 1;
  for (let i = 0; i < 3; i++) {
    const d = q[i] - p[i];
    if (Math.abs(d) < 1e-12) { if (p[i] <= min[i] + EPS || p[i] >= max[i] - EPS) return false; continue; }
    let a = (min[i] - p[i]) / d, b = (max[i] - p[i]) / d;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    if (t0 >= t1 - 1e-9) return false;
  }
  return true;
}

/** Anzahl Richtungswechsel einer Polylinie (Nullstuecke ignoriert). */
export function boegen(punkte: V3[]): number {
  const richtungen: string[] = [];
  for (let i = 1; i < punkte.length; i++) {
    const d = sub(punkte[i], punkte[i - 1]), l = Math.hypot(...d);
    if (l < EPS) continue;
    const r = d.map((x) => Math.round((x / l) * 1000)).join(",");
    if (richtungen.at(-1) !== r) richtungen.push(r);
  }
  return Math.max(0, richtungen.length - 1);
}

/**
 * Boegen je Geschossabschnitt (PO-Entscheid 14.11.): Die Polylinie wird an jeder Steigleitung geteilt, d. h. an jedem
 * senkrechten Stueck ab GRENZEN.steigleitung (1.0 m [A]). Die Steigleitung selbst und ihre beiden Uebergangsboegen
 * gehoeren zu keinem Abschnitt. Kurze senkrechte Stuecke (Ausweichen 0.25 m, Stutzenversatz) bleiben im Abschnitt und
 * zaehlen mit. Ergebnis: Bogenzahl je Abschnitt (mindestens ein Abschnitt).
 */
export function boegenJeAbschnitt(punkte: V3[]): number[] {
  const abschnitte: V3[][] = [[]];
  for (let i = 0; i < punkte.length; i++) {
    const p = punkte[i], q = punkte[i + 1];
    abschnitte.at(-1)!.push(p);
    if (q && Math.abs(p[0] - q[0]) < EPS && Math.abs(p[2] - q[2]) < EPS && Math.abs(p[1] - q[1]) >= GRENZEN.steigleitung) abschnitte.push([]);
  }
  return abschnitte.map(boegen);
}

/** Schneiden sich die Grundriss-Projektionen zweier waagrechter, zueinander senkrechter Strecken im Inneren? */
export function kreuztImGrundriss(a: V3, b: V3, c: V3, d: V3): boolean {
  const ka = Math.abs(a[0] - b[0]) > EPS ? 0 : 2, kc = Math.abs(c[0] - d[0]) > EPS ? 0 : 2;
  if (ka === kc) return false;
  const qa = ka === 0 ? 2 : 0;
  const x = c[ka], z = a[qa];
  return x > Math.min(a[ka], b[ka]) + EPS && x < Math.max(a[ka], b[ka]) - EPS
    && z > Math.min(c[qa], d[qa]) + EPS && z < Math.max(c[qa], d[qa]) - EPS;
}
