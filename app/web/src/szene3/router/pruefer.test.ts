import { describe, expect, it } from "vitest";
import { boegen, segAbstand } from "./geometrie";
import { pruefen } from "./pruefer";
import type { Koerper, PruefLeitung, V3 } from "./typen";

const L = (id: string, netz: string, punkte: V3[], radius = 0.045, enden: string[] = []): PruefLeitung => ({ id, netz, punkte, radius, enden });
const regeln = (b: ReturnType<typeof pruefen>) => b.map((x) => x.regel).sort();

describe("geometrie", () => {
  it("Segmentabstand paralleler Strecken", () => {
    expect(segAbstand([0, 0, 0], [1, 0, 0], [0, 0, 0.3], [1, 0, 0.3]).d).toBeCloseTo(0.3);
  });
  it("Boegen zaehlen", () => {
    expect(boegen([[0, 0, 0], [1, 0, 0], [2, 0, 0]])).toBe(0);
    expect(boegen([[0, 0, 0], [1, 0, 0], [1, 0, 1], [2, 0, 1]])).toBe(2);
  });
});

describe("pruefen", () => {
  it("saubere parallele Leitungen: keine Befunde", () => {
    expect(pruefen([L("a", "n1", [[0, 2.8, 0], [5, 2.8, 0]]), L("b", "n2", [[0, 2.8, 0.18], [5, 2.8, 0.18]])], [])).toEqual([]);
  });
  it("zu nahe fremde Leitungen: abstand", () => {
    expect(regeln(pruefen([L("a", "n1", [[0, 2.8, 0], [5, 2.8, 0]]), L("b", "n2", [[0, 2.8, 0.1], [5, 2.8, 0.1]])], []))).toEqual(["abstand"]);
  });
  it("schraeges Segment", () => {
    expect(regeln(pruefen([L("a", "n1", [[0, 0, 0], [1, 0, 1]])], []))).toEqual(["schraeg"]);
  });
  it("180-Grad-Wende", () => {
    expect(regeln(pruefen([L("a", "n1", [[0, 0, 0], [2, 0, 0], [1, 0, 0]])], []))).toContain("rueckwaerts");
  });
  it("mehr als 6 Boegen", () => {
    const zick: V3[] = [[0, 0, 0], [1, 0, 0], [1, 0, 1], [2, 0, 1], [2, 0, 0], [3, 0, 0], [3, 0, 1], [4, 0, 1], [4, 0, 0]];
    expect(regeln(pruefen([L("a", "n1", zick)], []))).toEqual(["boegen"]);
  });
  it("Rohr durch fremdes Geraet, eigenes Endgeraet erlaubt", () => {
    const k: Koerper[] = [{ schluessel: "S", min: [1, 0, -0.5], max: [2, 1.8, 0.5] }];
    expect(regeln(pruefen([L("a", "n1", [[0, 1, 0], [3, 1, 0]])], k))).toEqual(["durch_geraet"]);
    expect(pruefen([L("a", "n1", [[0, 1, 0], [3, 1, 0]], 0.045, ["S"])], k)).toEqual([]);
  });
  it("Rohr ueber Geraet mit genug Luft ist erlaubt", () => {
    const k: Koerper[] = [{ schluessel: "S", min: [1, 0, -0.5], max: [2, 1.8, 0.5] }];
    expect(pruefen([L("a", "n1", [[0, 2.8, 0], [3, 2.8, 0]])], k)).toEqual([]);
  });
  it("T-Abzweig im selben Netz erlaubt, Kreuzung ohne Abzweig nicht", () => {
    const strang = L("a", "n1", [[0, 2.8, 0], [4, 2.8, 0]]);
    expect(pruefen([strang, L("b", "n1", [[2, 2.8, 0], [2, 2.8, 2]])], [])).toEqual([]);
    expect(regeln(pruefen([strang, L("b", "n1", [[2, 2.8, -1], [2, 2.8, 1]])], []))).toEqual(["abstand"]);
  });
  it("fremde Leitung auf anderer Hoehe im Grundriss gekreuzt: weiche kreuzung", () => {
    const b = pruefen([L("a", "n1", [[0, 2.8, 0], [4, 2.8, 0]]), L("b", "n2", [[2, 2.55, -1], [2, 2.55, 1]])], []);
    expect(b.map((x) => [x.regel, x.hart])).toEqual([["kreuzung", false]]);
  });
  it("doppelt gefuehrte Strecke im selben Netz: abstand", () => {
    expect(regeln(pruefen([L("a", "n1", [[0, 2.8, 0], [4, 2.8, 0]]), L("b", "n1", [[1, 2.8, 0], [3, 2.8, 0]])], []))).toEqual(["abstand"]);
  });
});
