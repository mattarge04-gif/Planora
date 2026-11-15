import { describe, expect, it } from "vitest";
import type { V3 } from "../szene2/huelle";
import type { KatalogEintrag, Welt, WeltSymbol } from "../typen";
import { gruppenVerbindungen, type StrangBaum } from "./gruppenNetz";
import { verbindungen } from "./netz";
import { pruefen } from "./router/pruefer";
import { LeitungsRouter } from "./router/router";
import { TEST_KATALOG } from "./router/testKatalog";

const dateien = import.meta.glob<Welt>("../fixtures/muster-*.json", { eager: true, import: "default" });
const muster = (name: string): Welt => {
  const pfad = Object.keys(dateien).find((p) => p.includes(`muster-${name}`));
  if (!pfad) throw new Error(`Fixture ${name} fehlt`);
  return structuredClone(dateien[pfad]);
};
const katalog: KatalogEintrag[] = [
  { id: "heizung.waermepumpe", name: "Wärmepumpe", bereich: "zentrale" },
  { id: "heizung.speicher", name: "Speicher", bereich: "zentrale" },
  { id: "heizung.umwaelzpumpe", name: "Umwälzpumpe", bereich: "zubehoer" },
  { id: "heizung.verteiler", name: "Verteiler", bereich: "verteilung" },
  { id: "heizung.heizkoerper", name: "Heizkörper", bereich: "einheit" },
  { id: "heizung.fbh_kreis", name: "FBH-Kreis", bereich: "einheit" },
  { id: "heizung.ventil_3weg", name: "3-Weg-Ventil", bereich: "zubehoer" },
  { id: "heizung.ventil_2weg", name: "Durchgangsventil", bereich: "zubehoer" },
  { id: "heizung.wmz", name: "Wärmezähler", bereich: "zubehoer" },
];

describe("gruppenVerbindungen", () => {
  it("Muster 2: zwei Stränge mit getrennten Abgängen am selben Verteiler", () => {
    const s = gruppenVerbindungen(muster("m2"), katalog);
    expect(s).toHaveLength(2);
    expect(new Set(s.map((x) => x.verteiler)).size).toBe(1);
    expect(s.map((x) => x.abgangIndex).sort()).toEqual([0, 1]);
    expect(s.every((x) => !x.ersatz)).toBe(true);
  });
  it("kein Verbraucher in zwei Strängen, in allen Mustern", () => {
    for (const name of ["m1", "m2", "m3", "m4", "m5", "m6-", "m6u"]) {
      const alle = gruppenVerbindungen(muster(name), katalog).flatMap((x) => x.verbraucher);
      expect(new Set(alle).size, name).toBe(alle.length);
    }
  });
  it("übernimmt Zubehör aus Gruppe und Ort", () => {
    const w = muster("m3");
    const fbh = gruppenVerbindungen(w, katalog).find((x) => x.art === "einspritz")!;
    expect(fbh.zubehoer).toHaveLength(3);
    expect(gruppenVerbindungen(w, katalog).find((x) => x.art === "ungeregelt")!.zubehoer).toEqual([]);
  });
  it("Unterverteiler: Gruppe zum Unterverteiler, dessen Abgaben als eigene Ersatzgruppen (Spec 6.7)", () => {
    const w = muster("m5");
    const s = gruppenVerbindungen(w, katalog);
    const unter = w.symbole.find((x) => x.katalogId === "heizung.verteiler" && x.position.y > 0)!;
    expect(s.find((x) => !x.ersatz)!.verbraucher).toEqual([unter.schluessel]);
    const ersatz = s.filter((x) => x.ersatz);
    expect(ersatz.length).toBeGreaterThan(0);
    expect(ersatz.every((x) => x.verteiler === unter.schluessel && x.art === "ungeregelt")).toBe(true);
  });
  it("v1-Welt ohne Gruppen: jede bisherige Verteilerverbindung wird eine eigene Gruppe «ungeregelt»", () => {
    const w = muster("m2");
    delete w.gruppen; delete w.steigzone;
    w.regelwerkVersion = 1;
    w.symbole = w.symbole.filter((x) => !x.ort).map((x): WeltSymbol => ({ ...x }));
    const bisher = verbindungen(w, katalog).filter((v) => v.art === "verteil");
    const s = gruppenVerbindungen(w, katalog);
    expect(s).toHaveLength(bisher.length);
    expect(s.every((x) => x.ersatz && x.art === "ungeregelt" && x.verbraucher.length === 1)).toBe(true);
    expect(s.map((x) => x.abgangIndex)).toEqual(s.map((_, i) => i));
  });
});

// ---------------------------------------------------------------------------------------------------------------

