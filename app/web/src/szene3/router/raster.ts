import type { Welt } from "../../typen";
import { innenwaende } from "../geometrie";
import { deckenLauf, ROHR } from "../technik";
import { GRENZEN, ROUTER, type Koerper, type V3 } from "./typen";

export interface Gitter { x0: number; z0: number; nx: number; nz: number; innen: Uint8Array }
const Z = ROUTER.zelle;

export function gitterFuer(welt: Welt): Gitter {
  const r = welt.grundriss;
  const x0 = Math.min(...r.map((q) => q.x)), z0 = Math.min(...r.map((q) => q.z));
  const nx = Math.ceil((Math.max(...r.map((q) => q.x + q.breite)) - x0) / Z), nz = Math.ceil((Math.max(...r.map((q) => q.z + q.tiefe)) - z0) / Z);
  const innen = new Uint8Array(nx * nz), m = ROUTER.aussenRand;
  for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
    const x = x0 + (i + 0.5) * Z, z = z0 + (k + 0.5) * Z;
    if (r.some((q) => x >= q.x + m && x <= q.x + q.breite - m && z >= q.z + m && z <= q.z + q.tiefe - m)) innen[k * nx + i] = 1;
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
  private sperren(y: number, i: number, k: number, netz: string) {
    for (let di = -1; di <= 1; di++) for (let dk = -1; dk <= 1; dk++) {
      const ii = i + di, kk = k + dk;
      if (ii < 0 || kk < 0 || ii >= this.gitter.nx || kk >= this.gitter.nz) continue;
      const key = this.key(y, ii, kk), s = this.sperre.get(key) ?? new Set<string>();
      s.add(netz); this.sperre.set(key, s);
    }
    this.achse.set(this.key(y, i, k), netz);
  }
  /** Traegt ein Rohr ein: waagrecht auf seiner Ebene, senkrecht auf allen Ebenen im Hoehenbereich. */
  belegen(punkte: V3[], netz: string) {
    for (let n = 1; n < punkte.length; n++) {
      const a = punkte[n - 1], b = punkte[n];
      if (Math.abs(a[1] - b[1]) > 1e-6 && Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[2] - b[2]) < 1e-6) {
        const [i, k] = zelleVon(this.gitter, a[0], a[2]);
        const lo = Math.min(a[1], b[1]) - ROHR.haupt, hi = Math.max(a[1], b[1]) + ROHR.haupt;
        for (const y of this.ebenen) if (y >= lo && y <= hi) this.sperren(y, i, k, netz);
        continue;
      }
      if (Math.abs(a[1] - b[1]) > 1e-6) continue;
      const y = this.ebenen.find((e) => Math.abs(e - a[1]) < 0.01);
      if (y === undefined) continue;
      const [i0, k0] = zelleVon(this.gitter, a[0], a[2]), [i1, k1] = zelleVon(this.gitter, b[0], b[2]);
      const schritte = Math.max(Math.abs(i1 - i0), Math.abs(k1 - k0));
      for (let s = 0; s <= schritte; s++) {
        const t = schritte ? s / schritte : 0;
        this.sperren(y, Math.round(i0 + (i1 - i0) * t), Math.round(k0 + (k1 - k0) * t), netz);
      }
    }
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
    return !s || [...s].every((n) => n === netz);
  }
  eigen(y: number, i: number, k: number, netz: string): boolean { return this.achse.get(this.key(y, i, k)) === netz; }
  zusatz(y: number, i: number, k: number): number { return this.kosten.get(this.key(y, i, k)) ?? 0; }
}
