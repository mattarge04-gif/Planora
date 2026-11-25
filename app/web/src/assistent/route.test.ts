import { describe, it, expect } from "vitest";
import { seiteAusPfad, seitenPfad } from "./route";

const ID = "0b6c7d1e-2f3a-4b5c-8d9e-0f1a2b3c4d5e";
describe("Gebäudeseiten in der Adresse (D1)", () => {
  it("Pfad hin und zurück; unbekannt oder ohne UUID -> null", () => {
    for (const art of ["twin", "plan", "dokumente"] as const) expect(seiteAusPfad(seitenPfad({ art, gebaeudeId: ID }))).toEqual({ art, gebaeudeId: ID });
    expect([seitenPfad({ art: "twin", gebaeudeId: ID }), seitenPfad({ art: "plan", gebaeudeId: ID })]).toEqual([`/gebaeude/${ID}`, `/gebaeude/${ID}/erneuerung`]);
    expect([seiteAusPfad("/gebaeude/neu"), seiteAusPfad(`/gebaeude/${ID}/assistent`), seiteAusPfad("/gebaeude/x/dokumente"), seiteAusPfad("/")]).toEqual([null, null, null, null]);
  });
});
