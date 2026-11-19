import { describe, expect, it } from "vitest";
import { ampelFarben } from "./ampelFaerbung";
import { AMPEL_FARBE } from "../lebensdauer/ansicht";

describe("ampelFarben", () => {
  it("Farbe je Symbol aus schlechtester Ampel", () => {
    const stand: any = { ergebnis: { bauteile: [{ id: "a", ampel: "rot" }, { id: "b", ampel: "gruen" }] } };
    const m = ampelFarben(stand, [{ schluessel: "s1", bauteilIds: ["a", "b"] }, { schluessel: "s2", bauteilIds: ["b"] }] as any);
    expect(m.get("s1")).toBe(AMPEL_FARBE.rot);
    expect(m.get("s2")).toBe(AMPEL_FARBE.gruen);
  });
  it("Symbol ohne Eintrag bleibt ungefaerbt", () => {
    const stand: any = { ergebnis: { bauteile: [{ id: "a", ampel: "gelb" }] } };
    const m = ampelFarben(stand, [{ schluessel: "s3", bauteilIds: ["x"] }] as any);
    expect(m.has("s3")).toBe(false);
  });
});
