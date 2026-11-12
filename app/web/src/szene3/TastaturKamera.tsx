import { useThree } from "@react-three/fiber";
import { useLayoutEffect } from "react";
import type { OrbitControls } from "three-stdlib";
import { TOKENS } from "../design/tokens";
import { tastaturSchritt } from "./kamera";


export function TastaturKamera({ aktiv }: { aktiv: boolean }) {
  const { gl, camera, controls: raw } = useThree();
  const controls = raw as unknown as OrbitControls | null;
  useLayoutEffect(() => {
    if (!aktiv || !controls) return;
    const el = gl.domElement, vorher = { tab: el.getAttribute("tabindex"), label: el.getAttribute("aria-label"), keys: el.getAttribute("aria-keyshortcuts"), outline: el.style.outline, offset: el.style.outlineOffset };
    el.tabIndex = 0;
    el.setAttribute("aria-label", "Gebäudemodell: Pfeiltasten drehen, Plus und Minus vergrössern und verkleinern");
    el.setAttribute("aria-keyshortcuts", "ArrowLeft ArrowRight ArrowUp ArrowDown + -");
    const fokus = () => { if (el.matches(":focus-visible")) { el.style.outline = `2px solid ${TOKENS.farbe.eisAkzent}`; el.style.outlineOffset = "-2px"; } };
    const verlassen = () => { el.style.outline = vorher.outline; el.style.outlineOffset = vorher.offset; };
    const zeiger = () => el.focus({ preventScroll: true });
    const taste = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const schritt = tastaturSchritt(e.key, controls.getAzimuthalAngle(), controls.getPolarAngle(), camera.zoom);
      if (!schritt) return;
      e.preventDefault(); e.stopPropagation(); controls.dispatchEvent({ type: "start", target: controls });
      const damping = controls.enableDamping; controls.enableDamping = false;
      controls.setAzimuthalAngle(schritt.azimut); controls.setPolarAngle(schritt.polar);
      camera.zoom = Math.max(controls.minZoom, Math.min(controls.maxZoom, schritt.zoom)); camera.updateProjectionMatrix();
      controls.update(); controls.enableDamping = damping; fokus();
    };
    el.addEventListener("keydown", taste); el.addEventListener("pointerdown", zeiger); el.addEventListener("focus", fokus); el.addEventListener("blur", verlassen);
    return () => {
      el.removeEventListener("keydown", taste); el.removeEventListener("pointerdown", zeiger); el.removeEventListener("focus", fokus); el.removeEventListener("blur", verlassen);
      for (const [name, wert] of [["tabindex", vorher.tab], ["aria-label", vorher.label], ["aria-keyshortcuts", vorher.keys]]) if (wert === null) el.removeAttribute(name!); else el.setAttribute(name!, wert!);
      verlassen();
    };
  }, [aktiv, controls, gl, camera]);
  return null;
}
