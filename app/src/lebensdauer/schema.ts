const JAHR = { type: ["integer", "null"], minimum: 1800, maximum: 2100 };
const PREIS = { type: ["number", "null"], minimum: 0, maximum: 9999999999 };
const JAHRE = { type: ["integer", "null"], minimum: 1, maximum: 150 };
const UUID = { type: "string", pattern: "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$" };
export const LEBENSDAUER_SCHEMA = {
  type: "object", additionalProperties: false, required: ["stand"],
  properties: {
    stand: { type: "integer", minimum: 0 },
    heizungBaujahr: JAHR,
    bauteile: { type: "array", maxItems: 5000, items: { type: "object", additionalProperties: false, required: ["id"], properties: {
      id: UUID, baujahr: JAHR, zustand: { type: ["string", "null"], enum: ["gut", "mittel", "schlecht", "kritisch", null] },
      lebensdauerJahre: JAHRE, stueckpreis: PREIS, notiz: { type: ["string", "null"], maxLength: 2000 } } } },
    typen: { type: "array", maxItems: 200, items: { type: "object", additionalProperties: false, required: ["katalogId"], properties: {
      katalogId: { type: "string", maxLength: 100, pattern: "^[a-z0-9_.]+$" }, lMittel: JAHRE, stueckpreis: PREIS,
      gelbJahre: { type: ["integer", "null"], minimum: 0, maximum: 20 } } } },
  },
} as const;
