import { geschossBeiY } from "../../szene2/leitungen";
import type { KatalogEintrag, Welt } from "../../typen";
import { bereinigen, type StrangBaum, type StrangZiel, SPUR } from "../gruppenNetz";
import { suchen, type Vorzug, type Zelle } from "./astern";
import { geraeteKoerper } from "./koerper";
import { pruefen } from "./pruefer";
import { Belegung, ebenenFuer, mitteVon, sperrabstand, zelleVon } from "./raster";
import { spurenZuteilen, spurWert, trassenLage, type Lage } from "./trasse";
import { ROHR } from "../technik";
import { boegen, segAbstand } from "./geometrie";
import { GRENZEN, ROUTER, type Befund, type PruefLeitung, type V3 } from "./typen";

const EPS = 1e-6;
const ERZEUGER = new Set(["heizung.waermepumpe", "heizung.gaskessel", "heizung.oelkessel", "heizung.fernwaerme_uebergabe"]);

/**
 * Entfernt kurze waagrechte Zwischenstuecke (< Rohrradius) zwischen zwei Nachbarstuecken, die sonst einander
 * naeher als der Radius kaemen (Pruefregel `selbst`): die anschliessende Kette wird auf die Querlage davor gelegt.
 * Vorwaerts, sonst rueckwaerts; eine Kette mit Steigstueck (Steigzone) wird nicht verschoben. Erreicht die Kette ein
 * Ende, bleibt der Endpunkt und der Versatz wandert als kurzer Stich ans Ende.
 */
export function ohneKurzstuecke(eingabe: V3[], radius: number = ROHR.haupt): V3[] {
  let p = bereinigen(eingabe.map((q) => [...q] as V3));
  const senkrecht = (u: V3, v: V3) => Math.abs(u[0] - v[0]) < EPS && Math.abs(u[2] - v[2]) < EPS;
  for (let runde = 0; runde < 20; runde++) {
    let geaendert = false;
    for (let i = 1; i + 2 < p.length && !geaendert; i++) {
      const a = p[i], b = p[i + 1];
      if (senkrecht(a, b) || Math.abs(a[1] - b[1]) > EPS) continue;
      const q: 0 | 2 = Math.abs(a[0] - b[0]) > EPS ? 0 : 2;
      if (Math.abs(a[q] - b[q]) >= radius - EPS) continue;
      // Kette ab Punkt j in Richtung schritt, solange das Stueck nicht entlang q laeuft.
      const kette = (j: number, schritt: 1 | -1) => {
        const idx: number[] = [];
        for (let m = j; m >= 0 && m < p.length; m += schritt) {
          idx.push(m);
          const n = m + schritt;
          if (n < 0 || n >= p.length || Math.abs(p[n][q] - p[m][q]) > EPS) break;
        }
        return idx;
      };
      const hatSteig = (idx: number[]) => idx.some((m, t) => t > 0 && senkrecht(p[idx[t - 1]], p[m]) && Math.abs(p[idx[t - 1]][1] - p[m][1]) > EPS);
      for (const [j, schritt, wert] of [[i + 1, 1, a[q]], [i, -1, b[q]]] as [number, 1 | -1, number][]) {
        const idx = kette(j, schritt);
        if (hatSteig(idx)) continue;
        const ende = idx.at(-1)!, randErreicht = ende === 0 || ende === p.length - 1;
        const rand: V3 = [...p[ende]];
        for (const m of idx) p[m][q] = wert;
        if (randErreicht) p = schritt === 1 ? [...p, rand] : [rand, ...p];
        p = bereinigen(p);
        geaendert = true;
        break;
      }
    }
    if (!geaendert) break;
  }
  return p;
}

/** Waagrechte Richtung als Index der A*-Schritte (0: +x, 1: -x, 2: +z, 3: -z); undefined ohne eindeutige Achse. */
function rasterRichtung(d?: V3): number | undefined {
  if (!d || Math.abs(d[1]) > EPS) return undefined;
  if (Math.abs(d[0]) > EPS && Math.abs(d[2]) < EPS) return d[0] > 0 ? 0 : 1;
  if (Math.abs(d[2]) > EPS && Math.abs(d[0]) < EPS) return d[2] > 0 ? 2 : 3;
  return undefined;
}

