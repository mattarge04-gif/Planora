import { describe, it, expect } from "vitest";
import { pruefeVorschlaege } from "../src/preisdokument/pruefung.js";
import { kostenUsd } from "../src/preisdokument/adapter.js";
const K = { bauteile: [
  { id: "11111111-1111-4111-8111-111111111111", katalogId: "heizung.umwaelzpumpe", name: "Umwälzpumpe", ort: "UG1 · Technik", hersteller: null, typ: null, menge: 1 },
  { id: "22222222-2222-4222-8222-222222222222", katalogId: "heizung.heizkoerper", name: "Heizkörper", ort: "EG · Gastro", hersteller: null, typ: null, menge: 4 },
], katalog: [{ id: "heizung.umwaelzpumpe", name: "Umwälzpumpe" }, { id: "heizung.heizkoerper", name: "Heizkörper" }] };
const v = (x: object) => ({ vorschlaege: [{ position: "Pos 1", seite: 1, zitat: "Pumpe 1'240.00", materialNetto: 1116, rabattText: "10 %", montageAnteil: 180,
  ersatzpreis: 1296, rechenweg: "1'240 − 10 % + 180", katalogId: "heizung.umwaelzpumpe", bauteilIds: ["11111111-1111-4111-8111-111111111111"], sicherheit: "hoch", ...x }] });
describe("pruefeVorschlaege", () => {
  it("uebernimmt gueltige Zuordnung", () => expect(pruefeVorschlaege(v({}), K, 2)[0].bauteilIds).toHaveLength(1));
  it("unbekannte Katalog-ID -> nicht zugeordnet", () => {
    const r = pruefeVorschlaege(v({ katalogId: "erfunden.x" }), K, 2)[0];
    expect([r.katalogId, r.bauteilIds]).toEqual([null, []]);
  });
  it("fremde oder unpassende Bauteil-ID wird entfernt", () => {
    const r = pruefeVorschlaege(v({ bauteilIds: ["22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333"] }), K, 2)[0];
    expect(r.bauteilIds).toEqual([]);
  });
  it("Seite ausserhalb -> auf 1 begrenzt und Sicherheit tief", () => {
    const r = pruefeVorschlaege(v({ seite: 9 }), K, 2)[0];
    expect([r.seite, r.sicherheit]).toEqual([1, "tief"]);
  });
  it("negativer Preis oder fehlendes Feld -> Schemafehler", () => {
    expect(() => pruefeVorschlaege(v({ ersatzpreis: -1 }), K, 2)).toThrow(/schema/i);
    expect(() => pruefeVorschlaege({ foo: 1 }, K, 2)).toThrow(/schema/i);
  });
  it("Preis wird auf Rappen gerundet", () => expect(pruefeVorschlaege(v({ ersatzpreis: 1296.004 }), K, 2)[0].ersatzpreis).toBe(1296));
  it("Kosten: 30k ein, 4k aus = 0.10 USD", () => expect(kostenUsd(30000, 4000)).toBeCloseTo(0.1, 4));
});
