/** Grenzen der Lese-API (nur beim Lesen, nicht fuer die Ablage). */
export const MAX_BYTES = 32 * 1024 * 1024;
export const MAX_SEITEN = 100;
/** Darf das Dokument an die Lese-API? Nur sauberes PDF innerhalb der Lesegrenzen (Ablage erlaubt auch Bilder/Office und bis 100 MB). */
export function lesbar(d: { art: string; scanStatus: string; seiten: number | null; groesse: number }): "kein_pdf" | "nicht_sauber" | "zu_gross_lesen" | "zu_viele_seiten" | null {
  if (d.art !== "pdf") return "kein_pdf";
  if (d.scanStatus !== "sauber") return "nicht_sauber";
  if (d.groesse > MAX_BYTES) return "zu_gross_lesen"; // eigener Code: "zu_gross" heisst im Web "ueber 100 MB" (Ablage)
  if (d.seiten !== null && d.seiten > MAX_SEITEN) return "zu_viele_seiten";
  return null;
}