export class LeitungsRouter {
  readonly befunde: Befund[] = [];
  private b: Belegung;
  private ebenen: Map<string, number[]>;
  private eigene = new Map<string, V3[][]>();
  /** Alle vor- und verlegten Stuecke (auch ausserhalb der Leitungsebenen, z. B. Stummel auf Stutzenhoehe). */
  private alle: V3[][] = [];
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

  /** `radius`: Rohrradius fuer den Sperrabstand (Vorgabe Hauptrohr). */
  vorbelegen(punkte: V3[], netz: string, radius: number = ROHR.haupt) { this.b.belegen(punkte, netz, radius); this.alle.push(punkte); }
  /**
   * `offen`: Endpunkte, an denen ein Anschluss mit anderen Verbindungen geteilt wird; das End- bzw. Anfangsstueck wird
   * dort auf Sperrabstand plus eine Zelle nur fuer `basis` belegt (Teilnetze von `basis` duerfen hinein).
   */
  belegen(punkte: V3[], netz: string, radius: number = ROHR.haupt, offen: V3[] = [], basis: string = netz) {
    this.alle.push(punkte);
    const nah = (p: V3) => offen.some((q) => Math.abs(q[0] - p[0]) < EPS && Math.abs(q[1] - p[1]) < EPS && Math.abs(q[2] - p[2]) < EPS);
    const L = sperrabstand(radius) + ROUTER.zelle;
    let rest = punkte;
    const schneiden = (von: V3, nach: V3): V3 => {
      const d = Math.hypot(nach[0] - von[0], nach[1] - von[1], nach[2] - von[2]), t = Math.min(1, L / Math.max(d, EPS));
      return [von[0] + (nach[0] - von[0]) * t, von[1] + (nach[1] - von[1]) * t, von[2] + (nach[2] - von[2]) * t];
    };
    if (rest.length >= 2 && nah(rest[0])) {
      const c = schneiden(rest[0], rest[1]); this.b.belegen([rest[0], c], basis, radius); rest = [c, ...rest.slice(1)];
    }
    if (rest.length >= 2 && nah(rest.at(-1)!)) {
      const c = schneiden(rest.at(-1)!, rest.at(-2)!); this.b.belegen([c, rest.at(-1)!], basis, radius); rest = [...rest.slice(0, -1), c];
    }
    this.b.belegen(rest, netz, radius);
    const l = this.eigene.get(netz) ?? []; l.push(punkte); this.eigene.set(netz, l);
  }

  /** Trassenspur eines Netzes; Teilnetze `netz~schluessel` (Strang) erben die Spur des Basisnetzes. */
  private spurFuer(netz: string): Vorzug | undefined {
    return this.spur.get(netz) ?? this.spur.get(netz.split("~")[0]);
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
   * zwischen a und b erhaelt am Ende ein L (kein Versatz in der Mitte).
   */
  private alsPunkte(zellen: Zelle[], a: V3, b: V3, radius: number): V3[] {
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
      // Im Grundriss gerade: alles auf a[q] legen.
      for (const v of p) v[q0] = a[q0];
      if (Math.abs(a[q0] - b[q0]) < EPS) return bereinigen([a, ...p.slice(1, n), b]);
      // Querversatz als L am Ende: Lauf und Endstich sind Nachbarn, kein Selbstabstand.
      const e: V3 = [...p[n]]; e[k0] = b[k0];
      return bereinigen([a, ...p.slice(1, n), e, b]);
    }
    schieben(0, q0, a[q0], 1);
    const kn = achse(p[n - 1], p[n]), qn = kn === 0 ? 2 : 0;
    schieben(n, qn, b[qn], -1);
    return ohneKurzstuecke([a, ...p.slice(1, n), b], radius);
  }

