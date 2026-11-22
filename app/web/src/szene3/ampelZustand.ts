/**
 * Geteilter Bildzustand des Modus Erneuerung (wie ROHR_FAKTOR: einmal je Bild gesetzt, ohne React-Neuzeichnen).
 * AMPEL_NAH: 0 = Übersicht (nur Pegelband), 1 = Geschossfokus/nah (Manschetten); Blende 160 ms (Pegelband3).
 * EINPASS_ZOOM: Einpasszoom der Szene (Deckel der Manschettenstreckung).
 */
export const AMPEL_NAH = { value: 1 };
export const EINPASS_ZOOM = { value: 0 };

/** Nächster Blendwert in Richtung `ziel` nach `dtMs` bei Blendedauer `ms` (0 = sofort). */
export function blende(wert: number, ziel: number, dtMs: number, ms: number): number {
  if (ms <= 0) return ziel;
  const schritt = dtMs / ms;
  return ziel > wert ? Math.min(ziel, wert + schritt) : Math.max(ziel, wert - schritt);
}
