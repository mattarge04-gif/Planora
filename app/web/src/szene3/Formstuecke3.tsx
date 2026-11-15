import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { TOKENS } from "../design/tokens";
import { bogenMatrix, bogenSchluessel, FORMSTUECK, zylinderMatrix, type Formstuecke } from "./formstuecke";
import { ACHSE, achseMitte, achseTorus, achseY, mitRohrStaerke } from "./rohrStaerke";

/** Geteilte Einheitsgeometrien: Zylinder (Achse y, Höhe 1), Kugel, Viertelbogen je Radienverhältnis. */
const ZYLINDER = achseY(new THREE.CylinderGeometry(1, 1, 1, 16, 1));
const KUGEL = achseMitte(new THREE.SphereGeometry(1, 16, 12));
const BOEGEN = new Map<number, THREE.BufferGeometry>();
/** Viertelbogen mit Ecke im Ursprung: von (-1, 0, 0) entlang +x nach (0, 1, 0) entlang +y, Bogenradius 1. */
function bogenGeometrie(schluessel: number) {
  let g = BOEGEN.get(schluessel);
  if (!g) {
    g = achseTorus(new THREE.TorusGeometry(1, schluessel * FORMSTUECK.koerper, 12, 12, Math.PI / 2), 1);
    const lage = new THREE.Matrix4().makeTranslation(-1, 1, 0).multiply(new THREE.Matrix4().makeRotationZ(-Math.PI / 2));
    g.applyMatrix4(lage);
    g.getAttribute(ACHSE).applyMatrix4(lage);
    BOEGEN.set(schluessel, g);
  }
  return g;
}

export interface FormstueckFarben { normal: string; gedimmt: string }

/**
 * Formstücke eines Geschosses als Instanzen (wenige Draw-Calls auch bei Muster 6): Körper in der Leitungsfarbe und mit
 * der Hervorhebung ihres Rohres gedimmt, Pressringe in Metallgrau. Nicht anwählbar; Klicks treffen das Rohr darunter.
 */
export function Formstuecke3({ f, schatten, gruppe, farben }: { f: Formstuecke; schatten: boolean; gruppe: string | null; farben: FormstueckFarben }) {
  const koerper = useMemo(() => mitRohrStaerke(new THREE.MeshStandardMaterial({ color: "#ffffff", ...TOKENS.material.leitung })), []);
  const ring = useMemo(() => mitRohrStaerke(new THREE.MeshStandardMaterial({ color: TOKENS.farbe.grau2, ...TOKENS.material.metall })), []);
  useEffect(() => () => { koerper.dispose(); ring.dispose(); }, [koerper, ring]);
  const boegen = useMemo(() => {
    const m = new Map<number, typeof f.boegen>();
    for (const b of f.boegen) m.set(bogenSchluessel(b), [...(m.get(bogenSchluessel(b)) ?? []), b]);
    return [...m.entries()];
  }, [f]);
  const kerne = useMemo(() => f.knoten.map((k) => ({ matrix: new THREE.Matrix4().compose(new THREE.Vector3(...k.position), new THREE.Quaternion(),
    new THREE.Vector3().setScalar(k.radius * FORMSTUECK.koerper)), gruppeId: k.gruppeId })), [f]);
  const farbe = (gruppeId?: string) => gruppe && gruppeId !== gruppe ? farben.gedimmt : farben.normal;
  return <group name="formstuecke">
    {boegen.map(([s, liste]) => <Instanzen key={s} geometrie={bogenGeometrie(s)} material={koerper} schatten={schatten}
      teile={liste.map((b) => ({ matrix: bogenMatrix(b), farbe: farbe(b.gruppeId) }))} />)}
    <Instanzen geometrie={KUGEL} material={koerper} schatten={schatten} teile={kerne.map((k) => ({ matrix: k.matrix, farbe: farbe(k.gruppeId) }))} />
    <Instanzen geometrie={ZYLINDER} material={koerper} schatten={schatten}
      teile={f.muffen.map((z) => ({ matrix: zylinderMatrix(z), farbe: farbe(z.gruppeId) }))} />
    <Instanzen geometrie={ZYLINDER} material={ring} schatten={schatten} teile={f.ringe.map((z) => ({ matrix: zylinderMatrix(z) }))} />
  </group>;
}

function Instanzen({ geometrie, material, teile, schatten }: {
  geometrie: THREE.BufferGeometry; material: THREE.Material; teile: { matrix: THREE.Matrix4; farbe?: string }[]; schatten: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const c = new THREE.Color();
    teile.forEach((t, i) => {
      mesh.setMatrixAt(i, t.matrix);
      if (t.farbe) mesh.setColorAt(i, c.set(t.farbe));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [teile]);
  if (!teile.length) return null;
  return <instancedMesh key={teile.length} ref={ref} args={[geometrie, material, teile.length]} dispose={null} raycast={() => {}}
    castShadow={schatten} receiveShadow={schatten} userData={{ formstuecke: teile.length }} />;
}
