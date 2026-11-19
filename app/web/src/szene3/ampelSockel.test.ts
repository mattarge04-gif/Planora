import { describe, expect, it } from "vitest";
import { TOKENS } from "../design/tokens";
import { ampelRaender, ampelSockel, striche1D } from "./ampelSockel";

const E = TOKENS.erneuerung;
const anlage = (o: Partial<Parameters<typeof ampelSockel>[0][number]> = {}) =>
  ({ schluessel: "a", mitte: [1, 0.5, 2] as [number, number, number], masse: [0.6, 1, 0.4] as [number, number, number], inline: false, farbe: "#d64541", grau: false, ...o });

describe("ampelSockel", () => {
  it("Scheibe unter stehender Anlage, Rand je Seite, knapp über dem Boden", () => {
    const { scheiben, striche } = ampelSockel([anlage()], 3);
    expect(striche).toEqual([]);
    expect(scheiben).toHaveLength(1);
    const s = scheiben[0];
    expect(s.breite).toBeCloseTo(0.6 + 2 * E.sockelRandM);
    expect(s.tiefe).toBeCloseTo(0.4 + 2 * E.sockelRandM);
    expect(s.position[0]).toBe(1); expect(s.position[2]).toBe(2);
    expect(s.position[1]).toBeCloseTo(3 + E.sockelBodenM + E.sockelHoeheM / 2);
    expect(s.farbe).toBe("#d64541");
  });
  it("Teile in der Leitung erhalten keinen Sockel; je Schluessel nur einmal", () => {
    const { scheiben } = ampelSockel([anlage({ inline: true }), anlage({ schluessel: "b" }), anlage({ schluessel: "b" })], 0);
    expect(scheiben.map((s) => s.schluessel)).toEqual(["b"]);
  });
  it("Baujahr fehlt: gestrichelter Rand statt Scheibe, innerhalb des Sockelumrisses", () => {
    const { scheiben, striche } = ampelSockel([anlage({ grau: true })], 0);
    expect(scheiben).toEqual([]);
    expect(striche.length).toBeGreaterThanOrEqual(8);
    const halbB = (0.6 + 2 * E.sockelRandM) / 2, halbT = (0.4 + 2 * E.sockelRandM) / 2;
    for (const s of striche) {
      const halbL = s.laenge / 2;
      if (s.achse === "x") expect(Math.abs(s.position[0] - 1) + halbL).toBeLessThanOrEqual(halbB + 1e-9);
      else expect(Math.abs(s.position[2] - 2) + halbL).toBeLessThanOrEqual(halbT + 1e-9);
    }
  });
});

describe("striche1D", () => {
  it("Enden voll, Summe aus Strichen und Luecken ergibt die Laenge", () => {
    const l = 1.0, t = striche1D(l);
    expect(t.length).toBeGreaterThanOrEqual(2);
    expect(t[0][0] - t[0][1] / 2).toBeCloseTo(-l / 2);
    expect(t.at(-1)![0] + t.at(-1)![1] / 2).toBeCloseTo(l / 2);
    expect(t.reduce((s, [, x]) => s + x, 0) + (t.length - 1) * E.lueckeM).toBeCloseTo(l);
  });
  it("Massstab k vergroessert Striche und Luecken", () => {
    const t = striche1D(3, 2);
    expect(t.reduce((s, [, x]) => s + x, 0) + (t.length - 1) * E.lueckeM * 2).toBeCloseTo(3);
  });
  it("kurze Strecke: ein Strich", () => {
    expect(striche1D(0.05)).toEqual([[0, 0.05]]);
  });
});

describe("ampelRaender", () => {
  it("nah: Meterwerte", () => {
    expect(ampelRaender(400)).toEqual({ sockel: E.sockelRandM, huelle: Math.round(E.huelleZuschlagM * 100) / 100 });
  });
  it("Distanz: mindestens Bildschirm-px, gedeckelt", () => {
    expect(ampelRaender(25).sockel).toBeCloseTo(Math.round((E.sockelRandPx / 25) * 100) / 100);
    expect(ampelRaender(2)).toEqual({ sockel: E.sockelRandMaxM, huelle: E.huelleRandMaxM });
  });
  it("Rang hebt ueberlappende Sockel an", () => {
    const { scheiben } = ampelSockel([anlage({ schluessel: "x", rang: 3 }), anlage({ schluessel: "y", rang: 0 })], 0);
    expect(scheiben[0].position[1] - scheiben[1].position[1]).toBeCloseTo(3 * E.rangVersatzM);
  });
});
