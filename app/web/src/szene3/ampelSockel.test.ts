import { describe, expect, it } from "vitest";
import { TOKENS } from "../design/tokens";
import { AMPEL_FARBE } from "../lebensdauer/ansicht";
import { ampelBereich, ampelMarker, ampelRinge, ampelVonFarbe, ringBreite, striche1D, type AmpelAnlage } from "./ampelSockel";

const E = TOKENS.erneuerung;
const anlage = (o: Partial<AmpelAnlage> = {}): AmpelAnlage =>
  ({ schluessel: "a", mitte: [1, 0.5, 2], masse: [0.6, 1, 0.4], inline: false, farbe: AMPEL_FARBE.rot, ...o });

describe("ampelVonFarbe", () => {
  it("Farbe -> Stufe, unbekannt grau", () => {
    expect(ampelVonFarbe(AMPEL_FARBE.gelb)).toBe("gelb");
    expect(ampelVonFarbe(AMPEL_FARBE.gruen.toUpperCase())).toBe("gruen");
    expect(ampelVonFarbe("#123456")).toBe("grau");
  });
});

describe("ampelRinge", () => {
  it("vier Streifen konstanter Breite, unabhaengig von der Geraetegroesse", () => {
    const klein = ampelRinge([anlage()], 3), gross = ampelRinge([anlage({ masse: [3, 2, 1.5] })], 3);
    expect(klein).toHaveLength(4); expect(gross).toHaveLength(4);
    const aussenX = 0.6 + 2 * (E.ringAbstandM + E.ringBreiteM);
    expect(klein.find((s) => s.achse === "x")!.laenge).toBeCloseTo(aussenX);
    expect(klein[0].position[1]).toBeCloseTo(3 + E.ringBodenM + E.ringHoeheM / 2);
    // Innenkante mit Abstand zum Grundriss
    const zStreifen = klein.filter((s) => s.achse === "z").map((s) => s.position[0]).sort();
    expect(zStreifen[1] - 1 - E.ringBreiteM / 2).toBeCloseTo(0.3 + E.ringAbstandM);
  });
  it("Teile in der Leitung ohne Ring; dringendere Ringe zuletzt", () => {
    const s = ampelRinge([anlage({ schluessel: "r" }), anlage({ schluessel: "g", farbe: AMPEL_FARBE.gruen }), anlage({ schluessel: "i", inline: true })], 0);
    expect(s).toHaveLength(8);
    expect(s.at(-1)!.farbe).toBe(AMPEL_FARBE.rot);
    expect(s[0].farbe).toBe(AMPEL_FARBE.gruen);
  });
  it("Baujahr fehlt: gestrichelt (mehr als vier Streifen)", () => {
    expect(ampelRinge([anlage({ farbe: AMPEL_FARBE.grau, masse: [1, 1, 1] })], 0).length).toBeGreaterThan(4);
  });
});

describe("striche1D", () => {
  it("Enden voll, Summe aus Strichen und Luecken ergibt die Laenge", () => {
    const l = 1.0, t = striche1D(l);
    expect(t[0][0] - t[0][1] / 2).toBeCloseTo(-l / 2);
    expect(t.at(-1)![0] + t.at(-1)![1] / 2).toBeCloseTo(l / 2);
    expect(t.reduce((s, [, x]) => s + x, 0) + (t.length - 1) * E.lueckeM).toBeCloseTo(l);
  });
  it("kurze Strecke: ein Strich", () => { expect(striche1D(0.05)).toEqual([[0, 0.05]]); });
});

describe("ringBreite", () => {
  it("nah konstant, fern Mindest-px, gedeckelt", () => {
    expect(ringBreite(400)).toBe(E.ringBreiteM);
    expect(ringBreite(1)).toBe(E.ringBreiteMaxM);
    expect(ringBreite(25)).toBeCloseTo(Math.max(E.ringBreiteM, E.ringBreitePx / 25), 2);
  });
});

describe("ampelMarker", () => {
  it("Groesse nach Dringlichkeit, Rot zuletzt, Anker auf Oberkante", () => {
    const m = ampelMarker([{ ...anlage({ schluessel: "r" }), geschossId: "eg" }, { ...anlage({ schluessel: "g", farbe: AMPEL_FARBE.gruen, masse: [3, 2, 2] }), geschossId: "eg" }]);
    expect(m.map((x) => x.ampel)).toEqual(["gruen", "rot"]);
    expect(m[1].px).toBe(E.markerPx.rot);
    expect(m[1].px).toBeGreaterThan(m[0].px);
    expect(m[1].anker[1]).toBeCloseTo(1);
  });
  it("gleiche Instanz nur einmal", () => {
    const a = { ...anlage(), geschossId: "eg" };
    expect(ampelMarker([a, a])).toHaveLength(1);
  });
});

