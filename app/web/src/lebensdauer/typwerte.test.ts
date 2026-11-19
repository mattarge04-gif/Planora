import { describe, expect, it } from "vitest";
import { typKoerper, baujahrKoerper } from "./typwerte";

const stand: any = { stand: 2, heizungBaujahr: null, typen: [{ katalogId: "heizung.verteiler", lMittel: null, stueckpreis: 2500, quellePreis: "kunde", gelbJahre: null, standard: 30, bereich: { min: 23, max: 38 } }] };

describe("Typwerte", () => {
  it("nur Geaendertes, leer = null", () => {
    expect(typKoerper(stand, { "heizung.verteiler": { lMittel: "28", preis: "" } }))
      .toEqual({ body: { stand: 2, typen: [{ katalogId: "heizung.verteiler", lMittel: 28, stueckpreis: null }] } });
  });
  it("Fehler je Katalog-ID", () => {
    expect(typKoerper(stand, { "heizung.verteiler": { lMittel: "0", preis: "" } })).toEqual({ fehler: { "heizung.verteiler": "Lebensdauer 1 bis 150 Jahre" } });
  });
  it("Preisfehler nennt den Dezimalpunkt", () => {
    const r: any = typKoerper(stand, { "heizung.verteiler": { lMittel: "", preis: "1200,50" } });
    expect(r.fehler["heizung.verteiler"]).toContain("Dezimalpunkt");
  });
  it("Unveraendert ergibt leere Liste", () => {
    expect(typKoerper(stand, { "heizung.verteiler": { lMittel: "", preis: "2500" } })).toEqual({ body: { stand: 2, typen: [] } });
  });
  it("Baujahr-Standard", () => {
    expect(baujahrKoerper(stand, "2008")).toEqual({ body: { stand: 2, heizungBaujahr: 2008 } });
    expect(baujahrKoerper(stand, "")).toEqual({ body: { stand: 2, heizungBaujahr: null } });
    expect(baujahrKoerper(stand, "20")).toEqual({ fehler: "Jahr zwischen 1800 und 2100" });
  });
});
