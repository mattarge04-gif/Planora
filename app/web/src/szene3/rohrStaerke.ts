import * as THREE from "three";
import { ROHR } from "./technik";

/**
 * Bildschirm-Mindeststärke der Leitungen (Kritik 15.11.2026 B1, Lesson 12.11. "Rohre verdicken"): Aus der Distanz
 * (Geschossfokus, Technikübersicht) werden alle Rohre und Formstücke um denselben Faktor um ihre Achse verdickt, damit
 * eine Gruppenleitung mindestens `zielPx` breit erscheint. In der Nahansicht bleibt der Faktor 1 (echte Radien).
 * Nur Darstellung im Vertex-Shader: Rohrpunkte, Radien der Daten und Routerabstände bleiben unverändert, keine
 * Geometrie wird bei Zoom neu gebaut.
 */
export const ROHR_STAERKE = {
  /** Mindest-Strichbreite einer Gruppenleitung in CSS-px [A]. */
  zielPx: 4.4,
  /**
   * Obergrenze der Verdickung [A]. Muster 6 im Geschossfokus (1280x720, rund 12 px/m) braucht etwa Faktor 3; bei dieser
   * Distanz liegen Parallelspuren (Lücke 0.04 m) und Bogenradien ohnehin unter einem Pixel.
   */
  max: 3.5,
} as const;

/** Verdickungsfaktor bei orthografischem Zoom (px pro Meter); Hierarchie Haupt/Gruppe bleibt erhalten. */
export function rohrFaktor(zoom: number): number {
  if (!(zoom > 0)) return 1;
  const breite = 2 * ROHR.verteil * zoom;
  return Math.min(ROHR_STAERKE.max, Math.max(1, ROHR_STAERKE.zielPx / breite));
}

/** Gemeinsamer Uniform aller Leitungsmaterialien; einmal je Bild aus dem Kamerazoom gesetzt. */
export const ROHR_FAKTOR = { value: 1 };

/** Achsattribut: je Vertex der nächstgelegene Punkt der Rohrachse (Objektraum, vor einer Instanzmatrix). */
export const ACHSE = "rohrAchse";

/**
 * Ergänzt ein Material um die Verdickung um `rohrAchse`. Jede Geometrie mit diesem Material braucht das Attribut
 * (fehlt es, gilt Achse (0, 0, 0) und der ganze Körper würde um den Ursprung skaliert).
 */
export function mitRohrStaerke<M extends THREE.Material>(material: M): M {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRohrFaktor = ROHR_FAKTOR;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\nattribute vec3 ${ACHSE};\nuniform float uRohrFaktor;`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\ntransformed = ${ACHSE} + (transformed - ${ACHSE}) * uRohrFaktor;`);
  };
  material.customProgramCacheKey = () => "rohrStaerke";
  return material;
}

/** Achse eines Körpers mit Längsachse y (Zylinder): (0, y, 0). */
export function achseY(geometrie: THREE.BufferGeometry): THREE.BufferGeometry {
  const p = geometrie.getAttribute("position");
  const a = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) a[i * 3 + 1] = p.getY(i);
  geometrie.setAttribute(ACHSE, new THREE.BufferAttribute(a, 3));
  return geometrie;
}

/** Achse eines Körpers mit Längsachse z (Wandhülse): (0, 0, z). */
export function achseZ(geometrie: THREE.BufferGeometry): THREE.BufferGeometry {
  const p = geometrie.getAttribute("position");
  const a = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) a[i * 3 + 2] = p.getZ(i);
  geometrie.setAttribute(ACHSE, new THREE.BufferAttribute(a, 3));
  return geometrie;
}

/** Achse eines Punktkörpers (Kugel, T-Kern): Mittelpunkt (0, 0, 0). */
export function achseMitte(geometrie: THREE.BufferGeometry): THREE.BufferGeometry {
  geometrie.setAttribute(ACHSE, new THREE.BufferAttribute(new Float32Array(geometrie.getAttribute("position").count * 3), 3));
  return geometrie;
}

/** Achse eines Torus in der xy-Ebene um den Ursprung: Punkt auf dem Mittelkreis mit Radius `r`. */
export function achseTorus(geometrie: THREE.BufferGeometry, r: number): THREE.BufferGeometry {
  const p = geometrie.getAttribute("position");
  const a = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), l = Math.hypot(x, y) || 1;
    a[i * 3] = (x / l) * r; a[i * 3 + 1] = (y / l) * r;
  }
  geometrie.setAttribute(ACHSE, new THREE.BufferAttribute(a, 3));
  return geometrie;
}

/**
 * Trefferprüfung eines Rohrs entlang seiner Achse mit dem aktuell sichtbaren Radius (Radius × ROHR_FAKTOR): Aus der
 * Distanz ist das Rohr so breit anklickbar, wie es erscheint (Kritik r2 N3). Ersetzt `Mesh.raycast` des Rohrkörpers.
 */
export function rohrTreffer(punkte: readonly (readonly [number, number, number])[], radius: number) {
  const a = new THREE.Vector3(), b = new THREE.Vector3(), aufStrahl = new THREE.Vector3(), aufAchse = new THREE.Vector3();
  const inv = new THREE.Matrix4(), strahl = new THREE.Ray();
  return function (this: THREE.Object3D, raycaster: THREE.Raycaster, ziel: THREE.Intersection[]) {
    inv.copy(this.matrixWorld).invert();
    strahl.copy(raycaster.ray).applyMatrix4(inv);
    const grenze = (radius * ROHR_FAKTOR.value) ** 2;
    let best: THREE.Vector3 | null = null;
    for (let i = 1; i < punkte.length; i++) {
      a.set(...punkte[i - 1]); b.set(...punkte[i]);
      if (strahl.distanceSqToSegment(a, b, aufStrahl, aufAchse) > grenze) continue;
      const welt = aufStrahl.clone().applyMatrix4(this.matrixWorld);
      if (!best || welt.distanceTo(raycaster.ray.origin) < best.distanceTo(raycaster.ray.origin)) best = welt;
    }
    if (!best) return;
    const distance = best.distanceTo(raycaster.ray.origin);
    if (distance < raycaster.near || distance > raycaster.far) return;
    ziel.push({ distance, point: best, object: this });
  };
}

