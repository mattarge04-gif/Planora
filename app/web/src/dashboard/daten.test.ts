import { describe, expect, it } from "vitest";
import type { Beschreibung, Hinweis, KatalogEintrag, Welt, WeltSymbol } from "../typen";
import { anlagenZeilen, anzeigeName, geschossListe, hinweisListe, kennzahlen, objektKarte, zentraleGeschoss } from "./index";

// Gleiche erfasste Anlagen und Einheiten wie app/src/welt/beispiel.ts, mit festen Test-IDs.
const katalog: KatalogEintrag[] = [
  { id: "heizung.waermepumpe", name: "Waermepumpe", bereich: "zentrale" },
  { id: "heizung.speicher", name: "Speicher", bereich: "zentrale" },
  { id: "heizung.verteiler", name: "Heizungsverteiler", bereich: "verteilung" },
  { id: "heizung.heizkoerper", name: "Heizkoerper", bereich: "einheit" },
  { id: "heizung.fbh_kreis", name: "FBH-Kreis", bereich: "einheit" },
];
const sym = (key: string, id: string, x: number, y: number, z: number, menge: number | null, hersteller: string | null = null, versorgt: string[] = []): WeltSymbol => ({
  schluessel: key, katalogId: `heizung.${id}`, position: { x, y, z }, bauteilIds: [`b-${key}`],
  mengeSumme: menge ?? 0, mengeUnbekannt: menge === null, hersteller, typ: null, versorgt, status: "bestaetigt",
});
const welt: Welt = {
  regelwerkVersion: 1, hash: "dashboard-beispiel", grundriss: [{ x: 0, z: 0, breite: 30, tiefe: 15 }],
  geschosse: [{ id: "eg", code: "EG", yUnten: 0, hoehe: 3.2 }, { id: "og", code: "OG1", yUnten: 3.2, hoehe: 3.2 }],
  einheiten: [
    { id: "a", geschossId: "eg", bezeichnung: "Büro A", art: "buero", rechteck: { x: 0, z: 0, breite: 12, tiefe: 15 }, quelle: "schematisch" },
    { id: "r", geschossId: "eg", bezeichnung: "Restaurant", art: "gastro", rechteck: { x: 12, z: 0, breite: 15, tiefe: 15 }, quelle: "schematisch" },
    { id: "t", geschossId: "eg", bezeichnung: "Technik", art: "technik", rechteck: { x: 27, z: 0, breite: 3, tiefe: 15 }, quelle: "schematisch" },
    { id: "c", geschossId: "og", bezeichnung: "Büro C", art: "buero", rechteck: { x: 0, z: 0, breite: 15, tiefe: 15 }, quelle: "schematisch" },
    { id: "d", geschossId: "og", bezeichnung: "Büro D", art: "buero", rechteck: { x: 15, z: 0, breite: 15, tiefe: 15 }, quelle: "schematisch" },
  ],
  symbole: [
    sym("wp", "waermepumpe", 27.75, 0, 3.75, 1), sym("s", "speicher", 29.25, 0, 3.75, 1),
    sym("h1", "heizkoerper", 3, 0, 7.5, 12, "Zehnder"), sym("h2", "heizkoerper", 9, 0, 7.5, 3, "Prolux"),
    sym("fr", "fbh_kreis", 19.5, 0, 7.5, 6), sym("fc", "fbh_kreis", 7.5, 3.2, 7.5, 4), sym("fd", "fbh_kreis", 22.5, 3.2, 7.5, null),
    sym("v", "verteiler", 27.75, 0, 11.25, 1, null, ["r", "c"]),
  ], hinweise: [{ code: "ueberlappung", bezug: "d" }],
};
const ort: Record<string, string> = { wp: "t", s: "t", h1: "a", h2: "a", fr: "r", fc: "c", fd: "d", v: "t" };
const beschreibung: Beschreibung = {
  gebaeudeId: "G", stand: 1,
  bauteile: welt.symbole.map((s) => ({ id: s.bauteilIds[0], katalogId: s.katalogId, standort: { einheitId: ort[s.schluessel] },
    menge: s.mengeUnbekannt ? null : s.mengeSumme, status: s.status, hersteller: s.hersteller })),
  hinweise: [{ code: "verteiler_vorschlag", bezug: "d" }],
};
const leer: Welt = { regelwerkVersion: 1, hash: "leer", grundriss: [], geschosse: [], einheiten: [], symbole: [], hinweise: [] };
const leerB: Beschreibung = { gebaeudeId: "G", stand: 1, bauteile: [] };

