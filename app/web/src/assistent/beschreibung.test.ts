import { describe, expect, it } from "vitest";
import m2 from "./__fixtures__/m2-beispiel.json";
import m3 from "./__fixtures__/m3-zubehoer.json";
import m5 from "./__fixtures__/m5-fbh-ueber-geschosse.json";
import type { BeschreibungEingabe, Grundform } from "../typen";
import { ausBeschreibung, grundformAusWelt, zuBeschreibung, zuBeschreibungMitPositionen } from "./beschreibung";
import { K } from "./bestueckung";
import { leererZustand, reduziere, type Aktion, type AssistentZustand } from "./zustand";

type Fixture = { huelle: { name: string; grundform: string; geschosse: { id: string; code: string }[] }; beschreibung: BeschreibungEingabe };
const laden = (f: Fixture) => {
  const b: BeschreibungEingabe = { ...f.beschreibung, geschosse: f.huelle.geschosse };
  return { b, z: ausBeschreibung(b, { name: f.huelle.name, grundform: f.huelle.grundform as Grundform }) };
};

/** Neues Gebäude mit angelegten Geschossen; danach Aktionen wie im Assistenten. */
function neuesGebaeude(...aktionen: Aktion[]): AssistentZustand {
  let z = leererZustand("00000000-0000-4000-8000-000000000901");
  z = reduziere(z, { typ: "geschosse", ug: 1, og: 1 });
  z = reduziere(z, { typ: "gebaeudeAngelegt", id: "00000000-0000-4000-8000-000000000900", stand: 0,
    geschosse: [{ id: "00000000-0000-4000-8000-000000000001", code: "UG1" }, { id: "00000000-0000-4000-8000-000000000002", code: "EG" }, { id: "00000000-0000-4000-8000-000000000003", code: "OG1" }] });
  for (const a of aktionen) z = reduziere(z, a);
  return z;
}

