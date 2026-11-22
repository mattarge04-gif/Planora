import { describe, expect, it } from "vitest";
import { TOKENS } from "../design/tokens";
import { bandLaenge, leer, pegelHoehe, pegelJeGeschoss, trefferHoehe, pegelQuader, pegelSegmente, pegelStirn, pegelZaehler, segmentStuecke, PLATTE_UEBERSTAND } from "./pegelband";

const P = TOKENS.erneuerung.pegel;

describe("pegelZaehler", () => {
  it("zaehlt je Geschoss und Stufe, ohne Geschoss nicht", () => {
    const z = pegelZaehler([{ geschossId: "ug", ampel: "rot" }, { geschossId: "ug", ampel: "rot" }, { geschossId: "eg", ampel: "grau" },
      { geschossId: null, ampel: "gelb" }]);
    expect(z.get("ug")).toEqual({ ...leer(), rot: 2 });
    expect(z.get("eg")!.grau).toBe(1);
    expect(z.size).toBe(2);
  });
});

describe("pegelSegmente", () => {
  it("Reihenfolge Rot, Gelb, Gruen, Grau; proportional; ganze Laenge", () => {
    const s = pegelSegmente({ rot: 4, gelb: 4, gruen: 2, grau: 0 }, 0);
    expect(s.map((x) => x.ampel)).toEqual(["rot", "gelb", "gruen"]);
    expect(s[0].bis - s[0].von).toBeCloseTo(0.4);
    expect(s.at(-1)!.bis).toBeCloseTo(1);
  });
  it("Mindestanteil fuer seltene Stufen, Summe bleibt 1 inkl. Luecken", () => {
    const s = pegelSegmente({ rot: 1, gelb: 0, gruen: 30, grau: 1 }, 0.12, 0.01);
    const rot = s.find((x) => x.ampel === "rot")!, grau = s.find((x) => x.ampel === "grau")!;
    expect(rot.bis - rot.von).toBeCloseTo(0.12 * 0.98);
    expect(grau.bis - grau.von).toBeCloseTo(0.12 * 0.98);
    expect(s.at(-1)!.bis).toBeCloseTo(1);
    expect(s[1].von - s[0].bis).toBeCloseTo(0.01);
  });
  it("leer: keine Segmente; eine Stufe: volle Laenge", () => {
    expect(pegelSegmente(leer())).toEqual([]);
    expect(pegelSegmente({ ...leer(), gruen: 3 })).toEqual([{ ampel: "gruen", von: 0, bis: 1 }]);
  });
});

describe("pegelStirn", () => {
  const L = [{ x: 0, z: 0, breite: 20, tiefe: 10 }, { x: 0, z: 10, breite: 8, tiefe: 10 }];
  it("kameraseitige, laengere Aussenkante mit Plattenueberstand", () => {
    const s = pegelStirn(L, [1, 1, 1])!;
    // +x: Aussenkante x=20 (nur das erste Rechteck), Laenge 10; +z: z=20 (zweites), Laenge 8 -> +x gewinnt.
    expect(s.normale).toBe("x"); expect(s.seite).toBe(1);
    expect(s.ebene).toBeCloseTo(20 + PLATTE_UEBERSTAND);
    // Bildschirm-rechts (1, 0, -1): z nimmt nach rechts ab -> Start (links) bei grossem z.
    expect(s.start).toBeCloseTo(10 + PLATTE_UEBERSTAND); expect(s.ende).toBeCloseTo(-PLATTE_UEBERSTAND);
  });
  it("gedreht: andere Stirn", () => {
    const s = pegelStirn(L, [-1, 1, -1])!;
    expect(s.seite).toBe(-1);
    expect(s.normale).toBe("x");
    expect(s.ebene).toBeCloseTo(-PLATTE_UEBERSTAND);
    expect(pegelStirn([], [1, 1, 1])).toBeNull();
  });
});

