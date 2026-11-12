import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { freiraumScissor, type Freiraum } from "./kamera";

/** Auch nachgeladenes GLB, Instanzen und neu erzeugte Rohre erhalten den Schnitt vor ihrem ersten Bild. */
export function FreiraumSchnitt({ freiraum, children, nurUnten = false }: { freiraum: Freiraum; children: ReactNode; nurUnten?: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const { size } = useThree();
  const aktuell = useRef({ freiraum, size, nurUnten });
  aktuell.current = { freiraum, size, nurUnten };
  const verwaltet = useRef(new Map<THREE.Mesh, { aktualisieren: () => void; aufraeumen: () => void }>());
  const sammeln = () => {
    const gefunden = new Set<THREE.Mesh>();
    ref.current?.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      gefunden.add(o);
      const vorhanden = verwaltet.current.get(o);
      if (vorhanden) { vorhanden.aktualisieren(); return; }
      const vorher = o.onBeforeRender, nachher = o.onAfterRender;
      let original = o.material;
      let stand: { rect: THREE.Vector4; aktiv: boolean } | null = null;
      const before: THREE.Mesh["onBeforeRender"] = function (...args) {
        vorher.apply(o, args);
        const [renderer, , , , material] = args;
        // LightMap- und Schattenmaterialien werden nicht beschnitten.
        if (Array.isArray(original) ? !original.includes(material) : material !== original) return;
        stand = { rect: renderer.getScissor(new THREE.Vector4()), aktiv: renderer.getScissorTest() };
        const { freiraum: f, size: s, nurUnten: unten } = aktuell.current;
        const target = renderer.getRenderTarget(), faktor = target ? target.width / s.width : 1;
        const bereich = unten ? { links: 0, rechts: 0, oben: 0, unten: f.unten } : f;
        renderer.setScissor(...freiraumScissor(s.width, s.height, bereich, faktor, unten ? 0 : 12));
        renderer.setScissorTest(true);
      };
      const after: THREE.Mesh["onAfterRender"] = function (...args) {
        if (stand) { args[0].setScissor(stand.rect); args[0].setScissorTest(stand.aktiv); stand = null; }
        nachher.apply(o, args);
      };
      o.onBeforeRender = before; o.onAfterRender = after;
      verwaltet.current.set(o, { aktualisieren: () => { original = o.material; },
        aufraeumen: () => { if (o.onBeforeRender === before) o.onBeforeRender = vorher; if (o.onAfterRender === after) o.onAfterRender = nachher; } });
    });
    for (const [o, eintrag] of verwaltet.current) if (!gefunden.has(o)) { eintrag.aufraeumen(); verwaltet.current.delete(o); }
  };
  useLayoutEffect(() => { sammeln(); return () => { verwaltet.current.forEach((e) => e.aufraeumen()); verwaltet.current.clear(); }; }, []);
  useFrame(sammeln, -0.5);
  return <group ref={ref}>{children}</group>;
}
