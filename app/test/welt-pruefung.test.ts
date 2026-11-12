import { describe, it, expect } from "vitest";
import { pruefeBeschreibung, type Bestand } from "../src/welt/pruefung.js";
import { verteilerHinweise, wirksameHeizung } from "../src/welt/heizung.js";
import { KATALOG_V1 } from "../src/welt/katalog.v1.js";
import { REGELWERK_V1 } from "../src/welt/regelwerk.v1.js";
import type { Beschreibung } from "../src/welt/typen.js";
import { G, beschreibungFixture } from "./hilfe-welt.js";

const bestand = (): Bestand => ({
  geschossIds: new Set([G(9), G(10), G(11)]), einheitIds: new Set([G(20), G(21), G(22)]),
  bauteilIds: new Set([G(30), G(31), G(32)]), einheitenManuell: new Set(), bauteileManuell: new Set(), gruppeIds: new Set([G(40)]),
});
const codes = (b: Beschreibung, best = bestand()) => pruefeBeschreibung(b, best, REGELWERK_V1, KATALOG_V1).map((f) => f.code);

describe("wirksameHeizung", () => {
  it("Ausnahme vor Standard", () => {
    expect(wirksameHeizung({ hk: "ja", fbh: "nein", tabs: "unbekannt" }, { fbh: "ja" })).toEqual({ hk: "ja", fbh: "ja", tabs: "unbekannt" });
    expect(wirksameHeizung({ hk: "ja", fbh: "nein", tabs: "nein" })).toEqual({ hk: "ja", fbh: "nein", tabs: "nein" });
  });
});

describe("verteilerHinweise", () => {
  it("FBH ohne versorgenden Verteiler ergibt Vorschlag, versorgte nicht", () => {
    const b = beschreibungFixture();
    b.einheiten[2].heizungAusnahme = { fbh: "ja" };
    expect(verteilerHinweise(b)).toEqual([]);
    b.bauteile[2].versorgt = [{ einheitId: G(20) }];
    expect(verteilerHinweise(b)).toEqual([{ code: "verteiler_vorschlag", bezug: G(22) }]);
  });
  it("Versorgung per Index zaehlt fuer die Einheit mit ID", () => {
    const b = beschreibungFixture();
    b.einheiten[2].heizungAusnahme = { fbh: "ja" };
    b.bauteile[2].versorgt = [{ einheitIndex: 2 }];
    expect(verteilerHinweise(b)).toEqual([]);
  });
});

describe("pruefeBeschreibung", () => {
  it("gueltige Beschreibung ohne Fehler", () => expect(codes(beschreibungFixture())).toEqual([]));
  it("unbekannte Art, unbekannte Katalog-ID, nicht erlaubter Standort", () => {
    const b = beschreibungFixture();
    b.einheiten[0].art = "kino";
    b.bauteile[1].katalogId = "heizung.kamin";
    b.bauteile[2].katalogId = "heizung.waermepumpe"; // Zentrale ...
    b.bauteile[2].standort = { einheitId: G(22) };   // ... in Buero C: nicht erlaubt
    expect(codes(b)).toEqual(["art_unbekannt", "katalog_unbekannt", "katalog_nicht_erlaubt"]);
  });
  it("Mengen ausserhalb Katalogbereich oder nicht ganzzahlig; null ist erlaubt", () => {
    const b = beschreibungFixture();
    b.bauteile[0].menge = 501; b.bauteile[1].menge = 2.5; b.bauteile[2].menge = null;
    expect(codes(b)).toEqual(["menge_ungueltig", "menge_ungueltig"]);
  });
  it("fremde und doppelte IDs", () => {
    const b = beschreibungFixture();
    b.einheiten.push({ id: G(99), geschossId: G(10), bezeichnung: "X", art: "buero", flaecheM2: null });
    b.bauteile.push({ ...b.bauteile[0] });
    expect(codes(b)).toEqual(["id_unbekannt", "id_doppelt"]);
  });
  it("Standort fehlt, doppelt oder zeigt ins Leere", () => {
    const b = beschreibungFixture();
    b.bauteile[0].standort = {};
    b.bauteile[1].standort = { einheitId: G(20), geschossId: G(10) };
    b.bauteile[2].standort = { einheitIndex: 7 };
    expect(codes(b)).toEqual(["standort_fehlt", "standort_doppelt", "verweis_ungueltig"]);
  });
  it("Geschoss ausserhalb des Gebaeudes", () => {
    const b = beschreibungFixture(); b.einheiten[0].geschossId = G(98);
    expect(codes(b)).toEqual(["verweis_ungueltig"]);
  });
  it("Versorgung einer entfernten Einheit", () => {
    const b = beschreibungFixture(); b.einheiten.splice(2, 1);
    expect(codes(b)).toEqual(["verweis_ungueltig"]);
  });
  it("bestaetigt nur, wenn die wirksame Heizungsart ja ist", () => {
    const b = beschreibungFixture();
    b.bauteile.push({ katalogId: "heizung.fbh_kreis", standort: { einheitId: G(20) }, menge: 2, status: "bestaetigt", versorgt: [] });
    expect(codes(b)).toEqual(["bestaetigt_bei_unbekannt"]);
    b.einheiten[0].heizungAusnahme = { fbh: "ja" };
    expect(codes(b)).toEqual([]);
    b.einheiten[0].heizungAusnahme = { fbh: "unbekannt" };
    b.bauteile[3].status = "vorgeschlagen";
    expect(codes(b)).toEqual([]);
  });
  it("Verteiler ist von bestaetigt bei unbekannt ausgenommen", () => {
    const b = beschreibungFixture();
    b.einheiten[1].heizungAusnahme = { hk: "nein", fbh: "nein", tabs: "unbekannt" };
    expect(codes(b)).toEqual([]);
  });
  it("Heizkoerper bestaetigt bei HK nein in der Einheit", () => {
    const b = beschreibungFixture();
    b.einheiten[2].heizungAusnahme = { hk: "nein" };
    b.bauteile.push({ katalogId: "heizung.heizkoerper", standort: { einheitId: G(22) }, menge: 1, status: "bestaetigt", versorgt: [] });
    expect(codes(b)).toEqual(["bestaetigt_bei_unbekannt"]);
  });
  it("TABS-Feld bestaetigt bei TABS nein (Standard) in Einheit A", () => {
    const b = beschreibungFixture();
    b.bauteile.push({ katalogId: "heizung.tabs_feld", standort: { einheitId: G(20) }, menge: 1, status: "bestaetigt", versorgt: [] });
    expect(codes(b)).toEqual(["bestaetigt_bei_unbekannt"]);
  });
  it("Loeschen mit manuellem Layout ist blockiert", () => {
    const b = beschreibungFixture();
    b.einheiten.splice(2, 1);
    b.bauteile[2].versorgt = [{ einheitId: G(20) }];
    const best = bestand(); best.einheitenManuell.add(G(22));
    expect(codes(b, best)).toEqual(["loeschen_blockiert"]);
  });
  it("neue Einheit ohne ID ist per Index referenzierbar", () => {
    const b = beschreibungFixture();
    b.einheiten.push({ geschossId: G(11), bezeichnung: "Neu", art: "buero", flaecheM2: null });
    b.bauteile.push({ katalogId: "heizung.heizkoerper", standort: { einheitIndex: 3 }, menge: 4, status: "bestaetigt", versorgt: [] });
    b.bauteile[2].versorgt.push({ einheitIndex: 3 });
    expect(codes(b)).toEqual([]);
  });
});

