import * as THREE from "three";
import { FASSADE, GEWERK } from "./farben";

const std = (farbe: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color: farbe, roughness: 0.85, metalness: 0, ...extra });

/** Gemeinsame Materialien; Stimmung aendert umgebung/platte/leitung zur Laufzeit. */
export function erzeugeMaterialien() {
  const rot = GEWERK.heizung;
  return {
    wand: std(FASSADE.wand),
    umgebung: std(FASSADE.wand),
    platte: std(FASSADE.platte, { roughness: 1 }),
    band: std(FASSADE.band, { roughness: 0.6 }),
    dach: std(FASSADE.platte, { roughness: 0.9 }),
    fenster: std(FASSADE.fenster, { roughness: 0.15, metalness: 0.35, envMapIntensity: 1.2 }),
    boden: FASSADE.boden.map((f) => std(f)),
    trennwand: std(FASSADE.wand, { roughness: 0.7 }),
    geraet: std(rot.geraet, { roughness: 0.55, metalness: 0.2 }),
    geraetVorschlag: std(rot.geraet, { transparent: true, opacity: 0.45, depthWrite: false }),
    geraetAuswahl: std(rot.geraet, { emissive: rot.leitung, emissiveIntensity: 0.7, roughness: 0.4 }),
    leitung: std(rot.leitung, { emissive: rot.leitung, emissiveIntensity: 0, roughness: 0.35 }),
    leitungAktiv: std(rot.leitung, { emissive: rot.leitung, emissiveIntensity: 1, roughness: 0.3 }),
    leitungBlass: std(rot.leitung, { transparent: true, opacity: 0.25, depthWrite: false }),
    flaeche: new THREE.LineBasicMaterial({ color: rot.leitung, transparent: true, opacity: 0.45 }),
  };
}
export type Materialien = ReturnType<typeof erzeugeMaterialien>;

export function entsorgeMaterialien(m: Materialien): void {
  for (const wert of Object.values(m)) for (const x of Array.isArray(wert) ? wert : [wert]) x.dispose();
}