  /**
   * Spart Boegen nach dem Einrasten: Versatz (Z: zwei gleich gerichtete Stuecke mit kurzem Querstueck) wird durch
   * Verschieben eines Nachbarstuecks auf die Querlage des anderen begradigt, ein Haken (Hin- und Rueckstueck um ein
   * Querstueck) durch Verschieben des Querstuecks. Nur innere Punkte bewegen sich; angenommen wird eine Variante nur,
   * wenn alle ihre Zellen fuer das Netz frei sind, sie befundfrei ist, weniger Boegen hat und nicht weniger Laenge auf
   * der Trassenspur des Netzes.
   */
  private glaetten(eingabe: V3[], netz: string, radius: number, spurHalten = true, durch: string = netz): V3[] {
    let p = eingabe;
    const vorzug = spurHalten ? this.spurFuer(netz) : undefined;
    const aufSpur = (w: V3[]) => !vorzug ? 0 : w.slice(1).reduce((m, q, n) => {
      const a = w[n], quer = vorzug.achse === 0 ? 2 : 0;
      const entlang = Math.abs(a[quer] - q[quer]) < EPS && Math.abs(a[1] - q[1]) < EPS;
      return m + (entlang && Math.abs(a[quer] - vorzug.wert) < ROUTER.zelle / 2 + EPS ? Math.abs(q[vorzug.achse] - a[vorzug.achse]) : 0);
    }, 0);
    const waag = (u: V3, v: V3) => Math.abs(u[1] - v[1]) < EPS && (Math.abs(u[0] - v[0]) > EPS) !== (Math.abs(u[2] - v[2]) > EPS);
    const achse = (u: V3, v: V3): 0 | 2 => (Math.abs(u[0] - v[0]) > EPS ? 0 : 2);
    const zellenFrei = (w: V3[]) => w.slice(1).every((q, n) => {
      const a = w[n];
      if (!waag(a, q)) return true;
      const [i0, k0] = zelleVon(this.b.gitter, a[0], a[2]), [i1, k1] = zelleVon(this.b.gitter, q[0], q[2]);
      for (let i = Math.min(i0, i1); i <= Math.max(i0, i1); i++) for (let k = Math.min(k0, k1); k <= Math.max(k0, k1); k++) {
        const ende = (i === i0 && k === k0 && n === 0) || (i === i1 && k === k1 && n === w.length - 2);
        if (!ende && !this.b.frei(a[1], i, k, durch)) return false;
      }
      return true;
    });
    for (let runde = 0; runde < 10; runde++) {
      let besser: V3[] | null = null;
      for (let i = 1; i + 2 < p.length && !besser; i++) {
        const [a, b, c, d] = [p[i - 1], p[i], p[i + 1], p[i + 2]];
        if (!waag(a, b) || !waag(b, c) || !waag(c, d)) continue;
        const k = achse(a, b), q = achse(b, c);
        if (k === q || achse(c, d) !== k) continue;
        const kandidaten: V3[][] = [];
        const setze = (idx: number[], ax: 0 | 2, wert: number) => {
          const w = p.map((v) => [...v] as V3); for (const j of idx) w[j][ax] = wert; return w;
        };
        if (Math.sign(b[k] - a[k]) === Math.sign(d[k] - c[k])) {
          // Versatz: Stueck c-d auf die Querlage von b legen (d innen, danach ein Stueck entlang q) oder a-b auf die von c.
          if (i + 3 < p.length && waag(d, p[i + 3]) && achse(d, p[i + 3]) === q) kandidaten.push(setze([i + 1, i + 2], q, b[q]));
          if (i - 2 >= 0 && waag(p[i - 2], a) && achse(p[i - 2], a) === q) kandidaten.push(setze([i - 1, i], q, c[q]));
        } else {
          // Haken: Querstueck auf das Ende des einen Laengsstuecks legen, das andere entfaellt.
          kandidaten.push(setze([i, i + 1], k, d[k]), setze([i, i + 1], k, a[k]));
        }
        for (const roh of kandidaten) {
          const w = bereinigen(roh);
          if (w.length >= 2 && boegen(w) < boegen(p) && aufSpur(w) >= aufSpur(p) - 1e-6 && zellenFrei(w) && this.befundfrei(w, netz, radius)) { besser = w; break; }
        }
      }
      if (!besser) break;
      p = besser;
    }
    return p;
  }

