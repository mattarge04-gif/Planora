import * as THREE from "three";
import { describe, expect, it } from "vitest";
import type { V3 } from "../szene2/huelle";
import { anAbzweigenTeilen, bogenMatrix, bogenSchluessel, formstuecke, FORMSTUECK, knoten, zylinderMatrix } from "./formstuecke";
import type { Rohrstueck } from "./netz";
import { ROHR, bogenLagen } from "./technik";

const rohr = (punkte: V3[], gruppeId?: string, radius = 0.045, art: "haupt" | "verteil" = "verteil"): Rohrstueck => ({
  punkte, radius, startRadius: radius, endRadius: radius, boden: 0, frei: false,
  daten: { art, von: "a", nach: "b", bauteilIds: [], gruppeId },
});
const nah = (a: V3, b: V3) => new THREE.Vector3(...a).distanceTo(new THREE.Vector3(...b)) < 1e-9;

describe("bogenLagen", () => {
  it("liefert die Bögen von rohrPfad mit Tangentenpunkten", () => {
    const [b, ...rest] = bogenLagen([[0, 0, 0], [2, 0, 0], [2, 0, 2]], 0.1);
    expect(rest).toEqual([]);
    expect(b.r).toBeCloseTo(0.1 * ROHR.bogenFaktor);
    expect(nah(b.a, [2 - b.r, 0, 0])).toBe(true);
    expect(nah(b.b, [2, 0, b.r])).toBe(true);
  });
  it("übergeht Zwischenpunkte auf einer Geraden und Doppelpunkte", () => {
    expect(bogenLagen([[0, 0, 0], [1, 0, 0], [1, 0, 0], [2, 0, 0]], 0.1)).toEqual([]);
  });
});

describe("knoten", () => {
  it("erkennt einen Abzweig auf dem Segment eines Rohres derselben Gruppe als T-Stück", () => {
    const k = knoten([rohr([[0, 3, 0], [4, 3, 0]], "g1"), rohr([[2, 3, 0], [2, 1, 0]], "g1")]);
    expect(k).toHaveLength(1);
    expect(nah(k[0].position, [2, 3, 0])).toBe(true);
    expect(k[0].arme).toHaveLength(3);
    expect(k[0].gruppeId).toBe("g1");
  });
  it("verbindet keine fremden Netze", () => {
    expect(knoten([rohr([[0, 3, 0], [4, 3, 0]], "g1"), rohr([[2, 3, 0], [2, 1, 0]], "g2")])).toEqual([]);
  });
  it("zeichnet am Stoss zweier Rohre einen Winkel, bei gerader Fortsetzung nichts", () => {
    const winkel = knoten([rohr([[0, 0, 0], [0, 2, 0]], "g"), rohr([[0, 2, 0], [1, 2, 0]], "g")]);
    expect(winkel).toHaveLength(1);
    expect(winkel[0].arme).toHaveLength(2);
    expect(knoten([rohr([[0, 0, 0], [0, 2, 0]], "g"), rohr([[0, 2, 0], [0, 3, 0]], "g")])).toEqual([]);
  });
  it("lässt freie Enden ohne Formstück", () => {
    expect(knoten([rohr([[0, 0, 0], [1, 0, 0], [1, 0, 1]], "g")])).toEqual([]);
  });
  it("fasst doppelte Anschlussstücke zusammen: geteilter Anschluss mit zwei Hauptläufen = T", () => {
    const adapter = rohr([[0, 0, 0], [0, 2, 0]], undefined, 0.07, "haupt");
    const k = knoten([adapter, { ...adapter }, rohr([[0, 2, 0], [3, 2, 0]], undefined, 0.07, "haupt"), rohr([[0, 2, 0], [-3, 2, 0]], undefined, 0.07, "haupt")]);
    expect(k).toHaveLength(1);
    expect(k[0].arme).toHaveLength(3);
    expect(k[0].radius).toBeCloseTo(0.07);
  });
});

