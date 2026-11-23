import { describe, expect, it } from "vitest";
import { akteZeilen, ampelJeSymbol, balken, chf, eingabeZahl, jahre, legende, planZeilen, preisEingabe, preisText } from "./ansicht";
import type { LdStand } from "./typen";

const stand: LdStand = {
  gebaeudeId: "g", stand: 3, heizungBaujahr: 2008, typen: [],
  bauteile: [
    { id: "a", katalogId: "heizung.verteiler", menge: 1, baujahr: null, hersteller: null, typ: null, ort: "EG · Technik", akte: null },
    { id: "b", katalogId: "heizung.heizkoerper", menge: 10, baujahr: 2020, hersteller: "Zehnder", typ: null, ort: "OG1 · Büro", akte: { zustand: null, lebensdauerJahre: null, stueckpreis: 800, quellePreis: "kunde", notiz: null, preisQuelle: null } },
    { id: "c", katalogId: "heizung.heizkoerper", menge: 2, baujahr: null, hersteller: null, typ: null, ort: "OG1 · Büro", akte: null },
  ],
  ergebnis: { stichtag: 2026, zaehler: { gruen: 1, gelb: 0, rot: 1, grau: 1 }, summe5: { betrag: 12500, ohnePreis: 1 },
    jahre: Array.from({ length: 10 }, (_, i) => ({ jahr: 2026 + i, betrag: i === 0 ? 12500 : i === 4 ? 25000 : 0, ohnePreis: i === 0 ? 1 : 0, anzahl: i === 0 ? 2 : i === 4 ? 1 : 0 })),
    bauteile: [
      { id: "a", ampel: "rot", baujahr: 2008, ersatzjahr: 2026, restjahre: 0, lebensdauer: 30, stueckpreis: null, kosten: null, mengeAngenommen: false,
        quellen: { baujahr: "gebaeude", lebensdauer: "planora", preis: null, preisHerkunft: null } },
      { id: "b", ampel: "gruen", baujahr: 2020, ersatzjahr: 2060, restjahre: 34, lebensdauer: 40, stueckpreis: 800, kosten: 8000, mengeAngenommen: false,
        quellen: { baujahr: "bauteil", lebensdauer: "planora", preis: "bauteil", preisHerkunft: "kunde" } },
      { id: "c", ampel: "grau", baujahr: null, ersatzjahr: null, restjahre: null, lebensdauer: 40, stueckpreis: null, kosten: null, mengeAngenommen: false,
        quellen: { baujahr: null, lebensdauer: "planora", preis: null, preisHerkunft: null } },
    ] },
};