  /**
   * `radius`: Rohrradius, unter dem kurze Zwischenstuecke entfernt werden (Vorgabe Hauptrohr).
   * `abgang`: Richtung der waagrechten Anschlussstuecke, die in a enden bzw. in b enden (Adapter); der Lauf setzt sie
   * fort und fuehrt nicht ueber sie zurueck.
   */
  weg(a: V3, b: V3, netz: string, radius: number = ROHR.haupt, abgang: { a?: V3; b?: V3 } = {}): V3[] {
    const ebenen = this.ebenenBei(a[1]);
    const [ia, ka] = zelleVon(this.b.gitter, a[0], a[2]), [ib, kb] = zelleVon(this.b.gitter, b[0], b[2]);
    const start = { y: ebenen.find((y) => Math.abs(y - a[1]) < 0.01) ?? a[1], i: ia, k: ka }, ziel = { y: start.y, i: ib, k: kb };
    if (ia === ib && ka === kb) return bereinigen([a, [b[0], a[1], a[2]], b]);
    const z = suchen(this.b, start, ziel, (c) => c.i === ib && c.k === kb && c.y === start.y, netz, ebenen, this.spurFuer(netz),
      { start: rasterRichtung(abgang.a), zielVerbot: rasterRichtung(abgang.b) });
    if (z) return this.glaetten(this.alsPunkte(z, a, b, radius), netz, radius);
    this.befunde.push({ regel: "kein_weg", leitungen: [netz.split("~")[0]], ort: a, hart: true });
    return bereinigen([a, [a[0], a[1], b[2]], [b[0], a[1], b[2]], b]);
  }

