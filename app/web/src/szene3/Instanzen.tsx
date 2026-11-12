import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import type { Fenster, Quader } from "../szene2/huelle";

/** Wiederholte Fassadenfragmente teilen Geometrie und Material. */
export function Quaderinstanzen({ teile, material, schatten }: { teile: Quader[]; material: THREE.Material; schatten: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const o = new THREE.Object3D();
    teile.forEach((q, i) => { o.position.set(...q.mitte); o.scale.set(...q.groesse); o.updateMatrix(); ref.current!.setMatrixAt(i, o.matrix); });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [teile]);
  if (!teile.length) return null;
  return <instancedMesh key={teile.length} ref={ref} args={[undefined, material, teile.length]} castShadow={schatten} receiveShadow><boxGeometry /></instancedMesh>;
}

export function Glasinstanzen({ fenster, material }: { fenster: Fenster[]; material: THREE.Material }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const o = new THREE.Object3D();
    fenster.forEach((f, i) => {
      o.position.set(...f.mitte); o.rotation.set(0, f.drehungY, 0); o.scale.set(f.breite, f.hoehe, 1); o.updateMatrix(); ref.current!.setMatrixAt(i, o.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [fenster]);
  if (!fenster.length) return null;
  return <instancedMesh key={fenster.length} ref={ref} args={[undefined, material, fenster.length]} receiveShadow><planeGeometry /></instancedMesh>;
}
