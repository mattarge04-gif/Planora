import { AccumulativeShadows, Environment, Lightformer, OrbitControls, RandomizedLight, SoftShadows } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, N8AO, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { TOKENS } from "../design/tokens";
import { huelle, type Bereich, type V3 } from "../szene2/huelle";
import type { KatalogEintrag, Welt } from "../typen";
import { Gebaeude3 } from "./Gebaeude3";
import { Kulisse3 } from "./Kulisse3";
import { einpassen, FIT_ANTEIL, punktImFreiraum, bildpunkt, type Einpassung, type Freiraum } from "./kamera";
import { kulisse } from "./kulisse";
import { geschossSchnitt } from "./schnitt";
import { Technik3 } from "./Technik3";
import { useGeschossBewegung, useWenigerBewegung, type Darstellung } from "./Bewegung";
import { gebaeudeBereich, separationsOffsets, sichtbareGeschosse } from "./darstellung";
import { InteraktionsBewegung, type BildschirmPunkt } from "./Interaktion";
import { geschossBeiY } from "../szene2/leitungen";
import { modellFuer } from "./technik";

export interface Szene3Props {
  welt: Welt; katalog: KatalogEintrag[]; fokusId: string | null; freiraum: Freiraum; reduziert: boolean;
  ausgeblendet?: string[]; separiert?: boolean; auswahl?: string | null;
  onAuswahl?: (schluessel: string | null) => void; onHover?: (schluessel: string | null) => void;
  onAuswahlPunkt?: (punkt: BildschirmPunkt | null) => void;
}
const KEINE_GESCHOSSE: string[] = [];

/** Optionale Interaktions-Props lassen die bisherigen Aufrufer unverändert gültig. */
export function Szene3(props: Szene3Props) {
  return <Canvas className="szene" orthographic shadows={props.reduziert ? false : "basic"} dpr={[1, 1.5]} frameloop="always"
    gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: TOKENS.licht.belichtung }}
    camera={{ near: 0.1, far: 1000 }} onPointerMissed={() => props.onAuswahl?.(null)}>
    <SzenenInhalt {...props} />
  </Canvas>;
}

