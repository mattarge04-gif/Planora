import type { Welt } from "../../typen";
import { innenwaende } from "../geometrie";
import { deckenLauf, ROHR } from "../technik";
import { GRENZEN, ROUTER, type Koerper, type V3 } from "./typen";

export interface Gitter { x0: number; z0: number; nx: number; nz: number; innen: Uint8Array }
const Z = ROUTER.zelle;
const EPS = 1e-9;
const PUNKTE: [number, number][] = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const liegtIn = (r: Welt["grundriss"], x: number, z: number) =>
  r.some((q) => x >= q.x - EPS && x <= q.x + q.breite + EPS && z >= q.z - EPS && z <= q.z + q.tiefe + EPS);

export function gitterFuer(welt: Welt): Gitter {
  const r = welt.grundriss;
  const x0 = Math.min(...r.map((q) => q.x)), z0 = Math.min(...r.map((q) => q.z));
  const nx = Math.ceil((Math.max(...r.map((q) => q.x + q.breite)) - x0) / Z), nz = Math.ceil((Math.max(...r.map((q) => q.z + q.tiefe)) - z0) / Z);
  const innen = new Uint8Array(nx * nz), m = ROUTER.aussenRand;
  for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
    const x = x0 + (i + 0.5) * Z, z = z0 + (k + 0.5) * Z;
    // Aussenrand am Gesamtumriss: alle acht Punkte im Abstand m muessen in der Vereinigung der Rechtecke liegen.
    if (PUNKTE.every(([dx, dz]) => liegtIn(r, x + dx * m, z + dz * m))) innen[k * nx + i] = 1;
  }
  return { x0, z0, nx, nz, innen };
}
export const zelleVon = (g: Gitter, x: number, z: number): [number, number] =>
  [Math.min(g.nx - 1, Math.max(0, Math.floor((x - g.x0) / Z))), Math.min(g.nz - 1, Math.max(0, Math.floor((z - g.z0) / Z)))];
export const mitteVon = (g: Gitter, i: number, k: number): [number, number] => [g.x0 + (i + 0.5) * Z, g.z0 + (k + 0.5) * Z];

/** Je Geschoss: [Leitungsebene unter der Decke, Ausweichebene 0.25 m tiefer]. */
export function ebenenFuer(welt: Welt): Map<string, number[]> {
  return new Map(welt.geschosse.map((g) => { const y = deckenLauf(g); return [g.id, [+y.toFixed(4), +(y - ROUTER.ausweich).toFixed(4)]]; }));
}
const ek = (y: number) => Math.round(y * 1000);
/** Sperrabstand von Zellmitten zur Rohrgeometrie: zwei Hauptrohr-Radien, Fuge und eine halbe Zelle Einrastversatz [A]. */
export const SPERRABSTAND = 2 * ROHR.haupt + GRENZEN.fuge + Z / 2;

