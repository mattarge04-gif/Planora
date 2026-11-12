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
import type { Rechteck } from "../src/welt/typen.js";

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

  describe.each(ALLE_MUSTER.map((m) => [m.schluessel] as const))("Raumkomposition %s", (schluessel) => {
    const w = weltVon(schluessel);
    const { beschreibung } = musterGeneratorEingabe(ALLE_MUSTER.find((m) => m.schluessel === schluessel)!);
    const rechteck = (id: string) => w.einheiten.find((e) => e.id === id)!.rechteck;
    const schnitt = (a: Rechteck, b: Rechteck) =>
      Math.max(0, Math.min(a.x + a.breite, b.x + b.breite) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.z + a.tiefe, b.z + b.tiefe) - Math.max(a.z, b.z));
    it("Einheiten eines Geschosses ueberlappen nicht und liegen im Grundriss", () => {
      for (const g of w.geschosse) {
        const es = w.einheiten.filter((e) => e.geschossId === g.id).map((e) => e.rechteck);
        for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) expect(schnitt(es[i], es[j])).toBeLessThan(1e-3);
        for (const r of es) expect(w.grundriss.reduce((s, x) => s + schnitt(x, r), 0)).toBeCloseTo(r.breite * r.tiefe, 2);
      }
    });
    it("Symbole liegen in ihrer Einheit; Gruppenzubehoer am Verteiler", () => {
      for (const s of w.symbole) {
        const t = beschreibung.bauteile.find((x) => x.id === s.bauteilIds[0])!;
        const r = rechteck(t.standort.einheitId!);
        expect(s.position.x).toBeGreaterThanOrEqual(r.x);
        expect(s.position.x).toBeLessThanOrEqual(r.x + r.breite);
        expect(s.position.z).toBeGreaterThanOrEqual(r.z);
        expect(s.position.z).toBeLessThanOrEqual(r.z + r.tiefe);
      }
      for (const g of w.gruppen!) for (const z of g.zubehoer)
        expect(w.symbole.find((s) => s.schluessel === z)!.position).toEqual(w.symbole.find((s) => s.schluessel === g.verteiler)!.position);
    });
    it("Steigzone liegt im Grundriss", () => {
      expect(w.steigzone).not.toBeNull();
      expect(w.grundriss.some((r) => w.steigzone!.x >= r.x && w.steigzone!.x <= r.x + r.breite && w.steigzone!.z >= r.z && w.steigzone!.z <= r.z + r.tiefe)).toBe(true);
    });
  });

  it("Steigzone: Mitte des Kerns (m6), Ecke der Zentrale zur Gebaeudemitte (m2)", () => {
    const m6 = weltVon("m6-l-u-viele-gruppen");
    const kern = m6.einheiten.find((e) => e.art === "kern")!.rechteck;
    expect(m6.steigzone).toEqual({ x: Math.round((kern.x + kern.breite / 2) * 1000) / 1000, z: Math.round((kern.z + kern.tiefe / 2) * 1000) / 1000 });
    const m2 = weltVon("m2-beispiel");
    const t = m2.einheiten.find((e) => e.bezeichnung === "Technik")!.rechteck;
    const ecken = [[t.x, t.z], [t.x + t.breite, t.z], [t.x, t.z + t.tiefe], [t.x + t.breite, t.z + t.tiefe]];
    const naechste = Math.min(...ecken.map(([x, z]) => Math.hypot(x - m2.steigzone!.x, z - m2.steigzone!.z)));
    expect(naechste).toBeCloseTo(0.3 * Math.SQRT2, 6);
    const mitte = { x: m2.grundriss[0].breite / 2, z: m2.grundriss[0].tiefe / 2 };
    const abstand = (x: number, z: number) => Math.hypot(x - mitte.x, z - mitte.z);
    const ecke = ecken.find(([x, z]) => Math.hypot(x - m2.steigzone!.x, z - m2.steigzone!.z) < 0.5)!;
    expect(abstand(ecke[0], ecke[1])).toBe(Math.min(...ecken.map(([x, z]) => abstand(x, z))));
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
        const w = weltErzeugen(h, b, REGELWERK_V2);
        expect(w.gruppen!.length).toBeGreaterThan(0);
        // abgeleitete Masse (Spec 4.5): Aussenmass des Grundrisses, nach dem Schreiben gespeichert
        expect(h.breiteM).toBe(Math.max(...w.grundriss.map((r) => r.x + r.breite)));
        expect(h.tiefeM).toBe(Math.max(...w.grundriss.map((r) => r.z + r.tiefe)));
      }
      const name = (await c.query("select name from liegenschaft where id=$1", [r.liegenschaftId])).rows[0].name;
      expect(name).toBe("Muster Stufe 1");
    } finally { c.release(); }
  });
});