describe("formstuecke", () => {
  it("gibt jedem rechtwinkligen Bogen zwei Muffen mit Pressring", () => {
    const f = formstuecke([rohr([[0, 0, 0], [2, 0, 0], [2, 0, 2]], "g")]);
    expect(f.boegen).toHaveLength(1);
    expect(f.muffen).toHaveLength(2);
    expect(f.ringe).toHaveLength(2);
    expect(f.muffen[0].radius).toBeCloseTo(0.045 * FORMSTUECK.koerper);
    expect(f.ringe[0].radius).toBeGreaterThan(f.muffen[0].radius);
    // Muffe liegt auf dem geraden Schenkel vor dem Bogen.
    expect(f.muffen[0].position[0]).toBeLessThan(2 - f.boegen[0].r);
  });
  it("zeichnet einen engen Bogen als Winkel", () => {
    const f = formstuecke([rohr([[0, 0, 0], [0.08, 0, 0], [0.08, 0, 1]], "g")]);
    expect(f.boegen).toEqual([]);
    expect(f.knoten).toHaveLength(1);
    expect(f.muffen).toHaveLength(2);
  });
  it("gibt dem T-Stück je Richtung eine Muffe", () => {
    const f = formstuecke([rohr([[0, 3, 0], [4, 3, 0]], "g1"), rohr([[2, 3, 0], [2, 1, 0]], "g1")]);
    expect(f.knoten).toHaveLength(1);
    expect(f.muffen).toHaveLength(3);
  });
});

describe("Instanzmatrizen", () => {
  it("bildet die Einheitsbogen-Enden auf die Tangentenpunkte ab", () => {
    const [b] = formstuecke([rohr([[0, 0, 0], [2, 0, 0], [2, 0, 2]], "g")]).boegen;
    const m = bogenMatrix(b);
    expect(new THREE.Vector3(-1, 0, 0).applyMatrix4(m).distanceTo(new THREE.Vector3(2 - b.r, 0, 0))).toBeLessThan(1e-9);
    expect(new THREE.Vector3(0, 1, 0).applyMatrix4(m).distanceTo(new THREE.Vector3(2, 0, b.r))).toBeLessThan(1e-9);
    expect(bogenSchluessel(b)).toBeCloseTo(1 / ROHR.bogenFaktor, 1);
  });
  it("richtet den Einheitszylinder entlang der Muffenachse aus", () => {
    const m = zylinderMatrix({ position: [1, 2, 3], richtung: [0, 0, -1], radius: 0.05, laenge: 0.2 });
    const spitze = new THREE.Vector3(0, 0.5, 0).applyMatrix4(m);
    expect(spitze.distanceTo(new THREE.Vector3(1, 2, 2.9))).toBeLessThan(1e-9);
  });
});

describe("anAbzweigenTeilen (Abzweig an einer Ecke des Strangs, PO 15.11.)", () => {
  // Strang biegt bei (4,3,0) ab; dort beginnt ein Abzweig derselben Gruppe.
  const strang = { ...rohr([[0, 3, 0], [4, 3, 0], [4, 3, 3]], "g"), startRadius: 0.02, endRadius: 0.03, frei: true };
  const abzweig = rohr([[4, 3, 0], [8, 3, 0]], "g");
  const teile = anAbzweigenTeilen([strang, abzweig]);

  it("teilt den Strang an der Ecke, Punkte und Radien an den Enden bleiben", () => {
    expect(teile.map((t) => t.stueck.punkte)).toEqual([[[0, 3, 0], [4, 3, 0]], [[4, 3, 0], [4, 3, 3]], [[4, 3, 0], [8, 3, 0]]]);
    expect(teile.map((t) => [t.index, t.erstes])).toEqual([[0, true], [0, false], [1, true]]);
    expect([teile[0].stueck.startRadius, teile[0].stueck.endRadius, teile[1].stueck.startRadius, teile[1].stueck.endRadius]).toEqual([0.02, 0.045, 0.045, 0.03]);
    expect([teile[0].stueck.frei, teile[1].stueck.frei]).toEqual([false, true]);
  });
  it("ergibt an der Ecke ein T-Stück statt Bogen", () => {
    const f = formstuecke(teile.map((t) => t.stueck));
    expect(f.boegen).toEqual([]);
    expect(f.knoten).toHaveLength(1);
    expect(f.knoten[0].arme).toHaveLength(3);
  });
  it("teilt nicht bei fremdem Netz und nicht ohne Abzweig", () => {
    expect(anAbzweigenTeilen([strang, rohr([[4, 3, 0], [8, 3, 0]], "x")])).toHaveLength(2);
    expect(anAbzweigenTeilen([strang])).toHaveLength(1);
  });
});
