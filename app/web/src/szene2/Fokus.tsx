import { useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { KatalogEintrag, Welt } from "../typen";
import { BauteilForm } from "./bauteile";
import { ROHR } from "./farben";
import { imRechteck, type V3 } from "./huelle";
import { BODEN, geschossBeiY, leitungen, schlange, type Leitung } from "./leitungen";
import type { Materialien } from "./materialien";
import { BodenSchrift } from "./schrift";

interface Props {
  welt: Welt; katalog: KatalogEintrag[]; fokusId: string; auswahl: string | null;
  onAuswahl: (s: string | null) => void; mat: Materialien;
}
const FLAECHE = new Set(["heizung.fbh_kreis", "heizung.tabs_feld"]);
const TRENNWAND = 1, TRENNDICKE = 0.1;

export function FokusInhalt({ welt, katalog, fokusId, auswahl, onAuswahl, mat }: Props) {
  const g = welt.geschosse.find((x) => x.id === fokusId);
  const alle = useMemo(() => leitungen(welt, katalog), [welt, katalog]);
  if (!g) return null;
  const einheiten = welt.einheiten.filter((e) => e.geschossId === fokusId);
  const symbole = welt.symbole.filter((s) => geschossBeiY(welt, s.position.y) === fokusId);
  const sichtbar = alle.filter((l) => l.geschossIds.includes(fokusId));
  const betrifft = (l: Leitung) => !!auswahl && (l.von === auswahl || l.nach === auswahl);
  return (
    <group>
      {einheiten.map((e, i) => {
        const r = e.rechteck, y = g.yUnten;
        const wand = (mitte: V3, groesse: V3, k: string) => (
          <mesh key={k} position={mitte} material={mat.trennwand} castShadow receiveShadow><boxGeometry args={groesse} /></mesh>
        );
        return (
          <group key={e.id}>
            <mesh position={[r.x + r.breite / 2, y + 0.01, r.z + r.tiefe / 2]} rotation={[-Math.PI / 2, 0, 0]} material={mat.boden[i % mat.boden.length]} receiveShadow>
              <planeGeometry args={[r.breite, r.tiefe]} />
            </mesh>
            {wand([r.x + r.breite / 2, y + TRENNWAND / 2, r.z], [r.breite, TRENNWAND, TRENNDICKE], "s")}
            {wand([r.x + r.breite / 2, y + TRENNWAND / 2, r.z + r.tiefe], [r.breite, TRENNWAND, TRENNDICKE], "n")}
            {wand([r.x, y + TRENNWAND / 2, r.z + r.tiefe / 2], [TRENNDICKE, TRENNWAND, r.tiefe], "w")}
            {wand([r.x + r.breite, y + TRENNWAND / 2, r.z + r.tiefe / 2], [TRENNDICKE, TRENNWAND, r.tiefe], "o")}
            <BodenSchrift text={e.bezeichnung} position={[r.x + r.breite / 2, y + 0.03, r.z + r.tiefe - 1.2]} breite={Math.min(6, r.breite * 0.8)} />
          </group>
        );
      })}
      {symbole.filter((s) => FLAECHE.has(s.katalogId)).map((s) => {
        const e = einheiten.find((x) => imRechteck(x.rechteck, s.position.x, s.position.z));
        return e ? <Linienzug key={`f${s.schluessel}`} punkte={schlange(e.rechteck, g.yUnten + 0.02)} m={mat.flaeche} /> : null;
      })}
      {sichtbar.map((l, i) => (
        <Rohr key={`l${i}`} punkte={l.punkte} radius={l.art === "haupt" ? ROHR.haupt : ROHR.verteil}
          m={!auswahl ? mat.leitung : betrifft(l) ? mat.leitungAktiv : mat.leitungBlass} />
      ))}
      {symbole.map((s) => (
        <Bauteil key={s.schluessel} schluessel={s.schluessel} position={[s.position.x, s.position.y + BODEN, s.position.z]} katalogId={s.katalogId}
          m={s.schluessel === auswahl ? mat.geraetAuswahl : s.status === "vorgeschlagen" ? mat.geraetVorschlag : mat.geraet} onAuswahl={onAuswahl} />
      ))}
    </group>
  );
}

function Bauteil({ schluessel, position, katalogId, m, onAuswahl }: {
  schluessel: string; position: V3; katalogId: string; m: THREE.Material; onAuswahl: (s: string) => void;
}) {
  const { gl } = useThree();
  return (
    <group position={position}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onAuswahl(schluessel); }}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); gl.domElement.style.cursor = "pointer"; }}
      onPointerOut={() => { gl.domElement.style.cursor = ""; }}>
      <BauteilForm katalogId={katalogId} m={m} />
    </group>
  );
}

function Rohr({ punkte, radius, m }: { punkte: V3[]; radius: number; m: THREE.Material }) {
  const geo = useMemo(() => {
    if (punkte.length < 2) return new THREE.BufferGeometry();
    const pfad = new THREE.CurvePath<THREE.Vector3>();
    for (let i = 1; i < punkte.length; i++) pfad.add(new THREE.LineCurve3(new THREE.Vector3(...punkte[i - 1]), new THREE.Vector3(...punkte[i])));
    return new THREE.TubeGeometry(pfad, Math.max(8, (punkte.length - 1) * 8), radius, 10, false);
  }, [punkte, radius]);
  useEffect(() => () => geo.dispose(), [geo]);
  if (punkte.length < 2) return null;
  return <mesh geometry={geo} material={m} />;
}

function Linienzug({ punkte, m }: { punkte: V3[]; m: THREE.Material }) {
  const linie = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints(punkte.map((p) => new THREE.Vector3(...p)));
    return new THREE.Line(geo, m);
  }, [punkte, m]);
  useEffect(() => () => linie.geometry.dispose(), [linie]);
  return <primitive object={linie} />;
}
