import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { TOKENS } from "../design/tokens";
import { ACHSE } from "./rohrStaerke";
import { gesamtHoehe, kontur, manschetten, manschettenFaktor, manschettenGeometrie, PUMPE, ringe, striche, umfang, VERTEILER, type ManschettenTeil } from "./manschette";

const M = TOKENS.erneuerung.manschette;
const teil = (o: Partial<ManschettenTeil> = {}): ManschettenTeil =>
  ({ schluessel: "a", mitte: [0, 0.5, 0], masse: [1, 1, 0.6], inline: false, ampel: "rot", ...o });
const ventil = (y: number, o: Partial<ManschettenTeil> = {}) => teil({ inline: true, mitte: [2, y, 1], masse: [0.15, 0.25, 0.15], rohrRadius: 0.02, ...o });

describe("ringe", () => {
  it("Rot doppelt, Gelb breiter als Gruen, symmetrisch um die Mitte", () => {
    expect(ringe("rot", "rohr")).toHaveLength(2);
    expect(ringe("gelb", "rohr")).toHaveLength(1);
    const h = (a: "gelb" | "gruen") => ringe(a, "gehaeuse")[0].y1 - ringe(a, "gehaeuse")[0].y0;
    expect(h("gelb")).toBeGreaterThan(h("gruen"));
    const r = ringe("rot", "gehaeuse");
    expect(r[0].y0).toBeCloseTo(-r[1].y1);
    expect(r[1].y0 - r[0].y1).toBeCloseTo(M.rotLueckeGehaeuseM);
    expect(gesamtHoehe("rot", "rohr")).toBeCloseTo(2 * M.hoeheRohrM.rot + M.rotLueckeRohrM);
  });
});

describe("manschetten", () => {
  it("stehende Anlage: Band auf halber Hoehe, Speicher rund, Gruen duenner als Rot", () => {
    const [b] = manschetten([teil()]);
    expect(b.art).toBe("gehaeuse"); expect(b.achse).toBe("y"); expect(b.hebt).toBe(true);
    expect(b.mitte).toEqual([0, 0.5, 0]);
    expect(b.breite).toBeCloseTo(1 + 2 * M.gehaeuseAbstandM);
    const [r] = manschetten([teil({ masse: [0.9, 1.8, 0.9], form: "rund", ampel: "gruen" })]);
    expect(r.eckRadius).toBeCloseTo(r.breite / 2);
    expect(r.dicke).toBeLessThan(b.dicke);
  });
  it("Verteiler: zwei Kragen an den Enden des oberen Balkens statt Rundumband, nach innen wachsend", () => {
    const k = manschetten([teil({ form: "verteiler", ampel: "gruen", masse: [1.6, 1, 0.3] })]);
    expect(k).toHaveLength(2);
    expect(k.every((x) => x.achse === "x" && x.art === "rohr")).toBe(true);
    expect(k.map((x) => x.mitte[0]).sort()).toEqual([-(0.8 - VERTEILER.endeEinzug), 0.8 - VERTEILER.endeEinzug].sort());
    expect(k[0].mitte[1]).toBeCloseTo(VERTEILER.balkenY);
    expect(k.find((x) => x.mitte[0] > 0)!.richtung).toBe(-1);
  });
  it("Pumpe in der Leitung: Band um den Motorkopf (Achse z, vor dem Rohr)", () => {
    const [p] = manschetten([ventil(1, { form: "pumpe" })]);
    expect(p.art).toBe("gehaeuse"); expect(p.achse).toBe("z");
    expect(p.mitte[2]).toBeCloseTo(1 + PUMPE.motorVersatz);
    expect(p.breite / 2).toBeCloseTo(PUMPE.motorRadius + M.gehaeuseAbstandM);
  });
  it("Ventil: Ring dicht am eigenen Teil, waechst davon weg", () => {
    const [m] = manschetten([ventil(1)]);
    expect(m.art).toBe("rohr"); expect(m.richtung).toBe(1); expect(m.verdicken).toBe(true);
    expect(m.mitte).toEqual([2, 1 + 0.125 + M.rohrAbstandM, 1]);
    expect(m.breite / 2).toBeCloseTo(0.02 * M.rohrInnenFaktor);
  });
  it("Fuge zum fremden Teil zu knapp: unter das Teil, sonst Band ums Teil (kein gestauchter Ring)", () => {
    const h = gesamtHoehe("gelb", "rohr"), fuge = h + M.rohrAbstandM + M.fremdAbstandM;
    const oben = ventil(1 + 0.25 + fuge - 0.001, { schluessel: "b" });
    const unten = ventil(1 - 0.25 - fuge - 0.001, { schluessel: "c" });
    expect(manschetten([ventil(1, { ampel: "gelb" }), oben, unten])[0].richtung).toBe(-1);
    const eng = ventil(1 - 0.25 - 0.01, { schluessel: "c" });
    expect(manschetten([ventil(1, { ampel: "gelb" }), oben, eng])[0].art).toBe("gehaeuse");
  });
});

