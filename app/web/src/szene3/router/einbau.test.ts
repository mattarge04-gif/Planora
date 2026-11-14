import { describe, expect, it } from "vitest";
import type { Welt } from "../../typen";
import { rohrnetzMitBefunden } from "../netz";
import { TEST_KATALOG } from "./testKatalog";

const dateien = import.meta.glob<Welt>("../../fixtures/muster-*.json", { eager: true, import: "default" });

describe("Router im Rohrnetz", () => {
  for (const [pfad, w] of Object.entries(dateien)) {
    it(`${pfad.split("/").at(-1)}: keine harten Befunde, keine Grundriss-Kreuzung`, () => {
      const { befunde } = rohrnetzMitBefunden(structuredClone(w), TEST_KATALOG, {});
      expect(befunde.map((b) => `${b.regel}:${b.leitungen.join("|")}`)).toEqual([]);
    });
  }
  it("deterministisch", () => {
    const w = Object.values(dateien)[0];
    expect(JSON.stringify(rohrnetzMitBefunden(structuredClone(w), TEST_KATALOG, {}).stuecke))
      .toBe(JSON.stringify(rohrnetzMitBefunden(structuredClone(w), TEST_KATALOG, {}).stuecke));
  });
});
