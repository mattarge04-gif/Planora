import { RoundedBox, useGLTF } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { TOKENS } from "../design/tokens";
import type { V3 } from "../szene2/huelle";
import type { KatalogEintrag, WeltSymbol } from "../typen";
import { anlagenDaten, inlineMatrix, modellVon, type AnzeigeSymbol } from "./technik";
import type { Interaktion } from "./Interaktion";

interface Props {
  symbole: WeltSymbol[]; schatten: boolean; katalog?: KatalogEintrag[];
  onModell: (pfad: string, anschluss: V3) => void;
  interaktion?: Interaktion;
}

/** Eine dargestellte Instanz: Teile in der Leitung (Gruppenstock, «vor Bauteil») erscheinen je Stück einmal. */
export interface Instanz { s: WeltSymbol; masse: V3; basis: THREE.Matrix4; mitte: V3; inline: boolean }
export function instanzen(symbole: WeltSymbol[], katalog?: KatalogEintrag[]): Instanz[] {
  return symbole.flatMap((s): Instanz[] => {
    const masse = modellVon(s, katalog).masse, inline = (s as AnzeigeSymbol).inline;
    if (inline) return inline.mitten.map((m) => ({ s, masse, inline: true, mitte: m,
      basis: new THREE.Matrix4().makeTranslation(...m).multiply(inlineMatrix(s.katalogId, masse)) }));
    const p = s.position;
    return [{ s, masse, inline: false, mitte: [p.x, p.y + masse[1] / 2, p.z] as V3, basis: new THREE.Matrix4().makeTranslation(p.x, p.y, p.z) }];
  });
}
/** Achsmasse in Einbaulage: Modellmasse durch die Drehung der Basismatrix. */
export function lageMasse(i: Instanz): V3 {
  const v = new THREE.Vector3(...i.masse).applyMatrix4(new THREE.Matrix4().extractRotation(i.basis));
  return [Math.abs(v.x), Math.abs(v.y), Math.abs(v.z)];
}
const hervorgehoben = (s: WeltSymbol, interaktion?: Interaktion) =>
  interaktion?.auswahl === s.schluessel || interaktion?.hover === s.schluessel || !!interaktion?.betont?.has(s.schluessel);

/** Ein Ladefehler betrifft nur diesen Modelltyp, niemals die übrige Szene. */
class ModellGrenze extends Component<{ children: ReactNode; ersatz: ReactNode }, { fehler: boolean }> {
  state = { fehler: false };
  static getDerivedStateFromError() { return { fehler: true }; }
  render() { return this.state.fehler ? this.props.ersatz : this.props.children; }
}

