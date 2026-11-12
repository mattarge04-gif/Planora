import { describe, expect, it } from "vitest";
import * as THREE from "three";
import type { KatalogEintrag, Welt, WeltSymbol } from "../typen";
import { TOKENS } from "../design/tokens";
import { kameraSeiten, POLAR_GRENZEN, wandBleibt } from "./schnitt";
import { waendeVon } from "../szene2/huelle";
import { bewegungsAnteil, rohrGeschosse, separationsOffsets, sichtbareGeschosse } from "./darstellung";
import { anlageSichtbar, rohrSchnitt } from "./technik";
import { durchgaenge, rohrnetz } from "./netz";
import { fahrtSchritt } from "./kameraFahrt";
import { tastaturSchritt } from "./kamera";
import { HINTERGRUND, kontaktLichtZiel, SCHATTEN } from "./qualitaet";

const richtung = (grad: number): [number, number, number] => [Math.sin(grad * Math.PI / 180), 1, Math.cos(grad * Math.PI / 180)];
describe("360 Grad und Achsengrenzen", () => {
  it.each([5, 45, 85, 95, 135, 175, 185, 225, 265, 275, 315, 355])("zeigt bei %s Grad genau die beiden rückwärtigen Wände", (grad) => {
    const r = richtung(grad), s = kameraSeiten(r);
    expect(s[0]).toBe(Math.sign(r[0])); expect(s[2]).toBe(Math.sign(r[2]));
    const w = waendeVon({ x: 0, z: 0, breite: 30, tiefe: 15 });
    expect(w.filter((w) => wandBleibt(w.normale, true, s))).toHaveLength(2);
    expect(w.every((w) => wandBleibt(w.normale, false, s))).toBe(true);
  });
  it("hält die Seite bei kleinen Richtungswechseln an jeder Achse und schaltet erst ausserhalb der Hysterese", () => {
    for (const achse of [0, 90, 180, 270, 360]) {
      const vorher = kameraSeiten(richtung(achse - 5));
      for (const d of [-2, 0, 1, -1, 2]) expect(kameraSeiten(richtung(achse + d), vorher)).toBe(vorher);
      expect(kameraSeiten(richtung(achse + 5), vorher)).not.toEqual(vorher);
    }
    const alt: [number, number, number] = [1, 1, -1]; expect(kameraSeiten([0, 1, 0], alt)).toBe(alt);
  });
  it("lässt weder einen Blick unter die Platte noch einen senkrechten Blick ohne räumliche Tiefe zu", () => {
    expect(POLAR_GRENZEN.min).toBeCloseTo(20 * Math.PI / 180);
    expect(POLAR_GRENZEN.max).toBeCloseTo(75 * Math.PI / 180);
    expect(Math.cos(POLAR_GRENZEN.max)).toBeGreaterThan(0.2);
    expect(Math.sin(POLAR_GRENZEN.min)).toBeGreaterThan(0.2);
  });
  it("bietet Pfeile und Plus/Minus ohne die Kameragrenzen zu überschreiten", () => {
    expect(tastaturSchritt("ArrowUp", 0, POLAR_GRENZEN.min, 20)?.polar).toBe(POLAR_GRENZEN.min);
    expect(tastaturSchritt("ArrowDown", 0, POLAR_GRENZEN.max, 20)?.polar).toBe(POLAR_GRENZEN.max);
    expect(tastaturSchritt("ArrowRight", 0, 0.7, 20)?.azimut).toBeGreaterThan(0);
    expect(tastaturSchritt("ArrowLeft", 0, 0.7, 20)?.azimut).toBeLessThan(0);
    expect(tastaturSchritt("+", 0, 0.7, 20)?.zoom).toBe(23);
    expect(tastaturSchritt("-", 0, 0.7, 20)?.zoom).toBeCloseTo(20 / 1.15);
    expect(tastaturSchritt("Escape", 0, 0.7, 20)).toBeNull();
  });
});

// Ausschliesslich Testdaten: das Produkt erhält dadurch keine erfundenen Untergeschosse oder Anlagen.
const symbol = (key: string, id: string, y: number, versorgt: string[] = []): WeltSymbol => ({
  schluessel: key, katalogId: id, position: { x: key === "wp" ? 2 : 4, y, z: 3 }, versorgt,
  bauteilIds: [key], status: "bestaetigt", hersteller: null, typ: null, mengeSumme: 1, mengeUnbekannt: false,
});
const ugWelt: Welt = { regelwerkVersion: 1, hash: "nur-test-ug", grundriss: [{ x: 0, z: 0, breite: 12, tiefe: 10 }], hinweise: [],
  geschosse: [{ id: "og", code: "OG1", yUnten: 3.2, hoehe: 3.2 }, { id: "ug", code: "UG", yUnten: -3, hoehe: 3 }, { id: "eg", code: "EG", yUnten: 0, hoehe: 3.2 }],
  einheiten: [{ id: "e0", geschossId: "eg", bezeichnung: "Test EG", art: "buero", quelle: "schematisch", rechteck: { x: 0, z: 0, breite: 12, tiefe: 10 } },
    { id: "e1", geschossId: "og", bezeichnung: "Test OG", art: "buero", quelle: "schematisch", rechteck: { x: 0, z: 0, breite: 12, tiefe: 10 } }],
  symbole: [symbol("wp", "heizung.waermepumpe", -3), symbol("v", "heizung.verteiler", -3, ["e0", "e1"]), symbol("hk", "heizung.heizkoerper", 0), symbol("fbh", "heizung.fbh_kreis", 3.2)] };
