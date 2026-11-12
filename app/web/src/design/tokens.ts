/** Gemeinsame Quelle für UI und Szene3, Richtung A (12.11.2026).
 * Zahlen mit Px gelten in CSS-Pixeln, M in Metern, Ms in Millisekunden.
 * Licht-/Materialwerte sind Arbeitswerte bis zur GPU-Abnahme der Szene.
 * Bestehende Ansichten übernehmen diese Tokens erst bei ihrer gezielten Anbindung.
 */
export const TOKENS = {
  farbe: {
    grund: "#f5f6f8",
    flaeche: "#ffffff",
    flaecheSekundaer: "#f2f3f5",
    grau1: "#e6e9ed",
    grau2: "#c9ced6",
    grau3: "#8a929e", // Dekorative Details, nicht für kleinen Datentext.
    text: "#1f2630",
    textSekundaer: "#64717f",
    eis: "#dbe6f0",
    eisAkzent: "#5f88b0",
    kooHeizung: "#e5322d",
    statusOk: "#2f9e6b",
    statusWarnung: "#e08a1e",
    statusStoerung: "#d64541",
  },
  typografie: {
    familie: "Inter Variable, Inter, sans-serif",
    groessePx: { daten: 12, text: 13, kartentitel: 15, seitentitel: 22 },
    gewicht: { normal: 400, mittel: 500, betont: 600 },
    zeilenhoehe: { daten: 1.5, titel: 1.3 },
    ziffern: "tabular-nums",
  },
  abstand: { basisPx: 4, skalaPx: [4, 8, 12, 16, 24, 32], seitenrandPx: 20 },
  radius: {
    panelPx: 12,
    kachelPx: 8,
    pillPx: 999,
    platteM: 0.05,
    geraetM: 0.03,
  },
  flaeche: {
    panelDeckkraft: 0.85,
    weichzeichnerPx: 16,
    rahmenPx: 1,
    rahmen: "rgba(255, 255, 255, 0.7)",
  },
  schatten: {
    panel: "0 1px 2px rgba(31, 38, 48, 0.06), 0 8px 24px rgba(31, 38, 48, 0.08)",
    objekt: "0 2px 4px rgba(31, 38, 48, 0.06), 0 12px 32px rgba(31, 38, 48, 0.1)",
  },
  material: {
    bauteil: { roughness: 0.9, metalness: 0 },
    glas: { roughness: 0.1, metalness: 0, deckkraft: 0.28 },
    geraet: { roughness: 0.55, metalness: 0.15 },
    metall: { roughness: 0.45, metalness: 0.4 },
    leitung: { roughness: 0.8, metalness: 0 },
  },
  licht: {
    toneMapping: "neutral",
    belichtung: 1,
    umgebungIntensitaet: 1,
    sonneIntensitaet: 1.5,
    sonneAzimutGrad: 225,
    sonneHoeheGrad: 50,
    schattenFrames: 64, // Einmal berechnen, danach einfrieren.
    schattenDeckkraft: 0.45,
    schattenRadiusM: 5,
    schattenFilterTexel: 20,
    schattenSamples: 12,
    aoRadiusM: 1.1,
    aoIntensitaet: 1.2,
  },
  bewegung: {
    hoverMs: 160,
    panelMs: 280,
    kameraMs: 750,
    separierenMs: 800,
    kurve: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    reduziertMs: 0,
  },
} as const;
