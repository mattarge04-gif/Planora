import { useEffect, useState } from "react";
import { ladeUebersicht } from "../preisdokument/api";

/** Ist "Preis aus Dokument" fuer dieses Gebaeude lesbar (Modul an, Leserecht)? Einstiege erscheinen nur dann (keine toten Links). */
export function useDokumenteVerfuegbar(gebaeudeId: string): boolean {
  const [an, setAn] = useState(false);
  useEffect(() => {
    let aktiv = true;
    setAn(false);
    ladeUebersicht(gebaeudeId).then(() => { if (aktiv) setAn(true); }, () => { /* 404: Modul aus */ });
    return () => { aktiv = false; };
  }, [gebaeudeId]);
  return an;
}
