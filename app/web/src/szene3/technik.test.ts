import { describe, expect, it } from "vitest";
import * as THREE from "three";
import type { V3 } from "../szene2/huelle";
import type { Welt, WeltSymbol } from "../typen";
import { anlagenDaten, anlageSichtbar, anschlussFuehrung, modellFuer, ROHR, rohrAbschluesse, rohrAchse, rohrPfad, rohrSchnitt } from "./technik";
import { rohrGeometrie } from "./technikGeometrie";

const symbol = (y: number): WeltSymbol => ({
  schluessel: `anlage-${y}`, katalogId: "heizung.waermepumpe", bauteilIds: ["bauteil-a", "bauteil-b"],
  position: { x: 2, y, z: 3 }, versorgt: [], hersteller: null, typ: null, status: "bestaetigt", mengeSumme: 2, mengeUnbekannt: false,
});
const welt: Welt = {
  regelwerkVersion: 1, hash: "technik", grundriss: [], einheiten: [], symbole: [], hinweise: [],
  geschosse: [
    { id: "og1", code: "OG1", yUnten: 3, hoehe: 3.5 },
    { id: "ug", code: "UG", yUnten: -3, hoehe: 3 },
    { id: "eg", code: "EG", yUnten: 0, hoehe: 3 },
  ],
};

describe("Katalog und Modellvertrag", () => {
  it.each([
    "waermepumpe", "gaskessel", "oelkessel", "fernwaerme_uebergabe", "speicher", "umwaelzpumpe", "verteiler", "heizkoerper", "fbh_kreis",
  ])("lädt heizung.%s ausschliesslich lokal und mit Massstab 1", (id) => {
    const m = modellFuer(`heizung.${id}`);
    expect(m.pfad).toBe(`/modelle/heizung.${id}.glb`);
    expect(m.masse.every((x) => x > 0)).toBe(true);
  });
  it("teilt das FBH-Modell mit TABS", () => {
    expect(modellFuer("heizung.tabs_feld")).toEqual(modellFuer("heizung.fbh_kreis"));
  });
  it("verwendet für unbekannte und geerbte Namen den neutralen Ersatz", () => {
    for (const id of ["unbekannt", "constructor", "__proto__", "../../fremd"]) {
      expect(modellFuer(id)).toEqual({ pfad: null, masse: [0.6, 0.6, 0.6] });
    }
  });
  it("erhält echte Schlüssel und sämtliche Bauteil-IDs für die Instanzauswahl", () => {
    expect(anlagenDaten(symbol(0))).toEqual({ schluessel: "anlage-0", katalogId: "heizung.waermepumpe", bauteilIds: ["bauteil-a", "bauteil-b"] });
  });
});

describe("Anlagen im Geschossschnitt", () => {
  it("erhält im EG das UG und entfernt das OG1", () => {
    expect([-3, 0, 3].map((y) => anlageSichtbar(welt, "eg", symbol(y)))).toEqual([true, true, false]);
  });
  it("erhält im OG1 alle unteren Geschosse und im UG nur das UG", () => {
    expect([-3, 0, 3].map((y) => anlageSichtbar(welt, "og1", symbol(y)))).toEqual([true, true, true]);
    expect([-3, 0, 3].map((y) => anlageSichtbar(welt, "ug", symbol(y)))).toEqual([true, false, false]);
  });
  it("lässt Übersicht und ungültigen Fokus von der geschlossenen Hülle verdecken", () => {
    for (const fokus of [null, "fehlt"]) expect([-3, 0, 3].every((y) => anlageSichtbar(welt, fokus, symbol(y)))).toBe(true);
    expect(anlageSichtbar({ ...welt, geschosse: [] }, null, symbol(0))).toBe(false);
  });
  it("schneidet steigende und fallende Rohre exakt an der oberen Grenze", () => {
    const p: V3[] = [[0, 0.1, 0], [0, 3.1, 0], [4, 3.1, 0], [4, 0.1, 0]];
    expect(rohrSchnitt(p, 2.7)).toEqual([[[0, 0.1, 0], [0, 2.7, 0]], [[4, 2.7, 0], [4, 0.1, 0]]]);
    expect(rohrSchnitt(p, Infinity)).toEqual([p]);
    expect(rohrSchnitt(p, -1)).toEqual([]);
  });
});

