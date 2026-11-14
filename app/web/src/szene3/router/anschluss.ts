import type { KatalogEintrag, Rechteck, WeltSymbol } from "../../typen";
import { anschlussFuehrung, modellVon } from "../technik";
import { GRENZEN, ROUTER, type Koerper, type V3 } from "./typen";

/** Abgaben: Stutzen unten am Geraet, der Fallstrang steht vor dem Geraet (Fuehrung wie bisher, ohne Abgangsstummel). */
const UNTEN = new Set(["heizung.fernwaerme_uebergabe", "heizung.heizkoerper", "heizung.fbh_kreis", "heizung.tabs_feld"]);
/** Mindestabstand der Steigleitung eines Anschlusses zur Steigzone (Strangrohre samt Spurversatz) [A]. */
export const STEIGZONE_ABSTAND = 0.25;
/** Steigzone als Strecke der Strang-Steigrohre (Spurversatz diagonal, siehe LeitungsRouter.strang). */
export interface SteigBereich { x: number; z: number; laenge: number }

const EPS = 1e-6;

function abstandZurSteigzone(x: number, z: number, s: SteigBereich): number {
  // Strecke (s.x, s.z) -> (s.x + L, s.z + L); naechster Punkt per Projektion.
  const t = s.laenge > 0 ? Math.max(0, Math.min(s.laenge, ((x - s.x) + (z - s.z)) / 2)) : 0;
  return Math.hypot(x - s.x - t, z - s.z - t);
}

/**
 * Anschluss fuer den Router (Spec 5.3, PO-Entscheid Adapter): Stutzen, hoechstens ein kurzer waagrechter Stummel auf
 * Stutzenhoehe, um vom eigenen Geraetekoerper freizukommen, dann senkrecht bis zur Leitungsebene `laufY` (absolut).
 * Alle weiteren waagrechten Stuecke verlegt der Router. Die Steigleitung bleibt im Raum (nicht im Aussenrand), ausserhalb
 * fremder Geraetekoerper und fern der Steigzone; ohne zulaessige Lage bleibt sie am Stutzen (der Pruefer meldet es).
 * Ergebnis in Weltkoordinaten, letzter Punkt auf der Leitungsebene.
 */
export function routerAnschluss(s: WeltSymbol, lokal: V3, radius: number, laufY: number, raum: Rechteck | undefined,
  koerper: Koerper[], steig: SteigBereich | null, katalog?: KatalogEintrag[]): { punkte: V3[]; adapterRadius: number } {
  const p = s.position;
  const a: V3 = [p.x + lokal[0], p.y + lokal[1], p.z + lokal[2]];
  if (UNTEN.has(s.katalogId)) {
    const f = anschlussFuehrung([], { symbol: s, lokal }, radius, raum, laufY - p.y);
    return { punkte: f.adapter.slice(0, -1), adapterRadius: f.adapterRadius };
  }
  const [b, h, t] = modellVon(s, katalog).masse;
  const adapterRadius = s.katalogId === "heizung.verteiler" && lokal[1] < h - 0.05 ? radius : 0.035;
  const r = Math.max(radius, adapterRadius);
  const rand = Math.max(ROUTER.aussenRand, r + GRENZEN.fuge);
  const fremd = koerper.filter((k) => k.schluessel !== s.schluessel);
  // Lage (x, z) der Steigleitung zulaessig? Steigleitung von Stutzenhoehe bis laufY.
  const frei = (x: number, z: number) => {
    if (raum && (x < raum.x + rand - EPS || x > raum.x + raum.breite - rand + EPS || z < raum.z + rand - EPS || z > raum.z + raum.tiefe - rand + EPS)) return false;
    if (steig && abstandZurSteigzone(x, z, steig) < STEIGZONE_ABSTAND) return false;
    return !fremd.some((k) => k.max[1] > a[1] && k.min[1] < laufY
      && x > k.min[0] - r && x < k.max[0] + r && z > k.min[2] - r && z < k.max[2] + r);
  };
  // Stummel auf Stutzenhoehe darf keinen fremden Koerper schneiden.
  const stummelFrei = (x: number, z: number) => !fremd.some((k) => a[1] > k.min[1] - r && a[1] < k.max[1] + r
    && Math.max(a[0], x) > k.min[0] - r && Math.min(a[0], x) < k.max[0] + r && Math.max(a[2], z) > k.min[2] - r && Math.min(a[2], z) < k.max[2] + r);
  const oben = lokal[1] >= h - 0.01;
  const innen = !oben && Math.abs(lokal[0]) < b / 2 - EPS && Math.abs(lokal[2]) < t / 2 - EPS;
  const senkrecht = (x: number, z: number): V3[] => [a, ...(Math.abs(x - a[0]) > EPS || Math.abs(z - a[2]) > EPS ? [[x, a[1], z] as V3] : []), [x, laufY, z]];
  if (!innen && frei(a[0], a[2])) return { punkte: senkrecht(a[0], a[2]), adapterRadius };
  // Stummel: in jeder Achsrichtung bis knapp vor die Koerperflaeche, dann in Rasterschritten weiter.
  const kandidaten: { x: number; z: number; l: number; n: number }[] = [];
  const richtungen: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  richtungen.forEach(([dx, dz], n) => {
    const flaeche = dx ? b / 2 - dx * lokal[0] : t / 2 - dz * lokal[2];
    const basis = Math.max(0, oben ? 0 : flaeche) + r + GRENZEN.fuge;
    for (let k = 0; k <= 8; k++) {
      const l = basis + k * ROUTER.zelle;
      kandidaten.push({ x: a[0] + dx * l, z: a[2] + dz * l, l, n });
    }
  });
  kandidaten.sort((u, v) => u.l - v.l || u.n - v.n);
  const wahl = kandidaten.find((c) => frei(c.x, c.z) && stummelFrei(c.x, c.z));
  return { punkte: wahl ? senkrecht(wahl.x, wahl.z) : senkrecht(a[0], a[2]), adapterRadius };
}
