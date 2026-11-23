import { KATEGORIEN } from "./typ.js";
import { UUID } from "../welt/schema.js";
export const DATEI_QUERY = { type: "object", additionalProperties: false, properties: { download: { type: "string", enum: ["1"] } } } as const;
const U = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"; // gleiches Muster wie UUID in welt/schema.ts
export const ABLEGEN_QUERY = { type: "object", additionalProperties: false, properties: {
  kategorie: { type: "string", enum: [...KATEGORIEN] },
  bauteile: { type: "string", maxLength: 18_500, pattern: `^${U}(,${U})*$` },
} } as const;
export const BAUTEILE_SCHEMA = { type: "object", additionalProperties: false, required: ["bauteilIds"],
  properties: { bauteilIds: { type: "array", maxItems: 500, items: UUID } } } as const;
export const KATEGORIE_SCHEMA = { type: "object", additionalProperties: false, required: ["kategorie"],
  properties: { kategorie: { type: "string", enum: [...KATEGORIEN] } } } as const;