function SzenenInhalt({ welt, katalog, fokusId, freiraum, reduziert, ausgeblendet = KEINE_GESCHOSSE, separiert = false,
  auswahl = null, onAuswahl, onHover, onAuswahlPunkt }: Szene3Props) {
  const h = useMemo(() => huelle(welt), [welt]);
  const [kameraRichtung, setKameraRichtung] = useState<V3>([1, 1, 1]);
  const controls = useRef<OrbitControlsImpl>(null);
  const [modellStand, setModellStand] = useState(0);
  const modelleGeladen = useCallback(() => setModellStand((s) => s + 1), []);
  const schnitt = useMemo(() => geschossSchnitt(welt, fokusId), [welt, fokusId]);
  const weniger = useWenigerBewegung();
  const hiddenKey = [...ausgeblendet].sort().join(":");
  const sichtbarIds = useMemo(() => sichtbareGeschosse(welt, fokusId, ausgeblendet), [welt, fokusId, hiddenKey]);
  const offsets = useMemo(() => separationsOffsets(welt, separiert), [welt, separiert]);
  const { aktuell, bewegung } = useGeschossBewegung(offsets, weniger, modelleGeladen);
  const darstellung = useMemo(() => ({ sichtbar: sichtbarIds, offsets, aktuell, bewegung }), [sichtbarIds, offsets, aktuell, bewegung]);
  const sichtbar = useMemo(() => {
    const b = gebaeudeBereich(welt, h.bereich, sichtbarIds, offsets);
    const dachId = schnitt.geschosse.at(-1)?.id;
    if (schnitt.dach && dachId && sichtbarIds.includes(dachId)) b.yMax += Math.max(0.4, (h.aufbau?.groesse[1] ?? 0) + 0.1);
    return b;
  }, [welt, h, schnitt, sichtbarIds, offsets]);
  const repKey = `${welt.hash}:${fokusId}:${hiddenKey}:${separiert}`;
  const schattenKey = `${repKey}:${kameraRichtung[0]}:${kameraRichtung[2]}:${modellStand}`;
  const [hover, setHover] = useState<string | null>(null);
  const hoverRef = useRef<string | null>(null);
  const hoverCallback = useRef(onHover);
  hoverCallback.current = onHover;
  const lift = useRef<Record<string, number>>({});
  const schweben = useCallback((key: string | null) => {
    if (hoverRef.current === key) return;
    hoverRef.current = key; setHover(key); hoverCallback.current?.(key);
  }, []);
  useEffect(() => () => { if (hoverRef.current) hoverCallback.current?.(null); }, []);
  const waehlen = useCallback((key: string | null) => onAuswahl?.(key), [onAuswahl]);
  const interaktion = useMemo(() => ({ auswahl, hover, lift, aktiv: !!onAuswahl || !!onHover || auswahl !== null,
    waehlen, schweben }), [auswahl, hover, onAuswahl, onHover, waehlen, schweben]);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const verlassen = () => schweben(null);
    gl.domElement.addEventListener("pointerleave", verlassen);
    return () => gl.domElement.removeEventListener("pointerleave", verlassen);
  }, [gl, schweben]);
  useEffect(() => {
    const s = welt.symbole.find((s) => s.schluessel === hoverRef.current);
    if (hoverRef.current && (!s || !sichtbarIds.includes(geschossBeiY(welt, s.position.y) ?? ""))) schweben(null);
  }, [welt, sichtbarIds, schweben]);
  const kameraGeaendert = () => {
    const c = controls.current;
    if (!c) return;
    const x = Math.sign(c.object.position.x - c.target.x) || 1;
    const z = Math.sign(c.object.position.z - c.target.z) || 1;
    setKameraRichtung((alt) => alt[0] === x && alt[2] === z ? alt : [x, 1, z]);
  };
  const durchsichtig = (o: THREE.Object3D) => o instanceof THREE.Mesh && (Array.isArray(o.material) ? o.material.every((m) => m.transparent) : o.material.transparent);
  return <>
    <color attach="background" args={[TOKENS.farbe.grund]} />
    {!reduziert && <SoftShadows size={TOKENS.licht.schattenFilterTexel} samples={TOKENS.licht.schattenSamples} />}
    <OrbitControls ref={controls} makeDefault enableDamping zoomToCursor maxPolarAngle={Math.PI / 2 - 0.12} minPolarAngle={0.15}
      onChange={kameraGeaendert} enablePan={false} />
    <Kamera welt={welt} fokusId={fokusId} bereich={sichtbar} freiraum={freiraum} repKey={repKey}
      auswahl={auswahl} darstellung={darstellung} weniger={weniger} />
    <InteraktionsBewegung welt={welt} interaktion={interaktion} darstellung={darstellung} weniger={weniger} onAuswahlPunkt={onAuswahlPunkt} />
    <Licht bereich={sichtbar} reduziert={reduziert} />
    <group onClick={(e) => { if (e.delta <= 4 && !durchsichtig(e.object)) { e.stopPropagation(); waehlen(null); } }}
      onPointerOver={interaktion.aktiv ? (e) => { if (!durchsichtig(e.object)) { e.stopPropagation(); schweben(null); } } : undefined}>
      <Gebaeude3 welt={welt} h={h} fokusId={fokusId} kameraRichtung={kameraRichtung} schatten={!reduziert} darstellung={darstellung} />
      <Technik3 welt={welt} katalog={katalog} fokusId={fokusId} schatten={!reduziert} onModelle={modelleGeladen}
        darstellung={darstellung} interaktion={interaktion} separiert={separiert} />
      <Kulisse3 bereich={h.bereich} schatten={!reduziert} />
    </group>
    {!reduziert && !bewegung && <Bodenschatten key={schattenKey} bereich={h.bereich} />}
    {!reduziert && <EffectComposer multisampling={4} enableNormalPass={false}>
      <N8AO aoRadius={TOKENS.licht.aoRadiusM} intensity={TOKENS.licht.aoIntensitaet} distanceFalloff={1} color={TOKENS.farbe.textSekundaer} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
    </EffectComposer>}
  </>;
}

