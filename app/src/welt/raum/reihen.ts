export interface ReihenOptionen {
  /** Vorbelegung je Reihe in Modulen (L/U: die innere Reihe ist um den Eckverlust kuerzer). */
  vorlauf?: [number, number];
  /** Kapazitaet je Reihe in Modulen: Zuteilung nach Fuellgrad statt nach absoluter Laenge. */
  kapazitaet?: [number, number];
}

/**
 * Verteilt Raeume auf die zwei Reihen beidseits des Gangs (Spec 5.2): groesste zuerst (Gleichstand: Eingabereihenfolge),
 * jeweils in die kuerzere Reihe (Gleichstand: Reihe 0). Ergebnis je Reihe in Eingabereihenfolge.
 */
export function verteileReihen(raeume: { id: string; laenge: number }[], opt: ReihenOptionen = {}): [string[], string[]] {
  const vorlauf = opt.vorlauf ?? [0, 0], kap = opt.kapazitaet ?? [1, 1];
  const last = [vorlauf[0], vorlauf[1]];
  const reihe = new Map<string, 0 | 1>();
  const sortiert = raeume.map((r, i) => ({ r, i })).sort((a, b) => b.r.laenge - a.r.laenge || a.i - b.i);
  for (const { r } of sortiert) {
    const k: 0 | 1 = (last[1] + r.laenge) / kap[1] < (last[0] + r.laenge) / kap[0] - 1e-9 ? 1 : 0;
    last[k] += r.laenge;
    reihe.set(r.id, k);
  }
  return [raeume.filter((r) => reihe.get(r.id) === 0).map((r) => r.id), raeume.filter((r) => reihe.get(r.id) === 1).map((r) => r.id)];
}
