import { bewegungsAnteil } from "./darstellung";
import type { Einpassung } from "./kamera";
import type { V3 } from "../szene2/huelle";

export interface Kamerafahrt { von: Einpassung; nach: Einpassung; ms: number }
export function rueckkehrAnsicht(gespeichert: Einpassung | null, normal: Einpassung, gleicherKontext: boolean): Einpassung {
  return gleicherKontext && gespeichert ? gespeichert : normal;
}
export function fahrtSchritt(fahrt: Kamerafahrt, dtMs: number, dauerMs: number, weniger = false): { ansicht: Einpassung; rest: Kamerafahrt | null } {
  const ms = fahrt.ms + dtMs, t = bewegungsAnteil(ms, dauerMs, weniger);
  const punkt = (a: V3, b: V3): V3 => a.map((v, i) => v + (b[i] - v) * t) as V3;
  return { ansicht: { position: punkt(fahrt.von.position, fahrt.nach.position), ziel: punkt(fahrt.von.ziel, fahrt.nach.ziel),
    zoom: fahrt.von.zoom + (fahrt.nach.zoom - fahrt.von.zoom) * t }, rest: t === 1 ? null : { ...fahrt, ms } };
}

/** Capture läuft vor OrbitControls: dessen Mausrad-Zoom wird danach nicht durch die Fahrt überschrieben. */
export function kameraEingaben(element: EventTarget, abbrechen: () => void): () => void {
  const events = ["wheel", "pointerdown", "touchstart", "keydown"];
  for (const typ of events) element.addEventListener(typ, abbrechen, { capture: true, passive: true });
  return () => { for (const typ of events) element.removeEventListener(typ, abbrechen, { capture: true }); };
}
