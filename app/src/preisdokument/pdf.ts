import { zaehleSeiten } from "../dokumente/pdf.js";
export { MAX_ENTPACKT_JE_STREAM, MAX_ENTPACKT_TOTAL } from "../dokumente/pdf.js";
/** Grenzen der Lese-API (nur beim Lesen, nicht fuer die Ablage). */
export const MAX_BYTES = 32 * 1024 * 1024;
export const MAX_SEITEN = 100;
export function pruefePdf(daten: Buffer): { ok: true; seiten: number } | { ok: false; grund: "kein_pdf" | "zu_gross" | "zu_viele_seiten" } {
  if (daten.subarray(0, 5).toString("latin1") !== "%PDF-") return { ok: false, grund: "kein_pdf" };
  if (daten.length > MAX_BYTES) return { ok: false, grund: "zu_gross" };
  const seiten = zaehleSeiten(daten);
  if (seiten > MAX_SEITEN) return { ok: false, grund: "zu_viele_seiten" };
  return { ok: true, seiten };
}
/** Darf das Dokument an die Lese-API? Nur sauberes PDF innerhalb der Lesegrenzen (Ablage erlaubt auch Bilder/Office und bis 100 MB). */
export function lesbar(d: { art: string; scanStatus: string; seiten: number | null; groesse: number }): "kein_pdf" | "nicht_sauber" | "zu_gross" | "zu_viele_seiten" | null {
  if (d.art !== "pdf") return "kein_pdf";
  if (d.scanStatus !== "sauber") return "nicht_sauber";
  if (d.groesse > MAX_BYTES) return "zu_gross";
  if (d.seiten !== null && d.seiten > MAX_SEITEN) return "zu_viele_seiten";
  return null;
}
