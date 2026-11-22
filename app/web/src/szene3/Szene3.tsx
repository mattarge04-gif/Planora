import { AccumulativeShadows, Environment, Lightformer, OrbitControls, RandomizedLight, SoftShadows } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { EffectComposer, N8AO, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { TOKENS } from "../design/tokens";
import { huelle, type Bereich, type V3 } from "../szene2/huelle";
import type { KatalogEintrag, Welt } from "../typen";
import type { Befund } from "./router/typen";
import { Gebaeude3 } from "./Gebaeude3";
import { Kulisse3 } from "./Kulisse3";
import { ortBereich, einpassen, FIT_ANTEIL, freiraumMitte, zielKorrektur, type Freiraum, type SzenenZiel } from "./kamera";
import { kulisse } from "./kulisse";
import { geschossSchnitt, kameraSeiten, POLAR_GRENZEN } from "./schnitt";
import { Technik3 } from "./Technik3";
import { GeschossGruppe, useGeschossBewegung, useWenigerBewegung } from "./Bewegung";
import { gebaeudeBereich, separationsOffsets, sichtbareGeschosse } from "./darstellung";
import { InteraktionsBewegung, type BildschirmPunkt } from "./Interaktion";
import { geschossBeiY } from "../szene2/leitungen";
import { Kamera3 } from "./Kamera3";
import { FreiraumSchnitt } from "./FreiraumSchnitt";
import { HINTERGRUND, SCHATTEN, kontaktLichtZiel } from "./qualitaet";
import { TastaturKamera } from "./TastaturKamera";
import { NahKulisse } from "./NahKulisse";
import { modellVon } from "./technik";
import { anzeigeWelt, gruppenVerbindungen } from "./gruppenNetz";
import { instanzen, lageMasse } from "./Anlagen3";
import { ampelBereich } from "./ampelSockel";
import { Pegelband3 } from "./Pegelband3";
import { trefferBereich, type AmpelFilter } from "./ampelFilter";

export interface Szene3Props {
  welt: Welt; katalog: KatalogEintrag[]; fokusId: string | null; freiraum: Freiraum; reduziert: boolean;
  ausgeblendet?: string[]; separiert?: boolean; auswahl?: string | null;
  ziel?: SzenenZiel | null;
  tastatur?: boolean;
  onAuswahl?: (schluessel: string | null) => void; onHover?: (schluessel: string | null) => void;
  onAuswahlPunkt?: (punkt: BildschirmPunkt | null) => void;
  /** Befunde der automatischen Leitungsführung, wie gezeichnet (Twin-Hinweis). */
  onLeitungsBefunde?: (befunde: Befund[], weltHash: string) => void;
  /** Erneuerungsansicht: Schluessel -> Ampelfarbe; ohne Prop unveraendert. */
  ampel?: ReadonlyMap<string, string>;
  /** Klick aufs Pegelband (Modus Erneuerung): Geschossfokus. */
  onGeschoss?: (geschossId: string) => void;
  /** Hervorgehobenes Geschoss von aussen (z. B. Hover auf der Geschoss-Karte): Pegelband + hoverPx. */
  geschossHover?: string | null;
  /** Hover aufs Pegelband: Geschoss bzw. null (gegenseitige Hervorhebung mit der Geschoss-Karte). */
  onGeschossHover?: (geschossId: string | null) => void;
  /**
   * Legende als Filter (Modus Erneuerung, Stufe 3): Treffer voll mit Auswahlumriss, übrige Anlagen, Leitungen und
   * Manschetten zurück; graue Banderole an der Manschette für `anhaenger`; Pegelband nur `stufen` voll. Liegen Treffer im fokussierten Geschoss,
   * rahmt die Kamera sie. Ohne Prop bzw. null unverändert.
   */
  filter?: AmpelFilter | null;
  /**
   * Fokussierter Treffer im Filter (Symbol-Schlüssel, z. B. Hover/Fokus/Pfeiltasten in der Trefferliste): Umriss
   * fokusUmrissPx und Fläche eisAkzent; übrige Treffer umrissPx. 3D-Hover meldet den Schlüssel weiter über `onHover`.
   */
  filterFokus?: string | null;
  /** Fokusfahrt: true = Kamera fährt auf `filterFokus` (Tastatur/Klick in der Liste, nicht bei Maus-Hover). */
  filterFokusFahrt?: boolean;
}
const KEINE_GESCHOSSE: string[] = [];

/** Optionale Interaktions-Props lassen die bisherigen Aufrufer unverändert gültig. */
export function Szene3(props: Szene3Props) {
  return <Canvas className="szene" style={{ background: HINTERGRUND.css }} orthographic shadows={props.reduziert ? false : "basic"} dpr={[1, 1.5]} frameloop="always"
    gl={{ alpha: true, antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: TOKENS.licht.belichtung }}
    onCreated={({ gl }) => gl.setClearColor(HINTERGRUND.clearColor, HINTERGRUND.clearAlpha)}
    camera={{ near: 0.1, far: 1000 }} onPointerMissed={() => props.onAuswahl?.(null)}>
    <SzenenInhalt {...props} />
  </Canvas>;
}

function SzenenInhalt({ welt, katalog, fokusId, freiraum, reduziert, ausgeblendet = KEINE_GESCHOSSE, separiert = false,
  auswahl = null, ziel, tastatur = false, onAuswahl, onHover, onAuswahlPunkt, onLeitungsBefunde, ampel, onGeschoss, geschossHover = null, onGeschossHover, filter = null, filterFokus = null, filterFokusFahrt = false }: Szene3Props) {
  const h = useMemo(() => huelle(welt), [welt]);
  /** Darstellungslage der Anlagen (Verteiler mit Gruppen, Teile in der Leitung) für Kamera und Auswahlpunkt. */
  const anzeige = useMemo(() => anzeigeWelt(welt, katalog), [welt, katalog]);
  const [kameraRichtung, setKameraRichtung] = useState<V3>([1, 1, 1]);
  const controls = useRef<OrbitControlsImpl>(null);
  const [modellStand, setModellStand] = useState(0);
  const modelleGeladen = useCallback(() => setModellStand((s) => s + 1), []);
  const schnitt = useMemo(() => geschossSchnitt(welt, fokusId), [welt, fokusId]);
  const weniger = useWenigerBewegung();
  const hiddenKey = [...ausgeblendet].sort().join(":");
  const sichtbarIds = useMemo(() => sichtbareGeschosse(welt, fokusId, ausgeblendet), [welt, fokusId, hiddenKey]);
  const offsets = useMemo(() => separationsOffsets(welt, separiert), [welt, separiert]);
  const { aktuell, bewegung } = useGeschossBewegung(offsets, weniger, modelleGeladen);
  const darstellung = useMemo(() => ({ sichtbar: sichtbarIds, offsets, aktuell, bewegung }), [sichtbarIds, offsets, aktuell, bewegung]);
  const sichtbar = useMemo(() => {
    const b = gebaeudeBereich(welt, h.bereich, sichtbarIds, offsets);
    const dachId = schnitt.geschosse.at(-1)?.id;
    if (schnitt.dach && dachId && sichtbarIds.includes(dachId)) b.yMax += Math.max(0.4, (h.aufbau?.groesse[1] ?? 0) + 0.1);
    return b;
  }, [welt, h, schnitt, sichtbarIds, offsets]);
  const repKey = `${welt.hash}:${fokusId}:${hiddenKey}:${separiert}`;
  const schattenKey = `${repKey}:${kameraRichtung[0]}:${kameraRichtung[2]}:${modellStand}`;
  const [hover, setHover] = useState<string | null>(null);
  const hoverRef = useRef<string | null>(null);
  const hoverCallback = useRef(onHover);
  hoverCallback.current = onHover;
  const lift = useRef<Record<string, number>>({});
  const schweben = useCallback((key: string | null) => {
    if (hoverRef.current === key) return;
    hoverRef.current = key; setHover(key); hoverCallback.current?.(key);
  }, []);
  useEffect(() => () => { if (hoverRef.current) hoverCallback.current?.(null); }, []);
  const waehlen = useCallback((key: string | null) => onAuswahl?.(key), [onAuswahl]);
  // Heizgruppe unter dem Zeiger hat Vorrang vor der gewählten; hervorgehoben werden Rohr, Zubehör und Verbraucher.
  const straenge = useMemo(() => gruppenVerbindungen(anzeige, katalog), [anzeige, katalog]);
  const interaktion = useMemo(() => {
    const finde = (k: string | null) => (k ? straenge.find((s) => s.gruppeId === k) : undefined);
    const aktivGruppe = finde(hover) ?? finde(auswahl);
    return { auswahl, hover, lift, aktiv: !!onAuswahl || !!onHover || auswahl !== null, waehlen, schweben,
      gruppe: aktivGruppe?.gruppeId ?? null, betont: new Set(aktivGruppe ? [...aktivGruppe.zubehoer, ...aktivGruppe.verbraucher] : []),
      anker: finde(auswahl)?.verteiler ?? null,
      // Gerät gewählt (keine Gruppe): seine Gruppen bleiben, übrige Leitungen treten zurück.
      geraet: auswahl && !finde(auswahl) ? { schluessel: auswahl, gruppen: new Set(straenge.filter((s) => s.verteiler === auswahl
        || s.verbraucher.includes(auswahl) || s.zubehoer.includes(auswahl)).map((s) => s.gruppeId)) } : null };
  }, [auswahl, hover, onAuswahl, onHover, waehlen, schweben, straenge]);
  // Modus Erneuerung: Kamera rahmt beim Einschalten die dringendsten Anlagen der sichtbaren Geschosse.
  // Filter: liegen Treffer im fokussierten Geschoss, rahmt die Kamera genau diese (offenes Geschoss, nicht hinter Platte/Wand).
  const trefferKey = filter ? [...filter.treffer].sort().join("|") : "";
  const erneuerungBereich = useMemo(() => {
    if (!ampel) return null;
    const anlagen = instanzen(anzeige.symbole.filter((s) => ampel.has(s.schluessel)
      && sichtbarIds.includes(geschossBeiY(welt, s.position.y) ?? "")), katalog).map((i) => {
      const id = geschossBeiY(welt, i.s.position.y) ?? "", off = offsets[id] ?? 0;
      return { schluessel: i.s.schluessel, geschossId: id, mitte: [i.mitte[0], i.mitte[1] + off, i.mitte[2]] as V3, masse: lageMasse(i),
        inline: i.inline, farbe: ampel.get(i.s.schluessel)! };
    });
    // Fokusfahrt auf einen einzelnen Treffer (Liste per Tastatur/Klick), sonst alle Treffer des Geschosses.
    const einzeln = filter && filterFokusFahrt && filterFokus && filter.treffer.has(filterFokus)
      ? trefferBereich(anlagen, new Set([filterFokus]), TOKENS.erneuerung.filter.fokusMinM) : null;
    const treffer = filter && fokusId ? trefferBereich(anlagen.filter((a) => a.geschossId === fokusId), filter.treffer) : null;
    return einzeln ?? treffer ?? ampelBereich(anlagen);
  }, [ampel, anzeige, katalog, welt, sichtbarIds, offsets, fokusId, trefferKey, filterFokusFahrt ? filterFokus : null]); // eslint-disable-line react-hooks/exhaustive-deps
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const basisZoom = useMemo(() => einpassen(sichtbar, size.width, size.height, freiraum, FIT_ANTEIL, fokusId ? [1, 1.45, 1] : [1, 1, 1]).zoom,
    [sichtbar, size.width, size.height, freiraum, fokusId]);
  const auswahlBereich = useCallback((): Bereich | undefined => {
    const s = anzeige.symbole.find((s) => s.schluessel === auswahl), id = s ? geschossBeiY(welt, s.position.y) : null;
    if (!s || !id || !sichtbarIds.includes(id)) return undefined;
    const m = modellVon(s, katalog).masse, y = s.position.y + (aktuell.current[id] ?? 0) + (lift.current[s.schluessel] ?? 0);
    return { xMin: s.position.x - m[0] / 2, xMax: s.position.x + m[0] / 2, yMin: y, yMax: y + m[1], zMin: s.position.z - m[2] / 2, zMax: s.position.z + m[2] / 2 };
  }, [welt, anzeige, katalog, auswahl, sichtbarIds, aktuell]);
  useEffect(() => {
    const verlassen = () => schweben(null);
    gl.domElement.addEventListener("pointerleave", verlassen);
    return () => gl.domElement.removeEventListener("pointerleave", verlassen);
  }, [gl, schweben]);
  useEffect(() => {
    const s = welt.symbole.find((s) => s.schluessel === hoverRef.current);
    if (hoverRef.current && (!s || !sichtbarIds.includes(geschossBeiY(welt, s.position.y) ?? ""))) schweben(null);
  }, [welt, sichtbarIds, schweben]);
  const kameraGeaendert = () => {
    const c = controls.current;
    if (!c) return;
    // Geklemmt wird die Mitte der freien Flaeche, nicht das Ziel: einpassen verschiebt das Ziel bei einseitigen Karten (Assistent).
    const [dx, dy, dz] = zielKorrektur(freiraumMitte(c.object as THREE.OrthographicCamera, c.target, freiraum), sichtbar);
    if (dx || dy || dz) { c.target.add(new THREE.Vector3(dx, dy, dz)); c.object.position.add(new THREE.Vector3(dx, dy, dz)); }
    const richtung = c.object.position.clone().sub(c.target).toArray() as V3;
    setKameraRichtung((alt) => kameraSeiten(richtung, alt));
  };
  const durchsichtig = (o: THREE.Object3D) => o instanceof THREE.Mesh && (Array.isArray(o.material) ? o.material.every((m) => m.transparent) : o.material.transparent);
  return <>
    {!reduziert && <SoftShadows size={TOKENS.licht.schattenFilterTexel} samples={SCHATTEN.samples} />}
    <OrbitControls ref={controls} makeDefault enableDamping={!weniger} zoomToCursor={false} maxPolarAngle={POLAR_GRENZEN.max} minPolarAngle={POLAR_GRENZEN.min}
      onChange={kameraGeaendert} enablePan screenSpacePanning
      // Maus: links drehen, Mitte/rechts verschieben, Rad zoomen. Laptop: Shift + Ziehen verschiebt (OrbitControls-Standard).
      mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN }}
      touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }} />
    <Kamera3 welt={anzeige} fokusId={fokusId} bereich={sichtbar} freiraum={freiraum} repKey={repKey}
      auswahl={auswahl} ziel={ziel} darstellung={darstellung} weniger={weniger} erneuerung={erneuerungBereich}
      fahrtMs={filterFokusFahrt && filterFokus ? TOKENS.erneuerung.filter.fokusFahrtMs : undefined} />
    <TastaturKamera aktiv={tastatur} freiraum={freiraum} auswahlBereich={auswahlBereich} />
    <InteraktionsBewegung welt={anzeige} interaktion={interaktion} darstellung={darstellung} weniger={weniger} onAuswahlPunkt={onAuswahlPunkt} />
    <Licht bereich={sichtbar} reduziert={reduziert} />
    <group onClick={(e) => { if (e.delta <= 4 && !durchsichtig(e.object)) { e.stopPropagation(); waehlen(null); } }}
      onPointerOver={interaktion.aktiv ? (e) => { if (!durchsichtig(e.object)) { e.stopPropagation(); schweben(null); } } : undefined}>
      <FreiraumSchnitt freiraum={freiraum} nurUnten>
      <Gebaeude3 welt={welt} h={h} fokusId={fokusId} kameraRichtung={kameraRichtung} schatten={!reduziert} darstellung={darstellung} />
      <Technik3 welt={welt} katalog={katalog} fokusId={fokusId} schatten={!reduziert} onModelle={modelleGeladen}
        darstellung={darstellung} interaktion={interaktion} separiert={separiert} onBefunde={onLeitungsBefunde} ampel={ampel} filter={ampel ? filter : null} filterFokus={filterFokus} />
      {ampel && <Pegelband3 welt={welt} h={h} symbole={anzeige.symbole} ampel={ampel} fokusId={fokusId} filter={filter}
        kameraRichtung={kameraRichtung} darstellung={darstellung} effekte={!reduziert} basisZoom={basisZoom} weniger={weniger} onGeschoss={onGeschoss}
        geschossHover={geschossHover} onGeschossHover={onGeschossHover} />}
      {!auswahl && ziel && <Ortsmarke welt={welt} ziel={ziel} darstellung={darstellung} />}
      </FreiraumSchnitt>
      <NahKulisse basisZoom={basisZoom}><FreiraumSchnitt freiraum={freiraum}><Kulisse3 bereich={h.bereich} schatten={!reduziert} /></FreiraumSchnitt></NahKulisse>
    </group>
    {!reduziert && !bewegung && <NahKulisse basisZoom={basisZoom}><FreiraumSchnitt key={schattenKey} freiraum={freiraum}><Bodenschatten bereich={h.bereich} /></FreiraumSchnitt></NahKulisse>}
    {!reduziert && <EffectComposer multisampling={4} enableNormalPass={false}>
      <N8AO aoRadius={TOKENS.licht.aoRadiusM} intensity={TOKENS.licht.aoIntensitaet} distanceFalloff={1} color={TOKENS.farbe.textSekundaer} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
    </EffectComposer>}
  </>;
}

