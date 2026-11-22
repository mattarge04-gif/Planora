import { describe, expect, it } from "vitest";
import { TOKENS } from "../design/tokens";
import { AMPEL_FARBE } from "../lebensdauer/ansicht";
import { anhaengerGroesse, anhaengerOrt, istZurueck, segmentVoll, trefferBereich, umrissSkala, zurueck, type AmpelFilter } from "./ampelFilter";

const F = TOKENS.erneuerung.filter;
const filter = (o: Partial<AmpelFilter> = {}): AmpelFilter => ({ treffer: new Set(["a"]), anhaenger: new Set(), stufen: new Set(["rot"]), ...o });
const anlage = (schluessel: string, x: number) => ({ schluessel, mitte: [x, 0.5, 0] as [number, number, number], masse: [1, 1, 1] as [number, number, number],
  inline: false, farbe: AMPEL_FARBE.rot });

describe("zurueck", () => {
  it("mischt zu grund, keine Abdunkelung", () => {
    expect(zurueck("#000000", 0.25, "#ffffff")).toBe("#bfbfbf");
    expect(zurueck("#d64541", 1)).toBe("#d64541");
    expect(zurueck("#d64541", 0)).toBe(TOKENS.farbe.grund);
  });
});

describe("Filter", () => {
  it("ohne Filter nichts zurueck und alle Segmente voll; mit Filter nur Treffer bzw. gewaehlte Stufen", () => {
    expect(istZurueck(null, "x")).toBe(false);
    expect(segmentVoll(undefined, "gelb")).toBe(true);
    expect(istZurueck(filter(), "a")).toBe(false);
    expect(istZurueck(filter(), "b")).toBe(true);
    expect(segmentVoll(filter(), "rot")).toBe(true);
    expect(segmentVoll(filter({ stufen: new Set(["ohnePreis"]) }), "rot")).toBe(false);
  });
  it("Kamerabereich nur ueber die Treffer, eng (filter.kameraMinM statt Raumkontext)", () => {
    const b = trefferBereich([anlage("a", 0), anlage("b", 30)], new Set(["a"]))!;
    expect(b.xMax - b.xMin).toBeCloseTo(Math.max(1, F.kameraMinM));
    expect(F.kameraMinM).toBeLessThan(TOKENS.erneuerung.kameraMinM);
    expect((b.xMin + b.xMax) / 2).toBeCloseTo(0);
    const zwei = trefferBereich([anlage("a", 0), anlage("b", 30)], new Set(["a", "b"]))!;
    expect(zwei.xMax - zwei.xMin).toBeCloseTo(31);
    expect(trefferBereich([anlage("a", 0)], new Set(["x"]))).toBeNull();
  });
});

describe("Anhaenger", () => {
  it("Groesse: nah fest, fern Mindest-px, gedeckelt", () => {
    expect(anhaengerGroesse(1000)).toBe(F.anhaengerM);
    expect(anhaengerGroesse(1)).toBe(F.anhaengerMaxM);
    expect(anhaengerGroesse(60)).toBeCloseTo(F.anhaengerPx / 60, 3);
  });
  it("steht auf der Oberkante; in der Leitung seitlich neben dem Teil, nicht schwebend ueber dem Rohr", () => {
    expect(anhaengerOrt([1, 2, 3], [0.6, 1, 0.4], false, 0.12)).toEqual([1, 2.5, 3]);
    const p = anhaengerOrt([0, 1, 0], [0.15, 0.25, 0.15], true, 0.12, [0, 1]);
    expect(p[0]).toBeCloseTo(0);
    expect(p[2]).toBeCloseTo(0.075 + F.anhaengerAbstandM + 0.06);
    expect(p[1] + 0.12).toBeCloseTo(1.125); // Oberkante des Schilds = Oberkante des Teils
  });
});

describe("umrissSkala", () => {
  it("Umriss in Bildschirmpixeln: fokussiert breiter, Mindestzuschlag, ohne Zoom wie bisher", () => {
    const m: [number, number, number] = [0.35, 0.45, 0.3], z = 150;
    const px = (s: number) => (s - 1) * 0.45 / 2 * z;
    expect(px(umrissSkala(m, z, 2))).toBeCloseTo(2);
    expect(umrissSkala(m, z, 2)).toBeGreaterThan(umrissSkala(m, z, 1));
    expect(umrissSkala([5, 5, 5], 1000, 1)).toBe(1.01);
    expect(umrissSkala(m, 0, 1)).toBe(1.04);
  });
});
