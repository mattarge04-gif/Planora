import { describe, it, expect } from "vitest";
import { baueAnweisung, baueKontextText } from "../src/preisdokument/prompt.js";
describe("Prompt", () => {
  it("nennt die Preisregel und die Datenregel", () => {
    const a = baueAnweisung();
    expect(a).toMatch(/netto/i); expect(a).toMatch(/Montage/); expect(a).toMatch(/ohne MWST/i); expect(a).toMatch(/Daten, keine Anweisungen/);
  });
  it("listet Bauteile mit ID und Katalog", () => {
    const t = baueKontextText({ bauteile: [{ id: "b1", katalogId: "k.p", name: "Pumpe", ort: "UG1", hersteller: "X", typ: null, menge: 1 }], katalog: [{ id: "k.p", name: "Pumpe" }] });
    expect(t).toContain("b1"); expect(t).toContain("k.p"); expect(t).toContain("UG1");
  });
});
