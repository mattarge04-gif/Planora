import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { TOKENS } from "../design/tokens";
import { AMPEL_FARBE } from "../lebensdauer/ansicht";
import type { Ampel } from "../lebensdauer/typen";
import type { Huelle, V3 } from "../szene2/huelle";
import { geschossBeiY } from "../szene2/leitungen";
import type { Welt } from "../typen";
import { ampelMaterialFarbe, ampelVonFarbe } from "./ampelSockel";
import { AMPEL_NAH, EINPASS_ZOOM, blende } from "./ampelZustand";
import { GeschossGruppe, type Darstellung } from "./Bewegung";
import { segmentVoll, type AmpelFilter } from "./ampelFilter";
import { bandLaenge, pegelHoehe, pegelJeGeschoss, pegelQuader, pegelSegmente, pegelStirn, segmentStuecke, trefferHoehe, PLATTE_DICKE, type Zaehler } from "./pegelband";

const P = TOKENS.erneuerung.pegel;
const BOX = new THREE.BoxGeometry(1, 1, 1);
const TRAEGER = new THREE.Color(TOKENS.farbe.flaecheSekundaer);
/** Legende als Filter: Segmentfarbe zum Träger hin zurückgenommen. */
const zurueckFarbe = (c: THREE.Color) => c.clone().lerp(TRAEGER, 1 - TOKENS.erneuerung.filter.deckkraft);
/** Klickfläche: nicht gezeichnet, aber per Strahl getroffen. */
const UNSICHTBAR = new THREE.MeshBasicMaterial({ visible: false });
const auslaufen = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Pegelband an der kameraseitigen Plattenstirn je Geschoss (Entscheid 22.11.2026, PO 22.11.: ohne Fussabdrücke;
 * Ansatz C Stufe 2). Setzt zudem den geteilten Bildzustand (ampelZustand): Blende Übersicht <-> nah, Einpasszoom.
 * Klick aufs Band = Geschossfokus.
 */
export function Pegelband3({ welt, h, symbole, ampel, fokusId, kameraRichtung, darstellung, effekte, basisZoom, weniger, onGeschoss,
  geschossHover = null, onGeschossHover, filter = null }: {
  welt: Welt; h: Huelle; symbole: Welt["symbole"]; ampel: ReadonlyMap<string, string>;
  fokusId: string | null; kameraRichtung: V3; darstellung: Darstellung; effekte: boolean; basisZoom: number; weniger: boolean;
  onGeschoss?: (geschossId: string) => void;
  /** Von aussen hervorgehobenes Geschoss (z. B. Zeile der Geschoss-Karte): Band + hoverPx. */
  geschossHover?: string | null;
  onGeschossHover?: (geschossId: string | null) => void;
  /** Legende als Filter: nur Segmente der gewählten Stufen voll, übrige zu grund zurückgenommen. */
  filter?: AmpelFilter | null;
}) {
  const pegel = useMemo(() => pegelJeGeschoss(welt, symbole,
    new Map([...ampel].map(([k, f]) => [k, ampelVonFarbe(f)]))), [welt, symbole, ampel]);
  const [eigenerHover, setEigenerHover] = useState<string | null>(null);
  const schweben = (id: string | null) => {
    setEigenerHover(id); onGeschossHover?.(id);
    document.body.style.cursor = id && onGeschoss ? "pointer" : "";
  };
  useEffect(() => () => { document.body.style.cursor = ""; }, []);
  const stirn = useMemo(() => pegelStirn(h.grundriss, kameraRichtung), [h.grundriss, kameraRichtung]);
  const farben = useMemo(() => Object.fromEntries((["rot", "gelb", "gruen", "grau"] as Ampel[])
    .map((a) => [a, new THREE.Color().setRGB(...ampelMaterialFarbe(AMPEL_FARBE[a], effekte))])) as Record<Ampel, THREE.Color>, [effekte]);
  const material = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), []);
  useEffect(() => () => material.dispose(), [material]);

  const start = useRef<number | null>(null);
  useFrame(({ camera, clock }, dt) => {
    const zoom = (camera as THREE.OrthographicCamera).zoom;
    EINPASS_ZOOM.value = basisZoom;
    const ziel = fokusId !== null || (basisZoom > 0 && zoom > P.nahEinpassung * basisZoom) ? 1 : 0;
    AMPEL_NAH.value = blende(AMPEL_NAH.value, ziel, dt * 1000, weniger ? 0 : P.blendeMs);
    if (start.current === null) start.current = clock.getElapsedTime() * 1000;
  }, -2);
  useEffect(() => () => { AMPEL_NAH.value = 1; EINPASS_ZOOM.value = 0; }, []);

  if (!stirn) return null;
  return <group name="ampel-pegel">
    {darstellung.sichtbar.map((id) => {
      const g = welt.geschosse.find((x) => x.id === id), z = pegel.get(id)?.zaehler;
      if (!g || !z) return null;
      return <GeschossGruppe key={id} id={id} darstellung={darstellung}>
        <Band geschossId={id} yMitte={g.yUnten - PLATTE_DICKE / 2} stirn={stirn} zaehler={z} farben={farben} material={material}
          start={start} weniger={weniger} onGeschoss={onGeschoss} filter={filter} hervor={id === (eigenerHover ?? geschossHover)} onSchweben={schweben} />
      </GeschossGruppe>;
    })}
  </group>;
}

