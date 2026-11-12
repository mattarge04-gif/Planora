import { describe, expect, it } from "vitest";
import { OrthographicCamera, Vector3 } from "three";
import type { Welt } from "../typen";
import { anlageEinpassen, bildpunkt, freiraumScissor, ortBereich, punktImFreiraum, type Einpassung } from "./kamera";
import { fahrtSchritt, kameraEingaben, rueckkehrAnsicht, type Kamerafahrt } from "./kameraFahrt";

const frei = { links: 368, rechts: 336, oben: 72, unten: 283 };
const von: Einpassung = { position: [100, 100, 100], ziel: [0, 0, 0], zoom: 15 };
const nach: Einpassung = { position: [120, 110, 100], ziel: [20, 10, 0], zoom: 80 };

describe("Auswahl- und Ortsfahrt", () => {
  it.each([[1280, 720], [1440, 900], [1920, 1080]])("zeigt auch kleine Anlagen bei %s × %s mit mindestens 60 px und vollständig im Freiraum", (w, h) => {
    for (const m of [[1, 1.2, 0.6], [0.35, 0.45, 0.3], [1.2, 1, 0.3], [0.6, 0.8, 0.15]]) {
      const b = { xMin: 27 - m[0] / 2, xMax: 27 + m[0] / 2, yMin: 3.2, yMax: 3.2 + m[1], zMin: 7 - m[2] / 2, zMax: 7 + m[2] / 2 };
      const e = anlageEinpassen(b, w, h, frei, [1, 1.45, 1]);
      const c = new OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.1, 1000);
      c.position.set(...e.position); c.zoom = e.zoom; c.lookAt(...e.ziel); c.updateProjectionMatrix(); c.updateMatrixWorld();
      const ps = [];
      for (const x of [b.xMin, b.xMax]) for (const y of [b.yMin, b.yMax]) for (const z of [b.zMin, b.zMax]) ps.push(bildpunkt(c, w, h, new Vector3(x, y, z))!);
      expect(ps.every((p) => punktImFreiraum(p, w, h, frei))).toBe(true);
      const groesse = Math.max(Math.max(...ps.map((p) => p.x)) - Math.min(...ps.map((p) => p.x)), Math.max(...ps.map((p) => p.y)) - Math.min(...ps.map((p) => p.y)));
      expect(groesse).toBeGreaterThanOrEqual(60); expect(groesse).toBeCloseTo(96, 0);
      expect(e.zoom).toBeGreaterThan(15);
    }
  });
  it("fährt zum echten Ortsziel inklusive Separation und ohne Position zum ganzen Geschoss", () => {
    const welt: Welt = { regelwerkVersion: 1, hash: "ort", grundriss: [{ x: 0, z: 0, breite: 30, tiefe: 15 }],
      geschosse: [{ id: "og", code: "OG1", yUnten: 3.2, hoehe: 3.2 }], einheiten: [], symbole: [], hinweise: [] };
    expect(ortBereich(welt, { geschossId: "og", position: { x: 22.5, y: 3.2, z: 7.5 } }, { og: 2.56 }))
      .toEqual({ xMin: 19.5, xMax: 25.5, zMin: 4.5, zMax: 10.5, yMin: 5.76, yMax: 6.76 });
    expect(ortBereich(welt, { geschossId: "og" }, {})).toEqual({ xMin: 0, xMax: 30, zMin: 0, zMax: 15, yMin: 3.2, yMax: 6.4 });
    expect(ortBereich(welt, { geschossId: "fehlt" }, {})).toBeNull();
    expect(ortBereich({ ...welt, grundriss: [] }, { geschossId: "og" }, {})).toBeNull();
  });
  it("interpoliert Position, Ziel und Zoom und endet exakt zur Token-Dauer", () => {
    const f = { von, nach, ms: 0 };
    const s = fahrtSchritt(f, 375, 750);
    expect(s.ansicht.zoom).toBeGreaterThan(15); expect(s.ansicht.zoom).toBeLessThan(80);
    expect(s.rest?.ms).toBe(375); expect(f.ms).toBe(0);
    expect(fahrtSchritt(s.rest!, 375, 750)).toEqual({ ansicht: nach, rest: null });
    expect(fahrtSchritt(f, 0, 750, true)).toEqual({ ansicht: nach, rest: null });
  });
  it("kehrt nach Auswahl zur gespeicherten Ansicht zurück und bei Kontextwechsel zum aktuellen Geschoss-Fit", () => {
    expect(rueckkehrAnsicht(von, nach, true)).toEqual(von);
    expect(rueckkehrAnsicht(von, nach, false)).toEqual(nach);
    expect(rueckkehrAnsicht(null, nach, true)).toEqual(nach);
  });
  it("bricht eine laufende Rückfahrt per Mausrad ab, bevor der Benutzerzoom angewendet wird", () => {
    const element = new EventTarget();
    let fahrt: Kamerafahrt | null = { von: nach, nach: von, ms: 100 }, zoom = nach.zoom;
    const entfernen = kameraEingaben(element, () => { fahrt = null; });
    element.addEventListener("wheel", () => { expect(fahrt).toBeNull(); zoom *= 1.05; });
    element.dispatchEvent(new Event("wheel"));
    if (fahrt) zoom = fahrtSchritt(fahrt, 16, 750).ansicht.zoom;
    expect(zoom).toBe(84);
    entfernen();
  });
  it("bricht auch bei Zeiger-, Touch- und Tastatureingabe ab und entfernt sämtliche Listener", () => {
    const element = new EventTarget(); let n = 0;
    const entfernen = kameraEingaben(element, () => { n++; });
    for (const typ of ["pointerdown", "touchstart", "keydown"]) element.dispatchEvent(new Event(typ));
    expect(n).toBe(3); entfernen();
    for (const typ of ["pointerdown", "touchstart", "keydown", "wheel"]) element.dispatchEvent(new Event(typ));
    expect(n).toBe(3);
  });
});

describe("Kulisse an der Tabellenkante beschneiden", () => {
  it.each([[1280, 720], [1440, 900], [1920, 1080]])("hält alle vier Kartenränder bei %s × %s in Hauptpuffer und RenderTarget ein", (w, h) => {
    for (const faktor of [1, 1.5, 2]) {
      const [x, y, b, t] = freiraumScissor(w, h, frei, faktor);
      expect(x / faktor).toBeGreaterThanOrEqual(frei.links + 11.5);
      expect(y / faktor).toBeGreaterThanOrEqual(frei.unten + 11.5);
      expect((x + b) / faktor).toBeLessThanOrEqual(w - frei.rechts - 11.5);
      expect((y + t) / faktor).toBeLessThanOrEqual(h - frei.oben - 11.5);
      expect(b).toBeGreaterThan(0); expect(t).toBeGreaterThan(0);
    }
  });
  it("liefert bei überlappenden Karten keinen negativen WebGL-Ausschnitt", () => {
    expect(freiraumScissor(300, 200, frei).slice(2)).toEqual([0, 0]);
  });
});
