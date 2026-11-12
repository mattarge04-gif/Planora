import type { Punkt, Rechteck } from "../typen.js";

/** Abstand der Steigzone von den Waenden der Zentrale [A]: liegt in der Ecke, aber im Raum. */
const EINZUG = 0.3;
const mm = (v: number) => Math.round(v * 1000) / 1000;

/**
 * Steigzone (Spec 5.4): Mitte des Kerns im untersten Geschoss mit Kern (Gleichstand: Eingabereihenfolge);
 * sonst die Ecke der Zentrale zur Gebaeudemitte (Mitte des umschliessenden Rechtecks), um `EINZUG` ins Rauminnere versetzt;
 * ohne Kern und Zentrale null. `geschossFolge`: Geschoss-IDs von unten nach oben.
 */
export function steigzone(
  einheiten: { id: string; geschossId: string; art: string; rechteck: Rechteck }[],
  geschossFolge: string[], zentraleId: string | null, grundriss: Rechteck[],
): Punkt | null {
  const rang = (g: string) => geschossFolge.indexOf(g);
  const kerne = einheiten.map((e, i) => ({ e, i })).filter((x) => x.e.art === "kern")
    .sort((a, b) => rang(a.e.geschossId) - rang(b.e.geschossId) || a.i - b.i);
  if (kerne.length) {
    const r = kerne[0].e.rechteck;
    return { x: mm(r.x + r.breite / 2), z: mm(r.z + r.tiefe / 2) };
  }
  const z = einheiten.find((e) => e.id === zentraleId);
  if (!z) return null;
  const x0 = Math.min(...grundriss.map((r) => r.x)), x1 = Math.max(...grundriss.map((r) => r.x + r.breite));
  const z0 = Math.min(...grundriss.map((r) => r.z)), z1 = Math.max(...grundriss.map((r) => r.z + r.tiefe));
  const mitte = { x: (x0 + x1) / 2, z: (z0 + z1) / 2 };
  const r = z.rechteck;
  const ex = Math.min(EINZUG, r.breite / 2), ez = Math.min(EINZUG, r.tiefe / 2);
  const ecken: Punkt[] = [
    { x: r.x + ex, z: r.z + ez }, { x: r.x + r.breite - ex, z: r.z + ez },
    { x: r.x + ex, z: r.z + r.tiefe - ez }, { x: r.x + r.breite - ex, z: r.z + r.tiefe - ez },
  ];
  const abstand = (p: Punkt) => Math.hypot(p.x - mitte.x, p.z - mitte.z);
  // Auswahl nach der echten Ecke (ohne Einzug), Gleichstand: erste in obiger Reihenfolge
  const echt = (k: number) => ({ x: k % 2 ? r.x + r.breite : r.x, z: k >= 2 ? r.z + r.tiefe : r.z });
  let best = 0;
  for (let k = 1; k < 4; k++) if (abstand(echt(k)) < abstand(echt(best)) - 1e-9) best = k;
  return { x: mm(ecken[best].x), z: mm(ecken[best].z) };
}
