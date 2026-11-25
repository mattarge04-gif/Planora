import type { DatenblattFeld, Katalog } from "./regelwerk.js";

const z = (schluessel: string, bezeichnung: string, einheit: string | null): DatenblattFeld => ({ schluessel, bezeichnung, einheit, art: "zahl" });
const t = (schluessel: string, bezeichnung: string): DatenblattFeld => ({ schluessel, bezeichnung, einheit: null, art: "text" });
const DN = z("dn", "Nennweite", "DN");
/** [A] fachlich nicht freigegeben (Spec Anlagenakte 7). */
const QUELLE = { text: "VDI 2067 Blatt 1", jahr: 2012 }; // Anzeige: "in Anlehnung an" (Planora-Richtwert [A])

/** Katalog v2: v1 plus Masse [Breite, Hoehe, Tiefe] in Metern (schematisch), Zubehoer und Bibliothek. IDs nie umbenennen (ADR 0011). */
export const KATALOG_V2: Katalog = {
  version: 2,
  eintraege: [
    { id: "heizung.waermepumpe", name: "Waermepumpe", bereich: "zentrale", heizArt: null, mengeMax: 10, masse: [1, 1.2, 0.6], icon: "waermepumpe", lebensdauerQuelle: QUELLE,
      datenblatt: [z("leistung_kw", "Heizleistung", "kW"), z("cop", "COP", null), t("kaeltemittel", "Kältemittel")] },
    { id: "heizung.gaskessel", name: "Gaskessel", bereich: "zentrale", heizArt: null, mengeMax: 10, masse: [0.6, 1.6, 0.6], icon: "kessel", lebensdauerQuelle: QUELLE,
      datenblatt: [z("leistung_kw", "Nennleistung", "kW"), z("nutzungsgrad_pct", "Normnutzungsgrad", "%")] },
    { id: "heizung.oelkessel", name: "Oelkessel", bereich: "zentrale", heizArt: null, mengeMax: 10, masse: [0.7, 1.4, 0.8], icon: "kessel", lebensdauerQuelle: QUELLE,
      datenblatt: [z("leistung_kw", "Nennleistung", "kW"), z("nutzungsgrad_pct", "Normnutzungsgrad", "%")] },
    { id: "heizung.fernwaerme_uebergabe", name: "Fernwaerme-Uebergabe", bereich: "zentrale", heizArt: null, mengeMax: 10, masse: [1, 1.4, 0.35], icon: "fernwaerme", lebensdauerQuelle: QUELLE,
      datenblatt: [z("leistung_kw", "Anschlussleistung", "kW"), z("vorlauf_c", "Vorlauf primär", "°C")] },
    { id: "heizung.speicher", name: "Speicher", bereich: "zentrale", heizArt: null, mengeMax: 10, masse: [0.9, 1.8, 0.9], icon: "speicher", lebensdauerQuelle: QUELLE,
      datenblatt: [z("volumen_l", "Volumen", "l"), z("max_temp_c", "Max. Betriebstemperatur", "°C")] },
    { id: "heizung.umwaelzpumpe", name: "Umwaelzpumpe", bereich: "zubehoer", heizArt: null, mengeMax: 50, masse: [0.35, 0.45, 0.3], icon: "pumpe", lebensdauerQuelle: QUELLE,
      datenblatt: [DN, z("foerderhoehe_m", "Förderhöhe", "m"), z("leistung_w", "Leistungsaufnahme", "W")] },
    { id: "heizung.verteiler", name: "Heizungsverteiler", bereich: "verteilung", heizArt: null, mengeMax: 20, masse: [1.2, 1, 0.3], icon: "verteiler", lebensdauerQuelle: QUELLE,
      datenblatt: [DN, z("abgaenge", "Abgänge", null)] },
    { id: "heizung.heizkoerper", name: "Heizkoerper", bereich: "einheit", heizArt: "hk", mengeMax: 500, masse: [1, 0.65, 0.12], icon: "heizkoerper", lebensdauerQuelle: QUELLE,
      datenblatt: [z("leistung_w", "Wärmeleistung", "W"), t("bauart", "Bauart")] },
    { id: "heizung.fbh_kreis", name: "FBH-Kreis", bereich: "einheit", heizArt: "fbh", mengeMax: 200, masse: [0.6, 0.8, 0.15], icon: "flaechenheizung", lebensdauerQuelle: QUELLE,
      datenblatt: [z("rohrlaenge_m", "Rohrlänge", "m"), t("rohr", "Rohrdimension")] },
    { id: "heizung.tabs_feld", name: "TABS-Feld", bereich: "einheit", heizArt: "tabs", mengeMax: 200, masse: [0.6, 0.8, 0.15], icon: "flaechenheizung", lebensdauerQuelle: QUELLE,
      datenblatt: [z("flaeche_m2", "Fläche", "m²")] },
    { id: "heizung.ventil_3weg", name: "3-Weg-Ventil", bereich: "zubehoer", heizArt: null, mengeMax: 50, masse: [0.2, 0.25, 0.2], icon: "ventil", lebensdauerQuelle: QUELLE,
      datenblatt: [DN, z("kvs", "kvs-Wert", "m³/h")] },
    { id: "heizung.ventil_2weg", name: "Durchgangsventil", bereich: "zubehoer", heizArt: null, mengeMax: 50, masse: [0.15, 0.25, 0.15], icon: "ventil", lebensdauerQuelle: QUELLE,
      datenblatt: [DN, z("kvs", "kvs-Wert", "m³/h")] },
    { id: "heizung.wmz", name: "Waermezaehler", bereich: "zubehoer", heizArt: null, mengeMax: 50, masse: [0.25, 0.2, 0.15], icon: "zaehler", lebensdauerQuelle: QUELLE,
      datenblatt: [DN, z("qp", "Nenndurchfluss qp", "m³/h")] },
    { id: "heizung.ausdehnungsgefaess", name: "Ausdehnungsgefaess", bereich: "zentrale", heizArt: null, mengeMax: 10, masse: [0.45, 0.7, 0.45], icon: "ausdehnung", lebensdauerQuelle: QUELLE,
      datenblatt: [z("volumen_l", "Volumen", "l"), z("vordruck_bar", "Vordruck", "bar")] },
    { id: "heizung.sonstiges", name: "Sonstiges", bereich: "zentrale", heizArt: null, mengeMax: 50, masse: [0.5, 0.5, 0.4], icon: "anlage",
      lebensdauerQuelle: { text: "Planora-Ersatzwert", jahr: 2026 }, datenblatt: [t("beschreibung", "Beschreibung")] },
  ],
};
