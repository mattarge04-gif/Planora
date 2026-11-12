import { describe, expect, it } from "vitest";
import { K } from "./bestueckung";
import { SCHNELL, geschosseAbsteigend, schnellAktion } from "./schritte/Schritt2Einheiten";
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
  it("«+3 Büros» erzeugt drei Einheiten «Büro 1–3»", () => {
    const drei = SCHNELL.find((s) => s.text === "3 Büros")!;
    let z = angelegt(0, 1, schnellAktion("EG", drei));
    expect(z.einheiten.map((e) => [e.geschoss, e.bezeichnung, e.art])).toEqual([["EG", "Büro 1", "buero"], ["EG", "Büro 2", "buero"], ["EG", "Büro 3", "buero"]]);
    z = reduziere(z, schnellAktion("OG1", drei));
    expect(z.einheiten.slice(3).map((e) => e.bezeichnung)).toEqual(["Büro 4", "Büro 5", "Büro 6"]);
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
    expect(z.bauteile.map((t) => t.katalogId)).toEqual([K.hk, K.fbh]);
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
