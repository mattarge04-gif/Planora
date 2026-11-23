// [A] type: ["number","null"] im strict-Modus ist fuer number nicht bestaetigt (Task 1); Rueckfall waere anyOf.
const NUM_NULL = { type: ["number", "null"] } as const;
export const ANTWORT_SCHEMA = {
  type: "object", additionalProperties: false, required: ["vorschlaege"],
  properties: { vorschlaege: { type: "array", items: {
    type: "object", additionalProperties: false,
    required: ["position", "seite", "zitat", "materialNetto", "rabattText", "montageAnteil", "ersatzpreis", "rechenweg", "katalogId", "bauteilIds", "sicherheit"],
    properties: {
      position: { type: "string" }, seite: { type: "integer" }, zitat: { type: "string" },
      materialNetto: NUM_NULL, rabattText: { type: ["string", "null"] }, montageAnteil: NUM_NULL,
      ersatzpreis: { type: "number" }, rechenweg: { type: "string" },
      katalogId: { type: ["string", "null"] }, bauteilIds: { type: "array", items: { type: "string" } },
      sicherheit: { type: "string", enum: ["hoch", "mittel", "tief"] },
    } } } },
} as const;

const UUID_MUSTER = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$";
export const UEBERNEHMEN_SCHEMA = { type: "object", additionalProperties: false, required: ["bauteilIds", "alsTyppreis", "stand"],
  properties: { bauteilIds: { type: "array", maxItems: 500, items: { type: "string", pattern: UUID_MUSTER } }, alsTyppreis: { type: "boolean" },
    stand: { type: "integer", minimum: 0 }, ueberschreibeHandeingabe: { type: "boolean" } } } as const;
export const STAND_SCHEMA = { type: "object", additionalProperties: false, required: ["stand"], properties: { stand: { type: "integer", minimum: 0 } } } as const;
