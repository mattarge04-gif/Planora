import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { TOKENS } from "../design/tokens";
import { geschossBeiY } from "../szene2/leitungen";
import type { Welt } from "../typen";
import type { Darstellung } from "./Bewegung";
import { modellFuer } from "./technik";
import { bildpunkt, type BildschirmPunkt } from "./kamera";
import { bewegungsAnteil } from "./darstellung";
export type { BildschirmPunkt } from "./kamera";

export interface Interaktion {
  auswahl: string | null; hover: string | null; aktiv: boolean;
  lift: RefObject<Record<string, number>>;
  waehlen: (key: string | null) => void; schweben: (key: string | null) => void;
}

export function InteraktionsBewegung({ welt, interaktion, darstellung, weniger, onAuswahlPunkt }: {
  welt: Welt; interaktion: Interaktion; darstellung: Darstellung; weniger: boolean;
  onAuswahlPunkt?: (punkt: BildschirmPunkt | null) => void;
}) {
  const { gl, camera, size } = useThree();
  const letzter = useRef<string | undefined>(undefined);
  const callback = useRef(onAuswahlPunkt);
  const anheben = useRef<Record<string, { von: number; ziel: number; ms: number }>>({});
  callback.current = onAuswahlPunkt;
  useEffect(() => { gl.domElement.style.cursor = interaktion.hover ? "pointer" : ""; return () => { gl.domElement.style.cursor = ""; }; }, [gl, interaktion.hover]);
  useEffect(() => () => { callback.current?.(null); }, []);
  useFrame((_, dt) => {
    for (const s of welt.symbole) {
      const ziel = interaktion.hover === s.schluessel || interaktion.auswahl === s.schluessel ? 0.04 : 0;
      const alt = interaktion.lift.current[s.schluessel] ?? 0;
      let stand = anheben.current[s.schluessel];
      if (!stand || stand.ziel !== ziel) stand = anheben.current[s.schluessel] = { von: alt, ziel, ms: 0 };
      stand.ms += dt * 1000;
      interaktion.lift.current[s.schluessel] = stand.von + (ziel - stand.von) * bewegungsAnteil(stand.ms, TOKENS.bewegung.hoverMs, weniger);
    }
  }, -2);
  useFrame(() => {
    if (!callback.current) { letzter.current = undefined; return; }
    const s = welt.symbole.find((s) => s.schluessel === interaktion.auswahl);
    const id = s ? geschossBeiY(welt, s.position.y) : null;
    let punkt: BildschirmPunkt | null = null;
    if (s && id && darstellung.sichtbar.includes(id)) {
      camera.updateMatrixWorld();
      punkt = bildpunkt(camera, size.width, size.height, new THREE.Vector3(s.position.x,
        s.position.y + modellFuer(s.katalogId).masse[1] / 2 + (darstellung.aktuell.current[id] ?? 0) + (interaktion.lift.current[s.schluessel] ?? 0), s.position.z));
    }
    const wert = JSON.stringify(punkt);
    if (wert !== letzter.current) { letzter.current = wert; callback.current(punkt); }
  });
  return null;
}
