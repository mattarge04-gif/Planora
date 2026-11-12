import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls } from "three-stdlib";
import { TOKENS } from "../design/tokens";
import type { Bereich, V3 } from "../szene2/huelle";
import { geschossBeiY } from "../szene2/leitungen";
import type { Welt } from "../typen";
import type { Darstellung } from "./Bewegung";
import { anlageEinpassen, einpassen, FIT_ANTEIL, ortBereich, type Einpassung, type Freiraum, type SzenenZiel } from "./kamera";
import { fahrtSchritt, kameraEingaben, rueckkehrAnsicht, type Kamerafahrt } from "./kameraFahrt";
import { modellVon } from "./technik";

export function Kamera3({ welt, fokusId, bereich, freiraum, repKey, auswahl, ziel, darstellung, weniger }: {
  welt: Welt; fokusId: string | null; bereich: Bereich; freiraum: Freiraum; repKey: string; auswahl: string | null;
  ziel?: SzenenZiel | null; darstellung: Darstellung; weniger: boolean;
}) {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  const size = useThree((s) => s.size);
  const controls = useThree((s) => s.controls) as unknown as OrbitControls | null;
  const fahrt = useRef<Kamerafahrt | null>(null);
  const rueckfahrt = useRef<Einpassung | null>(null);
  const benutzer = useRef(false);
  const stand = useRef<{ rep: string; navigation: string; format: string } | null>(null);
  const navigation = auswahl ? `anlage:${auswahl}` : ziel ? `ort:${JSON.stringify(ziel)}` : "";
  const format = JSON.stringify([size.width, size.height, freiraum]);
  const snapshot = useCallback((): Einpassung => ({ position: camera.position.toArray() as V3,
    ziel: controls!.target.toArray() as V3, zoom: camera.zoom }), [camera, controls]);
  const anwenden = useCallback((e: Einpassung) => {
    if (!controls) return;
    camera.position.set(...e.position); controls.target.set(...e.ziel); camera.zoom = e.zoom;
    camera.lookAt(...e.ziel); camera.updateProjectionMatrix(); controls.update(); camera.updateMatrixWorld();
  }, [camera, controls]);
  useLayoutEffect(() => {
    if (!controls?.domElement) return;
    const abbrechen = () => { benutzer.current = true; fahrt.current = null; };
    const entfernen = kameraEingaben(controls.domElement, abbrechen);
    controls.addEventListener("start", abbrechen);
    return () => { entfernen(); controls.removeEventListener("start", abbrechen); };
  }, [controls]);
  useLayoutEffect(() => {
    if (!controls || !size.width || !size.height) return;
    const vorher = stand.current;
    const repNeu = vorher?.rep !== repKey, navigationNeu = vorher?.navigation !== navigation, formatNeu = vorher?.format !== format;
    if (benutzer.current && !repNeu && !navigationNeu) return;
    const richtung: V3 = fokusId ? [1, 1.45, 1] : [1, 1, 1];
    const normal = einpassen(bereich, size.width, size.height, freiraum, FIT_ANTEIL, richtung);
    let nach = normal;
    if (navigation) {
      // [A] Rückkehr zur bisherigen Geschossansicht; bei Geschoss-/Layoutwechsel zur neu eingepassten Geschossansicht.
      if (!rueckfahrt.current || repNeu || formatNeu) rueckfahrt.current = !vorher || repNeu || formatNeu ? normal : fahrt.current?.nach ?? snapshot();
      const s = welt.symbole.find((s) => s.schluessel === auswahl), id = s ? geschossBeiY(welt, s.position.y) : null;
      if (s && id && darstellung.sichtbar.includes(id)) {
        const m = modellVon(s).masse, y = s.position.y + (darstellung.offsets[id] ?? 0);
        nach = anlageEinpassen({ xMin: s.position.x - m[0] / 2, xMax: s.position.x + m[0] / 2,
          yMin: y, yMax: y + m[1] + 0.04, zMin: s.position.z - m[2] / 2, zMax: s.position.z + m[2] / 2 },
        size.width, size.height, freiraum, richtung);
      } else if (!auswahl && ziel && darstellung.sichtbar.includes(ziel.geschossId)) {
        const b = ortBereich(welt, ziel, darstellung.offsets);
        if (b) nach = einpassen(b, size.width, size.height, freiraum, FIT_ANTEIL, richtung);
      }
    } else {
      if (vorher?.navigation) nach = rueckkehrAnsicht(rueckfahrt.current, normal, !repNeu && !formatNeu);
      rueckfahrt.current = null;
    }
    stand.current = { rep: repKey, navigation, format }; benutzer.current = false;
    if (!vorher || weniger) { fahrt.current = null; anwenden(nach); }
    else fahrt.current = { von: snapshot(), nach, ms: 0 };
  }, [controls, camera, welt, fokusId, bereich, format, repKey, navigation, weniger, anwenden, snapshot, darstellung.offsets, darstellung.sichtbar]);
  useFrame((_, dt) => {
    if (!fahrt.current) return;
    const schritt = fahrtSchritt(fahrt.current, dt * 1000, TOKENS.bewegung.kameraMs, weniger);
    fahrt.current = schritt.rest; anwenden(schritt.ansicht);
  });
  return null;
}
