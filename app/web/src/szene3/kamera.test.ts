import { describe, it, expect } from "vitest";
import { einpassen, ISO_RICHTUNG } from "./kamera";
import type { Bereich } from "../szene2/huelle";
import { OrthographicCamera, Vector3 } from "three";

const B: Bereich = { xMin: 0, xMax: 30, zMin: 0, zMax: 15, yMin: 0, yMax: 6.5 };
const OHNE = { links: 0, rechts: 0, oben: 0, unten: 0 };

describe("einpassen", () => {
  it("ohne Freiraum zielt auf die Mitte des Bereichs", () => {
    const e = einpassen(B, 1440, 900, OHNE, 0.7);
    expect(e.ziel[0]).toBeCloseTo(15);
    expect(e.ziel[1]).toBeCloseTo(3.25);
    expect(e.ziel[2]).toBeCloseTo(7.5);
  });
  it("Kamera liegt in Iso-Richtung vom Ziel", () => {
    const e = einpassen(B, 1440, 900, OHNE, 0.7);
    const d = [e.position[0] - e.ziel[0], e.position[1] - e.ziel[1], e.position[2] - e.ziel[2]];
    const l = Math.hypot(...d);
    d.forEach((v, i) => expect(v / l).toBeCloseTo(ISO_RICHTUNG[i]));
  });
  it("Zoom waechst linear mit der Ansicht und faellt mit der Gebaeudegroesse", () => {
    const a = einpassen(B, 1440, 900, OHNE, 0.7).zoom;
    expect(einpassen(B, 2880, 1800, OHNE, 0.7).zoom).toBeCloseTo(2 * a);
    const gross = { ...B, xMax: 60, zMax: 30 };
    expect(einpassen(gross, 1440, 900, OHNE, 0.7).zoom).toBeLessThan(a);
  });
  it("Fuellgrad skaliert den Zoom", () => {
    expect(einpassen(B, 1440, 900, OHNE, 0.35).zoom).toBeCloseTo(einpassen(B, 1440, 900, OHNE, 0.7).zoom / 2);
  });
  it("Freiraum links verschiebt das Bild nach rechts (Ziel nach links)", () => {
    const mitte = einpassen(B, 1440, 900, OHNE, 0.7);
    const links = einpassen(B, 1440, 900, { links: 320, rechts: 0, oben: 0, unten: 0 }, 0.7);
    expect(links.zoom).toBeLessThan(mitte.zoom);
    // Bildschirm-rechts-Vektor der Iso-Kamera zeigt in (+x, 0, -z)/sqrt2: Ziel wandert entgegen
    const verschiebung = (links.ziel[0] - mitte.ziel[0]) - (links.ziel[2] - mitte.ziel[2]);
    expect(verschiebung).toBeLessThan(0);
  });
  it("passt auch beim steileren Einblick alle Gebäudeecken in den reservierten freien Raum ein", () => {
    const e = einpassen(B, 1440, 900, { links: 320, rechts: 280, oben: 100, unten: 200 }, 0.7, [1, 1.45, 1]);
    const k = new OrthographicCamera(-720, 720, 450, -450, 0.1, 1000);
    k.position.set(...e.position); k.zoom = e.zoom; k.lookAt(...e.ziel); k.updateProjectionMatrix(); k.updateMatrixWorld();
    for (const x of [B.xMin, B.xMax]) for (const y of [B.yMin, B.yMax]) for (const z of [B.zMin, B.zMax]) {
      const p = new Vector3(x, y, z).project(k);
      const px = (p.x + 1) * 720, py = (1 - p.y) * 450;
      expect(px).toBeGreaterThan(320); expect(px).toBeLessThan(1160);
      expect(py).toBeGreaterThan(100); expect(py).toBeLessThan(700);
    }
    expect(e.position[1] - e.ziel[1]).toBeGreaterThan(e.position[0] - e.ziel[0]);
  });
});
