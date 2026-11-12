import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import type * as THREE from "three";
import { TOKENS } from "../design/tokens";
import { bewegungsAnteil } from "./darstellung";

export interface Darstellung {
  sichtbar: readonly string[]; offsets: Record<string, number>; aktuell: RefObject<Record<string, number>>;
  bewegung: boolean;
}
export function useWenigerBewegung() {
  const [weniger, setWeniger] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)"), neu = () => setWeniger(media.matches);
    media.addEventListener("change", neu); return () => media.removeEventListener("change", neu);
  }, []);
  return weniger;
}

export function useGeschossBewegung(offsets: Record<string, number>, weniger: boolean, onRuhe: () => void) {
  const aktuell = useRef<Record<string, number>>({});
  const [bewegung, setBewegung] = useState(false);
  const laeuft = useRef(false);
  const anfang = useRef<Record<string, number>>({});
  const zeit = useRef(0);
  useLayoutEffect(() => {
    const neu = Object.keys(offsets).some((id) => Math.abs((aktuell.current[id] ?? 0) - offsets[id]) > 1e-5);
    anfang.current = { ...aktuell.current }; zeit.current = 0;
    if (weniger) { aktuell.current = { ...offsets }; laeuft.current = false; setBewegung(false); }
    else { laeuft.current = neu; setBewegung(neu); }
  }, [offsets, weniger]);
  useFrame((_, dt) => {
    if (!laeuft.current) return;
    zeit.current += dt * 1000;
    const alpha = bewegungsAnteil(zeit.current, TOKENS.bewegung.separierenMs);
    for (const id of Object.keys(offsets)) {
      const alt = anfang.current[id] ?? 0;
      aktuell.current[id] = alt + (offsets[id] - alt) * alpha;
    }
    if (alpha === 1) { laeuft.current = false; setBewegung(false); onRuhe(); }
  }, -3);
  return { aktuell, bewegung };
}

export function GeschossGruppe({ id, darstellung, children }: { id: string; darstellung?: Darstellung; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const setzen = () => { if (ref.current) ref.current.position.y = darstellung?.aktuell.current[id] ?? 0; };
  useLayoutEffect(setzen, [id, darstellung]);
  useFrame(setzen, -1);
  if (darstellung && !darstellung.sichtbar.includes(id)) return null;
  return <group ref={ref} visible={!darstellung || darstellung.sichtbar.includes(id)}>{children}</group>;
}
