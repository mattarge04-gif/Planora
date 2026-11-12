import { describe, expect, it } from "vitest";
import type { Welt } from "../typen";
import { geschossSchnitt, wandBleibt } from "./schnitt";
import { waendeVon } from "../szene2/huelle";

const welt: Welt = {
  regelwerkVersion: 1, hash: "schnitt", grundriss: [], einheiten: [], symbole: [], hinweise: [],
  geschosse: [
    { id: "og2", code: "OG2", yUnten: 6.5, hoehe: 3 },
    { id: "ug", code: "UG", yUnten: -3, hoehe: 3 },
    { id: "eg", code: "EG", yUnten: 0, hoehe: 3 },
    { id: "og1", code: "OG1", yUnten: 3, hoehe: 3.5 },
  ],
};

describe("Geschossschnitt", () => {
  it("öffnet OG1, erhält EG/UG, entfernt OG2 und Dach unabhängig von Array-Reihenfolge", () => {
    const s = geschossSchnitt(welt, "og1");
    expect(s.dach).toBe(false);
    expect(s.geschosse.map((g) => [g.id, g.offen])).toEqual([["ug", false], ["eg", false], ["og1", true]]);
    expect(welt.geschosse).toHaveLength(4);
  });
  it("zeigt bei EG-Auswahl nur UG und offenes EG", () => {
    expect(geschossSchnitt(welt, "eg").geschosse.map((g) => g.id)).toEqual(["ug", "eg"]);
    expect(geschossSchnitt(welt, "ug").geschosse.map((g) => [g.id, g.offen])).toEqual([["ug", true]]);
  });
  it("stellt die vollständige geschlossene Übersicht bei leerer oder ungültiger Auswahl her", () => {
    for (const id of [null, "nicht-vorhanden"]) {
      const s = geschossSchnitt(welt, id);
      expect(s.dach).toBe(true);
      expect(s.geschosse).toHaveLength(4);
      expect(s.geschosse.every((g) => !g.offen)).toBe(true);
    }
    expect(geschossSchnitt({ ...welt, geschosse: [] }, null).dach).toBe(false);
  });
  it("entfernt nur die beiden vorderen Fassaden am offenen Geschoss und folgt dem Kameraseitenwechsel", () => {
    const waende = waendeVon({ x: 0, z: 0, breite: 30, tiefe: 15 });
    expect(waende.map((w) => wandBleibt(w.normale, true, [1, 1, 1]))).toEqual([true, false, false, true]);
    expect(waende.map((w) => wandBleibt(w.normale, true, [-1, 1, -1]))).toEqual([false, true, true, false]);
    expect(waende.every((w) => wandBleibt(w.normale, false, [1, 1, 1]))).toBe(true);
  });
});
