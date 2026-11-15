import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { ROHR } from "./technik";
import { ACHSE, achseMitte, achseTorus, achseY, achseZ, ROHR_STAERKE, rohrFaktor } from "./rohrStaerke";
import { rohrGeometrie } from "./technikGeometrie";

describe("Bildschirm-Mindeststärke der Leitungen", () => {
  it("lässt die Nahansicht unverändert", () => {
    expect(rohrFaktor(200)).toBe(1);
    expect(rohrFaktor(ROHR_STAERKE.zielPx / (2 * ROHR.verteil))).toBe(1);
  });

  it("verdickt aus der Distanz bis zur Zielbreite der Gruppenleitung", () => {
    const zoom = 35;
    expect(2 * ROHR.verteil * rohrFaktor(zoom) * zoom).toBeCloseTo(ROHR_STAERKE.zielPx, 6);
  });

  it("begrenzt die Verdickung und ist monoton", () => {
    expect(rohrFaktor(5)).toBe(ROHR_STAERKE.max);
    const werte = [5, 15, 25, 35, 50, 80].map(rohrFaktor);
    for (let i = 1; i < werte.length; i++) expect(werte[i]).toBeLessThanOrEqual(werte[i - 1]);
  });

  it("fällt bei ungültigem Zoom auf 1 zurück", () => {
    expect(rohrFaktor(0)).toBe(1);
    expect(rohrFaktor(Number.NaN)).toBe(1);
  });

  it("legt die Rohrachse jedes Rings auf den Pfad (Abstand Vertex–Achse = Radius)", () => {
    const g = rohrGeometrie({ punkte: [[0, 1, 0], [2, 1, 0], [2, 1, 2]], radius: 0.045, startRadius: 0.045, endRadius: 0.045, boden: 0 })!;
    const p = g.getAttribute("position"), a = g.getAttribute(ACHSE);
    expect(a.count).toBe(p.count);
    for (let i = 0; i < p.count; i += 7) {
      const d = new THREE.Vector3().fromBufferAttribute(p, i).distanceTo(new THREE.Vector3().fromBufferAttribute(a, i));
      expect(d).toBeCloseTo(0.045, 4);
    }
  });

  it("setzt Achsen für Zylinder, Hülse, Kugel und Torus", () => {
    const z = achseY(new THREE.CylinderGeometry(1, 1, 1, 8, 1)).getAttribute(ACHSE);
    expect(z.getX(0)).toBe(0); expect(z.getZ(0)).toBe(0);
    const h = achseZ(new THREE.CylinderGeometry(1, 1, 1, 8, 1).rotateX(Math.PI / 2)).getAttribute(ACHSE);
    expect(h.getX(3)).toBe(0); expect(h.getY(3)).toBe(0);
    expect(achseMitte(new THREE.SphereGeometry(1, 8, 6)).getAttribute(ACHSE).getX(5)).toBe(0);
    const t = achseTorus(new THREE.TorusGeometry(1, 0.1, 6, 8, Math.PI / 2), 1).getAttribute(ACHSE);
    for (let i = 0; i < t.count; i++) expect(Math.hypot(t.getX(i), t.getY(i))).toBeCloseTo(1, 6);
  });
});
