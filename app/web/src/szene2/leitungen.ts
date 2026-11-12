import type { KatalogEintrag, Rechteck, Welt, WeltSymbol } from "../typen";
import type { V3 } from "./huelle";

/** Leitungen liegen knapp ueber dem Boden; parallele Laeufe erhalten Versatz. Verlauf schematisch. */
export const BODEN = 0.05;
export const VERSATZ = 0.15;
const ERZEUGER = new Set(["heizung.waermepumpe", "heizung.gaskessel", "heizung.oelkessel", "heizung.fernwaerme_uebergabe"]);

export interface Leitung { art: "haupt" | "verteil"; von: string; nach: string; punkte: V3[]; geschossIds: string[] }

/** Geschoss, dessen Unterkante am naechsten unter (oder auf) y liegt; darunter das unterste Geschoss. */
export function geschossBeiY(welt: Welt, y: number): string | null {
  const sortiert = [...welt.geschosse].sort((a, b) => a.yUnten - b.yUnten);
  if (sortiert.length === 0) return null;
  const passend = sortiert.filter((g) => g.yUnten <= y + 1e-6);
  return (passend.length ? passend[passend.length - 1] : sortiert[0]).id;
}

const gleich = (a: V3, b: V3) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);

/** Rechtwinklig: Stich um d in z, senkrecht, entlang x, entlang z. */
function route(start: V3, ziel: V3, d: number): V3[] {
  const roh: V3[] = [
    start,
    [start[0], start[1], start[2] + d],
    [start[0], ziel[1], start[2] + d],
    [ziel[0], ziel[1], start[2] + d],
    ziel,
  ];
  return roh.filter((p, i) => i === 0 || !gleich(p, roh[i - 1]));
}

const eindeutig = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => x !== null))];
const nachSchluessel = (a: WeltSymbol, b: WeltSymbol) => (a.schluessel < b.schluessel ? -1 : a.schluessel > b.schluessel ? 1 : 0);

export function leitungen(welt: Welt, katalog: KatalogEintrag[]): Leitung[] {
  const bereich = new Map(katalog.map((k) => [k.id, k.bereich]));
  const symbole = [...welt.symbole].sort(nachSchluessel);
  // Katalog v2 fuehrt die Pumpe als Zubehoer: Erzeuger und Speicher werden deshalb ueber die ID erkannt, nicht ueber den Bereich.
  const zentralen = symbole.filter((s) => bereich.get(s.katalogId) === "zentrale");
  const zentrale = symbole.find((s) => ERZEUGER.has(s.katalogId)) ?? symbole.find((s) => s.katalogId === "heizung.speicher") ?? zentralen[0];
  const verteiler = symbole.filter((s) => bereich.get(s.katalogId) === "verteilung");
  const yUnten = new Map(welt.geschosse.map((g) => [g.id, g.yUnten]));
  const punkt = (s: WeltSymbol): V3 => [s.position.x, s.position.y + BODEN, s.position.z];
  const ergebnis: Leitung[] = [];

  if (zentrale) verteiler.forEach((v, k) => {
    ergebnis.push({
      art: "haupt", von: zentrale.schluessel, nach: v.schluessel,
      punkte: route(punkt(zentrale), punkt(v), k * VERSATZ),
      geschossIds: eindeutig([geschossBeiY(welt, zentrale.position.y), geschossBeiY(welt, v.position.y)]),
    });
  });

  for (const v of verteiler) {
    v.versorgt.forEach((einheitId, k) => {
      const e = welt.einheiten.find((x) => x.id === einheitId);
      const y = e ? yUnten.get(e.geschossId) : undefined;
      if (!e || y === undefined) return;
      const r = e.rechteck;
      ergebnis.push({
        art: "verteil", von: v.schluessel, nach: e.id,
        punkte: route(punkt(v), [r.x + r.breite / 2, y + BODEN, r.z + r.tiefe / 2], k * VERSATZ),
        geschossIds: eindeutig([geschossBeiY(welt, v.position.y), e.geschossId]),
      });
    });
  }
  return ergebnis;
}

/** Maeander fuer FBH/TABS: Bahnen entlang x im Abstand `abstand`, eingerueckt um `rand`. */
export function schlange(r: Rechteck, y: number, abstand = 0.6, rand = 0.5): V3[] {
  if (abstand <= 0) return [];
  const x0 = r.x + rand, x1 = r.x + r.breite - rand, z0 = r.z + rand, z1 = r.z + r.tiefe - rand;
  if (x1 <= x0 || z1 < z0) return [];
  const punkte: V3[] = [];
  for (let i = 0, z = z0; z <= z1 + 1e-9; i++, z = z0 + i * abstand) {
    if (i % 2 === 0) punkte.push([x0, y, z], [x1, y, z]);
    else punkte.push([x1, y, z], [x0, y, z]);
  }
  return punkte;
}
