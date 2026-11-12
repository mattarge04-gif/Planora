import type { Bereich, V3 } from "../szene2/huelle";
import { geschossBeiY } from "../szene2/leitungen";
import type { Welt } from "../typen";
import { geschossSchnitt } from "./schnitt";

export function bewegungsAnteil(ms: number, dauerMs: number, weniger = false): number {
  if (weniger || dauerMs <= 0) return 1;
  const t = Math.max(0, Math.min(1, ms / dauerMs));
  return 1 - (1 - t) ** 3;
}

/** [A] Jedes höhere Geschoss erhält zusätzlich 0.8 × die Höhe des darunterliegenden Geschosses, auch im Fokus. */
export function separationsOffsets(welt: Welt, separiert = false): Record<string, number> {
  let versatz = 0;
  return Object.fromEntries([...welt.geschosse].sort((a, b) => a.yUnten - b.yUnten || a.id.localeCompare(b.id)).map((g) => {
    const offset = separiert ? versatz : 0;
    versatz += g.hoehe * 0.8;
    return [g.id, offset];
  }));
}

export function sichtbareGeschosse(welt: Welt, fokusId: string | null, ausgeblendet: readonly string[] = []): string[] {
  return geschossSchnitt(welt, fokusId).geschosse.filter((g) => !ausgeblendet.includes(g.id)).map((g) => g.id);
}

export function gebaeudeBereich(welt: Welt, basis: Bereich, ids: readonly string[], offsets: Record<string, number>): Bereich {
  const geschosse = welt.geschosse.filter((g) => ids.includes(g.id));
  if (!geschosse.length) return { ...basis, yMax: basis.yMin };
  return { ...basis, xMin: basis.xMin - 0.15, xMax: basis.xMax + 0.15, zMin: basis.zMin - 0.15, zMax: basis.zMax + 0.15,
    yMin: Math.min(...geschosse.map((g) => g.yUnten - 0.25 + (offsets[g.id] ?? 0))),
    yMax: Math.max(...geschosse.map((g) => g.yUnten + g.hoehe + (offsets[g.id] ?? 0))),
  };
}

/** Steigleitungen werden an Geschossgrenzen geteilt; Gruppen können danach unabhängig verschoben/ausgeblendet werden. */
export function rohrGeschosse(welt: Welt, punkte: V3[], sichtbar: readonly string[]): { geschossId: string; punkte: V3[]; anfangGetrennt: boolean; endeGetrennt: boolean }[] {
  const teile: ReturnType<typeof rohrGeschosse> = [];
  for (let i = 1; i < punkte.length; i++) {
    const a = punkte[i - 1], b = punkte[i], dy = b[1] - a[1];
    const ts = [0, 1];
    if (Math.abs(dy) > 1e-9) for (const g of welt.geschosse) {
      const t = (g.yUnten - a[1]) / dy;
      if (t > 1e-8 && t < 1 - 1e-8) ts.push(t);
    }
    ts.sort((a, b) => a - b);
    for (let k = 1; k < ts.length; k++) {
      const t0 = ts[k - 1], t1 = ts[k], punkt = (t: number): V3 => a.map((v, j) => v + (b[j] - v) * t) as V3;
      const id = geschossBeiY(welt, punkt((t0 + t1) / 2)[1]);
      if (!id || !sichtbar.includes(id)) continue;
      const start = punkt(t0), ende = punkt(t1), vorher = teile.at(-1);
      if (vorher?.geschossId === id && vorher.punkte.at(-1)!.every((v, j) => Math.abs(v - start[j]) < 1e-8)) {
        vorher.punkte.push(ende); vorher.endeGetrennt = i < punkte.length - 1 || t1 < 1;
      } else teile.push({ geschossId: id, punkte: [start, ende], anfangGetrennt: i > 1 || t0 > 0, endeGetrennt: i < punkte.length - 1 || t1 < 1 });
    }
  }
  return teile;
}
