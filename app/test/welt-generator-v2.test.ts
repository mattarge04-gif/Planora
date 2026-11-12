import { describe, it, expect } from "vitest";
import { weltErzeugen } from "../src/welt/generator.js";
import { REGELWERK_V1 } from "../src/welt/regelwerk.v1.js";
import { REGELWERK_V2 } from "../src/welt/regelwerk.v2.js";
import { steigzone } from "../src/welt/raum/steigzone.js";
import type { Beschreibung, HuelleGespeichert, Rechteck, Welt } from "../src/welt/typen.js";
import { G, huelleFixture, beschreibungFixture } from "./hilfe-welt.js";

const huelleV2 = (): HuelleGespeichert => ({ ...huelleFixture(), breiteM: null, tiefeM: null, regelwerkVersion: 2 });
/** HK 30/31 in A, Verteiler 32 in B, zwei Pumpen gleicher Art in B, je in einer Gruppe. */
function beschreibungV2(): Beschreibung {
  const b = beschreibungFixture();
  b.bauteile.push(
    { id: G(50), katalogId: "heizung.umwaelzpumpe", standort: { einheitId: G(21) }, menge: 1, status: "bestaetigt", versorgt: [], ort: { gruppe: { gruppeId: G(40) } } },
    { id: G(51), katalogId: "heizung.umwaelzpumpe", standort: { einheitId: G(21) }, menge: 1, status: "bestaetigt", versorgt: [], ort: { gruppe: { gruppeId: G(41) } } },
  );
  b.gruppen = [
    { id: G(40), verteiler: { bauteilId: G(32) }, nummer: 1, art: "ungeregelt", bezeichnung: "Gruppe 1", verbraucher: [{ bauteilId: G(30) }, { bauteilId: G(31) }] },
    { id: G(41), verteiler: { bauteilId: G(32) }, nummer: 2, art: "ungeregelt", bezeichnung: "Gruppe 2", verbraucher: [] },
  ];
  return b;
}
const welt = (b = beschreibungV2(), h = huelleV2()) => weltErzeugen(h, b, REGELWERK_V2);
const rechteckVon = (w: Welt, id: string) => w.einheiten.find((e) => e.id === id)!.rechteck;
const innen = (r: Rechteck, p: { x: number; z: number }) => p.x >= r.x && p.x <= r.x + r.breite && p.z >= r.z && p.z <= r.z + r.tiefe;
const mm = (v: number) => Math.round(v * 1000) / 1000;

