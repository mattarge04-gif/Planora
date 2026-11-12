import type { Regelwerk } from "./regelwerk.js";
import { REGELWERK_V1 } from "./regelwerk.v1.js";
import { REGELWERK_V2 } from "./regelwerk.v2.js";

/** Regelwerk zur gespeicherten Version. Eigene Datei, damit regelwerk.ts keine Importschleife mit v1/v2 bildet. */
export function regelwerkFuer(version: number): Regelwerk {
  if (version === 1) return REGELWERK_V1;
  if (version === 2) return REGELWERK_V2;
  throw new Error(`Regelwerk v${version} unbekannt`);
}
