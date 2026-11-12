import { describe, it, expect } from "vitest";
import { layoutGeschoss, verteileLaenge } from "../src/welt/raum/reihen.js";
import { formPfad, reihenSegmente } from "../src/welt/raum/form.js";
import { REGELWERK_V2 } from "../src/welt/regelwerk.v2.js";
import type { Grundform, Rechteck } from "../src/welt/typen.js";

const RAUM = REGELWERK_V2.raum;
const r = (...l: number[]) => l.map((laenge, i) => ({ id: String.fromCharCode(97 + i), laenge }));
const schnitt = (a: Rechteck, b: Rechteck) =>
  Math.max(0, Math.min(a.x + a.breite, b.x + b.breite) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.z + a.tiefe, b.z + b.tiefe) - Math.max(a.z, b.z));
const seiten = (x: Rechteck) => Math.max(x.breite, x.tiefe) / Math.min(x.breite, x.tiefe);
const inMeter = (s: Rechteck): Rechteck => ({ x: s.x * 3, z: s.z * 3, breite: s.breite * 3, tiefe: s.tiefe * 3 });

function pruefe(form: Grundform, laenge: number, raeume: { id: string; laenge: number }[]) {
  const f = formPfad(form, laenge, 5, RAUM);
  const l = layoutGeschoss(raeume, form, f, RAUM);
  const rechtecke = [...l.rechtecke.values()].map((x) => x.rechteck);
  for (let i = 0; i < rechtecke.length; i++) for (let j = i + 1; j < rechtecke.length; j++) expect(schnitt(rechtecke[i], rechtecke[j])).toBeLessThan(1e-6);
  // jeder Raum liegt ganz in einem Reihenabschnitt (der Gang liegt ausserhalb aller Abschnitte, siehe Form-Test)
  const segmente = reihenSegmente(form, f, RAUM).flat().map(inMeter);
  for (const x of rechtecke) expect(Math.max(...segmente.map((s) => schnitt(s, x)))).toBeCloseTo(x.breite * x.tiefe, 6);
  return l;
}

describe("verteileLaenge (Strecken mit Seitenverhaeltnis)", () => {
  it("gleichmaessig gestreckt, solange alle Raeume im Verhaeltnis bleiben", () => {
    expect(verteileLaenge([2, 2], 6, 2 / 1.6, 3.2)).toEqual({ laengen: [3, 3], ok: true });
  });
  it("Raum ueber der Grenze teilt die Laenge mit dem Nachbarn", () => {
    const v = verteileLaenge([4, 2], 6, 2 / 1.6, 3.2);
    expect(v.ok).toBe(true);
    expect(v.laengen[0]).toBeCloseTo(3.2, 9);
    expect(v.laengen[1]).toBeCloseTo(2.8, 9);
  });
  it("Raum unter der Grenze wird verlaengert", () => {
    const v = verteileLaenge([1, 5], 6, 1.25, 5);
    expect(v.ok).toBe(true);
    expect(v.laengen[0]).toBeCloseTo(1.25, 9);
    expect(v.laengen[1]).toBeCloseTo(4.75, 9);
  });
  it("unmoeglich: gleichmaessig gestreckt, ok = false", () => {
    expect(verteileLaenge([2], 4, 2 / 1.6, 3.2)).toEqual({ laengen: [4], ok: false });
  });
});

describe("layoutGeschoss", () => {
  it("Rechteck: zwei Reihen beidseits des Gangs, Reihen voll ausgefuellt", () => {
    const l = pruefe("quader", 5, r(3, 3, 2, 2));
    expect(l.hinweise).toEqual([]);
    const x = (id: string) => l.rechtecke.get(id)!;
    expect(x("a")).toEqual({ rechteck: { x: 0, z: 0, breite: 9, tiefe: 6 }, gang: "+z" });
    expect(x("c")).toEqual({ rechteck: { x: 9, z: 0, breite: 6, tiefe: 6 }, gang: "+z" });
    expect(x("b")).toEqual({ rechteck: { x: 0, z: 9, breite: 9, tiefe: 6 }, gang: "-z" });
    expect(x("d")).toEqual({ rechteck: { x: 9, z: 9, breite: 6, tiefe: 6 }, gang: "-z" });
  });
  it("Geschoss mit weniger Inhalt fuellt die volle Laenge (Gebaeudelaenge aus einem anderen Geschoss)", () => {
    const l = pruefe("quader", 6, r(2, 2, 2, 2));
    const reihe0 = [...l.rechtecke.values()].filter((x) => x.rechteck.z === 0).map((x) => x.rechteck);
    expect(reihe0.reduce((s, x) => s + x.breite, 0)).toBeCloseTo(18, 9);
    expect(Math.min(...reihe0.map((x) => x.x))).toBe(0);
    expect(l.hinweise).toEqual([]);
  });
  it("kein Raum ueber 1:1.6: der laengere Raum gibt Laenge an den Nachbarn ab", () => {
    const l = pruefe("quader", 6, r(4, 2, 2, 4));
    for (const { rechteck } of l.rechtecke.values()) expect(seiten(rechteck)).toBeLessThanOrEqual(1.6 + 1e-9);
    expect(l.rechtecke.get("a")!.rechteck.breite).toBeCloseTo(9.6, 9);
    expect(l.hinweise).toEqual([]);
  });
  it("nicht loesbar: Hinweis seitenverhaeltnis statt Fehler", () => {
    const l = pruefe("quader", 4, r(2));
    expect(l.rechtecke.get("a")!.rechteck).toEqual({ x: 0, z: 0, breite: 12, tiefe: 6 });
    expect(l.hinweise).toEqual([{ code: "seitenverhaeltnis", bezug: "a" }]);
  });
  it("L: Reihen laufen um die Ecke durch beide Fluegel", () => {
    const l = pruefe("l_form", 12, r(3, 3, 3, 3, 2, 2));
    const inSchenkel = [...l.rechtecke.values()].filter((x) => x.rechteck.z >= 15 - 1e-9);
    expect(inSchenkel.length).toBeGreaterThan(0);
    expect(inSchenkel.every((x) => x.gang === "+x" || x.gang === "-x")).toBe(true);
  });
  it("U: Raeume in allen drei Fluegeln, keine Ueberlappung", () => {
    const l = pruefe("u_form", 30, r(4, 4, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2));
    const xs = [...l.rechtecke.values()].map((x) => x.rechteck);
    expect(xs.some((x) => x.x < 6 && x.z >= 15)).toBe(true);
    expect(xs.some((x) => x.x > 20 && x.z >= 15)).toBe(true);
  });
  it("leere Reihen bleiben leer; keine Raeume -> leere Map", () => {
    expect(layoutGeschoss([], "quader", formPfad("quader", 4, 5, RAUM), RAUM).rechtecke.size).toBe(0);
  });
  it("ist deterministisch", () => {
    const a = pruefe("u_form", 20, r(3, 2, 4, 2, 2, 3));
    const b = pruefe("u_form", 20, r(3, 2, 4, 2, 2, 3));
    expect([...a.rechtecke]).toEqual([...b.rechtecke]);
  });
});
