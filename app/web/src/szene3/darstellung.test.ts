import { describe, expect, it } from "vitest";
import * as THREE from "three";
import type { Welt } from "../typen";
import { bewegungsAnteil, gebaeudeBereich, rohrGeschosse, separationsOffsets, sichtbareGeschosse } from "./darstellung";
import { FIT_ANTEIL, einpassen, punktImFreiraum, bildpunkt } from "./kamera";

const welt: Welt = {
  regelwerkVersion: 1, hash: "darstellung", grundriss: [{ x: 0, z: 0, breite: 30, tiefe: 15 }], einheiten: [], symbole: [], hinweise: [],
  geschosse: [
    { id: "og", code: "OG1", yUnten: 3.2, hoehe: 3.6 },
    { id: "ug", code: "UG", yUnten: -3, hoehe: 3 },
    { id: "eg", code: "EG", yUnten: 0, hoehe: 3.2 },
  ],
};
const bereich = { xMin: 0, xMax: 30, zMin: 0, zMax: 15, yMin: -3, yMax: 6.8 };

describe("Separieren und Sichtbarkeit", () => {
  it("beendet Bewegungen zur Token-Dauer exakt und springt bei reduzierter Bewegung direkt ans Ziel", () => {
    expect(bewegungsAnteil(0, 750)).toBe(0);
    expect(bewegungsAnteil(375, 750)).toBeGreaterThan(0.5);
    expect(bewegungsAnteil(750, 750)).toBe(1);
    expect(bewegungsAnteil(1000, 750)).toBe(1);
    expect(bewegungsAnteil(0, 750, true)).toBe(1);
    expect(bewegungsAnteil(0, 0)).toBe(1);
  });
  it("summiert 0.8-fache Geschosshöhen in Höhenreihenfolge und belässt das unterste Geschoss am Ort", () => {
    const offsets = separationsOffsets(welt, true);
    expect(offsets.ug).toBe(0); expect(offsets.eg).toBeCloseTo(2.4); expect(offsets.og).toBeCloseTo(4.96);
    expect(separationsOffsets(welt)).toEqual({ ug: 0, eg: 0, og: 0 });
    expect(separationsOffsets({ ...welt, geschosse: [] }, true)).toEqual({});
    expect(separationsOffsets({ ...welt, geschosse: [welt.geschosse[0]] }, true)).toEqual({ og: 0 });
  });
  it("kombiniert Geschossschnitt und ausgeblendete IDs ohne Höhen oder Reihenfolge der Eingaben zu ändern", () => {
    const vorher = JSON.stringify(welt);
    expect(sichtbareGeschosse(welt, null)).toEqual(["ug", "eg", "og"]);
    expect(sichtbareGeschosse(welt, "eg", ["ug"])).toEqual(["eg"]);
    expect(sichtbareGeschosse(welt, "og", ["eg"])).toEqual(["ug", "og"]);
    expect(sichtbareGeschosse(welt, "fehlt", ["og", "fremd"])).toEqual(["ug", "eg"]);
    expect(sichtbareGeschosse(welt, "eg", ["ug", "eg"])).toEqual([]);
    expect(JSON.stringify(welt)).toBe(vorher);
  });
  it("passt ausschliesslich die sichtbaren Gebäudegeschosse ein, mit Separation und Plattendicke", () => {
    const b = gebaeudeBereich(welt, bereich, ["eg", "og"], separationsOffsets(welt, true));
    expect(b.yMin).toBeCloseTo(2.15); expect(b.yMax).toBeCloseTo(11.76);
    expect(b).toMatchObject({ xMin: -0.15, xMax: 30.15 });
    expect(gebaeudeBereich(welt, bereich, [], {}).yMax).toBe(-3);
  });
  it("trennt Steigleitungen an Geschossgrenzen und behält alle sichtbaren Anschlusswege", () => {
    const p: [number, number, number][] = [[4, 0.3, 8], [4, 3.5, 8], [12, 3.5, 8]];
    expect(rohrGeschosse(welt, p, ["eg", "og"])).toEqual([
      { geschossId: "eg", punkte: [[4, 0.3, 8], [4, 3.2, 8]], anfangGetrennt: false, endeGetrennt: true },
      { geschossId: "og", punkte: [[4, 3.2, 8], [4, 3.5, 8], [12, 3.5, 8]], anfangGetrennt: true, endeGetrennt: false },
    ]);
    expect(rohrGeschosse(welt, p, ["og"])).toHaveLength(1);
    expect(rohrGeschosse(welt, p, [])).toEqual([]);
  });
  it("schneidet auch absteigende Rohre und mehrere ausgelassene Geschosse sauber", () => {
    const p: [number, number, number][] = [[1, 4, 1], [1, -2, 1]];
    const t = rohrGeschosse(welt, p, ["og", "ug"]);
    expect(t.map((t) => [t.geschossId, t.anfangGetrennt, t.endeGetrennt])).toEqual([["og", false, true], ["ug", true, false]]);
    expect(t[0].punkte.at(-1)![1]).toBeCloseTo(3.2);
    expect(t[1].punkte[0][1]).toBeCloseTo(0);
    expect(rohrGeschosse(welt, [], ["eg"])).toEqual([]);
  });
});

