import { Hud } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { TOKENS } from "../design/tokens";
import type { Interaktion } from "./Interaktion";
import type { Darstellung } from "./Bewegung";
import { markerReihen, type Marker } from "./ampelSockel";
import { FreiraumSchnitt } from "./FreiraumSchnitt";
import type { Freiraum } from "./kamera";

const E = TOKENS.erneuerung;
/** Einheitsformen (Radius 1): Scheibe; Ring für «Baujahr fehlt» (analog CircleDashed, hohl). */
const SCHEIBE = new THREE.CircleGeometry(1, 40);
const RING = new THREE.RingGeometry(0.52, 1, 40);
const weiss = new THREE.MeshBasicMaterial({ color: TOKENS.farbe.flaeche, toneMapped: false, depthTest: false, depthWrite: false });

/**
 * Ampelmarker im Overlay (eigene Szene nach dem Effektdurchlauf): konstante Pixelgrösse wie die Rohrverdickung,
 * nie von Wänden verdeckt; Marker, die sich überlappen würden, stehen als Reihe nebeneinander. Ungetönt und ohne Umgebungsverdeckung, damit das Bild genau die Tokenfarbe zeigt.
 * `nachEffekten`: true, wenn ein EffectComposer (Priorität 1) läuft; sonst rendert das Overlay die Hauptszene selbst.
 */
export function AmpelMarker3({ marker, darstellung, interaktion, nachEffekten, freiraum }: {
  marker: Marker[]; darstellung?: Darstellung; interaktion?: Interaktion; nachEffekten: boolean;
  /** Freie Szenenfläche: Marker scheinen nicht durch Panels und Tabelle. */
  freiraum?: Freiraum;
}) {
  const gruppen = useRef<(THREE.Group | null)[]>([]);
  const size = useThree((s) => s.size);
  const hilfe = useMemo(() => ({ oben: new THREE.Vector3(), rechts: new THREE.Vector3(), p: new THREE.Vector3() }), []);
  useFrame(({ camera }) => {
    const zoom = (camera as THREE.OrthographicCamera).zoom || 1;
    hilfe.oben.setFromMatrixColumn(camera.matrixWorld, 1); hilfe.rechts.setFromMatrixColumn(camera.matrixWorld, 0);
    // 1. Weltlage über der Anlage (Geschossversatz, Anheben), 2. Bildschirmlage, 3. überlappende Marker als Reihe.
    const lagen = marker.map((m) => {
      const sichtbar = !darstellung || darstellung.sichtbar.includes(m.geschossId);
      const y = (darstellung?.aktuell.current?.[m.geschossId] ?? 0) + (m.inline ? 0 : interaktion?.lift.current?.[m.schluessel] ?? 0);
      const d = m.px + 2 * E.markerRandPx;
      const welt = new THREE.Vector3(m.anker[0], m.anker[1] + y, m.anker[2]).addScaledVector(hilfe.oben, (E.markerAbstandPx + d / 2) / zoom);
      hilfe.p.copy(welt).project(camera);
      return { sichtbar, welt, d, x: (hilfe.p.x + 1) / 2 * size.width, y: (1 - hilfe.p.y) / 2 * size.height };
    });
    const zeigen = lagen.map((l, i) => i).filter((i) => lagen[i].sichtbar).reverse(); // dringendste zuerst = links
    const versatz = markerReihen(zeigen.map((i) => ({ x: lagen[i].x, y: lagen[i].y, d: lagen[i].d })), E.markerLueckePx);
    lagen.forEach((l, i) => {
      const g = gruppen.current[i];
      if (!g) return;
      g.visible = l.sichtbar;
      if (!l.sichtbar) return;
      const v = versatz[zeigen.indexOf(i)];
      g.position.copy(l.welt).addScaledVector(hilfe.rechts, v.dx / zoom).addScaledVector(hilfe.oben, -v.dy / zoom);
      g.quaternion.copy(camera.quaternion);
      g.scale.setScalar(1 / zoom);
    });
  });
  const inhalt = marker.map((m, k) => <Einzel key={`${m.schluessel}:${m.anker.join(":")}`} m={m} reihe={k}
    gruppe={(g) => { gruppen.current[k] = g; }} />);
  return <Hud renderPriority={nachEffekten ? 2 : 1}>
    {freiraum ? <FreiraumSchnitt freiraum={freiraum}>{inhalt}</FreiraumSchnitt> : inhalt}
  </Hud>;
}

function Einzel({ m, reihe, gruppe }: { m: Marker; reihe: number; gruppe: (g: THREE.Group | null) => void }) {
  const farbe = useMemo(() => new THREE.MeshBasicMaterial({ color: m.farbe, toneMapped: false, depthTest: false, depthWrite: false,
    transparent: !!m.gedimmt, opacity: m.gedimmt ? E.markerGedimmtDeckkraft : 1 }), [m.farbe, m.gedimmt]);
  const grund = useMemo(() => m.gedimmt ? new THREE.MeshBasicMaterial({ color: TOKENS.farbe.flaeche, toneMapped: false, depthTest: false,
    depthWrite: false, transparent: true, opacity: E.markerGedimmtDeckkraft }) : weiss, [m.gedimmt]);
  useEffect(() => () => { farbe.dispose(); if (grund !== weiss) grund.dispose(); }, [farbe, grund]);
  const r = m.px / 2, rand = r + E.markerRandPx;
  // Reihenfolge = Dringlichkeit (Marker sortiert): Rot liegt bei Überlappung oben.
  return <group ref={gruppe} visible={false} userData={{ ampelMarker: m.schluessel, ampel: m.ampel }}>
    <mesh geometry={SCHEIBE} material={grund} scale={rand} renderOrder={10 + 2 * reihe} raycast={() => {}} />
    <mesh geometry={m.ampel === "grau" ? RING : SCHEIBE} material={farbe} scale={r} renderOrder={11 + 2 * reihe} raycast={() => {}} />
  </group>;
}
