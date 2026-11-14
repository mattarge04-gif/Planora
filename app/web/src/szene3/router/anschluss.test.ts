import { describe, expect, it } from "vitest";
import type { WeltSymbol } from "../../typen";
import { routerAnschluss } from "./anschluss";
import { GRENZEN, type Koerper } from "./typen";
import { TEST_KATALOG } from "./testKatalog";

const sym = (katalogId: string, x: number, z: number): WeltSymbol => ({ schluessel: katalogId, katalogId, position: { x, y: 0, z }, versorgt: [],
  bauteilIds: [], mengeSumme: 1, mengeUnbekannt: false, hersteller: null, typ: null, status: "bestaetigt" });
const raum = { x: 0, z: 0, breite: 10, tiefe: 10 };

describe("routerAnschluss", () => {
  it("Stutzen auf der Seitenfläche: Steigleitung hält Rohrradius plus Fuge zum eigenen Körper", () => {
    // Speicher 0.9 x 1.8 x 0.9, Stutzen 4 cm vor der Vorderfläche (wie im Muster).
    const s = sym("heizung.speicher", 5, 5);
    const f = routerAnschluss(s, [0, 1.48, 0.49], 0.07, 2.8, raum, [], null, TEST_KATALOG);
    expect(f.ok).toBe(true);
    const [x, , z] = f.punkte.at(-1)!;
    const marge = 0.07 + GRENZEN.fuge - 1e-9;
    expect(Math.abs(x - 5) >= 0.45 + marge || Math.abs(z - 5) >= 0.45 + marge).toBe(true);
    expect(f.punkte.at(-1)![1]).toBe(2.8);
  });
  it("Rückfall ohne zulässige Lage: ok = false, Leitung am Stutzen", () => {
    // Verteiler-Zuleitung im Balken, rundum von fremden Körpern umschlossen.
    const s = sym("heizung.verteiler", 5, 5);
    const zu: Koerper[] = [{ schluessel: "x", min: [3, 0, 3], max: [7, 3, 4.84] }, { schluessel: "y", min: [3, 0, 5.16], max: [7, 3, 7] },
      { schluessel: "z", min: [3, 0, 3], max: [4.3, 3, 7] }, { schluessel: "w", min: [5.7, 0, 3], max: [7, 3, 7] }];
    const f = routerAnschluss(s, [-0.45, 0.62, 0.02], 0.07, 2.8, raum, zu, null, TEST_KATALOG);
    expect(f.ok).toBe(false);
    expect(f.punkte[0]).toEqual([4.55, 0.62, 5.02]);
    expect(f.punkte.at(-1)).toEqual([4.55, 2.8, 5.02]);
  });
});
