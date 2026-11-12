import { describe, it, expect } from "vitest";
import { KATALOG_V1 } from "../src/welt/katalog.v1.js";
import { KATALOG_V2 } from "../src/welt/katalog.v2.js";
import { REGELWERK_V1 } from "../src/welt/regelwerk.v1.js";
import { REGELWERK_V2 } from "../src/welt/regelwerk.v2.js";
import { regelwerkFuer } from "../src/welt/regelwerk.wahl.js";
import { geschossRang, STANDORT_GESCHOSS, type RegelwerkV2 } from "../src/welt/regelwerk.js";

describe("Katalog v1", () => {
  it("10 eindeutige IDs im Format gruppe.typ", () => {
    const ids = KATALOG_V1.eintraege.map((e) => e.id);
    expect(ids).toHaveLength(10);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z]+\.[a-z_]+$/);
  });
  it("Heizart nur bei HK, FBH-Kreis und TABS-Feld", () => {
    expect(Object.fromEntries(KATALOG_V1.eintraege.filter((e) => e.heizArt).map((e) => [e.id, e.heizArt])))
      .toEqual({ "heizung.heizkoerper": "hk", "heizung.fbh_kreis": "fbh", "heizung.tabs_feld": "tabs" });
  });
});

describe("Regelwerk v1", () => {
  it("Erlaubt-Matrix nennt nur Katalog-IDs und bekannte Arten", () => {
    const ids = new Set(KATALOG_V1.eintraege.map((e) => e.id));
    for (const [art, liste] of Object.entries(REGELWERK_V1.erlaubt)) {
      expect(art === STANDORT_GESCHOSS || Object.hasOwn(REGELWERK_V1.einheitArten, art)).toBe(true);
      for (const id of liste) expect(ids.has(id)).toBe(true);
    }
  });
  it("Default-Flaechen gemaess Spec §3", () => {
    expect(Object.fromEntries(Object.entries(REGELWERK_V1.einheitArten).map(([k, v]) => [k, v.defaultFlaecheM2])))
      .toEqual({ buero: 120, wohnung: 90, gastro: 150, technik: 30, kern: 25, allgemein: 40 });
  });
  it("Zentrale nur in Technik und am Geschoss", () => {
    for (const [art, liste] of Object.entries(REGELWERK_V1.erlaubt))
      expect(liste.includes("heizung.waermepumpe")).toBe(art === "technik" || art === STANDORT_GESCHOSS);
  });
});

describe("geschossRang", () => {
  it("ordnet gueltige Codes", () => {
    expect(["UG3", "UG1", "EG", "OG1", "OG40", "DG", "DACH"].map(geschossRang)).toEqual([-3, -1, 0, 1, 40, 41, 42]);
  });
  it("lehnt Unbekanntes ab", () => {
    for (const c of ["UG4", "OG0", "OG41", "OG01", "og1", "1OG", ""]) expect(geschossRang(c)).toBeNull();
  });
});

describe("Katalog und Regelwerk v2", () => {
  it("jeder Eintrag hat Masse, v1-IDs bleiben, Zubehoer ergaenzt", () => {
    for (const e of KATALOG_V2.eintraege) expect(e.masse).toHaveLength(3);
    const ids = KATALOG_V2.eintraege.map((e) => e.id);
    for (const e of KATALOG_V1.eintraege) expect(ids).toContain(e.id);
    expect(ids).toEqual(expect.arrayContaining(["heizung.ventil_3weg", "heizung.ventil_2weg", "heizung.wmz"]));
    expect(KATALOG_V2.eintraege.find((e) => e.id === "heizung.umwaelzpumpe")?.bereich).toBe("zubehoer");
    expect(KATALOG_V2.eintraege.find((e) => e.id === "heizung.tabs_feld")?.masse).toEqual([0.6, 0.8, 0.15]);
  });
  it("erlaubt nennt nur Katalog-v2-IDs", () => {
    const ids = new Set(KATALOG_V2.eintraege.map((e) => e.id));
    for (const liste of Object.values(REGELWERK_V2.erlaubt)) for (const id of liste) expect(ids.has(id)).toBe(true);
    expect(REGELWERK_V2.erlaubt.technik).toContain("heizung.ventil_3weg");
    expect(REGELWERK_V2.erlaubt.kern).not.toContain("heizung.ventil_3weg");
  });
  it("Bestueckung je Gruppenart und Raummatrix", () => {
    const b = regelwerkFuer(2) as RegelwerkV2;
    expect(b.bestueckung.beimisch).toEqual([{ katalogId: "heizung.umwaelzpumpe", menge: 1 }, { katalogId: "heizung.ventil_3weg", menge: 1 }]);
    expect(b.bestueckung.ungeregelt).toEqual([{ katalogId: "heizung.umwaelzpumpe", menge: 1 }]);
    expect(b.bestueckung.drossel).toEqual([{ katalogId: "heizung.ventil_2weg", menge: 1 }]);
    expect(b.bestueckung.einspritz).toEqual([{ katalogId: "heizung.umwaelzpumpe", menge: 1 }, { katalogId: "heizung.ventil_2weg", menge: 1 }]);
    expect(b.bestueckung.umlenk).toEqual([{ katalogId: "heizung.ventil_3weg", menge: 1 }]);
    expect(b.raum.modulM).toBe(3);
    expect(b.raum.abgabe.dreiVier).toEqual([3, 3]);
  });
  it("regelwerkFuer waehlt Version oder wirft", () => {
    expect(regelwerkFuer(1)).toBe(REGELWERK_V1);
    expect(regelwerkFuer(2)).toBe(REGELWERK_V2);
    expect(() => regelwerkFuer(3)).toThrow();
  });
});