function Ortsmarke({ welt, ziel, darstellung }: { welt: Welt; ziel: SzenenZiel; darstellung: import("./Bewegung").Darstellung }) {
  const b = ortBereich(welt, ziel, {});
  if (!b || !darstellung.sichtbar.includes(ziel.geschossId)) return null;
  return <GeschossGruppe id={ziel.geschossId} darstellung={darstellung}>
    <mesh position={[(b.xMin + b.xMax) / 2, b.yMin + 0.045, (b.zMin + b.zMax) / 2]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => {}}>
      <torusGeometry args={[0.35, 0.035, 8, 32]} />
      <meshBasicMaterial color={TOKENS.farbe.eisAkzent} />
    </mesh>
  </GeschossGruppe>;
}


function sonnenPosition(): V3 {
  const azimut = THREE.MathUtils.degToRad(TOKENS.licht.sonneAzimutGrad);
  const hoehe = THREE.MathUtils.degToRad(TOKENS.licht.sonneHoeheGrad);
  return [Math.sin(azimut) * Math.cos(hoehe) * 60, Math.sin(hoehe) * 60, -Math.cos(azimut) * Math.cos(hoehe) * 60];
}

function Licht({ bereich, reduziert }: { bereich: Bereich; reduziert: boolean }) {
  const cx = (bereich.xMin + bereich.xMax) / 2, cz = (bereich.zMin + bereich.zMax) / 2;
  const ziel = useMemo(() => new THREE.Object3D(), []);
  const s = sonnenPosition();
  const r = Math.max(bereich.xMax - bereich.xMin, bereich.zMax - bereich.zMin) + 10;
  return <>
    <hemisphereLight color={TOKENS.farbe.flaeche} groundColor={TOKENS.farbe.grau2} intensity={TOKENS.licht.umgebungIntensitaet} />
    <primitive object={ziel} position={[cx, bereich.yMin, cz]} />
    <directionalLight position={[cx + s[0], bereich.yMin + s[1], cz + s[2]]} target={ziel}
      intensity={TOKENS.licht.sonneIntensitaet} castShadow={!reduziert} shadow-mapSize={[SCHATTEN.sonnenMap, SCHATTEN.sonnenMap]}
      shadow-intensity={TOKENS.licht.schattenDeckkraft}
      shadow-bias={-0.0001} shadow-normalBias={0.03}>
      <orthographicCamera attach="shadow-camera" args={[-r, r, r, -r, 1, 160]} />
    </directionalLight>
    <Environment resolution={128} frames={1} environmentIntensity={TOKENS.licht.umgebungIntensitaet}>
      <Lightformer form="rect" intensity={TOKENS.licht.umgebungIntensitaet} position={[cx, bereich.yMax + 20, cz]}
        rotation={[Math.PI / 2, 0, 0]} scale={[40, 40, 1]} color={TOKENS.farbe.flaeche} />
      <Lightformer form="rect" intensity={TOKENS.licht.umgebungIntensitaet * 0.7} position={[cx - 25, bereich.yMax + 8, cz]}
        rotation={[0, Math.PI / 2, 0]} scale={[30, 20, 1]} color={TOKENS.farbe.flaeche} />
      <Lightformer form="rect" intensity={TOKENS.licht.umgebungIntensitaet * 0.5} position={[cx + 20, bereich.yMax + 5, cz + 20]}
        rotation={[0, -Math.PI * 0.75, 0]} scale={[20, 16, 1]} color={TOKENS.farbe.eis} />
    </Environment>
  </>;
}

function Bodenschatten({ bereich }: { bereich: Bereich }) {
  const k = useMemo(() => kulisse(bereich), [bereich]);
  const s = sonnenPosition();
  const groesse = Math.max(k.platte.groesse[0], k.platte.groesse[2]);
  const gruppe = useRef<THREE.Group>(null), ziel = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => kontaktLichtZiel(gruppe.current, ziel), [ziel]);
  return <group ref={gruppe}><primitive object={ziel} position={[k.platte.mitte[0], bereich.yMin, k.platte.mitte[2]]} />
  <AccumulativeShadows temporal frames={SCHATTEN.frames} scale={groesse}
    position={[k.platte.mitte[0], bereich.yMin - 0.264, k.platte.mitte[2]]}
    color={TOKENS.farbe.textSekundaer} opacity={TOKENS.licht.schattenDeckkraft} alphaTest={0.85} resolution={SCHATTEN.bodenAufloesung}>
    <RandomizedLight amount={6} radius={TOKENS.licht.schattenRadiusM * 0.6} ambient={0.25} position={s}
      size={groesse * 0.75} mapSize={SCHATTEN.randomMap} near={1} far={160} bias={0.0003} />
  </AccumulativeShadows></group>;
}
