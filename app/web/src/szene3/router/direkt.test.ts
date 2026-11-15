import { describe, expect, it } from "vitest";
import { DIREKT, direktVerbindung } from "./direkt";
import { pruefen } from "./pruefer";
import type { Koerper, V3 } from "./typen";

const r = 0.07;
// Waermepumpe (x 0..1) und Speicher (x 1.5..2.1) nebeneinander an der Wand, Fuesse vor den Geraeten.
const wp: Koerper = { schluessel: "wp", min: [0, 0, 0], max: [1, 1.2, 0.8] };
const sp: Koerper = { schluessel: "sp", min: [1.5, 0, 0], max: [2.1, 1.8, 0.6] };
const fA: V3 = [0.8, 0.5, 1.0], fB: V3 = [1.7, 0.4, 0.9];

describe("direktVerbindung", () => {
  it("verbindet nahe Fuesse auf Anschlusshoehe, achsparallel, ohne harten Befund", () => {
    const p = direktVerbindung(fA, fB, r, 2.8, [wp, sp], [], "haupt~wp>sp")!;
    expect(p[0]).toEqual(fA); expect(p.at(-1)).toEqual(fB);
    expect(Math.max(...p.map((q) => q[1]))).toBeLessThan(1.0);
    for (let i = 1; i < p.length; i++) expect([0, 1, 2].filter((k) => Math.abs(p[i][k] - p[i - 1][k]) > 1e-9)).toHaveLength(1);
    expect(pruefen([{ id: "d", netz: "haupt", punkte: p, radius: r, enden: ["wp", "sp"] }], [wp, sp]).filter((b) => b.hart)).toEqual([]);
  });
  it("weicht einem Geraet dazwischen nach oben aus", () => {
    const dazwischen: Koerper = { schluessel: "pu", min: [1.1, 0, 0.7], max: [1.4, 0.6, 1.2] };
    const p = direktVerbindung(fA, fB, r, 2.8, [wp, sp, dazwischen], [], "n")!;
    expect(Math.max(...p.map((q) => q[1]))).toBeGreaterThan(0.6 + 0.15);
    expect(pruefen([{ id: "d", netz: "n", punkte: p, radius: r, enden: ["wp", "sp"] }], [wp, sp, dazwischen]).filter((b) => b.hart)).toEqual([]);
  });
  it("haelt Abstand zu fremden Leitungen, eigene Netze stoeren nicht", () => {
    const quer = { id: "q", netz: "g1", punkte: [[1.25, 0, 1.0], [1.25, 0.9, 1.0]] as V3[], radius: 0.045, enden: [] };
    const p = direktVerbindung(fA, fB, r, 2.8, [wp, sp], [quer], "n")!;
    expect(Math.max(...p.map((q) => q[1]))).toBeGreaterThan(0.9);
    expect(direktVerbindung(fA, fB, r, 2.8, [wp, sp], [{ ...quer, netz: "n" }], "n")![1][1]).toBeCloseTo(0.5);
  });
  it("bildet kein enges U aus kurzem Querstueck (Pruefer-Regel selbst, Zufallswelten 78/84)", () => {
    const hoch: Koerper = { schluessel: "h", min: [0.75, 0, 0.95], max: [0.85, 0.7, 1.05] };
    const p = direktVerbindung([0.7, 0.5, 1], [0.78, 0.5, 1.2], r, 2.8, [hoch], [], "n");
    if (p) expect(pruefen([{ id: "d", netz: "n", punkte: p, radius: r, enden: [] }], []).filter((b) => b.regel === "selbst")).toEqual([]);
  });
  it("lehnt zu weit entfernte Anschluesse ab", () => {
    expect(direktVerbindung([0, 0.5, 1], [DIREKT.maxAbstand + 0.1, 0.5, 1], r, 2.8, [], [], "n")).toBeNull();
  });
});
