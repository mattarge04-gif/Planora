import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { TOKENS } from "../design/tokens";
import { AMPEL_FARBE } from "../lebensdauer/ansicht";
import type { Ampel } from "../lebensdauer/typen";
import { ampelMaterialFarbe, ampelVonFarbe } from "./ampelSockel";
import { lageMasse, type Instanz } from "./Anlagen3";
import type { Interaktion } from "./Interaktion";
import { banderolenGeometrie, banderolenHoehen, banderolenKante, manschetten, manschettenFaktor, manschettenGeometrie, type ManschettenTeil } from "./manschette";
import { mitRohrStaerke } from "./rohrStaerke";
import { istZurueck, type AmpelFilter } from "./ampelFilter";
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
  // Graue Banderole bündig an der Manschette («ohne Preis» / «Baujahr fehlt»): haftet am Bauteil, nichts schwebt (Kritik r6).
  const banderoleKey = filter ? [...filter.anhaenger].sort().join("|") : "";
  const banderolen = useMemo(() => new Map(liste.map((m, k) => [k, m] as const).filter(([, m]) => !!filter?.anhaenger.has(m.schluessel))
    .map(([k, m]) => [k, banderolenGeometrie(m)])), [liste, banderoleKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => banderolen.forEach((g) => g.dispose()), [banderolen]);
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
      banderole: basis("grau"), banderoleDick: mitRohrStaerke(basis("grau")),
      abstand: new THREE.MeshBasicMaterial({ color: TOKENS.farbe.flaeche, toneMapped: false, side: THREE.DoubleSide }),
      abstandDick: mitRohrStaerke(new THREE.MeshBasicMaterial({ color: TOKENS.farbe.flaeche, toneMapped: false, side: THREE.DoubleSide })),
    };
  }, [effekte]);
  useEffect(() => () => [...Object.values(materialien.fest), ...Object.values(materialien.dick), ...Object.values(materialien.festZurueck),
    ...Object.values(materialien.dickZurueck), materialien.rand, materialien.randDick, materialien.banderole, materialien.banderoleDick,
    materialien.abstand, materialien.abstandDick]
    .forEach((m) => m.dispose()), [materialien]);

  const lagen = useRef<(THREE.Group | null)[]>([]), hoehen = useRef<(THREE.Group | null)[]>([]);
  const banderolenTeile = useRef<({ abstand: THREE.Mesh | null; band: THREE.Mesh | null })[]>([]);
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
      // Banderole: Bildschirm-Mindestbreite und weisser Abstand unabhängig von der Streckung der Manschette.
      const b = banderolenTeile.current[k];
      if (b?.abstand && b.band) {
        const kante = banderolenKante(m), hb = banderolenHoehen(zoom, h.scale.y);
        b.abstand.position.y = kante.y; b.abstand.scale.y = kante.richtung * hb.abstand;
        b.band.position.y = kante.y + kante.richtung * hb.abstand; b.band.scale.y = kante.richtung * hb.hoehe;
      }
    });
  }, -1);
  if (!liste.length) return null;
  return <group name="ampel-manschetten">
    {liste.map((m, k) => <group key={`${m.schluessel}:${m.mitte.join(":")}`} ref={(g) => { lagen.current[k] = g; }}
      position={m.mitte} quaternion={DREHUNG[m.achse]}>
      <group ref={(g) => { hoehen.current[k] = g; }} scale={[1, sofort ? 1 : 1e-3, 1]} userData={{ ampelManschette: m.schluessel, ampel: m.ampel }}>
        <mesh geometry={geometrien[k]} raycast={() => {}} renderOrder={1} material={(istZurueck(filter, m.schluessel)
          ? m.verdicken ? materialien.dickZurueck : materialien.festZurueck : m.verdicken ? materialien.dick : materialien.fest)[m.ampel]} />
        {banderolen.get(k) && <>
          <mesh ref={(x) => { banderolenTeile.current[k] = { ...banderolenTeile.current[k], abstand: x }; }} geometry={banderolen.get(k)}
            material={m.verdicken ? materialien.abstandDick : materialien.abstand} raycast={() => {}} renderOrder={1} scale={[1, 1e-3, 1]} />
          <mesh ref={(x) => { banderolenTeile.current[k] = { ...banderolenTeile.current[k], band: x }; }} geometry={banderolen.get(k)}
            material={m.verdicken ? materialien.banderoleDick : materialien.banderole} raycast={() => {}} renderOrder={1} scale={[1, 1e-3, 1]}
            userData={{ banderole: m.schluessel }} />
        </>}
        {raender.get(k) && <mesh geometry={raender.get(k)} material={m.verdicken ? materialien.randDick : materialien.rand} raycast={() => {}} />}
      </group>
    </group>)}
  </group>;
}

