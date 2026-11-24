import { ClipboardCheck, ClipboardList, DraftingCompass, File, Image as Bild, Receipt, type LucideIcon } from "lucide-react";
import type { AblageZeile, Kategorie } from "../dokumente/typen";

/** Ein Symbol je Kategorie (Seite Dokumente, Anlagenkarte, Viewer); die Art steht als Endung daneben. */
export const KATEGORIE_ICON: Record<Kategorie, LucideIcon> = {
  datenblatt: ClipboardList, plan: DraftingCompass, offerte: Receipt, foto: Bild, protokoll: ClipboardCheck, sonstiges: File,
};

/** Endung fuer die Anzeige ("PDF", "XLSX"); aus dem Dateinamen, sonst aus der Art. */
export function endung(d: Pick<AblageZeile, "dateiname" | "art">): string {
  const m = /\.([a-z0-9]{2,5})$/i.exec(d.dateiname);
  if (m) return m[1].toUpperCase();
  return d.art === "pdf" ? "PDF" : d.art === "bild" ? "Bild" : "Office";
}

export function DokumentSymbol({ kategorie, groesse = 16 }: { kategorie: Kategorie; groesse?: number }) {
  const Icon = KATEGORIE_ICON[kategorie];
  return <Icon size={groesse} strokeWidth={1.75} aria-hidden="true" />;
}
