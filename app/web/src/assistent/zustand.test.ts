import { describe, expect, it } from "vitest";
import { K } from "./bestueckung";
import { abgabenVon, geschossKurz, hauptverteiler, leererZustand, naechsteLfd, nummerieren, reduziere, SCHRITTE, type Aktion, type AssistentZustand } from "./zustand";

function neuesGebaeude(...aktionen: Aktion[]): AssistentZustand {
  let z = leererZustand("00000000-0000-4000-8000-000000000901");
  z = reduziere(z, { typ: "geschosse", ug: 1, og: 1 });
  z = reduziere(z, { typ: "gebaeudeAngelegt", id: "00000000-0000-4000-8000-000000000900", stand: 0,
    geschosse: [{ id: "00000000-0000-4000-8000-000000000001", code: "UG1" }, { id: "00000000-0000-4000-8000-000000000002", code: "EG" }, { id: "00000000-0000-4000-8000-000000000003", code: "OG1" }] });
  for (const a of aktionen) z = reduziere(z, a);
  return z;
}

describe("Abgaben folgen Standard und Ausnahmen", () => {
  it("neue Einheit erhält je wirksamer Abgabe eine Zeile «weiss nicht»", () => {
    const z = neuesGebaeude({ typ: "standard", art: "fbh", wert: "ja" }, { typ: "einheitNeu", geschoss: "EG", art: "buero" });
    const e = z.einheiten[0];
    expect(abgabenVon(z, e.schluessel).map((t) => [t.katalogId, t.menge, t.status])).toEqual([[K.hk, null, "bestaetigt"], [K.fbh, null, "bestaetigt"]]);
  });
  it("Ausnahme nein entfernt die Abgabe samt Gruppenzuteilung; Technik erhält keine Abgaben", () => {
    let z = neuesGebaeude({ typ: "einheitNeu", geschoss: "EG", art: "buero" }, { typ: "einheitNeu", geschoss: "UG1", art: "technik" }, { typ: "gruppenAnzahl", anzahl: 1 });
    const buero = z.einheiten[0].schluessel;
    const hk = abgabenVon(z, buero)[0].schluessel;
    z = reduziere(z, { typ: "verbraucher", gruppe: z.gruppen[0].schluessel, bauteil: hk, an: true });
    expect(hauptverteiler(z)!.versorgt).toEqual([buero]);
    z = reduziere(z, { typ: "ausnahme", einheit: buero, art: "hk", wert: "nein" });
    expect(abgabenVon(z, buero)).toEqual([]);
    expect(z.gruppen[0].verbraucher).toEqual([]);
    expect(hauptverteiler(z)!.versorgt).toEqual([]);
    expect(abgabenVon(z, z.einheiten[1].schluessel)).toEqual([]);
  });
  it("Ausnahme gleich Standard wird nicht gespeichert; unbekannt macht Mengen zum Vorschlag", () => {
    let z = neuesGebaeude({ typ: "einheitNeu", geschoss: "EG", art: "buero" });
    const e = z.einheiten[0].schluessel;
    z = reduziere(z, { typ: "ausnahme", einheit: e, art: "hk", wert: "ja" });
    expect(z.einheiten[0].ausnahme).toEqual({});
    z = reduziere(z, { typ: "abgabeAendern", schluessel: abgabenVon(z, e)[0].schluessel, menge: 4 });
    z = reduziere(z, { typ: "ausnahme", einheit: e, art: "hk", wert: "unbekannt" });
    expect(z.einheiten[0].ausnahme).toEqual({ hk: "unbekannt" });
    expect(abgabenVon(z, e)[0]).toMatchObject({ menge: 4, status: "vorgeschlagen" });
  });
});


describe("Version 2 – Schritte und Nummerierung", () => {
  it("sieben Schritte mit neuen Titeln", () => {
    expect(SCHRITTE.map((s) => s.titel)).toEqual(["Gebäude", "Geschosse & Einheiten", "Heizung", "Zentrale", "Gruppen & FBH-Verteiler", "Weitere Teile", "Prüfen"]);
  });
  it("Geschoss-Kurzform und Bezeichnung", () => {
    expect(["EG", "OG3", "OG12", "UG1", "DG"].map(geschossKurz)).toEqual(["0", "3", "12", "U1", "DG"]);
    expect(nummerieren("OG3", "buero", 1)).toBe("Büro 3.01");
    expect(nummerieren("EG", "gastro", 2)).toBe("Gastro 0.02");
    expect(nummerieren("UG1", "kern", 12)).toBe("Kern U1.12");
  });
  it("nächste laufende Nummer je Geschoss", () => {
    const e = (geschoss: string, bezeichnung: string) => ({ schluessel: bezeichnung, geschoss, bezeichnung, art: "buero", flaecheM2: null, ausnahme: {} });
    expect(naechsteLfd([], "OG1")).toBe(1);
    expect(naechsteLfd([e("OG1", "Büro 1.01"), e("OG1", "Kern 1.03"), e("OG2", "Büro 2.07")], "OG1")).toBe(4);
    expect(naechsteLfd([e("OG1", "Empfang")], "OG1")).toBe(2);
  });
  it("neue Einheiten werden je Geschoss nummeriert", () => {
    const z = neuesGebaeude({ typ: "einheitNeu", geschoss: "EG", art: "buero", anzahl: 2 }, { typ: "einheitNeu", geschoss: "EG", art: "kern" });
    expect(z.einheiten.map((e) => e.bezeichnung)).toEqual(["Büro 0.01", "Büro 0.02", "Kern 0.03"]);
  });
  it("einheitAnzahl erhöht und verringert je Nutzung", () => {
    let z = neuesGebaeude({ typ: "einheitAnzahl", geschoss: "EG", art: "buero", anzahl: 3 });
    expect(z.einheiten).toHaveLength(3);
    z = reduziere(z, { typ: "einheitAnzahl", geschoss: "EG", art: "buero", anzahl: 1 });
    expect(z.einheiten.map((e) => e.bezeichnung)).toEqual(["Büro 0.01"]);
  });
  it("Abgabe-Status folgt der wirksamen Heizart (H6)", () => {
    let z = neuesGebaeude({ typ: "einheitNeu", geschoss: "EG", art: "buero" });
    const hk = () => z.bauteile.find((t) => t.katalogId === K.hk)!;
    expect(hk().status).toBe("bestaetigt");
    z = reduziere(z, { typ: "abgabeWeissNicht", schluessel: hk().schluessel });
    expect(hk().status).toBe("bestaetigt");
    z = reduziere(z, { typ: "standard", art: "hk", wert: "unbekannt" });
    expect(hk().status).toBe("vorgeschlagen");
    z = reduziere(z, { typ: "standard", art: "hk", wert: "ja" });
    expect(hk().status).toBe("bestaetigt");
  });
});
