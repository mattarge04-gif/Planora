import type { V3 } from "../szene2/huelle";

/** Kleinster Abstand zwischen parallelen, sich überlappenden Stücken zweier Stranggruppen (∞ ohne Überlappung). */
export function minAbstandParallel(a: V3[][], b: V3[][]): number {
  const stuecke = (s: V3[][]) => s.flatMap((p) => p.slice(1).map((q, i) => [p[i], q] as [V3, V3]));
  const achse = ([p, q]: [V3, V3]) => [0, 1, 2].find((k) => Math.abs(p[k] - q[k]) > 1e-9);
  let min = Infinity;
  for (const s of stuecke(a)) for (const t of stuecke(b)) {
    const k = achse(s);
    if (k === undefined || k !== achse(t)) continue;
    const ueberlapp = Math.min(Math.max(s[0][k], s[1][k]), Math.max(t[0][k], t[1][k])) - Math.max(Math.min(s[0][k], s[1][k]), Math.min(t[0][k], t[1][k]));
    if (ueberlapp <= 1e-9) continue;
    const quer = [0, 1, 2].filter((i) => i !== k);
    min = Math.min(min, Math.hypot(...quer.map((i) => s[0][i] - t[0][i])));
  }
  return min;
}
