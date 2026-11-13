import { describe, expect, it } from "vitest";
import type { Welt } from "../../typen";
import { Belegung, ebenenFuer, gitterFuer, mitteVon, zelleVon } from "./raster";

const welt: Welt = { regelwerkVersion: 2, hash: "r", grundriss: [{ x: 0, z: 0, breite: 3, tiefe: 2 }], hinweise: [], symbole: [],
  geschosse: [{ id: "eg", code: "EG", yUnten: 0, hoehe: 3.2 }],
  einheiten: [{ id: "a", geschossId: "eg", bezeichnung: "a", art: "x", rechteck: { x: 0, z: 0, breite: 1.5, tiefe: 2 }, quelle: "schematisch" },
    { id: "b", geschossId: "eg", bezeichnung: "b", art: "x", rechteck: { x: 1.5, z: 0, breite: 1.5, tiefe: 2 }, quelle: "schematisch" }] };

describe("raster", () => {
  it("Zellen und Mitten sind invers", () => {
    const g = gitterFuer(welt);
    const [i, k] = zelleVon(g, 1.0, 0.5);
    const [x, z] = mitteVon(g, i, k);
    expect(Math.abs(x - 1.0)).toBeLessThanOrEqual(0.045 + 1e-9);
    expect(Math.abs(z - 0.5)).toBeLessThanOrEqual(0.045 + 1e-9);
  });
  it("Randzellen naeher als 0.15 m an der Aussenwand sind gesperrt", () => {
    const g = gitterFuer(welt), [i, k] = zelleVon(g, 0.05, 1);
    expect(g.innen[k * g.nx + i]).toBe(0);
  });
  it("Ebenen: Leitungsebene 2.8 und Ausweichebene 2.55", () => {
    expect(ebenenFuer(welt).get("eg")).toEqual([2.8, 2.55]);
  });
  it("verlegtes Rohr sperrt Achse und Nachbarzellen fuer fremde Netze", () => {
    const b = new Belegung(welt);
    b.belegen([[0.5, 2.8, 1], [2.5, 2.8, 1]], "n1");
    const g = b.gitter, [i, k] = zelleVon(g, 1.5, 1);
    expect(b.frei(2.8, i, k, "n2")).toBe(false);
    expect(b.frei(2.8, i, k + 1, "n2")).toBe(false);
    expect(b.frei(2.8, i, k + 2, "n2")).toBe(true);
    expect(b.frei(2.8, i, k, "n1")).toBe(true);
    expect(b.eigen(2.8, i, k, "n1")).toBe(true);
    expect(b.frei(2.55, i, k, "n2")).toBe(true);
  });
  it("Steigrohr sperrt beide Ebenen", () => {
    const b = new Belegung(welt), [i, k] = zelleVon(b.gitter, 1, 1);
    b.belegen([[1, 0.5, 1], [1, 2.8, 1]], "n1");
    expect(b.frei(2.8, i, k, "n2")).toBe(false);
    expect(b.frei(2.55, i, k, "n2")).toBe(false);
  });
  it("Innenwand kostet Zuschlag", () => {
    const b = new Belegung(welt); b.waende(welt);
    const [i, k] = zelleVon(b.gitter, 1.5, 1);
    expect(b.zusatz(2.8, i, k)).toBeGreaterThan(0);
  });
  it("hohes Geraet sperrt, niedriges nicht", () => {
    const b = new Belegung(welt);
    b.geraete([{ schluessel: "hoch", min: [0.5, 0, 0.5], max: [1, 2.7, 1] }, { schluessel: "tief", min: [2, 0, 0.5], max: [2.5, 1.2, 1] }]);
    const [i1, k1] = zelleVon(b.gitter, 0.75, 0.75), [i2, k2] = zelleVon(b.gitter, 2.25, 0.75);
    expect(b.frei(2.8, i1, k1, "n")).toBe(false);
    expect(b.frei(2.8, i2, k2, "n")).toBe(true);
  });
});
