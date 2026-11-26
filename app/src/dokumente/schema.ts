import { KATEGORIEN } from "./typ.js";
import { UUID } from "../welt/schema.js";
export const DATEI_QUERY = { type: "object", additionalProperties: false, properties: { download: { type: "string", enum: ["1"] } } } as const;
const U = UUID.pattern.slice(1, -1); // gleiches Muster wie in welt/schema.ts
export const ABLEGEN_QUERY = { type: "object", additionalProperties: false, properties: {
  kategorie: { type: "string", enum: [...KATEGORIEN] },
  bauteile: { type: "string", maxLength: 18_500, pattern: `^${U}(,${U})*$` },
  geschoss: UUID, einheit: UUID, allgemein: { type: "string", enum: ["1"] },
} } as const;
export const BAUTEILE_SCHEMA = { type: "object", additionalProperties: false, required: ["bauteilIds"],
  properties: { bauteilIds: { type: "array", maxItems: 500, items: UUID } } } as const;
export const KATEGORIE_SCHEMA = { type: "object", additionalProperties: false, required: ["kategorie"],
  properties: { kategorie: { type: "string", enum: [...KATEGORIEN] } } } as const;
const UUID_ODER_NULL = { type: ["string", "null"], pattern: UUID.pattern } as const;
export const ORT_SCHEMA = { type: "object", additionalProperties: false, required: ["geschossId", "einheitId", "allgemein"],
  properties: { geschossId: UUID_ODER_NULL, einheitId: UUID_ODER_NULL, allgemein: { type: "boolean" } } } as const;
