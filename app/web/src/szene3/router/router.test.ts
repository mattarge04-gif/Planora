import { describe, expect, it } from "vitest";
import type { Welt } from "../../typen";
import { LeitungsRouter } from "./router";
import { pruefen } from "./pruefer";
import { TEST_KATALOG } from "./testKatalog";
import type { V3 } from "./typen";

const welt: Welt = { regelwerkVersion: 2, hash: "r", grundriss: [{ x: 0, z: 0, breite: 10, tiefe: 6 }], hinweise: [], symbole: [], einheiten: [],
  geschosse: [{ id: "eg", code: "EG", yUnten: 0, hoehe: 3.2 }, { id: "og", code: "OG1", yUnten: 3.2, hoehe: 3.2 }], steigzone: { x: 1, z: 1 } };
const L = (id: string, netz: string, punkte: V3[]) => ({ id, netz, punkte, radius: 0.045, enden: [] });

describe("LeitungsRouter", () => {
  it("weg beginnt und endet exakt auf den Anschlusspunkten, achsparallel", () => {
    const r = new LeitungsRouter(welt, TEST_KATALOG);
    const w = r.weg([1.03, 2.8, 2.02], [8.01, 2.8, 4.97], "n");
    expect(w[0]).toEqual([1.03, 2.8, 2.02]); expect(w.at(-1)).toEqual([8.01, 2.8, 4.97]);
    expect(pruefen([L("a", "n", w)], [])).toEqual([]);
  });
  it("zweite Leitung kreuzt die erste nicht und haelt Abstand", () => {
    const r = new LeitungsRouter(welt, TEST_KATALOG);
    const a = r.weg([2, 2.8, 1], [2, 2.8, 5], "a"); r.belegen(a, "a");
    const b = r.weg([1, 2.8, 3], [3, 2.8, 3], "b"); r.belegen(b, "b");
    expect(pruefen([L("a", "a", a), L("b", "b", b)], []).filter((x) => x.hart)).toEqual([]);
  });
  it("strang ueber zwei Geschosse: Steigleitung in der Steigzone, T-Abzweig im OG", () => {
    const r = new LeitungsRouter(welt, TEST_KATALOG);
    const baum = r.strang([2, 2.8, 2], [{ schluessel: "hk1", punkt: [8, 6, 5] }, { schluessel: "hk2", punkt: [5, 6, 1] }], 0, { x: 1, z: 1 }, "g1");
    const linien = baum.segmente.map((s, i) => L(`s${i}`, "g1", s));
    expect(pruefen(linien, []).filter((x) => x.hart)).toEqual([]);
    expect(baum.segmente.flat().some((p) => Math.abs(p[0] - 1) < 1e-6 && Math.abs(p[2] - 1) < 1e-6 && p[1] > 5)).toBe(true);
    expect(baum.abzweige.map((a) => a.schluessel).sort()).toEqual(["hk1", "hk2"]);
  });
  it("blockierter Weg erzeugt Befund kein_weg und trotzdem eine Polylinie", () => {
    const r = new LeitungsRouter(welt, TEST_KATALOG);
    for (const y of [2.8, 2.55]) r.vorbelegen([[5, y, 0.05], [5, y, 5.95]], "sperre");
    r.vorbelegen([[5, 0, 0.05], [5, 2.8, 0.05]], "sperre");
    const w = r.weg([2, 2.8, 3], [8, 2.8, 3], "n");
    expect(w.length).toBeGreaterThanOrEqual(2);
    expect(r.befunde.map((b) => b.regel)).toContain("kein_weg");
  });
});
