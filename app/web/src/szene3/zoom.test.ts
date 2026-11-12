import { describe, expect, it } from "vitest";
import { OrthographicCamera, Vector3 } from "three";
import { einpassen, freiraumScissor, nahZoom, zoomImFreiraum } from "./kamera";

const frei = { links: 300, rechts: 260, oben: 120, unten: 240 };
const gebaeude = { xMin: 0, xMax: 30, yMin: 0, yMax: 7, zMin: 0, zMax: 16 };
const anlage = { xMin: 20, xMax: 21, yMin: 0, yMax: 2, zMin: 4, zMax: 5 };

function kamera(breite: number, hoehe: number) {
  const e = einpassen(gebaeude, breite, hoehe, frei);
  const k = new OrthographicCamera(-breite / 2, breite / 2, hoehe / 2, -hoehe / 2, 0.1, 1000);
  const ziel = new Vector3(...e.ziel);
  k.position.set(...e.position); k.lookAt(ziel); k.zoom = e.zoom;
  k.updateProjectionMatrix(); k.updateMatrixWorld();
  return { k, ziel };
}

describe("Zoom im Freiraum", () => {
  it.each([[1280, 800], [1440, 900], [1920, 1080]])("verankert die freie Mitte bei %i x %i auch nach mehreren Zoomschritten", (b, h) => {
    const { k, ziel } = kamera(b, h);
    const ndc = new Vector3((frei.links - frei.rechts) / b, (frei.unten - frei.oben) / h, 0);
    const weltpunkt = ndc.clone().unproject(k);
    const richtung = k.position.clone().sub(ziel);
    for (const faktor of [1.15, 1.15, 1 / 1.15, 0.95, 1 / 0.95]) {
      zoomImFreiraum(k, ziel, b, h, frei, k.zoom * faktor);
      expect(weltpunkt.clone().project(k).distanceTo(ndc)).toBeLessThan(1e-10);
      expect(k.position.clone().sub(ziel).distanceTo(richtung)).toBeLessThan(1e-10);
    }
  });

  it.each([[1280, 800], [1440, 900], [1920, 1080]])("hält eine seitliche Auswahl vollständig im Freiraum bei %i x %i", (b, h) => {
    const { k, ziel } = kamera(b, h);
    for (const faktor of [5, 2, 2, 10, 0.1, 0.5]) {
      zoomImFreiraum(k, ziel, b, h, frei, k.zoom * faktor, anlage);
      for (const x of [anlage.xMin, anlage.xMax]) for (const y of [anlage.yMin, anlage.yMax]) for (const z of [anlage.zMin, anlage.zMax]) {
        const p = new Vector3(x, y, z).project(k);
        const px = (p.x + 1) * b / 2, py = (1 - p.y) * h / 2;
        expect(px).toBeGreaterThanOrEqual(frei.links + 12 - 1e-8);
        expect(px).toBeLessThanOrEqual(b - frei.rechts - 12 + 1e-8);
        expect(py).toBeGreaterThanOrEqual(frei.oben + 12 - 1e-8);
        expect(py).toBeLessThanOrEqual(h - frei.unten - 12 + 1e-8);
      }
    }
  });

  it("beschneidet das ganze Modell genau an der Tabellenoberkante ohne seitlichen Beschnitt", () => {
    expect(freiraumScissor(1440, 900, { links: 0, rechts: 0, oben: 0, unten: frei.unten }, 1, 0)).toEqual([0, 240, 1440, 660]);
    expect(freiraumScissor(1440, 900, { links: 0, rechts: 0, oben: 0, unten: frei.unten }, 2, 0)).toEqual([0, 480, 2880, 1320]);
  });

  it("blendet Kulisse ab Nahzoom aus und verhindert Flackern an der Schwelle", () => {
    expect(nahZoom(200, 100)).toBe(false);
    expect(nahZoom(201, 100)).toBe(true);
    expect(nahZoom(190, 100, true)).toBe(true);
    expect(nahZoom(180, 100, true)).toBe(false);
    expect(nahZoom(190, 100, false)).toBe(false);
  });
});
