import { describe, expect, it } from "vitest";
import type { Welt } from "../../typen";
import { rohrnetz } from "../netz";
import { geraeteKoerper } from "./koerper";
import { alsPrueflinien, pruefen } from "./pruefer";
import { TEST_KATALOG } from "./testKatalog";
import { zufallsWelt } from "./zufallsWelt";

const dateien = import.meta.glob<Welt>("../../fixtures/muster-*.json", { eager: true, import: "default" });

/** Misst Befunde je Regel; aendert nichts. Ab Task 8 durch harte Zusicherungen ersetzt. */
describe("Ist-Messung Leitungsfuehrung", () => {
  it("zaehlt Befunde in Mustern und 200 Zufallswelten", () => {
    const zaehler: Record<string, number> = {};
    const welten = [...Object.values(dateien).map((w) => structuredClone(w)), ...Array.from({ length: 200 }, (_, i) => zufallsWelt(i + 1))];
    for (const w of welten) {
      for (const b of pruefen(alsPrueflinien(rohrnetz(w, TEST_KATALOG, {})), geraeteKoerper(w, TEST_KATALOG))) zaehler[b.regel] = (zaehler[b.regel] ?? 0) + 1;
    }
    console.table(zaehler);
    expect(welten.length).toBe(Object.keys(dateien).length + 200);
  });
});
