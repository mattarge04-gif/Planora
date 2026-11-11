import { describe, it, expect } from "vitest";
import { mengeText, panelDaten, uebersicht } from "./daten";
import type { Beschreibung, KatalogEintrag, Welt } from "../typen";

const KATALOG: KatalogEintrag[] = [
  { id: "heizung.verteiler", name: "Heizungsverteiler", bereich: "verteilung" },
  { id: "heizung.heizkoerper", name: "Heizkoerper", bereich: "einheit" },
  { id: "heizung.waermepumpe", name: "Waermepumpe", bereich: "zentrale" },
];
const WELT: Welt = {
  regelwerkVersion: 1, hash: "x", grundriss: [{ x: 0, z: 0, breite: 30, tiefe: 15 }],
  geschosse: [{ id: "g0", code: "EG", yUnten: 0, hoehe: 3 }, { id: "g1", code: "OG1", yUnten: 3, hoehe: 3 }],
  einheiten: [
    { id: "eR", geschossId: "g0", bezeichnung: "Restaurant", art: "gastro", rechteck: { x: 0, z: 0, breite: 15, tiefe: 15 }, quelle: "schematisch" },
    { id: "eT", geschossId: "g0", bezeichnung: "Technik", art: "technik", rechteck: { x: 15, z: 0, breite: 15, tiefe: 15 }, quelle: "schematisch" },
    { id: "eC", geschossId: "g1", bezeichnung: "Buero C", art: "buero", rechteck: { x: 0, z: 0, breite: 15, tiefe: 15 }, quelle: "schematisch" },
    { id: "eD", geschossId: "g1", bezeichnung: "Buero D", art: "buero", rechteck: { x: 15, z: 0, breite: 15, tiefe: 15 }, quelle: "schematisch" },
  ],
  symbole: [
    { schluessel: "sV", katalogId: "heizung.verteiler", hersteller: null, typ: null, bauteilIds: ["bV"], mengeSumme: 1, mengeUnbekannt: false, status: "bestaetigt", position: { x: 20, y: 0, z: 5 }, versorgt: ["eR", "eC"] },
    { schluessel: "sH", katalogId: "heizung.heizkoerper", hersteller: "Zehnder", typ: "Charleston", bauteilIds: ["bH1", "bH2"], mengeSumme: 12, mengeUnbekannt: true, status: "vorgeschlagen", position: { x: 5, y: 3, z: 5 }, versorgt: [] },
    { schluessel: "sW", katalogId: "heizung.waermepumpe", hersteller: null, typ: null, bauteilIds: ["bW"], mengeSumme: 0, mengeUnbekannt: true, status: "bestaetigt", position: { x: 15, y: 0, z: 7 }, versorgt: [] },
  ],
  hinweise: [{ code: "ueberlappung", bezug: "eD" }],
};
const BESCHREIBUNG: Beschreibung = {
  gebaeudeId: "G", stand: 1,
  bauteile: [
    { id: "bV", katalogId: "heizung.verteiler", standort: { einheitId: "eT" }, menge: 1, status: "bestaetigt", baujahr: 2015 },
    { id: "bH1", katalogId: "heizung.heizkoerper", standort: { einheitId: "eC" }, menge: 12, status: "bestaetigt", hersteller: "Zehnder", typ: "Charleston", baujahr: null },
    { id: "bH2", katalogId: "heizung.heizkoerper", standort: { einheitId: "eC" }, menge: null, status: "vorgeschlagen", hersteller: "Zehnder", typ: "Charleston" },
    { id: "bW", katalogId: "heizung.waermepumpe", standort: { geschossId: "g0" }, menge: null, status: "bestaetigt" },
  ],
  hinweise: [{ code: "verteiler_vorschlag", bezug: "eD" }],
};

describe("mengeText", () => {
  it("bekannt, unbekannt, teilweise", () => {
    expect(mengeText(3, false)).toBe("3");
    expect(mengeText(0, true)).toBe("unbekannt");
    expect(mengeText(12, true)).toBe("mind. 12 (teilweise unbekannt)");
  });
});

describe("panelDaten", () => {
  it("Verteiler: Standort Technik, versorgt Restaurant und Buero C", () => {
    expect(panelDaten(WELT, BESCHREIBUNG, KATALOG, "sV")).toEqual({
      titel: "Heizungsverteiler", herstellerTyp: null, status: "bestaetigt", menge: "1",
      zeilen: [{ menge: "1", baujahr: "2015" }],
      standort: "EG · Technik", versorgt: ["Restaurant (EG)", "Buero C (OG1)"],
    });
  });
  it("Heizkoerper: zwei Zeilen, Hersteller/Typ, teilweise unbekannte Menge", () => {
    expect(panelDaten(WELT, BESCHREIBUNG, KATALOG, "sH")).toMatchObject({
      herstellerTyp: "Zehnder · Charleston", status: "vorgeschlagen", menge: "mind. 12 (teilweise unbekannt)",
      zeilen: [{ menge: "12", baujahr: "–" }, { menge: "unbekannt", baujahr: "–" }], standort: "OG1 · Buero C", versorgt: [],
    });
  });
  it("Bauteil direkt am Geschoss", () => {
    expect(panelDaten(WELT, BESCHREIBUNG, KATALOG, "sW")?.standort).toBe("EG · direkt am Geschoss");
  });
  it("unbekannter Schluessel ergibt null", () => {
    expect(panelDaten(WELT, BESCHREIBUNG, KATALOG, "gibt-es-nicht")).toBeNull();
  });
});

describe("uebersicht", () => {
  it("zaehlt und uebersetzt Hinweise", () => {
    expect(uebersicht(WELT, BESCHREIBUNG)).toEqual({
      geschosse: 2, einheiten: 4, symbole: 3,
      hinweise: ["Buero D: Verteiler noch nicht erfasst", "Buero D: Layout ueberlappt"],
    });
  });
});