describe("Band", () => {
  it("Hoehe: nah fest, fern Mindest-px, gedeckelt", () => {
    expect(pegelHoehe(1000)).toBe(P.hoeheM);
    expect(pegelHoehe(1)).toBe(P.maxM);
    expect(pegelHoehe(40)).toBeCloseTo(P.minPx / 40, 3);
  });
  it("Quader 1 mm vor der Stirn, zwischen den Raendern", () => {
    const s = pegelStirn([{ x: 0, z: 0, breite: 10, tiefe: 4 }], [1, 1, 1])!;
    const q = pegelQuader(s, 0, 1, -0.125, 0.06);
    expect(s.normale).toBe("z");
    expect(q.mitte[2]).toBeCloseTo(4 + PLATTE_UEBERSTAND + P.abstandM + 1.5 * P.tiefeM);
    expect(pegelQuader(s, 0, 1, 0, 0.1, -P.tiefeM).mitte[2]).toBeCloseTo(4 + PLATTE_UEBERSTAND + P.abstandM + P.tiefeM / 2);
    expect(q.groesse[0]).toBeCloseTo(bandLaenge(s));
    expect(q.groesse[1]).toBe(0.06);
  });
  it("Grau gestrichelt: Strich max(strichM, strichHoehen x Bandhoehe), Anteil strichAnteil", () => {
    const st = segmentStuecke({ ampel: "grau", von: 0, bis: 0.5 }, 10, 0.1);
    const strich = Math.max(P.strichM, P.strichHoehen * 0.1) / 10;
    expect(st[0][1]).toBeCloseTo(strich);
    expect(st[1][0]).toBeCloseTo(strich / P.strichAnteil);
    expect(segmentStuecke({ ampel: "grau", von: 0, bis: 1 }, 10, 0.25)[0][1]).toBeCloseTo(P.strichHoehen * 0.25 / 10);
    expect(segmentStuecke({ ampel: "rot", von: 0.1, bis: 0.3 }, 10, 0.1)).toEqual([[0.1, 0.3]]);
  });
  it("Hover: Band + hoverPx; Klickflaeche mindestens trefferPx", () => {
    expect(pegelHoehe(20, true) - pegelHoehe(20)).toBeCloseTo(P.hoverPx / 20, 3);
    expect(trefferHoehe(20, 0.1)).toBeCloseTo(P.trefferPx / 20);
    expect(trefferHoehe(1000, 0.1)).toBe(0.1);
  });
});

describe("pegelJeGeschoss", () => {
  it("Zaehler und Segmente je Geschoss aus Symbolhoehe und Ampelstufe (Quelle fuer den Mini-Pegel der Karte)", () => {
    const welt = { geschosse: [{ id: "ug", yUnten: -3 }, { id: "eg", yUnten: 0 }] } as any;
    const s = (k: string, y: number) => ({ schluessel: k, position: { x: 0, y, z: 0 } });
    const p = pegelJeGeschoss(welt, [s("a", -3), s("b", -3), s("c", 0), s("d", 0)], new Map([["a", "rot"], ["b", "gruen"], ["c", "grau"]] as const));
    expect(p.get("ug")!.zaehler).toEqual({ ...leer(), rot: 1, gruen: 1 });
    expect(p.get("ug")!.segmente.map((x) => x.ampel)).toEqual(["rot", "gruen"]);
    expect(p.get("eg")!.segmente).toEqual([{ ampel: "grau", von: 0, bis: 1 }]);
  });
});

describe("ampelZustand.blende", () => {
  it("bewegt linear zum Ziel, sofort bei 0 ms", async () => {
    const { blende } = await import("./ampelZustand");
    expect(blende(0, 1, 80, 160)).toBeCloseTo(0.5);
    expect(blende(0.9, 1, 80, 160)).toBe(1);
    expect(blende(1, 0, 40, 160)).toBeCloseTo(0.75);
    expect(blende(1, 0, 10, 0)).toBe(0);
  });
});
