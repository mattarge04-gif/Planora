import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/** Geteilte Geometrien; Formen stehen mit der Unterkante auf y = 0. Masse in m [A]. */
const G = {
  wpKoerper: new RoundedBoxGeometry(1.0, 1.2, 0.6, 3, 0.08),
  gitter: new THREE.CylinderGeometry(0.34, 0.34, 0.03, 32),
  kessel: new THREE.CylinderGeometry(0.4, 0.4, 1.6, 32),
  speicher: new THREE.CylinderGeometry(0.45, 0.45, 1.8, 32),
  fernwaerme: new RoundedBoxGeometry(1.0, 0.8, 0.3, 2, 0.04),
  pumpe: new THREE.CylinderGeometry(0.15, 0.15, 0.3, 24),
  balken: new THREE.BoxGeometry(1.2, 0.15, 0.15),
  stutzen: new THREE.CylinderGeometry(0.04, 0.04, 0.3, 12),
  hkPlatte: new THREE.BoxGeometry(1.0, 0.6, 0.06),
  hkRippe: new THREE.BoxGeometry(0.04, 0.6, 0.12),
  scheibe: new THREE.CylinderGeometry(0.35, 0.35, 0.06, 24),
  kasten: new RoundedBoxGeometry(0.6, 0.6, 0.6, 2, 0.05),
};
const GITTER_MAT = new THREE.MeshStandardMaterial({ color: "#3f2a28", roughness: 0.8 });

export function BauteilForm({ katalogId, m }: { katalogId: string; m: THREE.Material }) {
  switch (katalogId) {
    case "heizung.waermepumpe":
      return (
        <group>
          <mesh geometry={G.wpKoerper} material={m} position={[0, 0.6, 0]} castShadow />
          <mesh geometry={G.gitter} material={GITTER_MAT} position={[0, 0.7, 0.31]} rotation={[Math.PI / 2, 0, 0]} />
        </group>
      );
    case "heizung.gaskessel":
    case "heizung.oelkessel":
      return <mesh geometry={G.kessel} material={m} position={[0, 0.8, 0]} castShadow />;
    case "heizung.speicher":
      return <mesh geometry={G.speicher} material={m} position={[0, 0.9, 0]} castShadow />;
    case "heizung.fernwaerme_uebergabe":
      return <mesh geometry={G.fernwaerme} material={m} position={[0, 1.0, 0]} castShadow />;
    case "heizung.umwaelzpumpe":
      return <mesh geometry={G.pumpe} material={m} position={[0, 0.3, 0]} rotation={[0, 0, Math.PI / 2]} castShadow />;
    case "heizung.verteiler":
      return (
        <group>
          <mesh geometry={G.balken} material={m} position={[0, 0.8, 0]} castShadow />
          {[-0.45, -0.15, 0.15, 0.45].map((x) => <mesh key={x} geometry={G.stutzen} material={m} position={[x, 0.6, 0]} />)}
        </group>
      );
    case "heizung.heizkoerper":
      return (
        <group position={[0, 0.5, 0]}>
          <mesh geometry={G.hkPlatte} material={m} castShadow />
          {[-0.4, -0.24, -0.08, 0.08, 0.24, 0.4].map((x) => <mesh key={x} geometry={G.hkRippe} material={m} position={[x, 0, 0]} />)}
        </group>
      );
    case "heizung.fbh_kreis":
    case "heizung.tabs_feld":
      return <mesh geometry={G.scheibe} material={m} position={[0, 0.03, 0]} />;
    default:
      return <mesh geometry={G.kasten} material={m} position={[0, 0.3, 0]} castShadow />;
  }
}
