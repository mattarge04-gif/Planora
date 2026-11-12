import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import type { KatalogEintrag, Welt } from "../typen";
import { FASSADE } from "./farben";
import { MASSE, huelle as huelleVon, wandQuader, type Bereich, type Fenster, type Huelle, type Quader, type V3 } from "./huelle";
import { FokusInhalt } from "./Fokus";
import { geschossBeiY } from "./leitungen";
import { entsorgeMaterialien, erzeugeMaterialien, type Materialien } from "./materialien";
import { Schild } from "./schrift";
import { FOKUS, HELL, mische, mischeFarbe, type Stimmung } from "./stimmung";

export interface Welt3DProps {
  welt: Welt; katalog: KatalogEintrag[]; fokusId: string | null; auswahl: string | null;
  onAuswahl: (s: string | null) => void; reduziert: boolean; karteRef: RefObject<HTMLDivElement | null>;
}

const EBENE = new THREE.PlaneGeometry(1, 1);

/** Prototyp nach Spec 2026-11-12: plastische Uebersicht, Fokusmodus je Geschoss. Zeichnen nur bei Aenderung. */
export function Welt3D(props: Welt3DProps) {
  const { welt, katalog, fokusId, onAuswahl, reduziert, auswahl, karteRef } = props;
  const h = useMemo(() => huelleVon(welt), [welt]);
  const mat = useMemo(() => erzeugeMaterialien(), []);
  useEffect(() => () => entsorgeMaterialien(mat), [mat]);
  const fokus = welt.geschosse.find((g) => g.id === fokusId) ?? null;
  const zielY = fokus ? fokus.yUnten + 1 : (h.bereich.yMin + h.bereich.yMax) / 2;
  const symbol = auswahl ? welt.symbole.find((s) => s.schluessel === auswahl) : undefined;
  const ankerPunkt: V3 | null = symbol ? [symbol.position.x, symbol.position.y + 1, symbol.position.z] : null;
  return (
    <Canvas className="szene" orthographic shadows="percentage" frameloop="demand" dpr={[1, 1.75]}
      gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping }} onPointerMissed={() => onAuswahl(null)}>
      <Licht bereich={h.bereich} reduziert={reduziert} ziel={fokus ? 1 : 0} mat={mat} />
      <Umgebung />
      <Kamera bereich={h.bereich} zielY={zielY} />
      <Gebaeude h={h} fokus={fokus} mat={mat} />
      {!fokus && <GeschossSchilder welt={welt} h={h} />}
      {fokus && <FokusInhalt welt={welt} katalog={katalog} fokusId={fokus.id} auswahl={auswahl} onAuswahl={onAuswahl} mat={mat} />}
      <Anker punkt={ankerPunkt} ziel={karteRef} />
      <Nachbearbeitung reduziert={reduziert} />
    </Canvas>
  );
}

function Quaderz({ q, m, schatten = true }: { q: Quader; m: THREE.Material; schatten?: boolean }) {
  return (
    <mesh position={q.mitte} material={m} castShadow={schatten} receiveShadow>
      <boxGeometry args={q.groesse} />
    </mesh>
  );
}

function Gebaeude({ h, fokus, mat }: { h: Huelle; fokus: { yUnten: number } | null; mat: Materialien }) {
  const gleich = (a: number, b: number) => Math.abs(a - b) < 1e-6;
  const sichtbar = h.geschosse.filter((g) => !fokus || g.yUnten <= fokus.yUnten + 1e-6);
  const fenster = sichtbar.filter((g) => !fokus || g.yUnten < fokus.yUnten - 1e-6).flatMap((g) => g.fenster);
  const yMax = h.bereich.yMax;
  return (
    <>
      <Quaderz q={h.platte} m={mat.platte} schatten={false} />
      {sichtbar.map((g) => {
        const geschnitten = !!fokus && gleich(g.yUnten, fokus.yUnten);
        const hoehe = geschnitten ? MASSE.bruestung : g.hoehe;
        const m = geschnitten ? mat.wand : mat.umgebung;
        return (
          <group key={g.geschossId}>
            {h.grundriss.map((r, i) => (
              <Quaderz key={`d${i}`} m={m} q={{ mitte: [r.x + r.breite / 2, g.yUnten - 0.1, r.z + r.tiefe / 2], groesse: [r.breite, 0.2, r.tiefe] }} />
            ))}
            {h.waende.map((w, i) => <Quaderz key={`w${i}`} m={m} q={wandQuader(w, g.yUnten, hoehe)} />)}
            {!fokus && g.band.map((q, i) => <Quaderz key={`b${i}`} m={mat.band} q={q} />)}
          </group>
        );
      })}
      <FensterInstanzen key={fenster.length} fenster={fenster} m={mat.fenster} />
      {!fokus && h.geschosse.length > 0 && (
        <>
          {h.grundriss.map((r, i) => (
            <Quaderz key={`dach${i}`} m={mat.dach} q={{ mitte: [r.x + r.breite / 2, yMax - 0.1, r.z + r.tiefe / 2], groesse: [r.breite, 0.2, r.tiefe] }} />
          ))}
          {h.attika.map((q, i) => <Quaderz key={`a${i}`} m={mat.umgebung} q={q} />)}
          {h.aufbau && <Quaderz m={mat.umgebung} q={h.aufbau} />}
        </>
      )}
    </>
  );
}

