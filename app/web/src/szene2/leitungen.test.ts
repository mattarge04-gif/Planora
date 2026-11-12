import { describe, it, expect } from "vitest";
import { BODEN, VERSATZ, geschossBeiY, leitungen, schlange } from "./leitungen";
import type { KatalogEintrag, Welt, WeltSymbol } from "../typen";
import type { V3 } from "./huelle";

const KATALOG: KatalogEintrag[] = [
  { id: "heizung.waermepumpe", name: "Waermepumpe", bereich: "zentrale" },
  { id: "heizung.speicher", name: "Speicher", bereich: "zentrale" },
  { id: "heizung.verteiler", name: "Heizungsverteiler", bereich: "verteilung" },
  { id: "heizung.heizkoerper", name: "Heizkoerper", bereich: "einheit" },
];
const sym = (schluessel: string, katalogId: string, x: number, y: number, z: number, versorgt: string[] = []): WeltSymbol => ({
  schluessel, katalogId, hersteller: null, typ: null, bauteilIds: [schluessel], mengeSumme: 1, mengeUnbekannt: false,
  status: "bestaetigt", position: { x, y, z }, versorgt,
});
const WELT: Welt = {
  regelwerkVersion: 1, hash: "x",
  grundriss: [{ x: 0, z: 0, breite: 30, tiefe: 15 }],
  geschosse: [{ id: "g0", code: "EG", yUnten: 0, hoehe: 3 }, { id: "g1", code: "OG1", yUnten: 3, hoehe: 3.5 }],
  einheiten: [
    { id: "e1", geschossId: "g0", bezeichnung: "Technik", art: "technik", rechteck: { x: 0, z: 0, breite: 10, tiefe: 15 }, quelle: "schematisch" },
    { id: "e2", geschossId: "g0", bezeichnung: "Restaurant", art: "gastro", rechteck: { x: 10, z: 0, breite: 20, tiefe: 15 }, quelle: "schematisch" },
    { id: "e3", geschossId: "g1", bezeichnung: "Buero", art: "buero", rechteck: { x: 0, z: 0, breite: 30, tiefe: 15 }, quelle: "schematisch" },
  ],
  symbole: [
    sym("s0", "heizung.speicher", 2, 0, 2),
    sym("s1", "heizung.waermepumpe", 5, 0, 7.5),
    sym("s3", "heizung.verteiler", 8, 0, 3, ["e2", "e3"]),
    sym("s4", "heizung.heizkoerper", 15, 3, 2),
  ],
  hinweise: [],
};

const achsparallel = (p: V3[]) => p.slice(1).every((q, i) => q.filter((v, k) => Math.abs(v - p[i][k]) > 1e-9).length === 1);

describe("geschossBeiY", () => {
  it("ordnet nach yUnten zu", () => {
    expect(geschossBeiY(WELT, 0)).toBe("g0");
    expect(geschossBeiY(WELT, 2.9)).toBe("g0");
    expect(geschossBeiY(WELT, 3)).toBe("g1");
    expect(geschossBeiY({ ...WELT, geschosse: [] }, 0)).toBeNull();
  });
});

describe("leitungen", () => {
  const l = leitungen(WELT, KATALOG);
  const haupt = l.filter((x) => x.art === "haupt");
  const verteil = l.filter((x) => x.art === "verteil");
  it("eine Hauptleitung ab dem Erzeuger, zwei Verteilleitungen", () => {
    expect(haupt).toHaveLength(1);
    expect(verteil).toHaveLength(2);
    expect(haupt[0].von).toBe("s1"); // Waermepumpe, nicht Speicher
    expect(haupt[0].nach).toBe("s3");
    expect(haupt[0].punkte[0]).toEqual([5, BODEN, 7.5]);
    expect(haupt[0].punkte.at(-1)).toEqual([8, BODEN, 3]);
  });
  it("Verteilleitungen enden in der Einheitsmitte auf deren Boden", () => {
    expect(verteil.map((x) => x.nach)).toEqual(["e2", "e3"]);
    expect(verteil[0].punkte.at(-1)).toEqual([20, BODEN, 7.5]);
    expect(verteil[1].punkte.at(-1)).toEqual([15, 3 + BODEN, 7.5]);
    expect(verteil[1].geschossIds).toEqual(["g0", "g1"]);
  });
  it("nur achsparallele Segmente", () => {
    for (const x of l) expect(achsparallel(x.punkte)).toBe(true);
  });
  it("parallele Laeufe mit Versatz", () => {
    const zLauf = (p: V3[]) => p.find((q, i) => i > 0 && Math.abs(q[0] - p[i - 1][0]) > 1e-9)![2];
    expect(zLauf(verteil[1].punkte) - zLauf(verteil[0].punkte)).toBeCloseTo(VERSATZ);
  });
  it("ohne Zentrale keine Hauptleitung, ohne versorgt keine Verteilleitung", () => {
    const ohne = { ...WELT, symbole: WELT.symbole.filter((s) => s.schluessel !== "s0" && s.schluessel !== "s1") };
    expect(leitungen(ohne, KATALOG).every((x) => x.art === "verteil")).toBe(true);
    const leer = { ...WELT, symbole: WELT.symbole.map((s) => ({ ...s, versorgt: [] })) };
    expect(leitungen(leer, KATALOG).filter((x) => x.art === "verteil")).toHaveLength(0);
  });
  it("unbekannte Einheit wird uebersprungen", () => {
    const w = { ...WELT, symbole: WELT.symbole.map((s) => (s.schluessel === "s3" ? { ...s, versorgt: ["fehlt"] } : s)) };
    expect(leitungen(w, KATALOG).filter((x) => x.art === "verteil")).toHaveLength(0);
  });
});

describe("schlange", () => {
  it("maeandert innerhalb des eingerueckten Rechtecks", () => {
    const p = schlange({ x: 0, z: 0, breite: 4, tiefe: 3 }, 1, 0.6, 0.5);
    expect(p[0]).toEqual([0.5, 1, 0.5]);
    expect(p[1]).toEqual([3.5, 1, 0.5]);
    expect(p[2][0]).toBe(3.5);
    expect(p.every(([x, , z]) => x >= 0.5 && x <= 3.5 && z >= 0.5 && z <= 2.5 + 1e-9)).toBe(true);
    expect(achsparallel(p)).toBe(true);
  });
  it("zu kleines Rechteck ergibt keine Punkte", () => {
    expect(schlange({ x: 0, z: 0, breite: 0.8, tiefe: 3 }, 0)).toEqual([]);
  });
});
