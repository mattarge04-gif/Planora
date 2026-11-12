import { describe, expect, it } from "vitest";
import * as THREE from "three";
import type { KatalogEintrag, Welt, WeltSymbol } from "../typen";
import { durchgaenge, freieVerteilerAbgaenge, rohrnetz, verbindungen } from "./netz";
import { bandGeometrie, huelsenGeometrie, rohrGeometrie } from "./technikGeometrie";
import { ROHR, rohrPfad } from "./technik";

const s = (key: string, id: string, x: number, y: number, z: number, versorgt: string[] = []): WeltSymbol => ({
  schluessel: key, katalogId: `heizung.${id}`, position: { x, y, z }, versorgt,
  bauteilIds: [`bauteil-${key}`], mengeSumme: 1, mengeUnbekannt: false, hersteller: null, typ: null, status: "bestaetigt",
});
const katalog: KatalogEintrag[] = [
  { id: "heizung.waermepumpe", name: "Wärmepumpe", bereich: "zentrale" },
  { id: "heizung.speicher", name: "Speicher", bereich: "zentrale" },
  { id: "heizung.verteiler", name: "Verteiler", bereich: "verteilung" },
];
const welt: Welt = {
  regelwerkVersion: 1, hash: "netz", grundriss: [{ x: 0, z: 0, breite: 30, tiefe: 15 }], hinweise: [],
  geschosse: [{ id: "eg", code: "EG", yUnten: 0, hoehe: 3.2 }, { id: "og", code: "OG1", yUnten: 3.2, hoehe: 3.2 }],
  einheiten: [
    { id: "technik", geschossId: "eg", art: "technik", bezeichnung: "Technik", rechteck: { x: 27, z: 0, breite: 3, tiefe: 15 }, quelle: "schematisch" },
    { id: "eg-raum", geschossId: "eg", art: "buero", bezeichnung: "EG", rechteck: { x: 0, z: 0, breite: 27, tiefe: 15 }, quelle: "schematisch" },
    { id: "og-a", geschossId: "og", art: "buero", bezeichnung: "OG A", rechteck: { x: 0, z: 0, breite: 15, tiefe: 15 }, quelle: "schematisch" },
    { id: "og-b", geschossId: "og", art: "buero", bezeichnung: "OG B", rechteck: { x: 15, z: 0, breite: 15, tiefe: 15 }, quelle: "schematisch" },
  ],
  symbole: [s("wp", "waermepumpe", 27.75, 0, 3.75), s("speicher", "speicher", 29.25, 0, 3.75), s("v", "verteiler", 27.75, 0, 11.25, ["eg-raum", "og-a"]),
    s("hk", "heizkoerper", 12, 0, 7.5), s("fbh-a", "fbh_kreis", 7.5, 3.2, 7.5), s("fbh-b", "fbh_kreis", 22.5, 3.2, 7.5)],
};
const anschluesse = {
  "/modelle/heizung.waermepumpe.glb": [-0.25, 1.2, -0.08] as [number, number, number],
  "/modelle/heizung.speicher.glb": [0, 1.48, 0.49] as [number, number, number],
  "/modelle/heizung.verteiler.glb": [-0.6, 0.62, 0.02] as [number, number, number],
  "/modelle/heizung.heizkoerper.glb": [0.445, 0.05, 0] as [number, number, number],
  "/modelle/heizung.fbh_kreis.glb": [-0.262, 0.06, -0.02] as [number, number, number],
};

