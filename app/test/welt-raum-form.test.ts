import { describe, it, expect } from "vitest";
import { formPfad, grundrissAusFluegeln, reihenSegmente, segmentLaenge, type Segment } from "../src/welt/raum/form.js";
import { REGELWERK_V2 } from "../src/welt/regelwerk.v2.js";
import type { Grundform, Rechteck } from "../src/welt/typen.js";

const RAUM = REGELWERK_V2.raum;
const flaeche = (r: { breite: number; tiefe: number }) => r.breite * r.tiefe;
const schnitt = (a: Rechteck, b: Rechteck) =>
  Math.max(0, Math.min(a.x + a.breite, b.x + b.breite) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.z + a.tiefe, b.z + b.tiefe) - Math.max(a.z, b.z));
const kapazitaet = (r: Segment[]) => r.reduce((s, x) => s + segmentLaenge(x), 0);

/** Gang (1 Modul) neben jeder Reihe: Segmentflaechen + Gangflaeche = Grundflaeche, keine Ueberlappung, alles in der Huelle. */
function pruefeAbdeckung(form: Grundform, laenge: number) {
  const f = formPfad(form, laenge, 5, RAUM);
  const g = grundrissAusFluegeln(f, RAUM).map((r) => ({ x: r.x / 3, z: r.z / 3, breite: r.breite / 3, tiefe: r.tiefe / 3 }));
  const reihen = reihenSegmente(form, f, RAUM);
  const segmente = reihen.flat();
  for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) expect(schnitt(g[i], g[j])).toBe(0);
  for (let i = 0; i < segmente.length; i++) for (let j = i + 1; j < segmente.length; j++) expect(schnitt(segmente[i], segmente[j])).toBe(0);
  for (const s of segmente) expect(g.reduce((a, r) => a + schnitt(s, r), 0)).toBeCloseTo(flaeche(s), 9);
  return { f, g, reihen, segmente };
}

describe("formPfad und grundrissAusFluegeln", () => {
  it("Rechteck 8 Module, Raumtiefe 2 -> ein Rechteck 24 x 15 m", () => {
    const f = formPfad("quader", 8, 5, RAUM);
    expect(f).toEqual([{ x0: 0, z0: 0, laenge: 8, tiefe: 5, richtung: "x" }]);
    expect(grundrissAusFluegeln(f, RAUM)).toEqual([{ x: 0, z: 0, breite: 24, tiefe: 15 }]);
  });
  it("Mindestgebaeude 4 x 5 Module", () => {
    expect(grundrissAusFluegeln(formPfad("quader", 2, 3, RAUM), RAUM)).toEqual([{ x: 0, z: 0, breite: 12, tiefe: 15 }]);
  });
  it("Quadrat: Laenge = max(Laenge, Tiefe), Seiten gleich, Reihentiefe ganzzahlig", () => {
    expect(formPfad("quadrat", 3, 5, RAUM)).toEqual([{ x0: 0, z0: 0, laenge: 5, tiefe: 5, richtung: "x" }]);
    expect(formPfad("quadrat", 8, 5, RAUM)).toEqual([{ x0: 0, z0: 0, laenge: 9, tiefe: 9, richtung: "x" }]);
    const [r0, r1] = reihenSegmente("quadrat", formPfad("quadrat", 8, 5, RAUM), RAUM);
    expect(r0).toEqual([{ x: 0, z: 0, breite: 9, tiefe: 4, richtung: "x", umgekehrt: false, gang: "+z" }]);
    expect(r1).toEqual([{ x: 0, z: 5, breite: 9, tiefe: 4, richtung: "x", umgekehrt: false, gang: "-z" }]);
  });
  it("L verteilt die Reihenlaenge auf zwei Fluegel mit gemeinsamer Ecke", () => {
    const f = formPfad("l_form", 12, 5, RAUM);
    expect(f).toEqual([{ x0: 0, z0: 0, laenge: 7, tiefe: 5, richtung: "x" }, { x0: 0, z0: 0, laenge: 7, tiefe: 5, richtung: "z" }]);
    expect(grundrissAusFluegeln(f, RAUM)).toEqual([{ x: 0, z: 0, breite: 21, tiefe: 15 }, { x: 0, z: 15, breite: 15, tiefe: 6 }]);
    const { reihen } = pruefeAbdeckung("l_form", 12);
    expect(kapazitaet(reihen[0])).toBe(12); // aeussere Reihe = verlangte Laenge
    expect(kapazitaet(reihen[1])).toBe(12 - 6); // innere Reihe um Tiefe + Gang kuerzer
    expect(reihen.map((r) => r.length)).toEqual([2, 2]);
  });
  it("U verteilt die Reihenlaenge auf drei Fluegel", () => {
    const f = formPfad("u_form", 30, 5, RAUM);
    expect(f.map((x) => x.richtung)).toEqual(["z", "x", "z"]);
    expect(f.map((x) => x.laenge)).toEqual([11, 12, 11]);
    const { g, reihen } = pruefeAbdeckung("u_form", 30);
    expect(g).toHaveLength(3);
    expect(kapazitaet(reihen[0])).toBe(30);
    expect(kapazitaet(reihen[1])).toBe(30 - 12);
    expect(reihen.map((r) => r.length)).toEqual([3, 3]);
  });
  it("L/U halten Mindestschenkel ein", () => {
    const l = formPfad("l_form", 1, 5, RAUM);
    expect(l.map((x) => x.laenge)).toEqual([7, 7]);
    const u = formPfad("u_form", 1, 5, RAUM);
    expect(u.map((x) => x.laenge)).toEqual([7, 12, 7]);
    pruefeAbdeckung("l_form", 1);
    pruefeAbdeckung("u_form", 1);
  });
  it.each(["quader", "quadrat", "l_form", "u_form"] as const)("%s: Reihen + Gang decken die Huelle ab", (form) => {
    for (const laenge of [4, 9, 17, 26]) {
      const { g, segmente, reihen, f } = pruefeAbdeckung(form, laenge);
      const tiefe = f[0].tiefe;
      const t = (tiefe - RAUM.gangModule) / 2;
      // Gangflaeche: je Reihe ein Band von 1 Modul entlang der Reihe; Rest = Segmente
      const huelle = g.reduce((s, r) => s + flaeche(r), 0);
      const seg = segmente.reduce((s, r) => s + flaeche(r), 0);
      expect(seg / t).toBeCloseTo(kapazitaet(reihen[0]) + kapazitaet(reihen[1]), 9);
      expect(huelle - seg).toBeGreaterThan(0);
      for (const s of segmente) expect(Math.min(s.breite, s.tiefe)).toBe(t);
    }
  });
});
