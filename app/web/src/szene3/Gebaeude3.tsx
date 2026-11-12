import { RoundedBox } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { TOKENS } from "../design/tokens";
import { type Huelle, type Quader, type V3 } from "../szene2/huelle";
import type { Welt } from "../typen";
import { fensterAnWand, innenwaende, wandteile } from "./geometrie";
import { Glasinstanzen, Quaderinstanzen } from "./Instanzen";
import { rahmenFuer } from "./rahmen";
import { geschossSchnitt, wandBleibt } from "./schnitt";
import { GeschossGruppe, type Darstellung } from "./Bewegung";

const PLATTE = 0.25;

function materialien() {
  const F = TOKENS.farbe, M = TOKENS.material;
  const matt = (color: string) => new THREE.MeshStandardMaterial({ color, ...M.bauteil });
  return {
    wand: matt(F.flaeche), stirn: matt(F.grau1), boden: matt(F.flaecheSekundaer),
    bodenAlternativ: matt(F.grau1), technik: matt(F.eis), dach: matt(F.flaecheSekundaer),
    metall: new THREE.MeshStandardMaterial({ color: F.grau2, ...M.metall }),
    rahmen: new THREE.MeshStandardMaterial({ color: F.grau1, ...M.geraet }),
    glas: new THREE.MeshPhysicalMaterial({ color: F.eis, roughness: M.glas.roughness, metalness: M.glas.metalness,
      opacity: M.glas.deckkraft, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
  };
}

/** Datengetriebene, plastische Architektur; der Geschossschnitt verändert ausschliesslich Sichtbarkeit. */
export function Gebaeude3({ welt, h, fokusId, kameraRichtung, schatten, darstellung }: {
  welt: Welt; h: Huelle; fokusId: string | null; kameraRichtung: V3; schatten: boolean; darstellung?: Darstellung;
}) {
  const m = useMemo(materialien, []);
  useEffect(() => () => Object.values(m).forEach((x) => x.dispose()), [m]);
  const schnitt = useMemo(() => geschossSchnitt(welt, fokusId), [welt, fokusId]);
  const geschosse = useMemo(() => schnitt.geschosse.map((g) => {
    const huelle = h.geschosse.find((x) => x.geschossId === g.id)!;
    const waende = h.waende.filter((w) => wandBleibt(w.normale, g.offen, kameraRichtung));
    const fenster = huelle.fenster.filter((f) => waende.some((w) => fensterAnWand(f, w)));
    const rahmen = fenster.flatMap((f) => rahmenFuer(f));
    // Vorstehende Fensterbänke erzeugen kleine, glaubwürdige Laibungsschatten.
    const baenke: Quader[] = fenster.map((f) => ({
      mitte: [f.mitte[0], f.mitte[1] - f.hoehe / 2 - 0.045, f.mitte[2]],
      groesse: Math.abs(Math.sin(f.drehungY)) < 0.5 ? [f.breite + 0.16, 0.07, 0.22] : [0.22, 0.07, f.breite + 0.16],
    }));
    return { ...g, fenster, rahmen, baenke,
      waende: waende.flatMap((w) => wandteile(w, g.yUnten, g.hoehe - PLATTE, huelle.fenster)),
      innen: g.offen ? innenwaende(welt, g.id, g.yUnten + 0.02, Math.min(1.15, g.hoehe - PLATTE)) : [],
    };
  }), [schnitt, h, welt, kameraRichtung]);
  const gitter = useMemo(() => {
    if (!h.aufbau) return [];
    const a = h.aufbau;
    return Array.from({ length: 9 }, (_, i): Quader => ({
      mitte: [a.mitte[0], a.mitte[1] - a.groesse[1] * 0.25 + i * a.groesse[1] * 0.065, a.mitte[2] + a.groesse[2] / 2 + 0.035],
      groesse: [a.groesse[0] * 0.78, 0.045, 0.12],
    }));
  }, [h.aufbau]);
  return <group>
    {geschosse.map((g) => <GeschossGruppe key={g.id} id={g.id} darstellung={darstellung}>
      {h.grundriss.map((r, i) => <RoundedBox key={i} args={[r.breite + 0.3, PLATTE, r.tiefe + 0.3]}
        radius={TOKENS.radius.platteM} smoothness={3} position={[r.x + r.breite / 2, g.yUnten - PLATTE / 2, r.z + r.tiefe / 2]}
        material={m.stirn} castShadow={schatten} receiveShadow />)}
      {g.offen && welt.einheiten.filter((e) => e.geschossId === g.id).map((e, i) => <mesh key={e.id}
        position={[e.rechteck.x + e.rechteck.breite / 2, g.yUnten + 0.012, e.rechteck.z + e.rechteck.tiefe / 2]}
        material={e.art === "technik" ? m.technik : i % 2 ? m.boden : m.bodenAlternativ} receiveShadow>
        <boxGeometry args={[Math.max(0.01, e.rechteck.breite - 0.06), 0.025, Math.max(0.01, e.rechteck.tiefe - 0.06)]} />
      </mesh>)}
      <Quaderinstanzen teile={g.waende} material={m.wand} schatten={schatten} />
      <Quaderinstanzen teile={g.innen} material={m.wand} schatten={schatten} />
      <Quaderinstanzen teile={g.rahmen} material={m.rahmen} schatten={schatten} />
      <Quaderinstanzen teile={g.baenke} material={m.wand} schatten={schatten} />
      <Glasinstanzen fenster={g.fenster} material={m.glas} />
    </GeschossGruppe>)}
    {schnitt.dach && <GeschossGruppe id={schnitt.geschosse.at(-1)!.id} darstellung={darstellung}>
      {h.grundriss.map((r, i) => <RoundedBox key={i} args={[r.breite + 0.3, PLATTE, r.tiefe + 0.3]}
        radius={TOKENS.radius.platteM} smoothness={3} position={[r.x + r.breite / 2, h.bereich.yMax - PLATTE / 2, r.z + r.tiefe / 2]}
        material={m.dach} castShadow={schatten} receiveShadow />)}
      {h.attika.map((q, i) => <RoundedBox key={i} args={q.groesse} radius={TOKENS.radius.platteM} smoothness={3}
        position={q.mitte} material={m.wand} castShadow={schatten} receiveShadow />)}
      {h.aufbau && <group>
        <RoundedBox args={h.aufbau.groesse} position={h.aufbau.mitte} radius={TOKENS.radius.platteM} smoothness={3}
          material={m.stirn} castShadow={schatten} receiveShadow />
        <Quaderinstanzen teile={gitter} material={m.metall} schatten={schatten} />
        <mesh position={[h.aufbau.mitte[0], h.aufbau.mitte[1] + h.aufbau.groesse[1] / 2 + 0.045, h.aufbau.mitte[2]]}
          material={m.rahmen} castShadow={schatten} receiveShadow>
          <boxGeometry args={[h.aufbau.groesse[0] + 0.15, 0.09, h.aufbau.groesse[2] + 0.15]} />
        </mesh>
      </group>}
    </GeschossGruppe>}
  </group>;
}
