import type { Katalog } from "./regelwerk.js";

/** Katalog v1, Demo nur Heizung (PO 2026-11-11). IDs nie umbenennen (ADR 0011). Mengen [A]. */
export const KATALOG_V1: Katalog = {
  version: 1,
  eintraege: [
    { id: "heizung.waermepumpe", name: "Waermepumpe", bereich: "zentrale", heizArt: null, mengeMax: 10 },
    { id: "heizung.gaskessel", name: "Gaskessel", bereich: "zentrale", heizArt: null, mengeMax: 10 },
    { id: "heizung.oelkessel", name: "Oelkessel", bereich: "zentrale", heizArt: null, mengeMax: 10 },
    { id: "heizung.fernwaerme_uebergabe", name: "Fernwaerme-Uebergabe", bereich: "zentrale", heizArt: null, mengeMax: 10 },
    { id: "heizung.speicher", name: "Speicher", bereich: "zentrale", heizArt: null, mengeMax: 10 },
    { id: "heizung.umwaelzpumpe", name: "Umwaelzpumpe", bereich: "zentrale", heizArt: null, mengeMax: 50 },
    { id: "heizung.verteiler", name: "Heizungsverteiler", bereich: "verteilung", heizArt: null, mengeMax: 20 },
    { id: "heizung.heizkoerper", name: "Heizkoerper", bereich: "einheit", heizArt: "hk", mengeMax: 500 },
    { id: "heizung.fbh_kreis", name: "FBH-Kreis", bereich: "einheit", heizArt: "fbh", mengeMax: 200 },
    { id: "heizung.tabs_feld", name: "TABS-Feld", bereich: "einheit", heizArt: "tabs", mengeMax: 200 },
  ],
};
