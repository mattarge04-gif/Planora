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
  it("Boegen je Geschoss (PO 14.11.): Strang ueber zwei Geschosse mit je 4 Boegen ist zulaessig", () => {
    const strang: V3[] = [[0, 2.8, 0], [1, 2.8, 0], [1, 2.8, 1], [2, 2.8, 1], [2, 2.8, 2], [3, 2.8, 2],
      [3, 6, 2], [4, 6, 2], [4, 6, 3], [5, 6, 3], [5, 6, 4], [6, 6, 4]];
    expect(boegen(strang)).toBe(10);
    expect(regeln(pruefen([L("a", "n1", strang)], []))).toEqual([]);
  });
  it("Boegen je Geschoss: 7 Boegen in einem Abschnitt bleiben hart, Ausweich-Boegen zaehlen mit", () => {
    const abschnitt: V3[] = [[0, 2.8, 0], [1, 2.8, 0], [1, 2.55, 0], [2, 2.55, 0], [2, 2.8, 0], [2, 2.8, 1], [3, 2.8, 1], [3, 2.8, 2], [4, 2.8, 2],
      [4, 6, 2], [5, 6, 2]];
    expect(regeln(pruefen([L("a", "n1", abschnitt)], []))).toEqual(["boegen"]);
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
  it("selbst: U-Haken, der sich auf sich selbst zurueckfaltet", () => {
    expect(regeln(pruefen([L("a", "n1", [[0, 0, 0], [0, 0, 2], [0.02, 0, 2], [0.02, 0, 0]])], []))).toEqual(["selbst"]);
  });
  it("normaler Winkel mit doppeltem Punkt: kein selbst", () => {
    expect(pruefen([L("a", "n1", [[0, 0, 0], [0, 0, 2], [0, 0, 2], [3, 0, 2], [3, 0, 4]])], [])).toEqual([]);
  });
  it("Nullstueck am Anfang/Ende und mitten im Strang ist unschaedlich", () => {
    expect(pruefen([L("a", "n1", [[0, 0, 0], [0, 0, 0], [2, 0, 0], [2, 0, 0]])], [])).toEqual([]);
  });
  it("Wende ueber ein Nullstueck hinweg wird erkannt", () => {
    expect(regeln(pruefen([L("a", "n1", [[0, 0, 0], [2, 0, 0], [2, 0, 0], [1, 0, 0]])], []))).toContain("rueckwaerts");
  });
  it("Adapter und Lauf derselben Verbindung am gemeinsamen Endpunkt: kein Befund", () => {
    const adapter = L("ad", "n1", [[0, 0, 0], [0, 1, 0]], 0.018);
    const lauf = L("lauf", "n1", [[0, 1, 0], [0, 1, 3]], 0.045);
    expect(pruefen([adapter, lauf], [])).toEqual([]);
  });
});
