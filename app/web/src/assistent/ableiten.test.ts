import { describe, expect, it } from "vitest";
import { K } from "./bestueckung";
import { leererZustand, reduziere, unterverteiler, type Aktion, type AssistentZustand } from "./zustand";

function haus(...aktionen: Aktion[]): AssistentZustand {
  let z = reduziere(leererZustand("l"), { typ: "geschosse", ug: 1, og: 2 });
  z = reduziere(z, { typ: "gebaeudeAngelegt", id: "00000000-0000-4000-8000-000000000900", stand: 0,
    geschosse: z.gebaeude.geschosse.map((g, i) => ({ id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`, code: g.code })) });
  for (const a of aktionen) z = reduziere(z, a);
  return z;
}
/** UG1 Technik, EG Gastro, OG1/OG2 je 2 Büros; FBH in OG2 und Gastro; WP gewählt. */
const basis = (): AssistentZustand => haus(
  { typ: "einheitAnzahl", geschoss: "UG1", art: "technik", anzahl: 1 },
  { typ: "einheitAnzahl", geschoss: "EG", art: "gastro", anzahl: 1 },
  { typ: "einheitAnzahl", geschoss: "OG1", art: "buero", anzahl: 2 },
  { typ: "einheitAnzahl", geschoss: "OG2", art: "buero", anzahl: 2 },
  { typ: "geschossAusnahme", geschoss: "OG2", art: "fbh", wert: "ja" },
  { typ: "geschossAusnahme", geschoss: "EG", art: "fbh", wert: "ja" },
  { typ: "erzeuger", katalogId: K.waermepumpe },
);
const zu5 = (z: AssistentZustand) => reduziere(z, { typ: "schritt", nr: 5 });

describe("FBH-Verteiler automatisch (H4)", () => {
  it("je Einheit mit FBH ein vorgeschlagener FBH-Verteiler", () => {
    const z = basis();
    const uv = unterverteiler(z);
    expect(uv).toHaveLength(3);
    expect(uv.every((t) => t.auto && t.fbh && t.status === "vorgeschlagen")).toBe(true);
  });
  it("FBH weg → automatischer Verteiler weg; abgewählt bleibt abgewählt", () => {
    let z = basis();
    z = reduziere(z, { typ: "geschossAusnahme", geschoss: "EG", art: "fbh", wert: null });
    expect(unterverteiler(z)).toHaveLength(2);
    const e = z.einheiten.find((x) => x.geschoss === "OG2")!;
    z = reduziere(z, { typ: "unterverteiler", einheit: e.schluessel, an: false });
    z = reduziere(z, { typ: "standard", art: "tabs", wert: "nein" });
    expect(unterverteiler(z)).toHaveLength(1);
  });
  it("Wärmezähler an allen, auch an später entstehenden", () => {
    let z = reduziere(basis(), { typ: "fbhWmzAlle", an: true });
    const wmzAn = (zz: AssistentZustand) => unterverteiler(zz).every((t) => zz.bauteile.some((w) => w.katalogId === K.wmz && w.ort && "vorBauteil" in w.ort && w.ort.vorBauteil === t.schluessel));
    expect(wmzAn(z)).toBe(true);
    z = reduziere(z, { typ: "geschossAusnahme", geschoss: "OG1", art: "fbh", wert: "ja" });
    expect(unterverteiler(z)).toHaveLength(5);
    expect(wmzAn(z)).toBe(true);
  });
  it("Hauptverteiler ist nie ein FBH-Verteiler", () => {
    const z = zu5(basis());
    const haupt = z.bauteile.find((t) => t.katalogId === K.verteiler && !t.fbh)!;
    expect(z.gruppen.every((g) => g.verteiler === haupt.schluessel)).toBe(true);
  });
});

describe("Gruppen vorschlagen (H3)", () => {
  it("beim ersten Betreten von Schritt 5: je Heizart eine Gruppe, alle Verbraucher zugeordnet", () => {
    const z = zu5(basis());
    expect(z.gruppen.map((g) => [g.bezeichnung, g.art])).toEqual([["Heizkörper", "ungeregelt"], ["Fussbodenheizung", "beimisch"]]);
    const hk = z.gruppen[0], fbh = z.gruppen[1];
    expect(hk.verbraucher).toHaveLength(z.bauteile.filter((t) => t.katalogId === K.hk).length);
    expect(fbh.verbraucher.sort()).toEqual(unterverteiler(z).map((t) => t.schluessel).sort());
    expect(z.gruppenVorgeschlagen).toBe(true);
  });
  it("Regel-Gruppen folgen späteren Änderungen", () => {
    let z = zu5(basis());
    z = reduziere(z, { typ: "einheitAnzahl", geschoss: "OG1", art: "buero", anzahl: 3 });
    expect(z.gruppen[0].verbraucher).toHaveLength(z.bauteile.filter((t) => t.katalogId === K.hk).length);
  });
  it("Teilen nach Geschossen und Sondergruppe je Einheit", () => {
    let z = zu5(basis());
    z = reduziere(z, { typ: "gruppeTeilen", gruppe: z.gruppen[0].schluessel, geschosse: ["OG2"] });
    const og2 = z.gruppen.find((g) => g.regel?.geschosse?.includes("OG2"))!;
    expect(og2.bezeichnung).toBe("Heizkörper OG2");
    const gastro = z.einheiten.find((e) => e.art === "gastro")!;
    z = reduziere(z, { typ: "sondergruppe", einheit: gastro.schluessel, heizart: "fbh" });
    const sonder = z.gruppen.find((g) => g.regel?.einheit === gastro.schluessel)!;
    expect(sonder.verbraucher).toHaveLength(1);
    expect(z.gruppen.find((g) => g.bezeichnung === "Fussbodenheizung")!.verbraucher).toHaveLength(2);
  });
  it("Umhängen einzelner Verbraucher friert die Gruppen ein und bestätigt den FBH-Verteiler", () => {
    let z = zu5(basis());
    const uv = unterverteiler(z)[0];
    z = reduziere(z, { typ: "verbraucher", gruppe: z.gruppen[0].schluessel, bauteil: uv.schluessel, an: true });
    expect(z.gruppen[0].angefasst).toBe(true);
    expect(z.gruppen[1].angefasst).toBe(true);
    const t = z.bauteile.find((x) => x.schluessel === uv.schluessel)!;
    expect([t.auto, t.status]).toEqual([false, "bestaetigt"]);
    z = reduziere(z, { typ: "einheitAnzahl", geschoss: "OG1", art: "buero", anzahl: 3 });
    expect(z.gruppen[0].verbraucher).toContain(uv.schluessel);
  });
  it("Gebäude ohne Automatik bleibt wie bisher", () => {
    let z = basis();
    z = { ...z, automatik: false, gruppenVorgeschlagen: true };
    z = zu5(z);
    expect(z.gruppen).toHaveLength(0);
  });
  it("Zentrale-Raum vorbelegt, wenn genau eine Technik-Einheit existiert", () => {
    const z = haus({ typ: "einheitAnzahl", geschoss: "UG1", art: "technik", anzahl: 1 });
    expect(z.zentraleRaum).toBe(z.einheiten[0].schluessel);
  });
});
