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
