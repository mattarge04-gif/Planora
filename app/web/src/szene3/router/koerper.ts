import type { KatalogEintrag, Welt } from "../../typen";
import { modellVon, type AnzeigeSymbol } from "../technik";
import { GRENZEN, type Koerper } from "./typen";

/** Abgaben (Heizkoerper, FBH, TABS) und Teile in der Leitung sind Leitungsenden, keine Hindernisse. */
const KEIN_HINDERNIS = new Set(["heizung.heizkoerper", "heizung.fbh_kreis", "heizung.tabs_feld"]);

/** Geraetekoerper: Ursprung Mitte Unterkante (wie GLB), Masse aus Modell/Katalog, plus Zuschlag [A]. */
export function geraeteKoerper(welt: Welt, katalog: KatalogEintrag[]): Koerper[] {
  const z = GRENZEN.geraetZuschlag;
  return [...welt.symbole].sort((a, b) => (a.schluessel < b.schluessel ? -1 : 1))
    .filter((s) => !KEIN_HINDERNIS.has(s.katalogId) && !(s as AnzeigeSymbol).inline)
    .map((s) => {
      const [b, h, t] = modellVon(s, katalog).masse, p = s.position;
      return { schluessel: s.schluessel, min: [p.x - b / 2 - z, p.y, p.z - t / 2 - z], max: [p.x + b / 2 + z, p.y + h, p.z + t / 2 + z] };
    });
}
