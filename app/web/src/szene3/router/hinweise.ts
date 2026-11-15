import type { HinweisZeile } from "../../dashboard/daten";
import { geschossBeiY } from "../../szene2/leitungen";
import type { Welt } from "../../typen";
import type { Befund } from "./typen";

/**
 * Ein Sammelhinweis, wenn die automatische Leitungsfuehrung harte Befunde hat (Spec 5.5). Die Befunde kommen aus
 * derselben Berechnung wie die gezeichneten Rohre (Technik3, mit den Anschluessen der geladenen Modelle).
 */
export function leitungsHinweise(welt: Welt, befunde: readonly Befund[]): HinweisZeile[] {
  const hart = befunde.filter((b) => b.hart);
  if (!hart.length) return [];
  const ort = hart[0].ort;
  return [{ id: "leitung_unsauber", code: "leitung_unsauber", bezug: "", status: null,
    text: `Leitungsführung unsauber: ${hart.length} ${hart.length === 1 ? "Konflikt" : "Konflikte"} in der automatischen Führung`,
    ziel: { geschossId: geschossBeiY(welt, ort[1]), position: { x: ort[0], y: ort[1], z: ort[2] }, schluessel: null } }];
}
