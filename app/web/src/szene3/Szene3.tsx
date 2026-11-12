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
import { einpassen, type Einpassung, type Freiraum } from "./kamera";
import { kulisse } from "./kulisse";
import { geschossSchnitt } from "./schnitt";
import { Technik3 } from "./Technik3";

export interface Szene3Props { welt: Welt; katalog: KatalogEintrag[]; fokusId: string | null; freiraum: Freiraum; reduziert: boolean }

/** Helles, lokales Architektur-Diorama mit Anlagen und schematischem Leitungsnetz. */
export function Szene3({ welt, katalog, fokusId, freiraum, reduziert }: Szene3Props) {
  const h = useMemo(() => huelle(welt), [welt]);
  const [kameraRichtung, setKameraRichtung] = useState<V3>([1, 1, 1]);
  const controls = useRef<OrbitControlsImpl>(null);
  const [modellStand, setModellStand] = useState(0);
  const modelleGeladen = useCallback(() => setModellStand((s) => s + 1), []);
  const schnitt = useMemo(() => geschossSchnitt(welt, fokusId), [welt, fokusId]);
  const sichtbar = useMemo(() => ({ ...h.bereich,
    yMax: schnitt.fokus ? schnitt.fokus.yUnten + schnitt.fokus.hoehe : h.bereich.yMax + (h.aufbau?.groesse[1] ?? 0),
  }), [h, schnitt.fokus]);
  const schattenKey = `${welt.hash}:${fokusId}:${kameraRichtung[0]}:${kameraRichtung[2]}:${modellStand}`;
  const kameraGeaendert = () => {
    const c = controls.current;
    if (!c) return;
    const x = Math.sign(c.object.position.x - c.target.x) || 1;
    const z = Math.sign(c.object.position.z - c.target.z) || 1;
    setKameraRichtung((alt) => alt[0] === x && alt[2] === z ? alt : [x, 1, z]);
  };
  return <Canvas className="szene" orthographic shadows={reduziert ? false : "basic"} dpr={[1, 1.5]} frameloop="always"
    gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: TOKENS.licht.belichtung }}
    camera={{ near: 0.1, far: 1000 }}>
    <color attach="background" args={[TOKENS.farbe.grund]} />
    {!reduziert && <SoftShadows size={TOKENS.licht.schattenFilterTexel} samples={TOKENS.licht.schattenSamples} />}
    <OrbitControls ref={controls} makeDefault enableDamping zoomToCursor maxPolarAngle={Math.PI / 2 - 0.12} minPolarAngle={0.15}
      onChange={kameraGeaendert} enablePan={false} />
    <Kamera welt={welt} fokusId={fokusId} bereich={sichtbar} freiraum={freiraum} />
    <Licht bereich={h.bereich} reduziert={reduziert} />
    <Gebaeude3 welt={welt} h={h} fokusId={fokusId} kameraRichtung={kameraRichtung} schatten={!reduziert} />
    <Technik3 welt={welt} katalog={katalog} fokusId={fokusId} schatten={!reduziert} onModelle={modelleGeladen} />
    <Kulisse3 bereich={h.bereich} schatten={!reduziert} />
    {!reduziert && <Bodenschatten key={schattenKey} bereich={h.bereich} />}
    {!reduziert && <EffectComposer multisampling={4} enableNormalPass={false}>
      <N8AO aoRadius={TOKENS.licht.aoRadiusM} intensity={TOKENS.licht.aoIntensitaet} distanceFalloff={1} color={TOKENS.farbe.textSekundaer} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
    </EffectComposer>}
  </Canvas>;
}

function Kamera({ welt, fokusId, bereich, freiraum }: { welt: Welt; fokusId: string | null; bereich: Bereich; freiraum: Freiraum }) {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  const size = useThree((s) => s.size);
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsImpl | null;
  const ziel = useRef<Einpassung | null>(null);
  const bewegt = useRef(false);
  const erste = useRef(true);
  const stand = useRef({ welt, fokusId });
  const [wenigerBewegung, setWenigerBewegung] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const neu = () => setWenigerBewegung(m.matches);
    m.addEventListener("change", neu);
    return () => m.removeEventListener("change", neu);
  }, []);
  useEffect(() => {
    if (!controls) return;
    const start = () => { bewegt.current = true; ziel.current = null; };
    controls.addEventListener("start", start);
    return () => controls.removeEventListener("start", start);
  }, [controls]);
  const { links, rechts, oben, unten } = freiraum;
  useLayoutEffect(() => {
    if (!controls || !size.width || !size.height) return;
    const auswahlNeu = stand.current.welt !== welt || stand.current.fokusId !== fokusId;
    if (bewegt.current && !auswahlNeu) return;
    const e = einpassen(bereich, size.width, size.height, { links, rechts, oben, unten }, 0.7, fokusId ? [1, 1.45, 1] : [1, 1, 1]);
    stand.current = { welt, fokusId }; bewegt.current = false;
    if (erste.current || wenigerBewegung) {
      camera.position.set(...e.position); camera.zoom = e.zoom; controls.target.set(...e.ziel);
      camera.lookAt(...e.ziel); camera.updateProjectionMatrix(); controls.update(); ziel.current = null; erste.current = false;
    } else ziel.current = e;
  }, [controls, camera, welt, fokusId, bereich, size.width, size.height, links, rechts, oben, unten, wenigerBewegung]);
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
