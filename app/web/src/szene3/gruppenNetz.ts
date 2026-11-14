import type { V3 } from "../szene2/huelle";
import { geschossBeiY } from "../szene2/leitungen";
import type { GruppenArt, KatalogEintrag, Rechteck, Welt, WeltSymbol } from "../typen";
import { einheitVon, kantenNetz, partnerVon, steigBereich, verbindungen, type Rohrstueck, type Verbindung } from "./netz";
import { routerAnschluss } from "./router/anschluss";
import { geraeteKoerper } from "./router/koerper";
import { LeitungsRouter } from "./router/router";
import { alsBaum } from "./router/topologie";
import { GRENZEN } from "./router/typen";
import { anschlussFuehrung, anschlussLokal, deckenLauf, inlineLaenge, modellFuer, ROHR, verteilerAbgang, verteilerModell, type AnzeigeSymbol } from "./technik";

/** Ein Rohr je Gruppe (Spec 6): Abgang am Verteiler, Gruppenstock, Strang mit T-Abzweigen. */
export interface GruppenStrang {
  gruppeId: string; verteiler: string; abgangIndex: number; verbraucher: string[]; zubehoer: string[];
  art: GruppenArt; nummer: number; bezeichnung: string;
  /** Ersatzgruppe aus einer bisherigen Verteilerverbindung (v1-Welt oder Abgabe ohne Gruppe, Spec 6.9). */
  ersatz: boolean;
}

/** Spurabstand paralleler Gruppenleitungen auf der Leitungsebene [A] (Spec 6.5, Startwert). */
export const SPUR = 0.18;

const vergleich = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
/** Schlüssel einer Ersatzgruppe; stabil, solange Verteiler und Ziel bestehen. */
export const ersatzGruppeId = (von: string, nach: string) => `ersatz:${von}>${nach}`;

/**
 * Stränge je Gruppe. v2: aus `welt.gruppen`; bisherige Verteilerverbindungen, deren Ziel in keiner Gruppe liegt
 * (z. B. Unterverteiler → FBH-Kreise), werden je eigene Ersatzgruppe «ungeregelt». v1 ohne Gruppen: jede bisherige
 * Verteilerverbindung ist eine Ersatzgruppe (Spec 6.9). Abgänge je Verteiler in Reihenfolge der Gruppennummer.
 */