describe("Rohrpfad mit runden Bögen", () => {
  it("verbindet waagrechte Geraden tangential über einen Viertelkreis mit Radius 2.5 × Rohr", () => {
    const p = rohrPfad([[0, 0, 0], [2, 0, 0], [2, 0, 2]], 0.1);
    expect(p.curves).toHaveLength(3);
    expect(p.curves[1]).toBeInstanceOf(THREE.CubicBezierCurve3);
    expect(p.curves[0].getPoint(1).toArray()).toEqual([1.75, 0, 0]);
    expect(p.curves[2].getPoint(0).toArray()).toEqual([2, 0, 0.25]);
    for (let i = 1; i < p.curves.length; i++) {
      expect(p.curves[i - 1].getPoint(1).distanceTo(p.curves[i].getPoint(0))).toBeLessThan(1e-9);
      expect(p.curves[i - 1].getTangent(1).dot(p.curves[i].getTangent(0))).toBeCloseTo(1, 4);
    }
    const mitte = p.curves[1].getPoint(0.5);
    expect(mitte.distanceTo(new THREE.Vector3(1.75, 0, 0.25))).toBeCloseTo(0.25, 5);
  });
  it("rundet auch vertikale Übergänge und begrenzt Radien bei kurzen Zwischenstücken", () => {
    const p = rohrPfad([[0, 0, 0], [2, 0, 0], [2, 0.1, 0], [3, 0.1, 0]], 0.1);
    expect(p.curves.filter((x) => x instanceof THREE.CubicBezierCurve3)).toHaveLength(2);
    expect(p.getPoints(50).every((v) => v.y >= 0 && v.y <= 0.1 && v.x >= 0 && v.x <= 3)).toBe(true);
  });
  it("entfernt doppelte und kollineare Punkte ohne die Endpunkte zu ändern", () => {
    const p = rohrPfad([[0, 0, 0], [0, 0, 0], [1, 0, 0], [2, 0, 0]], 0.1);
    expect(p.curves).toHaveLength(1);
    expect(p.getPoint(0).toArray()).toEqual([0, 0, 0]);
    expect(p.getPoint(1).toArray()).toEqual([2, 0, 0]);
    expect(rohrPfad([], 0.1).curves).toEqual([]);
    expect(rohrPfad([[1, 1, 1]], 0.1).curves).toEqual([]);
  });
  it("behält kleine Bögen an langen Geraden in der Rohrgeometrie bei", () => {
    const p = rohrPfad([[0, 0, 0], [100, 0, 0], [100, 0, 100]], 0.035);
    const a = p.getPointAt(1 / 3), b = p.getPointAt(2 / 3);
    expect(a.toArray()).toEqual([100 - 0.035 * 2.5, 0, 0]);
    expect(b.toArray()).toEqual([100, 0, 0.035 * 2.5]);
    const geo = new THREE.TubeGeometry(p, p.curves.length * 12, 0.035, 8, false);
    expect(Array.from(geo.getAttribute("position").array).every(Number.isFinite)).toBe(true);
    geo.dispose();
  });
});

