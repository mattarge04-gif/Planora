import { mitteVon, type Belegung } from "./raster";
import { ROUTER } from "./typen";

export interface Zelle { y: number; i: number; k: number }
export interface Vorzug { achse: 0 | 2; wert: number }

const DI = [1, -1, 0, 0], DK = [0, 0, 1, -1];

/** Binaerer Min-Heap mit stabiler Reihenfolge (Kosten, dann Einfuegezaehler) fuer Determinismus. */
class Heap {
  private d: { f: number; n: number; s: number }[] = [];
  private zaehler = 0;
  get leer() { return this.d.length === 0; }
  push(f: number, s: number) {
    const e = { f, n: this.zaehler++, s }; this.d.push(e);
    let i = this.d.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (this.kleiner(this.d[p], e)) break; this.d[i] = this.d[p]; i = p; }
    this.d[i] = e;
  }
  pop(): number {
    const top = this.d[0], last = this.d.pop()!;
    if (this.d.length) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        const cand = (j: number) => j < this.d.length && this.kleiner(this.d[j], m === i ? last : this.d[m]);
        if (cand(l)) m = l; if (cand(r)) m = r;
        if (m === i) break;
        this.d[i] = this.d[m]; i = m;
      }
      this.d[i] = last;
    }
    return top.s;
  }
  private kleiner(a: { f: number; n: number }, b: { f: number; n: number }) { return a.f < b.f || (a.f === b.f && a.n < b.n); }
}

/**
 * A* auf dem Raster. Zustand: Ebene, Zelle, Richtung (0..3, 4 = keine). Kosten in Metern:
 * Schritt Zelle mal Spurfaktor auf eigener Spur, Bogen, Ebenenwechsel (nicht in Start-/Zielzelle), Wandzuschlag.
 * Start- und Zielzelle gelten immer als frei (Anschluesse liegen oft am Rand eines Geraetes).
 */
export function suchen(b: Belegung, start: Zelle, ziel: Zelle | null, istZiel: (z: Zelle) => boolean, netz: string, ebenen: number[], vorzug?: Vorzug): Zelle[] | null {
  const { nx, nz } = b.gitter, ne = ebenen.length, Z = ROUTER.zelle;
  const imRaster = (z: Zelle) => Number.isInteger(z.i) && Number.isInteger(z.k) && z.i >= 0 && z.k >= 0 && z.i < nx && z.k < nz;
  if (!imRaster(start) || (ziel && !imRaster(ziel))) return null;
  const e0 = ebenen.findIndex((y) => Math.abs(y - start.y) < 0.01);
  if (e0 < 0) return null;
  const id = (e: number, i: number, k: number, r: number) => (((e * nz + k) * nx + i) * 5 + r);
  const n = ne * nz * nx * 5;
  const g = new Float64Array(n).fill(Infinity), von = new Int32Array(n).fill(-1);
  const fertig = new Uint8Array(n);
  // Auch auf der Vorzugsspur darf die Heuristik die verbleibenden Kosten nicht ueberschaetzen.
  const h = (i: number, k: number) => (ziel ? (Math.abs(i - ziel.i) + Math.abs(k - ziel.k)) * Z * (vorzug ? ROUTER.spurFaktor : 1) : 0);
  const istStartOderZiel = (i: number, k: number) => (i === start.i && k === start.k) || (!!ziel && i === ziel.i && k === ziel.k);
  const frei = (e: number, i: number, k: number) => istStartOderZiel(i, k) || b.frei(ebenen[e], i, k, netz);
  const aufSpur = (i: number, k: number) => {
    if (!vorzug) return false;
    const [x, z] = mitteVon(b.gitter, i, k);
    return Math.abs((vorzug.achse === 0 ? z : x) - vorzug.wert) < Z / 2 + 1e-9;
  };
  const heap = new Heap();
  const s0 = id(e0, start.i, start.k, 4);
  g[s0] = 0; heap.push(h(start.i, start.k), s0);
  while (!heap.leer) {
    const s = heap.pop();
    // Die konsistente Heuristik erlaubt, abgeschlossene Zustaende nur einmal zu expandieren.
    if (fertig[s]) continue;
    fertig[s] = 1;
    const r = s % 5, rest = (s - r) / 5, i = rest % nx, rest2 = (rest - i) / nx, k = rest2 % nz, e = (rest2 - k) / nz;
    const zelle = { y: ebenen[e], i, k };
    if (istZiel(zelle) && e === e0) {
      const weg: Zelle[] = [];
      for (let t = s; t >= 0; t = von[t]) { const rr = t % 5, a = (t - rr) / 5, ii = a % nx, a2 = (a - ii) / nx, kk = a2 % nz; weg.push({ y: ebenen[(a2 - kk) / nz], i: ii, k: kk }); }
      return weg.reverse().filter((c, j, w) => j === 0 || c.y !== w[j - 1].y || c.i !== w[j - 1].i || c.k !== w[j - 1].k);
    }
    const gs = g[s];
    for (let d = 0; d < 4; d++) {
      const ii = i + DI[d], kk = k + DK[d];
      if (ii < 0 || kk < 0 || ii >= nx || kk >= nz || !frei(e, ii, kk)) continue;
      if (r !== 4 && DI[d] === -DI[r] && DK[d] === -DK[r]) continue;
      const kosten = Z * (aufSpur(ii, kk) ? ROUTER.spurFaktor : 1) + (r !== 4 && r !== d ? ROUTER.bogen : 0) + b.zusatz(ebenen[e], ii, kk);
      const t = id(e, ii, kk, d);
      if (gs + kosten < g[t]) { g[t] = gs + kosten; von[t] = s; heap.push(g[t] + h(ii, kk), t); }
    }
    if (r !== 4 && !istStartOderZiel(i, k)) for (let e2 = 0; e2 < ne; e2++) {
      if (e2 === e || !frei(e2, i, k)) continue;
      const t = id(e2, i, k, r);
      if (gs + ROUTER.ebenenwechsel < g[t]) { g[t] = gs + ROUTER.ebenenwechsel; von[t] = s; heap.push(g[t] + h(i, k), t); }
    }
  }
  return null;
}
