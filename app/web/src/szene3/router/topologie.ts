export interface Kante { von: string; nach: string; art: "haupt" | "verteil"; gruppeId?: string }

/** Nimmt Kanten in gegebener Reihenfolge an, solange jeder Knoten hoechstens einen Vorgaenger hat und kein Zyklus entsteht. */
export function alsBaum(kanten: Kante[]): { kanten: Kante[]; verworfen: Kante[] } {
  const vorgaenger = new Map<string, string>();
  const ok: Kante[] = [], verworfen: Kante[] = [];
  const erreicht = (start: string, ziel: string) => {
    for (let k: string | undefined = start, n = 0; k !== undefined && n <= vorgaenger.size; k = vorgaenger.get(k), n++) {
      if (k === ziel) return true;
    }
    return false;
  };
  for (const k of kanten) {
    if (k.von === k.nach || vorgaenger.has(k.nach) || erreicht(k.von, k.nach)) {
      verworfen.push(k);
      continue;
    }
    vorgaenger.set(k.nach, k.von);
    ok.push(k);
  }
  return { kanten: ok, verworfen };
}
