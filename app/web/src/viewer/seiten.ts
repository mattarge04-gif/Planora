export const klemmeSeite = (seite: number, anzahl: number) => (Number.isFinite(seite) ? Math.min(Math.max(1, Math.round(seite)), Math.max(1, anzahl)) : 1);
export const ZOOM_STUFEN = [0.5, 0.75, 1, 1.25, 1.5, 2, 3] as const;
export function naechsterZoom(z: number, richtung: 1 | -1): number {
  if (richtung === 1) return ZOOM_STUFEN.find((s) => s > z + 1e-6) ?? ZOOM_STUFEN[ZOOM_STUFEN.length - 1];
  return [...ZOOM_STUFEN].reverse().find((s) => s < z - 1e-6) ?? ZOOM_STUFEN[0];
}
export function trefferSeiten(texte: string[], begriff: string): { seite: number; anzahl: number }[] {
  const b = begriff.trim().toLocaleLowerCase("de-CH");
  if (b.length < 2) return [];
  return texte.map((t, i) => ({ seite: i + 1, anzahl: t.toLocaleLowerCase("de-CH").split(b).length - 1 })).filter((x) => x.anzahl > 0);
}
export function naechsterTreffer(treffer: { seite: number }[], aktuell: number, richtung: 1 | -1): number | null {
  if (!treffer.length) return null;
  const s = treffer.map((t) => t.seite);
  return richtung === 1 ? (s.find((x) => x > aktuell) ?? s[0]) : ([...s].reverse().find((x) => x < aktuell) ?? s[s.length - 1]);
}
/** Startzoom "an Breite": groesste Stufe zwischen 0.5 und 1.5, mit der die Seite (Breite bei Massstab 1) in die Flaeche passt. */
export function zoomFuerBreite(seitenBreite: number, flaecheBreite: number): number {
  const passt = (flaecheBreite - 64) / seitenBreite;
  const stufen = ZOOM_STUFEN.filter((s) => s <= 1.5);
  return [...stufen].reverse().find((s) => s <= passt) ?? stufen[0];
}
