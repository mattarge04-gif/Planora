import type { HeizArt } from "./typen.js";

/** Pseudo-Art fuer Bauteile, die direkt am Geschoss stehen (ohne Einheit). */
export const STANDORT_GESCHOSS = "_geschoss";
export interface KatalogEintrag { id: string; name: string; bereich: "zentrale" | "verteilung" | "einheit"; heizArt: HeizArt | null; mengeMax: number }
export interface Katalog { version: number; eintraege: KatalogEintrag[] }
export interface Regelwerk {
  version: number;
  schenkelAnteil: number; // L/U: Riegeltiefe = Anteil × Tiefe, Schenkelbreite = Anteil × Breite
  masse: { min: number; max: number; defaultBreite: number; defaultTiefe: number };
  geschoss: { hoeheMin: number; hoeheMax: number; hoeheDefault: number };
  einheitArten: Record<string, { name: string; defaultFlaecheM2: number }>;
  erlaubt: Record<string, string[]>; // Einheit-Art bzw. STANDORT_GESCHOSS → erlaubte Katalog-IDs
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
