import { geschossBeiY } from "../../szene2/leitungen";
import type { KatalogEintrag, Welt } from "../../typen";
import { bereinigen, type StrangBaum, type StrangZiel, SPUR } from "../gruppenNetz";
import { suchen, type Vorzug, type Zelle } from "./astern";
import { geraeteKoerper } from "./koerper";
import { Belegung, ebenenFuer, mitteVon, zelleVon } from "./raster";
import { spurenZuteilen, spurWert, trassenLage, type Lage } from "./trasse";
import type { Befund, V3 } from "./typen";

const EPS = 1e-6;
const ERZEUGER = new Set(["heizung.waermepumpe", "heizung.gaskessel", "heizung.oelkessel", "heizung.fernwaerme_uebergabe"]);

export class LeitungsRouter {
  readonly befunde: Befund[] = [];
  private b: Belegung;
  private ebenen: Map<string, number[]>;
  private eigene = new Map<string, V3[][]>();
  private spur = new Map<string, Vorzug>();
  private zentrale: { geschossId: string; lage: Lage | null } | null = null;

  constructor(private welt: Welt, katalog: KatalogEintrag[]) {
    this.b = new Belegung(welt);
    this.ebenen = ebenenFuer(welt);
    this.b.geraete(geraeteKoerper(welt, katalog));
    this.b.waende(welt);
    const erzeuger = [...welt.symbole].filter((s) => ERZEUGER.has(s.katalogId)).sort((a, b) => a.position.y - b.position.y || (a.schluessel < b.schluessel ? -1 : 1))[0];
    if (erzeuger) {
      const g = geschossBeiY(welt, erzeuger.position.y)!;
      const raum = welt.einheiten.find((e) => e.geschossId === g && erzeuger.position.x >= e.rechteck.x && erzeuger.position.x <= e.rechteck.x + e.rechteck.breite
        && erzeuger.position.z >= e.rechteck.z && erzeuger.position.z <= e.rechteck.z + e.rechteck.tiefe);
      this.zentrale = { geschossId: g, lage: raum ? trassenLage(raum.rechteck, welt.symbole.filter((s) => geschossBeiY(welt, s.position.y) === g).map((s) => [s.position.x, 0, s.position.z] as V3)) : null };
    }
  }

  private ebenenBei(y: number): number[] {
    return this.ebenen.get(geschossBeiY(this.welt, y) ?? "") ?? [y];
  }

  vorbelegen(punkte: V3[], netz: string) { this.b.belegen(punkte, netz); }
  belegen(punkte: V3[], netz: string) {
    this.b.belegen(punkte, netz);
    const l = this.eigene.get(netz) ?? []; l.push(punkte); this.eigene.set(netz, l);
  }

  /** Spuren der Trasse fuer Leitungen auf dem Zentrale-Geschoss (Spec 5.3). */
  spurenFestlegen(auftraege: { netz: string; a: V3; b: V3 }[]) {
    const z = this.zentrale;
    if (!z?.lage) return;
    const lage = z.lage, k = lage.achse;
    const relevant = auftraege.filter((x) => geschossBeiY(this.welt, x.a[1] - 1) === z.geschossId);
    const s = spurenZuteilen(relevant.map((x) => ({ netz: x.netz, von: x.a[k], bis: x.b[k] })));
    for (const [netz, index] of s) this.spur.set(netz, { achse: k, wert: spurWert(lage, index) });
  }

