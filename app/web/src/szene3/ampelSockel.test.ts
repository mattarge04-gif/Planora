import { describe, expect, it } from "vitest";
import { TOKENS } from "../design/tokens";
import { AMPEL_FARBE } from "../lebensdauer/ansicht";
import { ampelBereich, ampelVonFarbe, type AmpelAnlage } from "./ampelSockel";

const E = TOKENS.erneuerung;
const anlage = (o: Partial<AmpelAnlage> = {}): AmpelAnlage =>
  ({ schluessel: "a", mitte: [1, 0.5, 2], masse: [0.6, 1, 0.4], inline: false, farbe: AMPEL_FARBE.rot, ...o });

describe("ampelVonFarbe", () => {
  it("Farbe -> Stufe, unbekannt grau", () => {
    expect(ampelVonFarbe(AMPEL_FARBE.gelb)).toBe("gelb");
    expect(ampelVonFarbe(AMPEL_FARBE.gruen.toUpperCase())).toBe("gruen");
    expect(ampelVonFarbe("#123456")).toBe("grau");
  });
});

describe("ampelBereich", () => {
  it("rahmt Rot/Gelb, mindestens kameraMinM", () => {
    const b = ampelBereich([anlage({ mitte: [0, 0.5, 0] }), anlage({ farbe: AMPEL_FARBE.gruen, mitte: [50, 0.5, 50] })])!;
    expect(b.xMax - b.xMin).toBeCloseTo(E.kameraMinM);
    expect((b.xMin + b.xMax) / 2).toBeCloseTo(0);
  });
  it("nur Gruen: alle; leer: null", () => {
    const b = ampelBereich([anlage({ farbe: AMPEL_FARBE.gruen, mitte: [0, 0.5, 0] }), anlage({ farbe: AMPEL_FARBE.gruen, mitte: [20, 0.5, 0] })])!;
    expect(b.xMax - b.xMin).toBeCloseTo(20.6);
    expect(ampelBereich([])).toBeNull();
  });
});

describe("vorNeutralToneMapping", () => {
  it("Umkehr: nach dem Tone Mapping wieder die Tokenfarbe (linear)", async () => {
    const { Color } = await import("three");
    const { neutralToneMapping, vorNeutralToneMapping } = await import("./ampelSockel");
    for (const hex of Object.values(AMPEL_FARBE)) {
      const c = new Color(hex), lin: [number, number, number] = [c.r, c.g, c.b];
      const zurueck = neutralToneMapping(vorNeutralToneMapping(lin));
      zurueck.forEach((v, i) => expect(v).toBeCloseTo(lin[i], 4));
    }
  });
  it("ohne Umkehr verschiebt das Tone Mapping Gruen sichtbar (Ursache der Kritik)", async () => {
    const { Color } = await import("three");
    const { neutralToneMapping } = await import("./ampelSockel");
    const c = new Color(AMPEL_FARBE.gruen), aus = new Color().setRGB(...neutralToneMapping([c.r, c.g, c.b]));
    expect(aus.getHexString()).not.toBe(c.getHexString());
  });
});
