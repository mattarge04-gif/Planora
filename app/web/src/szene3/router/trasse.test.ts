import { describe, expect, it } from "vitest";
import { spurenZuteilen, spurWert, trassenLage } from "./trasse";

describe("trasse", () => {
  it("Trasse entlang der Laengsseite, an der naeheren Wand", () => {
    const l = trassenLage({ x: 0, z: 0, breite: 6, tiefe: 4 }, [[1, 2.8, 0.8], [5, 2.8, 1.2]]);
    expect(l).toEqual({ achse: 0, wand: 0, innen: 1 });
    expect(spurWert(l, 0)).toBeCloseTo(0.3);
    expect(spurWert(l, 2)).toBeCloseTo(0.66);
  });
  it("verschachtelt: aeusseres Intervall wandnah, inneres weiter innen", () => {
    const s = spurenZuteilen([{ netz: "innen", von: 2, bis: 3 }, { netz: "aussen", von: 1, bis: 5 }]);
    expect(s.get("aussen")).toBe(0);
    expect(s.get("innen")).toBe(1);
  });
  it("disjunkte Intervalle teilen eine Spur", () => {
    const s = spurenZuteilen([{ netz: "a", von: 0, bis: 1 }, { netz: "b", von: 2, bis: 3 }]);
    expect(s.get("a")).toBe(0); expect(s.get("b")).toBe(0);
  });
  it("verschraenkte Intervalle: das kuerzere erhaelt keine Spur", () => {
    const s = spurenZuteilen([{ netz: "lang", von: 0, bis: 4 }, { netz: "kurz", von: 3, bis: 5 }]);
    expect(s.get("lang")).toBe(0); expect(s.has("kurz")).toBe(false);
  });
  it("deterministisch bei gleicher Laenge", () => {
    const a = spurenZuteilen([{ netz: "b", von: 0, bis: 2 }, { netz: "a", von: 0, bis: 2 }]);
    expect([...a.entries()]).toEqual([["a", 0], ["b", 1]]);
  });
  it("nutzt die obere x-Wand bei einer Laengsseite entlang z", () => {
    const l = trassenLage({ x: 10, z: 20, breite: 4, tiefe: 6 }, [[13, 2.8, 21], [13.5, 2.8, 25]]);
    expect(l).toEqual({ achse: 2, wand: 14, innen: -1 });
    expect(spurWert(l, 2)).toBeCloseTo(13.34);
  });
  it("gleiche Wandabstaende und leere Anschluesse bevorzugen die untere Wand", () => {
    const raum = { x: 10, z: 20, breite: 4, tiefe: 4 };
    expect(trassenLage(raum, [[12, 0, 22]])).toEqual({ achse: 0, wand: 20, innen: 1 });
    expect(trassenLage(raum, [])).toEqual({ achse: 0, wand: 20, innen: 1 });
  });
  it("normalisiert umgekehrte Intervalle ohne die Eingabe zu aendern", () => {
    const auftraege = [{ netz: "innen", von: 3, bis: 2 }, { netz: "aussen", von: 5, bis: 1 }];
    const vorher = structuredClone(auftraege);
    expect([...spurenZuteilen(auftraege)]).toEqual([["aussen", 0], ["innen", 1]]);
    expect(auftraege).toEqual(vorher);
  });
  it("mehrfache Verschachtelung vergibt steigende Spuren", () => {
    const auftraege = [
      { netz: "innen", von: 2, bis: 3 }, { netz: "mitte", von: 1, bis: 4 }, { netz: "aussen", von: 0, bis: 5 },
    ];
    expect([...spurenZuteilen(auftraege)]).toEqual([["aussen", 0], ["innen", 2], ["mitte", 1]]);
    expect([...spurenZuteilen([...auftraege].reverse())]).toEqual([...spurenZuteilen(auftraege)]);
  });
  it("nur an Enden beruehrende Intervalle teilen eine Spur", () => {
    expect([...spurenZuteilen([{ netz: "a", von: 0, bis: 2 }, { netz: "b", von: 2, bis: 4 }])])
      .toEqual([["a", 0], ["b", 0]]);
  });
  it("gleich lange verschraenkte Intervalle werden nach Netzkennung entschieden", () => {
    expect([...spurenZuteilen([{ netz: "b", von: 0, bis: 2 }, { netz: "a", von: 1, bis: 3 }])])
      .toEqual([["a", 0]]);
  });
  it("leere Auftraege ergeben keine Spuren", () => {
    expect(spurenZuteilen([]).size).toBe(0);
  });
});