describe("Geschlossenes Techniknetz", () => {
  it("schaltet ausschliesslich vorhandene Zentrale als Erzeuger → Speicher → Verteiler", () => {
    expect(verbindungen(welt, katalog).filter((v) => v.art === "haupt")).toEqual([
      { art: "haupt", von: "wp", nach: "speicher" }, { art: "haupt", von: "speicher", nach: "v" },
    ]);
    const ohne = { ...welt, symbole: welt.symbole.filter((s) => s.schluessel !== "speicher") };
    expect(verbindungen(ohne, katalog).filter((v) => v.art === "haupt")).toEqual([{ art: "haupt", von: "wp", nach: "v" }]);
    expect(verbindungen({ ...welt, symbole: [] }, katalog)).toEqual([]);
  });
  it("verbindet jeden vorhandenen FBH-Schrank und ersetzt Einheitsmitten durch vorhandene Abgaben", () => {
    const v = verbindungen(welt, katalog).filter((v) => v.art === "verteil");
    expect(v.map((v) => v.nach).sort()).toEqual(["fbh-a", "fbh-b", "hk"]);
    expect(v.every((v) => v.von === "v")).toBe(true);
  });
  it("erhält eine gekappte Versorgung nur dort, wo tatsächlich keine Abgabe vorhanden ist", () => {
    const w = { ...welt, symbole: welt.symbole.filter((s) => s.schluessel !== "hk") };
    expect(verbindungen(w, katalog).some((v) => v.nach === "eg-raum")).toBe(true);
    expect(rohrnetz(w, katalog, anschluesse).some((r) => r.daten.nach === "eg-raum" && r.frei)).toBe(true);
  });
  it("trifft echte Empty-Koordinaten und verbindet jedes Anschlussstück lückenlos mit dem Rohr", () => {
    const n = rohrnetz(welt, katalog, anschluesse);
    for (const symbol of welt.symbole) {
      const a = anschluesse[`/modelle/${symbol.katalogId}.glb` as keyof typeof anschluesse];
      const p = [symbol.position.x + a[0], symbol.position.y + a[1], symbol.position.z + a[2]];
      const adapter = n.find((r) => JSON.stringify(r.punkte[0]) === JSON.stringify(p));
      expect(adapter).toBeDefined();
      const ende = adapter!.punkte.at(-1)!;
      expect(n.some((r) => r !== adapter && r.punkte.some((q) => q.every((v, i) => v === ende[i])))).toBe(true);
    }
  });
  it("schliesst Anschlussstücke und Hauptrohre auf derselben Tangente an", () => {
    const n = rohrnetz(welt, katalog, anschluesse);
    for (const adapter of n.filter((r) => r.radius < r.endRadius)) {
      const ende = adapter.punkte.at(-1)!, davor = adapter.punkte.at(-2)!;
      const tangent = new THREE.Vector3(...ende).sub(new THREE.Vector3(...davor)).normalize();
      const haupt = n.find((r) => r.radius === r.endRadius && [r.punkte[0], r.punkte.at(-1)!].some((p) => p.every((x, i) => x === ende[i])))!;
      const punkte = haupt.punkte[0].every((x, i) => x === ende[i]) ? haupt.punkte : [...haupt.punkte].reverse();
      const nachbar = punkte.slice(1).find((p) => p.some((x, i) => x !== ende[i]))!;
      expect(Math.abs(tangent.dot(new THREE.Vector3(...nachbar).sub(new THREE.Vector3(...ende)).normalize()))).toBeCloseTo(1);
    }
  });
  it("führt Raumdurchgänge unter der Decke (0.40 m unter Geschossoberkante) und die wandnahe Verteilerzuleitung direkt auf Balkenhöhe durch die Wand", () => {
    const n = rohrnetz(welt, katalog, anschluesse);
    const h = n.flatMap((r) => durchgaenge(welt, r.punkte, r.radius));
    expect(h.filter((h) => h.art === "wand").length).toBeGreaterThan(0);
    expect(h.filter((h) => h.art === "wand").every((h) => [2.8, 0.62, 6].some((y) => Math.abs(y - h.position[1]) < 1e-6))).toBe(true);
    for (const r of n.filter((r) => r.radius < r.endRadius && ["wp", "speicher", "v"].some((id) => r.daten.bauteilIds.includes(`bauteil-${id}`)))) {
      expect(r.punkte.every((p) => p[0] > 27.09 && p[0] < 29.91 && p[2] > 0 && p[2] < 15)).toBe(true);
    }
  });
  it("verbindet die Raumleitungen mit getrennten vorhandenen Ventilstutzen statt mit dem Verteiler-Eingang", () => {
    const n = rohrnetz(welt, katalog, anschluesse);
    const abgaenge = n.filter((r) => r.daten.von === "v" && r.daten.bauteilIds.length === 1 && r.daten.bauteilIds[0] === "bauteil-v");
    expect(abgaenge).toHaveLength(3);
    expect(abgaenge.map((r) => r.punkte[0][0] - 27.75)).toEqual(expect.arrayContaining([expect.closeTo(-0.36), expect.closeTo(-0.12), expect.closeTo(0.12)]));
    expect(abgaenge.every((r) => r.punkte[0][1] === 1 && r.punkte[0][2] === 11.27)).toBe(true);
    const kappen = freieVerteilerAbgaenge(welt, katalog);
    expect(kappen).toHaveLength(1); expect(kappen[0].position[0]).toBeCloseTo(28.11);
  });
  it("belässt am Verteiler-Eingang einen geraden Rohrquerschnitt und zeigt die Hülse auch auf Zentraleseite", () => {
    const n = rohrnetz(welt, katalog, anschluesse);
    const eingang = n.find((r) => r.daten.nach === "v" && r.daten.bauteilIds.length === 1 && r.daten.bauteilIds[0] === "bauteil-v")!;
    expect(eingang.punkte[0]).toEqual([27.15, 0.62, 11.27]);
    expect(eingang.punkte[1][1]).toBe(0.62); expect(eingang.punkte[1][2]).toBe(11.27);
    expect(eingang.radius).toBe(ROHR.haupt); expect(eingang.startRadius).toBe(0.035);
    const h = durchgaenge(welt, eingang.punkte, eingang.radius).filter((h) => h.art === "wand");
    expect(h.some((h) => h.position[0] > 27.13 && h.normale[0] === 1)).toBe(true);
    expect(h.some((h) => h.position[0] < 26.87 && h.normale[0] === -1)).toBe(true);
  });
  it("hält Verteilerbögen zylindrisch und reduziert nur kurz direkt am Stutzen", () => {
    const n = rohrnetz(welt, katalog, anschluesse);
    const r = n.find((r) => r.daten.nach === "v" && r.daten.bauteilIds.length === 1 && r.daten.bauteilIds[0] === "bauteil-v")!;
    const g = rohrGeometrie(r)!, position = g.getAttribute("position"), pfad = rohrPfad(r.punkte, r.radius), ringe = pfad.curves.length * 16;
    expect(new THREE.Vector3().fromBufferAttribute(position, 0).distanceTo(pfad.getPointAt(0))).toBeCloseTo(0.035, 5);
    for (let i = 1; i <= ringe; i++) {
      const mitte = pfad.getPointAt(i / ringe);
      if (mitte.distanceTo(pfad.getPointAt(0)) < 0.04) continue;
      expect(new THREE.Vector3().fromBufferAttribute(position, i * 13).distanceTo(mitte)).toBeCloseTo(ROHR.haupt, 5);
    }
    expect(n.find((r) => r.daten.von === "wp" && r.daten.bauteilIds.length === 1)?.startRadius).toBe(0.026);
    g.dispose();
  });
  it("hat auf OG1 einen durchgehenden Steigstrang mit Hülsen auf beiden Plattenseiten", () => {
    const h = rohrnetz(welt, katalog, anschluesse).flatMap((r) => durchgaenge(welt, r.punkte, r.radius));
    expect(h.some((h) => h.art === "decke" && Math.abs(h.position[1] - 3.245) < 1e-6)).toBe(true);
    expect(h.some((h) => h.art === "decke" && Math.abs(h.position[1] - 2.93) < 1e-6)).toBe(true);
  });
  it("erzeugt je Wandpassage zwei gegenläufige Hülsen und keine am nur berührten Endpunkt", () => {
    const h = durchgaenge(welt, [[26, 0.3, 8], [28, 0.3, 8]], ROHR.haupt);
    expect(h).toHaveLength(2);
    expect(h.map((h) => h.normale)).toEqual([[-1, 0, 0], [1, 0, 0]]);
    expect(durchgaenge(welt, [[26, 0.3, 8], [27, 0.3, 8]], ROHR.haupt)).toEqual([]);
  });
  it("führt einen Abgang nahe der hinteren Raumgrenze zurück in die Einheit", () => {
    const w = { ...welt, symbole: welt.symbole.map((s) => s.schluessel === "fbh-b" ? { ...s, position: { ...s.position, z: 14.8 } } : s) };
    const n = rohrnetz(w, katalog, anschluesse), adapter = n.find((r) => r.daten.bauteilIds.includes("bauteil-fbh-b") && r.radius < r.endRadius)!;
    expect(adapter.punkte.at(-1)![2]).toBeLessThan(14.8);
    for (const r of n) expect(Array.from(rohrGeometrie(r)!.getAttribute("position").array).every(Number.isFinite)).toBe(true);
  });
});

