import { describe, it, expect } from "vitest";
import { klemmeSeite, naechsterTreffer, naechsterZoom, trefferSeiten, zoomFuerBreite, ZOOM_STUFEN } from "./seiten";
describe("Viewer-Navigation", () => {
  it("Startzoom an Breite: groesste passende Stufe zwischen 0.5 und 1.5", () => {
    // A4 = 595 pt breit; Flaeche minus 64 px Rand
    expect([zoomFuerBreite(595, 1400), zoomFuerBreite(595, 900), zoomFuerBreite(595, 700), zoomFuerBreite(595, 300)]).toEqual([1.5, 1.25, 1, 0.5]);
  });
  it("Seite klemmen", () => { expect([klemmeSeite(0, 3), klemmeSeite(2, 3), klemmeSeite(9, 3), klemmeSeite(Number.NaN, 3)]).toEqual([1, 2, 3, 1]); });
  it("Zoom-Stufen", () => {
    expect(ZOOM_STUFEN).toContain(1);
    expect([naechsterZoom(1, 1), naechsterZoom(1, -1), naechsterZoom(3, 1), naechsterZoom(0.5, -1), naechsterZoom(1.1, 1)]).toEqual([1.25, 0.75, 3, 0.5, 1.25]);
  });
  it("Textsuche ohne Gross/Klein, ab 2 Zeichen", () => {
    const t = ["Umwälzpumpe Wilo", "nichts", "PUMPE pumpe"];
    expect(trefferSeiten(t, "pumpe")).toEqual([{ seite: 1, anzahl: 1 }, { seite: 3, anzahl: 2 }]);
    expect(trefferSeiten(t, "p")).toEqual([]);
    expect([naechsterTreffer([{ seite: 1 }, { seite: 3 }], 1, 1), naechsterTreffer([{ seite: 1 }, { seite: 3 }], 3, 1), naechsterTreffer([{ seite: 1 }, { seite: 3 }], 1, -1), naechsterTreffer([], 1, 1)]).toEqual([3, 1, 3, null]);
  });
});
