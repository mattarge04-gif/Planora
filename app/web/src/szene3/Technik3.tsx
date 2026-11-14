import { AccumulativeShadows, RandomizedLight } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import * as THREE from "three";
import { TOKENS } from "../design/tokens";
import { type V3 } from "../szene2/huelle";
import { schlange, geschossBeiY } from "../szene2/leitungen";
import type { KatalogEintrag, Welt, WeltSymbol } from "../typen";
import { Anlagen3 } from "./Anlagen3";
import { durchgaenge, einheitVon, freieVerteilerAbgaenge, rohrnetz, type Huelse, type Rohrstueck } from "./netz";
import { geschossSchnitt } from "./schnitt";
import { anlagenDaten, anlageSichtbar, rohrAbschluesse, rohrSchnitt } from "./technik";
import { anzeigeWelt } from "./gruppenNetz";
import { bandGeometrie, huelsenGeometrie, rohrGeometrie } from "./technikGeometrie";
import { GeschossGruppe, type Darstellung } from "./Bewegung";
import type { Interaktion } from "./Interaktion";
import { rohrGeschosse } from "./darstellung";
import { SCHATTEN, kontaktLichtZiel } from "./qualitaet";

const FLAECHE = new Set(["heizung.fbh_kreis", "heizung.tabs_feld"]);

export function Technik3({ welt, katalog, fokusId, schatten, onModelle, darstellung, interaktion, separiert = false }: {
  welt: Welt; katalog: KatalogEintrag[]; fokusId: string | null; schatten: boolean; onModelle: () => void;
  darstellung?: Darstellung; interaktion?: Interaktion; separiert?: boolean;
}) {
  const [anschluesse, setAnschluesse] = useState<Record<string, V3>>({});
  const onModell = useCallback((pfad: string, anschluss: V3) => {
    setAnschluesse((alt) => alt[pfad] ? alt : { ...alt, [pfad]: anschluss });
  }, []);
  useEffect(onModelle, [anschluesse, onModelle]);
  // Verteiler mit Gruppen und Teile in der Leitung erhalten ihre Darstellungslage (v1-Welten unverändert).
  const anzeige = useMemo(() => anzeigeWelt(welt, katalog, anschluesse), [welt, katalog, anschluesse]);
  const symbole = useMemo(() => anzeige.symbole.filter((s) => anlageSichtbar(anzeige, fokusId, s)), [anzeige, fokusId]);
  const schnitt = useMemo(() => geschossSchnitt(welt, fokusId), [welt, fokusId]);
  // Leitungsführung nur bei geänderter Welt bzw. geladenen Anschlüssen neu berechnen, nicht bei jedem Geschosswechsel.
  const ganz = useMemo(() => rohrnetz(welt, katalog, anschluesse), [welt, katalog, anschluesse]);
  const netz = useMemo(() => {
    const yMax = schnitt.fokus ? schnitt.fokus.yUnten + schnitt.fokus.hoehe - 0.25 : Infinity;
    const huelsen = new Map<string, Huelse>();
    for (const r of ganz) for (const h of durchgaenge(welt, r.punkte, r.radius)) {
      // Offene Geschosse zeigen Innenwände nur bis 1.15 m; Wandhülsen der Deckenleitung würden sonst frei schweben.
      const g = welt.geschosse.find((g) => h.position[1] >= g.yUnten && h.position[1] < g.yUnten + g.hoehe);
      if (h.art === "wand" && g && h.position[1] - g.yUnten > 1.17) continue;
      if (h.position[1] <= yMax) huelsen.set(h.position.map((n) => n.toFixed(4)).join(":"), h);
    }
    return {
      rohre: ganz.flatMap((r) => rohrSchnitt(r.punkte, yMax - Math.max(r.radius, r.endRadius)).map((p) => ({
        ...r, punkte: p, frei: r.frei || p.at(-1)![1] === yMax - Math.max(r.radius, r.endRadius),
      }))),
      huelsen: [...huelsen.values()],
    };
  }, [welt, ganz, schnitt]);
  const flaechen = useMemo(() => {
    const gesehen = new Set<string>();
    return welt.symbole.filter((s) => FLAECHE.has(s.katalogId)).flatMap((s) => {
      const eigene = einheitVon(welt, s);
      const einheiten = s.versorgt.length ? welt.einheiten.filter((e) => s.versorgt.includes(e.id)) : eigene ? [eigene] : [];
      return einheiten.flatMap((e) => {
        const g = schnitt.geschosse.find((x) => x.id === e.geschossId);
        if (!g || gesehen.has(e.id)) return [];
        gesehen.add(e.id);
        return [{ geschossId: g.id, punkte: schlange(e.rechteck, g.yUnten + 0.032, 1.2, 0.6), daten: { ...anlagenDaten(s), einheitId: e.id } }];
      });
    });
  }, [welt, schnitt]);
  const sichtbar = darstellung?.sichtbar ?? schnitt.geschosse.map((g) => g.id);
  const kappen = useMemo(() => freieVerteilerAbgaenge(welt, katalog), [welt, katalog]);
  const getrennt = separiert || !!darstellung?.bewegung || sichtbar.length !== schnitt.geschosse.length;
  const rohre = useMemo(() => netz.rohre.flatMap((r) => rohrGeschosse(welt, r.punkte, sichtbar).map((t) => ({
    ...t, stueck: { ...r, punkte: t.punkte, frei: t.endeGetrennt ? getrennt : r.frei }, anfangFrei: getrennt && t.anfangGetrennt,
  }))), [netz, welt, sichtbar, getrennt]);
  const huelsenGeschoss = (h: Huelse) => h.art === "decke"
    ? [...welt.geschosse].sort((a, b) => Math.abs(a.yUnten - h.position[1]) - Math.abs(b.yUnten - h.position[1]))[0]?.id
    : geschossBeiY(welt, h.position[1]);
  return <group name="technik">
    {sichtbar.map((id) => <GeschossGruppe key={id} id={id} darstellung={darstellung}>
      <Anlagen3 symbole={symbole.filter((s) => geschossBeiY(welt, s.position.y) === id)} schatten={schatten} katalog={katalog} onModell={onModell} interaktion={interaktion} />
      {kappen.filter((k) => geschossBeiY(welt, k.symbol.position.y) === id).map((k, i) =>
        <VerteilerKappe key={`kappe-${i}`} {...k} interaktion={interaktion} schatten={schatten} />)}
      {rohre.filter((r) => r.geschossId === id).map((r, i) => <Rohr key={i} stueck={r.stueck} schatten={schatten} anfangFrei={r.anfangFrei} interaktion={interaktion} />)}
      {netz.huelsen.filter((h) => huelsenGeschoss(h) === id).map((h, i) => <Durchgang key={i} huelse={h} schatten={schatten} />)}
      {flaechen.filter((f) => f.geschossId === id).map((f) => <Flaechenband key={f.daten.einheitId} {...f} />)}
      {schatten && !darstellung?.bewegung && schnitt.fokus?.id === id && <Technikkontakte key={`${id}:${Object.keys(anschluesse).join(":")}`}
        welt={welt} y={schnitt.fokus.yUnten} />}
    </GeschossGruppe>)}
  </group>;
}