describe("Kamera im Dashboard-Freiraum", () => {
  it.each([[1280, 720], [1440, 900], [1920, 1080]])("füllt bei %s × %s im Fokus und Überblick 70 Prozent der begrenzenden freien Dimension", (breite, hoehe) => {
    const frei = { links: 368, rechts: 336, oben: 72, unten: 260 };
    for (const fokus of [null, "eg", "og"]) for (const getrennt of [false, true]) {
      const b = gebaeudeBereich(welt, bereich, sichtbareGeschosse(welt, fokus), separationsOffsets(welt, getrennt));
      const e = einpassen(b, breite, hoehe, frei, FIT_ANTEIL, fokus ? [1, 1.45, 1] : [1, 1, 1]);
      const camera = new THREE.OrthographicCamera(-breite / 2, breite / 2, hoehe / 2, -hoehe / 2, 0.1, 1000);
      camera.position.set(...e.position); camera.zoom = e.zoom; camera.lookAt(...e.ziel); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
      const punkte = [];
      for (const x of [b.xMin, b.xMax]) for (const y of [b.yMin, b.yMax]) for (const z of [b.zMin, b.zMax]) {
        const p = new THREE.Vector3(x, y, z).project(camera);
        punkte.push({ x: (p.x + 1) * breite / 2, y: (1 - p.y) * hoehe / 2 });
      }
      const x0 = Math.min(...punkte.map((p) => p.x)), x1 = Math.max(...punkte.map((p) => p.x));
      const y0 = Math.min(...punkte.map((p) => p.y)), y1 = Math.max(...punkte.map((p) => p.y));
      const fuellung = Math.max((x1 - x0) / (breite - frei.links - frei.rechts), (y1 - y0) / (hoehe - frei.oben - frei.unten));
      expect(fuellung).toBeCloseTo(0.7, 5);
      expect(punkte.every((p) => punktImFreiraum(p, breite, hoehe, frei, 0))).toBe(true);
      expect((x0 + x1) / 2).toBeCloseTo((frei.links + breite - frei.rechts) / 2);
      expect((y0 + y1) / 2).toBeCloseTo((frei.oben + hoehe - frei.unten) / 2);
    }
  });
  it("erkennt nur ausserhalb liegende Auswahlpunkte als Anlass für eine Kamerafahrt", () => {
    const frei = { links: 300, rechts: 300, oben: 100, unten: 200 };
    expect(punktImFreiraum({ x: 720, y: 400 }, 1440, 900, frei)).toBe(true);
    expect(punktImFreiraum({ x: 200, y: 400 }, 1440, 900, frei)).toBe(false);
    expect(punktImFreiraum({ x: 720, y: 800 }, 1440, 900, frei)).toBe(false);
    expect(punktImFreiraum(null, 1440, 900, frei)).toBe(false);
  });
  it("liefert CSS-Pixel relativ zum Canvas, auch für ausserhalb des Kamera-Clips liegende Punkte", () => {
    const c = new THREE.OrthographicCamera(-10, 10, 5, -5, 0.1, 100);
    c.position.set(0, 0, 10); c.lookAt(0, 0, 0); c.updateMatrixWorld();
    expect(bildpunkt(c, 1440, 900, new THREE.Vector3(0, 0, 0))).toEqual({ x: 720, y: 450 });
    expect(bildpunkt(c, 1440, 900, new THREE.Vector3(5, 2.5, 0))).toEqual({ x: 1080, y: 225 });
    expect(bildpunkt(c, 1440, 900, new THREE.Vector3(100, 0, 0))).toBeNull();
    expect(bildpunkt(c, 1440, 900, new THREE.Vector3(0, 0, 20))).toBeNull();
  });
});
