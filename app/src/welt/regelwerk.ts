import type { GruppenArt, HeizArt } from "./typen.js";

/** Pseudo-Art fuer Bauteile, die direkt am Geschoss stehen (ohne Einheit). */
export const STANDORT_GESCHOSS = "_geschoss";
export interface KatalogEintrag { id: string; name: string; bereich: "zentrale" | "verteilung" | "einheit" | "zubehoer"; heizArt: HeizArt | null; mengeMax: number; masse?: [number, number, number] }
export interface Katalog { version: number; eintraege: KatalogEintrag[] }
export interface Regelwerk {
  version: number;
  schenkelAnteil: number; // L/U: Riegeltiefe = Anteil × Tiefe, Schenkelbreite = Anteil × Breite
  masse: { min: number; max: number; defaultBreite: number; defaultTiefe: number };
  geschoss: { hoeheMin: number; hoeheMax: number; hoeheDefault: number };
  einheitArten: Record<string, { name: string; defaultFlaecheM2: number }>;
  erlaubt: Record<string, string[]>; // Einheit-Art bzw. STANDORT_GESCHOSS → erlaubte Katalog-IDs
}

export interface RaumMatrix {
  modulM: number; gangModule: number; seitenMax: number; minGebaeude: [number, number];
  abgabe: { eins: [number, number]; zwei: [number, number]; dreiVier: [number, number]; jeZweiWeitere: number };
  technik: { minLaenge: number; tiefe: number }; kern: [number, number]; leer: [number, number];
}
export interface RegelwerkV2 extends Regelwerk {
  version: 2;
  raum: RaumMatrix;
  bestueckung: Record<GruppenArt, { katalogId: string; menge: number }[]>;
}

/** Rang fuer Stapelreihenfolge: UG3=-3 … UG1=-1, EG=0, OG1..OG40, DG=41, DACH=42; sonst null. */
export function geschossRang(code: string): number | null {
  if (code === "EG") return 0;
  if (code === "DG") return 41;
  if (code === "DACH") return 42;
  const ug = /^UG([1-3])$/.exec(code);
  if (ug) return -Number(ug[1]);
  const og = /^OG([1-9]|[1-3][0-9]|40)$/.exec(code);
  if (og) return Number(og[1]);
  return null;
}
