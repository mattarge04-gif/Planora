import { TOKENS } from "../design/tokens";
import { DirectionalLight, type Object3D } from "three";

/** [A] Lokale 3D-Arbeitswerte; Tokens bleiben in der Hoheit des UI-Designers. Kein VSM. */
export const SCHATTEN = {
  frames: Math.max(128, TOKENS.licht.schattenFrames), samples: Math.max(24, TOKENS.licht.schattenSamples),
  sonnenMap: 2048, kontaktMap: 2048, bodenAufloesung: 2048, randomMap: 1024,
};
/** Transparenter, schwarz gelöschter Puffer lässt den CSS-Grund unverändert durch beide Renderingketten scheinen. */
export const HINTERGRUND = { css: TOKENS.farbe.grund, clearColor: 0x000000, clearAlpha: 0 } as const;

/** AccumulativeShadows überspringt seine Lichtgruppe in traverse(); children werden deshalb explizit besucht. */
export function kontaktLichtZiel(root: Object3D | null, ziel: Object3D): void {
  if (!root) return;
  const offen = [root];
  while (offen.length) {
    const o = offen.pop()!;
    if (o instanceof DirectionalLight) { o.target = ziel; o.shadow.needsUpdate = true; }
    offen.push(...o.children);
  }
}
