import type { Rechteck, Welt } from "../typen";
import { MASSE, type Fenster, type Quader, type Wand } from "../szene2/huelle";

export function fensterAnWand(f: Fenster, w: Wand): boolean {
  const nx = Math.sin(f.drehungY), nz = Math.cos(f.drehungY);
  if (Math.abs(nx - w.normale[0]) > 0.01 || Math.abs(nz - w.normale[1]) > 0.01) return false;
  const d = (f.mitte[0] - w.von[0]) * w.normale[0] + (f.mitte[2] - w.von[1]) * w.normale[1];
  const t = abstandAnWand(f, w);
  return Math.abs(d - MASSE.fensterAbstand) < 0.01 && t >= 0 && t <= w.laenge;
}

const abstandAnWand = (f: Fenster, w: Wand) =>
  ((f.mitte[0] - w.von[0]) * (w.bis[0] - w.von[0]) + (f.mitte[2] - w.von[1]) * (w.bis[1] - w.von[1])) / w.laenge;

function stueck(w: Wand, a: number, b: number, y: number, hoehe: number): Quader {
  const t = (a + b) / (2 * w.laenge);
  return {
    mitte: [w.von[0] + (w.bis[0] - w.von[0]) * t - w.normale[0] * MASSE.wand / 2, y + hoehe / 2,
      w.von[1] + (w.bis[1] - w.von[1]) * t - w.normale[1] * MASSE.wand / 2],
    groesse: w.normale[0] === 0 ? [b - a, hoehe, MASSE.wand] : [MASSE.wand, hoehe, b - a],
  };
}

/** Echte Fensteröffnungen: Brüstung/Sturz und Pfeiler, keine Glasscheiben vor einer Vollwand. */
export function wandteile(w: Wand, yUnten: number, hoehe: number, fenster: Fenster[]): Quader[] {
  if (w.laenge <= 0 || hoehe <= 0) return [];
  const f = fenster.filter((x) => fensterAnWand(x, w)).sort((a, b) => abstandAnWand(a, w) - abstandAnWand(b, w));
  if (!f.length) return [stueck(w, 0, w.laenge, yUnten, hoehe)];
  const unten = Math.max(yUnten, f[0].mitte[1] - f[0].hoehe / 2);
  const oben = Math.min(yUnten + hoehe, f[0].mitte[1] + f[0].hoehe / 2);
  if (oben <= unten) return [stueck(w, 0, w.laenge, yUnten, hoehe)];
  const teile: Quader[] = [];
  if (unten > yUnten) teile.push(stueck(w, 0, w.laenge, yUnten, unten - yUnten));
  if (oben < yUnten + hoehe) teile.push(stueck(w, 0, w.laenge, oben, yUnten + hoehe - oben));
  let start = 0;
  for (const x of f) {
    const t = abstandAnWand(x, w), links = Math.max(0, t - x.breite / 2), rechts = Math.min(w.laenge, t + x.breite / 2);
    if (links > start) teile.push(stueck(w, start, links, unten, oben - unten));
    start = Math.max(start, rechts);
  }
  if (start < w.laenge) teile.push(stueck(w, start, w.laenge, unten, oben - unten));
  return teile;
}

/** Raumteilung folgt den echten Einheitenrechtecken; gemeinsame Kanten werden nur einmal gezeichnet. */
export function innenwaende(welt: Welt, geschossId: string, y: number, hoehe: number): Quader[] {
  const teile = new Map<string, Quader>();
  for (const e of welt.einheiten.filter((x) => x.geschossId === geschossId)) {
    const r = e.rechteck;
    const kanten = [
      [r.x, r.z, r.x + r.breite, r.z], [r.x, r.z + r.tiefe, r.x + r.breite, r.z + r.tiefe],
      [r.x, r.z, r.x, r.z + r.tiefe], [r.x + r.breite, r.z, r.x + r.breite, r.z + r.tiefe],
    ];
    for (const [x0, z0, x1, z1] of kanten) {
      const aussen = welt.grundriss.some((g) => Math.abs(z1 - z0) < 0.001
        ? (Math.abs(z0 - g.z) < 0.001 || Math.abs(z0 - g.z - g.tiefe) < 0.001) && x0 >= g.x && x1 <= g.x + g.breite
        : (Math.abs(x0 - g.x) < 0.001 || Math.abs(x0 - g.x - g.breite) < 0.001) && z0 >= g.z && z1 <= g.z + g.tiefe);
      if (aussen) continue;
      const key = [x0, z0, x1, z1].map((v) => v.toFixed(4)).join(":");
      teile.set(key, {
        mitte: [(x0 + x1) / 2, y + hoehe / 2, (z0 + z1) / 2],
        groesse: [Math.max(0.18, x1 - x0), hoehe, Math.max(0.18, z1 - z0)],
      });
    }
  }
  return [...teile.values()];
}

/**
 * Aussenwände ohne die Stücke, die an ein anderes Grundrissrechteck grenzen (L-/T-Formen: `waendeVon` erzeugt die
 * gemeinsame Kante doppelt). Solche inneren Wandstücke standen im offenen Geschoss zwischen Kamera und Anlage
 * (Filter-Kamerafahrt, Kritik r2 «hinter Wand»). Richtung und Normale bleiben, Fenster folgen über fensterAnWand.
 */
export function aussenWaende(waende: Wand[], grundriss: Rechteck[], eps = 0.01): Wand[] {
  return waende.flatMap((w) => {
    const entlangX = w.normale[0] === 0, a = entlangX ? w.von[0] : w.von[1], b = entlangX ? w.bis[0] : w.bis[1];
    const lo = Math.min(a, b), hi = Math.max(a, b);
    const ausserhalb = entlangX ? w.von[1] + w.normale[1] * eps : w.von[0] + w.normale[0] * eps;
    // Bereiche entlang der Wand, deren Aussenseite in einem anderen Rechteck liegt.
    const belegt = grundriss.filter((r) => entlangX ? ausserhalb > r.z && ausserhalb < r.z + r.tiefe : ausserhalb > r.x && ausserhalb < r.x + r.breite)
      .map((r) => entlangX ? [r.x, r.x + r.breite] : [r.z, r.z + r.tiefe]).sort((p, q) => p[0] - q[0]);
    let frei: [number, number][] = [[lo, hi]];
    for (const [s0, s1] of belegt) frei = frei.flatMap(([f0, f1]): [number, number][] =>
      s1 <= f0 || s0 >= f1 ? [[f0, f1]] : [...(s0 > f0 ? [[f0, s0]] as [number, number][] : []), ...(s1 < f1 ? [[s1, f1]] as [number, number][] : [])]);
    frei = frei.filter(([f0, f1]) => f1 - f0 > 1e-6);
    if (frei.length === 1 && frei[0][0] === lo && frei[0][1] === hi) return [w];
    return frei.map(([f0, f1]): Wand => {
      const [p, q] = a <= b ? [f0, f1] : [f1, f0];
      const von: [number, number] = entlangX ? [p, w.von[1]] : [w.von[0], p], bis: [number, number] = entlangX ? [q, w.von[1]] : [w.von[0], q];
      return { von, bis, normale: w.normale, laenge: f1 - f0 };
    });
  });
}
