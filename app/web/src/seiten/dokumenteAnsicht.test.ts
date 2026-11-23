import { describe, expect, it } from "vitest";
import { alleSicherenText, datum, fuerBauteil, kandidaten, sortiert, startAuswahl, teileDateien, umfang } from "./dokumenteAnsicht";
import type { LdStand } from "../lebensdauer/typen";
import type { DokumentZeile, Uebersicht, VorschlagZeile } from "../preisdokument/typen";

const vz = (o: Partial<VorschlagZeile> & { id: string }): VorschlagZeile => ({
  position: "Pos", seite: 1, zitat: "z", materialNetto: null, rabattText: null, montageAnteil: null, ersatzpreis: 100, rechenweg: "",
  katalogId: "heizung.umwaelzpumpe", bauteilIds: [], fehlendeBauteile: [], sicherheit: "hoch", status: "offen", alsTyppreis: false, ...o,
});
const dz = (o: Partial<DokumentZeile> & { id: string }): DokumentZeile => ({
  dateiname: "a.pdf", groesse: 1, seiten: 1, hochgeladenAm: "2026-11-22T10:00:00.000Z", status: "fertig", fehler: null, vorschlaege: [], ...o,
});
const u = (dokumente: DokumentZeile[]): Uebersicht => ({ dokumente, darfAendern: true, auslesen: "an", budget: { verbrauchtUsd: 0, limitUsd: 20 }, stand: 1 });

const bt = (id: string, katalogId: string, ort: string, akte: LdStand["bauteile"][number]["akte"] = null) =>
  ({ id, katalogId, ort, menge: 1, baujahr: null, hersteller: null, typ: null, akte });
const eb = (id: string, stueckpreis: number | null, preis: "bauteil" | "typ" | null, herkunft: "kunde" | "dokument" | null) =>
  ({ id, ampel: "gruen" as const, baujahr: 2008, ersatzjahr: 2030, restjahre: 4, lebensdauer: 22, stueckpreis, kosten: stueckpreis, mengeAngenommen: false,
    quellen: { baujahr: "bauteil" as const, lebensdauer: "planora" as const, preis, preisHerkunft: herkunft } });
const akte = (stueckpreis: number, quellePreis: "kunde" | "dokument") => ({ zustand: null, lebensdauerJahre: null, stueckpreis, quellePreis, notiz: null, preisQuelle: null });

const stand = {
  gebaeudeId: "g", stand: 1, heizungBaujahr: null, typen: [],
  bauteile: [bt("p2", "heizung.umwaelzpumpe", "UG1 · HK Büro B", akte(650, "kunde")), bt("p1", "heizung.umwaelzpumpe", "UG1 · HK Büro A"), bt("h1", "heizung.heizkoerper", "EG · Büro A")],
  ergebnis: { stichtag: 2026, bauteile: [eb("p2", 650, "bauteil", "kunde"), eb("p1", null, null, null), eb("h1", 800, "typ", "kunde")], jahre: [], summe5: { betrag: 0, ohnePreis: 1 }, zaehler: { gruen: 3, gelb: 0, rot: 0, grau: 0 } },
} as LdStand;

describe("kandidaten", () => {
  it("liefert Bauteile gleichen Typs nach Ort mit bisherigem Preis", () => {
    const k = kandidaten(stand, "heizung.umwaelzpumpe", () => "Umwälzpumpe");
    expect(k.map((x) => x.id)).toEqual(["p1", "p2"]);
    expect(k[0]).toMatchObject({ name: "Umwälzpumpe", bisher: "Preis fehlt", hand: false });
    expect(k[1]).toMatchObject({ bisher: "CHF 650, von Hand", hand: true });
  });
  it("ist leer ohne Typ oder Stand", () => {
    expect(kandidaten(stand, null, String)).toEqual([]);
    expect(kandidaten(null, "heizung.umwaelzpumpe", String)).toEqual([]);
  });
  it("nennt Typwerte", () => expect(kandidaten(stand, "heizung.heizkoerper", String)[0].bisher).toBe("CHF 800, Typwert"));
});

