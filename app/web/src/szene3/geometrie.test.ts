import { describe, expect, it } from "vitest";
import { huelle } from "../szene2/huelle";
import type { Welt } from "../typen";
import { fensterAnWand, innenwaende, wandteile } from "./geometrie";

const welt: Welt = {
  regelwerkVersion: 1, hash: "geometrie", grundriss: [{ x: 0, z: 0, breite: 30, tiefe: 15 }],
  geschosse: [{ id: "eg", code: "EG", yUnten: 0, hoehe: 3 }], symbole: [], hinweise: [],
  einheiten: [
    { id: "a", geschossId: "eg", art: "buero", bezeichnung: "A", quelle: "schematisch", rechteck: { x: 0, z: 0, breite: 10, tiefe: 15 } },
    { id: "b", geschossId: "eg", art: "buero", bezeichnung: "B", quelle: "schematisch", rechteck: { x: 10, z: 0, breite: 20, tiefe: 15 } },
  ],
};

describe("plastische Hülle", () => {
  const h = huelle(welt);
  it("ordnet jedes Fenster genau einer Wand zu", () => {
    for (const f of h.geschosse[0].fenster) expect(h.waende.filter((w) => fensterAnWand(f, w))).toHaveLength(1);
  });
  it("lässt Fensterflächen tatsächlich offen und alle Wandfragmente innerhalb der Geschosshöhe", () => {
    const w = h.waende[0];
    const teile = wandteile(w, 0, 3, h.geschosse[0].fenster);
    expect(teile.length).toBeGreaterThan(2);
    const f = h.geschosse[0].fenster.find((x) => fensterAnWand(x, w))!;
    expect(teile.some((q) => Math.abs(f.mitte[0] - q.mitte[0]) < q.groesse[0] / 2 && Math.abs(f.mitte[1] - q.mitte[1]) < q.groesse[1] / 2)).toBe(false);
    expect(teile.every((q) => q.groesse.every((v) => v > 0) && q.mitte[1] - q.groesse[1] / 2 >= 0 && q.mitte[1] + q.groesse[1] / 2 <= 3.000001)).toBe(true);
  });
  it("erhält die Raumgrenze einmal statt sie zu verdoppeln oder die entfernte Fassade nachzubauen", () => {
    expect(innenwaende(welt, "eg", 0, 1.1)).toEqual([{ mitte: [10, 0.55, 7.5], groesse: [0.18, 1.1, 15] }]);
    expect(innenwaende(welt, "unbekannt", 0, 1.1)).toEqual([]);
  });
});

describe("aussenWaende", () => {
  it("L-Form: gemeinsame Kante entfaellt auf beiden Seiten, Rest der Aussenwand bleibt", async () => {
    const { waendeVon } = await import("../szene2/huelle");
    const { aussenWaende } = await import("./geometrie");
    const L = [{ x: 0, z: 0, breite: 21, tiefe: 15 }, { x: 0, z: 15, breite: 15, tiefe: 6 }];
    const w = aussenWaende(L.flatMap(waendeVon), L);
    // Nordwand des ersten Rechtecks (z=15, Normale +z): nur x 15..21 bleibt.
    const nord = w.filter((x) => x.normale[1] === 1 && x.von[1] === 15);
    expect(nord).toHaveLength(1);
    expect(Math.min(nord[0].von[0], nord[0].bis[0])).toBeCloseTo(15);
    expect(nord[0].laenge).toBeCloseTo(6);
    // Suedwand des zweiten Rechtecks (z=15, Normale -z) liegt ganz innen.
    expect(w.some((x) => x.normale[1] === -1 && x.von[1] === 15)).toBe(false);
    // Richtung bleibt (von -> bis wie das Original).
    expect(nord[0].bis[0]).toBeLessThan(nord[0].von[0]);
    expect(w.reduce((s, x) => s + x.laenge, 0)).toBeCloseTo(2 * (21 + 21));
  });
});