describe("Dashboard-Kennzahlen", () => {
  it("zählt die Beispieldaten und unterscheidet Symbole, Bauteilzeilen und Stückmengen", () => {
    expect(kennzahlen(welt, beschreibung)).toEqual({ geschosse: 2, einheiten: 5, symbole: 8, bauteile: 8, bestaetigteBauteile: 8, anteilBestaetigtProzent: 100 });
    const b: Beschreibung = { ...beschreibung, bauteile: [...beschreibung.bauteile, { ...beschreibung.bauteile[0], id: "extra", status: "vorgeschlagen", menge: 1000 }] };
    expect(kennzahlen(welt, b)).toMatchObject({ symbole: 8, bauteile: 9, bestaetigteBauteile: 8, anteilBestaetigtProzent: 8 / 9 * 100 });
  });
  it("erfindet bei leeren Daten keine Bestätigungsquote", () => {
    expect(kennzahlen(leer, leerB)).toEqual({ geschosse: 0, einheiten: 0, symbole: 0, bauteile: 0, bestaetigteBauteile: 0, anteilBestaetigtProzent: null });
  });
  it("zählt auch Bauteile ohne ID und unbekannte Mengen als echte erfasste Zeilen", () => {
    expect(kennzahlen(leer, { ...leerB, bauteile: [{ katalogId: "x", standort: {}, menge: null, status: "vorgeschlagen" }] }))
      .toMatchObject({ bauteile: 1, bestaetigteBauteile: 0, anteilBestaetigtProzent: 0 });
  });
});

describe("Geschosse und Technikmodus", () => {
  it("sortiert Geschosse absteigend und zählt deren echte Einheiten", () => {
    const w = { ...welt, geschosse: [...welt.geschosse, { id: "ug", code: "UG", yUnten: -3, hoehe: 3 }] };
    expect(geschossListe(w)).toEqual([
      { id: "og", code: "OG1", yUnten: 3.2, einheiten: 2 }, { id: "eg", code: "EG", yUnten: 0, einheiten: 3 }, { id: "ug", code: "UG", yUnten: -3, einheiten: 0 },
    ]);
  });
  it("öffnet das Erzeugergeschoss und ohne Erzeuger das unterste Geschoss", () => {
    expect(zentraleGeschoss(welt)).toBe("eg");
    const w = { ...welt, symbole: welt.symbole.filter((s) => s.schluessel !== "wp"), geschosse: [...welt.geschosse, { id: "ug", code: "UG", yUnten: -3, hoehe: 3 }] };
    expect(zentraleGeschoss(w)).toBe("ug");
    expect(zentraleGeschoss(leer)).toBeNull(); expect(geschossListe(leer)).toEqual([]);
  });
  it("findet auch einen OG-Erzeuger und wählt bei mehreren den tiefsten unabhängig von der Reihenfolge", () => {
    const og = sym("gas", "gaskessel", 5, 3.2, 5, 1);
    expect(zentraleGeschoss({ ...welt, symbole: [og] })).toBe("og");
    expect(zentraleGeschoss({ ...welt, symbole: [og, welt.symbole[0]] })).toBe("eg");
  });
});

describe("Anzeigenamen und Anlagen", () => {
  it.each([
    ["waermepumpe", "Wärmepumpe"], ["oelkessel", "Ölkessel"], ["fernwaerme_uebergabe", "Fernwärme-Übergabe"],
    ["umwaelzpumpe", "Umwälzpumpe"], ["heizkoerper", "Heizkörper"], ["fbh_kreis", "FBH-Kreis"], ["tabs_feld", "TABS-Feld"],
  ])("zeigt heizung.%s mit korrekten Umlauten", (id, name) => expect(anzeigeName(`heizung.${id}`, katalog)).toBe(name));
  it("erhält unbekannte Katalognamen und fällt zuletzt auf die echte ID zurück", () => {
    expect(anzeigeName("neu", [{ id: "neu", name: "Kühlstation", bereich: "zentrale" }])).toBe("Kühlstation");
    expect(anzeigeName("unbekannt")).toBe("unbekannt"); expect(anzeigeName("constructor")).toBe("constructor");
  });
  it("bietet eine Tabellenzeile je Symbol mit echten Auswahl- und Standort-IDs", () => {
    const zeilen = anlagenZeilen(welt, beschreibung, katalog);
    expect(zeilen).toHaveLength(8);
    expect(zeilen.find((z) => z.schluessel === "h1")).toMatchObject({ name: "Heizkörper", hersteller: "Zehnder", typ: null,
      herstellerTyp: "Zehnder", bauteilIds: ["b-h1"], geschossId: "eg", einheitId: "a", standort: "EG · Büro A", menge: "12", status: "bestaetigt" });
    expect(zeilen.find((z) => z.schluessel === "fd")?.menge).toBe("unbekannt");
  });
  it("zeigt Teilmengen und Hersteller/Typ nach der bestehenden Panel-Regel", () => {
    const w = { ...welt, symbole: [{ ...welt.symbole[2], mengeSumme: 12, mengeUnbekannt: true, typ: "Charleston", status: "vorgeschlagen" as const }] };
    expect(anlagenZeilen(w, beschreibung, katalog)[0]).toMatchObject({ menge: "mind. 12 (teilweise unbekannt)", herstellerTyp: "Zehnder · Charleston", status: "vorgeschlagen" });
  });
  it("respektiert direkt am Geschoss erfasste Standorte und fehlende Referenzen", () => {
    const b = { ...beschreibung, bauteile: [{ ...beschreibung.bauteile[0], standort: { geschossId: "eg" } }] };
    expect(anlagenZeilen(welt, b, katalog)[0]).toMatchObject({ geschossId: "eg", einheitId: null, standort: "EG · direkt am Geschoss" });
    expect(anlagenZeilen(welt, leerB, katalog)[0]).toMatchObject({ geschossId: "eg", einheitId: null, standort: "–" });
  });
  it("liefert die Objektkarte mit Icon, Original-ID, Versorgung und leerem Dokumentbereich", () => {
    expect(objektKarte(welt, beschreibung, katalog, "v")).toMatchObject({ id: "v", schluessel: "v", icon: "verteiler", name: "Heizungsverteiler",
      menge: "1", standort: "EG · Technik", versorgt: ["Restaurant (EG)", "Büro C (OG1)"], zeilen: [{ menge: "1", baujahr: "–" }], dokumente: [] });
    expect(objektKarte(welt, beschreibung, katalog, "fehlt")).toBeNull();
    const w = { ...welt, symbole: [{ ...welt.symbole[0], katalogId: "neu" }] };
    expect(objektKarte(w, beschreibung, [], "wp")).toMatchObject({ icon: "anlage", name: "neu" });
  });
});