describe("Schematische Rohrmasse und Abschlüsse", () => {
  it("verwendet die freigegebenen Radien und hebt die Achse mit dem Radius an", () => {
    expect(ROHR.haupt).toBe(0.07); expect(ROHR.verteil).toBe(0.045); expect(ROHR.bogenFaktor).toBe(2.5);
    for (const r of [ROHR.haupt, ROHR.verteil]) {
      expect(rohrAchse(3.2, r) - r - 3.2).toBeCloseTo(ROHR.bodenAbstand);
      expect(rohrAchse(0, r) - r).toBeGreaterThan(0.025);
    }
  });
  it("richtet Manschetten an beiden Enden auch bei doppelten Punkten nach aussen aus", () => {
    expect(rohrAbschluesse([[0, 0, 0], [0, 0, 0], [0, 2, 0]])).toEqual([
      { position: [0, 0, 0], richtung: [0, -1, 0] }, { position: [0, 2, 0], richtung: [0, 1, 0] },
    ]);
    expect(rohrAbschluesse([])).toEqual([]);
    expect(rohrAbschluesse([[1, 1, 1], [1, 1, 1]])).toEqual([]);
  });
  it("schliesst eine am Geschossschnitt gekappte Steigleitung senkrecht ab", () => {
    const [p] = rohrSchnitt([[0, 0.1, 0], [0, 4, 0]], 2.8);
    expect(rohrAbschluesse(p)[1]).toEqual({ position: [0, 2.8, 0], richtung: [0, 1, 0] });
  });
});

describe("Anschlussführung entsprechend GLB-Vertrag", () => {
  it.each<[string, V3, V3]>([
    ["waermepumpe", [-0.25, 1.2, -0.08], [0, 1, 0]],
    ["gaskessel", [-0.13, 1.57, 0.12], [0, 1, 0]],
    ["oelkessel", [-0.16, 1.37, -0.05], [0, 1, 0]],
    ["fernwaerme_uebergabe", [0, 0.08, -0.03], [0, -1, 0]],
    ["speicher", [0, 1.48, 0.49], [0, 0, 1]],
    ["umwaelzpumpe", [0.175, 0.12, 0], [1, 0, 0]],
    ["verteiler", [-0.6, 0.62, 0.02], [-1, 0, 0]],
    ["heizkoerper", [0.44, 0.05, 0], [0, -1, 0]],
    ["fbh_kreis", [-0.262, 0.06, -0.02], [0, -1, 0]],
  ])("trifft bei %s das Empty und verlässt es in der richtigen Richtung", (id, lokal, richtung) => {
    const s = { ...symbol(3.2), katalogId: `heizung.${id}` };
    const boden = rohrAchse(s.position.y, ROHR.haupt);
    const f = anschlussFuehrung([[2, boden, 3], [8, boden, 3], [8, boden, 10]], { symbol: s, lokal }, ROHR.haupt);
    expect(f.adapter[0]).toEqual([s.position.x + lokal[0], s.position.y + lokal[1], s.position.z + lokal[2]]);
    expect(new THREE.Vector3(...f.adapter[1]).sub(new THREE.Vector3(...f.adapter[0])).normalize().toArray()).toEqual(richtung);
    expect(f.adapter.at(-1)).toEqual(f.rohr[0]);
    expect(f.rohr.at(-1)).toEqual([8, boden, 10]);
    for (const p of [f.adapter, f.rohr]) {
      expect(p.slice(1).every((v, i) => v.filter((x, j) => Math.abs(x - p[i][j]) > 1e-9).length <= 1)).toBe(true);
    }
    const geo = rohrGeometrie({ punkte: f.adapter, radius: f.adapterRadius, startRadius: 0.018, endRadius: ROHR.haupt, boden: s.position.y })!;
    const position = geo.getAttribute("position");
    expect(Array.from({ length: position.count }, (_, i) => position.getY(i)).every((y) => y >= s.position.y + 0.025 - 1e-6)).toBe(true);
    geo.dispose();
    const m = modellFuer(s.katalogId).masse;
    expect(rohrPfad(f.rohr, ROHR.haupt).getPoints(100).every((p) =>
      Math.abs(p.x - s.position.x) >= m[0] / 2 + ROHR.haupt || Math.abs(p.z - s.position.z) >= m[2] / 2 + ROHR.haupt)).toBe(true);
  });
});
