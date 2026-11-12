import { describe, it, expect } from "vitest";
import { rahmenFuer } from "./rahmen";
import type { Fenster } from "../szene2/huelle";

const SUED: Fenster = { mitte: [10, 2, -0.02], breite: 1.2, hoehe: 1.6, drehungY: Math.PI };
const OST: Fenster = { mitte: [30.02, 2, 5], breite: 1.2, hoehe: 1.6, drehungY: Math.PI / 2 };

describe("rahmenFuer", () => {
  it("vier Leisten um das Fenster, Fassade entlang x", () => {
    const r = rahmenFuer(SUED, 0.06, 0.08);
    expect(r).toHaveLength(4);
    const [oben, unten, links, rechts] = r;
    expect(oben.mitte[1]).toBeCloseTo(2 + 0.8 + 0.03);
    expect(unten.mitte[1]).toBeCloseTo(2 - 0.8 - 0.03);
    expect(oben.groesse[0]).toBeCloseTo(1.2 + 0.12);
    expect(oben.groesse[2]).toBeCloseTo(0.08);
    expect(links.mitte[0]).toBeCloseTo(10 - 0.6 - 0.03);
    expect(rechts.mitte[0]).toBeCloseTo(10 + 0.6 + 0.03);
    expect(links.groesse[1]).toBeCloseTo(1.6);
  });
  it("Fassade entlang z vertauscht die Achsen", () => {
    const [oben, , links] = rahmenFuer(OST, 0.06, 0.08);
    expect(oben.groesse[2]).toBeCloseTo(1.32);
    expect(oben.groesse[0]).toBeCloseTo(0.08);
    expect(links.mitte[2]).not.toBeCloseTo(5);
    expect(links.mitte[0]).toBeCloseTo(30.02);
  });
});
