import { dateiUrl } from "../preisdokument/api";
import type { LdStand } from "../lebensdauer/typen";

/** Fundstelle eines Dokumentpreises fuer Anlagenkarte und Erneuerungsplan; null, wenn der Preis nicht aus einem Dokument stammt. */
export interface DokumentQuelle {
  /** "aus o1-pumpen.pdf, S. 2" bzw. "aus Dokument (gelöscht)". */
  text: string;
  /** Link auf das PDF an der Fundstelle (neuer Tab); null, wenn das Dokument geloescht ist. */
  href: string | null;
  /** Preis gilt ueber den Typwert (alle Bauteile dieses Typs). */
  typpreis: boolean;
  dateiname: string | null;
}

export function dokumentQuelle(stand: LdStand, bauteilId: string): DokumentQuelle | null {
  const e = stand.ergebnis.bauteile.find((b) => b.id === bauteilId);
  if (!e || e.quellen.preisHerkunft !== "dokument" || e.quellen.preis === null) return null;
  const b = stand.bauteile.find((x) => x.id === bauteilId);
  const typpreis = e.quellen.preis === "typ";
  const q = typpreis ? stand.typen.find((t) => t.katalogId === b?.katalogId)?.preisQuelle ?? null : b?.akte?.preisQuelle ?? null;
  if (!q || !q.dokumentId) return { text: "aus Dokument (gelöscht)", href: null, typpreis, dateiname: null };
  const seite = q.seite ?? undefined;
  const name = q.dateiname ?? "Dokument";
  return { text: `aus ${name}${seite ? `, S. ${seite}` : ""}`, href: dateiUrl(q.dokumentId, seite), typpreis, dateiname: q.dateiname };
}
