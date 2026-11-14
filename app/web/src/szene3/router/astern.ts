import type { Belegung } from "./raster";
import { ROUTER } from "./typen";

export interface Zelle { y: number; i: number; k: number }
export interface Vorzug { achse: 0 | 2; wert: number }

const DI = [1, -1, 0, 0], DK = [0, 0, 1, -1];

/**
 * Binaerer Min-Heap mit stabiler Reihenfolge (Kosten, dann Einfuegezaehler) fuer Determinismus. Flache Felder statt
 * Objekte (Laufzeit, Task 8); die Ordnung ist total, die Entnahmefolge daher unabhaengig vom inneren Aufbau.
 */
class Heap {
  private f = new Float64Array(1024);
  private n = new Float64Array(1024);
  private s = new Int32Array(1024);
  private laenge = 0;
  private zaehler = 0;
  leeren() { this.laenge = 0; this.zaehler = 0; }
  get leer() { return this.laenge === 0; }
  private wachsen() {
    const m = this.f.length * 2;
    const f = new Float64Array(m), n = new Float64Array(m), s = new Int32Array(m);
    f.set(this.f); n.set(this.n); s.set(this.s);
    this.f = f; this.n = n; this.s = s;
  }
  push(f: number, s: number) {
    if (this.laenge === this.f.length) this.wachsen();
    const n = this.zaehler++, F = this.f, N = this.n, S = this.s;
    let i = this.laenge++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (F[p] < f || (F[p] === f && N[p] < n)) break;
      F[i] = F[p]; N[i] = N[p]; S[i] = S[p]; i = p;
    }
    F[i] = f; N[i] = n; S[i] = s;
  }
  pop(): number {
    const F = this.f, N = this.n, S = this.s;
    const top = S[0], last = --this.laenge;
    if (last > 0) {
      const lf = F[last], ln = N[last], ls = S[last];
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i, mf = lf, mn = ln;
        if (l < last && (F[l] < mf || (F[l] === mf && N[l] < mn))) { m = l; mf = F[l]; mn = N[l]; }
        if (r < last && (F[r] < mf || (F[r] === mf && N[r] < mn))) m = r;
        if (m === i) break;
        F[i] = F[m]; N[i] = N[m]; S[i] = S[m]; i = m;
      }
      F[i] = lf; N[i] = ln; S[i] = ls;
    }
    return top;
  }
}

/** Wiederverwendete Suchpuffer; ein Eintrag gilt nur mit dem Stempel des laufenden Aufrufs (keine Neuanlage je Aufruf). */
const puffer = {
  g: new Float64Array(0), von: new Int32Array(0), stempel: new Uint32Array(0), fertig: new Uint32Array(0),
  frei: new Uint32Array(0), freiWert: new Uint8Array(0), lauf: 0, heap: new Heap(),
};
function puffern(n: number, zellen: number) {
  if (puffer.g.length < n) {
    puffer.g = new Float64Array(n); puffer.von = new Int32Array(n); puffer.stempel = new Uint32Array(n); puffer.fertig = new Uint32Array(n);
  }
  if (puffer.frei.length < zellen) { puffer.frei = new Uint32Array(zellen); puffer.freiWert = new Uint8Array(zellen); }
  if (++puffer.lauf >= 0xffffffff) { puffer.stempel.fill(0); puffer.fertig.fill(0); puffer.frei.fill(0); puffer.lauf = 1; }
  puffer.heap.leeren();
  return puffer;
}

/**
 * A* auf dem Raster. Zustand: Ebene, Zelle, Richtung (0..3, 4 = keine). Kosten in Metern:
 * Schritt Zelle mal Spurfaktor auf eigener Spur, Bogen, Ebenenwechsel (nicht in Start-/Zielzelle), Wandzuschlag.
 * Start- und Zielzelle gelten immer als frei (Anschluesse liegen oft am Rand eines Geraetes).
 * `optionen.startVerbote`: Richtungen (0..3 wie DI/DK), in die der erste Schritt nicht fuehren darf; `optionen.streng`:
 * Zellen dieses Netzes nur nahe Start und Ziel benutzen (Rueckfall-Abzweig ohne Parallellauf, LeitungsRouter.wegStreng).
 */
