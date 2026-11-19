import { describe, it, expect } from "vitest";
import { rechne, type RechenBauteil } from "../src/lebensdauer/rechnung.js";
import { STANDARD_LEBENSDAUER, lebensdauerBereich } from "../src/lebensdauer/standard.js";
import { KATALOG_V2 } from "../src/welt/katalog.v2.js";

const bt = (p: Partial<RechenBauteil> & { id: string }): RechenBauteil =>
  ({ katalogId: "heizung.umwaelzpumpe", menge: 1, baujahr: null, akte: null, ...p });
const akte = (a: Partial<NonNullable<RechenBauteil["akte"]>>) => ({ zustand: null, lebensdauerJahre: null, stueckpreis: null, quellePreis: null, ...a });

describe("Standard", () => {
  it("jede Katalog-ID v2 hat eine Lebensdauer, keine Preise", () => {
    for (const e of KATALOG_V2.eintraege) expect(STANDARD_LEBENSDAUER[e.id], e.id).toBeGreaterThan(0);
  });
  it("Bereich 0.75/1.25 gerundet", () => expect(lebensdauerBereich(20)).toEqual({ min: 15, max: 25 }));
});

describe("rechne", () => {
  const S = 2026;
  it("ohne Baujahr grau, keine Kosten im Plan", () => {
    const r = rechne({ stichtag: S, heizungBaujahr: null, bauteile: [bt({ id: "a" })], typen: [] });
    expect(r.bauteile[0]).toMatchObject({ ampel: "grau", ersatzjahr: null, kosten: null, quellen: { baujahr: null } });
    expect(r.zaehler.grau).toBe(1);
    expect(r.jahre.every((j) => j.anzahl === 0)).toBe(true);
  });
  it("Rangfolge Baujahr Bauteil > Gebaeude, Lebensdauer Bauteil > Typ > Standard", () => {
    const r = rechne({ stichtag: S, heizungBaujahr: 2010, typen: [{ katalogId: "heizung.umwaelzpumpe", lMittel: 15, stueckpreis: null, quellePreis: null, gelbJahre: null }], bauteile: [
      bt({ id: "std" , katalogId: "heizung.verteiler" }),
      bt({ id: "typ" }),
      bt({ id: "eig", baujahr: 2020, akte: akte({ lebensdauerJahre: 4 }) }),
    ] });
    const [std, typ, eig] = r.bauteile;
    expect(std).toMatchObject({ baujahr: 2010, ersatzjahr: 2040, quellen: { baujahr: "gebaeude", lebensdauer: "planora" } });
    expect(typ).toMatchObject({ ersatzjahr: 2025, quellen: { lebensdauer: "typ" } });
    expect(eig).toMatchObject({ baujahr: 2020, ersatzjahr: 2024, quellen: { baujahr: "bauteil", lebensdauer: "bauteil" } });
  });
  it("Ampel: rot <= Stichtag, gelb <= Stichtag+3, sonst gruen; Schwelle je Typ", () => {
    const r = rechne({ stichtag: S, heizungBaujahr: null, typen: [{ katalogId: "heizung.wmz", lMittel: null, stueckpreis: null, quellePreis: null, gelbJahre: 0 }], bauteile: [
      bt({ id: "rot", baujahr: 2014 }),   // 2014+12 = 2026
      bt({ id: "gelb", baujahr: 2017 }),  // 2029
      bt({ id: "gruen", baujahr: 2018 }), // 2030
      bt({ id: "wmz", katalogId: "heizung.wmz", baujahr: 2017 }), // 2027, Schwelle 0 -> gruen
    ] });
    expect(r.bauteile.map((b) => b.ampel)).toEqual(["rot", "gelb", "gruen", "gruen"]);
  });
  it("Zustand zieht ab: mittel -2, schlecht -5, kritisch = Stichtag", () => {
    const r = rechne({ stichtag: S, heizungBaujahr: 2020, typen: [], bauteile: [
      bt({ id: "m", akte: akte({ zustand: "mittel" }) }), bt({ id: "s", akte: akte({ zustand: "schlecht" }) }),
      bt({ id: "k", akte: akte({ zustand: "kritisch" }) }), bt({ id: "g", akte: akte({ zustand: "gut" }) }),
    ] });
    expect(r.bauteile.map((b) => b.ersatzjahr)).toEqual([2030, 2027, 2026, 2032]);
    expect(r.bauteile[2].ampel).toBe("rot");
  });
  it("Kosten Menge x Preis, Preis Bauteil > Typ, ohne Preis null und gezaehlt", () => {
    const r = rechne({ stichtag: S, heizungBaujahr: 2016, typen: [{ katalogId: "heizung.umwaelzpumpe", lMittel: null, stueckpreis: 900, quellePreis: "kunde", gelbJahre: null }], bauteile: [
      bt({ id: "typ", menge: 3 }),
      bt({ id: "eig", menge: 2, akte: akte({ stueckpreis: 1000, quellePreis: "kunde" }) }),
      bt({ id: "los", katalogId: "heizung.wmz", menge: 4 }),
      bt({ id: "unbek", menge: null }),
    ] });
    const [typ, eig, los, unbek] = r.bauteile;
    expect(typ).toMatchObject({ kosten: 2700, quellen: { preis: "typ", preisHerkunft: "kunde" } });
    expect(eig).toMatchObject({ kosten: 2000, quellen: { preis: "bauteil" } });
    expect(los).toMatchObject({ kosten: null, stueckpreis: null, quellen: { preis: null } });
    expect(unbek).toMatchObject({ kosten: 900, mengeAngenommen: true });
  });
  it("Jahressummen: 10 Jahre ab Stichtag, Ueberfaelliges im Stichtagsjahr, Summe 5 J.", () => {
    const r = rechne({ stichtag: S, heizungBaujahr: null, typen: [{ katalogId: "heizung.umwaelzpumpe", lMittel: null, stueckpreis: 100, quellePreis: "kunde", gelbJahre: null }], bauteile: [
      bt({ id: "alt", baujahr: 1990 }),          // 2002 -> 2026
      bt({ id: "j2", baujahr: 2016 }),           // 2028
      bt({ id: "j6", baujahr: 2020 }),           // 2032 (ausserhalb 5 J.)
      bt({ id: "fern", baujahr: 2025 }),         // 2037 (ausserhalb 10 J.)
      bt({ id: "los", katalogId: "heizung.wmz", baujahr: 2017 }), // 2027, ohne Preis
    ] });
    expect(r.jahre.map((j) => j.jahr)).toEqual([2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035]);
    expect(r.jahre[0]).toEqual({ jahr: 2026, betrag: 100, ohnePreis: 0, anzahl: 1 });
    expect(r.jahre[1]).toEqual({ jahr: 2027, betrag: 0, ohnePreis: 1, anzahl: 1 });
    expect(r.jahre[2].betrag).toBe(100);
    expect(r.jahre[6].betrag).toBe(100);
    expect(r.summe5).toEqual({ betrag: 200, ohnePreis: 1 });
    expect(r.jahre.reduce((s, j) => s + j.anzahl, 0)).toBe(4);
  });
});
