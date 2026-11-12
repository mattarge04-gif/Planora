import { describe, it, expect } from "vitest";
import { einrichten, type SymbolEntwurf } from "../src/welt/raum/einrichtung.js";
import { KATALOG_V2 } from "../src/welt/katalog.v2.js";
import type { Rechteck } from "../src/welt/typen.js";

const WP = "heizung.waermepumpe", SP = "heizung.speicher", VT = "heizung.verteiler", PU = "heizung.umwaelzpumpe";
const HK = "heizung.heizkoerper", FBH = "heizung.fbh_kreis";
const tiefe = (k: string) => KATALOG_V2.eintraege.find((e) => e.id === k)!.masse![2];
const s = (schluessel: string, katalogId: string, extra: Partial<SymbolEntwurf> = {}): SymbolEntwurf => ({ schluessel, katalogId, ...extra });
const innen = (r: Rechteck, p: { x: number; z: number }) => p.x > r.x && p.x < r.x + r.breite && p.z > r.z && p.z < r.z + r.tiefe;

/** Raum in Reihe 1 eines Rechtecks: Gang an -z, Fassade an +z (z = 15). */
const RAUM: Rechteck = { x: 0, z: 9, breite: 9, tiefe: 6 };

describe("einrichten", () => {
  it("Zentrale: Fluss Erzeuger -> Speicher -> Verteiler zur Steigzone hin, Vorderkanten buendig an der Fassadenwand", () => {
    const p = einrichten(RAUM, "-z", "+z", [s("wp", WP), s("sp", SP), s("vt", VT)], KATALOG_V2, { x: 0.3, z: 9.3 });
    const [wp, sp, vt] = ["wp", "sp", "vt"].map((k) => p.get(k)!);
    expect(vt.x).toBeLessThan(sp.x); // Steigzone links: Verteiler links
    expect(sp.x).toBeLessThan(wp.x);
    const vorne = (k: string, z: number) => z - tiefe(k) / 2;
    expect(vorne(WP, wp.z)).toBeCloseTo(vorne(SP, sp.z), 9);
    expect(vorne(VT, vt.z)).toBeCloseTo(vorne(SP, sp.z), 9);
    expect(sp.z + tiefe(SP) / 2).toBeLessThan(15); // an der Rueckwand, im Raum
    expect(15 - (sp.z + tiefe(SP) / 2)).toBeLessThan(0.5);
    // gleiche Abstaende (0.5 m) zwischen den Geraeten
    const breite = (k: string) => KATALOG_V2.eintraege.find((e) => e.id === k)!.masse![0];
    expect(sp.x - breite(SP) / 2 - (vt.x + breite(VT) / 2)).toBeCloseTo(0.5, 9);
    expect(wp.x - breite(WP) / 2 - (sp.x + breite(SP) / 2)).toBeCloseTo(0.5, 9);
  });
  it("Steigzone rechts: Fluss laeuft nach rechts, Verteiler rechts", () => {
    const p = einrichten(RAUM, "-z", "+z", [s("wp", WP), s("sp", SP), s("vt", VT)], KATALOG_V2, { x: 8.7, z: 9.3 });
    expect(p.get("wp")!.x).toBeLessThan(p.get("sp")!.x);
    expect(p.get("sp")!.x).toBeLessThan(p.get("vt")!.x);
  });
  it("zweite Reihe, wenn die Wand nicht reicht", () => {
    const eng: Rechteck = { x: 0, z: 9, breite: 3, tiefe: 6 };
    const p = einrichten(eng, "-z", "+z", [s("wp", WP), s("sp", SP), s("vt", VT)], KATALOG_V2, null);
    const zs = new Set(["wp", "sp", "vt"].map((k) => Math.round((p.get(k)!.z - tiefe(k === "wp" ? WP : k === "sp" ? SP : VT) / 2) * 1000)));
    expect(zs.size).toBeGreaterThan(1);
    for (const k of ["wp", "sp", "vt"]) expect(innen(eng, p.get(k)!)).toBe(true);
  });
  it("Pumpe vor WP liegt direkt neben der WP, zwischen WP und Speicher (m4)", () => {
    const p = einrichten(RAUM, "-z", "+z", [s("wp", WP), s("sp", SP), s("pu", PU, { vor: "wp" }), s("vt", VT)], KATALOG_V2, { x: 8.7, z: 9.3 });
    expect(p.get("wp")!.x).toBeLessThan(p.get("pu")!.x);
    expect(p.get("pu")!.x).toBeLessThan(p.get("sp")!.x);
    const ohneSp = einrichten(RAUM, "-z", "+z", [s("wp", WP), s("pu", PU, { vor: "wp" }), s("vt", VT)], KATALOG_V2, { x: 8.7, z: 9.3 });
    expect(ohneSp.get("wp")!.x).toBeLessThan(ohneSp.get("pu")!.x);
    expect(ohneSp.get("pu")!.x).toBeLessThan(ohneSp.get("vt")!.x);
  });
  it("Gruppenzubehoer sitzt am Verteiler", () => {
    const p = einrichten(RAUM, "-z", "+z", [s("wp", WP), s("vt", VT), s("g1", PU, { bei: "vt" })], KATALOG_V2, null);
    expect(p.get("g1")).toEqual(p.get("vt"));
  });
  it("Heizkoerper an der Fassadenwand auf 1/4 und 3/4", () => {
    const p = einrichten(RAUM, "-z", "+z", [s("h1", HK), s("h2", HK)], KATALOG_V2, null);
    expect(p.get("h1")!.x).toBeCloseTo(2.25, 9);
    expect(p.get("h2")!.x).toBeCloseTo(6.75, 9);
    for (const k of ["h1", "h2"]) {
      expect(p.get(k)!.z).toBeGreaterThan(14.5);
      expect(p.get(k)!.z).toBeLessThan(15);
    }
  });
  it("Heizkoerper an Fassade -x bei Raum im Schenkel", () => {
    const r: Rechteck = { x: 0, z: 15, breite: 6, tiefe: 9 };
    const p = einrichten(r, "+x", "-x", [s("h1", HK)], KATALOG_V2, null);
    expect(p.get("h1")!.z).toBeCloseTo(19.5, 9);
    expect(p.get("h1")!.x).toBeLessThan(0.5);
  });
  it("Unterverteiler an der Gangwand, zur Steigzone hin", () => {
    const links = einrichten(RAUM, "-z", "+z", [s("vt", VT), s("f", FBH)], KATALOG_V2, { x: 0, z: 9 });
    const rechts = einrichten(RAUM, "-z", "+z", [s("vt", VT), s("f", FBH)], KATALOG_V2, { x: 9, z: 9 });
    expect(links.get("vt")!.z).toBeLessThan(9.5);
    expect(links.get("vt")!.x).toBeLessThan(2);
    expect(rechts.get("vt")!.x).toBeGreaterThan(7);
  });
  it("uebrige Symbole im Raster mit 0.6 m Wandabstand; alle Positionen im Raum", () => {
    const sym = [s("wp", WP), s("vt", VT), s("pu", PU), s("f1", FBH), s("f2", FBH, { vor: "fremd" }), s("h", HK), s("x", PU, { vor: "h" })];
    const p = einrichten(RAUM, "-z", "+z", sym, KATALOG_V2, null);
    expect(p.size).toBe(sym.length);
    for (const k of ["pu", "f1", "f2"]) {
      const q = p.get(k)!;
      expect(q.x).toBeGreaterThanOrEqual(0.6);
      expect(q.x).toBeLessThanOrEqual(8.4);
      expect(q.z).toBeGreaterThanOrEqual(9.6);
      expect(q.z).toBeLessThanOrEqual(14.4);
    }
    for (const q of p.values()) expect(innen(RAUM, q)).toBe(true);
    expect(Math.abs(p.get("x")!.x - p.get("h")!.x)).toBeGreaterThan(0.5); // vor HK: direkt daneben
    expect(p.get("x")!.z).toBeCloseTo(p.get("h")!.z, 9);
  });
  it("ist deterministisch", () => {
    const sym = [s("wp", WP), s("sp", SP), s("vt", VT), s("h", HK)];
    expect([...einrichten(RAUM, "-z", "+z", sym, KATALOG_V2, null)]).toEqual([...einrichten(RAUM, "-z", "+z", sym, KATALOG_V2, null)]);
  });
});