function VerteilerKappe({ symbol, position, interaktion, schatten }: { symbol: WeltSymbol; position: V3; interaktion?: Interaktion; schatten: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => { if (ref.current) ref.current.position.y = position[1] + (interaktion?.lift.current[symbol.schluessel] ?? 0); }, -1);
  return <mesh ref={ref} position={position} userData={anlagenDaten(symbol)} castShadow={schatten} receiveShadow={schatten}
    onClick={interaktion?.aktiv ? (e) => { if (e.delta <= 4) { e.stopPropagation(); interaktion.waehlen(symbol.schluessel); } } : undefined}>
    <cylinderGeometry args={[0.025, 0.025, 0.025, 12]} />
    <meshStandardMaterial color={TOKENS.farbe.grau2} {...TOKENS.material.metall} />
  </mesh>;
}

/** Umrisszuschlag einer hervorgehobenen Gruppenleitung [A], Meter. */
const ROHR_UMRISS = 0.012;
/** Übrige Leitungen treten bei hervorgehobener Gruppe zurück [A]: KOO-Rot stark zum hellen Grau gemischt. */
const ROHR_GEDIMMT = new THREE.Color(TOKENS.farbe.kooHeizung).lerp(new THREE.Color(TOKENS.farbe.grau1), 0.72).getStyle();