  /**
   * Zellpfad -> Eckpunkte, Enden exakt auf a/b eingerastet (Versatz hoechstens eine halbe Zelle).
   * Das erste und letzte waagrechte Stueck wird quer auf den Anker verschoben (samt anschliessender Steigstuecke),
   * die Zellmitte am Ende entfaellt, damit kein Rueckwaertsstueck entsteht. Ein gerader Zellpfad mit querem Versatz
   * zwischen a und b erhaelt in der Mitte einen kleinen Versatz.
   */
  private alsPunkte(zellen: Zelle[], a: V3, b: V3): V3[] {
    const p = bereinigen(zellen.map((c) => { const [x, z] = mitteVon(this.b.gitter, c.i, c.k); return [x, c.y, z] as V3; }));
    if (p.length < 2) return bereinigen([a, [b[0], a[1], a[2]], b]);
    const achse = (u: V3, v: V3): 0 | 2 => (Math.abs(u[0] - v[0]) > EPS ? 0 : 2);
    // Verschiebt ab Punkt j (in Richtung schritt) die Koordinate q, solange das naechste Stueck nicht entlang q laeuft
    // (senkrechte Stuecke und Stuecke entlang der anderen Achse bleiben achsparallel).
    const schieben = (j: number, q: 0 | 2, wert: number, schritt: 1 | -1) => {
      for (let m = j; m >= 0 && m < p.length; m += schritt) {
        const weiter = m + schritt >= 0 && m + schritt < p.length && Math.abs(p[m + schritt][q] - p[m][q]) < EPS;
        p[m][q] = wert;
        if (!weiter) break;
      }
    };
    const n = p.length - 1;
    // Anfang: erstes Stueck ist waagrecht (A* wechselt die Ebene nicht in der Start- oder Zielzelle).
    const k0 = achse(p[0], p[1]), q0 = k0 === 0 ? 2 : 0;
    if (p.every((v) => Math.abs(v[q0] - p[0][q0]) < EPS)) {
      // Im Grundriss gerade: alles auf a[q] legen, querer Versatz zu b mitten im letzten Stueck.
      for (const v of p) v[q0] = a[q0];
      if (Math.abs(a[q0] - b[q0]) < EPS) return bereinigen([a, ...p.slice(1, n), b]);
      const vor = n === 1 ? a : p[n - 1], m = (vor[k0] + b[k0]) / 2, u: V3 = [...vor], v: V3 = [...b];
      u[k0] = m; u[q0] = a[q0]; v[k0] = m; v[1] = u[1];
      return bereinigen([a, ...p.slice(1, n), u, v, b]);
    }
    schieben(0, q0, a[q0], 1);
    const kn = achse(p[n - 1], p[n]), qn = kn === 0 ? 2 : 0;
    schieben(n, qn, b[qn], -1);
    return bereinigen([a, ...p.slice(1, n), b]);
  }

  weg(a: V3, b: V3, netz: string): V3[] {
    const ebenen = this.ebenenBei(a[1]);
    const [ia, ka] = zelleVon(this.b.gitter, a[0], a[2]), [ib, kb] = zelleVon(this.b.gitter, b[0], b[2]);
    const start = { y: ebenen.find((y) => Math.abs(y - a[1]) < 0.01) ?? a[1], i: ia, k: ka }, ziel = { y: start.y, i: ib, k: kb };
    if (ia === ib && ka === kb) return bereinigen([a, [b[0], a[1], a[2]], b]);
    const z = suchen(this.b, start, ziel, (c) => c.i === ib && c.k === kb && c.y === start.y, netz, ebenen, this.spur.get(netz));
    if (z) return this.alsPunkte(z, a, b);
    this.befunde.push({ regel: "kein_weg", leitungen: [netz], ort: a, hart: true });
    return bereinigen([a, [a[0], a[1], b[2]], [b[0], a[1], b[2]], b]);
  }

  /** Weg vom naechsten Punkt des eigenen Netzes zu u (T-Abzweig). null, wenn das Netz auf dieser Ebene fehlt oder kein Weg besteht. */
  wegZumNetz(u: V3, netz: string): V3[] | null {
    const ebenen = this.ebenenBei(u[1]);
    const y = ebenen.find((e) => Math.abs(e - u[1]) < 0.01);
    const eigene = (this.eigene.get(netz) ?? []).filter((s) => s.some((p) => Math.abs(p[1] - u[1]) < 0.01));
    if (y === undefined || !eigene.length) return null;
    const [i, k] = zelleVon(this.b.gitter, u[0], u[2]);
    const z = suchen(this.b, { y, i, k }, null, (c) => c.y === y && this.b.eigen(c.y, c.i, c.k, netz), netz, ebenen, this.spur.get(netz));
    if (!z) return null;
    const ende = z.at(-1)!, [ex, ez] = mitteVon(this.b.gitter, ende.i, ende.k);
    // Auf die tatsaechliche Rohrachse projizieren.
    let best: V3 = [ex, y, ez], d = Infinity;
    for (const s of eigene) for (let n = 1; n < s.length; n++) {
      const a = s[n - 1], b = s[n];
      if (Math.abs(a[1] - y) > 0.01 || Math.abs(b[1] - y) > 0.01) {
        if (Math.abs(a[0] - b[0]) < EPS && Math.abs(a[2] - b[2]) < EPS && y >= Math.min(a[1], b[1]) - EPS && y <= Math.max(a[1], b[1]) + EPS) {
          const e = Math.hypot(a[0] - ex, a[2] - ez); if (e < d) { d = e; best = [a[0], y, a[2]]; }
        }
        continue;
      }
      const ax: 0 | 2 = Math.abs(a[0] - b[0]) > EPS ? 0 : 2, p: V3 = [a[0], y, a[2]];
      p[ax] = Math.min(Math.max(ax === 0 ? ex : ez, Math.min(a[ax], b[ax])), Math.max(a[ax], b[ax]));
      const e = Math.hypot(p[0] - ex, p[2] - ez); if (e < d) { d = e; best = p; }
    }
    return this.alsPunkte(z, u, best).reverse();
  }