describe("Gruppen und Ort", () => {
  const mitGruppe = () => {
    const b = beschreibungFixture();
    b.gruppen = [{ verteiler: { bauteilId: G(32) }, nummer: 1, art: "ungeregelt", bezeichnung: "Ost", verbraucher: [{ bauteilId: G(30) }, { bauteilIndex: 1 }] }];
    return b;
  };
  it("gueltige Gruppe und Ort ohne Fehler", () => {
    const b = mitGruppe();
    b.bauteile[1].ort = { vorBauteil: { bauteilId: G(30) } };
    b.bauteile[0].ort = { gruppe: { gruppeIndex: 0 } };
    expect(codes(b)).toEqual([]);
  });
  it("Verteiler muss heizung.verteiler sein", () => {
    const b = mitGruppe(); b.gruppen![0].verteiler = { bauteilId: G(30) };
    expect(codes(b)).toEqual(["gruppe_verteiler_ungueltig"]);
  });
  it("Nummer doppelt am gleichen Verteiler", () => {
    const b = mitGruppe();
    b.gruppen!.push({ verteiler: { bauteilIndex: 2 }, nummer: 1, art: "drossel", bezeichnung: "West", verbraucher: [] });
    expect(codes(b)).toEqual(["gruppe_nummer_doppelt"]);
  });
  it("Verbraucher in zwei Gruppen oder doppelt in einer", () => {
    const b = mitGruppe();
    b.gruppen![0].verbraucher.push({ bauteilId: G(30) });
    expect(codes(b)).toEqual(["verbraucher_doppelt"]);
    const c2 = mitGruppe();
    c2.gruppen!.push({ verteiler: { bauteilId: G(32) }, nummer: 2, art: "drossel", bezeichnung: "West", verbraucher: [{ bauteilId: G(31) }] });
    expect(codes(c2)).toEqual(["verbraucher_doppelt"]);
  });
  it("verweis_ungueltig bei unbekannter ID, Index ausserhalb, Gruppenverweis", () => {
    const b = mitGruppe();
    b.gruppen![0].verbraucher = [{ bauteilId: G(99) }, { bauteilIndex: 9 }];
    b.bauteile[0].ort = { gruppe: { gruppeIndex: 5 } };
    b.bauteile[1].ort = { vorBauteil: { bauteilIndex: -1 } };
    expect(codes(b)).toEqual(["verweis_ungueltig", "verweis_ungueltig", "verweis_ungueltig", "verweis_ungueltig"]);
  });
  it("ort_selbstbezug", () => {
    const b = beschreibungFixture();
    b.bauteile[0].ort = { vorBauteil: { bauteilId: G(30) } };
    b.bauteile[1].ort = { vorBauteil: { bauteilIndex: 1 } };
    expect(codes(b)).toEqual(["ort_selbstbezug", "ort_selbstbezug"]);
  });
  it("Gruppen-ID unbekannt oder doppelt", () => {
    const b = mitGruppe();
    b.gruppen![0].id = G(41);
    b.gruppen!.push({ id: G(40), verteiler: { bauteilIndex: 2 }, nummer: 2, art: "ungeregelt", bezeichnung: "A", verbraucher: [] });
    b.gruppen!.push({ id: G(40), verteiler: { bauteilIndex: 2 }, nummer: 3, art: "ungeregelt", bezeichnung: "B", verbraucher: [] });
    expect(codes(b)).toEqual(["id_unbekannt", "id_doppelt"]);
  });
});
