import { RoundedBox, useGLTF } from "@react-three/drei";
import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { TOKENS } from "../design/tokens";
import type { V3 } from "../szene2/huelle";
import type { WeltSymbol } from "../typen";
import { anlagenDaten, modellFuer } from "./technik";

interface Props {
  symbole: WeltSymbol[]; schatten: boolean;
  onModell: (pfad: string, anschluss: V3) => void;
}

/** Ein Ladefehler betrifft nur diesen Modelltyp, niemals die übrige Szene. */
class ModellGrenze extends Component<{ children: ReactNode; ersatz: ReactNode }, { fehler: boolean }> {
  state = { fehler: false };
  static getDerivedStateFromError() { return { fehler: true }; }
  render() { return this.state.fehler ? this.props.ersatz : this.props.children; }
}

export function Anlagen3({ symbole, schatten, onModell }: Props) {
  const gruppen = useMemo(() => {
    const g = new Map<string, WeltSymbol[]>();
    for (const s of symbole) {
      const key = modellFuer(s.katalogId).pfad ?? s.katalogId;
      g.set(key, [...(g.get(key) ?? []), s]);
    }
    return [...g.entries()];
  }, [symbole]);
  useEffect(() => {
    for (const [pfad] of gruppen) if (pfad.startsWith("/modelle/")) useGLTF.preload(pfad, false, false);
  }, [gruppen]);
  return <group name="anlagen">{gruppen.map(([pfad, gruppe]) => {
    const ersatz = <Ersatz symbole={gruppe} schatten={schatten} />;
    return pfad.startsWith("/modelle/")
      ? <ModellGrenze key={pfad} ersatz={ersatz}><Suspense fallback={ersatz}>
        <Modell pfad={pfad} symbole={gruppe} schatten={schatten} onModell={onModell} />
      </Suspense></ModellGrenze>
      : <Ersatz key={pfad} symbole={gruppe} schatten={schatten} />;
  })}</group>;
}

function Ersatz({ symbole, schatten }: { symbole: WeltSymbol[]; schatten: boolean }) {
  return <>{symbole.map((s) => {
    const masse = modellFuer(s.katalogId).masse;
    return <group key={s.schluessel} name={s.schluessel} userData={{ ...anlagenDaten(s), ersatz: true }}
      position={[s.position.x, s.position.y, s.position.z]}>
      <RoundedBox args={masse} position={[0, masse[1] / 2, 0]} radius={TOKENS.radius.geraetM} smoothness={3}
        userData={anlagenDaten(s)} castShadow={schatten} receiveShadow={schatten}>
        <meshStandardMaterial color={TOKENS.farbe.grau1} {...TOKENS.material.geraet} />
      </RoundedBox>
    </group>;
  })}</>;
}

function Modell({ pfad, symbole, schatten, onModell }: {
  pfad: string; symbole: WeltSymbol[]; schatten: boolean; onModell: Props["onModell"];
}) {
  const { scene } = useGLTF(pfad, false, false);
  const modell = useMemo(() => {
    scene.updateMatrixWorld(true);
    const teile: { geometrie: THREE.BufferGeometry; material: THREE.Material | THREE.Material[]; matrix: THREE.Matrix4 }[] = [];
    const materialien = new Map<THREE.Material, THREE.Material>();
    const material = (m: THREE.Material) => {
      if (m.name !== "koo") return m;
      if (!materialien.has(m)) {
        const kopie = m.clone() as THREE.MeshStandardMaterial;
        kopie.color.set(TOKENS.farbe.kooHeizung);
        materialien.set(m, kopie);
      }
      return materialien.get(m)!;
    };
    scene.traverse((o) => {
      if (o instanceof THREE.Mesh) teile.push({ geometrie: o.geometry,
        material: Array.isArray(o.material) ? o.material.map(material) : material(o.material), matrix: o.matrixWorld.clone() });
    });
    const empty = scene.getObjectByName("anschluss");
    const anschluss = empty ? empty.getWorldPosition(new THREE.Vector3()).toArray() as V3
      : [0, modellFuer(symbole[0].katalogId).masse[1], 0] as V3;
    return { teile, anschluss, materialien };
  }, [scene, pfad]);
  useEffect(() => { onModell(pfad, modell.anschluss); }, [pfad, modell, onModell]);
  useEffect(() => () => modell.materialien.forEach((m) => m.dispose()), [modell]);
  return <group name={pfad}>{modell.teile.map((t, i) => <Modellinstanzen key={i} teil={t} symbole={symbole} schatten={schatten} />)}</group>;
}

function Modellinstanzen({ teil, symbole, schatten }: {
  teil: { geometrie: THREE.BufferGeometry; material: THREE.Material | THREE.Material[]; matrix: THREE.Matrix4 };
  symbole: WeltSymbol[]; schatten: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current!;
    symbole.forEach((s, i) => {
      const p = s.position;
      mesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z).multiply(teil.matrix));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [symbole, teil]);
  useEffect(() => {
    const mesh = ref.current;
    return () => { mesh?.dispose(); };
  }, [symbole.length]);
  return <instancedMesh key={symbole.length} ref={ref} args={[teil.geometrie, teil.material, symbole.length]}
    dispose={null} castShadow={schatten} receiveShadow={schatten}
    userData={{ instanzen: symbole.map(anlagenDaten) }} />;
}