function Kamera({ welt, fokusId, bereich, freiraum, repKey, auswahl, darstellung, weniger }: {
  welt: Welt; fokusId: string | null; bereich: Bereich; freiraum: Freiraum; repKey: string; auswahl: string | null; darstellung: Darstellung; weniger: boolean;
}) {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  const size = useThree((s) => s.size);
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsImpl | null;
  const ziel = useRef<Einpassung | null>(null);
  const bewegt = useRef(false);
  const erste = useRef(true);
  const stand = useRef({ welt, fokusId, repKey });
  useEffect(() => {
    if (!controls) return;
    const start = () => { bewegt.current = true; ziel.current = null; };
    controls.addEventListener("start", start);
    return () => controls.removeEventListener("start", start);
  }, [controls]);
  const { links, rechts, oben, unten } = freiraum;
  useLayoutEffect(() => {
    if (!controls || !size.width || !size.height) return;
    const auswahlNeu = stand.current.welt !== welt || stand.current.fokusId !== fokusId || stand.current.repKey !== repKey;
    if (bewegt.current && !auswahlNeu) return;
    const e = einpassen(bereich, size.width, size.height, { links, rechts, oben, unten }, FIT_ANTEIL, fokusId ? [1, 1.45, 1] : [1, 1, 1]);
    stand.current = { welt, fokusId, repKey }; bewegt.current = false;
    if (erste.current || weniger) {
      camera.position.set(...e.position); camera.zoom = e.zoom; controls.target.set(...e.ziel);
      camera.lookAt(...e.ziel); camera.updateProjectionMatrix(); controls.update(); ziel.current = null; erste.current = false;
    } else ziel.current = e;
  }, [controls, camera, welt, fokusId, bereich, size.width, size.height, links, rechts, oben, unten, weniger, repKey]);
  useEffect(() => {
    if (!controls || !auswahl) return;
    const s = welt.symbole.find((s) => s.schluessel === auswahl), id = s ? geschossBeiY(welt, s.position.y) : null;
    if (!s || !id || !darstellung.sichtbar.includes(id)) return;
    const m = modellFuer(s.katalogId).masse, y = s.position.y + (darstellung.offsets[id] ?? 0);
    camera.updateMatrixWorld();
    const punkt = bildpunkt(camera, size.width, size.height, new THREE.Vector3(s.position.x, y + m[1] / 2, s.position.z));
    // [A] Auswahl verschiebt die Kamera nur, wenn das Anlagenzentrum ausserhalb des Freiraums liegt; kein unnötiges Heranzoomen.
    if (punktImFreiraum(punkt, size.width, size.height, freiraum)) return;
    const richtung = camera.position.clone().sub(controls.target).toArray() as V3;
    const b: Bereich = { xMin: s.position.x - m[0] / 2, xMax: s.position.x + m[0] / 2, yMin: y, yMax: y + m[1], zMin: s.position.z - m[2] / 2, zMax: s.position.z + m[2] / 2 };
    const e = einpassen(b, size.width, size.height, freiraum, FIT_ANTEIL, richtung);
    const zoom = Math.min(camera.zoom, e.zoom);
    // Freiraum-Zentrierung hängt vom tatsächlichen Zoom ab.
    const mitte = new THREE.Vector3(s.position.x, y + m[1] / 2, s.position.z);
    const rechtsV = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), obenV = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    const zielPunkt = mitte.addScaledVector(rechtsV, -(links - rechts) / (2 * zoom)).addScaledVector(obenV, -(unten - oben) / (2 * zoom));
    const position = zielPunkt.clone().add(camera.position.clone().sub(controls.target));
    const neu = { ziel: zielPunkt.toArray() as V3, position: position.toArray() as V3, zoom };
    if (weniger) {
      camera.position.copy(position); controls.target.copy(zielPunkt); camera.zoom = zoom; camera.lookAt(zielPunkt); camera.updateProjectionMatrix(); controls.update(); ziel.current = null;
    } else ziel.current = neu;
  }, [auswahl, controls]);
  const p = useMemo(() => new THREE.Vector3(), []), t = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    const e = ziel.current;
    if (!e || !controls) return;
    const alpha = 1 - Math.exp(-Math.min(dt, 0.1) * 6 / (TOKENS.bewegung.kameraMs / 1000));
    p.set(...e.position); t.set(...e.ziel);
    camera.position.lerp(p, alpha); controls.target.lerp(t, alpha); camera.zoom += (e.zoom - camera.zoom) * alpha;
    camera.updateProjectionMatrix(); controls.update();
    if (camera.position.distanceToSquared(p) < 0.0001 && Math.abs(camera.zoom - e.zoom) < 0.001) ziel.current = null;
  });
  return null;
}

