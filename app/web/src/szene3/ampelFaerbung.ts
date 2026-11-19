import { AMPEL_FARBE, ampelJeSymbol } from "../lebensdauer/ansicht";
import type { LdStand } from "../lebensdauer/typen";
import type { WeltSymbol } from "../typen";

/** Schluessel -> Hex der Ampelfarbe (schlechteste Ampel der Bauteile eines Symbols). */
export function ampelFarben(stand: LdStand, symbole: Pick<WeltSymbol, "schluessel" | "bauteilIds">[]): Map<string, string> {
  return new Map([...ampelJeSymbol(stand, symbole)].map(([k, a]) => [k, AMPEL_FARBE[a]]));
}
