import { weltErzeugenV2 } from "./generator.v2.js";
import { mitHash, weltKern } from "./generator.kern.js";
import type { Regelwerk, RegelwerkV2 } from "./regelwerk.js";
import type { Beschreibung, HuelleGespeichert, Welt } from "./typen.js";

export * from "./generator.kern.js";

/** Welt aus Huelle und Beschreibung; Regelwerk v2 hat einen eigenen Codepfad (Raumkomposition). */
export function weltErzeugen(h: HuelleGespeichert, b: Beschreibung, rw: Regelwerk): Welt {
  if (rw.version === 2) return weltErzeugenV2(h, b, rw as RegelwerkV2);
  return mitHash(weltKern(h, b, rw));
}
