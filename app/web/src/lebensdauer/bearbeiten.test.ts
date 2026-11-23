import { describe, expect, it } from "vitest";
import { formularAus, koerperAus } from "./bearbeiten";
import type { LdStand } from "./typen";

const stand = { gebaeudeId: "g", stand: 4, heizungBaujahr: 2008, typen: [], ergebnis: { stichtag: 2026, bauteile: [], jahre: [], summe5: { betrag: 0, ohnePreis: 0 }, zaehler: { gruen: 0, gelb: 0, rot: 0, grau: 0 } },
  bauteile: [{ id: "a", katalogId: "heizung.verteiler", menge: 1, baujahr: null, hersteller: null, typ: null, ort: "EG",
    akte: { zustand: "mittel", lebensdauerJahre: null, stueckpreis: 2500, quellePreis: "kunde", notiz: null, preisQuelle: null } }] } as LdStand;

describe("Bearbeiten", () => {
  it("Formular aus Stand", () => {
    expect(formularAus(stand, "a")).toEqual({ baujahr: "", zustand: "mittel", lebensdauer: "", preis: "2'500", notiz: "" });
  });
  it("nur Geaendertes in den Body, leer = null", () => {
    const r = koerperAus(stand, "a", { baujahr: "2012", zustand: "mittel", lebensdauer: "", preis: "", notiz: "" });
    expect(r).toEqual({ body: { stand: 4, bauteile: [{ id: "a", baujahr: 2012, stueckpreis: null }] } });
  });
  it("Preis mit Tausendertrenner gilt als unveraendert", () => {
    expect(koerperAus(stand, "a", { baujahr: "", zustand: "mittel", lebensdauer: "", preis: "2500", notiz: "" })).toEqual({ body: { stand: 4, bauteile: [{ id: "a" }] } });
    expect(koerperAus(stand, "a", { baujahr: "", zustand: "mittel", lebensdauer: "", preis: "3'000", notiz: "" })).toEqual({ body: { stand: 4, bauteile: [{ id: "a", stueckpreis: 3000 }] } });
  });
  it("Fehler je Feld", () => {
    expect(koerperAus(stand, "a", { baujahr: "1700", zustand: "", lebensdauer: "0", preis: "x", notiz: "" }))
      .toEqual({ fehler: { baujahr: "Jahr zwischen 1800 und 2100", lebensdauer: "1 bis 150 Jahre", preis: "Betrag in CHF, z. B. 1200 oder 1'200.50" } });
  });
});
