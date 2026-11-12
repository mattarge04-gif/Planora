import { RoundedBox } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { TOKENS } from "../design/tokens";
import type { Bereich, Quader } from "../szene2/huelle";
import { kulisse } from "./kulisse";

/** Heller Modellsockel; Kulisse ist bewusst schematisch, nicht als echte Grundstücksdaten ausgewiesen. */
export function Kulisse3({ bereich, schatten }: { bereich: Bereich; schatten: boolean }) {
  const k = useMemo(() => kulisse(bereich), [bereich]);
  const m = useMemo(() => {
    const matt = (color: string) => new THREE.MeshStandardMaterial({ color, ...TOKENS.material.bauteil });
    return { platte: matt(TOKENS.farbe.flaecheSekundaer), rand: matt(TOKENS.farbe.grau1), weg: matt(TOKENS.farbe.grau1),
      linie: matt(TOKENS.farbe.flaeche), krone: matt(TOKENS.farbe.grau1), stamm: matt(TOKENS.farbe.grau2) };
  }, []);
  useEffect(() => () => Object.values(m).forEach((x) => x.dispose()), [m]);
  const [b, h, t] = k.platte.groesse;
  const bodenY = bereich.yMin;
  const kasten = (q: Quader, i: number) => <mesh key={i} position={[q.mitte[0], q.mitte[1] + bodenY, q.mitte[2]]} material={m.weg} receiveShadow><boxGeometry args={q.groesse} /></mesh>;
  return <group name="kulisse">
    <RoundedBox args={[b, h, t]} radius={Math.min(TOKENS.radius.platteM * 3, h / 2 - 0.01)} smoothness={4}
      position={[k.platte.mitte[0], k.platte.mitte[1] + bodenY - 0.27, k.platte.mitte[2]]} material={m.platte} receiveShadow />
    <RoundedBox args={[b + 0.2, 0.12, t + 0.2]} radius={TOKENS.radius.platteM} smoothness={3}
      position={[k.platte.mitte[0], bodenY - h - 0.28, k.platte.mitte[2]]} material={m.rand} receiveShadow />
    <group position={[0, -0.26, 0]}>
      {k.wege.map(kasten)}
      {k.parkfelder.map((q, i) => <group key={i}>
        {kasten(q, i)}
        <mesh position={[q.mitte[0], bodenY + q.mitte[1] + q.groesse[1] / 2 + 0.008, q.mitte[2] - q.groesse[2] / 2]} material={m.linie} receiveShadow>
          <boxGeometry args={[q.groesse[0], 0.015, 0.09]} />
        </mesh>
      </group>)}
      {k.baeume.map((a, i) => <group key={i} position={[a.position[0], bodenY, a.position[2]]}>
        <mesh position={[0, a.hoehe * 0.23, 0]} material={m.stamm} castShadow={schatten} receiveShadow>
          <cylinderGeometry args={[0.1, 0.15, a.hoehe * 0.46, 12]} />
        </mesh>
        <mesh position={[0, a.hoehe * 0.65, 0]} scale={[0.86, 1.2, 0.86]} material={m.krone} castShadow={schatten} receiveShadow>
          <sphereGeometry args={[a.radius, 20, 16]} />
        </mesh>
        <mesh position={[0, 0.01, 0]} material={m.platte} receiveShadow><boxGeometry args={[a.radius * 1.9, 0.06, a.radius * 1.9]} /></mesh>
      </group>)}
    </group>
  </group>;
}
