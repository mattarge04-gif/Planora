import { describe, it, expect } from "vitest";
import { ablageFehlerText, ablegenFehlerText, bauteilKandidaten, datenblattVorschlag, duplikatText, lesbarFuerPreise, filtere, groesseText, kategorieName, oeffnenArt, pruefungLaeuft, scanAnzeige, unterlagenFuer, vorpruefen, MAX_BYTES } from "./ansicht";
import type { AblageBauteil, AblageZeile } from "./typen";

const d = (x: Partial<AblageZeile> = {}): AblageZeile => ({ id: "d1", dateiname: "a.pdf", art: "pdf", mime: "application/pdf", kategorie: "sonstiges", groesse: 1000, seiten: 1,
  hochgeladenAm: "2026-11-23T10:00:00.000Z", scanStatus: "sauber", scanGrund: null, gescanntAm: null, bauteilIds: [], ...x });
const b = (id: string, katalogId: string, geschoss = "UG1", ort = "UG1 · Technik"): AblageBauteil => ({ id, katalogId, geschoss, ort, hersteller: null, typ: null });

describe("Ablage-Anzeige", () => {
  it("Scan-Status", () => {
    expect(scanAnzeige(d({ scanStatus: "quarantaene" }))).toEqual({ text: "wird geprüft …", art: "laeuft" });
    expect(scanAnzeige(d())).toEqual({ text: "geprüft", art: "ok" });
    expect(scanAnzeige(d({ scanStatus: "abgelehnt", scanGrund: "Eicar-Test-Signature" }))).toEqual({ text: "Datei abgelehnt (Virenprüfung)", art: "abgelehnt", detail: "Befund: Eicar-Test-Signature" });
    expect(scanAnzeige(d({ scanStatus: "scan_fehler", scanGrund: "Datei fehlt, bitte neu ablegen." }))).toEqual({ text: "Prüfung fehlgeschlagen", art: "fehler", detail: "Datei fehlt, bitte neu ablegen." });
  });
  it("Groesse und Kategorie", () => {
    expect([groesseText(820), groesseText(820 * 1024), groesseText(4.2 * 1024 * 1024)]).toEqual(["1 kB", "820 kB", "4.2 MB"]);
    expect(kategorieName("datenblatt")).toBe("Datenblatt");
  });
  it("Filter und Polling", () => {
    const l = [d({ id: "a", kategorie: "foto" }), d({ id: "b", bauteilIds: ["x"] }), d({ id: "c", scanStatus: "quarantaene" })];
    expect(filtere(l, { kategorie: "foto", nurUnverknuepft: false }).map((x) => x.id)).toEqual(["a"]);
    expect(filtere(l, { kategorie: null, nurUnverknuepft: true }).map((x) => x.id)).toEqual(["a", "c"]);
    expect([pruefungLaeuft(l), pruefungLaeuft(l.slice(0, 2))]).toEqual([true, false]);
  });
  it("Oeffnen", () => {
    expect(oeffnenArt(d())).toBe("pdf");
    expect(oeffnenArt(d({ art: "bild", mime: "image/png" }))).toBe("bild");
    expect(oeffnenArt(d({ art: "bild", mime: "image/heic" }))).toBe("herunterladen");
    expect(oeffnenArt(d({ art: "office", mime: "application/msword" }))).toBe("herunterladen");
    expect(oeffnenArt(d({ scanStatus: "quarantaene" }))).toBe("gesperrt");
  });
  it("Kandidaten filtern nach Typ, Geschoss, Name; Datenblatt-Vorschlag", () => {
    const bt = [b("p1", "heizung.umwaelzpumpe"), b("p2", "heizung.umwaelzpumpe", "EG", "EG · Gastro"), b("v1", "heizung.verteiler")];
    const name = (k: string) => (k === "heizung.umwaelzpumpe" ? "Umwälzpumpe" : "Heizungsverteiler");
    expect(bauteilKandidaten(bt, { katalogId: "heizung.umwaelzpumpe", geschoss: null, suche: "" }, name).map((x) => x.id)).toEqual(["p1", "p2"]);
    expect(bauteilKandidaten(bt, { katalogId: null, geschoss: "EG", suche: "" }, name).map((x) => x.id)).toEqual(["p2"]);
    expect(bauteilKandidaten(bt, { katalogId: null, geschoss: null, suche: "verteil" }, name).map((x) => x.id)).toEqual(["v1"]);
    expect(datenblattVorschlag(d({ kategorie: "datenblatt", bauteilIds: ["p1"] }), bt)).toEqual(["p2"]);
    expect(datenblattVorschlag(d({ kategorie: "offerte", bauteilIds: ["p1"] }), bt)).toEqual([]);
    expect(unterlagenFuer([d({ id: "a", bauteilIds: ["p1"] }), d({ id: "b" })], ["p1", "p2"]).map((x) => x.id)).toEqual(["a"]);
    // E48: Datenblatt an Pumpe 1 erscheint bei Pumpe 2 gleichen Typs (Schreibweise egal), nicht bei anderem Typ oder ohne Typ; andere Kategorien nur direkt
    const typBt: AblageBauteil[] = [{ id: "m1", katalogId: "heizung.umwaelzpumpe", geschoss: "UG1", ort: "UG1", hersteller: "Grundfos", typ: "Magna 32" },
      { id: "m2", katalogId: "heizung.umwaelzpumpe", geschoss: "UG1", ort: "UG1", hersteller: "grundfos", typ: "MAGNA 32 " },
      { id: "m3", katalogId: "heizung.umwaelzpumpe", geschoss: "UG1", ort: "UG1", hersteller: "Grundfos", typ: "Magna 40" },
      { id: "o1", katalogId: "heizung.umwaelzpumpe", geschoss: "UG1", ort: "UG1", hersteller: null, typ: null }];
    const doks = [d({ id: "db", kategorie: "datenblatt", bauteilIds: ["m1"] }), d({ id: "foto", kategorie: "foto", bauteilIds: ["m1"] })];
    expect([unterlagenFuer(doks, ["m2"], typBt), unterlagenFuer(doks, ["m3"], typBt), unterlagenFuer(doks, ["o1"], typBt)].map((l) => l.map((x) => x.id)))
      .toEqual([["db"], [], []]);
  });
  it("Fehlertexte und Vorpruefung", () => {
    expect(ablageFehlerText("typ_unbekannt")).toBe("Dateityp nicht erlaubt. Erlaubt sind PDF, JPG, PNG, HEIC, Word, Excel und PowerPoint.");
    expect([ablageFehlerText("nicht_sauber"), ablageFehlerText("auslesen_aus")]).toEqual(["Datei ist noch nicht freigegeben.", "Automatisches Auslesen ist nicht eingerichtet."]);
    expect(ablageFehlerText("makro")).toBe("Dateien mit Makros werden nicht abgelegt.");
    expect(ablageFehlerText(null, 413)).toBe("Datei grösser als 100 MB.");
    expect(ablageFehlerText("toString")).toBe("Aktion fehlgeschlagen.");
    expect(ablageFehlerText(null, 500, "Ablegen fehlgeschlagen.")).toBe("Ablegen fehlgeschlagen.");
    expect([ablegenFehlerText("typ_unbekannt", 400, "setup.PDF"), ablegenFehlerText("typ_unbekannt", 400, "a.exe"), ablegenFehlerText(null, 500, "a.pdf")])
      .toEqual(["Inhalt passt nicht zur Endung .pdf.", "Dateityp nicht erlaubt. Erlaubt sind PDF, JPG, PNG, HEIC, Word, Excel und PowerPoint.", "Ablegen fehlgeschlagen."]);
    expect([ablageFehlerText(null, 403, "Ablegen fehlgeschlagen."), ablageFehlerText(null, 403), ablageFehlerText(null, 404)])
      .toEqual(["Keine Berechtigung zum Ablegen.", "Keine Berechtigung für diese Aktion.", "Das Dokument ist nicht mehr abgelegt."]);
    expect([ablageFehlerText("abgelehnt"), ablageFehlerText("nicht_scan_fehler"), ablageFehlerText("bauteil_gemischt"), ablageFehlerText("feld_unbekannt"),
      ablageFehlerText("feld_typ"), ablageFehlerText("liest_bereits"), ablageFehlerText("kein_pdf"), ablageFehlerText("zu_viele_seiten")]).toEqual([
      "Abgelehnte Dateien lassen sich nicht ändern.", "Nur fehlgeschlagene Prüfungen lassen sich wiederholen.", "Die Bauteile müssen vom gleichen Typ und im gleichen Gebäude sein.",
      "Unbekanntes Datenblatt-Feld.", "Ungültiger Wert im Datenblatt.", "Das Dokument wird bereits gelesen.", "Nur PDF-Dateien lassen sich auslesen.",
      "Das Dokument hat zu viele Seiten zum Auslesen."]);
    expect(ablageFehlerText("zu_gross_lesen")).toBe("Das Dokument ist zu gross zum Auslesen (über 32 MB).");
    expect([duplikatText({ dateiname: "a.pdf", scanStatus: "abgelehnt" }, "a.pdf"), duplikatText({ dateiname: "a.pdf", scanStatus: "sauber" }, "b.pdf"),
      duplikatText({ dateiname: "a.pdf", scanStatus: "quarantaene" }, "a.pdf")])
      .toEqual(["Wurde bei der Virenprüfung abgelehnt.", "Ist schon abgelegt als a.pdf.", "Ist schon abgelegt, wird geprüft."]);
    const p = { art: "pdf" as const, scanStatus: "sauber" as const, groesse: 1000, seiten: 3 };
    expect([lesbarFuerPreise(p), lesbarFuerPreise({ ...p, groesse: 32 * 1024 * 1024 + 1 }), lesbarFuerPreise({ ...p, seiten: 101 }), lesbarFuerPreise({ ...p, scanStatus: "quarantaene" })])
      .toEqual([true, false, false, false]);
    const v = vorpruefen([{ size: 10 }, { size: MAX_BYTES + 1 }]);
    expect([v.ok.length, v.zuGross.length]).toEqual([1, 1]);
  });
});
