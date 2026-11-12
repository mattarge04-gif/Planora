import { REGELWERK_V1 } from "./regelwerk.v1.js";
import type { RegelwerkV2 } from "./regelwerk.js";

const PUMPE = "heizung.umwaelzpumpe";
const V3 = "heizung.ventil_3weg";
const V2 = "heizung.ventil_2weg";
const ZUBEHOER = [PUMPE, V3, V2, "heizung.wmz"];

/** Welt-Regelwerk v2 (Interview-Assistent, Spec Stufe 1 §4.3/§5). Raumwerte aus der Modulmatrix; Kern erlaubt kein Zubehoer. */
export const REGELWERK_V2: RegelwerkV2 = {
  ...REGELWERK_V1,
  version: 2,
  erlaubt: Object.fromEntries(Object.entries(REGELWERK_V1.erlaubt).map(([art, liste]) =>
    [art, art === "kern" ? liste : [...liste, ...ZUBEHOER.filter((z) => !liste.includes(z))]])),
  raum: {
    modulM: 3, gangModule: 1, seitenMax: 1.6, minGebaeude: [4, 5],
    abgabe: { eins: [2, 2], zwei: [3, 2], dreiVier: [3, 3], jeZweiWeitere: 1 },
    technik: { minLaenge: 2, tiefe: 2 }, kern: [2, 2], leer: [2, 2],
  },
  bestueckung: {
    ungeregelt: [{ katalogId: PUMPE, menge: 1 }],
    beimisch: [{ katalogId: PUMPE, menge: 1 }, { katalogId: V3, menge: 1 }],
    drossel: [{ katalogId: V2, menge: 1 }],
    einspritz: [{ katalogId: PUMPE, menge: 1 }, { katalogId: V2, menge: 1 }],
    umlenk: [{ katalogId: V3, menge: 1 }],
  },
};
