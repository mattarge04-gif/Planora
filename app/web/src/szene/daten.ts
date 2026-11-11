import type { KatalogEintrag, Rechteck, Welt } from "../typen";

export const FARBEN = { zentrale: "#c2410c", verteilung: "#2563eb", einheit: "#059669", auswahl: "#f59e0b" } as const;
const PIN_HOEHE = 0.25;      // Pin knapp ueber dem Geschossboden
const EINHEIT_HOEHE = 0.05;  // Einheiten-Umriss knapp ueber der Platte

export interface SzenePlatte { mitte: [number, number, number]; breite: number; tiefe: number }
export interface SzeneBeschriftung { text: string; position: [number, number, number]; groesse: number }
export interface SzenePin { schluessel: string; position: [number, number, number]; farbe: string; name: string }
export interface SzeneDaten {
  platten: SzenePlatte[]; linien: Float32Array; beschriftungen: SzeneBeschriftung[]; pins: SzenePin[];
  kamera: { ziel: [number, number, number]; radius: number };
}

/** Mischt eine Hex-Farbe mit Weiss (anteil 0 = unveraendert, 1 = weiss). */
export function aufhellen(hex: string, anteil = 0.55): string {
  const n = parseInt(hex.slice(1), 16);
  const kanal = (v: number) => Math.round(v + (255 - v) * anteil).toString(16).padStart(2, "0");
  return `#${kanal((n >> 16) & 255)}${kanal((n >> 8) & 255)}${kanal(n & 255)}`;
}

export function szeneDaten(welt: Welt, katalog: KatalogEintrag[]): SzeneDaten {
  const eintrag = new Map(katalog.map((k) => [k.id, k]));
  const l: number[] = [];
  const umriss = (r: Rechteck, y: number) => {
    const x0 = r.x, x1 = r.x + r.breite, z0 = r.z, z1 = r.z + r.tiefe;
    l.push(x0, y, z0, x1, y, z0, x1, y, z0, x1, y, z1, x1, y, z1, x0, y, z1, x0, y, z1, x0, y, z0);
  };

  const yMin = welt.geschosse.length ? Math.min(...welt.geschosse.map((g) => g.yUnten)) : 0;
  const yMax = welt.geschosse.length ? Math.max(...welt.geschosse.map((g) => g.yUnten + g.hoehe)) : 3;
  const xs = welt.grundriss.flatMap((r) => [r.x, r.x + r.breite]), zs = welt.grundriss.flatMap((r) => [r.z, r.z + r.tiefe]);
  const xMin = xs.length ? Math.min(...xs) : 0, xMax = xs.length ? Math.max(...xs) : 10;
  const zMin = zs.length ? Math.min(...zs) : 0, zMax = zs.length ? Math.max(...zs) : 10;

  // Fassade nur, wenn es Geschosse gibt
  if (welt.geschosse.length) for (const r of welt.grundriss) {
    umriss(r, yMin); umriss(r, yMax);
    for (const [x, z] of [[r.x, r.z], [r.x + r.breite, r.z], [r.x + r.breite, r.z + r.tiefe], [r.x, r.z + r.tiefe]]) l.push(x, yMin, z, x, yMax, z);
  }
  const yGeschoss = new Map(welt.geschosse.map((g) => [g.id, g.yUnten]));
  for (const e of welt.einheiten) umriss(e.rechteck, (yGeschoss.get(e.geschossId) ?? 0) + EINHEIT_HOEHE);

  const platten: SzenePlatte[] = welt.geschosse.flatMap((g) => welt.grundriss.map((r) => ({
    mitte: [r.x + r.breite / 2, g.yUnten, r.z + r.tiefe / 2] as [number, number, number], breite: r.breite, tiefe: r.tiefe,
  })));

  const beschriftungen: SzeneBeschriftung[] = [
    ...welt.geschosse.map((g) => {
      const n = welt.einheiten.filter((e) => e.geschossId === g.id).length;
      return { text: `${g.code} · ${n} ${n === 1 ? "Einheit" : "Einheiten"}`, position: [xMax + 3, g.yUnten + g.hoehe / 2, (zMin + zMax) / 2] as [number, number, number], groesse: 0.9 };
    }),
    ...welt.einheiten.map((e) => ({
      text: e.bezeichnung,
      position: [e.rechteck.x + e.rechteck.breite / 2, (yGeschoss.get(e.geschossId) ?? 0) + 0.4, e.rechteck.z + 0.8] as [number, number, number],
      groesse: 0.6,
    })),
  ];

  const pins: SzenePin[] = welt.symbole.map((s) => {
    const k = eintrag.get(s.katalogId);
    const basis = FARBEN[k?.bereich ?? "einheit"];
    return {
      schluessel: s.schluessel,
      position: [s.position.x, s.position.y + PIN_HOEHE, s.position.z],
      farbe: s.status === "vorgeschlagen" ? aufhellen(basis) : basis,
      name: k?.name ?? s.katalogId,
    };
  });

  const ziel: [number, number, number] = [(xMin + xMax) / 2, (yMin + yMax) / 2, (zMin + zMax) / 2];
  const radius = Math.max(Math.hypot((xMax - xMin) / 2, (yMax - yMin) / 2, (zMax - zMin) / 2), 1);
  return { platten, linien: new Float32Array(l), beschriftungen, pins, kamera: { ziel, radius } };
}
