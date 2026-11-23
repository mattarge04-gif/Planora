/** Grenzen und Typen der Ablage (Spec Anlagenakte 2026-11-23 Abschnitt 3/4.2). Typ nur aus Magic Bytes, nie aus Endung. */
export const MAX_BYTES = 100 * 1024 * 1024; // [A]
export type Art = "pdf" | "bild" | "office";
export const KATEGORIEN = ["datenblatt", "plan", "offerte", "foto", "protokoll", "sonstiges"] as const;
export type Kategorie = (typeof KATEGORIEN)[number];
export type TypGrund = "leer" | "zu_gross" | "typ_unbekannt" | "makro";
export interface Typ { art: Art; mime: string }

export function erkenneTyp(d: Buffer): { ok: true; typ: Typ } | { ok: false; grund: TypGrund } {
  if (!d.length) return { ok: false, grund: "leer" };
  if (d.length > MAX_BYTES) return { ok: false, grund: "zu_gross" };
  if (d.subarray(0, 5).toString("latin1") === "%PDF-") return { ok: true, typ: { art: "pdf", mime: "application/pdf" } };
  return { ok: false, grund: "typ_unbekannt" };
}

/** Vorbelegung [A]: Bild -> foto, sonst sonstiges. */
export const startKategorie = (art: Art): Kategorie => (art === "bild" ? "foto" : "sonstiges");
