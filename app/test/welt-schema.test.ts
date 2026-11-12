import { describe, it, expect } from "vitest";
import { Ajv } from "ajv";
import { BESCHREIBUNG_SCHEMA, HUELLE_SCHEMA, ENTWURF_SCHEMA } from "../src/welt/schema.js";

// Optionen gespiegelt aus app/src/server.ts (ajv.customOptions)
const ajv = new Ajv({ removeAdditional: false, coerceTypes: false }); // gleiche customOptions wie server.ts
const beschreibung = ajv.compile(BESCHREIBUNG_SCHEMA);
const huelle = ajv.compile(HUELLE_SCHEMA);
const entwurf = ajv.compile(ENTWURF_SCHEMA);

const basis = () => ({
  stand: 0, heizungStandard: { hk: "ja", fbh: "nein", tabs: "nein" }, einheiten: [] as unknown[], bauteile: [] as unknown[],
});
const bauteil = (extra: object = {}) => ({
  katalogId: "heizung.waermepumpe", standort: { geschossId: "00000000-0000-4000-8000-000000000001" },
  menge: 1, status: "bestaetigt", versorgt: [], ...extra,
});

describe("BESCHREIBUNG_SCHEMA Gruppen und Ort", () => {
  it("gueltige Gruppe", () => {
    const b = { ...basis(), gruppen: [{ verteiler: { bauteilIndex: 0 }, nummer: 1, art: "beimisch", bezeichnung: "HK Restaurant", verbraucher: [{ bauteilIndex: 1 }] }] };
    expect(beschreibung(b)).toBe(true);
  });
  it("unbekannte Gruppenart ungueltig", () => {
    const b = { ...basis(), gruppen: [{ verteiler: { bauteilIndex: 0 }, nummer: 1, art: "x", bezeichnung: "A", verbraucher: [] }] };
    expect(beschreibung(b)).toBe(false);
  });
  it("Ort: genau ein Schluessel", () => {
    expect(beschreibung({ ...basis(), bauteile: [bauteil({ ort: { gruppe: { gruppeIndex: 0 } } })] })).toBe(true);
    expect(beschreibung({ ...basis(), bauteile: [bauteil({ ort: { vorBauteil: { bauteilIndex: 0 } } })] })).toBe(true);
    expect(beschreibung({ ...basis(), bauteile: [bauteil({ ort: null })] })).toBe(true);
    expect(beschreibung({ ...basis(), bauteile: [bauteil({ ort: { gruppe: { gruppeIndex: 0 }, vorBauteil: { bauteilIndex: 0 } } })] })).toBe(false);
  });
});

describe("Verweise streng", () => {
  it("Verweis mit ID und Index ungueltig", () => {
    const g = (v: object) => ({ ...basis(), gruppen: [{ verteiler: v, nummer: 1, art: "beimisch", bezeichnung: "A", verbraucher: [] }] });
    expect(beschreibung(g({ bauteilId: "00000000-0000-4000-8000-000000000001", bauteilIndex: 0 }))).toBe(false);
    expect(beschreibung(g({ bauteilIndex: 0 }))).toBe(true);
  });
  it("leerer Ort ungueltig", () => {
    expect(beschreibung({ ...basis(), bauteile: [bauteil({ ort: {} })] })).toBe(false);
  });
});

describe("HUELLE_SCHEMA", () => {
  it("ohne Masse gueltig, quadrat erlaubt", () => {
    expect(huelle({ name: "A", grundform: "quader", geschosse: [{ code: "EG" }] })).toBe(true);
    expect(huelle({ name: "A", grundform: "quadrat", geschosse: [{ code: "EG" }] })).toBe(true);
  });
});

describe("ENTWURF_SCHEMA", () => {
  it("stand und daten Pflicht", () => {
    expect(entwurf({ stand: 0, daten: {} })).toBe(true);
    expect(entwurf({ daten: {} })).toBe(false);
  });
});