describe("Echte Hinweise und Klickziele", () => {
  it("führt beide Quellen zusammen, übersetzt Texte und erfindet keinen Status", () => {
    const h = hinweisListe(welt, beschreibung);
    expect(h.map((h) => [h.text, h.status])).toEqual([["Büro D: Verteiler noch nicht erfasst", null], ["Büro D: Layout überlappt", null]]);
    expect(h[0].ziel).toEqual({ geschossId: "og", position: { x: 22.5, y: 3.2, z: 7.5 }, schluessel: null });
  });
  it("entfernt nur identische Hinweise, nicht verschiedene Codes oder Bezüge", () => {
    const b = { ...beschreibung, hinweise: [...beschreibung.hinweise!, ...welt.hinweise, { code: "verteiler_vorschlag", bezug: "c" }] };
    expect(hinweisListe(welt, b)).toHaveLength(3);
    expect(new Set(hinweisListe(welt, b).map((h) => h.id)).size).toBe(3);
  });
  it("erhält tatsächlich gelieferte Statuswerte ohne eine API-Erweiterung vorauszusetzen", () => {
    const hinweise: (Hinweis & { status: "offen" | "erledigt" })[] = [{ code: "neu", bezug: "d", status: "offen" }, { code: "alt", bezug: "d", status: "erledigt" }];
    expect(hinweisListe({ ...leer, hinweise }, leerB).map((h) => h.status)).toEqual(["offen", "erledigt"]);
  });
  it("zielt bei Gruppen- und Bauteilbezug auf dieselbe echte Anlage", () => {
    const h = hinweisListe({ ...welt, hinweise: [{ code: "position_widerspruch", bezug: "wp" }, { code: "neu", bezug: "b-wp" }] }, leerB);
    expect(h[0].text).toBe("Widersprüchliche manuelle Positionen in einer Bauteilgruppe");
    expect(h[0].ziel).toEqual({ geschossId: "eg", position: { x: 27.75, y: 0, z: 3.75 }, schluessel: "wp" });
    expect(h[1].ziel).toEqual(h[0].ziel);
  });
  it("löst Geschoss- und alleinige Bauteil-Standortbezüge auf, unbekannte Bezüge bleiben ohne Ziel", () => {
    const b = { ...beschreibung, bauteile: [{ ...beschreibung.bauteile[0], id: "allein", standort: { einheitId: "d" } }], hinweise: [] };
    const h = hinweisListe({ ...welt, hinweise: [{ code: "neu", bezug: "og" }, { code: "neu", bezug: "allein" }, { code: "unbekannter_code", bezug: "fehlt" }] }, b);
    expect(h[0].ziel).toEqual({ geschossId: "og", position: { x: 15, y: 3.2, z: 7.5 }, schluessel: null });
    expect(h[1].ziel?.geschossId).toBe("og"); expect(h[2]).toMatchObject({ text: "unbekannter_code", ziel: null });
    expect(hinweisListe(leer, leerB)).toEqual([]);
    expect(hinweisListe({ ...leer, geschosse: welt.geschosse, hinweise: [{ code: "x", bezug: "eg" }] }, leerB)[0].ziel?.position).toBeNull();
  });
});

it("verändert weder Eingangsdaten noch deren Reihenfolge und gibt bearbeitbare Kopien zurück", () => {
  const vorher = JSON.stringify({ welt, beschreibung, katalog });
  geschossListe(welt); zentraleGeschoss(welt); kennzahlen(welt, beschreibung); hinweisListe(welt, beschreibung);
  const z = anlagenZeilen(welt, beschreibung, katalog)[0]; z.bauteilIds.push("fremd"); z.position!.x = -100;
  const k = objektKarte(welt, beschreibung, katalog, "v")!; k.versorgt.push("fremd"); k.dokumente.length = 0;
  expect(JSON.stringify({ welt, beschreibung, katalog })).toBe(vorher);
});