  /**
   * Weg vom eigenen Netz zu u (T-Abzweig), Anfang auf dem Netz, Ende in u. Zuerst gerade bzw. L-foermige Stiche auf
   * waagrechte Stuecke, durchlaufende Steigleitungen und innere Eckpunkte; T-Punkte auf Stuecken halten den Rohrabstand
   * (2 radius + Fuge) zu jedem Eckpunkt (auch zu Enden). `radius`: Rohrradius des Netzes fuer die Pruefung (Vorgabe Hauptrohr);
   * `durch`: Name fuer die Belegungspruefung (Teilnetz `netz~x` mit eigener Reservierung). Sonst A* auf zulaessige Achszellen. Jeder Kandidat muss frei und befundfrei sein.
   * null, wenn das Netz auf dieser Ebene fehlt oder kein zulaessiger Stich besteht.
   */
  wegZumNetz(u: V3, netz: string, radius: number = ROHR.haupt, durch: string = netz): V3[] | null {
    const ABSTAND = 2 * radius + GRENZEN.fuge;
    const ebenen = this.ebenenBei(u[1]);
    const y = ebenen.find((e) => Math.abs(e - u[1]) < 0.01);
    const alle = this.eigene.get(netz) ?? [];
    if (y === undefined || !alle.some((s) => s.some((p) => Math.abs(p[1] - u[1]) < 0.01))) return null;
    const aufY = (p: V3) => Math.abs(p[1] - y) < 0.01;
    const stuecke = alle.flatMap((s) => s.slice(1).map((q, n) => [s[n], q] as [V3, V3]));
    const ecken = alle.flat();
    const stiche = (t: V3): V3[][] => Math.abs(t[0] - u[0]) < EPS || Math.abs(t[2] - u[2]) < EPS ? [[t, u]]
      : [[t, [u[0], y, t[2]], u], [t, [t[0], y, u[2]], u]];
    const kandidaten: V3[][] = [];
    for (const [a, b] of stuecke) {
      if (aufY(a) && aufY(b)) {
        const ax: 0 | 2 = Math.abs(a[0] - b[0]) > EPS ? 0 : 2, q = ax === 0 ? 2 : 0;
        const lo = Math.min(a[ax], b[ax]) + ABSTAND, hi = Math.max(a[ax], b[ax]) - ABSTAND;
        if (lo > hi) continue;
        // T-Punkt moeglichst auf Hoehe von u, sonst knapp ausserhalb der Sperrzone eines Eckpunkts.
        const lagen = [u[ax], lo, hi, ...ecken.filter((e) => aufY(e) && Math.abs(e[q] - a[q]) < ABSTAND).flatMap((e) => [e[ax] - ABSTAND, e[ax] + ABSTAND])];
        for (const l of [...new Set(lagen.map((v) => Math.min(Math.max(v, lo), hi)))]) {
          const t: V3 = [0, y, 0]; t[ax] = l; t[q] = a[q];
          if (ecken.some((e) => aufY(e) && Math.hypot(e[0] - t[0], e[2] - t[2]) < ABSTAND - EPS)) continue;
          kandidaten.push(...stiche(t));
        }
      } else if (Math.abs(a[0] - b[0]) < EPS && Math.abs(a[2] - b[2]) < EPS && y > Math.min(a[1], b[1]) + 0.01 && y < Math.max(a[1], b[1]) - 0.01) {
        kandidaten.push(...stiche([a[0], y, a[2]]));
      }
    }
    for (const s of alle) for (let n = 1; n < s.length - 1; n++) if (aufY(s[n])) kandidaten.push(...stiche([s[n][0], y, s[n][2]]));
    const laenge = (w: V3[]) => w.slice(1).reduce((m, q, n) => m + Math.abs(q[0] - w[n][0]) + Math.abs(q[2] - w[n][2]), 0);
    const sortiert = kandidaten.map((w, n) => ({ w: bereinigen(w), n })).sort((a, b) => laenge(a.w) - laenge(b.w) || a.n - b.n);
    for (const { w } of sortiert) if (this.zulaessig(w, y, netz, radius, durch)) return w;
    // Rueckfall A*: Ziel sind eigene Achszellen mit ABSTAND + Zelle zu allen Eckpunkten.
    const [i, k] = zelleVon(this.b.gitter, u[0], u[2]);
    const fern = (c: Zelle) => { const [x, z] = mitteVon(this.b.gitter, c.i, c.k); return ecken.every((e) => Math.hypot(e[0] - x, e[2] - z) >= ABSTAND + ROUTER.zelle); };
    const z = suchen(this.b, { y, i, k }, null, (c) => c.y === y && this.b.eigen(c.y, c.i, c.k, netz) && fern(c), durch, ebenen, this.spurFuer(netz));
    if (!z) return null;
    const ende = z.at(-1)!;
    let [ex, ez] = mitteVon(this.b.gitter, ende.i, ende.k);
    // Gerader Zellpfad: alsPunkte legt den Lauf auf u, also auch dort auf die Rohrachse treffen.
    if (z.every((c) => c.i === i)) ex = u[0];
    if (z.every((c) => c.k === k)) ez = u[2];
    let best: V3 | null = null, d = Infinity;
    for (const [a, b] of stuecke) {
      if (!aufY(a) || !aufY(b)) continue;
      const ax: 0 | 2 = Math.abs(a[0] - b[0]) > EPS ? 0 : 2, p: V3 = [a[0], y, a[2]];
      p[ax] = Math.min(Math.max(ax === 0 ? ex : ez, Math.min(a[ax], b[ax])), Math.max(a[ax], b[ax]));
      const e = Math.hypot(p[0] - ex, p[2] - ez); if (e < d) { d = e; best = p; }
    }
    if (!best) return null;
    const w = this.alsPunkte(z, u, best, radius).reverse();
    return this.zulaessig(w, y, netz, radius, durch) ? w : null;
  }

