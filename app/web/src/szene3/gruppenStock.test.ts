import { describe, expect, it } from "vitest";
import type { V3 } from "../szene2/huelle";
import type { KatalogEintrag, Welt } from "../typen";
import { anzeigeWelt, gruppenRohrnetz, gruppenStock, gruppenVerbindungen } from "./gruppenNetz";
import { minAbstandParallel } from "./gruppenNetz.testhilfe";
import { rohrnetz, type Rohrstueck } from "./netz";
import { ANSCHLUSS_STANDARD, deckenLauf, modellFuer, verteilerAbgang, verteilerLaenge, type AnzeigeSymbol } from "./technik";

const dateien = import.meta.glob<Welt>("../fixtures/muster-*.json", { eager: true, import: "default" });
const muster = (name: string): Welt => structuredClone(dateien[Object.keys(dateien).find((p) => p.includes(`muster-${name}`))!]);
const ALLE = ["m1", "m2", "m3", "m4", "m5", "m6-", "m6u"];
const katalog: KatalogEintrag[] = [
  { id: "heizung.waermepumpe", name: "Wärmepumpe", bereich: "zentrale", masse: [1, 1.2, 0.6] },
  { id: "heizung.speicher", name: "Speicher", bereich: "zentrale", masse: [0.9, 1.8, 0.9] },
  { id: "heizung.umwaelzpumpe", name: "Umwälzpumpe", bereich: "zubehoer", masse: [0.35, 0.45, 0.3] },
  { id: "heizung.verteiler", name: "Verteiler", bereich: "verteilung", masse: [1.2, 1, 0.3] },
  { id: "heizung.heizkoerper", name: "Heizkörper", bereich: "einheit", masse: [1, 0.65, 0.12] },
  { id: "heizung.fbh_kreis", name: "FBH-Kreis", bereich: "einheit", masse: [0.6, 0.8, 0.15] },
  { id: "heizung.tabs_feld", name: "TABS-Feld", bereich: "einheit", masse: [0.6, 0.8, 0.15] },
  { id: "heizung.ventil_3weg", name: "3-Weg-Ventil", bereich: "zubehoer", masse: [0.2, 0.25, 0.2] },
  { id: "heizung.ventil_2weg", name: "Durchgangsventil", bereich: "zubehoer", masse: [0.15, 0.25, 0.15] },
  { id: "heizung.wmz", name: "Wärmezähler", bereich: "zubehoer", masse: [0.25, 0.2, 0.15] },
];
const auf = (p: V3, a: V3, b: V3) => [0, 1, 2].every((k) => p[k] >= Math.min(a[k], b[k]) - 1e-6 && p[k] <= Math.max(a[k], b[k]) + 1e-6);
const segmente = (r: Rohrstueck) => r.punkte.slice(1).map((q, i) => [r.punkte[i], q] as [V3, V3]);

describe("Gruppenstock", () => {
  const abgang: V3 = [10, 1, 4];
  it("Stockhöhe wächst mit der Zubehöranzahl", () => {
    const eins = gruppenStock(abgang, [{ schluessel: "p", katalogId: "heizung.umwaelzpumpe", menge: 1 }], 2.8, katalog);
    const drei = gruppenStock(abgang, [{ schluessel: "p", katalogId: "heizung.umwaelzpumpe", menge: 1 },
      { schluessel: "v", katalogId: "heizung.ventil_3weg", menge: 2 }], 2.8, katalog);
    expect(drei.oben).toBeGreaterThan(eins.oben);
    expect(drei.teile.flatMap((t) => t.mitten)).toHaveLength(3);
  });
  it("Gruppe ohne Zubehör = reines Rohrstück", () => {
    expect(gruppenStock(abgang, [], 2.8, katalog)).toEqual({ teile: [], oben: abgang[1] });
  });
  it("Reihenfolge von unten: Pumpe, Ventile, Wärmezähler; Stücke überlappen nicht", () => {
    const s = gruppenStock(abgang, [{ schluessel: "w", katalogId: "heizung.wmz", menge: 1 }, { schluessel: "v", katalogId: "heizung.ventil_2weg", menge: 1 },
      { schluessel: "p", katalogId: "heizung.umwaelzpumpe", menge: 2 }], 2.8, katalog);
    expect(s.teile.map((t) => t.katalogId)).toEqual(["heizung.umwaelzpumpe", "heizung.ventil_2weg", "heizung.wmz"]);
    const stuecke = s.teile.flatMap((t) => t.mitten.map((m) => [m[1] - t.laenge / 2, m[1] + t.laenge / 2]));
    stuecke.slice(1).forEach(([u], i) => expect(u).toBeGreaterThanOrEqual(stuecke[i][1] - 1e-9));
    expect(s.teile.flatMap((t) => t.mitten).every((m) => m[0] === abgang[0] && m[2] === abgang[2])).toBe(true);
  });
  it("Muster 3: 2 Pumpen und 3 Ventile als einzelne Teile auf dem Abgang ihrer Gruppe", () => {
    const w = anzeigeWelt(muster("m3"), katalog);
    const fbh = gruppenVerbindungen(w, katalog).find((s) => s.art === "einspritz")!;
    const teile = fbh.zubehoer.map((k) => w.symbole.find((s) => s.schluessel === k) as AnzeigeSymbol);
    expect(teile.flatMap((t) => t.inline!.mitten)).toHaveLength(5);
    const v = w.symbole.find((s) => s.schluessel === fbh.verteiler) as AnzeigeSymbol;
    const x = v.position.x + verteilerAbgang(fbh.abgangIndex, 2)[0];
    expect(teile.flatMap((t) => t.inline!.mitten).every((m) => Math.abs(m[0] - x) < 1e-9)).toBe(true);
    expect(v.modell?.masse[0]).toBe(verteilerLaenge(2));
  });
});