function Rohr({ stueck, schatten, anfangFrei = false, interaktion }: { stueck: Rohrstueck; schatten: boolean; anfangFrei?: boolean; interaktion?: Interaktion }) {
  const geometrie = useMemo(() => rohrGeometrie(stueck), [stueck]);
  useEffect(() => () => geometrie?.dispose(), [geometrie]);
  const gruppeId = stueck.daten.gruppeId;
  const aktiv = !!gruppeId && interaktion?.gruppe === gruppeId;
  const gedimmt = !!interaktion?.gruppe && !aktiv;
  const umriss = useMemo(() => aktiv ? rohrGeometrie({ ...stueck, radius: stueck.radius + ROHR_UMRISS,
    startRadius: stueck.startRadius + ROHR_UMRISS, endRadius: stueck.endRadius + ROHR_UMRISS }) : null, [aktiv, stueck]);
  useEffect(() => () => umriss?.dispose(), [umriss]);
  if (!geometrie) return null;
  const abschluesse = rohrAbschluesse(stueck.punkte);
  const ende = [...(anfangFrei ? abschluesse.slice(0, 1) : []), ...(stueck.frei ? abschluesse.slice(-1) : [])];
  const ereignisse = gruppeId && interaktion?.aktiv ? {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); interaktion.schweben(gruppeId); },
    onPointerOut: () => interaktion.schweben(null),
    onClick: (e: ThreeEvent<MouseEvent>) => { if (e.delta <= 4) { e.stopPropagation(); interaktion.waehlen(gruppeId); } },
  } : {};
  return <group userData={stueck.daten}>
    <mesh geometry={geometrie} userData={stueck.daten} castShadow={schatten} receiveShadow={schatten} {...ereignisse}>
      <meshStandardMaterial color={gedimmt ? ROHR_GEDIMMT : TOKENS.farbe.kooHeizung} {...TOKENS.material.leitung} />
    </mesh>
    {umriss && <mesh geometry={umriss} raycast={() => {}} userData={{ umriss: gruppeId }}>
      <meshBasicMaterial color={TOKENS.farbe.eisAkzent} side={THREE.BackSide} />
    </mesh>}
    {ende.map((a, i) => <mesh key={i} position={a.position} userData={{ ...stueck.daten, abschluss: true }}
      quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...a.richtung))}
      castShadow={schatten} receiveShadow={schatten}>
      <cylinderGeometry args={[stueck.radius * 1.18, stueck.radius * 1.18, stueck.radius * 0.6, 12]} />
      <meshStandardMaterial color={TOKENS.farbe.grau2} {...TOKENS.material.metall} />
    </mesh>)}
  </group>;
}

function Durchgang({ huelse: h, schatten }: { huelse: Huelse; schatten: boolean }) {
  const geometrie = useMemo(() => huelsenGeometrie(h.radius), [h.radius]);
  useEffect(() => () => geometrie.dispose(), [geometrie]);
  return <mesh geometry={geometrie} position={h.position} userData={{ durchgang: h.art }}
    quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...h.normale))}
    castShadow={schatten} receiveShadow={schatten}>
    <meshStandardMaterial color={TOKENS.farbe.grau2} {...TOKENS.material.metall} />
  </mesh>;
}

function Flaechenband({ punkte, daten }: { punkte: V3[]; daten: object }) {
  // PO 12.11.2026: Muster war unsichtbar → breiter und deutlich rötlicher, bleibt aber heller als die Rohre.
  const geometrie = useMemo(() => bandGeometrie(punkte, 0.06), [punkte]);
  const farbe = useMemo(() => new THREE.Color(TOKENS.farbe.flaecheSekundaer).lerp(new THREE.Color(TOKENS.farbe.kooHeizung), 0.32), []);
  useEffect(() => () => geometrie?.dispose(), [geometrie]);
  if (!geometrie) return null;
  return <mesh geometry={geometrie} userData={daten}>
    <meshBasicMaterial color={farbe} side={THREE.DoubleSide} />
  </mesh>;
}

/** Kontakte auf dem Geschossboden statt ausschliesslich auf dem Modellsockel; BasicShadowMap bleibt aktiv. */
function Technikkontakte({ welt, y }: { welt: Welt; y: number }) {
  const ref = useRef<ComponentRef<typeof AccumulativeShadows>>(null);
  const gruppe = useRef<THREE.Group>(null), ziel = useMemo(() => new THREE.Object3D(), []);
  const x0 = Math.min(...welt.grundriss.map((r) => r.x)), x1 = Math.max(...welt.grundriss.map((r) => r.x + r.breite));
  const z0 = Math.min(...welt.grundriss.map((r) => r.z)), z1 = Math.max(...welt.grundriss.map((r) => r.z + r.tiefe));
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  useLayoutEffect(() => { ref.current?.getMesh().scale.set(x1 - x0, z1 - z0, 1); }, [x0, x1, z0, z1]);
  useLayoutEffect(() => kontaktLichtZiel(gruppe.current, ziel), [ziel]);
  if (!welt.grundriss.length) return null;
  return <group ref={gruppe}><primitive object={ziel} position={[cx, y, cz]} />
  <AccumulativeShadows ref={ref} temporal frames={SCHATTEN.frames} position={[cx, y + 0.027, cz]}
    scale={1} resolution={2048} color={TOKENS.farbe.textSekundaer} opacity={TOKENS.licht.schattenDeckkraft} alphaTest={0.9}>
    <RandomizedLight amount={4} radius={0.7} ambient={0.15} position={[5, 12, 5]}
      size={Math.max(x1 - x0, z1 - z0) * 0.75} mapSize={SCHATTEN.kontaktMap} near={0.1} far={100} bias={0.0001} />
  </AccumulativeShadows></group>;
}
