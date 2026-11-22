import { describe, expect, it } from "vitest";
import { MINI_PEGEL_PX, miniPegelText, miniSegmente } from "./miniPegel";

describe("Mini-Pegel der Geschoss-Karte", () => {
  it("Reihenfolge wie das Band, Dringendstes links, Fuge zwischen Segmenten", () => {
    const s = miniSegmente({ rot: 4, gelb: 1, gruen: 0, grau: 2 });
    expect(s.map((x) => x.ampel)).toEqual(["rot", "gelb", "grau"]);
    expect(s[0].von).toBe(0);
    expect(s[2].bis).toBeCloseTo(1, 6);
    expect((s[1].von - s[0].bis) * MINI_PEGEL_PX).toBeCloseTo(2, 6);
  });
  it("eine Stufe füllt ohne Fuge, ohne Zähler leer", () => {
    expect(miniSegmente({ rot: 0, gelb: 0, gruen: 3, grau: 0 })).toEqual([{ ampel: "gruen", von: 0, bis: 1 }]);
    expect(miniSegmente(undefined)).toEqual([]);
  });
  it("Text mit Zählern", () => {
    expect(miniPegelText("UG1", { rot: 4, gelb: 1, gruen: 2, grau: 0 })).toBe("UG1: 4 ersetzen, 1 bald ersetzen, 2 in Ordnung");
    expect(miniPegelText("OG1", undefined)).toBe("OG1: keine Bauteile mit Lebensdauer");
  });
});