  /** Stich (waagrecht auf y) ist frei fuer das Netz (ausser in der Zelle von u am Ende) und erzeugt mit dem eigenen Netz keinen harten Befund. */
  private zulaessig(w: V3[], y: number, netz: string, radius: number, durch: string): boolean {
    if (w.length < 2) return false;
    const u = w.at(-1)!, [iu, ku] = zelleVon(this.b.gitter, u[0], u[2]);
    // Liegt u im Aussenrand, darf der Stich die Randzellen bis zum Inneren nutzen (wie in suchen).
    const rand = !this.b.innen(iu, ku), RAND = Math.ceil(ROUTER.aussenRand / ROUTER.zelle);
    for (let n = 1; n < w.length; n++) {
      const [i0, k0] = zelleVon(this.b.gitter, w[n - 1][0], w[n - 1][2]), [i1, k1] = zelleVon(this.b.gitter, w[n][0], w[n][2]);
      for (let i = Math.min(i0, i1); i <= Math.max(i0, i1); i++) for (let k = Math.min(k0, k1); k <= Math.max(k0, k1); k++) {
        const nah = rand && Math.max(Math.abs(i - iu), Math.abs(k - ku)) <= RAND;
        if (!(i === iu && k === ku) && !this.b.frei(y, i, k, durch, nah)) return false;
      }
    }
    // Kein Stichstueck laeuft parallel naeher als der Rohrabstand an einem eigenen Stueck entlang.
    const grenze = 2 * radius + GRENZEN.fuge;
    for (const s of this.eigene.get(netz) ?? []) for (let m = 1; m < s.length; m++) {
      const c = s[m - 1], d = s[m];
      if (Math.abs(c[1] - y) > 0.01 || Math.abs(d[1] - y) > 0.01) continue;
      for (let n = 1; n < w.length; n++) {
        const a = w[n - 1], b = w[n];
        const ax = Math.abs(a[0] - b[0]) > EPS ? 0 : 2, cx = Math.abs(c[0] - d[0]) > EPS ? 0 : 2, q = ax === 0 ? 2 : 0;
        if (ax !== cx || Math.abs(a[q] - c[q]) >= grenze - EPS) continue;
        const ueber = Math.min(Math.max(a[ax], b[ax]), Math.max(c[ax], d[ax])) - Math.max(Math.min(a[ax], b[ax]), Math.min(c[ax], d[ax]));
        // Kurzer Parallellauf direkt an einem gemeinsamen Punkt (Abzweig am Eckpunkt) ist zulaessig.
        const amGemeinsam = ueber < grenze && [c, d].some((e) => Math.abs(e[0] - w[0][0]) < 1e-4 && Math.abs(e[2] - w[0][2]) < 1e-4);
        if (ueber > EPS && !amGemeinsam) return false;
      }
    }
    return this.befundfrei(w, netz, radius);
  }

  /** Keine harten Pruefbefunde der Polylinie w mit sich selbst oder mit dem bisher verlegten eigenen Netz. */
  private befundfrei(w: V3[], netz: string, radius: number): boolean {
    const linie = (id: string, punkte: V3[]): PruefLeitung => ({ id, netz, punkte, radius, enden: [] });
    const eigene = (this.eigene.get(netz) ?? []).map((s, n) => linie(`e${n}`, s));
    return !pruefen([linie("neu", w), ...eigene], []).some((f) => f.hart && f.leitungen.includes("neu"));
  }

  /**
   * Lage der Steigleitung: Vorzugslage (Steigzone plus Spurversatz), sonst quer zur Spurdiagonale in Zellschritten
   * versetzt, bis die senkrechte Leitung ueber den ganzen Hoehenbereich Abstand zu allen bisherigen Stuecken haelt
   * (auch zu Stummeln auf Stutzenhoehe, die keine Leitungsebene belegen) und ihre Zellen frei sind.
   */
  private steigLage(x0: number, z0: number, start: V3, ziele: StrangZiel[], netz: string): [number, number] {
    const ys = [start[1], ...ziele.map((z) => z.punkt[1])];
    const lo = Math.min(...ys), hi = Math.max(...ys);
    if (hi - lo < 1e-3) return [x0, z0];
    const grenze = sperrabstand(ROHR.verteil);
    const ok = (x: number, z: number) => {
      const [i, k] = zelleVon(this.b.gitter, x, z);
      if (this.ebenen.size && ys.some((y) => !this.b.frei(this.ebenenBei(y).find((e) => Math.abs(e - y) < 0.01) ?? y, i, k, netz))) return false;
      return !this.alle.some((s) => s.slice(1).some((q, n) => segAbstand([x, lo, z], [x, hi, z], s[n], q).d < grenze));
    };
    for (let k = 0; k <= 6; k++) for (const d of k ? [k, -k] : [0]) {
      const x = x0 + d * ROUTER.zelle, z = z0 - d * ROUTER.zelle;
      if (ok(x, z)) return [x, z];
    }
    return [x0, z0];
  }

