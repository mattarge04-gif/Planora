import { describe, it, expect } from "vitest";
import { pruefeBeschreibung, type Bestand } from "../src/welt/pruefung.js";
import { verteilerHinweise, wirksameHeizung } from "../src/welt/heizung.js";
import { KATALOG_V1 } from "../src/welt/katalog.v1.js";
import { REGELWERK_V1 } from "../src/welt/regelwerk.v1.js";
import type { Beschreibung } from "../src/welt/typen.js";
import { G, beschreibungFixture } from "./hilfe-welt.js";

const bestand = (): Bestand => ({
  geschossIds: new Set([G(9), G(10), G(11)]), einheitIds: new Set([G(20), G(21), G(22)]),
  bauteilIds: new Set([G(30), G(31), G(32)]), einheitenManuell: new Set(), bauteileManuell: new Set(),
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
