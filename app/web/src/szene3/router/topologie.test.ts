import { describe, expect, it } from "vitest";
import { alsBaum, type Kante } from "./topologie";

const k = (von: string, nach: string): Kante => ({ von, nach, art: "haupt" });

describe("alsBaum", () => {
  it("Kette bleibt vollstaendig", () => {
    expect(alsBaum([k("WP", "SP"), k("SP", "V")]).kanten).toHaveLength(2);
  });
  it("Zyklus wird verworfen", () => {
    const r = alsBaum([k("WP", "SP"), k("SP", "V"), k("V", "WP")]);
    expect(r.kanten).toHaveLength(2);
    expect(r.verworfen).toEqual([k("V", "WP")]);
  });
  it("zweiter Vorgaenger wird verworfen", () => {
    expect(alsBaum([k("A", "V"), k("B", "V")]).verworfen).toEqual([k("B", "V")]);
  });
  it("Selbstkante wird verworfen", () => {
    expect(alsBaum([k("A", "A")]).verworfen).toHaveLength(1);
  });
  it("leere Eingabe ergibt einen leeren Wald", () => {
    expect(alsBaum([])).toEqual({ kanten: [], verworfen: [] });
  });
  it("verbindet getrennte Teilbaeume und behaelt Reihenfolge und Metadaten", () => {
    const gruppe: Kante = { von: "B", nach: "C", art: "verteil", gruppeId: "g1" };
    const kanten = [k("A", "B"), k("D", "E"), gruppe, k("C", "D"), k("E", "A")];
    const vorher = structuredClone(kanten);
    const r = alsBaum(kanten);
    expect(r.kanten).toEqual(kanten.slice(0, 4));
    expect(r.kanten[2]).toBe(gruppe);
    expect(r.verworfen).toEqual([k("E", "A")]);
    expect(kanten).toEqual(vorher);
  });
  it("verworfene Kanten belegen keinen Vorgaenger", () => {
    const r = alsBaum([k("A", "B"), k("B", "A"), k("C", "A"), k("A", "B")]);
    expect(r.kanten).toEqual([k("A", "B"), k("C", "A")]);
    expect(r.verworfen).toEqual([k("B", "A"), k("A", "B")]);
  });
});
