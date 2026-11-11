import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { FARBEN, type SzeneBeschriftung, type SzeneDaten } from "./daten";

const PIN_GEOMETRIE = new THREE.CylinderGeometry(0.5, 0.5, 0.3, 24);

interface Props { daten: SzeneDaten; auswahl: string | null; onAuswahl: (schluessel: string | null) => void }

/** 3D-Uebersicht nach ADR 0008: orthografisch, isometrisch, Zeichnen nur bei Aenderung. */
export function Szene({ daten, auswahl, onAuswahl }: Props) {
  return (
    <Canvas className="szene" orthographic frameloop="demand" dpr={[1, 1.5]} onPointerMissed={() => onAuswahl(null)}>
      <color attach="background" args={["#f4f5f7"]} />
      <ambientLight intensity={0.9} />
      <directionalLight position={[30, 50, 20]} intensity={0.6} />
      <Kamera daten={daten} />
      {daten.platten.map((p, i) => (
        <mesh key={i} position={p.mitte}>
          <boxGeometry args={[p.breite, 0.08, p.tiefe]} />
          <meshStandardMaterial color="#9fb7c9" transparent opacity={0.22} depthWrite={false} />
        </mesh>
      ))}
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[daten.linien, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#475569" />
      </lineSegments>
      {daten.beschriftungen.map((b, i) => <Beschriftung key={i} {...b} />)}
      <Pins daten={daten} auswahl={auswahl} onAuswahl={onAuswahl} />
    </Canvas>
  );
}

function Kamera({ daten }: { daten: SzeneDaten }) {
  const { camera, gl, size, invalidate } = useThree();
  useEffect(() => {
    const [zx, zy, zz] = daten.kamera.ziel, r = daten.kamera.radius;
    const kamera = camera as THREE.OrthographicCamera;
    kamera.position.set(zx + r * 2, zy + r * 2, zz + r * 2); // isometrisch: 45° gedreht, ca. 35° Neigung
    kamera.near = 0.1; kamera.far = r * 20;
    kamera.zoom = Math.min(size.width, size.height) / (r * 2.4);
    kamera.lookAt(zx, zy, zz);
    kamera.updateProjectionMatrix();
    const steuerung = new OrbitControls(kamera, gl.domElement);
    steuerung.target.set(zx, zy, zz);
    steuerung.maxPolarAngle = Math.PI / 2 - 0.05; // nicht unter den Boden
    steuerung.minZoom = kamera.zoom / 4; steuerung.maxZoom = kamera.zoom * 8;
    steuerung.update();
    const neu = () => invalidate();
    steuerung.addEventListener("change", neu);
    invalidate();
    return () => { steuerung.removeEventListener("change", neu); steuerung.dispose(); };
  }, [daten, camera, gl, size.width, size.height, invalidate]);
  return null;
}

function Beschriftung({ text, position, groesse }: SzeneBeschriftung) {
  const textur = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512; c.height = 96;
    const g = c.getContext("2d")!;
    g.font = "500 44px system-ui, sans-serif"; g.fillStyle = "#1f2937"; g.textBaseline = "middle";
    g.fillText(text, 8, 48);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [text]);
  useEffect(() => () => textur.dispose(), [textur]);
  return (
    <sprite position={position} scale={[groesse * (512 / 96), groesse, 1]}>
      <spriteMaterial map={textur} transparent depthTest={false} />
    </sprite>
  );
}

function Pins({ daten, auswahl, onAuswahl }: Props) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const { gl, invalidate } = useThree();
  const [hover, setHover] = useState<number | null>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D(), farbe = new THREE.Color();
    daten.pins.forEach((p, i) => {
      const gewaehlt = p.schluessel === auswahl;
      o.position.set(...p.position);
      o.scale.setScalar(gewaehlt ? 1.5 : 1);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, farbe.set(gewaehlt ? FARBEN.auswahl : p.farbe));
    });
    m.count = daten.pins.length;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
    invalidate();
  }, [daten, auswahl, invalidate]);
  const ueber = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    gl.domElement.style.cursor = e.instanceId === undefined ? "" : "pointer";
    setHover(e.instanceId ?? null);
  };
  const p = hover !== null ? daten.pins[hover] : undefined;
  return (
    <>
      <instancedMesh
        ref={ref}
        args={[PIN_GEOMETRIE, undefined, Math.max(daten.pins.length, 1)]}
        onPointerMove={ueber}
        onPointerOut={() => { gl.domElement.style.cursor = ""; setHover(null); }}
        onClick={(e) => { e.stopPropagation(); if (e.instanceId !== undefined) onAuswahl(daten.pins[e.instanceId].schluessel); }}
      >
        <meshStandardMaterial />
      </instancedMesh>
      {p && <Beschriftung text={p.name} position={[p.position[0], p.position[1] + 1.2, p.position[2]]} groesse={0.7} />}
    </>
  );
}
