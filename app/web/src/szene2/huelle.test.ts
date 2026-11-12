import { describe, it, expect } from "vitest";
import { fensterMitten, huelle, waendeVon, wandQuader } from "./huelle";
import type { Welt } from "../typen";

const WELT: Welt = {
  regelwerkVersion: 1, hash: "x",
  grundriss: [{ x: 0, z: 0, breite: 30, tiefe: 15 }],
  geschosse: [{ id: "g0", code: "EG", yUnten: 0, hoehe: 3 }, { id: "g1", code: "OG1", yUnten: 3, hoehe: 3.5 }],
  einheiten: [
    { id: "e1", geschossId: "g0", bezeichnung: "Technik", art: "technik", rechteck: { x: 0, z: 0, breite: 10, tiefe: 15 }, quelle: "schematisch" },
    { id: "e2", geschossId: "g0", bezeichnung: "Restaurant", art: "gastro", rechteck: { x: 10, z: 0, breite: 20, tiefe: 15 }, quelle: "schematisch" },
    { id: "e3", geschossId: "g1", bezeichnung: "Buero", art: "buero", rechteck: { x: 0, z: 0, breite: 30, tiefe: 15 }, quelle: "schematisch" },
  ],
  symbole: [], hinweise: [],
};
const LEER: Welt = { ...WELT, grundriss: [], geschosse: [], einheiten: [] };

describe("fensterMitten", () => {
  it("verteilt Fenster im Raster 1.5 m mit Rand", () => {
    const m = fensterMitten(30);
    expect(m).toHaveLength(19);
    expect(m[0]).toBeCloseTo(1.5);
    expect(m[18]).toBeCloseTo(28.5);
    expect(fensterMitten(15)).toHaveLength(9);
  });
  it("keine Fenster unter 2 m", () => {
    expect(fensterMitten(1.9)).toEqual([]);
  });
});

describe("waendeVon", () => {
  it("vier Waende mit Aussennormalen", () => {
    const w = waendeVon({ x: 0, z: 0, breite: 30, tiefe: 15 });
    expect(w.map((x) => x.normale)).toEqual([[0, -1], [1, 0], [0, 1], [-1, 0]]);
    expect(w.map((x) => x.laenge)).toEqual([30, 15, 30, 15]);
  });
});

describe("wandQuader", () => {
  it("liegt innen an der Aussenlinie", () => {
    const [sued, ost] = waendeVon({ x: 0, z: 0, breite: 30, tiefe: 15 });
    expect(wandQuader(sued, 3, 0.9)).toEqual({ mitte: [15, 3.45, 0.15], groesse: [30, 0.9, 0.3] });
    expect(wandQuader(ost, 0, 3)).toEqual({ mitte: [29.85, 1.5, 7.5], groesse: [0.3, 3, 15] });
  });
});

describe("huelle", () => {
  const h = huelle(WELT);
  it("keine Fenster vor Technik", () => {
    expect(h.geschosse[0].fenster).toHaveLength(35); // 13 Sued + 0 West + 13 Nord + 9 Ost
    expect(h.geschosse[1].fenster).toHaveLength(56);
    expect(h.geschosse[0].fenster.some((f) => f.mitte[0] < 10)).toBe(false);
  });
  it("Fenster zwischen Bruestung und Sturz, nach aussen gedreht", () => {
    const f = h.geschosse[1].fenster[0];
    expect(f.hoehe).toBeCloseTo(3.5 - 0.9 - 0.5);
    expect(f.mitte[1]).toBeCloseTo(3 + 0.9 + (3.5 - 1.4) / 2);
    expect(f.mitte[2]).toBeLessThan(0); // Suedfassade, leicht vor der Wand
    expect(f.drehungY).toBeCloseTo(Math.PI);
  });
  it("Deckenband nur ab dem zweiten Geschoss", () => {
    expect(h.geschosse[0].band).toHaveLength(0);
    expect(h.geschosse[1].band).toHaveLength(1);
  });
  it("Attika, Dachaufbau ueber Technik, Grundplatte", () => {
    expect(h.attika).toHaveLength(4);
    expect(h.aufbau).toEqual({ mitte: [5, 6.5 + 0.75, 7.5], groesse: [4, 1.5, 4] });
    expect(h.platte).toEqual({ mitte: [15, -0.15, 7.5], groesse: [38, 0.3, 23] });
    expect(h.bereich).toEqual({ xMin: 0, xMax: 30, zMin: 0, zMax: 15, yMin: 0, yMax: 6.5 });
  });
  it("leere Welt: nur Grundplatte", () => {
    const l = huelle(LEER);
    expect(l.waende).toEqual([]);
    expect(l.geschosse).toEqual([]);
    expect(l.attika).toEqual([]);
    expect(l.aufbau).toBeNull();
    expect(l.platte.groesse).toEqual([18, 0.3, 18]);
  });
});
