import { describe, it, expect } from "vitest";
import { einpassen, freiraumMitte, gruppenBereich, ISO_RICHTUNG, zielKorrektur } from "./kamera";
import type { Welt } from "../typen";
import type { Bereich } from "../szene2/huelle";
import { OrthographicCamera, Vector3 } from "three";

const B: Bereich = { xMin: 0, xMax: 30, zMin: 0, zMax: 15, yMin: 0, yMax: 6.5 };
const OHNE = { links: 0, rechts: 0, oben: 0, unten: 0 };

describe("einpassen", () => {
  it("ohne Freiraum zielt auf die Mitte des Bereichs", () => {
    const e = einpassen(B, 1440, 900, OHNE, 0.7);
    expect(e.ziel[0]).toBeCloseTo(15);
    expect(e.ziel[1]).toBeCloseTo(3.25);
    expect(e.ziel[2]).toBeCloseTo(7.5);
  });
  it("Kamera liegt in Iso-Richtung vom Ziel", () => {
    const e = einpassen(B, 1440, 900, OHNE, 0.7);
    const d = [e.position[0] - e.ziel[0], e.position[1] - e.ziel[1], e.position[2] - e.ziel[2]];
    const l = Math.hypot(...d);
    d.forEach((v, i) => expect(v / l).toBeCloseTo(ISO_RICHTUNG[i]));
  });
  it("Zoom waechst linear mit der Ansicht und faellt mit der Gebaeudegroesse", () => {
    const a = einpassen(B, 1440, 900, OHNE, 0.7).zoom;
    expect(einpassen(B, 2880, 1800, OHNE, 0.7).zoom).toBeCloseTo(2 * a);
    const gross = { ...B, xMax: 60, zMax: 30 };
    expect(einpassen(gross, 1440, 900, OHNE, 0.7).zoom).toBeLessThan(a);
  });
  it("Fuellgrad skaliert den Zoom", () => {
    expect(einpassen(B, 1440, 900, OHNE, 0.35).zoom).toBeCloseTo(einpassen(B, 1440, 900, OHNE, 0.7).zoom / 2);
  });
  it("Freiraum links verschiebt das Bild nach rechts (Ziel nach links)", () => {
    const mitte = einpassen(B, 1440, 900, OHNE, 0.7);
    const links = einpassen(B, 1440, 900, { links: 320, rechts: 0, oben: 0, unten: 0 }, 0.7);
    expect(links.zoom).toBeLessThan(mitte.zoom);
    // Bildschirm-rechts-Vektor der Iso-Kamera zeigt in (+x, 0, -z)/sqrt2: Ziel wandert entgegen
    const verschiebung = (links.ziel[0] - mitte.ziel[0]) - (links.ziel[2] - mitte.ziel[2]);
    expect(verschiebung).toBeLessThan(0);
  });
  it("passt auch beim steileren Einblick alle Gebäudeecken in den reservierten freien Raum ein", () => {
    const e = einpassen(B, 1440, 900, { links: 320, rechts: 280, oben: 100, unten: 200 }, 0.7, [1, 1.45, 1]);
    const k = new OrthographicCamera(-720, 720, 450, -450, 0.1, 1000);
    k.position.set(...e.position); k.zoom = e.zoom; k.lookAt(...e.ziel); k.updateProjectionMatrix(); k.updateMatrixWorld();
    for (const x of [B.xMin, B.xMax]) for (const y of [B.yMin, B.yMax]) for (const z of [B.zMin, B.zMax]) {
      const p = new Vector3(x, y, z).project(k);
      const px = (p.x + 1) * 720, py = (1 - p.y) * 450;
      expect(px).toBeGreaterThan(320); expect(px).toBeLessThan(1160);
      expect(py).toBeGreaterThan(100); expect(py).toBeLessThan(700);
    }
    expect(e.position[1] - e.ziel[1]).toBeGreaterThan(e.position[0] - e.ziel[0]);
  });
});