  /** Gruppenstrang (Ersatz fuer strangBaum): entferntestes Ziel zuerst, weitere als T-Abzweig; Geschosswechsel in der Steigzone. */
  strang(start: V3, ziele: StrangZiel[], spur: number, steigzone: { x: number; z: number } | null, netz: string): StrangBaum {
    const o = spur * SPUR;
    const steig: [number, number] = steigzone ? this.steigLage(steigzone.x + o, steigzone.z + o, start, ziele, netz) : [start[0], start[2]];
    const gleich = (a: number, b: number) => Math.abs(a - b) < 1e-3;
    const kosten = (u: V3) => gleich(u[1], start[1]) ? Math.abs(u[0] - start[0]) + Math.abs(u[2] - start[2])
      : Math.abs(start[0] - steig[0]) + Math.abs(start[2] - steig[1]) + Math.abs(u[1] - start[1]) + Math.abs(u[0] - steig[0]) + Math.abs(u[2] - steig[1]);
    const sortiert = [...ziele].sort((a, b) => kosten(b.punkt) - kosten(a.punkt) || (a.schluessel < b.schluessel ? -1 : 1));
    const segmente: V3[][] = [], abzweige: StrangBaum["abzweige"] = [];
    const steigSegmente = () => segmente.flatMap((s) => s.slice(1).map((q, n) => [s[n], q] as [V3, V3]))
      .filter(([a, b]) => Math.abs(a[0] - b[0]) < EPS && Math.abs(a[2] - b[2]) < EPS && Math.abs(a[1] - b[1]) > EPS && gleich(a[0], steig[0]) && gleich(a[2], steig[1]));
    // Jedes Ziel reserviert seine Umgebung; nur der eigene Abzweig (Teilnetz netz~schluessel) darf hinein.
    for (const { schluessel, punkt } of sortiert) this.b.reservieren(punkt, `${netz}~${schluessel}`, ROHR.verteil);
    for (const { schluessel, punkt: u } of sortiert) {
      const durch = `${netz}~${schluessel}`;
      let punkte: V3[] | null = null;
      if (segmente.some((s) => s.some((p) => gleich(p[1], u[1])))) punkte = this.wegZumNetz(u, netz, ROHR.verteil, durch);
      if (!punkte) {
        if (gleich(u[1], start[1])) punkte = this.weg(start, u, durch, ROHR.verteil);
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
            const vorlauf = segmente.some((s) => s.some((p) => gleich(p[1], start[1]))) ? this.wegZumNetz(fuss, netz, ROHR.verteil, durch) ?? this.weg(start, fuss, durch, ROHR.verteil) : this.weg(start, fuss, durch, ROHR.verteil);
            anfang = [...vorlauf, kopf];
          }
          this.vorbelegen(bereinigen(anfang), netz, ROHR.verteil);
          const rest = this.weg(kopf, u, durch, ROHR.verteil);
          // Kurzstueck an der Steigleitung entfernen, aber nur, wenn das Ergebnis mit dem eigenen Netz befundfrei bleibt.
          const roh = bereinigen([...anfang, ...rest.slice(1)]), glatt = ohneKurzstuecke(roh, ROHR.verteil);
          punkte = this.befundfrei(glatt, netz, ROHR.verteil) || !this.befundfrei(roh, netz, ROHR.verteil) ? glatt : roh;
        }
      }
      // Ueber dem Bogenlimit darf die Begradigung die Trassenspur verlassen (Pruefregel boegen hat Vorrang).
      if (boegen(punkte) > GRENZEN.maxBoegen) punkte = this.glaetten(punkte, netz, ROHR.verteil, false, durch);
      this.belegen(punkte, netz, ROHR.verteil);
      if (punkte.length >= 2) segmente.push(punkte);
      abzweige.push({ schluessel, punkte });
    }
    return { segmente, abzweige };
  }
}
