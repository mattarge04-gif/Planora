import type { Welt } from "../typen";
import type { V3 } from "../szene2/huelle";

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
