import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { TOKENS } from "../design/tokens";
import { AMPEL_FARBE } from "../lebensdauer/ansicht";
import type { Ampel } from "../lebensdauer/typen";
import { ampelMaterialFarbe, ampelVonFarbe } from "./ampelSockel";
import { lageMasse, type Instanz } from "./Anlagen3";
import type { Interaktion } from "./Interaktion";
import { manschetten, manschettenFaktor, manschettenGeometrie, type ManschettenTeil } from "./manschette";
import { mitRohrStaerke } from "./rohrStaerke";
import { anhaengerGroesse, anhaengerOrt, istZurueck, type AmpelFilter } from "./ampelFilter";
import { ROHR } from "./technik";
import { AMPEL_NAH, EINPASS_ZOOM } from "./ampelZustand";

const MS = TOKENS.erneuerung.manschette;
const STUFEN: Ampel[] = ["rot", "gelb", "gruen", "grau"];
const FORM: Record<string, ManschettenTeil["form"]> = {
  "heizung.speicher": "rund", "heizung.umwaelzpumpe": "pumpe", "heizung.verteiler": "verteiler",
};
const Y = new THREE.Vector3(0, 1, 0);
const DREHUNG = {
  x: new THREE.Quaternion().setFromUnitVectors(Y, new THREE.Vector3(1, 0, 0)),
  y: new THREE.Quaternion(),
  z: new THREE.Quaternion().setFromUnitVectors(Y, new THREE.Vector3(0, 0, 1)),
};

/** Ease-out wie TOKENS.bewegung.kurve (cubic-bezier(0.2, 0.8, 0.2, 1)), genähert. */
const auslaufen = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Prüfmanschetten im Modus Erneuerung (Entscheid 22.11.2026, Kritik r1): je Bauteil Ring/Band/Kragen in Ampelfarbe.
 * Ungetönt, Farbe vorab um Tone Mapping und Umgebungsverdeckung des Effektdurchlaufs korrigiert (F9), ohne Schatten.
 * Aus der Distanz gestreckt (manschettenFaktor), Ringe am Rohr verdicken mit der Leitung. Hover/Auswahl: eisAkzent-Rand.
 * Beim Einschalten ziehen die Manschetten in aufziehenMs auf (nicht bei reduzierter Bewegung).
 */
