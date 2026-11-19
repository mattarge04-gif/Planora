import { Hud } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { TOKENS } from "../design/tokens";
import type { Interaktion } from "./Interaktion";
import type { Darstellung } from "./Bewegung";
import type { Marker } from "./ampelSockel";

const E = TOKENS.erneuerung;
/** Einheitsformen (Radius 1): Scheibe; Ring für «Baujahr fehlt» (analog CircleDashed, hohl). */
const SCHEIBE = new THREE.CircleGeometry(1, 40);
const RING = new THREE.RingGeometry(0.52, 1, 40);
const weiss = new THREE.MeshBasicMaterial({ color: TOKENS.farbe.flaeche, toneMapped: false, depthTest: false, depthWrite: false });

/**
 * Ampelmarker im Overlay (eigene Szene nach dem Effektdurchlauf): konstante Pixelgrösse wie die Rohrverdickung,
 * nie von Wänden verdeckt, ungetönt und ohne Umgebungsverdeckung, damit das Bild genau die Tokenfarbe zeigt.
 * `nachEffekten`: true, wenn ein EffectComposer (Priorität 1) läuft; sonst rendert das Overlay die Hauptszene selbst.
 */
export function AmpelMarker3({ marker, darstellung, interaktion, nachEffekten }: {
  marker: Marker[]; darstellung?: Darstellung; interaktion?: Interaktion; nachEffekten: boolean;
}) {
  return <Hud renderPriority={nachEffekten ? 2 : 1}>
    {marker.map((m, k) => <Einzel key={`${m.schluessel}:${m.anker.join(":")}`} m={m} reihe={k} darstellung={darstellung} interaktion={interaktion} />)}
  </Hud>;
}

function Einzel({ m, reihe, darstellung, interaktion }: { m: Marker; reihe: number; darstellung?: Darstellung; interaktion?: Interaktion }) {
  const ref = useRef<THREE.Group>(null);
  const farbe = useMemo(() => new THREE.MeshBasicMaterial({ color: m.farbe, toneMapped: false, depthTest: false, depthWrite: false }), [m.farbe]);
  useEffect(() => () => farbe.dispose(), [farbe]);
  const oben = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }) => {
    const g = ref.current;
    if (!g) return;
    const zoom = (camera as THREE.OrthographicCamera).zoom || 1;
    const sichtbar = !darstellung || darstellung.sichtbar.includes(m.geschossId);
    g.visible = sichtbar;
    if (!sichtbar) return;
    const y = (darstellung?.aktuell.current?.[m.geschossId] ?? 0) + (m.inline ? 0 : interaktion?.lift.current?.[m.schluessel] ?? 0);
    oben.setFromMatrixColumn(camera.matrixWorld, 1);
    const radiusPx = m.px / 2 + E.markerRandPx;
    g.position.set(m.anker[0], m.anker[1] + y, m.anker[2]).addScaledVector(oben, (E.markerAbstandPx + radiusPx) / zoom);
    g.quaternion.copy(camera.quaternion);
    g.scale.setScalar(1 / zoom);
  });
  const r = m.px / 2, rand = r + E.markerRandPx;
  // Reihenfolge = Dringlichkeit (Marker sortiert): Rot liegt bei Überlappung oben.
  return <group ref={ref} userData={{ ampelMarker: m.schluessel, ampel: m.ampel }}>
    <mesh geometry={SCHEIBE} material={weiss} scale={rand} renderOrder={10 + 2 * reihe} raycast={() => {}} />
    <mesh geometry={m.ampel === "grau" ? RING : SCHEIBE} material={farbe} scale={r} renderOrder={11 + 2 * reihe} raycast={() => {}} />
  </group>;
}
