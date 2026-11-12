/** Farben nach KOO-Logik: Farbe = Gewerk. Werte [A], Abstimmung in der Korrekturrunde. */
export const GEWERK = {
  heizung: { geraet: "#8a5450", leitung: "#ff3b30" },
} as const;

export const NEUTRAL = { geraet: "#7b8794", leitung: "#9aa5b1" } as const;

export function gewerkVon(katalogId: string): { geraet: string; leitung: string } {
  const gewerk = katalogId.split(".", 1)[0];
  return Object.prototype.hasOwnProperty.call(GEWERK, gewerk)
    ? GEWERK[gewerk as keyof typeof GEWERK]
    : NEUTRAL;
}

export const FASSADE = {
  wand: "#f5f6f8",
  fenster: "#8fa3b8",
  band: "#ffffff",
  platte: "#e8ebef",
  boden: ["#eef1f4", "#e4e9ef", "#f4f6f8"],
} as const;

/** Rohrradien in m: Haupt- und Verteilleitung unterscheiden sich nur in der Dicke. */
export const ROHR = { haupt: 0.08, verteil: 0.04 } as const;