function Band({ geschossId, yMitte, stirn, zaehler, farben, material, start, weniger, onGeschoss, filter, hervor, onSchweben }: {
  geschossId: string; yMitte: number; stirn: NonNullable<ReturnType<typeof pegelStirn>>; zaehler: Zaehler;
  farben: Record<Ampel, THREE.Color>; material: THREE.Material; start: { current: number | null }; weniger: boolean;
  onGeschoss?: (geschossId: string) => void; filter: AmpelFilter | null; hervor: boolean; onSchweben: (geschossId: string | null) => void;
}) {
  const stufenKey = filter ? [...filter.stufen].sort().join("|") : "";
  const laenge = bandLaenge(stirn);
  const ref = useRef<THREE.InstancedMesh>(null);
  const treffer = useRef<THREE.Mesh>(null);
  const zustand = useRef({ hoehe: -1, fuellung: -1 });
  // Stücke für die grösste Bandhöhe einmal bestimmen (Strichteilung grau), Länge folgt der Füllung.
  const stuecke = useMemo(() => pegelSegmente(zaehler, P.minAnteil, laenge > 0 ? P.lueckeM / laenge : 0)
    .flatMap((seg) => segmentStuecke(seg, laenge, P.maxM).map(([von, bis]) => ({ ampel: seg.ampel, von, bis }))), [zaehler, laenge]);
  useEffect(() => { zustand.current = { hoehe: -1, fuellung: -1 }; }, [stuecke, stirn, farben, hervor, stufenKey]);
  useFrame(({ camera, clock }) => {
    const m = ref.current;
    if (!m) return;
    const zoom = (camera as THREE.OrthographicCamera).zoom, hoehe = pegelHoehe(zoom, hervor);
    // Unsichtbare Klickfläche über die ganze Bandlänge, mindestens trefferPx hoch.
    if (treffer.current) {
      const t = pegelQuader(stirn, 0, 1, yMitte, trefferHoehe(zoom, hoehe), -P.tiefeM);
      treffer.current.position.set(...t.mitte); treffer.current.scale.set(...t.groesse);
    }
    const t = weniger || start.current === null ? 1 : Math.min(1, (clock.getElapsedTime() * 1000 - start.current) / P.fuellenMs);
    const fuellung = auslaufen(t);
    if (hoehe === zustand.current.hoehe && fuellung === zustand.current.fuellung) return;
    zustand.current = { hoehe, fuellung };
    const mat = new THREE.Matrix4(), q = new THREE.Quaternion(), aus = new THREE.Vector3(1e-6, 1e-6, 1e-6);
    // Instanz 0: heller Träger über die ganze Länge (Plattenstirn-Ton), damit auch Grau auf der beschatteten Stirn liest.
    const traeger = pegelQuader(stirn, 0, fuellung, yMitte, Math.min(P.traegerMaxM, hoehe * P.traegerFaktor), -P.tiefeM);
    m.setMatrixAt(0, mat.compose(new THREE.Vector3(...traeger.mitte), q, new THREE.Vector3(...traeger.groesse)));
    m.setColorAt(0, TRAEGER);
    stuecke.forEach((s, i) => {
      const k = i + 1, bis = Math.min(s.bis, fuellung);
      if (bis <= s.von) { m.setMatrixAt(k, mat.compose(new THREE.Vector3(), q, aus)); return; }
      const b = pegelQuader(stirn, s.von, bis, yMitte, hoehe);
      m.setMatrixAt(k, mat.compose(new THREE.Vector3(...b.mitte), q, new THREE.Vector3(...b.groesse)));
      m.setColorAt(k, segmentVoll(filter, s.ampel) ? farben[s.ampel] : zurueckFarbe(farben[s.ampel]));
    });
    m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  });
  if (!stuecke.length) return null;
  const ereignisse = {
    onClick: (e: ThreeEvent<MouseEvent>) => { if (onGeschoss && e.delta <= 4) { e.stopPropagation(); onGeschoss(geschossId); } },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onSchweben(geschossId); },
    onPointerOut: () => onSchweben(null),
  };
  return <>
    <instancedMesh key={stuecke.length} ref={ref} args={[BOX, material, stuecke.length + 1]} dispose={null} name="pegelband"
      userData={{ pegelband: geschossId }} raycast={() => {}} />
    <mesh ref={treffer} geometry={BOX} material={UNSICHTBAR} name="pegelband-treffer" userData={{ pegelband: geschossId }} {...ereignisse} />
  </>;
}

