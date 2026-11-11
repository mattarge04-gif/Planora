// JSON-Schemas fuer Fastify (ajv). Strukturfehler → 400; fachliche Regeln prueft pruefung.ts (→ 422).
const UUID = { type: "string", pattern: "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$" };
const DREI = { type: "string", enum: ["ja", "nein", "unbekannt"] };
const HEIZ = { hk: DREI, fbh: DREI, tabs: DREI };
const INDEX = { type: "integer", minimum: 0 };
const RECHTECK = {
  type: ["object", "null"], additionalProperties: false, required: ["x", "z", "breite", "tiefe"],
  properties: { x: { type: "number" }, z: { type: "number" }, breite: { type: "number", exclusiveMinimum: 0 }, tiefe: { type: "number", exclusiveMinimum: 0 } },
};
const VERWEIS = { type: "object", additionalProperties: false, minProperties: 1, maxProperties: 1, properties: { einheitId: UUID, einheitIndex: INDEX } };
const TEXT = { type: ["string", "null"], maxLength: 200 };

export const ID_PARAMS = { type: "object", required: ["id"], properties: { id: UUID } };
export const LID_PARAMS = { type: "object", required: ["lid"], properties: { lid: UUID } };

export const HUELLE_SCHEMA = {
  type: "object", additionalProperties: false, required: ["name", "grundform", "breiteM", "tiefeM", "geschosse"],
  properties: {
    name: { type: "string", minLength: 1, maxLength: 200 },
    grundform: { type: "string", enum: ["quader", "l_form", "u_form"] },
    breiteM: { type: "number" }, tiefeM: { type: "number" },
    geschosse: { type: "array", maxItems: 50, items: {
      type: "object", additionalProperties: false, required: ["code"],
      properties: { id: UUID, code: { type: "string", maxLength: 10 }, hoeheM: { type: "number" } } } },
  },
};

export const BESCHREIBUNG_SCHEMA = {
  type: "object", additionalProperties: false, required: ["stand", "heizungStandard", "einheiten", "bauteile"],
  properties: {
    gebaeudeId: { type: "string" }, stand: { type: "integer", minimum: 0 },
    geschosse: { type: "array" }, hinweise: { type: "array" },
    heizungStandard: { type: "object", additionalProperties: false, required: ["hk", "fbh", "tabs"], properties: HEIZ },
    einheiten: { type: "array", maxItems: 2000, items: {
      type: "object", additionalProperties: false, required: ["geschossId", "bezeichnung", "art", "flaecheM2"],
      properties: {
        id: UUID, geschossId: UUID, bezeichnung: { type: "string", minLength: 1, maxLength: 200 }, art: { type: "string", maxLength: 50 },
        flaecheM2: { type: ["number", "null"], exclusiveMinimum: 0 }, layoutManuell: RECHTECK,
        heizungAusnahme: { type: "object", additionalProperties: false, properties: HEIZ },
        heizungWirksam: { type: "object" },
      } } },
    bauteile: { type: "array", maxItems: 10000, items: {
      type: "object", additionalProperties: false, required: ["katalogId", "standort", "menge", "status", "versorgt"],
      properties: {
        id: UUID, katalogId: { type: "string", maxLength: 100 },
        standort: { type: "object", additionalProperties: false, properties: { einheitId: UUID, einheitIndex: INDEX, geschossId: UUID } },
        menge: { type: ["number", "null"] }, // Ganzzahl und Bereich prueft pruefung.ts (422 menge_ungueltig)
        status: { type: "string", enum: ["vorgeschlagen", "bestaetigt"] },
        hersteller: TEXT, typ: TEXT, baujahr: { type: ["integer", "null"], minimum: 1800, maximum: 2100 },
        positionManuell: { type: ["object", "null"], additionalProperties: false, required: ["x", "z"], properties: { x: { type: "number" }, z: { type: "number" } } },
        versorgt: { type: "array", maxItems: 2000, items: VERWEIS },
      } } },
  },
};
