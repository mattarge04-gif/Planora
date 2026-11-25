import { describe, it, expect } from "vitest";
import { geaendert, geltungText, werteAusEingabe, wertText, type DatenblattFeld } from "./datenblatt";
const F: DatenblattFeld[] = [{ schluessel: "dn", bezeichnung: "Nennweite", einheit: "DN", art: "zahl" }, { schluessel: "bauart", bezeichnung: "Bauart", einheit: null, art: "text" }];
describe("Datenblatt-Eingabe", () => {
  it("Zahl mit Komma oder Punkt, leer = null, Text getrimmt", () => {
    expect(werteAusEingabe(F, { dn: "32", bauart: " Nassläufer " })).toEqual({ werte: { dn: 32, bauart: "Nassläufer" }, fehler: {} });
    expect(werteAusEingabe(F, { dn: "6,5", bauart: "" })).toEqual({ werte: { dn: 6.5, bauart: null }, fehler: {} });
    expect(werteAusEingabe(F, { dn: "gross" }).fehler).toEqual({ dn: "Zahl eingeben" });
  });
  it("Anzeige", () => {
    expect([wertText(F[0], 32), wertText(F[1], "Nass"), wertText(F[0], undefined)]).toEqual(["DN 32", "Nass", "–"]);
  });
});

describe("Datenblatt je Typ (E48)", () => {
  it("nur geaenderte Felder, Geltungstext", () => {
    expect(geaendert({ dn: "32", foerderhoehe_m: "", leistung_w: "45" }, { dn: "32", foerderhoehe_m: "6.5", leistung_w: "" })).toEqual({ foerderhoehe_m: "", leistung_w: "45" });
    expect([geltungText({ bauteilIds: ["a", "b"], typ: "Grundfos Magna 32" }), geltungText({ bauteilIds: ["a"], typ: "Grundfos Magna 32" }),
      geltungText({ bauteilIds: ["a", "b"], typ: null }), geltungText({ bauteilIds: ["a"], typ: null })])
      .toEqual(["Gilt für alle 2 Bauteile vom Typ Grundfos Magna 32.", "Gilt für alle Bauteile vom Typ Grundfos Magna 32.", "Gilt für alle 2 Bauteile dieser Gruppe.", null]);
  });
});
