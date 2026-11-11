import { STANDORT_GESCHOSS, type Regelwerk } from "./regelwerk.js";

const ZENTRALE = ["heizung.waermepumpe", "heizung.gaskessel", "heizung.oelkessel", "heizung.fernwaerme_uebergabe", "heizung.speicher", "heizung.umwaelzpumpe"];
const VERTEILER = "heizung.verteiler";
const HK = "heizung.heizkoerper";
const FLAECHE = ["heizung.fbh_kreis", "heizung.tabs_feld"];
const RAUM = [VERTEILER, HK, ...FLAECHE];

/** Welt-Regelwerk v1. Alle Werte [A] bis PO-Freigabe (Spec §3). */
export const REGELWERK_V1: Regelwerk = {
  version: 1,
  schenkelAnteil: 0.4,
  masse: { min: 5, max: 200, defaultBreite: 30, defaultTiefe: 15 },
  geschoss: { hoeheMin: 2.4, hoeheMax: 6.0, hoeheDefault: 3.2 },
  einheitArten: {
    buero: { name: "Buero", defaultFlaecheM2: 120 },
    wohnung: { name: "Wohnung", defaultFlaecheM2: 90 },
    gastro: { name: "Gastro", defaultFlaecheM2: 150 },
    technik: { name: "Technik", defaultFlaecheM2: 30 },
    kern: { name: "Kern (Treppenhaus/Lift)", defaultFlaecheM2: 25 },
    allgemein: { name: "Allgemein", defaultFlaecheM2: 40 },
  },
  erlaubt: {
    buero: RAUM, wohnung: RAUM, gastro: RAUM, allgemein: RAUM,
    technik: [...ZENTRALE, VERTEILER, HK],
    kern: [HK],
    [STANDORT_GESCHOSS]: [...ZENTRALE, VERTEILER],
  },
};
