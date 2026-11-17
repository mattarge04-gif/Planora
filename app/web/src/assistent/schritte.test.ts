import { describe, expect, it } from "vitest";
import { K } from "./bestueckung";
import { ZAEHLBAR, anzahlJeArt, geschosseAbsteigend, zaehlerAufteilen } from "./schritte/Schritt2Einheiten";
import { zaehlerUebernehmen } from "./schritte/gemeinsam";
import { geschossAusnahmeWert, geschossHeizungWahl, heizungWahlAktionen } from "./schritte/Schritt3Heizung";
import { fbhSatz } from "./schritte/FbhVerteiler";
import { verbraucherSatz } from "./schritte/Schritt5Gruppen";
import { erzeuger, geschossCodes, leererZustand, reduziere, zentraleRaumHinweis, zentraleGeraete, hauptverteiler, type Aktion, type AssistentZustand } from "./zustand";

function angelegt(ug: number, og: number, ...aktionen: Aktion[]): AssistentZustand {
  let z = reduziere(leererZustand("l"), { typ: "geschosse", ug, og });
  z = reduziere(z, { typ: "gebaeudeAngelegt", id: "00000000-0000-4000-8000-000000000900", stand: 0,
    geschosse: z.gebaeude.geschosse.map((g, i) => ({ id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`, code: g.code })) });
  for (const a of aktionen) z = reduziere(z, a);
  return z;
}

describe("Schritt 1 – Geschosse", () => {
  it("Codes aus Anzahl UG/OG: UG…UG1, EG, OG1…", () => {
    expect(geschossCodes(0, 0)).toEqual(["EG"]);
    expect(geschossCodes(1, 2)).toEqual(["UG1", "EG", "OG1", "OG2"]);
    expect(geschossCodes(3, 1)).toEqual(["UG3", "UG2", "UG1", "EG", "OG1"]);
    expect(geschossCodes(9, 99).length).toBe(3 + 1 + 40);
  });
  it("Anzahl ändern behält bestehende Geschosse und entfernt Einheiten weggefallener", () => {
    let z = reduziere(leererZustand(), { typ: "geschosse", ug: 1, og: 2 });
    z = { ...z, gebaeude: { ...z.gebaeude, geschosse: z.gebaeude.geschosse.map((g) => ({ ...g, id: `id-${g.code}` })) } };
    z = reduziere(z, { typ: "einheitNeu", geschoss: "OG2", art: "buero" });
    z = reduziere(z, { typ: "geschosse", ug: 0, og: 1 });
    expect(z.gebaeude.geschosse).toEqual([{ id: "id-EG", code: "EG" }, { id: "id-OG1", code: "OG1" }]);
    expect(z.einheiten).toEqual([]);
    expect(z.bauteile).toEqual([]);
  });
  it("Gebäude angelegt: Geschoss-IDs übernommen, Schritt 1 danach lesend", () => {
    const z = angelegt(1, 1);
    expect(z.gebaeude.geschosse.every((g) => g.id)).toBe(true);
    expect(z.huelleBearbeitbar).toBe(false);
    expect(geschosseAbsteigend(z).map((g) => g.code)).toEqual(["OG1", "EG", "UG1"]);
  });
});

describe("Schritt 2 – Einheiten", () => {
  it("Nutzungszähler: Reihenfolge und Zählung", () => {
    expect(ZAEHLBAR).toEqual(["buero", "wohnung", "gastro", "allgemein", "kern", "technik"]);
    expect(anzahlJeArt([{ art: "buero" }, { art: "kern" }, { art: "buero" }], "buero")).toBe(2);
  });
  it("Zähler nur für vorhandene oder geöffnete Nutzungen, Rest als Angebot", () => {
    const liste = [{ art: "kern" }, { art: "buero" }];
    expect(zaehlerAufteilen(liste, new Set(["gastro"]))).toEqual({ zaehler: ["buero", "gastro", "kern"], angebote: ["wohnung", "allgemein", "technik"] });
    expect(zaehlerAufteilen([], new Set())).toEqual({ zaehler: [], angebote: [...ZAEHLBAR] });
  });
  it("Anzahl je Nutzung erzeugt nummerierte Einheiten «Büro 0.01–0.03»", () => {
    let z = angelegt(0, 1, { typ: "einheitAnzahl", geschoss: "EG", art: "buero", anzahl: 3 });
    expect(z.einheiten.map((e) => [e.geschoss, e.bezeichnung, e.art])).toEqual([["EG", "Büro 0.01", "buero"], ["EG", "Büro 0.02", "buero"], ["EG", "Büro 0.03", "buero"]]);
    z = reduziere(z, { typ: "einheitAnzahl", geschoss: "OG1", art: "buero", anzahl: 3 });
    expect(z.einheiten.slice(3).map((e) => e.bezeichnung)).toEqual(["Büro 1.01", "Büro 1.02", "Büro 1.03"]);
    expect(new Set(z.einheiten.map((e) => e.schluessel)).size).toBe(6);
  });
  it("Einheit entfernen entfernt ihre Bauteile", () => {
    let z = angelegt(0, 0, { typ: "einheitNeu", geschoss: "EG", art: "buero" });
    expect(z.bauteile.length).toBe(1);
    z = reduziere(z, { typ: "einheitLoeschen", schluessel: z.einheiten[0].schluessel });
    expect(z.bauteile).toEqual([]);
  });
  it("Art Kern entfernt nicht erlaubte FBH", () => {
    let z = angelegt(0, 0, { typ: "standard", art: "fbh", wert: "ja" }, { typ: "einheitNeu", geschoss: "EG", art: "buero" });
    expect(z.bauteile.map((t) => t.katalogId)).toEqual([K.hk, K.fbh, K.verteiler]);
    z = reduziere(z, { typ: "einheitAendern", schluessel: z.einheiten[0].schluessel, art: "kern" });
    expect(z.bauteile.map((t) => t.katalogId)).toEqual([K.hk]);
  });
});

describe("Schritt 4 – Zentrale", () => {
  it("Erzeuger ohne Technik-Einheit legt «Technik» im untersten Geschoss an", () => {
    const z = angelegt(1, 1, { typ: "erzeuger", katalogId: K.waermepumpe });
    const raum = z.einheiten.find((e) => e.schluessel === z.zentraleRaum)!;
    expect(raum).toMatchObject({ bezeichnung: "Technik", art: "technik", geschoss: "UG1" });
    expect(erzeuger(z).map((t) => [t.katalogId, t.standort])).toEqual([[K.waermepumpe, { einheit: raum.schluessel }]]);
    expect(zentraleRaumHinweis(z)).toBeNull();
  });
  it("Erzeugerwechsel ersetzt den Typ, Speicher ja/nein", () => {
    let z = angelegt(0, 0, { typ: "erzeuger", katalogId: K.waermepumpe }, { typ: "erzeuger", katalogId: K.gaskessel }, { typ: "speicher", an: true });
    expect(zentraleGeraete(z).map((t) => t.katalogId)).toEqual([K.gaskessel, K.speicher]);
    z = reduziere(z, { typ: "speicher", an: false });
    expect(zentraleGeraete(z).map((t) => t.katalogId)).toEqual([K.gaskessel]);
  });
  it("Zentrale-Raum muss Technik-Einheit sein, sonst Hinweis; Geräte und Hauptverteiler ziehen mit", () => {
    let z = angelegt(0, 0, { typ: "einheitNeu", geschoss: "EG", art: "buero" }, { typ: "erzeuger", katalogId: K.waermepumpe }, { typ: "gruppenAnzahl", anzahl: 1 });
    const buero = z.einheiten[0];
    z = reduziere(z, { typ: "zentraleRaum", einheit: buero.schluessel });
    expect(zentraleRaumHinweis(z)).toContain("keine Technik-Einheit");
    expect(erzeuger(z)[0].standort).toEqual({ einheit: buero.schluessel });
    expect(hauptverteiler(z)!.standort).toEqual({ einheit: buero.schluessel });
    for (const t of z.bauteile.filter((x) => x.ort)) expect(t.standort).toEqual({ einheit: buero.schluessel });
    z = reduziere(z, { typ: "technikraumNeu", geschoss: "EG" });
    expect(zentraleRaumHinweis(z)).toBeNull();
    expect(z.einheiten.filter((e) => e.art === "technik").length).toBe(2);
  });
});

describe("Schritt 3 – Heizung", () => {
  it("Ausnahme je Geschoss: gemeinsamer Wert, leer oder gemischt", () => {
    const e = (fbh?: "ja" | "nein") => ({ ausnahme: fbh ? { fbh } : {} } as any);
    expect(geschossAusnahmeWert([e("ja"), e("ja")], "fbh")).toBe("ja");
    expect(geschossAusnahmeWert([e(), e()], "fbh")).toBe("");
    expect(geschossAusnahmeWert([e("ja"), e()], "fbh")).toBe("gemischt");
    expect(geschossAusnahmeWert([], "fbh")).toBe("");
  });
});

describe("Schritt 5 – Gruppen", () => {
  it("Verbraucher einer Gruppe als Satz", () => {
    let z = angelegt(0, 2, { typ: "einheitAnzahl", geschoss: "OG1", art: "buero", anzahl: 2 }, { typ: "einheitAnzahl", geschoss: "OG2", art: "buero", anzahl: 1 },
      { typ: "einheitAnzahl", geschoss: "EG", art: "technik", anzahl: 1 }, { typ: "erzeuger", katalogId: K.waermepumpe }, { typ: "schritt", nr: 5 });
    expect(verbraucherSatz(z, z.gruppen[0])).toBe("3 Heizkörper in OG2, OG1");
  });
});

describe("Zähler übernimmt erst bei Blur/Enter (C1)", () => {
  it("leer oder ungültig → nichts, sonst gerundet und geklemmt, gleicher Wert → nichts", () => {
    expect(zaehlerUebernehmen("", 3, 0, 50)).toBeNull();
    expect(zaehlerUebernehmen("  ", 3, 0, 50)).toBeNull();
    expect(zaehlerUebernehmen("abc", 3, 0, 50)).toBeNull();
    expect(zaehlerUebernehmen("4", 3, 0, 50)).toBe(4);
    expect(zaehlerUebernehmen("99", 3, 0, 50)).toBe(50);
    expect(zaehlerUebernehmen("-2", 3, 0, 50)).toBe(0);
    expect(zaehlerUebernehmen("2.6", 0, 0, 50)).toBe(3);
    expect(zaehlerUebernehmen("3", 3, 0, 50)).toBeNull();
  });
});

describe("Schritt 3: eine Auswahl je Geschoss (B2)", () => {
  const std = { hk: "ja", fbh: "nein", tabs: "nein" } as const;
  const e = (ausnahme: object, art = "buero") => ({ schluessel: "x", geschoss: "OG1", bezeichnung: "B", art, flaecheM2: null, ausnahme });
  it("liest die Kombination aus den Ausnahmen", () => {
    expect(geschossHeizungWahl([e({}), e({})], std)).toBe("standard");
    expect(geschossHeizungWahl([e({ hk: "nein", fbh: "ja" }), e({ hk: "nein", fbh: "ja" })], std)).toBe("fbh");
    expect(geschossHeizungWahl([e({ fbh: "ja" })], std)).toBe("beide");
    expect(geschossHeizungWahl([e({ fbh: "ja" }), e({})], std)).toBe("eigen");
    expect(geschossHeizungWahl([e({ tabs: "ja" })], std)).toBe("eigen");
    expect(geschossHeizungWahl([e({ fbh: "unbekannt" })], std)).toBe("eigen");
    // Kern (nur Heizkörper) zählt nicht mit, sonst stünde FBH immer auf «eigen»
    expect(geschossHeizungWahl([e({ hk: "nein", fbh: "ja" }), e({}, "kern")], std)).toBe("fbh");
  });
  it("Aktionen: Ja zuerst, damit keine Einheit kurz ohne Heizung ist", () => {
    expect(heizungWahlAktionen("OG4", "fbh").map((a) => [a.art, a.wert])).toEqual([["fbh", "ja"], ["hk", "nein"]]);
    expect(heizungWahlAktionen("OG4", "standard").map((a) => a.wert)).toEqual([null, null, null]);
  });
});

describe("Schritt 5: FBH-Satz (B14)", () => {
  it("nennt die Aufteilung je Gruppe", () => {
    let z = reduziere(leererZustand("l"), { typ: "geschosse", ug: 1, og: 2 });
    z = reduziere(z, { typ: "gebaeudeAngelegt", id: "00000000-0000-4000-8000-000000000900", stand: 0,
      geschosse: z.gebaeude.geschosse.map((g, i) => ({ id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`, code: g.code })) });
    for (const a of [
      { typ: "einheitAnzahl", geschoss: "UG1", art: "technik", anzahl: 1 },
      { typ: "einheitAnzahl", geschoss: "EG", art: "gastro", anzahl: 1 },
      { typ: "einheitAnzahl", geschoss: "OG2", art: "buero", anzahl: 2 },
      { typ: "geschossAusnahme", geschoss: "OG2", art: "fbh", wert: "ja" },
      { typ: "geschossAusnahme", geschoss: "EG", art: "fbh", wert: "ja" },
      { typ: "erzeuger", katalogId: K.waermepumpe },
      { typ: "schritt", nr: 5 },
    ] as Aktion[]) z = reduziere(z, a);
    expect(fbhSatz(z)).toBe("3 FBH-Verteiler, automatisch an «Fussbodenheizung».");
    const gastro = z.einheiten.find((x) => x.art === "gastro")!;
    z = reduziere(z, { typ: "sondergruppe", einheit: gastro.schluessel, heizart: "fbh" });
    expect(fbhSatz(z)).toBe(`3 FBH-Verteiler, automatisch: 2 an «Fussbodenheizung», 1 an «Fussbodenheizung ${gastro.bezeichnung}».`);
  });
});