export class Belegung {
  readonly gitter: Gitter;
  readonly ebenen: number[];
  private achse = new Map<string, string>();
  private sperre = new Map<string, Set<string>>();
  private kosten = new Map<string, number>();
  constructor(welt: Welt) {
    this.gitter = gitterFuer(welt);
    this.ebenen = [...ebenenFuer(welt).values()].flat().sort((a, b) => a - b);
  }
  private key(y: number, i: number, k: number) { return `${ek(y)}:${i}:${k}`; }
  private sperrSet(y: number, i: number, k: number, netz: string) {
    const key = this.key(y, i, k), s = this.sperre.get(key) ?? new Set<string>();
    s.add(netz); this.sperre.set(key, s);
  }
  /** Sperrt alle Zellen, deren Mitte naeher als SPERRABSTAND an der Strecke a-b (im Grundriss) liegt. */
  private sperrenUm(y: number, a: [number, number], b: [number, number], netz: string) {
    const R = SPERRABSTAND, g = this.gitter;
    const [i0, k0] = zelleVon(g, Math.min(a[0], b[0]) - R, Math.min(a[1], b[1]) - R);
    const [i1, k1] = zelleVon(g, Math.max(a[0], b[0]) + R, Math.max(a[1], b[1]) + R);
    for (let i = i0; i <= i1; i++) for (let k = k0; k <= k1; k++) {
      const [x, z] = mitteVon(g, i, k);
      const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
      const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2)) : 0;
      if (Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz) < R - EPS) this.sperrSet(y, i, k, netz);
    }
  }
  /**
   * Traegt ein Rohr ein: waagrecht auf seiner Ebene, senkrecht auf allen Ebenen im Hoehenbereich. Gesperrt wird nach
   * der tatsaechlichen Geometrie (Laeufe sind nach dem Einrasten bis eine halbe Zelle verschoben), die Achse bleibt
   * auf der gerasterten Zelle markiert.
   */
  belegen(punkte: V3[], netz: string) {
    for (let n = 1; n < punkte.length; n++) {
      const a = punkte[n - 1], b = punkte[n];
      if (Math.abs(a[1] - b[1]) > 1e-6 && Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[2] - b[2]) < 1e-6) {
        const [i, k] = zelleVon(this.gitter, a[0], a[2]);
        const lo = Math.min(a[1], b[1]) - ROHR.haupt, hi = Math.max(a[1], b[1]) + ROHR.haupt;
        for (const y of this.ebenen) if (y >= lo && y <= hi) {
          this.sperrenUm(y, [a[0], a[2]], [a[0], a[2]], netz);
          this.sperrSet(y, i, k, netz); this.achse.set(this.key(y, i, k), netz);
        }
        continue;
      }
      if (Math.abs(a[1] - b[1]) > 1e-6) continue;
      const y = this.ebenen.find((e) => Math.abs(e - a[1]) < 0.01);
      if (y === undefined) continue;
      this.sperrenUm(y, [a[0], a[2]], [b[0], b[2]], netz);
      const [i0, k0] = zelleVon(this.gitter, a[0], a[2]), [i1, k1] = zelleVon(this.gitter, b[0], b[2]);
      const schritte = Math.max(Math.abs(i1 - i0), Math.abs(k1 - k0));
      for (let s = 0; s <= schritte; s++) {
        const t = schritte ? s / schritte : 0, i = Math.round(i0 + (i1 - i0) * t), k = Math.round(k0 + (k1 - k0) * t);
        this.sperrSet(y, i, k, netz); this.achse.set(this.key(y, i, k), netz);
      }
    }
  }
  /** Reserviert die Umgebung eines Punktes (Sperrabstand) auf seiner Ebene, z. B. fuer einen spaeteren Anschluss. */
  reservieren(p: V3, name: string) {
    const y = this.ebenen.find((e) => Math.abs(e - p[1]) < 0.01);
    if (y !== undefined) this.sperrenUm(y, [p[0], p[2]], [p[0], p[2]], name);
  }
  /** Geraete sperren eine Ebene nur, wenn darueber weniger als 0.15 m Luft bleibt (Spec 9, PO-bestaetigt). */
  geraete(koerper: Koerper[]) {
    for (const k of koerper) for (const y of this.ebenen) {
      if (y - ROHR.haupt >= k.max[1] + GRENZEN.luftUeberGeraet || y + ROHR.haupt <= k.min[1]) continue;
      const [i0, k0] = zelleVon(this.gitter, k.min[0], k.min[2]), [i1, k1] = zelleVon(this.gitter, k.max[0], k.max[2]);
      for (let i = i0; i <= i1; i++) for (let kk = k0; kk <= k1; kk++) {
        const key = this.key(y, i, kk), s = this.sperre.get(key) ?? new Set<string>();
        s.add(`geraet:${k.schluessel}`); this.sperre.set(key, s);
      }
    }
  }
  /** Innenwaende: passierbar mit Zuschlag je Zelle [A]. */
  waende(welt: Welt) {
    for (const g of welt.geschosse) {
      const ys = this.ebenen.filter((y) => y >= g.yUnten && y < g.yUnten + g.hoehe);
      for (const w of innenwaende(welt, g.id, g.yUnten, g.hoehe)) {
        const [i0, k0] = zelleVon(this.gitter, w.mitte[0] - w.groesse[0] / 2, w.mitte[2] - w.groesse[2] / 2);
        const [i1, k1] = zelleVon(this.gitter, w.mitte[0] + w.groesse[0] / 2, w.mitte[2] + w.groesse[2] / 2);
        for (const y of ys) for (let i = i0; i <= i1; i++) for (let k = k0; k <= k1; k++) this.kosten.set(this.key(y, i, k), ROUTER.wand);
      }
    }
  }
  frei(y: number, i: number, k: number, netz: string): boolean {
    if (i < 0 || k < 0 || i >= this.gitter.nx || k >= this.gitter.nz || !this.gitter.innen[k * this.gitter.nx + i]) return false;
    const s = this.sperre.get(this.key(y, i, k));
    // Teilnetz `netz~x` darf Zellen seines Netzes `netz` mitbenutzen (Abzweige eines Strangs mit eigener Reservierung).
    return !s || [...s].every((n) => n === netz || netz.startsWith(`${n}~`));
  }
  eigen(y: number, i: number, k: number, netz: string): boolean { return this.achse.get(this.key(y, i, k)) === netz; }
  zusatz(y: number, i: number, k: number): number { return this.kosten.get(this.key(y, i, k)) ?? 0; }
}
