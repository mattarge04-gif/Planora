import { describe, it, expect } from "vitest";
import { raumModule } from "../src/welt/raum/matrix.js";
import { REGELWERK_V2 } from "../src/welt/regelwerk.v2.js";

describe("raumModule (Modulmatrix, Spec 5.1)", () => {
  it.each([
    [0, [2, 2]], [1, [2, 2]], [2, [3, 2]], [3, [3, 3]], [4, [3, 3]], [5, [4, 3]], [6, [4, 3]], [7, [5, 3]], [8, [5, 3]], [9, [6, 3]],
  ] as const)("Abgaberaum mit %i Symbolen -> %j", (n, [laenge, tiefe]) => {
    expect(raumModule("buero", n, 0, REGELWERK_V2)).toEqual({ laenge, tiefe });
  });
  it("gleiche Regel fuer alle Abgabe-Arten", () => {
    for (const art of ["wohnung", "gastro", "allgemein"]) expect(raumModule(art, 3, 0, REGELWERK_V2)).toEqual({ laenge: 3, tiefe: 3 });
  });
  it.each([[0, 2], [1, 2], [2, 2], [3, 3], [6, 6]] as const)("Technik mit %i Geraeten -> Laenge %i, Tiefe 2", (g, laenge) => {
    expect(raumModule("technik", 0, g, REGELWERK_V2)).toEqual({ laenge, tiefe: 2 });
  });
  it("Technik zaehlt Geraete, nicht Symbole", () => {
    expect(raumModule("technik", 9, 1, REGELWERK_V2)).toEqual({ laenge: 2, tiefe: 2 });
  });
  it("Kern ist fix 2 x 2, unabhaengig vom Inhalt", () => {
    expect(raumModule("kern", 0, 0, REGELWERK_V2)).toEqual({ laenge: 2, tiefe: 2 });
    expect(raumModule("kern", 7, 3, REGELWERK_V2)).toEqual({ laenge: 2, tiefe: 2 });
  });
  it("folgt den Werten des Regelwerks", () => {
    const rw = { ...REGELWERK_V2, raum: { ...REGELWERK_V2.raum, leer: [1, 1] as [number, number], abgabe: { ...REGELWERK_V2.raum.abgabe, jeZweiWeitere: 2 } } };
    expect(raumModule("buero", 0, 0, rw)).toEqual({ laenge: 1, tiefe: 1 });
    expect(raumModule("buero", 5, 0, rw)).toEqual({ laenge: 5, tiefe: 3 });
  });
});
