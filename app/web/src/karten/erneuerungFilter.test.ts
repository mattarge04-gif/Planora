import { describe, expect, it } from "vitest";
import { erneuerungFilter, ohnePreis, trefferDetail, umschalten } from "./erneuerungFilter";
import type { LdErgebnisBauteil } from "../lebensdauer/typen";
import type { FilterStufe } from "../szene3/ampelFilter";

const bt = (id: string, ampel: LdErgebnisBauteil["ampel"], ersatzjahr: number | null, kosten: number | null): LdErgebnisBauteil => ({
  id, ampel, baujahr: ersatzjahr === null ? null : 2000, ersatzjahr, restjahre: null, lebensdauer: 30, stueckpreis: kosten, kosten,
  mengeAngenommen: false, quellen: { baujahr: null, lebensdauer: "planora", preis: null, preisHerkunft: null },
});
const ergebnis = { stichtag: 2026, bauteile: [
  bt("wp", "gelb", 2029, 30000),
  bt("p1", "rot", 2020, null), // überfällig, ohne Preis
  bt("p2", "rot", 2026, 900),
  bt("hk1", "gruen", 2050, null), // ohne Preis, aber erst 2050: zählt nicht
  bt("hk2", "grau", null, null),
  bt("hk3", "gruen", 2045, 800),
] };
const anlagen = [
  { schluessel: "WP", bauteilIds: ["wp"], geschossId: "ug" },
  { schluessel: "P1", bauteilIds: ["p1"], geschossId: "ug" },
  { schluessel: "P2", bauteilIds: ["p2"], geschossId: "eg" },
  { schluessel: "HK", bauteilIds: ["hk1", "hk2", "hk3"], geschossId: "og" },
];
const s = (...p: FilterStufe[]) => new Set(p);

describe("Legende als Filter", () => {
  it("ohne Preis wie summe5: fällig in fünf Jahren und ohne Kosten", () => {
    expect(ohnePreis({ kosten: null, ersatzjahr: 2020 }, 2026)).toBe(true);
    expect(ohnePreis({ kosten: null, ersatzjahr: 2030 }, 2026)).toBe(true);
    expect(ohnePreis({ kosten: null, ersatzjahr: 2031 }, 2026)).toBe(false);
    expect(ohnePreis({ kosten: null, ersatzjahr: null }, 2026)).toBe(false);
    expect(ohnePreis({ kosten: 5, ersatzjahr: 2026 }, 2026)).toBe(false);
  });
  it("nichts gewählt -> kein Filter", () => { expect(erneuerungFilter(ergebnis, anlagen, s())).toBeNull(); });
  it("Ersetzen: Treffer je Geschoss, bestes Geschoss bei Gleichstand das erste", () => {
    const f = erneuerungFilter(ergebnis, anlagen, s("rot"))!;
    expect([...f.filter.treffer]).toEqual(["P1", "P2"]);
    expect(f.filter.anhaenger.size).toBe(0);
    expect(f.jeGeschoss).toEqual(new Map([["ug", 1], ["eg", 1]]));
    expect(f.bestes).toBe("ug");
  });
  it("ODER: Ersetzen + ohne Preis, Anhänger nur für «Angaben fehlen»", () => {
    const f = erneuerungFilter(ergebnis, anlagen, s("ohnePreis", "rot"))!;
    expect(f.treffer.map((t) => [t.anlage.schluessel, t.gruende])).toEqual([["P1", ["rot", "ohnePreis"]], ["P2", ["rot"]]]);
    expect([...f.filter.anhaenger]).toEqual(["P1"]);
    expect([...f.filter.stufen].sort()).toEqual(["ohnePreis", "rot"]);
  });
  it("Anlage ist Treffer, wenn mindestens ein Bauteil passt; Zahl passender Bauteile", () => {
    const f = erneuerungFilter(ergebnis, anlagen, s("grau", "gruen"))!;
    expect(f.treffer).toHaveLength(1);
    expect(f.treffer[0]).toMatchObject({ anlage: { schluessel: "HK" }, gruende: ["gruen", "grau"], bauteile: 3 });
    expect([...f.filter.anhaenger]).toEqual(["HK"]);
    expect(f.bestes).toBe("og");
  });
  it("Sortierung dringendster Grund zuerst", () => {
    const f = erneuerungFilter(ergebnis, anlagen, s("gelb", "rot"))!;
    expect(f.treffer.map((t) => t.anlage.schluessel)).toEqual(["P1", "P2", "WP"]);
  });
  it("umschalten", () => {
    expect([...umschalten(s("rot"), "gelb")]).toEqual(["rot", "gelb"]);
    expect([...umschalten(s("rot"), "rot")]).toEqual([]);
  });
  it("Ersatzjahr (frühestes passendes) und zweite Zeile", () => {
    const f = erneuerungFilter(ergebnis, anlagen, s("ohnePreis", "rot", "grau"))!;
    const p1 = f.treffer.find((t) => t.anlage.schluessel === "P1")!, hk = f.treffer.find((t) => t.anlage.schluessel === "HK")!;
    expect(p1.ersatzjahr).toBe(2020);
    expect(hk.ersatzjahr).toBeNull();
    expect(trefferDetail(p1, "Gruppe Büro A")).toBe("Ersatz 2020 · Preis fehlt · Gruppe Büro A");
    expect(trefferDetail(hk, null)).toBe("Baujahr fehlt");
  });
});
