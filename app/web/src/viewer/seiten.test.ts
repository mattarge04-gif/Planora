import { describe, it, expect } from "vitest";
import { klemmeSeite, naechsterZoom, ZOOM_STUFEN } from "./seiten";
describe("Viewer-Navigation", () => {
  it("Seite klemmen", () => { expect([klemmeSeite(0, 3), klemmeSeite(2, 3), klemmeSeite(9, 3), klemmeSeite(Number.NaN, 3)]).toEqual([1, 2, 3, 1]); });
  it("Zoom-Stufen", () => {
    expect(ZOOM_STUFEN).toContain(1);
    expect([naechsterZoom(1, 1), naechsterZoom(1, -1), naechsterZoom(3, 1), naechsterZoom(0.5, -1), naechsterZoom(1.1, 1)]).toEqual([1.25, 0.75, 3, 0.5, 1.25]);
  });
});
import { blaettereTreffer, jeSeite, klemmeVersatz, startTreffer, teileText, trefferListe, versatzUmPunkt, zoomEinpassen } from "./seiten";
describe("Suche mit Markierung", () => {
  const s = [["Umwälzpumpe Wilo", "Pumpe"], ["nichts"], ["PUMPE pumpe"]];
  it("Treffer je Textstück in Lesereihenfolge", () => {
    const t = trefferListe(s, "pumpe");
    expect(t).toEqual([{ seite: 1, stueck: 0, start: 6, laenge: 5 }, { seite: 1, stueck: 1, start: 0, laenge: 5 }, { seite: 3, stueck: 0, start: 0, laenge: 5 }, { seite: 3, stueck: 0, start: 6, laenge: 5 }]);
    expect(jeSeite(t)).toEqual([{ seite: 1, anzahl: 2 }, { seite: 3, anzahl: 2 }]);
    expect(trefferListe(s, " p ")).toEqual([]);
  });
  it("Start ab aktueller Seite, Blättern im Kreis", () => {
    const t = trefferListe(s, "pumpe");
    expect([startTreffer(t, 1), startTreffer(t, 2), startTreffer(t, 9), startTreffer([], 1)]).toEqual([0, 2, 0, -1]);
    expect([blaettereTreffer(4, 3, 1), blaettereTreffer(4, 0, -1), blaettereTreffer(0, 0, 1)]).toEqual([0, 3, -1]);
  });
  it("Text in markierte Abschnitte teilen", () => {
    expect(teileText("PUMPE pumpe", [{ start: 6, laenge: 5, nr: 2 }, { start: 0, laenge: 5, nr: 1 }])).toEqual([{ text: "PUMPE", nr: 1 }, { text: " ", nr: null }, { text: "pumpe", nr: 2 }]);
    expect(teileText("abc", [])).toEqual([{ text: "abc", nr: null }]);
  });
});
describe("Einpassen und Bild-Zoom", () => {
  it("ganze Seite sichtbar", () => {
    expect(zoomEinpassen(595, 842, 1184, 640)).toBe(0.7);
    expect(zoomEinpassen(400, 300, 1400, 800)).toBe(2.51);
    expect(zoomEinpassen(0, 1, 1, 1)).toBe(1);
  });
  it("Punkt unter dem Mauszeiger bleibt stehen", () => {
    expect(versatzUmPunkt(1, 2, { x: 0, y: 0 }, { x: 100, y: -50 })).toEqual({ x: -100, y: 50 });
    expect(versatzUmPunkt(2, 1, { x: -100, y: 50 }, { x: 100, y: -50 })).toEqual({ x: 0, y: 0 });
  });
  it("Versatz begrenzt, kleines Bild bleibt zentriert", () => {
    expect(klemmeVersatz({ x: 500, y: -500 }, { b: 1000, h: 400 }, { b: 800, h: 600 })).toEqual({ x: 124, y: 0 });
  });
});