describe("Band und Rohrübergang", () => {
  it("zeichnet das FBH-Muster als flaches Band mit Wendebogen", () => {
    const g = bandGeometrie([[0, 0.032, 0], [4, 0.032, 0], [4, 0.032, 1.6], [0, 0.032, 1.6]])!;
    const p = g.getAttribute("position");
    expect(Array.from({ length: p.count }, (_, i) => p.getY(i)).every((y) => Math.abs(y - 0.032) < 1e-6)).toBe(true);
    expect(p.count).toBeGreaterThan(20); g.dispose();
  });
  it("endet mit exakt passendem Hauptrohrradius ohne sprunghaften Anschluss", () => {
    const r = rohrnetz(welt, katalog, anschluesse).find((r) => r.radius < r.endRadius)!;
    const g = rohrGeometrie(r)!, p = g.getAttribute("position"), ende = new THREE.Vector3(...r.punkte.at(-1)!);
    expect(new THREE.Vector3().fromBufferAttribute(p, p.count - 1).distanceTo(ende)).toBeCloseTo(r.endRadius, 5);
    expect(Array.from(p.array).every(Number.isFinite)).toBe(true); g.dispose();
    const h = huelsenGeometrie(ROHR.haupt); expect(h.getAttribute("position").count).toBeGreaterThan(0); h.dispose();
  });
});
