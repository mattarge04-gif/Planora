export const MAX_BYTES = 32 * 1024 * 1024;
export const MAX_SEITEN = 100;
/** Seitenzahl [A]: hoechster /Count eines /Pages-Knotens, sonst Anzahl /Type /Page; mindestens 1. */
export function pruefePdf(daten: Buffer): { ok: true; seiten: number } | { ok: false; grund: "kein_pdf" | "zu_gross" | "zu_viele_seiten" } {
  if (daten.subarray(0, 5).toString("latin1") !== "%PDF-") return { ok: false, grund: "kein_pdf" };
  if (daten.length > MAX_BYTES) return { ok: false, grund: "zu_gross" };
  const text = daten.toString("latin1");
  const counts = [...text.matchAll(/\/Type\s*\/Pages\b[^>]*?\/Count\s+(\d+)/g)].map((m) => Number(m[1]));
  const seiten = Math.max(1, counts.length ? Math.max(...counts) : (text.match(/\/Type\s*\/Page(?!s)\b/g) ?? []).length);
  if (seiten > MAX_SEITEN) return { ok: false, grund: "zu_viele_seiten" };
  return { ok: true, seiten };
}