const katalog: KatalogEintrag[] = [{ id: "heizung.waermepumpe", name: "Wärmepumpe", bereich: "zentrale" }, { id: "heizung.verteiler", name: "Verteiler", bereich: "verteilung" }];
describe("Untergeschosse und reduzierte Bewegung", () => {
  it("schneidet UG/EG/OG1 samt Anlagen korrekt und separiert ab dem tiefsten Geschoss", () => {
    expect(sichtbareGeschosse(ugWelt, "ug")).toEqual(["ug"]);
    expect(sichtbareGeschosse(ugWelt, "eg")).toEqual(["ug", "eg"]);
    expect(ugWelt.symbole.map((s) => anlageSichtbar(ugWelt, "ug", s))).toEqual([true, true, false, false]);
    const offsets = separationsOffsets(ugWelt, true);
    expect(offsets.ug).toBe(0); expect(offsets.eg).toBeCloseTo(2.4); expect(offsets.og).toBeCloseTo(4.96);
  });
  it("führt Rohre aus dem UG durch den EG-Boden und trennt sie für das Separieren je Geschoss", () => {
    const n = rohrnetz(ugWelt, katalog, {});
    const h = n.flatMap((r) => durchgaenge(ugWelt, r.punkte, r.radius));
    expect(h.some((h) => h.art === "decke" && Math.abs(h.position[1] - 0.045) < 1e-6)).toBe(true);
    const t = n.flatMap((r) => rohrGeschosse(ugWelt, r.punkte, ["ug", "eg", "og"]));
    expect(new Set(t.map((t) => t.geschossId))).toEqual(new Set(["ug", "eg", "og"]));
    expect(n.flatMap((r) => rohrSchnitt(r.punkte, -0.25)).every((p) => p.every((p) => p[1] <= -0.25))).toBe(true);
  });
  it("springt für Kamera, Separieren und Hover ohne Zwischenbild zum Ziel", () => {
    for (const ms of [TOKENS.bewegung.kameraMs, TOKENS.bewegung.separierenMs, TOKENS.bewegung.hoverMs]) expect(bewegungsAnteil(0, ms, true)).toBe(1);
    const nach = { position: [5, 8, 9] as [number, number, number], ziel: [1, -3, 2] as [number, number, number], zoom: 70 };
    expect(fahrtSchritt({ von: { ...nach, zoom: 10 }, nach, ms: 0 }, 0, TOKENS.bewegung.kameraMs, true)).toEqual({ ansicht: nach, rest: null });
    expect(0.04 * bewegungsAnteil(0, TOKENS.bewegung.hoverMs, true)).toBe(0.04);
  });
});

describe("Hintergrund und Kontaktschatten", () => {
  it("legt den Token-Grund hinter einen transparenten schwarzen Puffer statt ihn doppelt tonemappen zu lassen", () => {
    expect(HINTERGRUND.css).toBe(TOKENS.farbe.grund); expect(HINTERGRUND.clearAlpha).toBe(0); expect(HINTERGRUND.clearColor).toBe(0);
    expect(SCHATTEN.frames).toBeGreaterThanOrEqual(128); expect(SCHATTEN.sonnenMap).toBeGreaterThanOrEqual(2048);
  });
  it("richtet auch verborgene Accumulative-Lichter auf den Geschossmittelpunkt und erfasst randnahe Geräte", () => {
    const root = new THREE.Group(), verborgen = new THREE.Group(), licht = new THREE.DirectionalLight(), ziel = new THREE.Object3D();
    verborgen.traverse = () => {}; root.add(verborgen, ziel); verborgen.add(licht);
    ziel.position.set(15, -3, 7.5); licht.position.set(20, 9, 12.5);
    licht.shadow.camera = new THREE.OrthographicCamera(-22.5, 22.5, 22.5, -22.5, 0.1, 100);
    kontaktLichtZiel(root, ziel); expect(licht.target).toBe(ziel); expect(licht.shadow.needsUpdate).toBe(true);
    root.updateMatrixWorld(true); licht.shadow.updateMatrices(licht);
    const p = new THREE.Vector3(29, -3, 4).project(licht.shadow.camera);
    expect(Math.abs(p.x)).toBeLessThan(1); expect(Math.abs(p.y)).toBeLessThan(1);
  });
});
