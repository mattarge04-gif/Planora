import { RoundedBox, useGLTF } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { TOKENS } from "../design/tokens";
import type { V3 } from "../szene2/huelle";
import type { KatalogEintrag, WeltSymbol } from "../typen";
import { anlagenDaten, inlineMatrix, modellVon, type AnzeigeSymbol } from "./technik";
import type { Interaktion } from "./Interaktion";
import { AMPEL_FARBE, AMPEL_RANG } from "../lebensdauer/ansicht";
import type { Ampel } from "../lebensdauer/typen";
import { ampelRaender, ampelSockel } from "./ampelSockel";

const RANG_JE_FARBE = new Map(Object.entries(AMPEL_FARBE).map(([a, f]) => [f, AMPEL_RANG[a as Ampel]]));

/** Modus Erneuerung: KOO-Akzent der Modelle neutral, damit Rot nur «Ersetzen» bedeutet (Entscheid 19.11.2026). */
const KOO_NEUTRAL = TOKENS.farbe.grau2;
const HUELLE = TOKENS.erneuerung.huelleFaktor;

interface Props {
  symbole: WeltSymbol[]; schatten: boolean; katalog?: KatalogEintrag[];
  onModell: (pfad: string, anschluss: V3) => void;
  interaktion?: Interaktion;
  /** Schluessel -> Ampelfarbe (Hex); nur Anlagen mit Eintrag erhalten eine dauerhafte Farbhuelle. */
  ampel?: ReadonlyMap<string, string>;
  /** Geschossboden (y) für die Ampel-Sockel im Modus Erneuerung. */
  bodenY?: number;
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

export function Anlagen3({ symbole, schatten, katalog, onModell, interaktion, ampel, bodenY }: Props) {
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
  const alle = useMemo(() => gruppen.flatMap(([, g]) => g), [gruppen]);
  return <group name="anlagen">{ampel && <AmpelAnzeige instanzen={alle} ampel={ampel} bodenY={bodenY} interaktion={interaktion} />}
  {gruppen.map(([pfad, gruppe]) => {
    const ersatz = <Ersatz instanzen={gruppe} schatten={schatten} interaktion={interaktion} />;
    return pfad.startsWith("/modelle/")
      ? <ModellGrenze key={pfad} ersatz={ersatz}><Suspense fallback={ersatz}>
        <Modell pfad={pfad} instanzen={gruppe} schatten={schatten} onModell={onModell} interaktion={interaktion} ampel={ampel} />
      </Suspense></ModellGrenze>
      : <Ersatz key={pfad} instanzen={gruppe} schatten={schatten} interaktion={interaktion} />;
  })}</group>;
}

/** Ampel je Anlage: Hülle und Bodensockel, Zuschläge mit Bildschirm-Mindestgrösse aus dem Kamerazoom. */
function AmpelAnzeige({ instanzen, ampel, bodenY, interaktion }: { instanzen: Instanz[]; ampel: ReadonlyMap<string, string>; bodenY?: number; interaktion?: Interaktion }) {
  const [raender, setRaender] = useState(() => ampelRaender(0));
  useFrame(({ camera }) => {
    const r = ampelRaender((camera as THREE.OrthographicCamera).zoom);
    if (r.sockel !== raender.sockel || r.huelle !== raender.huelle) setRaender(r);
  });
  return <>
    {bodenY !== undefined && <AmpelSockel instanzen={instanzen} ampel={ampel} bodenY={bodenY} rand={raender.sockel} />}
    {instanzen.filter((i) => ampel.has(i.s.schluessel)).map((i, k) => <AmpelHuelle key={`${i.s.schluessel}:${k}`} i={i}
      farbe={ampel.get(i.s.schluessel)!} zuschlag={raender.huelle} interaktion={interaktion} />)}
  </>;
}

/**
 * Ampelhülle als ruhiger Kasten um die Einbaulage (BackSide, ungetönt): liest als Rahmen um die Anlage, ohne dass
 * innere Modellteile durch die Hülle stossen. Folgt dem Anheben bei Hover/Auswahl; die Auswahlhülle (1.04) bleibt innen.
 */
function AmpelHuelle({ i, farbe, zuschlag, interaktion }: { i: Instanz; farbe: string; zuschlag: number; interaktion?: Interaktion }) {
  const ref = useRef<THREE.Mesh>(null);
  const masse = lageMasse(i).map((m) => m * HUELLE + 2 * zuschlag) as V3;
  useFrame(() => { if (ref.current) ref.current.position.y = i.mitte[1] + (i.inline ? 0 : interaktion?.lift.current[i.s.schluessel] ?? 0); }, -1);
  return <RoundedBox ref={ref} args={masse} position={i.mitte} radius={Math.min(TOKENS.radius.geraetM, Math.min(...masse) / 2 - 0.002)} smoothness={3}
    raycast={() => {}} userData={{ ampelHuelle: i.s.schluessel }}>
    <meshBasicMaterial color={farbe} side={THREE.BackSide} toneMapped={false} />
  </RoundedBox>;
}

/** Bodenscheibe in Ampelfarbe (ungetönt), «Baujahr fehlt» gestrichelt; bleibt beim Anheben der Anlage am Boden. */
function AmpelSockel({ instanzen, ampel, bodenY, rand }: { instanzen: Instanz[]; ampel: ReadonlyMap<string, string>; bodenY: number; rand: number }) {
  const { scheiben, striche, strichBreite } = useMemo(() => ampelSockel(instanzen.filter((i) => ampel.has(i.s.schluessel)).map((i) => ({
    schluessel: i.s.schluessel, mitte: i.mitte, masse: lageMasse(i), inline: i.inline,
    farbe: ampel.get(i.s.schluessel)!, grau: ampel.get(i.s.schluessel) === AMPEL_FARBE.grau, rang: RANG_JE_FARBE.get(ampel.get(i.s.schluessel)!),
  })), bodenY, rand), [instanzen, ampel, bodenY, rand]);
  const strichRef = useRef<THREE.InstancedMesh>(null);
  const strichGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  useEffect(() => () => strichGeo.dispose(), [strichGeo]);
  useLayoutEffect(() => {
    const m = strichRef.current;
    if (!m) return;
    const e = TOKENS.erneuerung, mat = new THREE.Matrix4();
    striche.forEach((s, k) => m.setMatrixAt(k, mat.compose(new THREE.Vector3(...s.position), new THREE.Quaternion(),
      s.achse === "x" ? new THREE.Vector3(s.laenge, e.sockelHoeheM, strichBreite) : new THREE.Vector3(strichBreite, e.sockelHoeheM, s.laenge))));
    m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere();
  }, [striche, strichBreite]);
  const h = TOKENS.erneuerung.sockelHoeheM;
  return <group name="ampel-sockel">
    {scheiben.map((s) => <RoundedBox key={s.schluessel} args={[s.breite, h, s.tiefe]} position={s.position} radius={h / 2 - 0.001} smoothness={2}
      raycast={() => {}} userData={{ ampelSockel: s.schluessel }}>
      <meshBasicMaterial color={s.farbe} toneMapped={false} />
    </RoundedBox>)}
    {striche.length > 0 && <instancedMesh key={striche.length} ref={strichRef} args={[strichGeo, undefined, striche.length]} raycast={() => {}}>
      <meshBasicMaterial color={AMPEL_FARBE.grau} toneMapped={false} />
    </instancedMesh>}
  </group>;
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

function Modell({ pfad, instanzen, schatten, onModell, interaktion, ampel }: {
  pfad: string; instanzen: Instanz[]; schatten: boolean; onModell: Props["onModell"]; interaktion?: Interaktion;
  ampel?: ReadonlyMap<string, string>;
}) {
  const { scene } = useGLTF(pfad, false, false);
  const neutral = ampel !== undefined;
  const modell = useMemo(() => {
    scene.updateMatrixWorld(true);
    const teile: { geometrie: THREE.BufferGeometry; material: THREE.Material | THREE.Material[]; matrix: THREE.Matrix4 }[] = [];
    const materialien = new Map<THREE.Material, THREE.Material>();
    const material = (m: THREE.Material) => {
      if (m.name !== "koo") return m;
      if (!materialien.has(m)) {
        const kopie = m.clone() as THREE.MeshStandardMaterial;
        kopie.color.set(neutral ? KOO_NEUTRAL : TOKENS.farbe.kooHeizung);
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
  }, [scene, pfad, neutral]);
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
    const matrix = (i: Instanz, umriss: number | false = false) => {
      // Teile in der Leitung heben sich nicht ab, sonst lösen sie sich vom Rohr.
      const m = new THREE.Matrix4().makeTranslation(0, i.inline ? 0 : interaktion?.lift.current[i.s.schluessel] ?? 0, 0);
      if (umriss) {
        const [x, y, z] = i.mitte;
        m.multiply(new THREE.Matrix4().makeTranslation(x, y, z)).multiply(new THREE.Matrix4().makeScale(umriss, umriss, umriss)).multiply(new THREE.Matrix4().makeTranslation(-x, -y, -z));
      }
      return m.multiply(i.basis).multiply(teil.matrix);
    };
    instanzen.forEach((i, k) => mesh.setMatrixAt(k, matrix(i)));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    if (rand.current) {
      aktiv.forEach((i, k) => rand.current!.setMatrixAt(k, matrix(i, 1.04)));
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
