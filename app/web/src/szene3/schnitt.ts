import type { Welt } from "../typen";
import type { V3 } from "../szene2/huelle";

export const POLAR_GRENZEN = { min: Math.PI / 9, max: Math.PI * 5 / 12 } as const;
/** [A] Drei Grad Hysterese an den Achsen verhindern Fassadenflackern beim Wechsel der Kameraseite. */
export function kameraSeiten(richtung: V3, vorher: V3 = [1, 1, 1]): V3 {
  const laenge = Math.hypot(richtung[0], richtung[2]);
  if (laenge < 1e-9) return vorher;
  const schwelle = Math.sin(3 * Math.PI / 180);
  const seite = (achse: 0 | 2) => Math.abs(richtung[achse] / laenge) <= schwelle ? vorher[achse] : Math.sign(richtung[achse]);
  const x = seite(0), z = seite(2);
  return x === vorher[0] && z === vorher[2] ? vorher : [x, 1, z];
}

/** Sichtbarkeit ist Darstellung; IDs, Geschosshöhen und Grundrisse bleiben unverändert. */
export function geschossSchnitt(welt: Welt, fokusId: string | null) {
  const fokus = welt.geschosse.find((g) => g.id === fokusId) ?? null;
  return {
    fokus,
    dach: fokus === null && welt.geschosse.length > 0,
    geschosse: [...welt.geschosse]
      .filter((g) => !fokus || g.yUnten <= fokus.yUnten)
      .sort((a, b) => a.yUnten - b.yUnten)
      .map((g) => ({ ...g, offen: g.id === fokus?.id })),
  };
}

/** Zwei kameraseitige Aussenwände entfallen. Auf einer Achse bleibt die positive Ecke stabil. */
export function wandBleibt(normale: readonly [number, number], offen: boolean, kameraRichtung: V3): boolean {
  if (!offen) return true;
  const x = Math.sign(kameraRichtung[0]) || 1;
  const z = Math.sign(kameraRichtung[2]) || 1;
  return normale[0] * x + normale[1] * z < 0;
}