// Strang ueber den LeitungsRouter (ersetzt die fruehere Schablone strangBaum, Leitungsrouter T9).
const strangWelt: Welt = { regelwerkVersion: 2, hash: "s", grundriss: [{ x: 0, z: 0, breite: 30, tiefe: 10 }], hinweise: [], symbole: [], einheiten: [],
  geschosse: [{ id: "eg", code: "EG", yUnten: 0, hoehe: 3.2 }, { id: "og", code: "OG1", yUnten: 3.2, hoehe: 3.2 }], steigzone: { x: 26, z: 7 } };
const achsparallel = (b: StrangBaum) => b.segmente.every((s) => s.every((p, i) => i === 0 ||
  [0, 1, 2].filter((k) => Math.abs(p[k] - s[i - 1][k]) > 1e-9).length === 1));
const aufSegment = (p: V3, s: V3[]) => s.some((q, i) => i > 0 && [0, 1, 2].every((k) =>
  p[k] >= Math.min(q[k], s[i - 1][k]) - 1e-6 && p[k] <= Math.max(q[k], s[i - 1][k]) + 1e-6));
const linien = (b: StrangBaum, netz: string) => b.segmente.map((s, i) => ({ id: `${netz}-${i}`, netz, punkte: s, radius: 0.045, enden: [] }));

describe("LeitungsRouter.strang (Gruppenstrang)", () => {
  const start: V3 = [28, 2.8, 4];
  const ziele = [
    { schluessel: "hk-a", punkt: [3, 2.8, 8] as V3 }, { schluessel: "hk-b", punkt: [9, 2.8, 8] as V3 },
    { schluessel: "hk-c", punkt: [15, 2.8, 2] as V3 }, { schluessel: "og-a", punkt: [7, 6, 8] as V3 },
    { schluessel: "og-b", punkt: [22, 6, 8] as V3 },
  ];
  const baum = new LeitungsRouter(strangWelt, TEST_KATALOG).strang(start, ziele, 1, strangWelt.steigzone!, "g");

  it("alle Segmente achsparallel, jedes Ziel erreicht, ohne harte Befunde", () => {
    expect(achsparallel(baum)).toBe(true);
    for (const z of ziele) expect(baum.segmente.some((s) => s.at(-1)!.every((v, i) => Math.abs(v - z.punkt[i]) < 1e-6)), z.schluessel).toBe(true);
    expect(pruefen(linien(baum, "g"), []).filter((x) => x.hart)).toEqual([]);
  });
  it("Strang führt zuerst zum entferntesten Ziel, Abzweige beginnen auf dem bisherigen Strang", () => {
    expect(baum.abzweige[0].schluessel).toBe("hk-a");
    for (let i = 1; i < baum.abzweige.length; i++) {
      const a = baum.abzweige[i].punkte[0];
      expect(aufSegment(a, [start, start]) || baum.segmente.slice(0, i).some((s) => aufSegment(a, s)), baum.abzweige[i].schluessel).toBe(true);
    }
  });
  it("Steigsegmente nur im Bereich der Steigzone", () => {
    for (const s of baum.segmente) for (let i = 1; i < s.length; i++) {
      if (Math.abs(s[i][1] - s[i - 1][1]) < 1e-9) continue;
      expect(Math.abs(s[i][0] - 26)).toBeLessThanOrEqual(1);
      expect(Math.abs(s[i][2] - 7)).toBeLessThanOrEqual(1);
    }
  });
  it("ist deterministisch, unabhängig von der Eingabereihenfolge", () => {
    expect(new LeitungsRouter(strangWelt, TEST_KATALOG).strang(start, [...ziele].reverse(), 1, strangWelt.steigzone!, "g")).toEqual(baum);
  });
  it("zwei Gruppen mit Spur 0/1 im selben Router: keine harten Befunde zwischen den Strängen", () => {
    const r = new LeitungsRouter(strangWelt, TEST_KATALOG);
    const a = r.strang([28, 2.8, 4], ziele.slice(0, 2), 0, strangWelt.steigzone!, "a");
    const b = r.strang([28.34, 2.8, 4], [{ schluessel: "x", punkt: [5, 2.8, 8] }, { schluessel: "y", punkt: [6, 6, 8] }], 1, strangWelt.steigzone!, "b");
    expect(pruefen([...linien(a, "a"), ...linien(b, "b")], []).filter((x) => x.hart)).toEqual([]);
  });
  it("ohne Steigzone steigt der Strang am Start", () => {
    const b = new LeitungsRouter(strangWelt, TEST_KATALOG).strang(start, [{ schluessel: "og", punkt: [7, 6, 8] }], 0, null, "g");
    const senkrecht = b.segmente.flatMap((s) => s.filter((p, i) => i > 0 && Math.abs(p[1] - s[i - 1][1]) > 1e-9));
    expect(senkrecht.length).toBeGreaterThan(0);
    expect(senkrecht.every((p) => Math.abs(p[0] - start[0]) < 1e-6 && Math.abs(p[2] - start[2]) < 1e-6)).toBe(true);
  });
});