describe("zielKorrektur", () => {
  it("lässt eine Einpassung mit einseitigem Freiraum (Assistent) unverändert", () => {
    // Assistent 1440 x 900: Formular links bis 844 px. Die Einpassung schiebt das Ziel absichtlich aus dem Gebäude;
    // geklemmt wird die Mitte der freien Fläche, sonst rutscht das Gebäude unter das Formular (PO 14.11., Punkt 10).
    const g: Bereich = { xMin: 0, xMax: 12, yMin: -0.25, yMax: 9.6, zMin: 0, zMax: 15 };
    const frei = { links: 844, rechts: 20, oben: 104, unten: 28 };
    const e = einpassen(g, 1440, 900, frei, 0.7, [1, 1, 1]);
    const cam = new OrthographicCamera(-720, 720, 450, -450, 0.1, 1000);
    cam.position.set(...e.position); cam.zoom = e.zoom; cam.lookAt(...e.ziel); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    const ziel = new Vector3(...e.ziel);
    expect(zielKorrektur(ziel, g).some((v) => Math.abs(v) > 1e-6)).toBe(true); // bisherige Klemmung des Ziels verschob die Ansicht
    expect(zielKorrektur(freiraumMitte(cam, ziel, frei), g).every((v) => Math.abs(v) < 1e-6)).toBe(true);
  });
  const b: Bereich = { xMin: 0, xMax: 30, yMin: 0, yMax: 6, zMin: 0, zMax: 10 };
  it("lässt ein Ziel innerhalb des Bereichs unverändert", () => {
    expect(zielKorrektur({ x: 2, y: 3, z: 9 }, b)).toEqual([0, 0, 0]);
  });
  it("holt ein zu weit verschobenes Ziel an den Rand zurück", () => {
    const [dx, , dz] = zielKorrektur({ x: 100, y: 3, z: -40 }, b);
    expect(100 + dx).toBe(30); expect(-40 + dz).toBe(0);
  });
});

describe("gruppenBereich (Kamera auf Gruppenverlauf)", () => {
  const sym = (schluessel: string, x: number, y: number, z: number) => ({ schluessel, katalogId: "k", hersteller: null, typ: null, bauteilIds: [],
    mengeSumme: 1, mengeUnbekannt: false, status: "bestaetigt", position: { x, y, z }, versorgt: [] }) as unknown as Welt["symbole"][number];
  const welt = { regelwerkVersion: 2, hash: "g", grundriss: [{ x: 0, z: 0, breite: 20, tiefe: 10 }], hinweise: [],
    geschosse: [{ id: "eg", code: "EG", yUnten: 0, hoehe: 3 }, { id: "og", code: "OG1", yUnten: 3, hoehe: 3 }],
    einheiten: [{ id: "e1", geschossId: "og", rechteck: { x: 10, z: 2, breite: 4, tiefe: 3 } }],
    symbole: [sym("vt", 1, 0, 1), sym("hk", 8, 0, 9)],
    gruppen: [{ id: "g1", verteiler: "vt", nummer: 1, art: "ungeregelt", bezeichnung: "", verbraucher: ["hk", "e1"], zubehoer: [] }] } as unknown as Welt;
  const masse = (): [number, number, number] => [1, 1, 1];

  it("umfasst Verteiler und Verbraucher sichtbarer Geschosse bis zur Decke", () => {
    expect(gruppenBereich(welt, "g1", ["eg"], {}, masse)).toEqual({ xMin: 0.5, xMax: 8.5, yMin: 0, yMax: 3, zMin: 0.5, zMax: 9.5 });
  });
  it("nimmt Einheiten als Verbraucher und Geschoss-Versatz mit", () => {
    expect(gruppenBereich(welt, "g1", ["eg", "og"], { og: 2 }, masse)).toEqual({ xMin: 0.5, xMax: 14, yMin: 0, yMax: 8, zMin: 0.5, zMax: 9.5 });
  });
  it("Ersatzgruppe ueber ihre Enden, unbekannte Gruppe ergibt null", () => {
    expect(gruppenBereich(welt, "ersatz:vt>hk", ["eg"], {}, masse)?.xMax).toBe(8.5);
    expect(gruppenBereich(welt, "gibts-nicht", ["eg"], {}, masse)).toBeNull();
  });
});