describe("Ansicht Lebensdauer", () => {
  it("chf mit Apostroph", () => { expect(chf(12500)).toBe("CHF 12'500"); expect(chf(0)).toBe("CHF 0"); });
  it("chf zeigt Rappen nur bei nicht ganzzahligem Betrag", () => {
    expect(chf(450.5)).toBe("CHF 450.50"); expect(chf(1200.5)).toBe("CHF 1'200.50"); expect(chf(1200.004)).toBe("CHF 1'200"); expect(chf(12500)).toBe("CHF 12'500");
  });
  it("schlechteste Ampel je Symbol, grau vor gruen", () => {
    const m = ampelJeSymbol(stand, [{ schluessel: "s1", bauteilIds: ["a"] }, { schluessel: "s2", bauteilIds: ["b", "c"] }, { schluessel: "s3", bauteilIds: ["x"] }]);
    expect(m.get("s1")).toBe("rot"); expect(m.get("s2")).toBe("grau"); expect(m.has("s3")).toBe(false);
  });
  it("Akte-Zeilen mit Quellen und fehlendem Preis", () => {
    const [a, b] = akteZeilen(stand, ["a", "b"]);
    expect(a).toMatchObject({ ampel: "rot", ersatzjahr: "2026", kosten: "–", baujahr: { wert: "2008", quelle: "Gebäudestandard" },
      lebensdauer: { wert: "30 Jahre", quelle: "Planora-Richtwert" }, preis: { fehlt: true, quelle: "Preis fehlt" } });
    expect(b).toMatchObject({ kosten: "CHF 8'000", preis: { wert: "CHF 800", quelle: "Eigene Angabe", fehlt: false }, baujahr: { quelle: "Eigene Angabe" } });
  });
  it("1 Jahr im Singular, sonst Jahre", () => {
    expect(jahre(1)).toBe("1 Jahr"); expect(jahre(0)).toBe("0 Jahre"); expect(jahre(12)).toBe("12 Jahre");
    const s1: LdStand = { ...stand, ergebnis: { ...stand.ergebnis, bauteile: stand.ergebnis.bauteile.map((b) => b.id === "b" ? { ...b, restjahre: 1, lebensdauer: 1 } : b) } };
    expect(akteZeilen(s1, ["b"])[0]).toMatchObject({ restjahre: "1 Jahr", lebensdauer: { wert: "1 Jahr" } });
    expect(akteZeilen(stand, ["b"])[0]).toMatchObject({ restjahre: "34 Jahre", lebensdauer: { wert: "40 Jahre" } });
  });
  it("Legende mit Zaehlern und unvollstaendiger Summe", () => {
    expect(legende(stand)).toEqual({ zaehler: { gruen: 1, gelb: 0, rot: 1, grau: 1 }, summe5: "CHF 12'500", ohnePreis: 1 });
  });
  it("10 Balken, Anteil relativ zum Maximum", () => {
    const b = balken(stand);
    expect(b).toHaveLength(10);
    expect(b[0]).toMatchObject({ jahr: 2026, anteil: 0.5, ohnePreis: 1, text: "CHF 12'500" });
    expect(b[4].anteil).toBe(1);
    expect(b[1]).toMatchObject({ anteil: 0, text: "–" });
  });
  it("Planliste nach Ersatzjahr, ohne Baujahr zuletzt, Jahresfilter mit Ueberfaelligen im Stichtagsjahr", () => {
    const n = (k: string) => k;
    expect(planZeilen(stand, n, null).map((z) => z.id)).toEqual(["a", "b", "c"]);
    expect(planZeilen(stand, n, 2026).map((z) => z.id)).toEqual(["a"]);
    expect(planZeilen(stand, n, 2027)).toEqual([]);
  });
  it("Preistext mit Tausendertrenner", () => {
    expect(preisText(35000)).toBe("35'000"); expect(preisText(1200.5)).toBe("1'200.5"); expect(preisText(800)).toBe("800"); expect(preisText(null)).toBe("");
    expect(preisEingabe("35000")).toBe("35'000"); expect(preisEingabe("abc")).toBe("abc"); expect(preisEingabe("")).toBe("");
  });
  it("Zustand mit Wirkung aus Ersatzjahr abgeleitet", () => {
    const s2: LdStand = { ...stand, bauteile: stand.bauteile.map((b) => b.id === "a" ? { ...b, akte: { zustand: "schlecht", lebensdauerJahre: null, stueckpreis: null, quellePreis: null, notiz: null, preisQuelle: null } } : b),
      ergebnis: { ...stand.ergebnis, bauteile: stand.ergebnis.bauteile.map((b) => b.id === "a" ? { ...b, ersatzjahr: 2033, restjahre: 7 } : b) } };
    expect(akteZeilen(s2, ["a"])[0].zustand).toEqual({ text: "Schlecht", wirkung: "5 Jahre früher" });
    expect(akteZeilen(stand, ["b"])[0].zustand).toBeNull();
  });
  it("Zahleneingabe", () => {
    expect(eingabeZahl("", 1, 150)).toBeNull();
    expect(eingabeZahl("25", 1, 150)).toBe(25);
    expect(eingabeZahl("1'200.50", 0, 1e10)).toBe(1200.5);
    expect(eingabeZahl("0", 1, 150)).toBe("ungueltig");
    expect(eingabeZahl("abc", 1, 150)).toBe("ungueltig");
  });
});
