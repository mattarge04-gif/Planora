import { RoundedBox, useGLTF } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { TOKENS } from "../design/tokens";
import type { V3 } from "../szene2/huelle";
import type { WeltSymbol } from "../typen";
import { anlagenDaten, modellFuer } from "./technik";
import type { Interaktion } from "./Interaktion";

interface Props {
  symbole: WeltSymbol[]; schatten: boolean;
  onModell: (pfad: string, anschluss: V3) => void;
  interaktion?: Interaktion;
}

/** Ein Ladefehler betrifft nur diesen Modelltyp, niemals die übrige Szene. */
class ModellGrenze extends Component<{ children: ReactNode; ersatz: ReactNode }, { fehler: boolean }> {
  state = { fehler: false };
  static getDerivedStateFromError() { return { fehler: true }; }
  render() { return this.state.fehler ? this.props.ersatz : this.props.children; }
}

export function Anlagen3({ symbole, schatten, onModell, interaktion }: Props) {
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
    const ersatz = <Ersatz symbole={gruppe} schatten={schatten} interaktion={interaktion} />;
    return pfad.startsWith("/modelle/")
      ? <ModellGrenze key={pfad} ersatz={ersatz}><Suspense fallback={ersatz}>
        <Modell pfad={pfad} symbole={gruppe} schatten={schatten} onModell={onModell} interaktion={interaktion} />
      </Suspense></ModellGrenze>
      : <Ersatz key={pfad} symbole={gruppe} schatten={schatten} interaktion={interaktion} />;
  })}</group>;
}

function ereignisse(key: (e: ThreeEvent<PointerEvent | MouseEvent>) => string | undefined, interaktion?: Interaktion) {
  if (!interaktion?.aktiv) return {};
  return {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => { const k = key(e); if (k) { e.stopPropagation(); interaktion.schweben(k); } },
    onPointerOut: () => interaktion.schweben(null),
    onClick: (e: ThreeEvent<MouseEvent>) => { const k = key(e); if (k && e.delta <= 4) { e.stopPropagation(); interaktion.waehlen(k); } },
  };
}
function Ersatz({ symbole, schatten, interaktion }: { symbole: WeltSymbol[]; schatten: boolean; interaktion?: Interaktion }) {
  return <>{symbole.map((s) => <ErsatzAnlage key={s.schluessel} s={s} schatten={schatten} interaktion={interaktion} />)}</>;
}
function ErsatzAnlage({ s, schatten, interaktion }: { s: WeltSymbol; schatten: boolean; interaktion?: Interaktion }) {
    const masse = modellFuer(s.katalogId).masse, ref = useRef<THREE.Group>(null);
    const aktiv = interaktion?.auswahl === s.schluessel || interaktion?.hover === s.schluessel;
    useFrame(() => { if (ref.current) ref.current.position.y = s.position.y + (interaktion?.lift.current[s.schluessel] ?? 0); }, -1);
    return <group ref={ref} name={s.schluessel} userData={{ ...anlagenDaten(s), ersatz: true }} {...ereignisse(() => s.schluessel, interaktion)}
      position={[s.position.x, s.position.y, s.position.z]}>
      <RoundedBox args={masse} position={[0, masse[1] / 2, 0]} radius={TOKENS.radius.geraetM} smoothness={3}
        userData={anlagenDaten(s)} castShadow={schatten} receiveShadow={schatten}>
        <meshStandardMaterial color={TOKENS.farbe.grau1} {...TOKENS.material.geraet} />
      </RoundedBox>
      {aktiv && <RoundedBox args={masse} position={[0, masse[1] / 2, 0]} scale={1.04} radius={TOKENS.radius.geraetM} smoothness={3} raycast={() => {}}>
        <meshBasicMaterial color={TOKENS.farbe.eisAkzent} side={THREE.BackSide} />
      </RoundedBox>}
    </group>;
}

function Modell({ pfad, symbole, schatten, onModell, interaktion }: {
  pfad: string; symbole: WeltSymbol[]; schatten: boolean; onModell: Props["onModell"]; interaktion?: Interaktion;
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
  return <group name={pfad}>{modell.teile.map((t, i) => <Modellinstanzen key={i} teil={t} symbole={symbole} schatten={schatten} interaktion={interaktion} />)}</group>;
}

function Modellinstanzen({ teil, symbole, schatten, interaktion }: {
  teil: { geometrie: THREE.BufferGeometry; material: THREE.Material | THREE.Material[]; matrix: THREE.Matrix4 };
  symbole: WeltSymbol[]; schatten: boolean; interaktion?: Interaktion;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const rand = useRef<THREE.InstancedMesh>(null);
  const aktiv = symbole.filter((s) => interaktion?.auswahl === s.schluessel || interaktion?.hover === s.schluessel);
  const material = useMemo(() => new THREE.MeshBasicMaterial({ color: TOKENS.farbe.eisAkzent, side: THREE.BackSide }), []);
  useEffect(() => () => material.dispose(), [material]);
  const setzen = () => {
    const mesh = ref.current;
    if (!mesh) return;
    const matrix = (s: WeltSymbol, umriss = false) => {
      const p = s.position;
      const m = new THREE.Matrix4().makeTranslation(p.x, p.y + (interaktion?.lift.current[s.schluessel] ?? 0), p.z);
      if (umriss) {
        const h = modellFuer(s.katalogId).masse[1] / 2;
        m.multiply(new THREE.Matrix4().makeTranslation(0, h, 0)).multiply(new THREE.Matrix4().makeScale(1.04, 1.04, 1.04)).multiply(new THREE.Matrix4().makeTranslation(0, -h, 0));
      }
      return m.multiply(teil.matrix);
    };
    symbole.forEach((s, i) => mesh.setMatrixAt(i, matrix(s)));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    if (rand.current) {
      aktiv.forEach((s, i) => rand.current!.setMatrixAt(i, matrix(s, true)));
      rand.current.instanceMatrix.needsUpdate = true; rand.current.computeBoundingSphere();
    }
  };
  useLayoutEffect(setzen, [symbole, teil, interaktion]);
  useFrame(setzen, -1);
  useEffect(() => {
    const mesh = ref.current;
    return () => { mesh?.dispose(); };
  }, [symbole.length]);
  useEffect(() => { const mesh = rand.current; return () => mesh?.dispose(); }, [aktiv.length]);
  return <><instancedMesh key={symbole.length} ref={ref} args={[teil.geometrie, teil.material, symbole.length]}
    dispose={null} castShadow={schatten} receiveShadow={schatten}
    {...ereignisse((e) => e.instanceId === undefined ? undefined : symbole[e.instanceId]?.schluessel, interaktion)}
    userData={{ instanzen: symbole.map(anlagenDaten) }} />
    {aktiv.length > 0 && <instancedMesh key={`rand-${aktiv.length}`} ref={rand} args={[teil.geometrie, material, aktiv.length]} dispose={null} raycast={() => {}} />}
  </>;
}