describe("weltErzeugen (Regelwerk v2)", () => {
  it("v1 bleibt bitgleich: Hash des Beispiels unveraendert, keine v2-Felder", () => {
    const w = weltErzeugen(huelleFixture(), beschreibungFixture(), REGELWERK_V1);
    expect(w.hash).toBe("8aba5017cfc3abaf99a243522656bca8b2e2ab64d055698cac24578be9925b44");
    expect(w).not.toHaveProperty("gruppen");
    expect(w).not.toHaveProperty("steigzone");
  });
  it("Groesse aus dem Inhalt: A (2 Symbole) 3 x 2, B (1 Geraet) 2 x 2 -> Mindestgebaeude 4 x 5 Module", () => {
    const w = welt();
    expect(w.regelwerkVersion).toBe(2);
    expect(w.grundriss).toEqual([{ x: 0, z: 0, breite: 12, tiefe: 15 }]);
    expect(rechteckVon(w, G(20))).toEqual({ x: 0, z: 0, breite: 12, tiefe: 6 }); // Reihe 0, gestreckt
    expect(rechteckVon(w, G(21))).toEqual({ x: 0, z: 9, breite: 12, tiefe: 6 }); // Reihe 1
    expect(rechteckVon(w, G(22))).toEqual({ x: 0, z: 0, breite: 12, tiefe: 6 }); // OG1
  });
  it("Gebaeudelaenge = laengste Reihe ueber alle Geschosse; Masse der Huelle werden ignoriert", () => {
    const b = beschreibungV2();
    for (let i = 0; i < 6; i++) b.einheiten.push({ id: G(70 + i), geschossId: G(11), bezeichnung: `O${i}`, art: "buero", flaecheM2: null });
    const w = welt(b);
    expect(w.grundriss).toEqual([{ x: 0, z: 0, breite: 24, tiefe: 15 }]); // OG1: 7 Raeume a 2 -> Reihen 8 / 6
    expect(welt(b, { ...huelleV2(), breiteM: 99, tiefeM: 77 })).toEqual(w);
    expect(rechteckVon(w, G(20)).breite).toBe(24); // EG fuellt ebenfalls die volle Laenge
  });
  it("gleiche Pumpen in zwei Gruppen derselben Einheit bleiben zwei Symbole und sitzen am Verteiler", () => {
    const w = welt();
    const pumpen = w.symbole.filter((s) => s.katalogId === "heizung.umwaelzpumpe");
    expect(pumpen).toHaveLength(2);
    expect(pumpen.map((s) => s.ort)).toEqual([{ gruppe: G(40) }, { gruppe: G(41) }]);
    const verteiler = w.symbole.find((s) => s.katalogId === "heizung.verteiler")!;
    for (const p of pumpen) expect(p.position).toEqual(verteiler.position);
  });
  it("Gruppen loesen Verbraucher und Zubehoer zu Symbolschluesseln auf", () => {
    const w = welt();
    const key = (id: string) => w.symbole.find((s) => s.bauteilIds.includes(id))!.schluessel;
    expect(w.gruppen).toHaveLength(2);
    expect(w.gruppen![0]).toMatchObject({ id: G(40), verteiler: key(G(32)), nummer: 1, verbraucher: [key(G(30)), key(G(31))], zubehoer: [key(G(50))] });
    expect(w.gruppen![1].zubehoer).toEqual([key(G(51))]);
  });
  it("Symbole liegen in ihrer Einheit", () => {
    const w = welt();
    for (const s of w.symbole) {
      const t = beschreibungV2().bauteile.find((x) => x.id === s.bauteilIds[0])!;
      expect(innen(rechteckVon(w, t.standort.einheitId!), s.position)).toBe(true);
    }
  });
  it("Hinweise gruppe_leer und ohne_gruppe (nicht blockierend)", () => {
    expect(welt().hinweise.filter((h) => h.code === "gruppe_leer")).toEqual([{ code: "gruppe_leer", bezug: G(41) }]);
    expect(welt().hinweise.filter((h) => h.code === "ohne_gruppe")).toEqual([]);
    const b = beschreibungV2();
    b.gruppen![0].verbraucher = [{ bauteilId: G(30) }];
    const w = welt(b);
    const prolux = w.symbole.find((s) => s.bauteilIds.includes(G(31)))!.schluessel;
    expect(w.hinweise.filter((h) => h.code === "ohne_gruppe")).toEqual([{ code: "ohne_gruppe", bezug: prolux }]);
  });
  it("ohne_gruppe: Abgaben unter einem Unterverteiler, der Verbraucher einer Gruppe ist, gelten als versorgt", () => {
    const b = beschreibungV2();
    b.bauteile.push(
      { id: G(60), katalogId: "heizung.verteiler", standort: { einheitId: G(22) }, menge: 1, status: "bestaetigt", versorgt: [{ einheitId: G(22) }] },
      { id: G(61), katalogId: "heizung.fbh_kreis", standort: { einheitId: G(22) }, menge: 3, status: "bestaetigt", versorgt: [] },
    );
    const ohne = (x: Beschreibung) => welt(x).hinweise.filter((h) => h.code === "ohne_gruppe").length;
    expect(ohne(b)).toBe(1);
    b.gruppen![1].verbraucher = [{ bauteilId: G(60) }];
    expect(ohne(b)).toBe(0);
  });
  it("layoutManuell hat Vorrang, Ueberlappung erzeugt Hinweis", () => {
    const b = beschreibungV2();
    b.einheiten[1].layoutManuell = { x: 1, z: 1, breite: 4, tiefe: 4 };
    const w = welt(b);
    expect(rechteckVon(w, G(21))).toEqual({ x: 1, z: 1, breite: 4, tiefe: 4 });
    expect(w.einheiten.find((e) => e.id === G(21))!.quelle).toBe("manuell");
    expect(w.hinweise).toContainEqual({ code: "ueberlappung", bezug: G(20) });
  });
  it("steigzone: ohne Erzeuger und Kern null; sonst Ecke der Zentrale zur Gebaeudemitte; Kern hat Vorrang", () => {
    const b = beschreibungV2();
    expect(welt(b).steigzone).toBeNull();
    b.bauteile.push({ id: G(60), katalogId: "heizung.waermepumpe", standort: { einheitId: G(21) }, menge: 1, status: "bestaetigt", versorgt: [] });
    const w = welt(b);
    // B in Reihe 1 (z 9..15), Gebaeudemitte (6, 7.5): Ecken (0, 9) und (12, 9) gleich nah -> erste
    const r = rechteckVon(w, G(21));
    expect(r.z).toBe(9);
    expect(w.steigzone).toEqual({ x: mm(r.x + 0.3), z: mm(r.z + 0.3) });
    b.einheiten.push({ id: G(23), geschossId: G(11), bezeichnung: "K", art: "kern", flaecheM2: null });
    const w2 = welt(b);
    const k = rechteckVon(w2, G(23));
    expect(w2.steigzone).toEqual({ x: mm(k.x + k.breite / 2), z: mm(k.z + k.tiefe / 2) });
  });
  it("ist deterministisch", () => {
    expect(welt()).toEqual(welt());
  });
});

describe("steigzone", () => {
  const e = (id: string, geschossId: string, art: string, rechteck: Rechteck) => ({ id, geschossId, art, rechteck });
  const grundriss = [{ x: 0, z: 0, breite: 30, tiefe: 15 }];
  it("Mitte des Kerns im untersten Geschoss mit Kern", () => {
    const ein = [e("k2", "og", "kern", { x: 20, z: 0, breite: 6, tiefe: 6 }), e("k1", "eg", "kern", { x: 0, z: 9, breite: 6, tiefe: 6 })];
    expect(steigzone(ein, ["ug", "eg", "og"], "t", grundriss)).toEqual({ x: 3, z: 12 });
  });
  it("sonst Ecke der Zentrale zur Gebaeudemitte, 0.3 m nach innen", () => {
    const ein = [e("t", "eg", "technik", { x: 18, z: 9, breite: 6, tiefe: 6 })];
    expect(steigzone(ein, ["eg"], "t", grundriss)).toEqual({ x: 18.3, z: 9.3 });
  });
  it("ohne Kern und ohne Zentrale: null", () => {
    expect(steigzone([], ["eg"], null, grundriss)).toBeNull();
  });
});
