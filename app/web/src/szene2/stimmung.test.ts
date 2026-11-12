import { describe, it, expect } from "vitest";
import { FOKUS, HELL, mische, mischeFarbe } from "./stimmung";
import { GEWERK, NEUTRAL, gewerkVon } from "./farben";

describe("mischeFarbe", () => {
  it("interpoliert je Kanal", () => {
    expect(mischeFarbe("#000000", "#ffffff", 0)).toBe("#000000");
    expect(mischeFarbe("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mischeFarbe("#000000", "#ffffff", 1)).toBe("#ffffff");
  });
});

describe("mische", () => {
  it("liefert die Endpunkte", () => {
    expect(mische(HELL, FOKUS, 0)).toEqual(HELL);
    expect(mische(HELL, FOKUS, 1)).toEqual(FOKUS);
  });
  it("begrenzt t auf 0..1", () => {
    expect(mische(HELL, FOKUS, -1)).toEqual(HELL);
    expect(mische(HELL, FOKUS, 2)).toEqual(FOKUS);
  });
  it("interpoliert Zahlen linear", () => {
    expect(mische(HELL, FOKUS, 0.5).umgebung).toBeCloseTo((HELL.umgebung + FOKUS.umgebung) / 2);
  });
});

describe("gewerkVon", () => {
  it("Heizung ist rot", () => {
    expect(gewerkVon("heizung.verteiler")).toEqual(GEWERK.heizung);
    expect(GEWERK.heizung.geraet).toBe("#8a5450");
    expect(GEWERK.heizung.leitung).toBe("#ff3b30");
  });
  it("unbekanntes Gewerk ist neutral", () => {
    expect(gewerkVon("lueftung.geraet")).toEqual(NEUTRAL);
  });
});
