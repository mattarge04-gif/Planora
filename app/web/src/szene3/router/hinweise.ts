import type { HinweisZeile } from "../../dashboard/daten";
import { geschossBeiY } from "../../szene2/leitungen";
import type { KatalogEintrag, Welt } from "../../typen";
import { rohrnetzMitBefunden } from "../netz";

/** Ein Sammelhinweis, wenn die automatische Leitungsfuehrung harte Befunde hat (Spec 5.5). */
export function leitungsHinweise(welt: Welt, katalog: KatalogEintrag[]): HinweisZeile[] {
  const hart = rohrnetzMitBefunden(welt, katalog, {}).befunde.filter((b) => b.hart);
  if (!hart.length) return [];
  const ort = hart[0].ort;
  return [{ id: "leitung_unsauber", code: "leitung_unsauber", bezug: "", status: null,
    text: `Leitungsführung unsauber: ${hart.length} ${hart.length === 1 ? "Konflikt" : "Konflikte"} in der automatischen Führung`,
    ziel: { geschossId: geschossBeiY(welt, ort[1]), position: { x: ort[0], y: ort[1], z: ort[2] }, schluessel: null } }];
}