function sonnenPosition(): V3 {
  const azimut = THREE.MathUtils.degToRad(TOKENS.licht.sonneAzimutGrad);
  const hoehe = THREE.MathUtils.degToRad(TOKENS.licht.sonneHoeheGrad);
  return [Math.sin(azimut) * Math.cos(hoehe) * 60, Math.sin(hoehe) * 60, -Math.cos(azimut) * Math.cos(hoehe) * 60];
}

function Licht({ bereich, reduziert }: { bereich: Bereich; reduziert: boolean }) {
  const cx = (bereich.xMin + bereich.xMax) / 2, cz = (bereich.zMin + bereich.zMax) / 2;
  const ziel = useMemo(() => new THREE.Object3D(), []);
  const s = sonnenPosition();
  const r = Math.max(bereich.xMax - bereich.xMin, bereich.zMax - bereich.zMin) + 10;
  return <>
    <hemisphereLight color={TOKENS.farbe.flaeche} groundColor={TOKENS.farbe.grau2} intensity={TOKENS.licht.umgebungIntensitaet} />
    <primitive object={ziel} position={[cx, bereich.yMin, cz]} />
    <directionalLight position={[cx + s[0], bereich.yMin + s[1], cz + s[2]]} target={ziel}
      intensity={TOKENS.licht.sonneIntensitaet} castShadow={!reduziert} shadow-mapSize={[1024, 1024]}
      shadow-intensity={TOKENS.licht.schattenDeckkraft}
      shadow-bias={-0.0001} shadow-normalBias={0.03}>
      <orthographicCamera attach="shadow-camera" args={[-r, r, r, -r, 1, 160]} />
    </directionalLight>
    <Environment resolution={128} frames={1} environmentIntensity={TOKENS.licht.umgebungIntensitaet}>
      <Lightformer form="rect" intensity={TOKENS.licht.umgebungIntensitaet} position={[cx, bereich.yMax + 20, cz]}
        rotation={[Math.PI / 2, 0, 0]} scale={[40, 40, 1]} color={TOKENS.farbe.flaeche} />
      <Lightformer form="rect" intensity={TOKENS.licht.umgebungIntensitaet * 0.7} position={[cx - 25, bereich.yMax + 8, cz]}
        rotation={[0, Math.PI / 2, 0]} scale={[30, 20, 1]} color={TOKENS.farbe.flaeche} />
      <Lightformer form="rect" intensity={TOKENS.licht.umgebungIntensitaet * 0.5} position={[cx + 20, bereich.yMax + 5, cz + 20]}
        rotation={[0, -Math.PI * 0.75, 0]} scale={[20, 16, 1]} color={TOKENS.farbe.eis} />
    </Environment>
  </>;
}

function Bodenschatten({ bereich }: { bereich: Bereich }) {
  const k = useMemo(() => kulisse(bereich), [bereich]);
  const s = sonnenPosition();
  const groesse = Math.max(k.platte.groesse[0], k.platte.groesse[2]);
  return <AccumulativeShadows temporal frames={TOKENS.licht.schattenFrames} scale={groesse}
    position={[k.platte.mitte[0], bereich.yMin - 0.264, k.platte.mitte[2]]}
    color={TOKENS.farbe.textSekundaer} opacity={TOKENS.licht.schattenDeckkraft} alphaTest={0.85} resolution={1024}>
    <RandomizedLight amount={6} radius={TOKENS.licht.schattenRadiusM} ambient={0.5} position={s}
      size={groesse * 0.75} mapSize={512} near={1} far={160} bias={0.001} />
  </AccumulativeShadows>;
}