export function Anlagen3({ symbole, schatten, katalog, onModell, interaktion }: Props) {
  const gruppen = useMemo(() => {
    const g = new Map<string, Instanz[]>();
    for (const i of instanzen(symbole, katalog)) {
      const key = modellVon(i.s, katalog).pfad ?? i.s.katalogId;
      g.set(key, [...(g.get(key) ?? []), i]);
    }
    return [...g.entries()];
  }, [symbole, katalog]);
  useEffect(() => {
    for (const [pfad] of gruppen) if (pfad.startsWith("/modelle/")) useGLTF.preload(pfad, false, false);
  }, [gruppen]);
  return <group name="anlagen">{gruppen.map(([pfad, gruppe]) => {
    const ersatz = <Ersatz instanzen={gruppe} schatten={schatten} interaktion={interaktion} />;
    return pfad.startsWith("/modelle/")
      ? <ModellGrenze key={pfad} ersatz={ersatz}><Suspense fallback={ersatz}>
        <Modell pfad={pfad} instanzen={gruppe} schatten={schatten} onModell={onModell} interaktion={interaktion} />
      </Suspense></ModellGrenze>
      : <Ersatz key={pfad} instanzen={gruppe} schatten={schatten} interaktion={interaktion} />;
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
function Ersatz({ instanzen, schatten, interaktion }: { instanzen: Instanz[]; schatten: boolean; interaktion?: Interaktion }) {
  return <>{instanzen.map((i, k) => <ErsatzAnlage key={`${i.s.schluessel}:${k}`} i={i} schatten={schatten} interaktion={interaktion} />)}</>;
}
function ErsatzAnlage({ i, schatten, interaktion }: { i: Instanz; schatten: boolean; interaktion?: Interaktion }) {
    const { s } = i, masse = lageMasse(i), ref = useRef<THREE.Group>(null);
    const aktiv = hervorgehoben(s, interaktion);
    const unten = i.mitte[1] - masse[1] / 2;
    const radius = Math.min(TOKENS.radius.geraetM, Math.min(...masse) / 2 - 0.002);
    useFrame(() => { if (ref.current) ref.current.position.y = unten + (i.inline ? 0 : interaktion?.lift.current[s.schluessel] ?? 0); }, -1);
    return <group ref={ref} name={s.schluessel} userData={{ ...anlagenDaten(s), ersatz: true }} {...ereignisse(() => s.schluessel, interaktion)}
      position={[i.mitte[0], unten, i.mitte[2]]}>
      <RoundedBox args={masse} position={[0, masse[1] / 2, 0]} radius={radius} smoothness={3}
        userData={anlagenDaten(s)} castShadow={schatten} receiveShadow={schatten}>
        <meshStandardMaterial color={TOKENS.farbe.grau1} {...TOKENS.material.geraet} />
      </RoundedBox>
      {aktiv && <RoundedBox args={masse} position={[0, masse[1] / 2, 0]} scale={1.04} radius={radius} smoothness={3} raycast={() => {}}>
        <meshBasicMaterial color={TOKENS.farbe.eisAkzent} side={THREE.BackSide} />
      </RoundedBox>}
    </group>;
}

function Modell({ pfad, instanzen, schatten, onModell, interaktion }: {
  pfad: string; instanzen: Instanz[]; schatten: boolean; onModell: Props["onModell"]; interaktion?: Interaktion;
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
      : [0, instanzen[0].masse[1], 0] as V3;
    return { teile, anschluss, materialien };
  }, [scene, pfad]);
  useEffect(() => { onModell(pfad, modell.anschluss); }, [pfad, modell, onModell]);
  useEffect(() => () => modell.materialien.forEach((m) => m.dispose()), [modell]);
  return <group name={pfad}>{modell.teile.map((t, i) => <Modellinstanzen key={i} teil={t} instanzen={instanzen} schatten={schatten} interaktion={interaktion} />)}</group>;
}

function Modellinstanzen({ teil, instanzen, schatten, interaktion }: {
  teil: { geometrie: THREE.BufferGeometry; material: THREE.Material | THREE.Material[]; matrix: THREE.Matrix4 };
  instanzen: Instanz[]; schatten: boolean; interaktion?: Interaktion;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const rand = useRef<THREE.InstancedMesh>(null);
  const aktiv = instanzen.filter((i) => hervorgehoben(i.s, interaktion));
  const material = useMemo(() => new THREE.MeshBasicMaterial({ color: TOKENS.farbe.eisAkzent, side: THREE.BackSide }), []);
  useEffect(() => () => material.dispose(), [material]);
  const setzen = () => {
    const mesh = ref.current;
    if (!mesh) return;
    const matrix = (i: Instanz, umriss = false) => {
      // Teile in der Leitung heben sich nicht ab, sonst lösen sie sich vom Rohr.
      const m = new THREE.Matrix4().makeTranslation(0, i.inline ? 0 : interaktion?.lift.current[i.s.schluessel] ?? 0, 0);
      if (umriss) {
        const [x, y, z] = i.mitte;
        m.multiply(new THREE.Matrix4().makeTranslation(x, y, z)).multiply(new THREE.Matrix4().makeScale(1.04, 1.04, 1.04)).multiply(new THREE.Matrix4().makeTranslation(-x, -y, -z));
      }
      return m.multiply(i.basis).multiply(teil.matrix);
    };
    instanzen.forEach((i, k) => mesh.setMatrixAt(k, matrix(i)));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    if (rand.current) {
      aktiv.forEach((i, k) => rand.current!.setMatrixAt(k, matrix(i, true)));
      rand.current.instanceMatrix.needsUpdate = true; rand.current.computeBoundingSphere();
    }
  };
  useLayoutEffect(setzen, [instanzen, teil, interaktion]);
  useFrame(setzen, -1);
  useEffect(() => {
    const mesh = ref.current;
    return () => { mesh?.dispose(); };
  }, [instanzen.length]);
  useEffect(() => { const mesh = rand.current; return () => mesh?.dispose(); }, [aktiv.length]);
  return <><instancedMesh key={instanzen.length} ref={ref} args={[teil.geometrie, teil.material, instanzen.length]}
    dispose={null} castShadow={schatten} receiveShadow={schatten}
    {...ereignisse((e) => e.instanceId === undefined ? undefined : instanzen[e.instanceId]?.s.schluessel, interaktion)}
    userData={{ instanzen: instanzen.map((i) => anlagenDaten(i.s)) }} />
    {aktiv.length > 0 && <instancedMesh key={`rand-${aktiv.length}`} ref={rand} args={[teil.geometrie, material, aktiv.length]} dispose={null} raycast={() => {}} />}
  </>;
}
