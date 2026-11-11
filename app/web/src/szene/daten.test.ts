import { describe, it, expect } from "vitest";
import { FARBEN, aufhellen, szeneDaten } from "./daten";
import type { KatalogEintrag, Welt } from "../typen";

const KATALOG: KatalogEintrag[] = [
  { id: "heizung.waermepumpe", name: "Waermepumpe", bereich: "zentrale" },
  { id: "heizung.heizkoerper", name: "Heizkoerper", bereich: "einheit" },
];
const WELT: Welt = {
  regelwerkVersion: 1, hash: "x",
  grundriss: [{ x: 0, z: 0, breite: 30, tiefe: 15 }],
  geschosse: [{ id: "g0", code: "EG", yUnten: 0, hoehe: 3 }, { id: "g1", code: "OG1", yUnten: 3, hoehe: 3.5 }],
  einheiten: [
    { id: "e1", geschossId: "g0", bezeichnung: "Technik", art: "technik", rechteck: { x: 0, z: 0, breite: 10, tiefe: 15 }, quelle: "schematisch" },
    { id: "e2", geschossId: "g1", bezeichnung: "Buero", art: "buero", rechteck: { x: 0, z: 0, breite: 30, tiefe: 15 }, quelle: "schematisch" },
  ],
  symbole: [
    { schluessel: "s1", katalogId: "heizung.waermepumpe", hersteller: null, typ: null, bauteilIds: ["b1"], mengeSumme: 1, mengeUnbekannt: false, status: "bestaetigt", position: { x: 5, y: 0, z: 7.5 }, versorgt: [] },
    { schluessel: "s2", katalogId: "heizung.heizkoerper", hersteller: "Zehnder", typ: null, bauteilIds: ["b2"], mengeSumme: 4, mengeUnbekannt: false, status: "vorgeschlagen", position: { x: 15, y: 3, z: 7.5 }, versorgt: [] },
  ],
  hinweise: [],
};

describe("aufhellen", () => {
  it("mischt mit Weiss", () => {
    expect(aufhellen("#000000", 0.5)).toBe("#808080");
    expect(aufhellen("#059669")).toBe("#8fd0bc");
  });
});

describe("szeneDaten", () => {
  const d = szeneDaten(WELT, KATALOG);
  it("eine Glasplatte je Geschoss und Teilrechteck", () => {
    expect(d.platten).toEqual([
      { mitte: [15, 0, 7.5], breite: 30, tiefe: 15 },
      { mitte: [15, 3, 7.5], breite: 30, tiefe: 15 },
    ]);
  });
  it("Linien: Fassade (2 Umrisse + 4 Senkrechte) und je Einheit ein Umriss", () => {
    // Fassade: 2 × 4 Segmente + 4 Senkrechte = 12 Segmente; Einheiten: 2 × 4 = 8 Segmente; je Segment 6 Zahlen
    expect(d.linien.length).toBe((12 + 8) * 6);
  });
  it("Beschriftung je Geschoss mit Einzahl/Mehrzahl und je Einheit", () => {
    expect(d.beschriftungen.map((b) => b.text)).toEqual(["EG · 1 Einheit", "OG1 · 1 Einheit", "Technik", "Buero"]);
  });
  it("Pins mit Bereichsfarbe; vorgeschlagen aufgehellt; knapp ueber dem Boden", () => {
    expect(d.pins).toEqual([
      { schluessel: "s1", position: [5, 0.25, 7.5], farbe: FARBEN.zentrale, name: "Waermepumpe" },
      { schluessel: "s2", position: [15, 3.25, 7.5], farbe: aufhellen(FARBEN.einheit), name: "Heizkoerper" },
    ]);
  });
  it("Kamera zielt auf die Gebaeudemitte", () => {
    expect(d.kamera.ziel).toEqual([15, 3.25, 7.5]);
    expect(d.kamera.radius).toBeCloseTo(Math.hypot(15, 3.25, 7.5), 6);
  });
  it("unbekannte Katalog-ID: Farbe Einheit, Name = ID", () => {
    const w = { ...WELT, symbole: [{ ...WELT.symbole[0], katalogId: "x.y" }] };
    expect(szeneDaten(w, KATALOG).pins[0]).toMatchObject({ farbe: FARBEN.einheit, name: "x.y" });
  });
  it("leere Welt ergibt leere Szene ohne Fehler", () => {
    const leer = szeneDaten({ ...WELT, geschosse: [], einheiten: [], symbole: [] }, KATALOG);
    expect(leer.platten).toEqual([]);
    expect(leer.pins).toEqual([]);
    expect(Number.isFinite(leer.kamera.radius)).toBe(true);
  });
});