function FensterInstanzen({ fenster, m }: { fenster: Fenster[]; m: THREE.Material }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const { invalidate } = useThree();
  useLayoutEffect(() => {
    const im = ref.current;
    if (!im) return;
    const o = new THREE.Object3D();
    fenster.forEach((f, i) => {
      o.position.set(...f.mitte); o.rotation.set(0, f.drehungY, 0); o.scale.set(f.breite, f.hoehe, 1);
      o.updateMatrix(); im.setMatrixAt(i, o.matrix);
    });
    im.count = fenster.length;
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    invalidate();
  }, [fenster, invalidate]);
  return <instancedMesh ref={ref} args={[EBENE, m, Math.max(fenster.length, 1)]} receiveShadow />;
}

function GeschossSchilder({ welt, h }: { welt: Welt; h: Huelle }) {
  return (
    <>
      {h.geschosse.map((g) => {
        const n = welt.symbole.filter((s) => geschossBeiY(welt, s.position.y) === g.geschossId).length;
        return (
          <Schild key={g.geschossId} text={`${g.code} · ${n} ${n === 1 ? "Bauteil" : "Bauteile"}`} groesse={1.6}
            position={[h.bereich.xMax + 4, g.yUnten + g.hoehe / 2, h.bereich.zMin - 4]} />
        );
      })}
    </>
  );
}

const radiusVon = (b: Bereich) => Math.max(Math.hypot((b.xMax - b.xMin) / 2, (b.yMax - b.yMin) / 2, (b.zMax - b.zMin) / 2), 5);

/** Sonne mit weichem Schatten, Umgebungslicht, Stimmungs-Ueberblendung (ca. 400 ms). */
function Licht({ bereich, reduziert, ziel, mat }: { bereich: Bereich; reduziert: boolean; ziel: 0 | 1; mat: Materialien }) {
  const { scene, invalidate } = useThree();
  const r = radiusVon(bereich);
  const cx = (bereich.xMin + bereich.xMax) / 2, cz = (bereich.zMin + bereich.zMax) / 2;
  const sonne = useMemo(() => {
    const l = new THREE.DirectionalLight("#ffffff", HELL.sonne);
    l.shadow.mapSize.set(2048, 2048);
    l.shadow.radius = 6;
    l.shadow.bias = -0.0004;
    return l;
  }, []);
  const umgebung = useMemo(() => new THREE.AmbientLight("#ffffff", HELL.umgebung), []);
  const hintergrund = useMemo(() => new THREE.Color(), []);
  useLayoutEffect(() => {
    sonne.position.set(cx - r * 1.2, bereich.yMax + r * 1.1, cz + r * 0.7);
    sonne.target.position.set(cx, bereich.yMin, cz);
    const k = sonne.shadow.camera;
    k.left = -r * 1.6; k.right = r * 1.6; k.top = r * 1.6; k.bottom = -r * 1.6; k.near = 0.5; k.far = r * 6;
    k.updateProjectionMatrix();
    sonne.castShadow = !reduziert;
    invalidate();
  }, [sonne, cx, cz, r, bereich.yMax, bereich.yMin, reduziert, invalidate]);

  const t = useRef<number>(ziel);
  const anwenden = (s: Stimmung) => {
    scene.background = hintergrund.set(s.hintergrund);
    umgebung.intensity = s.umgebung;
    sonne.intensity = s.sonne;
    mat.umgebung.color.set(s.gebaeude);
    mat.dach.color.set(mischeFarbe(FASSADE.platte, s.hintergrund, s.abblenden));
    mat.platte.color.set(mischeFarbe(FASSADE.platte, s.hintergrund, s.abblenden));
    mat.leitung.emissiveIntensity = s.leuchten;
    mat.leitungAktiv.emissiveIntensity = s.leuchten + 0.3;
  };
  useLayoutEffect(() => { anwenden(mische(HELL, FOKUS, t.current)); invalidate(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { invalidate(); }, [ziel, invalidate]);
  useFrame((_, dt) => {
    if (t.current === ziel) return;
    const schritt = Math.min(dt, 1 / 30) / 0.4;
    t.current = ziel > t.current ? Math.min(ziel, t.current + schritt) : Math.max(ziel, t.current - schritt);
    anwenden(mische(HELL, FOKUS, t.current));
    invalidate();
  });
  return (
    <>
      <primitive object={sonne} />
      <primitive object={sonne.target} />
      <primitive object={umgebung} />
    </>
  );
}

/** Weiche Umgebungsbeleuchtung ohne externe Datei (RoomEnvironment). */
function Umgebung() {
  const { gl, scene, invalidate } = useThree();
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.45;
    pm.dispose();
    invalidate();
    return () => { scene.environment = null; env.dispose(); };
  }, [gl, scene, invalidate]);
  return null;
}

