import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { V3 } from "./huelle";

function textur(text: string, farbe: string) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 96;
  const g = c.getContext("2d")!;
  g.font = "600 52px system-ui, sans-serif"; g.fillStyle = farbe; g.textBaseline = "middle";
  g.fillText(text, 8, 48);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Beschriftung, die immer zur Kamera zeigt. groesse = Hoehe in m. */
export function Schild({ text, position, groesse }: { text: string; position: V3; groesse: number }) {
  const t = useMemo(() => textur(text, "#334155"), [text]);
  useEffect(() => () => t.dispose(), [t]);
  return (
    <sprite position={position} scale={[groesse * (512 / 96), groesse, 1]}>
      <spriteMaterial map={t} transparent depthTest={false} />
    </sprite>
  );
}

/** Flache Schrift auf dem Boden; breite = Breite in m. */
export function BodenSchrift({ text, position, breite }: { text: string; position: V3; breite: number }) {
  const t = useMemo(() => textur(text, "#1e293b"), [text]);
  useEffect(() => () => t.dispose(), [t]);
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[breite, breite * (96 / 512)]} />
      <meshBasicMaterial map={t} transparent depthWrite={false} />
    </mesh>
  );
}
