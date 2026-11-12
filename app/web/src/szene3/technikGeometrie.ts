import * as THREE from "three";
import type { V3 } from "../szene2/huelle";
import { rohrPfad } from "./technik";
import type { Rohrstueck } from "./netz";

/** Stetiger Übergang vom Stutzen über den Abgang zum Hauptrohr, ohne verdeckende Endscheibe. */
export function rohrGeometrie(stueck: Pick<Rohrstueck, "punkte" | "radius" | "startRadius" | "endRadius" | "boden">) {
  const pfad = rohrPfad(stueck.punkte, stueck.radius);
  if (!pfad.curves.length) return null;
  const n = pfad.curves.length * 16;
  const geometrie = new THREE.TubeGeometry(pfad, n, 1, 12, false);
  const punkte = Array.from({ length: n + 1 }, (_, i) => pfad.getPointAt(i / n));
  const laengen = [0];
  for (let i = 1; i <= n; i++) laengen.push(laengen[i - 1] + punkte[i].distanceTo(punkte[i - 1]));
  const position = geometrie.getAttribute("position");
  const adapter = stueck.radius < stueck.endRadius;
  for (let i = 0; i <= n; i++) {
    let r = THREE.MathUtils.lerp(stueck.startRadius, stueck.radius, Math.min(1, laengen[i] / 0.16));
    r = THREE.MathUtils.lerp(r, stueck.endRadius, Math.max(0, 1 - (laengen[n] - laengen[i]) / 0.18));
    if (adapter) r = Math.min(r, Math.max(0.004, (punkte[i].y - stueck.boden - 0.027) * 0.7));
    for (let j = 0; j <= 12; j++) {
      const index = i * 13 + j, p = new THREE.Vector3().fromBufferAttribute(position, index);
      p.sub(punkte[i]).multiplyScalar(r).add(punkte[i]);
      position.setXYZ(index, p.x, p.y, p.z);
    }
  }
  geometrie.computeVertexNormals(); geometrie.computeBoundingSphere();
  return geometrie;
}

/** Flaches, opakes Band; Viertelkreisbögen verbinden die Mäanderbahnen. */
export function bandGeometrie(punkte: V3[], breite = 0.025) {
  const pfad = rohrPfad(punkte, 0.18);
  if (!pfad.curves.length) return null;
  const n = pfad.curves.length * 16, position: number[] = [], indices: number[] = [];
  for (let i = 0; i <= n; i++) {
    const p = pfad.getPointAt(i / n), t = pfad.getTangentAt(i / n);
    const quer = new THREE.Vector3(-t.z, 0, t.x).normalize().multiplyScalar(breite / 2);
    position.push(p.x + quer.x, p.y, p.z + quer.z, p.x - quer.x, p.y, p.z - quer.z);
    if (i < n) { const a = i * 2; indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const geometrie = new THREE.BufferGeometry();
  geometrie.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
  geometrie.setIndex(indices); geometrie.computeVertexNormals();
  return geometrie;
}

export function huelsenGeometrie(radius: number) {
  const form = new THREE.Shape(), loch = new THREE.Path();
  form.absarc(0, 0, radius * 1.4, 0, Math.PI * 2, false);
  loch.absarc(0, 0, radius * 1.03, 0, Math.PI * 2, true); form.holes.push(loch);
  const geometrie = new THREE.ExtrudeGeometry(form, { depth: 0.04, bevelEnabled: false, curveSegments: 16 });
  geometrie.translate(0, 0, -0.02);
  return geometrie;
}
