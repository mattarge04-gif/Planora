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
      akte: { zustand: "schlecht" as const, lebensdauerJahre: null, stueckpreis: 2500, quellePreis: "kunde" as const, notiz: null, preisQuelle: null } }];
    const ergebnis = rechne({ stichtag: 2026, heizungBaujahr: 2008, typen: [], bauteile });
    const csv = erneuerungCsv({ gebaeudeId: "g", stand: 0, heizungBaujahr: 2008, typen: [], bauteile, ergebnis }, { "heizung.verteiler": "Heizungsverteiler" });
    const z = csv.split("\r\n");
    expect(csv.startsWith("﻿")).toBe(true);
    expect(z[0]).toBe("﻿Ort;Bauteil;Hersteller;Typ;Menge;Baujahr;Zustand;Lebensdauer;Ersatzjahr;Ampel;Stückpreis;Kosten;Quelle Preis");
    expect(z[1]).toBe("EG · Technik;Heizungsverteiler;'=Hack;;1;2008;Schlecht;30;2033;In Ordnung;2500;2500;Eigene Angabe");
    expect(z).toContain("Jahr;Betrag;ohne Preis");
    expect(z.filter((l) => /^20\d\d;/.test(l))).toHaveLength(10);
  });
  it("Umlaute-Namen und Textspalten fuer Ampel und Quelle", () => {
    const mk = (id: string, katalogId: string, baujahr: number | null, quellePreis: "kunde" | "dokument") => ({ id, katalogId, menge: 1, baujahr, hersteller: null, typ: null, ort: "EG",
      akte: { zustand: "kritisch" as const, lebensdauerJahre: null, stueckpreis: 100, quellePreis, notiz: null, preisQuelle: null } });
    const bauteile = [mk("a", "heizung.waermepumpe", 2000, "dokument"), mk("b", "heizung.oelkessel", null, "kunde"), mk("c", "heizung.fernwaerme_uebergabe", 2025, "kunde")];
    const ergebnis = rechne({ stichtag: 2026, heizungBaujahr: null, typen: [], bauteile });
    const csv = erneuerungCsv({ gebaeudeId: "g", stand: 0, heizungBaujahr: null, typen: [], bauteile, ergebnis }, { "heizung.waermepumpe": "Waermepumpe" });
    expect(csv).toContain(";Wärmepumpe;");
    expect(csv).toContain(";Ölkessel;");
    expect(csv).toContain(";Fernwärme-Übergabe;");
    expect(csv).toContain("Ersetzen;100;100;Aus Dokument");
    expect(csv).toContain("Baujahr fehlt");
    expect(csv).toMatch(/(In Ordnung|Bald ersetzen|Ersetzen);100;100;Eigene Angabe/);
    expect(csv).toContain("Kritisch");
  });
  it("Fundstelle: Dateiname und Seite bzw. Dokument geloescht", () => {
    const mk = (id: string, preisQuelle: { dokumentId: string | null; dateiname: string | null; seite: number | null }) => ({ id, katalogId: "heizung.waermepumpe", menge: 1, baujahr: 2000, hersteller: null, typ: null, ort: "EG",
      akte: { zustand: null, lebensdauerJahre: null, stueckpreis: 100, quellePreis: "dokument" as const, notiz: null, preisQuelle } });
    const bauteile = [mk("a", { dokumentId: "d", dateiname: "o1.pdf", seite: 3 }), mk("b", { dokumentId: null, dateiname: null, seite: null })];
    const ergebnis = rechne({ stichtag: 2026, heizungBaujahr: null, typen: [], bauteile });
    const csv = erneuerungCsv({ gebaeudeId: "g", stand: 0, heizungBaujahr: null, typen: [], bauteile, ergebnis }, {});
    expect(csv).toContain(";Dokument: o1.pdf, S. 3");
    expect(csv).toContain(";Dokument (gelöscht)");
  });
});
