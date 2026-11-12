import { useThree } from "@react-three/fiber";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { freiraumScissor, type Freiraum } from "./kamera";

/** [A] Unten verdeckt die Tabellenkarte den Schnitt an ihrer Oberkante; seitlich/oben bleiben 12 CSS-px Abstand. */
export function FreiraumSchnitt({ freiraum, children }: { freiraum: Freiraum; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const { size } = useThree();
  useLayoutEffect(() => {
    const aufraeumen: (() => void)[] = [];
    ref.current?.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const vorher = o.onBeforeRender, nachher = o.onAfterRender, original = o.material;
      let stand: { rect: THREE.Vector4; aktiv: boolean } | null = null;
      o.onBeforeRender = function (...args) {
        vorher.apply(this, args);
        const [renderer, , , , material] = args;
        // Progressive LightMap und Schattenpass ersetzen das Material; deren Texturen bleiben unbeschnitten.
        if (Array.isArray(original) ? !original.includes(material) : material !== original) return;
        stand = { rect: renderer.getScissor(new THREE.Vector4()), aktiv: renderer.getScissorTest() };
        const target = renderer.getRenderTarget();
        // Der Hauptpuffer multipliziert selbst mit DPR; RenderTargets erwarten hingegen physische Pixel.
        const faktor = target ? target.width / size.width : 1;
        renderer.setScissor(...freiraumScissor(size.width, size.height, freiraum, faktor)); renderer.setScissorTest(true);
      };
      o.onAfterRender = function (...args) {
        if (stand) { args[0].setScissor(stand.rect); args[0].setScissorTest(stand.aktiv); stand = null; }
        nachher.apply(this, args);
      };
      aufraeumen.push(() => { o.onBeforeRender = vorher; o.onAfterRender = nachher; });
    });
    return () => aufraeumen.forEach((f) => f());
  }, [freiraum, size.width, size.height]);
  return <group ref={ref}>{children}</group>;
}