describe("Ort vor Bauteil", () => {
  it("Muster 4: Pumpe vor WP liegt auf der Anschlussleitung der WP, die Leitung ist dort unterbrochen", () => {
    const welt = muster("m4");
    const w = anzeigeWelt(welt, katalog);
    const pumpe = w.symbole.find((s) => s.ort && "vorBauteil" in s.ort) as AnzeigeSymbol;
    const wp = w.symbole.find((s) => s.katalogId === "heizung.waermepumpe")!;
    const m = pumpe.inline!.mitten[0], h = pumpe.inline!.laenge;
    const netz = gruppenRohrnetz(welt, katalog, {});
    const wpRohre = netz.filter((r) => r.daten.bauteilIds.some((id) => wp.bauteilIds.includes(id)));
    const unten: V3 = [m[0], m[1] - h / 2, m[2]], oben: V3 = [m[0], m[1] + h / 2, m[2]];
    expect(wpRohre.some((r) => r.punkte.some((p) => p.every((v, i) => Math.abs(v - unten[i]) < 1e-9)))).toBe(true);
    expect(wpRohre.some((r) => r.punkte.some((p) => p.every((v, i) => Math.abs(v - oben[i]) < 1e-9)))).toBe(true);
    expect(netz.some((r) => segmente(r).some(([a, b]) => auf(m, a, b)))).toBe(false);
    // Die Pumpe sitzt senkrecht über dem WP-Anschluss, zwischen Gerät und Leitungsebene.
    expect(m[1]).toBeGreaterThan(wp.position.y + ANSCHLUSS_STANDARD["heizung.waermepumpe"][1]);
    expect(m[1]).toBeLessThan(deckenLauf(welt.geschosse[0]));
  });
});

describe("Rohrnetz mit Gruppen", () => {
  it("jeder Verbraucher hängt an seiner Gruppe, in allen Mustern", () => {
    for (const name of ALLE) {
      const w = muster(name), netz = rohrnetz(w, katalog, {});
      for (const st of gruppenVerbindungen(w, katalog)) for (const v of st.verbraucher) {
        expect(netz.some((r) => r.daten.gruppeId === st.gruppeId && r.daten.nach === v), `${name} ${v}`).toBe(true);
      }
    }
  });
  it("keine Überlagerung und keine Zusammenführung verschiedener Gruppen", () => {
    for (const name of ALLE) {
      const netz = rohrnetz(muster(name), katalog, {});
      const ids = [...new Set(netz.map((r) => r.daten.gruppeId).filter((x): x is string => !!x))];
      for (const a of ids) for (const b of ids) {
        if (a >= b) continue;
        const pa = netz.filter((r) => r.daten.gruppeId === a), pb = netz.filter((r) => r.daten.gruppeId === b);
        expect(minAbstandParallel(pa.map((r) => r.punkte), pb.map((r) => r.punkte)), `${name} ${a}/${b}`).toBeGreaterThan(0.09);
        // Kein Rohrende einer Gruppe liegt auf einem Rohr einer anderen Gruppe.
        const enden = pa.flatMap((r) => [r.punkte[0], r.punkte.at(-1)!]);
        expect(enden.some((p) => pb.some((r) => segmente(r).some(([x, y]) => auf(p, x, y)))), `${name} ${a}/${b}`).toBe(false);
      }
    }
  });
  it("Rohrstücke sind achsparallel", () => {
    for (const name of ALLE) for (const r of rohrnetz(muster(name), katalog, {})) for (const [a, b] of segmente(r)) {
      expect([0, 1, 2].filter((k) => Math.abs(a[k] - b[k]) > 1e-9).length, name).toBeLessThanOrEqual(1);
    }
  });
  it("Steigleitungen zwischen Geschossen nur in der Steigzone", () => {
    for (const name of ALLE) {
      const w = muster(name), netz = rohrnetz(w, katalog, {});
      const sz = w.steigzone!, n = gruppenVerbindungen(w, katalog).length;
      for (const r of netz.filter((r) => r.daten.art === "verteil")) for (const [a, b] of segmente(r)) {
        const g = w.geschosse.filter((g) => Math.min(a[1], b[1]) < g.yUnten - 1e-6 && Math.max(a[1], b[1]) > g.yUnten + 1e-6);
        if (!g.length) continue;
        expect(Math.abs(a[0] - sz.x) <= n * 0.18 + 1e-6 && Math.abs(a[2] - sz.z) <= n * 0.18 + 1e-6, `${name} ${a}`).toBe(true);
      }
    }
  });
  it("Verteiler mit Gruppen: je Gruppe ein eigener Abgang, Balken wächst mit der Anzahl", () => {
    expect(verteilerLaenge(6)).toBeGreaterThan(verteilerLaenge(2));
    const xs = Array.from({ length: 6 }, (_, i) => verteilerAbgang(i, 6)[0]);
    expect(new Set(xs).size).toBe(6);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(verteilerLaenge(6));
    expect(verteilerAbgang(5)).toEqual(verteilerAbgang(1)); // v1 unverändert
  });
  it("Masse aus dem Katalog, Rückfall auf die bisherigen Werte", () => {
    expect(modellFuer("heizung.wmz", [{ id: "heizung.wmz", name: "", bereich: "zubehoer", masse: [0.3, 0.2, 0.1] }]).masse).toEqual([0.3, 0.2, 0.1]);
    expect(modellFuer("heizung.speicher").masse).toEqual([0.9, 1.8, 0.9]);
    expect(modellFuer("heizung.ventil_3weg").pfad).toBe("/modelle/heizung.ventil_3weg.glb");
  });
});
