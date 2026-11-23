import { KATEGORIEN } from "./typ.js";
export const DATEI_QUERY = { type: "object", additionalProperties: false, properties: { download: { type: "string", enum: ["1"] } } } as const;
export const ABLEGEN_QUERY = { type: "object", additionalProperties: false, properties: {
  kategorie: { type: "string", enum: [...KATEGORIEN] },
} } as const;
