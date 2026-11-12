import { FASSADE } from "./farben";

/** Licht- und Farbparameter einer Stimmung. leuchten = Emissiv-Staerke der Leitungen, abblenden = Anteil Hintergrundfarbe in der Grundplatte. */
export interface Stimmung {
  hintergrund: string; umgebung: number; sonne: number; gebaeude: string; leuchten: number; abblenden: number;
}

export const HELL: Stimmung = { hintergrund: "#eef1f5", umgebung: 0.9, sonne: 1.6, gebaeude: FASSADE.wand, leuchten: 0, abblenden: 0 };
/** Fokus: abgedunkelt/entsaettigt, Schieferblau-Grau, nicht dunkel. */
export const FOKUS: Stimmung = { hintergrund: "#5d6d80", umgebung: 0.55, sonne: 1.1, gebaeude: "#a7b1bc", leuchten: 1.4, abblenden: 0.4 };

const kanaele = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export function mischeFarbe(a: string, b: string, t: number): string {
  const ka = kanaele(a), kb = kanaele(b);
  return "#" + ka.map((v, i) => Math.round(v + (kb[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

export function mische(a: Stimmung, b: Stimmung, t: number): Stimmung {
  const u = Math.min(1, Math.max(0, t));
  const zahl = (x: number, y: number) => x + (y - x) * u;
  return {
    hintergrund: mischeFarbe(a.hintergrund, b.hintergrund, u),
    umgebung: zahl(a.umgebung, b.umgebung),
    sonne: zahl(a.sonne, b.sonne),
    gebaeude: mischeFarbe(a.gebaeude, b.gebaeude, u),
    leuchten: zahl(a.leuchten, b.leuchten),
    abblenden: zahl(a.abblenden, b.abblenden),
  };
}