describe("fuerBauteil und startAuswahl", () => {
  const zug = vz({ id: "zug", bauteilIds: ["p1"] });
  const typGleich = vz({ id: "typ", bauteilIds: ["p2"] });
  const fremd = vz({ id: "fremd", katalogId: "heizung.heizkoerper", bauteilIds: ["h1"] });
  const erledigt = vz({ id: "erl", bauteilIds: ["p2"], status: "verworfen" });
  const x = u([dz({ id: "d1", vorschlaege: [erledigt, typGleich, fremd, zug] }), dz({ id: "d2", vorschlaege: [fremd] })]);

  it("zeigt zugeordnete und offene Vorschlaege desselben Typs, offene zuerst, ohne leere Dokumente", () => {
    const g = fuerBauteil(x, "p1", "heizung.umwaelzpumpe");
    expect(g).toHaveLength(1);
    expect(g[0].vorschlaege.map((v) => v.id)).toEqual(["typ", "zug"]);
  });
  it("waehlt im Filter das gesuchte Bauteil zusaetzlich vor, ohne fehlende Bauteile", () => {
    expect(startAuswahl(typGleich, { bauteilId: "p1", katalogId: "heizung.umwaelzpumpe" })).toEqual(["p2", "p1"]);
    expect(startAuswahl(vz({ id: "f", bauteilIds: ["p1", "weg"], fehlendeBauteile: ["weg"] }), null)).toEqual(["p1"]);
    expect(startAuswahl(fremd, { bauteilId: "p1", katalogId: "heizung.umwaelzpumpe" })).toEqual(["h1"]);
  });
  it("sortiert offene vor entschiedenen", () => expect(sortiert([erledigt, zug]).map((v) => v.id)).toEqual(["zug", "erl"]));
});

describe("Texte", () => {
  it("meldet Ergebnis von Alle sicheren", () => {
    expect(alleSicherenText(3, 0)).toBe("3 Preise übernommen.");
    expect(alleSicherenText(3, 1)).toBe("2 Preise übernommen, 1 übersprungen (von Hand erfasster Preis). Einzeln prüfen und übernehmen.");
    expect(alleSicherenText(1, 0)).toBe("1 Preis übernommen.");
  });
  it("formatiert Datum und Umfang", () => {
    expect(datum("2026-11-22T23:30:00.000Z")).toBe("23.11.2026");
    expect(datum("x")).toBe("–");
    expect(umfang({ seiten: 1, groesse: 500 })).toBe("1 Seite, 1 kB");
    expect(umfang({ seiten: 3, groesse: 2.5 * 1024 * 1024 })).toBe("3 Seiten, 2.5 MB");
  });
  it("legt nur PDFs ab", () => {
    const r = teileDateien([{ name: "a.pdf", type: "" }, { name: "b.PDF", type: "" }, { name: "c.docx", type: "application/msword" }, { name: "d", type: "application/pdf" }]);
    expect(r.pdf.map((f) => f.name)).toEqual(["a.pdf", "b.PDF", "d"]);
    expect(r.abgelehnt.map((f) => f.name)).toEqual(["c.docx"]);
  });
});

describe("kandidaten am gleichen Ort", () => {
  it("nummeriert Bauteile mit gleichem Ort", () => {
    const s = { ...stand, bauteile: [bt("a", "heizung.ventil_3weg", "UG1 · Zentrale"), bt("b", "heizung.ventil_3weg", "UG1 · Zentrale")] } as LdStand;
    expect(kandidaten(s, "heizung.ventil_3weg", String).map((k) => k.ort)).toEqual(["UG1 · Zentrale, Nr. 1", "UG1 · Zentrale, Nr. 2"]);
  });
});
