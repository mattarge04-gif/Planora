import { describe, expect, it } from "vitest";
import type { Welt } from "../../typen";
import { suchen, type Zelle } from "./astern";
import { Belegung, zelleVon } from "./raster";

const welt: Welt = { regelwerkVersion: 2, hash: "a", grundriss: [{ x: 0, z: 0, breite: 6, tiefe: 4 }], hinweise: [], symbole: [], einheiten: [],
  geschosse: [{ id: "eg", code: "EG", yUnten: 0, hoehe: 3.2 }] };
const zelle = (b: Belegung, x: number, z: number, y = 2.8): Zelle => { const [i, k] = zelleVon(b.gitter, x, z); return { y, i, k }; };
const ziel = (z: Zelle) => (c: Zelle) => c.y === z.y && c.i === z.i && c.k === z.k;
const boegen = (w: Zelle[]) => { let n = 0; for (let j = 2; j < w.length; j++) { const d1 = [w[j - 1].i - w[j - 2].i, w[j - 1].k - w[j - 2].k], d2 = [w[j].i - w[j - 1].i, w[j].k - w[j - 1].k]; if (d1[0] !== d2[0] || d1[1] !== d2[1]) n++; } return n; };

describe("suchen", () => {
  it("freier Raum: Weg mit hoechstens einem Bogen", () => {
    const b = new Belegung(welt), s = zelle(b, 1, 1), z = zelle(b, 5, 3);
    const w = suchen(b, s, z, ziel(z), "n", [2.8, 2.55])!;
    expect(w[0]).toEqual(s); expect(w.at(-1)).toEqual(z);
    expect(boegen(w)).toBeLessThanOrEqual(1);
  });
  it("weicht fremdem Rohr ueber die Ausweichebene oder seitlich aus, nie hindurch", () => {
    const b = new Belegung(welt);
    b.belegen([[3, 2.8, 0.2], [3, 2.8, 3.8]], "fremd");
    const s = zelle(b, 1, 2), z = zelle(b, 5, 2);
    const w = suchen(b, s, z, ziel(z), "n", [2.8, 2.55])!;
    expect(w).not.toBeNull();
    for (const c of w) expect(b.frei(c.y, c.i, c.k, "n") || (c.i === s.i && c.k === s.k) || (c.i === z.i && c.k === z.k)).toBe(true);
  });
  it("bevorzugt die eigene Spur", () => {
    const b = new Belegung(welt), s = zelle(b, 1, 1), z = zelle(b, 5, 3.5);
    const w = suchen(b, s, z, ziel(z), "n", [2.8, 2.55], { achse: 0, wert: 2.5 })!;
    expect(w.some((c) => Math.abs(b.gitter.z0 + (c.k + 0.5) * 0.09 - 2.5) < 0.05)).toBe(true);
  });
  it("Mehrfachziel: endet auf eigenem Netz", () => {
    const b = new Belegung(welt);
    b.belegen([[0.5, 2.8, 3], [5.5, 2.8, 3]], "n");
    const s = zelle(b, 2, 0.5);
    const w = suchen(b, s, null, (c) => b.eigen(c.y, c.i, c.k, "n"), "n", [2.8, 2.55])!;
    expect(b.eigen(w.at(-1)!.y, w.at(-1)!.i, w.at(-1)!.k, "n")).toBe(true);
  });
  it("gerade Strecke bleibt trotz entfernter Vorzugsspur gerade", () => {
    const b = new Belegung(welt), s = zelle(b, 1, 1), z = zelle(b, 5, 1);
    const w = suchen(b, s, z, ziel(z), "n", [2.8, 2.55], { achse: 0, wert: 2.5 })!;
    expect(w[0]).toEqual(s); expect(w.at(-1)).toEqual(z);
    expect(boegen(w)).toBe(0);
  });
  it("Start gleich Ziel ergibt genau die Startzelle", () => {
    const b = new Belegung(welt), s = zelle(b, 1, 1);
    expect(suchen(b, s, s, ziel(s), "n", [2.8, 2.55])).toEqual([s]);
    expect(suchen(b, s, null, ziel(s), "n", [2.8, 2.55])).toEqual([s]);
  });
  it("ungueltige Rasterkoordinaten ergeben keinen Weg", () => {
    const b = new Belegung(welt), s = zelle(b, 1, 1), z = zelle(b, 5, 3);
    for (const ungueltig of [{ ...s, i: b.gitter.nx }, { ...s, k: -1 }, { ...s, i: 1.5 }]) {
      expect(suchen(b, ungueltig, z, ziel(z), "n", [2.8, 2.55])).toBeNull();
      expect(suchen(b, s, ungueltig, ziel(ungueltig), "n", [2.8, 2.55])).toBeNull();
    }
  });
  it("ohne passende Startebene gibt es keinen Weg", () => {
    const b = new Belegung(welt), s = zelle(b, 1, 1), z = zelle(b, 5, 3);
    expect(suchen(b, s, z, ziel(z), "n", [])).toBeNull();
    expect(suchen(b, s, z, ziel(z), "n", [2.55])).toBeNull();
  });
  it("verwendet ausschliesslich uebergebene Hoehen und kehrt auf die Startebene zurueck", () => {
    const b = new Belegung(welt), s = zelle(b, 1, 2), z = zelle(b, 5, 2);
    for (const y of [2.8]) b.belegen([[3, y, 0.05], [3, y, 3.95]], "fremd");
    const w = suchen(b, s, z, ziel(z), "n", [2.8, 2.55])!;
    expect(w[0]).toEqual(s); expect(w.at(-1)).toEqual(z);
    expect(w.some((c) => c.y === 2.55)).toBe(true);
    for (const c of w) {
      expect([2.8, 2.55]).toContain(c.y);
      expect(b.frei(c.y, c.i, c.k, "n")).toBe(true);
    }
    for (let j = 1; j < w.length; j++) {
      const a = w[j - 1], c = w[j];
      if (a.y === c.y) expect(Math.abs(a.i - c.i) + Math.abs(a.k - c.k)).toBe(1);
      else {
        expect([c.i, c.k]).toEqual([a.i, a.k]);
        expect([c.i, c.k]).not.toEqual([s.i, s.k]);
        expect([c.i, c.k]).not.toEqual([z.i, z.k]);
      }
    }
    expect(suchen(b, s, z, ziel(z), "n", [2.8, 2.55])).toEqual(w);
  });
  it("vollstaendig blockiert: null", () => {
    const b = new Belegung(welt);
    for (const y of [2.8, 2.55]) b.belegen([[3, y, 0.1], [3, y, 3.9]], "wand");
    b.belegen([[3, 0, 0.1], [3, 2.8, 0.1]], "wand");
    const s = zelle(b, 1, 2), z = zelle(b, 5, 2);
    expect(suchen(b, s, z, ziel(z), "n", [2.8, 2.55])).toBeNull();
  });
});