  /** Gruppenstrang (Ersatz fuer strangBaum): entferntestes Ziel zuerst, weitere als T-Abzweig; Geschosswechsel in der Steigzone. */
  strang(start: V3, ziele: StrangZiel[], spur: number, steigzone: { x: number; z: number } | null, netz: string): StrangBaum {
    const o = spur * SPUR;
    const steig: [number, number] = steigzone ? [steigzone.x + o, steigzone.z + o] : [start[0], start[2]];
    const gleich = (a: number, b: number) => Math.abs(a - b) < 1e-3;
    const kosten = (u: V3) => gleich(u[1], start[1]) ? Math.abs(u[0] - start[0]) + Math.abs(u[2] - start[2])
      : Math.abs(start[0] - steig[0]) + Math.abs(start[2] - steig[1]) + Math.abs(u[1] - start[1]) + Math.abs(u[0] - steig[0]) + Math.abs(u[2] - steig[1]);
    const sortiert = [...ziele].sort((a, b) => kosten(b.punkt) - kosten(a.punkt) || (a.schluessel < b.schluessel ? -1 : 1));
    const segmente: V3[][] = [], abzweige: StrangBaum["abzweige"] = [];
    const steigSegmente = () => segmente.flatMap((s) => s.slice(1).map((q, n) => [s[n], q] as [V3, V3]))
      .filter(([a, b]) => Math.abs(a[0] - b[0]) < EPS && Math.abs(a[2] - b[2]) < EPS && Math.abs(a[1] - b[1]) > EPS && gleich(a[0], steig[0]) && gleich(a[2], steig[1]));
    for (const { schluessel, punkt: u } of sortiert) {
      let punkte: V3[] | null = null;
      if (segmente.some((s) => s.some((p) => gleich(p[1], u[1])))) punkte = this.wegZumNetz(u, netz);
      if (!punkte) {
        if (gleich(u[1], start[1])) punkte = this.weg(start, u, netz);
        else {
          const kopf: V3 = [steig[0], u[1], steig[1]];
          const st = steigSegmente();
          let anfang: V3[];
          if (st.some(([a, b]) => u[1] >= Math.min(a[1], b[1]) - EPS && u[1] <= Math.max(a[1], b[1]) + EPS)) anfang = [kopf];
          else if (st.length) {
            const e = st.flat().reduce((m, q) => (Math.abs(q[1] - u[1]) < Math.abs(m[1] - u[1]) ? q : m));
            anfang = [e, kopf];
          } else {
            const fuss: V3 = [steig[0], start[1], steig[1]];
            const vorlauf = segmente.some((s) => s.some((p) => gleich(p[1], start[1]))) ? this.wegZumNetz(fuss, netz) ?? this.weg(start, fuss, netz) : this.weg(start, fuss, netz);
            anfang = [...vorlauf, kopf];
          }
          this.belegen(bereinigen(anfang), netz);
          const rest = this.weg(kopf, u, netz);
          punkte = bereinigen([...anfang, ...rest.slice(1)]);
        }
      }
      this.belegen(punkte, netz);
      if (punkte.length >= 2) segmente.push(punkte);
      abzweige.push({ schluessel, punkte });
    }
    return { segmente, abzweige };
  }
}
