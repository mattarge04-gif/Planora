import type { Katalog } from "./regelwerk.js";

/** Katalog v2: v1 plus Masse [Breite, Hoehe, Tiefe] in Metern (schematisch) und Zubehoer. IDs nie umbenennen (ADR 0011). */
export const KATALOG_V2: Katalog = {
  version: 2,
  eintraege: [
    { id: "heizung.waermepumpe", name: "Waermepumpe", bereich: "zentrale", heizArt: null, mengeMax: 10, masse: [1, 1.2, 0.6] },
    { id: "heizung.gaskessel", name: "Gaskessel", bereich: "zentrale", heizArt: null, mengeMax: 10, masse: [0.6, 1.6, 0.6] },
    { id: "heizung.oelkessel", name: "Oelkessel", bereich: "zentrale", heizArt: null, mengeMax: 10, masse: [0.7, 1.4, 0.8] },
    { id: "heizung.fernwaerme_uebergabe", name: "Fernwaerme-Uebergabe", bereich: "zentrale", heizArt: null, mengeMax: 10, masse: [1, 1.4, 0.35] },
    { id: "heizung.speicher", name: "Speicher", bereich: "zentrale", heizArt: null, mengeMax: 10, masse: [0.9, 1.8, 0.9] },
    { id: "heizung.umwaelzpumpe", name: "Umwaelzpumpe", bereich: "zubehoer", heizArt: null, mengeMax: 50, masse: [0.35, 0.45, 0.3] },
    { id: "heizung.verteiler", name: "Heizungsverteiler", bereich: "verteilung", heizArt: null, mengeMax: 20, masse: [1.2, 1, 0.3] },
    { id: "heizung.heizkoerper", name: "Heizkoerper", bereich: "einheit", heizArt: "hk", mengeMax: 500, masse: [1, 0.65, 0.12] },
    { id: "heizung.fbh_kreis", name: "FBH-Kreis", bereich: "einheit", heizArt: "fbh", mengeMax: 200, masse: [0.6, 0.8, 0.15] },
    { id: "heizung.tabs_feld", name: "TABS-Feld", bereich: "einheit", heizArt: "tabs", mengeMax: 200, masse: [0.6, 0.8, 0.15] },
    { id: "heizung.ventil_3weg", name: "3-Weg-Ventil", bereich: "zubehoer", heizArt: null, mengeMax: 50, masse: [0.2, 0.25, 0.2] },
    { id: "heizung.ventil_2weg", name: "Durchgangsventil", bereich: "zubehoer", heizArt: null, mengeMax: 50, masse: [0.15, 0.25, 0.15] },
    { id: "heizung.wmz", name: "Waermezaehler", bereich: "zubehoer", heizArt: null, mengeMax: 50, masse: [0.25, 0.2, 0.15] },
  ],
};
