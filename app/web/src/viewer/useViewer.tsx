import { useCallback, useState } from "react";
import { ApiFehler } from "../api";
import { ladeAblage } from "../dokumente/api";
import { ablageFehlerText } from "../dokumente/ansicht";
import { fehlerCode } from "../api";
import type { AblageZeile } from "../dokumente/typen";
import { Viewer } from "./Viewer";

/** Ziel im Viewer; `markiere` startet die Suche mit diesem Begriff (z. B. aus einer spaeteren Dokumentsuche). */
export interface ViewerZiel { dokument: AblageZeile; seite?: number; markiere?: string }

/**
 * Viewer-Zustand einer Seite. `oeffne` nimmt ein Dokument direkt; `oeffneId` holt es aus der Ablage des Gebaeudes
 * (Fundstellen "S. n" kennen nur die Dokument-ID). Fehlt das Dokument, meldet `onFehlt` (z. B. inzwischen geloescht).
 */
export function useViewer(gebaeudeId: string, o: { onAbgelaufen?: () => void; onFehlt?: (text: string) => void } = {}) {
  const [ziel, setZiel] = useState<ViewerZiel | null>(null);
  const { onAbgelaufen, onFehlt } = o;
  const oeffne = useCallback((dokument: AblageZeile, seite?: number, markiere?: string) => setZiel({ dokument, ...(seite ? { seite } : {}), ...(markiere ? { markiere } : {}) }), []);
  const oeffneId = useCallback(async (dokumentId: string, seite?: number | null, markiere?: string) => {
    try {
      const a = await ladeAblage(gebaeudeId);
      const d = a.dokumente.find((x) => x.id === dokumentId);
      if (d) setZiel({ dokument: d, ...(seite ? { seite } : {}), ...(markiere ? { markiere } : {}) });
      else onFehlt?.(ablageFehlerText(null, 404));
    } catch (e) {
      if (e instanceof ApiFehler && e.status === 401) onAbgelaufen?.();
      else onFehlt?.(ablageFehlerText(fehlerCode(e), e instanceof ApiFehler ? e.status : undefined, "Dokument konnte nicht geöffnet werden."));
    }
  }, [gebaeudeId, onAbgelaufen, onFehlt]);
  const schliesse = useCallback(() => setZiel(null), []);
  const element = ziel ? <Viewer key={`${ziel.dokument.id}:${ziel.seite ?? 1}:${ziel.markiere ?? ""}`} dokument={ziel.dokument} seite={ziel.seite} markiere={ziel.markiere} onSchliessen={schliesse} /> : null;
  return { ziel, oeffne, oeffneId, schliesse, element };
}
