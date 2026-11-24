import { describe, it, expect } from "vitest";
import { ablageFehlerText, bauteilKandidaten, datenblattVorschlag, filtere, groesseText, kategorieName, oeffnenArt, pruefungLaeuft, scanAnzeige, unterlagenFuer, vorpruefen, MAX_BYTES } from "./ansicht";
import type { AblageBauteil, AblageZeile } from "./typen";

const d = (x: Partial<AblageZeile> = {}): AblageZeile => ({ id: "d1", dateiname: "a.pdf", art: "pdf", mime: "application/pdf", kategorie: "sonstiges", groesse: 1000, seiten: 1,
  hochgeladenAm: "2026-11-23T10:00:00.000Z", scanStatus: "sauber", scanGrund: null, gescanntAm: null, bauteilIds: [], ...x });
const b = (id: string, katalogId: string, geschoss = "UG1", ort = "UG1 · Technik"): AblageBauteil => ({ id, katalogId, geschoss, ort, hersteller: null, typ: null });

describe("Ablage-Anzeige", () => {
  it("Scan-Status", () => {
    expect(scanAnzeige(d({ scanStatus: "quarantaene" }))).toEqual({ text: "wird geprüft …", art: "laeuft" });
    expect(scanAnzeige(d())).toEqual({ text: "geprüft", art: "ok" });
    expect(scanAnzeige(d({ scanStatus: "abgelehnt", scanGrund: "Eicar-Test-Signature" }))).toEqual({ text: "abgelehnt: Eicar-Test-Signature", art: "abgelehnt" });
    expect(scanAnzeige(d({ scanStatus: "scan_fehler", scanGrund: "x" }))).toEqual({ text: "Prüfung fehlgeschlagen", art: "fehler" });
  });
  it("Groesse und Kategorie", () => {
    expect([groesseText(820), groesseText(820 * 1024), groesseText(4.2 * 1024 * 1024)]).toEqual(["820 B", "820 KB", "4.2 MB"]);
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
  });
  it("Fehlertexte und Vorpruefung", () => {
    expect(ablageFehlerText("typ_unbekannt")).toBe("Dateityp nicht erlaubt. Erlaubt sind PDF, JPG, PNG, HEIC, Word, Excel und PowerPoint.");
    expect(ablageFehlerText("makro")).toBe("Dateien mit Makros werden nicht abgelegt.");
    expect(ablageFehlerText(null, 413)).toBe("Datei grösser als 100 MB.");
    expect(ablageFehlerText("toString")).toBe("Ablegen fehlgeschlagen.");
    const v = vorpruefen([{ size: 10 }, { size: MAX_BYTES + 1 }]);
    expect([v.ok.length, v.zuGross.length]).toEqual([1, 1]);
  });
});
