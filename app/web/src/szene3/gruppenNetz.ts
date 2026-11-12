import type { V3 } from "../szene2/huelle";
import type { GruppenArt, KatalogEintrag, Welt } from "../typen";
import { einheitVon, verbindungen } from "./netz";

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
 */
export function strangBaum(start: V3, ziele: StrangZiel[], spur: number, steigzone: { x: number; z: number } | null,
  ebenen: Map<string, number>): StrangBaum {
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
  /** Abzweig: zuerst entlang der Strangachse (Verlängerung), dann rechtwinklig zum Ziel. */
  const abzweig = (p: Strangpunkt, u: V3): V3[] => {
    if (p.achse === 0) return bereinigen([p.punkt, [u[0], u[1], p.punkt[2]], u]);
    if (p.achse === 2) return bereinigen([p.punkt, [p.punkt[0], u[1], u[2]], u]);
    return lWeg(p.punkt, u, linie(p.punkt, u));
  };
  const steigen = (von: V3, u: V3): V3[] => {
    const fuss: V3 = [steig[0], von[1], steig[1]], kopf: V3 = [steig[0], u[1], steig[1]];
    return bereinigen([...lWeg(von, fuss, steig[1]), kopf, ...lWeg(kopf, u, linie(kopf, u))]);
  };

  for (const { schluessel, punkt: u } of sortiert) {
    let weg: V3[];
    if (!segmente.length) {
      weg = gleicheEbene(u[1], start[1]) ? lWeg(start, u, linie(start, u)) : steigen(start, u);
    } else {
      const p = naechster(u, u[1], true);
      if (p) weg = abzweig(p, u);
      else {
        // Zielgeschoss noch nicht erreicht: am nächsten Ende der Steigleitung weiter, sonst neue Steigleitung ab dem Strang.
        const enden = segmente.flatMap((s) => s.filter((q) => Math.abs(q[0] - steig[0]) < EPS && Math.abs(q[2] - steig[1]) < EPS));
        if (enden.length) {
          const e = enden.reduce((b, q) => (Math.abs(q[1] - u[1]) < Math.abs(b[1] - u[1]) ? q : b));
          const kopf: V3 = [steig[0], u[1], steig[1]];
          weg = bereinigen([e, kopf, ...lWeg(kopf, u, linie(kopf, u))]);
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
