import type { Beschreibung, Grundform, HuelleGespeichert } from "../src/welt/typen.js";

/** Feste, gueltige UUIDs fuer reproduzierbare Tests. */
export const G = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

/** Geschosse absichtlich unsortiert (UG1 zuletzt), Generator muss nach Rang sortieren. */
export function huelleFixture(grundform: Grundform = "quader"): HuelleGespeichert {
  return {
    gebaeudeId: G(1), liegenschaftId: G(2), name: "Test", grundform, breiteM: 30, tiefeM: 15, regelwerkVersion: 1, stand: 0,
    geschosse: [{ id: G(10), code: "EG", hoeheM: 3 }, { id: G(11), code: "OG1", hoeheM: 3.5 }, { id: G(9), code: "UG1", hoeheM: 2.5 }],
  };
}

/** A (Buero, EG), B (Technik, EG), C (Buero, OG1); 100 HK Zehnder + 1 HK Prolux in A; Verteiler in B versorgt C und A. */
export function beschreibungFixture(): Beschreibung {
  return {
    gebaeudeId: G(1), stand: 0, heizungStandard: { hk: "ja", fbh: "nein", tabs: "nein" },
    einheiten: [
      { id: G(20), geschossId: G(10), bezeichnung: "A", art: "buero", flaecheM2: null },
      { id: G(21), geschossId: G(10), bezeichnung: "B", art: "technik", flaecheM2: null },
      { id: G(22), geschossId: G(11), bezeichnung: "C", art: "buero", flaecheM2: null },
    ],
    bauteile: [
      { id: G(30), katalogId: "heizung.heizkoerper", standort: { einheitId: G(20) }, menge: 100, status: "bestaetigt", hersteller: "Zehnder", versorgt: [] },
      { id: G(31), katalogId: "heizung.heizkoerper", standort: { einheitId: G(20) }, menge: 1, status: "bestaetigt", hersteller: "Prolux", versorgt: [] },
      { id: G(32), katalogId: "heizung.verteiler", standort: { einheitId: G(21) }, menge: 1, status: "bestaetigt", versorgt: [{ einheitId: G(22) }, { einheitId: G(20) }] },
    ],
  };
}
