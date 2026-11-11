import { describe, it, expect } from "vitest";
import { weltErzeugen } from "../src/welt/generator.js";
import { REGELWERK_V1 } from "../src/welt/regelwerk.v1.js";
import { G, huelleFixture, beschreibungFixture } from "./hilfe-welt.js";

const welt = (b = beschreibungFixture(), h = huelleFixture()) => weltErzeugen(h, b, REGELWERK_V1);

describe("weltErzeugen", () => {
  it("ist deterministisch: gleiche Eingabe, gleicher Hash", () => {
    const a = welt(), b = welt();
    expect(a).toEqual(b);
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.regelwerkVersion).toBe(1);
  });
  it("Aenderung der Eingabe aendert den Hash", () => {
    const b = beschreibungFixture(); b.einheiten[0].flaecheM2 = 200;
    expect(welt(b).hash).not.toBe(welt().hash);
  });
  it("stapelt Geschosse nach Rang: UG unter 0, EG auf 0", () => {
    expect(welt().geschosse).toEqual([
      { id: G(9), code: "UG1", yUnten: -2.5, hoehe: 2.5 },
      { id: G(10), code: "EG", yUnten: 0, hoehe: 3 },
      { id: G(11), code: "OG1", yUnten: 3, hoehe: 3.5 },
    ]);
  });
  it("Grundformen quader, l_form, u_form", () => {
    expect(welt().grundriss).toEqual([{ x: 0, z: 0, breite: 30, tiefe: 15 }]);
    expect(welt(undefined, huelleFixture("l_form")).grundriss).toEqual([{ x: 0, z: 0, breite: 30, tiefe: 6 }, { x: 0, z: 6, breite: 12, tiefe: 9 }]);
    expect(welt(undefined, huelleFixture("u_form")).grundriss).toEqual([
      { x: 0, z: 0, breite: 30, tiefe: 6 }, { x: 0, z: 6, breite: 12, tiefe: 9 }, { x: 18, z: 6, breite: 12, tiefe: 9 }]);
  });
  it("Einheiten als Streifen, Breite nach Default-Flaeche der Art", () => {
    const e = welt().einheiten;
    expect(e.map((x) => [x.id, x.rechteck, x.quelle])).toEqual([
      [G(20), { x: 0, z: 0, breite: 24, tiefe: 15 }, "schematisch"],  // Buero 120
      [G(21), { x: 24, z: 0, breite: 6, tiefe: 15 }, "schematisch"],  // Technik 30
      [G(22), { x: 0, z: 0, breite: 30, tiefe: 15 }, "schematisch"],  // allein auf OG1
    ]);
  });
  it("ein Symbol je Typgruppe, unabhaengig von der Menge; zwei Hersteller = zwei Symbole", () => {
    const hk = welt().symbole.filter((s) => s.katalogId === "heizung.heizkoerper");
    expect(hk.map((s) => [s.hersteller, s.mengeSumme, s.bauteilIds])).toEqual([["Zehnder", 100, [G(30)]], ["Prolux", 1, [G(31)]]]);
    expect(hk.map((s) => s.position)).toEqual([{ x: 6, y: 0, z: 7.5 }, { x: 18, y: 0, z: 7.5 }]);
  });
  it("Zeilen derselben Gruppe werden zusammengefasst; vorgeschlagen gewinnt", () => {
    const b = beschreibungFixture();
    b.bauteile.push({ id: G(33), katalogId: "heizung.heizkoerper", standort: { einheitId: G(20) }, menge: 2, status: "vorgeschlagen", hersteller: "Zehnder", versorgt: [] });
    const s = welt(b).symbole.find((x) => x.hersteller === "Zehnder")!;
    expect([s.bauteilIds, s.mengeSumme, s.status]).toEqual([[G(30), G(33)], 102, "vorgeschlagen"]);
  });
  it("Menge unbekannt wird markiert, nicht als Null gezaehlt", () => {
    const b = beschreibungFixture(); b.bauteile[1].menge = null;
    const s = welt(b).symbole.find((x) => x.hersteller === "Prolux")!;
    expect([s.mengeSumme, s.mengeUnbekannt]).toEqual([0, true]);
  });
  it("Standort und Versorgung getrennt: Verteiler im EG versorgt Einheiten auf EG und OG1 (sortiert)", () => {
    const v = welt().symbole.find((s) => s.katalogId === "heizung.verteiler")!;
    expect(v.position.y).toBe(0);
    expect(v.versorgt).toEqual([G(20), G(22)]);
  });
  it("manuelles Layout bleibt, Ueberlappung wird als Hinweis gemeldet", () => {
    const b = beschreibungFixture();
    b.einheiten[2].layoutManuell = { x: 0, z: 0, breite: 10, tiefe: 15 };
    b.einheiten.push({ id: G(23), geschossId: G(11), bezeichnung: "D", art: "buero", flaecheM2: null });
    const w = welt(b);
    expect(w.einheiten.find((e) => e.id === G(22))).toMatchObject({ rechteck: { x: 0, z: 0, breite: 10, tiefe: 15 }, quelle: "manuell" });
    expect(w.hinweise).toEqual([{ code: "ueberlappung", bezug: G(23) }]);
  });
  it("manuelle Bauteilposition hat Vorrang", () => {
    const b = beschreibungFixture(); b.bauteile[0].positionManuell = { x: 1, z: 2 };
    expect(welt(b).symbole[0].position).toEqual({ x: 1, y: 0, z: 2 });
  });
  it("Bauteil direkt am Geschoss steht in der Gebaeudemitte", () => {
    const b = beschreibungFixture();
    b.bauteile.push({ id: G(34), katalogId: "heizung.waermepumpe", standort: { geschossId: G(9) }, menge: 1, status: "bestaetigt", versorgt: [] });
    expect(welt(b).symbole.find((s) => s.katalogId === "heizung.waermepumpe")!.position).toEqual({ x: 15, y: -2.5, z: 7.5 });
  });
  it("Gruppenschluessel ist injektiv: Trennzeichen in Hersteller/Typ verschmelzen keine Gruppen", () => {
    const b = beschreibungFixture();
    b.bauteile.push({ id: G(35), katalogId: "heizung.verteiler", standort: { einheitId: G(22) }, menge: 1, status: "bestaetigt", hersteller: "A|B", typ: "C", versorgt: [] });
    b.bauteile.push({ id: G(36), katalogId: "heizung.verteiler", standort: { einheitId: G(22) }, menge: 1, status: "bestaetigt", hersteller: "A", typ: "B|C", versorgt: [] });
    const s = welt(b).symbole.filter((x) => x.bauteilIds.includes(G(35)) || x.bauteilIds.includes(G(36)));
    expect(s.map((x) => x.bauteilIds)).toEqual([[G(35)], [G(36)]]);
  });
  it("l_form: Bauteil direkt am Geschoss liegt im groessten Teilrechteck (Riegel)", () => {
    const b = beschreibungFixture();
    b.bauteile.push({ id: G(34), katalogId: "heizung.waermepumpe", standort: { geschossId: G(9) }, menge: 1, status: "bestaetigt", versorgt: [] });
    const w = welt(b, huelleFixture("l_form"));
    const p = w.symbole.find((s) => s.katalogId === "heizung.waermepumpe")!.position;
    const r = w.grundriss[0];
    expect(p.x).toBeGreaterThan(r.x); expect(p.x).toBeLessThan(r.x + r.breite);
    expect(p.z).toBeGreaterThan(r.z); expect(p.z).toBeLessThan(r.z + r.tiefe);
  });
  it("l_form: zwei Bauteile am selben Geschoss erhalten verschiedene Positionen im Riegel", () => {
    const b = beschreibungFixture();
    b.bauteile.push({ id: G(34), katalogId: "heizung.waermepumpe", standort: { geschossId: G(9) }, menge: 1, status: "bestaetigt", versorgt: [] });
    b.bauteile.push({ id: G(37), katalogId: "heizung.verteiler", standort: { geschossId: G(9) }, menge: 1, status: "bestaetigt", versorgt: [] });
    const w = welt(b, huelleFixture("l_form"));
    const r = w.grundriss[0];
    const p = w.symbole.filter((s) => s.position.y === -2.5).map((s) => s.position);
    expect(p).toHaveLength(2);
    expect(p[0]).not.toEqual(p[1]);
    for (const q of p) { expect(q.z).toBeGreaterThan(r.z); expect(q.z).toBeLessThan(r.z + r.tiefe); }
  });
  it("widersprechende Positionen in einer Gruppe: erste Zeile gewinnt, Hinweis", () => {
    const b = beschreibungFixture();
    b.bauteile[0].positionManuell = { x: 1, z: 2 };
    b.bauteile.push({ id: G(33), katalogId: "heizung.heizkoerper", standort: { einheitId: G(20) }, menge: 2, status: "bestaetigt", hersteller: "Zehnder", positionManuell: { x: 3, z: 4 }, versorgt: [] });
    const w = welt(b);
    const s = w.symbole.find((x) => x.hersteller === "Zehnder")!;
    expect(s.position).toEqual({ x: 1, y: 0, z: 2 });
    expect(w.hinweise).toContainEqual({ code: "position_widerspruch", bezug: s.schluessel });
  });
  it("zwei sich ueberlappende manuelle Einheiten: Hinweis nur fuer die spaetere", () => {
    const b = beschreibungFixture();
    b.einheiten[2].layoutManuell = { x: 0, z: 0, breite: 10, tiefe: 15 };
    b.einheiten.push({ id: G(23), geschossId: G(11), bezeichnung: "D", art: "buero", flaecheM2: null, layoutManuell: { x: 5, z: 0, breite: 10, tiefe: 15 } });
    expect(welt(b).hinweise).toEqual([{ code: "ueberlappung", bezug: G(23) }]);
  });
  it("manuelle Einheit ausserhalb der Auto-Flaechen: keine Hinweise", () => {
    const b = beschreibungFixture();
    b.einheiten.push({ id: G(23), geschossId: G(11), bezeichnung: "D", art: "buero", flaecheM2: null, layoutManuell: { x: 40, z: 0, breite: 5, tiefe: 5 } });
    expect(welt(b).hinweise).toEqual([]);
  });
  it("verlangt gespeicherte IDs", () => {
    const b = beschreibungFixture(); delete b.einheiten[0].id;
    expect(() => welt(b)).toThrow(/IDs/);
  });
});