describe("manschettenFaktor", () => {
  it("nah 1, fern Zielhoehe, gedeckelt durch maxFaktor und Platz", () => {
    const m = { ampel: "gelb" as const, art: "rohr" as const, maxHoehe: Infinity };
    expect(manschettenFaktor(m, 10000)).toBe(1);
    expect(manschettenFaktor(m, 1)).toBe(M.maxFaktor);
    expect(manschettenFaktor(m, 0)).toBe(1);
    const z = 50, k = manschettenFaktor(m, z);
    expect(k * gesamtHoehe("gelb", "rohr") * z).toBeCloseTo(M.zielPx, 0);
    expect(manschettenFaktor({ ...m, maxHoehe: gesamtHoehe("gelb", "rohr") * 1.5 }, 1)).toBe(1.5);
    // Gruen kleineres Ziel
    expect(manschettenFaktor({ ...m, ampel: "gruen" }, 2 * z) * gesamtHoehe("gruen", "rohr") * 2 * z).toBeCloseTo(M.zielPxGruen, 0);
  });
});

describe("Geometrie", () => {
  it("Kontur geschlossen, Kreis bei vollem Eckradius", () => {
    const k = kontur(1, 1, 0.5, 16);
    for (const [x, z] of k) expect(Math.hypot(x, z)).toBeCloseTo(0.5);
    expect(umfang(k)).toBeCloseTo(Math.PI, 1);
    expect(umfang(kontur(2, 1, 0))).toBeCloseTo(6);
  });
  it("Striche: n Stuecke mit Luecken", () => {
    expect(striche(4, 0.5)).toEqual([[0, 0.125], [0.25, 0.375], [0.5, 0.625], [0.75, 0.875]]);
  });
  it("Ring am Rohr mit Achse (Mindeststaerke), Band ohne; Rot hat doppelt so viele Flaechen wie Gelb", () => {
    const [rohr] = manschetten([ventil(1, { ampel: "gelb" })]);
    const g = manschettenGeometrie(rohr);
    expect(g.getAttribute(ACHSE)).toBeDefined();
    const p = g.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const r = Math.hypot(p.getX(i), p.getZ(i));
      expect(r).toBeGreaterThanOrEqual(0.02 * M.rohrInnenFaktor - 1e-6);
      expect(r).toBeLessThanOrEqual(0.02 * M.rohrAussenFaktor + 1e-6);
      expect(p.getY(i)).toBeGreaterThanOrEqual(-1e-9); // waechst vom eigenen Teil weg
    }
    const [rot] = manschetten([ventil(1)]);
    expect(manschettenGeometrie(rot).getAttribute("position").count).toBe(2 * p.count);
    expect(manschettenGeometrie(manschetten([teil({ ampel: "gruen" })])[0]).getAttribute(ACHSE)).toBeUndefined();
  });
  it("Dreiecke der Aussenwand zeigen nach aussen (Rand mit BackSide)", () => {
    const g = manschettenGeometrie(manschetten([teil({ ampel: "gelb", form: "rund", masse: [1, 1, 1] })])[0]);
    const p = g.getAttribute("position"), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    let aussen = 0, falsch = 0;
    for (let i = 0; i < p.count; i += 3) {
      a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
      const n = b.clone().sub(a).cross(c.clone().sub(a)), m = a.clone().add(b).add(c).divideScalar(3);
      if (n.lengthSq() < 1e-14 || Math.abs(n.y) > 0.5 * n.length()) continue;
      const r = Math.hypot(m.x, m.z);
      if (r < 0.5 + M.gehaeuseAbstandM + M.gehaeuseDickeM - 5e-3) continue;
      aussen++;
      if (n.x * m.x + n.z * m.z < 0) falsch++;
    }
    expect(aussen).toBeGreaterThan(0);
    expect(falsch).toBe(0);
  });
  it("Grau gestrichelt: Luecken im Umfang", () => {
    const [m] = manschetten([ventil(1, { ampel: "grau" })]);
    const p = manschettenGeometrie(m).getAttribute("position");
    const winkel = new Set<number>();
    for (let i = 0; i < p.count; i++) winkel.add(Math.round(((Math.atan2(p.getZ(i), p.getX(i)) + 2 * Math.PI) % (2 * Math.PI)) * 10));
    expect(winkel.size).toBeLessThan(55);
  });
});

describe("Deckel und Striche (Kritik r2)", () => {
  it("ab deckelEinpassung x Einpasszoom waechst die Bildschirmhoehe nicht weiter", () => {
    const m = { ampel: "rot" as const, art: "gehaeuse" as const, maxHoehe: Infinity }, basis = 100, h = gesamtHoehe("rot", "gehaeuse");
    const px = (z: number) => manschettenFaktor(m, z, basis) * h * z;
    expect(px(basis * M.deckelEinpassung * 4)).toBeCloseTo(px(basis * M.deckelEinpassung), 0);
    expect(manschettenFaktor(m, basis, basis)).toBe(manschettenFaktor(m, basis));
  });
  it("Grau: Strich mindestens zwei Bandhoehen, Anteil 0.5, mindestens strichMin", async () => {
    const { strichAnzahl } = await import("./manschette");
    expect(strichAnzahl(0.3, 0.036)).toBe(M.strichMin);
    const n = strichAnzahl(4, 0.05), strich = 4 * M.strichAnteil / n;
    expect(strich).toBeGreaterThanOrEqual(2 * 0.05 - 1e-9);
  });
});
