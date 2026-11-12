import { describe, it, expect } from "vitest";
import { KULISSE, kulisse } from "./kulisse";
import type { Bereich } from "../szene2/huelle";
import type { Quader } from "../szene2/huelle";

const B: Bereich = { xMin: 0, xMax: 30, zMin: 0, zMax: 15, yMin: 0, yMax: 6.5 };
const ueberlapptGebaeude = (q: Quader) => {
  const [mx, , mz] = q.mitte, [gx, , gz] = q.groesse;
  return mx + gx / 2 > B.xMin - 0.5 && mx - gx / 2 < B.xMax + 0.5 && mz + gz / 2 > B.zMin - 0.5 && mz - gz / 2 < B.zMax + 0.5;
};
const inPlatte = (x: number, z: number, p: Quader) =>
  Math.abs(x - p.mitte[0]) <= p.groesse[0] / 2 + 1e-9 && Math.abs(z - p.mitte[2]) <= p.groesse[2] / 2 + 1e-9;

describe("kulisse", () => {
  const k = kulisse(B);
  it("Grundplatte umschliesst Gebaeude mit Rand", () => {
    expect(k.platte.groesse[0]).toBeCloseTo(30 + 2 * KULISSE.rand);
    expect(k.platte.groesse[2]).toBeCloseTo(15 + 2 * KULISSE.rand);
    expect(k.platte.mitte[1]).toBeCloseTo(-KULISSE.platteHoehe / 2);
  });
  it("Wege, Parkfelder und Baeume liegen auf der Platte und nicht im Gebaeude", () => {
    expect(k.wege.length).toBeGreaterThan(0);
    expect(k.parkfelder.length).toBeGreaterThan(0);
    expect(k.baeume.length).toBeGreaterThan(0);
    for (const q of [...k.wege, ...k.parkfelder]) {
      expect(ueberlapptGebaeude(q)).toBe(false);
      expect(inPlatte(q.mitte[0], q.mitte[2], k.platte)).toBe(true);
    }
    for (const b of k.baeume) {
      expect(inPlatte(b.position[0], b.position[2], k.platte)).toBe(true);
      const imGebaeude = b.position[0] > B.xMin - 1 && b.position[0] < B.xMax + 1 && b.position[2] > B.zMin - 1 && b.position[2] < B.zMax + 1;
      expect(imGebaeude).toBe(false);
    }
  });
  it("deterministisch", () => {
    expect(kulisse(B)).toEqual(k);
  });
  it("kleines Gebaeude ergibt trotzdem eine gueltige Kulisse", () => {
    const klein = kulisse({ xMin: 0, xMax: 4, zMin: 0, zMax: 4, yMin: 0, yMax: 3 });
    expect(klein.platte.groesse[0]).toBeGreaterThan(4);
    expect(klein.baeume.every((b) => b.hoehe > 0 && b.radius > 0)).toBe(true);
  });
});