export function Manschetten3({ instanzen, ampel, effekte, interaktion, filter = null }: {
  instanzen: Instanz[]; ampel: ReadonlyMap<string, string>;
  /** Effektdurchlauf aktiv (nicht reduziert): Tone Mapping und Verdeckung wirken auf alle Pixel, Farbe vorab umkehren. */
  effekte: boolean; interaktion?: Interaktion;
  /** Legende als Filter: Manschetten von Nicht-Treffern zu grund zurückgenommen. */
  filter?: AmpelFilter | null;
}) {
  const liste = useMemo(() => manschetten(instanzen.filter((i) => ampel.has(i.s.schluessel)).map((i) => ({
    schluessel: i.s.schluessel, mitte: i.mitte, masse: lageMasse(i), inline: i.inline, ampel: ampelVonFarbe(ampel.get(i.s.schluessel)!),
    form: FORM[i.s.katalogId],
    rohrRadius: i.inline ? (i.s.ort && "vorBauteil" in i.s.ort ? ROHR.verteil : ROHR.stock) : undefined,
  }))), [instanzen, ampel]);
  const geometrien = useMemo(() => liste.map((m) => manschettenGeometrie(m)), [liste]);
  useEffect(() => () => geometrien.forEach((g) => g.dispose()), [geometrien]);
  const aktiv = new Set([interaktion?.auswahl, interaktion?.hover, ...(interaktion?.betont ?? [])].filter((k): k is string => !!k));
  const raender = useMemo(() => new Map(liste.map((m, k) => [k, m] as const).filter(([, m]) => aktiv.has(m.schluessel))
    .map(([k, m]) => [k, manschettenGeometrie(m, MS.hoverRandM)])), [liste, [...aktiv].join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => raender.forEach((g) => g.dispose()), [raender]);
  const materialien = useMemo(() => {
    const farbe = (a: Ampel) => new THREE.Color().setRGB(...ampelMaterialFarbe(AMPEL_FARBE[a], effekte));
    const basis = (a: Ampel, zurueck = false) => new THREE.MeshBasicMaterial({ toneMapped: false, side: THREE.DoubleSide, vertexColors: true,
      color: zurueck ? farbe(a).lerp(new THREE.Color(TOKENS.farbe.grund), 1 - TOKENS.erneuerung.filter.deckkraft) : farbe(a) });
    const rand = () => new THREE.MeshBasicMaterial({ color: TOKENS.farbe.eisAkzent, side: THREE.BackSide });
    return {
      fest: Object.fromEntries(STUFEN.map((a) => [a, basis(a)])) as Record<Ampel, THREE.MeshBasicMaterial>,
      dick: Object.fromEntries(STUFEN.map((a) => [a, mitRohrStaerke(basis(a))])) as Record<Ampel, THREE.MeshBasicMaterial>,
      festZurueck: Object.fromEntries(STUFEN.map((a) => [a, basis(a, true)])) as Record<Ampel, THREE.MeshBasicMaterial>,
      dickZurueck: Object.fromEntries(STUFEN.map((a) => [a, mitRohrStaerke(basis(a, true))])) as Record<Ampel, THREE.MeshBasicMaterial>,
      rand: rand(), randDick: mitRohrStaerke(rand()),
    };
  }, [effekte]);
  useEffect(() => () => [...Object.values(materialien.fest), ...Object.values(materialien.dick), ...Object.values(materialien.festZurueck),
    ...Object.values(materialien.dickZurueck), materialien.rand, materialien.randDick]
    .forEach((m) => m.dispose()), [materialien]);

  const lagen = useRef<(THREE.Group | null)[]>([]), hoehen = useRef<(THREE.Group | null)[]>([]);
  const start = useRef<number | null>(null);
  const sofort = useMemo(() => typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  useFrame(({ camera, clock }) => {
    const jetzt = clock.getElapsedTime() * 1000;
    if (start.current === null) start.current = jetzt;
    const t = sofort ? 1 : Math.min(1, (jetzt - start.current) / MS.aufziehenMs);
    const auf = Math.max(1e-3, auslaufen(t)), zoom = (camera as THREE.OrthographicCamera).zoom;
    liste.forEach((m, k) => {
      const l = lagen.current[k], h = hoehen.current[k];
      if (!l || !h) return;
      const lift = m.hebt ? interaktion?.lift.current?.[m.schluessel] ?? 0 : 0;
      l.position.set(m.mitte[0], m.mitte[1] + lift, m.mitte[2]);
      h.scale.set(1, Math.max(1e-3, manschettenFaktor(m, zoom, EINPASS_ZOOM.value) * auf * AMPEL_NAH.value), 1);
    });
  }, -1);
  if (!liste.length) return null;
  return <group name="ampel-manschetten">
    {liste.map((m, k) => <group key={`${m.schluessel}:${m.mitte.join(":")}`} ref={(g) => { lagen.current[k] = g; }}
      position={m.mitte} quaternion={DREHUNG[m.achse]}>
      <group ref={(g) => { hoehen.current[k] = g; }} scale={[1, sofort ? 1 : 1e-3, 1]} userData={{ ampelManschette: m.schluessel, ampel: m.ampel }}>
        <mesh geometry={geometrien[k]} raycast={() => {}} renderOrder={1} material={(istZurueck(filter, m.schluessel)
          ? m.verdicken ? materialien.dickZurueck : materialien.festZurueck : m.verdicken ? materialien.dick : materialien.fest)[m.ampel]} />
        {raender.get(k) && <mesh geometry={raender.get(k)} material={m.verdicken ? materialien.randDick : materialien.rand} raycast={() => {}} />}
      </group>
    </group>)}
  </group>;
}

const FA = TOKENS.erneuerung.filter;
/** Anhänger-Einheitsform (Kante 1, Unterkante im Ursprung): hohles, abgerundetes Schild, Dicke entlang z. */
function anhaengerForm(): THREE.BufferGeometry {
  const r = 0.16, aussen = new THREE.Shape(), loch = new THREE.Path(), i = FA.anhaengerRand;
  const rechteck = (p: THREE.Path | THREE.Shape, x0: number, y0: number, x1: number, y1: number, k: number) => {
    p.moveTo(x0 + k, y0); p.lineTo(x1 - k, y0); p.quadraticCurveTo(x1, y0, x1, y0 + k); p.lineTo(x1, y1 - k);
    p.quadraticCurveTo(x1, y1, x1 - k, y1); p.lineTo(x0 + k, y1); p.quadraticCurveTo(x0, y1, x0, y1 - k); p.lineTo(x0, y0 + k);
    p.quadraticCurveTo(x0, y0, x0 + k, y0);
  };
  rechteck(aussen, -0.5, 0, 0.5, 1, r);
  rechteck(loch, -0.5 + i, i, 0.5 - i, 1 - i, Math.max(0.02, r - i / 2));
  aussen.holes.push(loch);
  const g = new THREE.ExtrudeGeometry(aussen, { depth: FA.anhaengerTiefe, bevelEnabled: false, curveSegments: 6 });
  g.translate(0, 0, -FA.anhaengerTiefe / 2);
  return g;
}
const ANHAENGER = anhaengerForm();

/**
 * Neutraler Anhänger (grau3, hohl) für «ohne Preis» / «Baujahr fehlt» (Entscheid 22.11.2026, Filter): steht auf der
 * Oberkante der Anlage bzw. neben dem Rohr eines Teils in der Leitung, dreht sich um die Senkrechte zur Kamera; keine
 * Statusfarbe (Regel 10). Grösse mit Bildschirm-Mindestmass, folgt dem Anheben der Anlage.
 */
export function Anhaenger3({ instanzen, effekte, interaktion }: { instanzen: Instanz[]; effekte: boolean; interaktion?: Interaktion }) {
  const material = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false,
    color: new THREE.Color().setRGB(...ampelMaterialFarbe(TOKENS.farbe.grau3, effekte)) }), [effekte]);
  useEffect(() => () => material.dispose(), [material]);
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const rechts = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }) => {
    const groesse = anhaengerGroesse((camera as THREE.OrthographicCamera).zoom);
    rechts.setFromMatrixColumn(camera.matrixWorld, 0).setY(0);
    if (rechts.lengthSq() < 1e-9) rechts.set(1, 0, 0);
    rechts.normalize();
    const drehung = Math.atan2(rechts.x, rechts.z) - Math.PI / 2;
    instanzen.forEach((i, k) => {
      const m = refs.current[k];
      if (!m) return;
      const p = anhaengerOrt(i.mitte, lageMasse(i), i.inline, groesse, [rechts.x, rechts.z]);
      const lift = i.inline ? 0 : interaktion?.lift.current?.[i.s.schluessel] ?? 0;
      m.position.set(p[0], p[1] + lift, p[2]); m.rotation.set(0, drehung, 0); m.scale.setScalar(groesse);
    });
  }, -1);
  return <group name="ampel-anhaenger">{instanzen.map((i, k) => <mesh key={`${i.s.schluessel}:${i.mitte.join(":")}`}
    ref={(m) => { refs.current[k] = m; }} geometry={ANHAENGER} material={material} raycast={() => {}} userData={{ anhaenger: i.s.schluessel }} />)}</group>;
}
