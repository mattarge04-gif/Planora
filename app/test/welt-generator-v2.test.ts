import { describe, it, expect } from "vitest";
import { weltErzeugen } from "../src/welt/generator.js";
import { REGELWERK_V1 } from "../src/welt/regelwerk.v1.js";
import { REGELWERK_V2 } from "../src/welt/regelwerk.v2.js";
import type { Beschreibung, HuelleGespeichert } from "../src/welt/typen.js";
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

describe("weltErzeugen (Regelwerk v2, Stub)", () => {
  it("v1 bleibt bitgleich: Hash des Beispiels unveraendert, keine v2-Felder", () => {
    const w = weltErzeugen(huelleFixture(), beschreibungFixture(), REGELWERK_V1);
    expect(w.hash).toBe("8aba5017cfc3abaf99a243522656bca8b2e2ab64d055698cac24578be9925b44");
    expect(w).not.toHaveProperty("gruppen");
    expect(w).not.toHaveProperty("steigzone");
  });
  it("rendert ohne Masse (Standard 30 x 15) mit regelwerkVersion 2", () => {
    const w = weltErzeugen(huelleV2(), beschreibungV2(), REGELWERK_V2);
    expect(w.regelwerkVersion).toBe(2);
    expect(w.grundriss).toEqual([{ x: 0, z: 0, breite: 30, tiefe: 15 }]);
    expect(w.gruppen).toBeDefined();
  });
  it("gleiche Pumpen in zwei Gruppen derselben Einheit bleiben zwei Symbole", () => {
    const w = weltErzeugen(huelleV2(), beschreibungV2(), REGELWERK_V2);
    const pumpen = w.symbole.filter((s) => s.katalogId === "heizung.umwaelzpumpe");
    expect(pumpen).toHaveLength(2);
    expect(pumpen.map((s) => s.ort)).toEqual([{ gruppe: G(40) }, { gruppe: G(41) }]);
  });
  it("Gruppen loesen Verbraucher und Zubehoer zu Symbolschluesseln auf", () => {
    const w = weltErzeugen(huelleV2(), beschreibungV2(), REGELWERK_V2);
    const key = (id: string) => w.symbole.find((s) => s.bauteilIds.includes(id))!.schluessel;
    expect(w.gruppen).toHaveLength(2);
    expect(w.gruppen![0]).toMatchObject({ id: G(40), verteiler: key(G(32)), nummer: 1, verbraucher: [key(G(30)), key(G(31))], zubehoer: [key(G(50))] });
    expect(w.gruppen![1].zubehoer).toEqual([key(G(51))]);
  });
  it("steigzone: Mitte der Einheit mit dem ersten Erzeuger, sonst null; Kern hat Vorrang", () => {
    const b = beschreibungV2();
    expect(weltErzeugen(huelleV2(), b, REGELWERK_V2).steigzone).toBeNull();
    b.bauteile.push({ id: G(60), katalogId: "heizung.waermepumpe", standort: { einheitId: G(21) }, menge: 1, status: "bestaetigt", versorgt: [] });
    const w = weltErzeugen(huelleV2(), b, REGELWERK_V2);
    const r = w.einheiten.find((e) => e.id === G(21))!.rechteck;
    expect(w.steigzone).toEqual({ x: Math.round((r.x + r.breite / 2) * 1000) / 1000, z: Math.round((r.z + r.tiefe / 2) * 1000) / 1000 });
    b.einheiten.push({ id: G(23), geschossId: G(10), bezeichnung: "K", art: "kern", flaecheM2: null });
    const w2 = weltErzeugen(huelleV2(), b, REGELWERK_V2);
    const k = w2.einheiten.find((e) => e.id === G(23))!.rechteck;
    expect(w2.steigzone).toEqual({ x: Math.round((k.x + k.breite / 2) * 1000) / 1000, z: Math.round((k.z + k.tiefe / 2) * 1000) / 1000 });
  });
  it("ist deterministisch", () => {
    expect(weltErzeugen(huelleV2(), beschreibungV2(), REGELWERK_V2)).toEqual(weltErzeugen(huelleV2(), beschreibungV2(), REGELWERK_V2));
  });
});
