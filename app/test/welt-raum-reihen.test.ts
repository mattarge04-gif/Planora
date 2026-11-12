import { describe, it, expect } from "vitest";
import { verteileReihen } from "../src/welt/raum/reihen.js";

const r = (...l: number[]) => l.map((laenge, i) => ({ id: String.fromCharCode(97 + i), laenge }));
const summe = (ids: string[], raeume: { id: string; laenge: number }[]) => ids.reduce((s, id) => s + raeume.find((x) => x.id === id)!.laenge, 0);

describe("verteileReihen", () => {
  it("ausgeglichen bei [3,3,2,2]", () => {
    const raeume = r(3, 3, 2, 2);
    const [a, b] = verteileReihen(raeume);
    expect([a, b]).toEqual([["a", "c"], ["b", "d"]]);
    expect(summe(a, raeume)).toBe(summe(b, raeume));
  });
  it("groesste zuerst, jeweils in die kuerzere Reihe; Ergebnis in Eingabereihenfolge", () => {
    // Reihenfolge der Zuteilung: d(5)->0, b(3)->1, a(2)->1, c(2)->0
    expect(verteileReihen(r(2, 3, 2, 5))).toEqual([["c", "d"], ["a", "b"]]);
  });
  it("Gleichstand der Groesse: Eingabereihenfolge; Gleichstand der Reihen: Reihe 0", () => {
    expect(verteileReihen(r(2, 2, 2))).toEqual([["a", "c"], ["b"]]);
  });
  it("ein Raum -> Reihe 0; leer -> zwei leere Reihen", () => {
    expect(verteileReihen(r(4))).toEqual([["a"], []]);
    expect(verteileReihen([])).toEqual([[], []]);
  });
  it("ist deterministisch", () => {
    const raeume = r(3, 1, 4, 1, 5, 9, 2, 6);
    expect(verteileReihen(raeume)).toEqual(verteileReihen([...raeume]));
  });
  it("Vorlauf: Reihe mit Vorlauf gilt als laenger (innere Reihe bei L/U)", () => {
    expect(verteileReihen(r(2, 2, 2), { vorlauf: [0, 6] })).toEqual([["a", "b", "c"], []]);
    expect(verteileReihen(r(2, 2, 2, 2), { vorlauf: [0, 3] })).toEqual([["a", "b", "d"], ["c"]]);
  });
  it("Kapazitaet: Zuteilung nach Fuellgrad", () => {
    // a(3): 3/12 < 3/6 -> 0; b(2): 5/12 > 2/6 -> 1; c(2): 7/12 < 4/6 -> 0
    expect(verteileReihen(r(3, 2, 2), { kapazitaet: [12, 6] })).toEqual([["a", "c"], ["b"]]);
  });
});