describe("Rundlauf Beschreibung ↔ Zustand", () => {
  for (const [name, f] of [["m2", m2], ["m3", m3], ["m5", m5]] as const) {
    it(`${name}: ausBeschreibung(zuBeschreibung(z)) = z`, () => {
      const { z } = laden(f as Fixture);
      const z2 = ausBeschreibung(zuBeschreibung(z), { name: z.gebaeude.name, grundform: z.gebaeude.grundform });
      expect(z2).toEqual(z);
    });
    it(`${name}: zuBeschreibung(ausBeschreibung(b)) enthält dieselben Elemente und Verweise`, () => {
      const { b, z } = laden(f as Fixture);
      const b2 = zuBeschreibung(z);
      expect(b2.einheiten).toEqual(b.einheiten);
      expect(b2.gruppen).toEqual(b.gruppen);
      // Leere Zusatzfelder (null) gibt zuBeschreibung explizit aus; die Muster lassen sie weg.
      const ohneNull = (t: object) => Object.fromEntries(Object.entries(t).filter(([, v]) => v !== null));
      expect(b2.bauteile.map((t) => ({ ...ohneNull(t), menge: t.menge }))).toEqual(b.bauteile.map((t) => ({ ...ohneNull(t), menge: t.menge })));
    });
  }

  it("m2: Gruppen, Zubehör und Zentrale werden erkannt", () => {
    const { z } = laden(m2 as Fixture);
    expect(z.gruppen.map((g) => [g.bezeichnung, g.art, g.verbraucher.length])).toEqual([["HK Buero", "ungeregelt", 2], ["FBH", "beimisch", 3]]);
    expect(z.einheiten.find((e) => e.schluessel === z.zentraleRaum)?.bezeichnung).toBe("Technik");
    expect(z.einheiten.find((e) => e.bezeichnung === "Restaurant")?.ausnahme).toEqual({ hk: "nein", fbh: "ja" });
  });

  it("neue Elemente: Verweise per Index, Rundlauf über Positionen stabil", () => {
    const z = neuesGebaeude(
      { typ: "einheitNeu", geschoss: "EG", art: "buero", anzahl: 2 },
      { typ: "erzeuger", katalogId: K.waermepumpe },
      { typ: "gruppenAnzahl", anzahl: 1 },
    );
    const b = zuBeschreibung(z);
    expect(b.einheiten.every((e) => e.id === undefined)).toBe(true);
    expect(b.bauteile.find((t) => t.katalogId === K.waermepumpe)?.standort).toEqual({ einheitIndex: 2 }); // Technik automatisch angelegt
    const z1 = ausBeschreibung(b);
    expect(ausBeschreibung(zuBeschreibung(z1))).toEqual(z1);
  });

  it("weiss nicht → status vorgeschlagen, menge null", () => {
    let z = neuesGebaeude({ typ: "einheitNeu", geschoss: "EG", art: "buero" });
    const hk = z.bauteile.find((t) => t.katalogId === K.hk)!;
    z = reduziere(z, { typ: "abgabeAendern", schluessel: hk.schluessel, menge: 6 });
    expect(zuBeschreibung(z).bauteile[0]).toMatchObject({ menge: 6, status: "bestaetigt" });
    z = reduziere(z, { typ: "abgabeWeissNicht", schluessel: hk.schluessel });
    expect(zuBeschreibung(z).bauteile[0]).toMatchObject({ katalogId: K.hk, menge: null, status: "vorgeschlagen" });
  });

  it("vorgeschlagene Bestückung → vorgeschlagen, geänderte → bestätigt", () => {
    let z = neuesGebaeude({ typ: "einheitNeu", geschoss: "EG", art: "buero" }, { typ: "gruppenAnzahl", anzahl: 1 });
    const g = z.gruppen[0];
    z = reduziere(z, { typ: "gruppeArt", schluessel: g.schluessel, art: "beimisch" });
    const zub = () => zuBeschreibung(z).bauteile.filter((t) => t.ort && "gruppe" in t.ort);
    expect(zub().map((t) => [t.katalogId, t.menge, t.status])).toEqual([[K.pumpe, 1, "vorgeschlagen"], [K.ventil3, 1, "vorgeschlagen"]]);
    z = reduziere(z, { typ: "bestueckung", gruppe: g.schluessel, katalogId: K.pumpe, delta: 1 });
    expect(zub().map((t) => [t.katalogId, t.menge, t.status])).toEqual([[K.pumpe, 2, "bestaetigt"], [K.ventil3, 1, "vorgeschlagen"]]);
  });

  it("Gruppenzubehör bekommt ort.gruppe (Index) und den Standort des Verteilers", () => {
    let z = neuesGebaeude({ typ: "einheitNeu", geschoss: "EG", art: "buero" }, { typ: "gruppenAnzahl", anzahl: 2 });
    z = reduziere(z, { typ: "gruppeWmz", gruppe: z.gruppen[1].schluessel, an: true });
    const b = zuBeschreibung(z);
    const vIndex = b.bauteile.findIndex((t) => t.katalogId === K.verteiler);
    const wmz = b.bauteile.find((t) => t.katalogId === K.wmz)!;
    expect(wmz.ort).toEqual({ gruppe: { gruppeIndex: 1 } });
    expect(wmz.standort).toEqual(b.bauteile[vIndex].standort);
    expect(b.gruppen![1].verteiler).toEqual({ bauteilIndex: vIndex });
    for (const t of b.bauteile.filter((x) => x.ort && "gruppe" in x.ort)) expect(t.standort).toEqual(b.bauteile[vIndex].standort);
  });

  it("Positionen ordnen Platzhalter-IDs der Vorschau den Schlüsseln zu", () => {
    const z = neuesGebaeude({ typ: "einheitNeu", geschoss: "EG", art: "buero", anzahl: 2 });
    const { positionen } = zuBeschreibungMitPositionen(z);
    expect(positionen.einheiten).toEqual(z.einheiten.map((e) => e.schluessel));
    expect(positionen.bauteile).toEqual(z.bauteile.map((t) => t.schluessel));
  });

  it("Grundform aus dem Grundriss der Welt", () => {
    const r = { x: 0, z: 0, breite: 10, tiefe: 5 };
    expect(grundformAusWelt({ grundriss: [r] })).toBe("quader");
    expect(grundformAusWelt({ grundriss: [{ ...r, tiefe: 10 }] })).toBe("quadrat");
    expect(grundformAusWelt({ grundriss: [r, r] })).toBe("l_form");
    expect(grundformAusWelt({ grundriss: [r, r, r] })).toBe("u_form");
  });
});
