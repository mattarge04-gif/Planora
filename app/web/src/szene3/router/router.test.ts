import { describe, expect, it } from "vitest";
import type { Welt } from "../../typen";
import { LeitungsRouter } from "./router";
import { pruefen } from "./pruefer";
import { TEST_KATALOG } from "./testKatalog";
import type { V3 } from "./typen";
import { zufall } from "./zufallsWelt";

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

  it("Zufall: 1000 Wege ohne harte Befunde (Radius bis 0.07)", () => {
    const r = zufall(61), p = (): V3 => [+(0.3 + r() * 9.4).toFixed(3), 2.8, +(0.3 + r() * 5.4).toFixed(3)];
    const fehler: unknown[] = [];
    for (let n = 0; n < 1000; n++) {
      const ro = new LeitungsRouter(welt, TEST_KATALOG), a = p(), b = n % 4 === 0 ? [+(a[0] + (r() - 0.5) * 0.1).toFixed(3), 2.8, p()[2]] as V3 : p();
      const w = ro.weg(a, b, "n");
      const f = pruefen([{ id: "w", netz: "n", punkte: w, radius: 0.07, enden: [] }], []).filter((x) => x.hart);
      if (f.length || String(w[0]) !== String(a) || String(w.at(-1)) !== String(b)) fehler.push({ a, b, w, f });
    }
    expect(fehler.slice(0, 2)).toEqual([]);
  });
  it("Zufall: 500 Straenge ueber EG/OG ohne harte Befunde", () => {
    const r = zufall(23), p = (y: number): V3 => [+(0.3 + r() * 9.4).toFixed(3), y, +(0.3 + r() * 5.4).toFixed(3)];
    const fehler: unknown[] = [];
    for (let n = 0; n < 500; n++) {
      const ro = new LeitungsRouter(welt, TEST_KATALOG), start = p(2.8);
      // [A] Anschluesse auf derselben Ebene liegen mindestens 0.3 m auseinander (Heizkoerper ~1 m breit); naeher ist ein Generatorartefakt.
      const ziele: { schluessel: string; punkt: V3 }[] = [];
      for (let j = 0, n = 2 + Math.floor(r() * 3); j < n; j++) {
        const y = r() < 0.5 ? 2.8 : 6;
        let q = p(y);
        while (ziele.some((z) => z.punkt[1] === y && Math.hypot(z.punkt[0] - q[0], z.punkt[2] - q[2]) < 0.3)) q = p(y);
        ziele.push({ schluessel: `hk${j}`, punkt: q });
      }
      const baum = ro.strang(start, ziele, Math.floor(r() * 3), { x: 1, z: 1 }, "g");
      const f = pruefen(baum.segmente.map((s, i) => L(`s${i}`, "g", s)), []).filter((x) => x.hart);
      if (f.length) fehler.push({ start, ziele: ziele.map((z) => z.punkt), segmente: baum.segmente, f });
    }
    expect(fehler.length, JSON.stringify(fehler.slice(0, 3))).toBe(0);
  });
});
