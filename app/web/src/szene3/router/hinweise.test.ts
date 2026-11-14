import { describe, expect, it } from "vitest";
import type { Welt } from "../../typen";
import { leitungsHinweise } from "./hinweise";
import { TEST_KATALOG } from "./testKatalog";

const dateien = import.meta.glob<Welt>("../../fixtures/muster-*.json", { eager: true, import: "default" });

describe("leitungsHinweise", () => {
  it("saubere Muster: kein Hinweis", () => {
    for (const w of Object.values(dateien)) expect(leitungsHinweise(structuredClone(w), TEST_KATALOG)).toEqual([]);
  });
  it("erzwungener Konflikt: ein Hinweis mit Umlaut-Text und Geschossziel", () => {
    // Erstes Muster mit Speicher und Verteiler (m1 hat keinen Speicher; der Test waere dort leer).
    const w = structuredClone(Object.values(dateien).find((x) => ["heizung.speicher", "heizung.verteiler"].every((id) => x.symbole.some((s) => s.katalogId === id)))!);
    const v = w.symbole.find((s) => s.katalogId === "heizung.verteiler")!;
    const sp = w.symbole.find((s) => s.katalogId === "heizung.speicher")!;
    sp.position = { ...v.position }; // Speicher in den Verteiler geschoben -> Geraetekonflikt
    const h = leitungsHinweise(w, TEST_KATALOG);
    expect(h).toHaveLength(1);
    expect(h[0].text).toContain("Leitungsführung unsauber");
    expect(h[0].ziel?.geschossId).toBeTruthy();
  });
});
