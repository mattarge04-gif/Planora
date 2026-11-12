import { describe, expect, it } from "vitest";
import type { V3 } from "../szene2/huelle";
import type { KatalogEintrag, Welt, WeltSymbol } from "../typen";
import { gruppenVerbindungen, SPUR, strangBaum, type StrangBaum } from "./gruppenNetz";
import { verbindungen } from "./netz";

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

const ebenen = new Map([["eg", 2.8], ["og", 6]]);
const achsparallel = (b: StrangBaum) => b.segmente.every((s) => s.every((p, i) => i === 0 ||
  [0, 1, 2].filter((k) => Math.abs(p[k] - s[i - 1][k]) > 1e-9).length === 1));
const aufSegment = (p: V3, s: V3[]) => s.some((q, i) => i > 0 && [0, 1, 2].every((k) =>
  p[k] >= Math.min(q[k], s[i - 1][k]) - 1e-9 && p[k] <= Math.max(q[k], s[i - 1][k]) + 1e-9));

describe("strangBaum", () => {
  const start: V3 = [28, 2.8, 4];
  const ziele = [
    { schluessel: "hk-a", punkt: [3, 2.8, 8] as V3 }, { schluessel: "hk-b", punkt: [9, 2.8, 8] as V3 },
    { schluessel: "hk-c", punkt: [15, 2.8, 2] as V3 }, { schluessel: "og-a", punkt: [7, 6, 8] as V3 },
    { schluessel: "og-b", punkt: [22, 6, 8] as V3 },
  ];
  const baum = strangBaum(start, ziele, 1, { x: 26, z: 7 }, ebenen);

  it("alle Segmente achsparallel und jedes Ziel erreicht", () => {
    expect(achsparallel(baum)).toBe(true);
    for (const z of ziele) expect(baum.segmente.some((s) => s.at(-1)!.every((v, i) => Math.abs(v - z.punkt[i]) < 1e-9)), z.schluessel).toBe(true);
  });
  it("Strang führt zum entferntesten Ziel, Abzweige beginnen auf dem bisherigen Strang", () => {
    expect(baum.abzweige[0].schluessel).toBe("hk-a"); // 25 + 4 m > Weg über die Steigzone zu og-a
    for (let i = 1; i < baum.abzweige.length; i++) {
      const a = baum.abzweige[i].punkte[0];
      expect(baum.segmente.slice(0, i).some((s) => aufSegment(a, s)), baum.abzweige[i].schluessel).toBe(true);
    }
  });
  it("Steigsegmente nur in der Steigzone (± Spur)", () => {
    for (const s of baum.segmente) for (let i = 1; i < s.length; i++) {
      if (Math.abs(s[i][1] - s[i - 1][1]) < 1e-9) continue;
      expect(Math.abs(s[i][0] - 26)).toBeLessThanOrEqual(SPUR + 1e-9);
      expect(Math.abs(s[i][2] - 7)).toBeLessThanOrEqual(SPUR + 1e-9);
    }
  });
  it("ist deterministisch, unabhängig von der Eingabereihenfolge", () => {
    expect(strangBaum(start, [...ziele].reverse(), 1, { x: 26, z: 7 }, ebenen)).toEqual(baum);
  });
  it("zwei Gruppen mit Spur 0/1 halten auf gemeinsamen Abschnitten ≥ 0.18 m Abstand", () => {
    const a = strangBaum([28, 2.8, 4], ziele.slice(0, 2), 0, { x: 26, z: 7 }, ebenen);
    const b = strangBaum([28.34, 2.8, 4], [{ schluessel: "x", punkt: [5, 2.8, 8] }, { schluessel: "y", punkt: [6, 6, 8] }], 1, { x: 26, z: 7 }, ebenen);
    expect(minAbstandParallel(a.segmente, b.segmente)).toBeGreaterThanOrEqual(SPUR - 1e-9);
  });
  it("ohne Steigzone steigt der Strang am Start", () => {
    const b = strangBaum(start, [{ schluessel: "og", punkt: [7, 6, 8] }], 0, null, ebenen);
    const senkrecht = b.segmente.flatMap((s) => s.filter((p, i) => i > 0 && Math.abs(p[1] - s[i - 1][1]) > 1e-9));
    expect(senkrecht.every((p) => p[0] === start[0] && p[2] === start[2])).toBe(true);
  });
});

/** Kleinster Abstand zwischen parallelen, sich überlappenden Stücken zweier Stranggruppen (∞ ohne Überlappung). */
export function minAbstandParallel(a: V3[][], b: V3[][]): number {
  const stuecke = (s: V3[][]) => s.flatMap((p) => p.slice(1).map((q, i) => [p[i], q] as [V3, V3]));
  const achse = ([p, q]: [V3, V3]) => [0, 1, 2].find((k) => Math.abs(p[k] - q[k]) > 1e-9);
  let min = Infinity;
  for (const s of stuecke(a)) for (const t of stuecke(b)) {
    const k = achse(s);
    if (k === undefined || k !== achse(t)) continue;
    const ueberlapp = Math.min(Math.max(s[0][k], s[1][k]), Math.max(t[0][k], t[1][k])) - Math.max(Math.min(s[0][k], s[1][k]), Math.min(t[0][k], t[1][k]));
    if (ueberlapp <= 1e-9) continue;
    const quer = [0, 1, 2].filter((i) => i !== k);
    min = Math.min(min, Math.hypot(...quer.map((i) => s[0][i] - t[0][i])));
  }
  return min;
}