/** Isometrische Orthokamera, Orbit; Ziel-Hoehe faehrt sanft zum gewaehlten Geschoss. */
function Kamera({ bereich, zielY }: { bereich: Bereich; zielY: number }) {
  const { camera, gl, size, invalidate } = useThree();
  const steuerung = useRef<OrbitControls | null>(null);
  const ziel = useRef(zielY);
  ziel.current = zielY;
  const groesse = useRef(size);
  groesse.current = size;
  useEffect(() => {
    const r = radiusVon(bereich);
    const cx = (bereich.xMin + bereich.xMax) / 2, cz = (bereich.zMin + bereich.zMax) / 2, cy = ziel.current;
    const k = camera as THREE.OrthographicCamera;
    k.position.set(cx + r * 2, cy + r * 1.7, cz + r * 2);
    k.near = 0.1; k.far = r * 20;
    k.zoom = Math.min(groesse.current.width, groesse.current.height) / (r * 2.2);
    k.lookAt(cx, cy, cz);
    k.updateProjectionMatrix();
    const s = new OrbitControls(k, gl.domElement);
    s.target.set(cx, cy, cz);
    s.maxPolarAngle = Math.PI / 2 - 0.05;
    s.minZoom = k.zoom / 4; s.maxZoom = k.zoom * 8;
    s.update();
    const neu = () => invalidate();
    s.addEventListener("change", neu);
    steuerung.current = s;
    invalidate();
    return () => { s.removeEventListener("change", neu); s.dispose(); steuerung.current = null; };
  }, [bereich, camera, gl, invalidate]);
  useEffect(() => { invalidate(); }, [zielY, invalidate]);
  useFrame(() => {
    const s = steuerung.current;
    if (!s) return;
    const dy = ziel.current - s.target.y;
    if (Math.abs(dy) < 0.01) return;
    const schritt = dy * 0.18;
    s.target.y += schritt; camera.position.y += schritt;
    s.update();
    invalidate();
  });
  return null;
}

/** Schiebt die HTML-Bauteilkarte an den projizierten 3D-Punkt. */
function Anker({ punkt, ziel }: { punkt: V3 | null; ziel: RefObject<HTMLDivElement | null> }) {
  const { camera, size, invalidate } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => { invalidate(); }, [punkt, invalidate]);
  useFrame(() => {
    const el = ziel.current;
    if (!el) return;
    if (!punkt) { el.style.visibility = "hidden"; return; }
    v.set(...punkt).project(camera);
    const x = ((v.x + 1) / 2) * size.width, y = ((1 - v.y) / 2) * size.height;
    const links = Math.min(Math.max(x + 18, 8), size.width - el.offsetWidth - 8);
    const oben = Math.min(Math.max(y - el.offsetHeight / 2, 8), size.height - el.offsetHeight - 8);
    el.style.transform = `translate(${Math.round(links)}px, ${Math.round(oben)}px)`;
    el.style.visibility = "visible";
  });
  return null;
}

/** Ambient Occlusion (GTAO) und Ausgabe; "reduziert" schaltet nur AO und Schatten ab. Prioritaet 1 uebernimmt das Rendern. */
function Nachbearbeitung({ reduziert }: { reduziert: boolean }) {
  const { gl, scene, camera, size, invalidate } = useThree();
  const { composer, ao } = useMemo(() => {
    const c = new EffectComposer(gl);
    c.addPass(new RenderPass(scene, camera));
    const ao = new GTAOPass(scene, camera, size.width, size.height);
    ao.blendIntensity = 1;
    ao.updateGtaoMaterial({ radius: 1.5 });
    // Sprites (Beschriftung) wuerden im AO-Normalen-/Tiefen-Pass als dunkle Quader erscheinen.
    const zeichne = ao.render.bind(ao) as (...a: unknown[]) => void;
    (ao as unknown as { render: (...a: unknown[]) => void }).render = (...a) => {
      const aus: THREE.Object3D[] = [];
      scene.traverse((o) => { if ((o as THREE.Sprite).isSprite && o.visible) { o.visible = false; aus.push(o); } });
      try { zeichne(...a); } finally { aus.forEach((o) => { o.visible = true; }); }
    };
    c.addPass(ao);
    c.addPass(new OutputPass());
    return { composer: c, ao };
  }, [gl, scene, camera]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    composer.setPixelRatio(gl.getPixelRatio());
    composer.setSize(size.width, size.height);
  }, [composer, gl, size.width, size.height]);
  useEffect(() => () => composer.dispose(), [composer]);
  useEffect(() => { invalidate(); }, [reduziert, invalidate]);
  useFrame(() => {
    ao.enabled = !reduziert; // gleicher Ausgabepfad (Tonwerte, Hintergrund), nur ohne AO
    composer.render();
  }, 1);
  return null;
}
