export const klemmeSeite = (seite: number, anzahl: number) => (Number.isFinite(seite) ? Math.min(Math.max(1, Math.round(seite)), Math.max(1, anzahl)) : 1);
export const ZOOM_STUFEN = [0.5, 0.75, 1, 1.25, 1.5, 2, 3] as const;
export function naechsterZoom(z: number, richtung: 1 | -1): number {
  if (richtung === 1) return ZOOM_STUFEN.find((s) => s > z + 1e-6) ?? ZOOM_STUFEN[ZOOM_STUFEN.length - 1];
  return [...ZOOM_STUFEN].reverse().find((s) => s < z - 1e-6) ?? ZOOM_STUFEN[0];
}
/** Ein Suchtreffer: Seite, Textstueck (Index der PDF.js-Textebene) und Position im Stueck. */
export interface Treffer { seite: number; stueck: number; start: number; laenge: number }

/** Alle Treffer in Lesereihenfolge; `seiten[i]` sind die Textstuecke von Seite i+1 (wie die Textebene sie zeichnet). */
export function trefferListe(seiten: string[][], begriff: string): Treffer[] {
  const b = begriff.trim().toLocaleLowerCase("de-CH");
  if (b.length < 2) return [];
  const aus: Treffer[] = [];
  seiten.forEach((stuecke, i) => stuecke.forEach((s, k) => {
    const t = s.toLocaleLowerCase("de-CH");
    for (let p = t.indexOf(b); p >= 0; p = t.indexOf(b, p + b.length)) aus.push({ seite: i + 1, stueck: k, start: p, laenge: b.length });
  }));
  return aus;
}
/** Treffer je Seite (Seitenleiste). */
export function jeSeite(t: Treffer[]): { seite: number; anzahl: number }[] {
  const m = new Map<number, number>();
  for (const x of t) m.set(x.seite, (m.get(x.seite) ?? 0) + 1);
  return [...m].map(([seite, anzahl]) => ({ seite, anzahl }));
}
/** Erster Treffer ab der aktuellen Seite (sonst der erste ueberhaupt); -1 ohne Treffer. */
export const startTreffer = (t: Treffer[], seite: number) => (t.length ? Math.max(0, t.findIndex((x) => x.seite >= seite)) : -1);
/** Naechster bzw. vorheriger Treffer, im Kreis. */
export const blaettereTreffer = (anzahl: number, aktuell: number, richtung: 1 | -1) => (anzahl ? (aktuell + richtung + anzahl) % anzahl : -1);
/** Teilt einen Text in Abschnitte mit und ohne Markierung (Treffer sortiert, ohne Ueberlappung). */
export function teileText(text: string, treffer: { start: number; laenge: number; nr: number }[]): { text: string; nr: number | null }[] {
  const aus: { text: string; nr: number | null }[] = [];
  let pos = 0;
  for (const t of [...treffer].sort((a, b) => a.start - b.start)) {
    if (t.start < pos) continue;
    if (t.start > pos) aus.push({ text: text.slice(pos, t.start), nr: null });
    aus.push({ text: text.slice(t.start, t.start + t.laenge), nr: t.nr });
    pos = t.start + t.laenge;
  }
  if (pos < text.length) aus.push({ text: text.slice(pos), nr: null });
  return aus;
}
/** Einpassen: ganze Seite bzw. ganzes Bild sichtbar (Rand 48 px), Massstab 0.25 bis 3, zwei Nachkommastellen. */
export function zoomEinpassen(breite: number, hoehe: number, flaecheB: number, flaecheH: number, rand = 48): number {
  if (!(breite > 0 && hoehe > 0 && flaecheB > 0 && flaecheH > 0)) return 1;
  const z = Math.min((flaecheB - rand) / breite, (flaecheH - rand) / hoehe);
  return Math.round(Math.min(3, Math.max(0.25, z)) * 100) / 100;
}
/** Zoom um einen Punkt (relativ zur Flaechenmitte): der Bildpunkt unter `punkt` bleibt stehen. */
export function versatzUmPunkt(z1: number, z2: number, versatz: { x: number; y: number }, punkt: { x: number; y: number }) {
  const f = z2 / z1;
  return { x: punkt.x - (punkt.x - versatz.x) * f, y: punkt.y - (punkt.y - versatz.y) * f };
}
/** Versatz so begrenzen, dass das Bild die Flaeche nicht verlaesst (kleiner als die Flaeche: zentriert). */
export function klemmeVersatz(v: { x: number; y: number }, bild: { b: number; h: number }, flaeche: { b: number; h: number }) {
  const mx = Math.max(0, (bild.b - flaeche.b) / 2 + 24), my = Math.max(0, (bild.h - flaeche.h) / 2 + 24);
  return { x: Math.min(mx, Math.max(-mx, v.x)) || 0, y: Math.min(my, Math.max(-my, v.y)) || 0 };
}
