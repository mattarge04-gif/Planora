import { describe, expect, it } from "vitest";
import type { Welt } from "../../typen";
import { rohrnetzMitBefunden, type Rohrstueck } from "../netz";
import { ROHR } from "../technik";
import { TEST_KATALOG } from "./testKatalog";
import { zufallsWelt } from "./zufallsWelt";

/** Einbau der Direktverbindung in kantenNetz (Spec 10, Gesamtreview 15.11.: gezielte Tests). */
const dateien = import.meta.glob<Welt>("../../fixtures/muster-m2-beispiel.json", { eager: true, import: "default" });
const m2 = () => structuredClone(Object.values(dateien)[0]);
const EPS = 1e-6;
const id = (w: Welt, k: string) => w.symbole.find((s) => s.katalogId === k)!.schluessel;
const lauf = (n: Rohrstueck[], von: string, nach: string) =>
  n.filter((r) => r.daten.art === "haupt" && r.daten.von === von && r.daten.nach === nach).sort((a, b) => b.punkte.length - a.punkte.length);
const senkrecht = (a: number[], b: number[]) => Math.abs(a[0] - b[0]) < EPS && Math.abs(a[2] - b[2]) < EPS;

describe("Direktverbindung im Rohrnetz", () => {
  it("muendet als T in die bleibende Speicher-Steigleitung (Speicher -> Verteiler nutzt sie weiter)", () => {
    const w = m2(), wp = id(w, "heizung.waermepumpe"), sp = id(w, "heizung.speicher");
    const { stuecke, befunde } = rohrnetzMitBefunden(w, TEST_KATALOG, {});
    expect(befunde.filter((b) => b.hart)).toEqual([]);
    const teile = lauf(stuecke, wp, sp);
    const direkt = teile.find((r) => Math.max(...r.punkte.map((p) => p[1])) < 2.5)!;
    expect(direkt).toBeTruthy();
    const ende = direkt.punkte.at(-1)!;
    // Die Steigleitung am Speicher gehoert jetzt zur Verbindung Speicher -> Verteiler.
    const steig = stuecke.find((r) => r.daten.art === "haupt" && r.punkte.length >= 2 && senkrecht(r.punkte.at(-2)!, r.punkte.at(-1)!)
      && r.punkte.at(-1)![1] > 2.5 && senkrecht(r.punkte.at(-1)!, ende))!;
    const [a, b] = steig.punkte.slice(-2);
    // Ende liegt im Inneren der Steigleitung, nicht an ihrem Fuss.
    expect(senkrecht(ende, a)).toBe(true);
    expect(ende[1]).toBeGreaterThan(Math.min(a[1], b[1]) + EPS);
    expect(ende[1]).toBeLessThan(Math.max(a[1], b[1]) - EPS);
    // Stutzen der WP ohne Stummel: die Direktleitung beginnt am Stutzen mit dessen Radius.
    expect(direkt.startRadius).toBe(0.026);
  });

  it("kuerzt einen nicht geteilten Anschluss auf den Stummel und endet an dessen Fuss", () => {
    const w = m2(), wp = id(w, "heizung.waermepumpe"), sp = id(w, "heizung.speicher");
    w.symbole = w.symbole.filter((s) => s.katalogId !== "heizung.verteiler");
    const { stuecke, befunde } = rohrnetzMitBefunden(w, TEST_KATALOG, {});
    expect(befunde.filter((b) => b.hart)).toEqual([]);
    const teile = lauf(stuecke, wp, sp);
    expect(teile.every((r) => Math.max(...r.punkte.map((p) => p[1])) < 2.5)).toBe(true); // keine Steigleitung zur Decke
    const stummel = teile.find((r) => r.punkte.every((p) => Math.abs(p[1] - r.punkte[0][1]) < EPS) && r.punkte.length >= 2)!;
    const direkt = teile.find((r) => r !== stummel)!;
    expect(direkt.punkte.at(-1)).toEqual(stummel.punkte.at(-1));
    expect(direkt.endRadius).toBe(ROHR.haupt);
  });

  it("verwirft eine Direktleitung mit Pruefer-Befund (Zufallswelt 108: Lauf zurueck entlang des Stummels)", () => {
    const w = zufallsWelt(108);
    const { stuecke, befunde } = rohrnetzMitBefunden(w, TEST_KATALOG, {});
    expect(befunde.filter((b) => b.hart)).toEqual([]);
    const sp = lauf(stuecke, "SP", "V");
    expect(Math.max(...sp.flatMap((r) => r.punkte.map((p) => p[1])))).toBeGreaterThan(2.5); // ueber die Leitungsebene
  });
});
