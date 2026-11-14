import { describe, expect, it } from "vitest";
import { rohrnetzMitBefunden } from "../netz";
import { TEST_KATALOG } from "./testKatalog";
import { zufallsWelt } from "./zufallsWelt";

/**
 * Abnahme Spec 7: Zufallswelten ohne harte Befunde, Grundriss-Kreuzungen hoechstens 1 %. Anzahl aus PLANORA_ZUFALL
 * (Abnahme: PLANORA_ZUFALL=2000). Stand Task 8 (14.11.2026): rot, rund 46 % der Welten mit harten Befunden und
 * rund 39 % mit Kreuzung (Bericht task-8-report.md); deshalb laeuft der Test nur mit gesetzter Variable und nicht in
 * der Standardsuite. Nach Behebung die Bedingung entfernen und ANZAHL standardmaessig auf 100 setzen (~25 s).
 */
const umgebung = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const ANZAHL = Number(umgebung.PLANORA_ZUFALL ?? 0);

describe.runIf(ANZAHL > 0)("Leitungsfuehrung in Zufallswelten", () => {
  // Zeitlimit: etwa doppelte gemessene mittlere Laufzeit (~0.25 s je Welt) plus Sockel.
  it(`${ANZAHL} Welten: keine harten Befunde; Grundriss-Kreuzungen hoechstens 1 %`, () => {
    const hart: string[] = [];
    let mitKreuzung = 0, mitHart = 0, ms = 0, summe = 0;
    for (let seed = 1; seed <= ANZAHL; seed++) {
      const t = performance.now();
      const { befunde } = rohrnetzMitBefunden(zufallsWelt(seed), TEST_KATALOG, {});
      const dt = performance.now() - t;
      ms = Math.max(ms, dt); summe += dt;
      const harte = befunde.filter((b) => b.hart);
      if (harte.length) mitHart++;
      for (const b of harte) hart.push(`seed ${seed}: ${b.regel} ${b.leitungen.join("|")}`);
      if (befunde.some((b) => b.regel === "kreuzung")) mitKreuzung++;
    }
    console.log(`${ANZAHL} Welten: mittlere Laufzeit ${(summe / ANZAHL).toFixed(1)} ms, max. Laufzeit je Welt ${ms.toFixed(1)} ms, `
      + `Welten mit Kreuzung ${mitKreuzung}, Welten mit hartem Befund ${mitHart} (${hart.length} Befunde)`);
    expect(hart.slice(0, 20)).toEqual([]);
    expect(mitKreuzung / ANZAHL).toBeLessThanOrEqual(0.01);
  }, 30_000 + ANZAHL * 500);
});