export function suchen(b: Belegung, start: Zelle, ziel: Zelle | null, istZiel: (z: Zelle) => boolean, netz: string, ebenen: number[], vorzug?: Vorzug,
  optionen: { startVerbote?: number[]; streng?: string } = {}): Zelle[] | null {
  const { nx, nz } = b.gitter, ne = ebenen.length, Z = ROUTER.zelle;
  const imRaster = (z: Zelle) => Number.isInteger(z.i) && Number.isInteger(z.k) && z.i >= 0 && z.k >= 0 && z.i < nx && z.k < nz;
  if (!imRaster(start) || (ziel && !imRaster(ziel))) return null;
  const e0 = ebenen.findIndex((y) => Math.abs(y - start.y) < 0.01);
  if (e0 < 0) return null;
  const flaeche = nx * nz;
  const id = (e: number, i: number, k: number, r: number) => (((e * nz + k) * nx + i) * 5 + r);
  const P = puffern(ne * flaeche * 5, ne * flaeche), lauf = P.lauf;
  const { g, von, stempel, fertig, frei: freiStempel, freiWert, heap } = P;
  // g[t] und von[t] gelten nur mit stempel[t] === lauf (sonst unendlich bzw. -1).
  // Belegungsebene je Suchebene (-1: keine Leitungsebene, dort alles frei und ohne Zuschlag).
  const bebene = ebenen.map((y) => b.ebeneVon(y));
  // Auch auf der Vorzugsspur darf die Heuristik die verbleibenden Kosten nicht ueberschaetzen.
  const hf = vorzug ? ROUTER.spurFaktor : 1;
  const zi = ziel ? ziel.i : -1, zk = ziel ? ziel.k : -1;
  const h = (i: number, k: number) => (ziel ? (Math.abs(i - zi) + Math.abs(k - zk)) * Z * hf : 0);
  const istStartOderZiel = (i: number, k: number) => (i === start.i && k === start.k) || (i === zi && k === zk);
  // Liegt ein Anschluss selbst im Aussenrand (Adapter an der Fassade), darf die Anfahrt die Randzellen bis zum Inneren nutzen.
  const RAND = Math.ceil(ROUTER.aussenRand / Z);
  const imRand = (c: Zelle | null): c is Zelle => !!c && !b.innen(c.i, c.k);
  const randStart = imRand(start), randZiel = imRand(ziel);
  const nahRandEnde = (i: number, k: number) => (randStart && Math.max(Math.abs(i - start.i), Math.abs(k - start.k)) <= RAND)
    || (randZiel && Math.max(Math.abs(i - zi), Math.abs(k - zk)) <= RAND);
  const innen = b.gitter.innen;
  // `streng`: Zellen dieses Netzes (eigener Strang) nur nahe Start und Ziel benutzen (Rueckfall ohne Parallellauf).
  const streng = optionen.streng, NAH = 3;
  const nahEnde = (i: number, k: number) => Math.max(Math.abs(i - start.i), Math.abs(k - start.k)) <= NAH
    || (!!ziel && Math.max(Math.abs(i - zi), Math.abs(k - zk)) <= NAH);
  const startVerbote = optionen.startVerbote ?? [];
  // Freiheit je Ebene und Zelle einmal je Aufruf bestimmen (haengt nur von Netz und Zelle ab).
  const frei = (e: number, i: number, k: number) => {
    const c = e * flaeche + k * nx + i;
    if (freiStempel[c] === lauf) return freiWert[c] === 1;
    const w = istStartOderZiel(i, k)
      || ((!!innen[k * nx + i] || nahRandEnde(i, k)) && (bebene[e] < 0 || (b.freiIndex(bebene[e] * flaeche + k * nx + i, netz)
        && !(streng && !nahEnde(i, k) && b.hat(bebene[e] * flaeche + k * nx + i, streng)))));
    freiStempel[c] = lauf; freiWert[c] = w ? 1 : 0;
    return w;
  };
  const { x0, z0 } = b.gitter;
  // Schrittkosten ohne Bogen je Spalte bzw. Zeile (Spurfaktor nur entlang der Vorzugsachse), wie zuvor Z * Faktor.
  const spur = new Float64Array(vorzug ? (vorzug.achse === 0 ? nz : nx) : 0);
  for (let n = 0; n < spur.length; n++) {
    const v = vorzug!.achse === 0 ? z0 + (n + 0.5) * Z : x0 + (n + 0.5) * Z;
    spur[n] = Z * (Math.abs(v - vorzug!.wert) < Z / 2 + 1e-9 ? ROUTER.spurFaktor : 1);
  }
  const spurK = !!vorzug && vorzug.achse === 0, ohneSpur = !vorzug;
  const BOGEN = ROUTER.bogen, WECHSEL = ROUTER.ebenenwechsel;
  const s0 = id(e0, start.i, start.k, 4);
  g[s0] = 0; von[s0] = -1; stempel[s0] = lauf; heap.push(h(start.i, start.k), s0);
  while (!heap.leer) {
    const s = heap.pop();
    // Die konsistente Heuristik erlaubt, abgeschlossene Zustaende nur einmal zu expandieren.
    if (fertig[s] === lauf) continue;
    fertig[s] = lauf;
    const r = s % 5, zelle = (s - r) / 5, i = zelle % nx, rest2 = (zelle - i) / nx, k = rest2 % nz, e = (rest2 - k) / nz;
    if (e === e0 && istZiel({ y: ebenen[e], i, k })) {
      const weg: Zelle[] = [];
      for (let t = s; t >= 0; t = von[t]) { const rr = t % 5, a = (t - rr) / 5, ii = a % nx, a2 = (a - ii) / nx, kk = a2 % nz; weg.push({ y: ebenen[(a2 - kk) / nz], i: ii, k: kk }); }
      return weg.reverse().filter((c, j, w) => j === 0 || c.y !== w[j - 1].y || c.i !== w[j - 1].i || c.k !== w[j - 1].k);
    }
    const gs = g[s], be = bebene[e], ebasis = e * flaeche;
    for (let d = 0; d < 4; d++) {
      // Kein Rueckwaertsschritt: Gegenrichtung von d ist d ^ 1 (0/1: +x/-x, 2/3: +z/-z).
      if (r !== 4 && (d ^ 1) === r) continue;
      if (s === s0 && startVerbote.includes(d)) continue;
      const ii = i + DI[d], kk = k + DK[d];
      if (ii < 0 || kk < 0 || ii >= nx || kk >= nz) continue;
      const c = ebasis + kk * nx + ii;
      if (freiStempel[c] === lauf ? freiWert[c] !== 1 : !frei(e, ii, kk)) continue;
      const kosten = (ohneSpur ? Z : spurK ? spur[kk] : spur[ii]) + (r !== 4 && r !== d ? BOGEN : 0) + (be < 0 ? 0 : b.zusatzIndex(be * flaeche + kk * nx + ii));
      const t = c * 5 + d, neu = gs + kosten;
      if (stempel[t] !== lauf || neu < g[t]) { g[t] = neu; von[t] = s; stempel[t] = lauf; heap.push(neu + h(ii, kk), t); }
    }
    if (r !== 4 && !istStartOderZiel(i, k)) for (let e2 = 0; e2 < ne; e2++) {
      if (e2 === e || !frei(e2, i, k)) continue;
      const t = id(e2, i, k, r), neu = gs + WECHSEL;
      if (stempel[t] !== lauf || neu < g[t]) { g[t] = neu; von[t] = s; stempel[t] = lauf; heap.push(neu + h(i, k), t); }
    }
  }
  return null;
}
