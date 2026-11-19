import { describe, it, expect } from "vitest";
import { erneuerungCsv, zelle } from "../src/lebensdauer/csv.js";
import { rechne } from "../src/lebensdauer/rechnung.js";

describe("CSV", () => {
  it("entschaerft Formeln und quotet Semikolon/Anfuehrungszeichen", () => {
    expect(zelle("=SUMME(A1)")).toBe("'=SUMME(A1)");
    expect(zelle("+41")).toBe("'+41");
    expect(zelle("a;b")).toBe('"a;b"');
    expect(zelle('Typ "X"')).toBe('"Typ ""X"""');
    expect(zelle(null)).toBe("");
    expect(zelle(1200.5)).toBe("1200.5");
  });
  it("BOM, Kopfzeile, eine Zeile je Bauteil, Jahresblock", () => {
    const bauteile = [{ id: "a", katalogId: "heizung.verteiler", menge: 1, baujahr: null, hersteller: "=Hack", typ: null, ort: "EG · Technik",
      akte: { zustand: "schlecht" as const, lebensdauerJahre: null, stueckpreis: 2500, quellePreis: "kunde" as const, notiz: null } }];
    const ergebnis = rechne({ stichtag: 2026, heizungBaujahr: 2008, typen: [], bauteile });
    const csv = erneuerungCsv({ gebaeudeId: "g", stand: 0, heizungBaujahr: 2008, typen: [], bauteile, ergebnis }, { "heizung.verteiler": "Heizungsverteiler" });
    const z = csv.split("\r\n");
    expect(csv.startsWith("﻿")).toBe(true);
    expect(z[0]).toBe("﻿Ort;Bauteil;Hersteller;Typ;Menge;Baujahr;Zustand;Lebensdauer;Ersatzjahr;Ampel;Stückpreis;Kosten;Quelle Preis");
    expect(z[1]).toBe("EG · Technik;Heizungsverteiler;'=Hack;;1;2008;schlecht;30;2033;gruen;2500;2500;kunde");
    expect(z).toContain("Jahr;Betrag;ohne Preis");
    expect(z.filter((l) => /^20\d\d;/.test(l))).toHaveLength(10);
  });
});
