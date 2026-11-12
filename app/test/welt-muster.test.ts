import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { frischeDb } from "./hilfe.js";
import { ALLE_MUSTER, MUSTER, MUSTER_M6U, musterGeneratorEingabe, musterGeschossIds } from "../src/welt/muster.js";
import { pruefeBeschreibung, type Bestand } from "../src/welt/pruefung.js";
import { weltErzeugen } from "../src/welt/generator.js";
import { REGELWERK_V2 } from "../src/welt/regelwerk.v2.js";
import { KATALOG_V2 } from "../src/welt/katalog.v2.js";
import { pruefeHuelle, ladeBeschreibung, ladeHuelle } from "../src/welt/speicher.js";
import { musterAnlegen } from "../src/welt/beispiel.js";

const leer = (geschossIds: string[]): Bestand => ({
  geschossIds: new Set(geschossIds), einheitIds: new Set(), bauteilIds: new Set(), einheitenManuell: new Set(), bauteileManuell: new Set(), gruppeIds: new Set(),
});
const fixture = (schluessel: string) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../web/src/fixtures/muster-${schluessel}.json`, import.meta.url)), "utf8"));
const weltVon = (schluessel: string) => {
  const e = musterGeneratorEingabe(ALLE_MUSTER.find((m) => m.schluessel === schluessel)!);
  return weltErzeugen(e.huelle, e.beschreibung, REGELWERK_V2);
};

describe("Mustergebaeude Stufe 1", () => {
  it("genau sechs Muster in Reihenfolge der Spec plus Variante m6u", () => {
    expect(MUSTER.map((m) => m.schluessel)).toEqual(["m1-ein-raum", "m2-beispiel", "m3-zubehoer", "m4-pumpe-vor-wp", "m5-fbh-ueber-geschosse", "m6-l-u-viele-gruppen"]);
    expect(ALLE_MUSTER).toHaveLength(7);
    expect(MUSTER_M6U.huelle.grundform).toBe("u_form");
  });

  describe.each(ALLE_MUSTER.map((m) => [m.schluessel, m] as const))("%s", (_, m) => {
    it("Huelle und Beschreibung bestehen die Pruefung (Regelwerk v2)", () => {
      expect(pruefeHuelle(m.huelle, REGELWERK_V2)).toEqual([]);
      const ids = musterGeschossIds(m);
      expect(pruefeBeschreibung({ ...m.beschreibung(ids), gebaeudeId: "x", stand: 0 }, leer(ids), REGELWERK_V2, KATALOG_V2)).toEqual([]);
    });
    it("weltErzeugen laeuft ohne Fehler und die Fixture entspricht der Generatorausgabe", () => {
      const { huelle, beschreibung } = musterGeneratorEingabe(m);
      const welt = weltErzeugen(huelle, beschreibung, REGELWERK_V2);
      expect(welt.regelwerkVersion).toBe(2);
      expect(welt.gruppen!.length).toBe(beschreibung.gruppen!.length);
      const f = fixture(m.schluessel);
      expect(f.hash).toBe(welt.hash);
      expect(f).toEqual(JSON.parse(JSON.stringify(welt)));
    });
  });

  it("Inhalte der Spec (ohne Koordinaten)", () => {
    expect(weltVon("m1-ein-raum").gruppen!.map((g) => g.art)).toEqual(["ungeregelt"]);
    const m2 = weltVon("m2-beispiel");
    expect(m2.gruppen!.map((g) => [g.bezeichnung, g.art, g.verbraucher.length])).toEqual([["HK Buero", "ungeregelt", 2], ["FBH", "beimisch", 3]]);
    const m3 = weltVon("m3-zubehoer");
    expect(m3.gruppen![0].zubehoer).toEqual([]);
    const z = m3.symbole.filter((s) => m3.gruppen![1].zubehoer.includes(s.schluessel));
    const menge = (f: (id: string) => boolean) => z.filter((s) => f(s.katalogId)).reduce((a, s) => a + s.mengeSumme, 0);
    expect(menge((k) => k === "heizung.umwaelzpumpe")).toBe(2); // gleiche Art in derselben Gruppe: ein Symbol, Menge summiert
    expect(menge((k) => k.startsWith("heizung.ventil"))).toBe(3);
    const m4 = weltVon("m4-pumpe-vor-wp");
    const wp = m4.symbole.find((s) => s.katalogId === "heizung.waermepumpe")!;
    expect(m4.symbole.some((s) => s.ort && "vorBauteil" in s.ort && s.ort.vorBauteil === wp.schluessel)).toBe(true);
    const m5 = weltVon("m5-fbh-ueber-geschosse");
    const verteiler = m5.symbole.filter((s) => s.katalogId === "heizung.verteiler");
    expect(verteiler).toHaveLength(2);
    expect(m5.gruppen![0].verbraucher).toEqual([verteiler[1].schluessel]);
    expect(m5.symbole.find((s) => s.katalogId === "heizung.wmz")!.ort).toEqual({ gruppe: m5.gruppen![0].id });
    const m6 = weltVon("m6-l-u-viele-gruppen");
    expect(m6.gruppen).toHaveLength(6);
    expect(new Set(m6.gruppen!.map((g) => g.art))).toEqual(new Set(["ungeregelt", "beimisch", "drossel", "einspritz", "umlenk"]));
    expect(m6.geschosse.map((g) => g.code)).toEqual(["UG1", "EG", "OG1"]);
  });

  it("Geschoss-IDs sind deterministisch", () => {
    expect(musterGeschossIds(MUSTER[5])).toEqual(["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002", "00000000-0000-4000-8000-000000000003"]);
  });
});

describe("musterAnlegen (Entwicklungsdaten)", () => {
  let db: Awaited<ReturnType<typeof frischeDb>>;
  beforeAll(async () => { db = await frischeDb(); }, 120_000);
  afterAll(async () => { await db.ende(); });
  it("legt alle Muster als v2-Gebaeude in der Liegenschaft Muster Stufe 1 an; Welt laesst sich erzeugen", async () => {
    const r = await musterAnlegen(db.pool);
    expect(r.gebaeudeIds).toHaveLength(ALLE_MUSTER.length);
    const c = await db.pool.connect();
    try {
      for (const id of r.gebaeudeIds) {
        const h = (await ladeHuelle(c, id))!, b = (await ladeBeschreibung(c, id))!;
        expect(h.regelwerkVersion).toBe(2);
        expect(weltErzeugen(h, b, REGELWERK_V2).gruppen!.length).toBeGreaterThan(0);
      }
      const name = (await c.query("select name from liegenschaft where id=$1", [r.liegenschaftId])).rows[0].name;
      expect(name).toBe("Muster Stufe 1");
    } finally { c.release(); }
  });
});