export function gruppenVerbindungen(welt: Welt, katalog: KatalogEintrag[]): GruppenStrang[] {
  const vorhanden = new Set(welt.symbole.map((s) => s.schluessel));
  const vergeben = new Set<string>();
  const straenge: Omit<GruppenStrang, "abgangIndex">[] = [];
  const gruppen = [...(welt.gruppen ?? [])].sort((a, b) => vergleich(a.verteiler, b.verteiler) || a.nummer - b.nummer || vergleich(a.id, b.id));
  for (const g of gruppen) {
    if (!vorhanden.has(g.verteiler)) continue;
    // Ein Verbraucher gehört höchstens einer Gruppe (DB-Eindeutigkeit); bei widersprüchlichen Daten gewinnt die erste.
    const verbraucher = g.verbraucher.filter((v) => vorhanden.has(v) && v !== g.verteiler && !vergeben.has(v));
    verbraucher.forEach((v) => vergeben.add(v));
    const zubehoer = [...new Set([...g.zubehoer,
      ...welt.symbole.filter((s) => s.ort && "gruppe" in s.ort && s.ort.gruppe === g.id).map((s) => s.schluessel)])]
      .filter((z) => vorhanden.has(z));
    straenge.push({ gruppeId: g.id, verteiler: g.verteiler, verbraucher, zubehoer, art: g.art, nummer: g.nummer, bezeichnung: g.bezeichnung, ersatz: false });
  }
  const nummern = new Map<string, number>();
  for (const s of straenge) nummern.set(s.verteiler, Math.max(nummern.get(s.verteiler) ?? 0, s.nummer));
  const verteiler = new Set(welt.symbole.filter((s) => katalog.find((k) => k.id === s.katalogId)?.bereich === "verteilung" || s.katalogId === "heizung.verteiler").map((s) => s.schluessel));
  for (const v of verbindungen(welt, katalog)) {
    if (v.art !== "verteil" || !verteiler.has(v.von) || vergeben.has(v.nach)) continue;
    // In v2 hängen Unterverteiler und Abgaben mit Gruppe nur an ihrer Gruppe, nie zusätzlich an einer Ersatzleitung.
    if (welt.gruppen && straenge.some((s) => s.verteiler !== v.von && s.verbraucher.includes(v.nach))) continue;
    // Versorgung einer ganzen Einheit ist in v2 durch die Gruppe mit einem Verbraucher in dieser Einheit dargestellt.
    if (welt.gruppen && !vorhanden.has(v.nach) && [...vergeben].some((k) => {
      const s = welt.symbole.find((x) => x.schluessel === k);
      return !!s && einheitVon(welt, s)?.id === v.nach;
    })) continue;
    vergeben.add(v.nach);
    const nummer = (nummern.get(v.von) ?? 0) + 1;
    nummern.set(v.von, nummer);
    straenge.push({ gruppeId: ersatzGruppeId(v.von, v.nach), verteiler: v.von, verbraucher: [v.nach], zubehoer: [],
      art: "ungeregelt", nummer, bezeichnung: "", ersatz: true });
  }
  const zaehler = new Map<string, number>();
  return straenge.map((s) => {
    const abgangIndex = zaehler.get(s.verteiler) ?? 0;
    zaehler.set(s.verteiler, abgangIndex + 1);
    return { ...s, abgangIndex };
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Strang und T-Abzweige (Spec 6.3–6.5)
// ---------------------------------------------------------------------------------------------------------------

export interface StrangZiel { schluessel: string; punkt: V3 }
export interface StrangBaum { segmente: V3[][]; abzweige: { schluessel: string; punkte: V3[] }[] }

const EPS = 1e-6;
const gleich = (a: V3, b: V3) => Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS && Math.abs(a[2] - b[2]) < EPS;

/** Entfernt doppelte und kollineare Zwischenpunkte; Endpunkte bleiben unverändert. */
export function bereinigen(punkte: V3[]): V3[] {
  const p: V3[] = [];
  for (const q of punkte) {
    if (p.length && gleich(p[p.length - 1], q)) continue;
    p.push(q);
    while (p.length >= 3) {
      const [a, b, c] = p.slice(-3);
      const achse = (u: V3, v: V3) => [0, 1, 2].filter((i) => Math.abs(u[i] - v[i]) > EPS);
      const ab = achse(a, b), bc = achse(b, c);
      if (ab.length !== 1 || bc.length !== 1 || ab[0] !== bc[0] || Math.sign(b[ab[0]] - a[ab[0]]) !== Math.sign(c[ab[0]] - b[ab[0]])) break;
      p.splice(p.length - 2, 1);
    }
  }
  return p;
}

/** Rechtwinkliger Weg auf einer Ebene: zuerst in z bis zur Linie, dann in x, dann in z zum Ziel. */
function lWeg(a: V3, b: V3, zLinie: number): V3[] {
  return bereinigen([a, [a[0], a[1], zLinie], [b[0], a[1], zLinie], [b[0], a[1], b[2]], b]);
}

type Achse = 0 | 1 | 2 | null;
interface Strangpunkt { punkt: V3; achse: Achse }

/**
 * Strang zum entferntesten Ziel, jedes weitere Ziel rechtwinklig an den nächsten Punkt des bisherigen Strangs.
 * Geschosswechsel nur in der Steigzone (versetzt um die Spur); deterministisch nach Entfernung, dann Schlüssel.
 * `start` und die Zielpunkte liegen auf ihrer Leitungsebene (`ebenen`: Geschoss → Höhe der Leitungsebene).
 * `hindernisse`: Leitungen anderer Gruppen; unter gleichwertigen Wegvarianten gewinnt die konfliktärmste.
 */
export function strangBaum(start: V3, ziele: StrangZiel[], spur: number, steigzone: { x: number; z: number } | null,
  ebenen: Map<string, number>, hindernisse: V3[][] = []): StrangBaum {
  const o = spur * SPUR;
  const hoehen = [...ebenen.values()];
  // Zielhöhen auf die nächste Leitungsebene ziehen (Rundungsrauschen aus Modell-Ankern).
  const ebene = (y: number) => hoehen.reduce((b, h) => (Math.abs(h - y) < Math.abs(b - y) && Math.abs(h - y) < 0.05 ? h : b), y);
  const steig: [number, number] = steigzone ? [steigzone.x + o, steigzone.z + o] : [start[0], start[2]];
  const linie = (a: V3, u: V3) => u[2] - (Math.sign(u[2] - a[2]) || 1) * o;
  const gleicheEbene = (a: number, b: number) => Math.abs(a - b) < 1e-3;
  const kosten = (u: V3) => gleicheEbene(u[1], start[1]) ? Math.abs(u[0] - start[0]) + Math.abs(u[2] - start[2])
    : Math.abs(start[0] - steig[0]) + Math.abs(start[2] - steig[1]) + Math.abs(u[1] - start[1]) + Math.abs(u[0] - steig[0]) + Math.abs(u[2] - steig[1]);
  const sortiert = ziele.map((z) => ({ schluessel: z.schluessel, punkt: [z.punkt[0], ebene(z.punkt[1]), z.punkt[2]] as V3 }))
    .sort((a, b) => kosten(b.punkt) - kosten(a.punkt) || vergleich(a.schluessel, b.schluessel));
  const segmente: V3[][] = [];
  const abzweige: StrangBaum["abzweige"] = [];

  /** Nächster Punkt des bisherigen Strangs auf Höhe y (Projektion auf waagrechte, Schnitt mit senkrechten Stücken). */
  const naechster = (ziel: V3, y: number, mitStart: boolean): Strangpunkt | null => {
    const kandidaten: Strangpunkt[] = mitStart && gleicheEbene(start[1], y) ? [{ punkt: start, achse: null }] : [];
    for (const s of segmente) for (let i = 1; i < s.length; i++) {
      const a = s[i - 1], b = s[i];
      if (gleicheEbene(a[1], y) && gleicheEbene(b[1], y)) {
        const achse: 0 | 2 = Math.abs(a[0] - b[0]) > EPS ? 0 : 2;
        const p: V3 = [a[0], y, a[2]];
        p[achse] = Math.min(Math.max(ziel[achse], Math.min(a[achse], b[achse])), Math.max(a[achse], b[achse]));
        kandidaten.push({ punkt: p, achse });
      } else if (Math.abs(a[0] - b[0]) < EPS && Math.abs(a[2] - b[2]) < EPS && y >= Math.min(a[1], b[1]) - EPS && y <= Math.max(a[1], b[1]) + EPS) {
        kandidaten.push({ punkt: [a[0], y, a[2]], achse: 1 });
      }
    }
    let best: Strangpunkt | null = null, d = Infinity;
    for (const k of kandidaten) {
      const e = Math.hypot(k.punkt[0] - ziel[0], k.punkt[2] - ziel[2]);
      if (e < d - EPS) { best = k; d = e; }
    }
    return best;
  };
  const xWeg = (a: V3, u: V3) => bereinigen([a, [u[0], a[1], a[2]], u]);
  /** Varianten in Vorzugsreihenfolge; gewählt wird die erste mit den wenigsten Konflikten mit fremden Leitungen. */
  const wahl = (wege: V3[][]) => hindernisse.length ? wege.map((w, i) => ({ w, i, k: konflikte(w, hindernisse) }))
    .sort((a, b) => a.k - b.k || a.i - b.i)[0].w : wege[0];
  /** Ausweichlinien im Spurraster um die Vorzugslinie [A]: bis 10 Spuren je Seite. */
  const linien = (basis: number) => [basis, ...Array.from({ length: 10 }, (_, i) => [basis + (i + 1) * SPUR, basis - (i + 1) * SPUR]).flat()];
  const zWege = (a: V3, u: V3) => linien(linie(a, u)).map((z) => lWeg(a, u, z));
  /** Abzweig vom Strang: rechtwinklig weg, zuletzt in z zum Ziel; ab Start oder Steigleitung mit Varianten. */
  const abzweig = (p: Strangpunkt, u: V3): V3[] => p.achse === 0 || p.achse === 2
    ? bereinigen([p.punkt, [u[0], u[1], p.punkt[2]], u])
    : wahl(p.achse === 1 ? [xWeg(p.punkt, u), ...zWege(p.punkt, u)] : [...zWege(p.punkt, u), xWeg(p.punkt, u)]);
  /** Zur Steigzone, senkrecht, oben zuerst in x auf der eigenen Spurlinie (z = Steigzone + Spur), dann in z. */
  const steigen = (von: V3, u: V3): V3[] => {
    const fuss: V3 = [steig[0], von[1], steig[1]], kopf: V3 = [steig[0], u[1], steig[1]];
    const unten = wahl([...linien(steig[1]).map((z) => lWeg(von, fuss, z)), bereinigen([von, [fuss[0], von[1], von[2]], fuss])]);
    return bereinigen([...unten, kopf, ...wahl([xWeg(kopf, u), ...zWege(kopf, u)])]);
  };

  for (const { schluessel, punkt: u } of sortiert) {
    let weg: V3[];
    if (!segmente.length) {
      weg = gleicheEbene(u[1], start[1]) ? wahl(zWege(start, u)) : steigen(start, u);
    } else {
      const p = naechster(u, u[1], true);
      if (p) weg = abzweig(p, u);
      else {
        // Zielgeschoss noch nicht erreicht: am nächsten Ende der Steigleitung weiter, sonst neue Steigleitung ab dem Strang.
        const enden = segmente.flatMap((s) => s.filter((q) => Math.abs(q[0] - steig[0]) < EPS && Math.abs(q[2] - steig[1]) < EPS));
        if (enden.length) {
          const e = enden.reduce((b, q) => (Math.abs(q[1] - u[1]) < Math.abs(b[1] - u[1]) ? q : b));
          const kopf: V3 = [steig[0], u[1], steig[1]];
          weg = bereinigen([e, kopf, ...wahl([xWeg(kopf, u), ...zWege(kopf, u)])]);
        } else {
          const fuss: V3 = [steig[0], start[1], steig[1]];
          const q = naechster(fuss, start[1], true) ?? { punkt: start, achse: null };
          weg = bereinigen([...abzweig(q, fuss), ...steigen(fuss, u).slice(1)]);
        }
      }
    }
    if (weg.length >= 2) segmente.push(weg);
    abzweige.push({ schluessel, punkte: weg });
  }
  return { segmente, abzweige };
}

/** Mindestabstand der Rohrachsen fremder Gruppen [A]: zwei Verteilrohre (2 × 0.045 m) plus Fuge. */
const KONFLIKT_ABSTAND = 0.14;
/**
 * Konflikte eines Wegs mit fremden Leitungen auf derselben Ebene: parallele Überlagerung und Durchfahren eines
 * fremden Steigrohrs zählen 10, rechtwinklige Kreuzung 1.
 */
export function konflikte(weg: V3[], hindernisse: V3[][]): number {
  let n = 0;
  for (let i = 1; i < weg.length; i++) {
    const a = weg[i - 1], b = weg[i];
    if (Math.abs(a[1] - b[1]) > EPS) continue;
    const k: 0 | 2 = Math.abs(a[0] - b[0]) > EPS ? 0 : 2, q: 0 | 2 = k === 0 ? 2 : 0;
    const lo = Math.min(a[k], b[k]), hi = Math.max(a[k], b[k]);
    for (const h of hindernisse) for (let j = 1; j < h.length; j++) {
      const c = h[j - 1], d = h[j];
      if (Math.abs(c[0] - d[0]) < EPS && Math.abs(c[2] - d[2]) < EPS) {
        if (Math.abs(c[1] - d[1]) < EPS || a[1] < Math.min(c[1], d[1]) - 0.1 || a[1] > Math.max(c[1], d[1]) + 0.1) continue;
        const naechst = Math.min(Math.max(c[k], lo), hi);
        if (Math.hypot(c[k] - naechst, c[q] - a[q]) < KONFLIKT_ABSTAND) n += 10;
        continue;
      }
      if (Math.abs(c[1] - a[1]) > 0.1 || Math.abs(d[1] - a[1]) > 0.1) continue;
      const kk: 0 | 2 = Math.abs(c[0] - d[0]) > EPS ? 0 : 2;
      if (kk === k) {
        const ueber = Math.min(hi, Math.max(c[k], d[k])) - Math.max(lo, Math.min(c[k], d[k]));
        if (ueber > -KONFLIKT_ABSTAND && Math.abs(c[q] - a[q]) < KONFLIKT_ABSTAND) n += 10;
      } else if (c[k] > lo + EPS && c[k] < hi - EPS && a[q] > Math.min(c[q], d[q]) + EPS && a[q] < Math.max(c[q], d[q]) - EPS) n += 1;
    }
  }
  return n;
}

// ---------------------------------------------------------------------------------------------------------------
// Gruppenstock und Ort «vor Bauteil» (Spec 6.2, 6.6)
// ---------------------------------------------------------------------------------------------------------------

/** Reihenfolge im Gruppenstock von unten: Pumpe, Ventile, Wärmezähler, Übriges. */
const STOCK_FOLGE = ["heizung.umwaelzpumpe", "heizung.ventil_3weg", "heizung.ventil_2weg", "heizung.wmz"];
const folge = (id: string) => { const i = STOCK_FOLGE.indexOf(id); return i < 0 ? STOCK_FOLGE.length : i; };
/** Freiraum über dem Abgangsstutzen (Kugelhahn, Manschette) und unter der Leitungsebene [A]. */
const STOCK_UNTEN = 0.08, STOCK_OBEN = 0.15, STOCK_FUGE = 0.06;

export interface StockTeil { schluessel: string; katalogId: string; mitten: V3[]; laenge: number }
export interface StockEingabe { schluessel: string; katalogId: string; menge: number }

/**
 * Zubehör einer Gruppe übereinander auf dem senkrechten Abgang; gleichartiges Zubehör erscheint `menge`-mal (mind. 1).
 * `oben`: Oberkante des Stocks (ohne Zubehör = Abganghöhe, dann reines Rohrstück).
 */
export function gruppenStock(abgang: V3, teile: StockEingabe[], yLeitung: number, katalog?: KatalogEintrag[]): { teile: StockTeil[]; oben: number } {
  const sortiert = [...teile].sort((a, b) => folge(a.katalogId) - folge(b.katalogId) || vergleich(a.schluessel, b.schluessel));
  const laengen = sortiert.map((t) => inlineLaenge(t.katalogId, modellFuer(t.katalogId, katalog).masse));
  const stueck = sortiert.map((t) => Math.max(1, Math.round(t.menge)));
  const anzahl = stueck.reduce((a, b) => a + b, 0);
  if (!anzahl) return { teile: [], oben: abgang[1] };
  const summe = sortiert.reduce((a, _, i) => a + laengen[i] * stueck[i], 0);
  const frei = yLeitung - STOCK_OBEN - abgang[1] - STOCK_UNTEN;
  // [A] Fugen schrumpfen bei vielen Teilen bis 1 cm; reicht der Platz nicht, ragt der Stock bis an die Leitungsebene.
  const fuge = anzahl > 1 ? Math.min(STOCK_FUGE, Math.max(0.01, (frei - summe) / (anzahl - 1))) : 0;
  let y = abgang[1] + STOCK_UNTEN;
  const ergebnis = sortiert.map((t, i) => {
    const mitten: V3[] = [];
    for (let k = 0; k < stueck[i]; k++) { mitten.push([abgang[0], y + laengen[i] / 2, abgang[2]]); y += laengen[i] + fuge; }
    return { schluessel: t.schluessel, katalogId: t.katalogId, mitten, laenge: laengen[i] };
  });
  return { teile: ergebnis, oben: y - fuge + 0.04 };
}

/**
 * Teil «vor Bauteil X»: auf dem längsten senkrechten Stück der Anschlussleitung von X, mittig gestapelt.
 * `adapter`: tatsächliche Anschlussleitung (Weltkoordinaten, z. B. aus routerAnschluss); sonst bisherige Führung.
 */
export function ortVorBauteil(bezug: WeltSymbol, lokal: V3, laufY: number, raum: Rechteck | undefined, katalogId: string, menge: number,
  katalog?: KatalogEintrag[], adapter?: V3[]): { mitten: V3[]; laenge: number } {
  const f = { adapter: adapter ?? anschlussFuehrung([], { symbol: bezug, lokal }, ROHR.verteil, raum, laufY - bezug.position.y).adapter };
  let best: [V3, V3] | null = null;
  for (let i = 1; i < f.adapter.length; i++) {
    const a = f.adapter[i - 1], b = f.adapter[i];
    if (Math.abs(a[0] - b[0]) > EPS || Math.abs(a[2] - b[2]) > EPS) continue;
    if (!best || Math.abs(b[1] - a[1]) > Math.abs(best[1][1] - best[0][1])) best = [a, b];
  }
  const laenge = inlineLaenge(katalogId, modellFuer(katalogId, katalog).masse);
  const n = Math.max(1, Math.round(menge));
  if (!best) return { mitten: [[f.adapter[0][0], f.adapter[0][1] + laenge / 2, f.adapter[0][2]]], laenge };
  const [a, b] = best, unten = Math.min(a[1], b[1]), oben = Math.max(a[1], b[1]);
  const gesamt = n * laenge + (n - 1) * 0.03;
  const y0 = gesamt > oben - unten - 0.1 ? unten + 0.05 : (unten + oben) / 2 - gesamt / 2;
  return { mitten: Array.from({ length: n }, (_, i) => [a[0], y0 + i * (laenge + 0.03) + laenge / 2, a[2]] as V3), laenge };
}

const geschossVon = (welt: Welt, y: number) => welt.geschosse.find((g) => g.id === geschossBeiY(welt, y));

/**
 * Darstellungswelt: Verteiler mit Gruppen erhalten das Modell mit n Abgängen, Zubehör sitzt im Gruppenstock oder vor
 * seinem Bezug (Position = Unterkante des ersten Stücks). v1-Welten bleiben unverändert. Idempotent.
 */
export function anzeigeWelt(welt: Welt, katalog: KatalogEintrag[], anschluesse: Record<string, V3> = {}): Welt {
  if (!welt.gruppen) return welt;
  const straenge = gruppenVerbindungen(welt, katalog);
  const anzahl = new Map<string, number>();
  for (const s of straenge) anzahl.set(s.verteiler, (anzahl.get(s.verteiler) ?? 0) + 1);
  const symbole = new Map<string, AnzeigeSymbol>(welt.symbole.map((s) => [s.schluessel, { ...s } as AnzeigeSymbol]));
  for (const [key, n] of anzahl) { const v = symbole.get(key); if (v) v.modell = verteilerModell(n); }
  const setzen = (key: string, mitten: V3[], laenge: number) => {
    const s = symbole.get(key);
    if (!s || !mitten.length) return;
    s.inline = { mitten, laenge };
    s.position = { x: mitten[0][0], y: mitten[0][1] - laenge / 2, z: mitten[0][2] };
  };
  for (const st of straenge) {
    const v = symbole.get(st.verteiler), g = v && geschossVon(welt, v.position.y);
    if (!v || !g) continue;
    const lokal = verteilerAbgang(st.abgangIndex, anzahl.get(st.verteiler));
    const abgang: V3 = [v.position.x + lokal[0], v.position.y + lokal[1], v.position.z + lokal[2]];
    const teile = st.zubehoer.flatMap((k) => { const s = symbole.get(k); return s ? [{ schluessel: k, katalogId: s.katalogId, menge: s.mengeSumme }] : []; });
    for (const t of gruppenStock(abgang, teile, deckenLauf(g), katalog).teile) setzen(t.schluessel, t.mitten, t.laenge);
  }
  // Einmal je Welt (nicht je Teil): Hauptleitungsenden, Partner, Steigzone und Koerper ohne Teile in der Leitung.
  const haupt = new Set(verbindungen(welt, katalog).filter((v) => v.art === "haupt").flatMap((v) => [v.von, v.nach]));
  const partner = partnerVon(welt, katalog), steig = steigBereich(welt, katalog);
  const koerper = geraeteKoerper({ ...welt, symbole: [...symbole.values()].filter((x) => !x.inline && !(x.ort && "vorBauteil" in x.ort)) }, katalog);
  for (const s of symbole.values()) {
    if (!s.ort || !("vorBauteil" in s.ort)) continue;
    const bezug = symbole.get(s.ort.vorBauteil), g = bezug && geschossVon(welt, bezug.position.y);
    if (!bezug || !g || bezug.inline) continue;
    // Dieselbe Anschlussleitung wie im Rohrnetz (routerAnschluss), damit das Teil auf ihr sitzt und sie dort unterbricht.
    const lokalB = anschlussLokal(bezug, anschluesse, katalog), raum = einheitVon(welt, bezug)?.rechteck;
    const radius = haupt.has(bezug.schluessel) ? ROHR.haupt : ROHR.verteil;
    const adapter = routerAnschluss(bezug, lokalB, radius, deckenLauf(g), raum, koerper, steig, katalog, partner.get(bezug.schluessel)).punkte;
    const p = ortVorBauteil(bezug, lokalB, deckenLauf(g), raum, s.katalogId, s.mengeSumme, katalog, adapter);
    setzen(s.schluessel, p.mitten, p.laenge);
  }
  return { ...welt, symbole: welt.symbole.map((s) => symbole.get(s.schluessel)!) };
}

// ---------------------------------------------------------------------------------------------------------------
// Rohrnetz mit Gruppen
// ---------------------------------------------------------------------------------------------------------------

const STUMMEL = 0.22;

/** Spur je Strang, global eindeutig. Je Verteiler so geordnet, dass die rechtwinkligen Läufe verschachtelt bleiben (Steigzone siehe unten). */
export function spuren(welt: Welt, straenge: GruppenStrang[]): Map<string, number> {
  const ergebnis = new Map<string, number>();
  const verteiler = [...new Set(straenge.map((s) => s.verteiler))].sort(vergleich);
  let basis = 0;
  for (const key of verteiler) {
    const v = welt.symbole.find((s) => s.schluessel === key);
    const eigene = straenge.filter((s) => s.verteiler === key).sort((a, b) => a.abgangIndex - b.abgangIndex);
    const richtung = eigene.flatMap((s) => s.verbraucher).reduce((sum, k) => {
      const t = welt.symbole.find((s) => s.schluessel === k);
      const e = t ? undefined : welt.einheiten.find((e) => e.id === k);
      const x = t ? t.position.x : e ? e.rechteck.x + e.rechteck.breite / 2 : v?.position.x ?? 0;
      return sum + Math.sign(x - (v?.position.x ?? 0));
    }, 0);
    // Straenge ueber Geschosse laufen zur Steigzone; dort steigt Spur o bei (x + o*SPUR, z + o*SPUR). Verschachtelt
    // (ohne Kreuzung) bleiben die Laeufe, wenn der zur Steigzone hin vorderste Abgang zuerst abbiegt: bei Steigzone
    // in +z die kleinste Spur, in -z die groesste.
    const geschossVonV = v && geschossBeiY(welt, v.position.y);
    const steigt = (s: GruppenStrang) => s.verbraucher.some((k) => {
      const t = welt.symbole.find((x) => x.schluessel === k);
      const g = t ? geschossBeiY(welt, t.position.y) : welt.einheiten.find((e) => e.id === k)?.geschossId;
      return g !== undefined && g !== geschossVonV;
    });
    const steiger = welt.steigzone && v ? eigene.filter(steigt) : [];
    eigene.forEach((s, i) => ergebnis.set(s.gruppeId, basis + (richtung <= 0 ? eigene.length - 1 - i : i)));
    if (steiger.length > 1 && v && welt.steigzone) {
      // Die Spurnummern der steigenden Straenge bleiben dieselben, nur ihre Zuordnung folgt der Verschachtelung.
      const nummern = steiger.map((s) => ergebnis.get(s.gruppeId)!).sort((a, b) => a - b);
      const vorne = welt.steigzone.x < v.position.x ? steiger : [...steiger].reverse();
      const folge = welt.steigzone.z >= v.position.z ? vorne : [...vorne].reverse();
      folge.forEach((s, i) => ergebnis.set(s.gruppeId, nummern[i]));
    }
    basis += eigene.length;
  }
  return ergebnis;
}

/** Leitung im Bereich eines Teils unterbrechen; die Rohrenden treffen die Stutzen des Teils. */
function ausschneiden(stuecke: Rohrstueck[], mitte: V3, laenge: number): Rohrstueck[] {
  return stuecke.flatMap((r) => {
    for (let i = 1; i < r.punkte.length; i++) {
      const a = r.punkte[i - 1], b = r.punkte[i];
      if ([a, b].some((p) => Math.abs(p[0] - mitte[0]) > EPS || Math.abs(p[2] - mitte[2]) > EPS)) continue;
      const unten = Math.min(a[1], b[1]), oben = Math.max(a[1], b[1]);
      if (mitte[1] - laenge / 2 < unten - EPS || mitte[1] + laenge / 2 > oben + EPS) continue;
      const d = Math.sign(b[1] - a[1]);
      const c1: V3 = [mitte[0], mitte[1] - d * laenge / 2, mitte[2]], c2: V3 = [mitte[0], mitte[1] + d * laenge / 2, mitte[2]];
      return [{ ...r, punkte: [...r.punkte.slice(0, i), c1], endRadius: ROHR.stock + 0.002, frei: false },
        { ...r, punkte: [c2, ...r.punkte.slice(i)], startRadius: ROHR.stock + 0.002 }];
    }
    return [r];
  });
}

/**
 * Rohrnetz einer Welt mit Gruppen: Hauptleitungen, je Gruppe Abgang, Stock, Strang, T-Abzweige, Anschlüsse; Läufe über den
 * LeitungsRouter (Spec 2026-11-13). `router` muss die Anzeigewelt kennen; `vorrang`: Gruppen, die zuerst verlegt werden.
 */
export function gruppenRohrnetz(weltEingabe: Welt, katalog: KatalogEintrag[], anschluesse: Record<string, V3>, router?: LeitungsRouter, vorrang: string[] = []): Rohrstueck[] {
  const welt = anzeigeWelt(weltEingabe, katalog, anschluesse);
  const r = router ?? new LeitungsRouter(welt, katalog);
  const straenge = gruppenVerbindungen(welt, katalog);
  const symbol = new Map(welt.symbole.map((s) => [s.schluessel, s as AnzeigeSymbol]));
  // Gruppenkanten zuerst: ein Unterverteiler mit Gruppe erhält nie zusätzlich eine Hauptleitung.
  const topologie = alsBaum([...straenge.flatMap((s) => s.verbraucher.map((v) => ({ von: s.verteiler, nach: v, art: "verteil" as const }))),
    ...verbindungen(welt, katalog).filter((v) => v.art === "haupt")]);
  const gruppenZiel = new Set(straenge.flatMap((s) => s.verbraucher));
  // Hauptkante zu einem Verbraucher einer Gruppe (Unterverteiler) verwirft alsBaum still, weil die Gruppe ihn speist;
  // das ersetzt den frueheren Filter `unterverteiler` (Hauptkanten von/zu Unterverteilern mit Gruppe). Nur echte Zyklen sind Befunde.
  for (const k of topologie.verworfen.filter((k) => k.art === "haupt" && !gruppenZiel.has(k.nach))) r.befunde.push({ regel: "zyklus", leitungen: [`${k.von}>${k.nach}`], ort: [0, 0, 0], hart: true });
  const haupt = topologie.kanten.filter((k) => k.art === "haupt") as Verbindung[];
  const koerper = geraeteKoerper(welt, katalog), steig = steigBereich(welt, katalog), partner = partnerVon(welt, katalog);
  const spur = spuren(welt, straenge);
  const anzahl = new Map<string, number>();
  for (const s of straenge) anzahl.set(s.verteiler, (anzahl.get(s.verteiler) ?? 0) + 1);

  // Durchgang 1: Abgänge, Stöcke und Geräteanschlüsse aller Gruppen (fest, unabhängig vom Strang).
  interface Anschluss { riser: V3[]; stutzen: number; radius: number; boden: number; bauteilIds: string[] }
  const vorbereitet = straenge.flatMap((st) => {
    const v = symbol.get(st.verteiler), g = v && geschossVon(welt, v.position.y);
    if (!v || !g) return [];
    const yL = deckenLauf(g);
    const lokal = verteilerAbgang(st.abgangIndex, anzahl.get(st.verteiler));
    const abgang: V3 = [v.position.x + lokal[0], v.position.y + lokal[1], v.position.z + lokal[2]];
    const anschluss: Record<string, Anschluss> = {};
    const ziele: StrangZiel[] = [];
    const freieZiele = new Set<string>();
    for (const key of st.verbraucher) {
      const t = symbol.get(key);
      if (!t) {
        const e = welt.einheiten.find((e) => e.id === key), ge = e && welt.geschosse.find((x) => x.id === e.geschossId);
        if (e && ge) { ziele.push({ schluessel: key, punkt: [e.rechteck.x + e.rechteck.breite / 2, deckenLauf(ge), e.rechteck.z + e.rechteck.tiefe / 2] }); freieZiele.add(key); }
        continue;
      }
      const gt = geschossVon(welt, t.position.y);
      if (!gt) continue;
      const lauf = deckenLauf(gt);
      // Stutzen, noetigenfalls Stummel, senkrecht bis zur Leitungsebene; den Rest verlegt der Strang (Router).
      const f = routerAnschluss(t, anschlussLokal(t, anschluesse, katalog), ROHR.verteil, lauf, einheitVon(welt, t)?.rechteck, koerper, steig, katalog, partner.get(key));
      // Keine zulaessige Lage fuer die Steigleitung: harter Befund (der Pruefer nimmt den eigenen Koerper aus).
      if (!f.ok) r.befunde.push({ regel: "kein_weg", leitungen: [st.gruppeId, key], ort: f.punkte[0], hart: true });
      const riser = f.punkte;
      const stutzen = t.katalogId === "heizung.verteiler" ? 0.035 : t.katalogId === "heizung.waermepumpe" ? 0.026 : ROHR.anschluss;
      anschluss[key] = { riser, stutzen, radius: f.adapterRadius, boden: t.position.y, bauteilIds: t.bauteilIds };
      ziele.push({ schluessel: key, punkt: riser.at(-1)! });
    }
    const teile = st.zubehoer.flatMap((k) => { const s = symbol.get(k); return s ? [{ schluessel: k, katalogId: s.katalogId, menge: s.mengeSumme }] : []; });
    const oben = Math.min(gruppenStock(abgang, teile, yL, katalog).oben, yL - 0.05);
    return [{ st, v, yL, abgang, anschluss, ziele, freieZiele, oben, start: [abgang[0], yL, abgang[2]] as V3 }];
  });
  const fest = (x: (typeof vorbereitet)[number]): V3[][] => [[x.abgang, x.start], ...Object.values(x.anschluss).map((a) => a.riser)];
  // Feste Gruppenteile vor den Hauptleitungen belegen: Hauptlaeufe fuehren nicht ueber Abgaenge und Anschluesse. Weil
  // danach noch Hauptrohre folgen, sperren sie gegen den Hauptrohrradius (Sperrabstand paarweise, raster.sperrabstand).
  for (const x of vorbereitet) for (const p of fest(x)) { r.vorbelegen(p, x.st.gruppeId, ROHR.verteil, ROHR.haupt); r.anschlussSperren(p, x.st.gruppeId, ROHR.verteil, ROHR.haupt); }
  for (const x of vorbereitet) r.korridor(x.start, x.st.gruppeId);
  // Hauptlaeufe schliessen keinen Strangstart ein (vorlaeufige Sperre nur waehrend kantenNetz).
  r.startsFreihalten(vorbereitet.map((x) => x.start));
  // Spuren fuer Haupt- und Gruppenleitungen in einer Zuteilung (kantenNetz ruft spurenFestlegen).
  let stuecke = kantenNetz(welt, katalog, anschluesse, haupt, r, vorbereitet.map((x) => {
    const ziel = x.ziele.find((z) => Math.abs(z.punkt[1] - x.start[1]) < 1e-3)?.punkt
      ?? (welt.steigzone ? [welt.steigzone.x, x.start[1], welt.steigzone.z] as V3 : x.start);
    return { netz: x.st.gruppeId, a: x.start, b: ziel };
  }));
  r.startsFreigeben();
  // Gruppen mit Vorrang zuerst, in der Reihenfolge von `vorrang`; die uebrigen wie bisher.
  const rang = (id: string) => { const i = vorrang.indexOf(id); return i < 0 ? vorrang.length : i; };
  const reihe = [...vorbereitet].sort((a, b) => rang(a.st.gruppeId) - rang(b.st.gruppeId));

  // Durchgang 2: Stränge nacheinander über den Router (belegte Zellen fremder Netze sind gesperrt).
  for (const x of reihe) {
    const { st, v, abgang, anschluss, ziele, freieZiele, oben, start } = x;
    const daten = (nach: string, bauteilIds: string[]) => ({ art: "verteil" as const, von: st.verteiler, nach, bauteilIds, gruppeId: st.gruppeId });
    const baum = r.strang(start, ziele, spur.get(st.gruppeId) ?? 0, welt.steigzone ?? null, st.gruppeId);

    // Stock: dünnes Rohr durch das Zubehör, dann Übergang auf die Verteilleitung mit tangentialem Stummel.
    let stummel: V3 = start;
    const erstes = baum.segmente[0];
    if (erstes && erstes.length >= 2 && erstes[0] === start && Math.abs(erstes[1][1] - start[1]) < EPS) {
      const k = Math.abs(erstes[1][0] - start[0]) > EPS ? 0 : 2, l = erstes[1][k] - start[k];
      stummel = [...start] as V3; stummel[k] += Math.sign(l) * Math.min(STUMMEL, Math.abs(l) / 2);
      erstes[0] = stummel;
    }
    const boden = v.position.y;
    if (oben > abgang[1] + EPS) {
      stuecke.push({ punkte: [abgang, [abgang[0], oben, abgang[2]]], radius: ROHR.stock, startRadius: 0.02, endRadius: ROHR.stock, boden,
        daten: daten(st.gruppeId, v.bauteilIds), frei: false });
      stuecke.push({ punkte: bereinigen([[abgang[0], oben, abgang[2]], start, stummel]), radius: 0.035, startRadius: ROHR.stock, endRadius: ROHR.verteil, boden,
        daten: daten(st.gruppeId, v.bauteilIds), frei: false });
    } else {
      stuecke.push({ punkte: bereinigen([abgang, start, stummel]), radius: 0.035, startRadius: 0.02, endRadius: ROHR.verteil, boden,
        daten: daten(st.gruppeId, v.bauteilIds), frei: false });
    }

    for (const a of baum.abzweige) {
      const ziel = anschluss[a.schluessel];
      let ende = a.punkte.at(-1)!;
      if (ziel && a.punkte.length >= 2) {
        const p = a.punkte, q = p[p.length - 2], r = p[p.length - 1];
        const k = [0, 2].find((i) => Math.abs(r[i] - q[i]) > EPS);
        if (k !== undefined && Math.abs(r[1] - q[1]) < EPS) {
          // Der Stummel gehoert zum Anschlussrohr; zum T-Punkt bleibt mindestens der Rohrabstand (2 Verteilrohre + Fuge).
          const rest = Math.max(Math.abs(r[k] - q[k]) / 2, 2 * ROHR.verteil + GRENZEN.fuge);
          // Beginnt ein anderer Abzweig (T-Punkt) auf diesem Stueck, bleibt das Strangende den Rohrabstand hinter ihm (Task 8).
          const quer = k === 0 ? 2 : 0;
          const tPunkte = baum.abzweige.filter((b) => b !== a && b.punkte.length >= 2).map((b) => b.punkte[0])
            .filter((t) => Math.abs(t[1] - r[1]) < EPS && Math.abs(t[quer] - r[quer]) < EPS && (t[k] - q[k]) * (r[k] - t[k]) >= -EPS);
          const frei = Math.min(...tPunkte.map((t) => Math.abs(r[k] - t[k]) - (2 * ROHR.verteil + GRENZEN.fuge)));
          ende = [...r] as V3; ende[k] -= Math.sign(r[k] - q[k]) * Math.max(0, Math.min(STUMMEL, Math.abs(r[k] - q[k]) - rest, frei));
          p[p.length - 1] = ende;
        }
      }
      if (ziel) stuecke.push({ punkte: bereinigen([...ziel.riser, ende]), radius: ziel.radius, startRadius: ziel.stutzen, endRadius: ROHR.verteil,
        boden: ziel.boden, daten: daten(a.schluessel, ziel.bauteilIds), frei: false });
    }
    for (const seg of baum.segmente) {
      const nach = baum.abzweige.find((a) => a.punkte === seg)?.schluessel ?? st.gruppeId;
      stuecke.push({ punkte: seg, radius: ROHR.verteil, startRadius: ROHR.verteil, endRadius: ROHR.verteil, boden,
        daten: daten(nach, symbol.get(nach)?.bauteilIds ?? []), frei: freieZiele.has(nach) });
    }
  }
  for (const s of symbol.values()) {
    if (s.inline && s.ort && "vorBauteil" in s.ort) for (const m of s.inline.mitten) stuecke = ausschneiden(stuecke, m, s.inline.laenge);
  }
  return stuecke;
}