describe("ampelBereich", () => {
  it("rahmt Rot/Gelb, mindestens kameraMinM", () => {
    const b = ampelBereich([anlage({ mitte: [0, 0.5, 0] }), anlage({ farbe: AMPEL_FARBE.gruen, mitte: [50, 0.5, 50] })])!;
    expect(b.xMax - b.xMin).toBeCloseTo(E.kameraMinM);
    expect((b.xMin + b.xMax) / 2).toBeCloseTo(0);
  });
  it("nur Gruen: alle; leer: null", () => {
    const b = ampelBereich([anlage({ farbe: AMPEL_FARBE.gruen, mitte: [0, 0.5, 0] }), anlage({ farbe: AMPEL_FARBE.gruen, mitte: [20, 0.5, 0] })])!;
    expect(b.xMax - b.xMin).toBeCloseTo(20.6);
    expect(ampelBereich([])).toBeNull();
  });
});

describe("vorNeutralToneMapping", () => {
  it("Umkehr: nach dem Tone Mapping wieder die Tokenfarbe (linear)", async () => {
    const { Color } = await import("three");
    const { neutralToneMapping, vorNeutralToneMapping } = await import("./ampelSockel");
    for (const hex of Object.values(AMPEL_FARBE)) {
      const c = new Color(hex), lin: [number, number, number] = [c.r, c.g, c.b];
      const zurueck = neutralToneMapping(vorNeutralToneMapping(lin));
      zurueck.forEach((v, i) => expect(v).toBeCloseTo(lin[i], 4));
    }
  });
  it("ohne Umkehr verschiebt das Tone Mapping Gruen sichtbar (Ursache der Kritik)", async () => {
    const { Color } = await import("three");
    const { neutralToneMapping } = await import("./ampelSockel");
    const c = new Color(AMPEL_FARBE.gruen), aus = new Color().setRGB(...neutralToneMapping([c.r, c.g, c.b]));
    expect(aus.getHexString()).not.toBe(c.getHexString());
  });
});

describe("markerReihen", () => {
  it("einzelne Marker bleiben, ueberlappende werden eine Reihe ohne Ueberlappung", async () => {
    const { markerReihen } = await import("./ampelSockel");
    const p = [{ x: 100, y: 100, d: 22 }, { x: 108, y: 104, d: 18 }, { x: 300, y: 50, d: 13 }];
    const v = markerReihen(p, 3);
    expect(v[2]).toEqual({ dx: 0, dy: 0 });
    const a = { x: p[0].x + v[0].dx, y: p[0].y + v[0].dy }, b = { x: p[1].x + v[1].dx, y: p[1].y + v[1].dy };
    expect(a.y).toBe(b.y);
    expect(b.x - a.x).toBeCloseTo((22 + 18) / 2 + 3);
    expect(a.x).toBeLessThan(b.x); // Reihenfolge wie uebergeben
    expect((a.x - 11 + b.x + 9) / 2).toBeCloseTo(104); // mittig ueber dem Schwerpunkt
  });
  it("Kette: A nahe B, B nahe C -> eine Gruppe", async () => {
    const { markerReihen } = await import("./ampelSockel");
    const v = markerReihen([{ x: 0, y: 0, d: 10 }, { x: 10, y: 0, d: 10 }, { x: 20, y: 0, d: 10 }], 3);
    expect(v.every((o) => o.dy === 0)).toBe(true);
    expect(v[1].dx).toBeCloseTo(0);
  });
});

describe("Marker ausserhalb des Fokus und Reihen ohne Ueberlappung", () => {
  it("Geschoss ausserhalb des Fokus: gedimmt und kleiner", () => {
    const m = ampelMarker([{ ...anlage({ schluessel: "u" }), geschossId: "ug" }, { ...anlage({ schluessel: "e" }), geschossId: "eg" }], "eg");
    const u = m.find((x) => x.schluessel === "u")!, e = m.find((x) => x.schluessel === "e")!;
    expect(u.gedimmt).toBe(true); expect(e.gedimmt).toBeUndefined();
    expect(u.px).toBeLessThan(e.px);
    expect(ampelMarker([{ ...anlage(), geschossId: "ug" }]).every((x) => !x.gedimmt)).toBe(true);
  });
  it("Reihe, die in eine Nachbargruppe ragt, wird zusammengelegt (keine Ueberlappung)", async () => {
    const { markerReihen } = await import("./ampelSockel");
    const p = [{ x: 0, y: 0, d: 20 }, { x: 5, y: 0, d: 20 }, { x: 5, y: 0, d: 20 }, { x: 45, y: 0, d: 20 }];
    const v = markerReihen(p, 3), lage = p.map((q, i) => ({ x: q.x + v[i].dx, y: q.y + v[i].dy }));
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) expect(Math.hypot(lage[i].x - lage[j].x, lage[i].y - lage[j].y)).toBeGreaterThanOrEqual(20 - 1e-9);
  });
});
