import { describe, expect, it } from "vitest";
import { franken, gruppiere, laeuftNoch, offeneSichere, statusText, zuordnungText } from "./ansicht";
import type { DokumentZeile, Uebersicht, VorschlagZeile } from "./typen";

const vz = (o: Partial<VorschlagZeile> & { id: string }): VorschlagZeile => ({
  position: "Pos", seite: 1, zitat: "z", materialNetto: null, rabattText: null, montageAnteil: null, ersatzpreis: 100, rechenweg: "",
  katalogId: "pumpe", bauteilIds: [], fehlendeBauteile: [], sicherheit: "hoch", status: "offen", alsTyppreis: false, ...o,
});
const dz = (o: Partial<DokumentZeile> & { id: string }): DokumentZeile => ({
  dateiname: "a.pdf", groesse: 1, seiten: 1, hochgeladenAm: "2026-11-22T10:00:00.000Z", status: "fertig", fehler: null, scanStatus: "sauber", vorschlaege: [], ...o,
});
const u = (dokumente: DokumentZeile[]): Uebersicht => ({ dokumente, darfAendern: true, auslesen: "an", budget: { verbrauchtUsd: 0, limitUsd: 10 }, stand: 1 });
const uMit = (status: DokumentZeile["status"]) => u([dz({ id: "d", status })]);

const v1 = vz({ id: "v1" }), v2 = vz({ id: "v2" });

describe("franken", () => {
  it("formatiert mit Tausenderapostroph und zwei Stellen", () => {
    expect(franken(1296)).toBe("CHF 1'296.00");
    expect(franken(20250)).toBe("CHF 20'250.00");
    expect(franken(12.5)).toBe("CHF 12.50");
  });
});

describe("statusText", () => {
  it("deckt alle Zustaende ab", () => {
    expect(statusText({ status: "fertig", fehler: null, vorschlaege: [v1, v2] })).toBe("2 Vorschläge");
    expect(statusText({ status: "fertig", fehler: null, vorschlaege: [v1] })).toBe("1 Vorschlag");
    expect(statusText({ status: "fertig", fehler: null, vorschlaege: [] })).toBe("Keine Vorschläge");
    expect(statusText({ status: "liest", fehler: null, vorschlaege: [] })).toBe("liest …");
    expect(statusText({ status: "neu", fehler: null, vorschlaege: [] })).toBe("liest …");
    expect(statusText({ status: "fehler", fehler: "Monatsbudget erreicht.", vorschlaege: [] })).toBe("Monatsbudget erreicht.");
    expect(statusText({ status: "fehler", fehler: null, vorschlaege: [] })).toBe("Auslesen fehlgeschlagen");
    expect(statusText({ status: "abgebrochen", fehler: null, vorschlaege: [] })).toBe("Auslesen abgebrochen");
    expect(statusText({ status: "aus", fehler: null, vorschlaege: [] })).toBe("Auslesen ausgeschaltet");
  });
});

describe("offeneSichere", () => {
  it("zaehlt offene, sichere, zugeordnete Vorschlaege", () => {
    const x = u([dz({ id: "d", vorschlaege: [
      vz({ id: "a", bauteilIds: ["b1"] }),
      vz({ id: "b", bauteilIds: [] }),
      vz({ id: "c", bauteilIds: ["b1"], sicherheit: "mittel" }),
      vz({ id: "d2", bauteilIds: ["b1"], status: "uebernommen" }),
      vz({ id: "e", bauteilIds: ["b1"], katalogId: null }),
    ] })]);
    expect(offeneSichere(x)).toBe(1);
  });
});

describe("gruppiere / laeuftNoch", () => {
  const x = u([dz({ id: "d", vorschlaege: [vz({ id: "v-pumpen", bauteilIds: ["pumpe-1", "pumpe-2"] }), vz({ id: "v-ohne" })] })]);
  it("trennt zugeordnete und ohne Zuordnung", () => {
    const g = gruppiere(x);
    expect(g[0].zugeordnet.map((v) => v.id)).toEqual(["v-pumpen"]);
    expect(g[0].ohne.map((v) => v.id)).toEqual(["v-ohne"]);
  });
  it("filtert aufs Bauteil", () => {
    expect(gruppiere(x, "pumpe-2")[0].zugeordnet.map((v) => v.id)).toEqual(["v-pumpen"]);
    expect(gruppiere(x, "pumpe-9")[0].zugeordnet).toEqual([]);
    expect(gruppiere(x, "pumpe-9")[0].ohne).toEqual([]);
  });
  it("laeuftNoch bei neu/liest", () => {
    expect(laeuftNoch(uMit("liest"))).toBe(true);
    expect(laeuftNoch(uMit("neu"))).toBe(true);
    expect(laeuftNoch(uMit("fertig"))).toBe(false);
  });
});

describe("zuordnungText", () => {
  const bt = [{ id: "b1", name: "Umwälzpumpe", ort: "UG1 · HK Büro A" }, { id: "b2", name: "Umwälzpumpe", ort: "UG1 · HK Büro B" }];
  it("zeigt erstes Bauteil und Anzahl", () => {
    expect(zuordnungText(vz({ id: "x", bauteilIds: ["b1", "b2"] }), bt)).toBe("Umwälzpumpe · UG1 · HK Büro A (2 von 2)");
  });
  it("ohne Zuordnung", () => {
    expect(zuordnungText(vz({ id: "x" }), bt)).toBe("Keinem Bauteil zugeordnet");
  });
});
