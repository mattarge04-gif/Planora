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
    textSekundaerKachel: "#5e6b78", // Nebentext auf flaecheSekundaer, >= 4.5:1 (UI)
    textSekundaerEis: "#4f5c69", // Nebentext auf eis, >= 4.5:1 (UI)
    link: "#4a7298", // Linktext auf Weiss 5.1:1 (UI); eisAkzent bleibt für Flächen/Ringe
    linkHover: "#3b5f82",
    eis: "#dbe6f0",
    eisAkzent: "#5f88b0",
    kooHeizung: "#e5322d",
    kooHeizungGrund: "rgba(229, 50, 45, 0.08)", // Icon-Grund Gewerk Heizung (UI)
    statusOk: "#2f9e6b",
    statusWarnung: "#e08a1e",
    statusStoerung: "#d64541",
    // Statusfarben als Text auf Weiss/flaecheSekundaer (>= 4.5:1); Flächen, Punkte und 3D nutzen die Grundtöne oben.
    statusOkText: "#1f7a52",
    statusWarnungText: "#9a5a0a",
    statusStoerungText: "#b3362f",
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
    panelDeckkraft: 0.94, // [A] 15.11.: bei 0.85 schienen gesaettigte Rohre durch (Kritik B4)
    weichzeichnerPx: 20,
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
  /** Twin-Modus Erneuerung (3D, 19.11.2026, Runde 2): Gewerkefarbe tritt zurück, nur die Ampel ist farbig. Arbeitswerte [A]. */
  erneuerung: {
    markerPx: { rot: 22, gelb: 18, gruen: 13, grau: 13 }, // Durchmesser am Bildschirm: Fläche nach Dringlichkeit, nicht nach Gerätegrösse
    markerRandPx: 2, // weisser Rand um den Marker
    markerAbstandPx: 8, // Lücke zwischen Anlagenoberkante und Marker
    markerGedimmtFaktor: 0.6, // Marker verdeckter Geschosse (ausserhalb des Fokus): kleiner …
    markerGedimmtDeckkraft: 0.45, // … und blasser
    markerLueckePx: 3, // Abstand zwischen gruppierten Markern (Reihe statt Überlappung)
    ringBreiteM: 0.05, // Bodenring konstanter Breite um den Grundriss der Anlage
    ringBreitePx: 3, // aus der Distanz mindestens so viele px …
    ringBreiteMaxM: 0.12, // … höchstens so viele Meter
    ringAbstandM: 0.06, // Lücke Grundriss -> Ring (wenig Umgebungsverdeckung, Farbe bleibt token-genau)
    ringBodenM: 0.036, // über Geschossboden, über dem Flächenband (0.032)
    ringHoeheM: 0.008,
    strichM: 0.09, // gestrichelter Ring «Baujahr fehlt» (analog CircleDashed)
    lueckeM: 0.06,
    kameraMinM: 4.5, // Einpassung beim Einschalten: Bereich der dringenden Anlagen mindestens so gross (Kontext bleibt)
    leitungMischung: 1, // KOO-Rot -> grau2 (1 = rein grau2): Leitungen neutral, Rohrverdickung bleibt
    flaechenMischung: 0.55, // Flächenband (FBH) flaecheSekundaer -> grau2
    /**
     * Prüfmanschette (Entscheid 22.11.2026, Ansatz C Stufe 1): Ring am Rohr bzw. Band am Gehäuse in Ampelfarbe.
     * Form zusätzlich zur Farbe: Rot zwei Ringe, Gelb breit, Grün schmal, Grau gestrichelt. Arbeitswerte [A].
     */
    manschette: {
      hoeheRohrM: { rot: 0.022, gelb: 0.048, gruen: 0.016, grau: 0.036 }, // Ring am Rohr (Rot: je Ring)
      hoeheGehaeuseM: { rot: 0.042, gelb: 0.064, gruen: 0.014, grau: 0.05 }, // Band am Gehäuse (Rot: je Band)
      rotLueckeRohrM: 0.028, // Lücke zwischen den zwei roten Ringen
      rotLueckeGehaeuseM: 0.03,
      rohrInnenFaktor: 1.08, // × Rohrradius: liegt am Rohr an
      rohrAussenFaktor: 2.4, // × Rohrradius: steht deutlich über die (verdickte) Rohrsilhouette
      rohrAbstandM: 0.003, // Lücke eigenes Teil -> Ring
      fremdAbstandM: 0.025, // Mindestlücke Ring -> fremdes Teil (Zuordnung eindeutig), sonst Band ums Teil
      gehaeuseAbstandM: 0.006, // Lücke Gehäuse -> Band
      gehaeuseDickeM: 0.018,
      gehaeuseDickeRotM: 0.024, // Rot am Gehäuse kräftiger (Rot-Fläche je Bauteil >= Grün-Fläche je Bauteil, Kritik r1)
      gehaeuseDickeGruenM: 0.008, // Grün am Gehäuse schmal: Fläche nach Dringlichkeit, nicht nach Gerätegrösse
      kragenDickeM: 0.016, // Kragen am Verteilerbalken
      strichAnteil: 0.5, // gestrichelt «Baujahr fehlt»: Strich / (Strich + Lücke) (Kritik r2: weniger, längere Striche)
      strichMinHoehen: 2, // Strichlänge mindestens so viele Bandhöhen
      strichMin: 3, // mindestens so viele Striche je Umfang
      zielPx: 9, // aus der Distanz: Gesamthöhe der Manschette je Stufe mindestens so viele px …
      zielPxGruen: 5, // … Grün weniger
      maxFaktor: 5, // … höchstens so viel gestreckt (und nie bis ans fremde Teil)
      kanteHelligkeit: 0.82, // Ober-/Unterseite und Innenwand etwas dunkler: Ringkanten lesbar, Aussenwand bleibt tokengenau
      aoAusgleich: 1.08, // linearer Ausgleich der Umgebungsverdeckung (F9 Rest), nur mit Effekten
      hoverRandM: 0.006, // Hover/Auswahl: Manschette mit eisAkzent-Rand
      aufziehenMs: 280, // Einschalten E: Manschetten ziehen von Höhe 0 auf
      deckelEinpassung: 2.5, // ab diesem Vielfachen des Einpasszooms wächst die Manschette am Bildschirm nicht weiter (Kritik r2)
    },
    /**
     * Pegelband an der Plattenstirn (Entscheid 22.11.2026, Ansatz C Stufe 2): je Geschoss ein Band an der kameraseitigen
     * Stirn seiner Bodenplatte, segmentiert nach Anteilen der Ampelstufen (PO 22.11.: ohne Fussabdrücke).
     */
    pegel: {
      hoeheM: 0.06, // Bandhöhe nah
      minPx: 7, // aus der Distanz mindestens so viele px hoch (Kritik r3: 4 -> 7) …
      maxM: 0.26, // … höchstens so hoch (Platte 0.25)
      tiefeM: 0.004,
      traegerFaktor: 1.8, // heller Träger (flaecheSekundaer) hinter den Segmenten, × Bandhöhe …
      traegerMaxM: 0.25, // … höchstens Plattendicke
      abstandM: 0.001, // vor der Stirn (kein Z-Fighting)
      randM: 0.12, // Abstand Bandende -> Plattenecke
      lueckeM: 0.03, // Fuge zwischen Segmenten
      minAnteil: 0.12, // Mindestlänge eines Segments (Anteil der Bandlänge) [A]
      strichM: 0.5, // Grau gestrichelt: Strich mindestens so lang …
      strichHoehen: 4, // … und mindestens so viele (grösste) Bandhöhen (Kritik r3)
      strichAnteil: 0.7, // Strich / (Strich + Lücke): liest nicht als Fassadenschlitz (Kritik r3)
      fuellenMs: 280, // Einschalten E: Band füllt sich von links
      blendeMs: 160, // Übersicht <-> Fokus/nah: Manschetten ein
      nahEinpassung: 1.8, // ab diesem Vielfachen des Einpasszooms gilt «nah» (Manschetten ein) [A]
      trefferPx: 16, // unsichtbare Klickfläche je Band mindestens so hoch
      hoverPx: 2, // Hover/hervorgehobenes Geschoss: Band so viel höher
    },
    /**
     * Legende als Filter (Entscheid 22.11.2026, Ansatz C Stufe 3): Treffer voll mit Auswahlumriss, Rest tritt zurück
     * (kein Abdunkeln der Szene); graue Banderole an der Manschette für «ohne Preis» / «Baujahr fehlt» (Kritik r6).
     */
    filter: {
      deckkraft: 0.25, // Nicht-Treffer: Anlagen durchscheinend, Leitungen/Manschetten/Band zu grund gemischt
      banderoleHoeheM: 0.018, // graue Banderole («ohne Preis» / «Baujahr fehlt») bündig an der Manschette …
      banderoleMinPx: 5, // Banderole mindestens so breit am Bildschirm …
      banderoleAbstandPx: 1, // … mit weissem Abstand zum Ampelring (Kritik r7)
      banderoleDicke: 1.4, // … am Gehäuse/Motor dicker: grauer Rand hinter der Ampelfarbe (am Rohr gleich dick, sonst verdeckt er den Ring)
      kameraMinM: 1.2, // Filterkamera: Hüllbox der Treffer nur so weit erweitert (Treffer >= 55 % der freien Breite, Kritik r5)
      umrissPx: 1, // Umriss der Treffer am Bildschirm …
      fokusUmrissPx: 2, // … des fokussierten Treffers (Liste/Pfeiltasten) …
      fokusFlaeche: 0.35, // … plus Fläche eisAkzent mit dieser Deckkraft
      fokusMinM: 0.8, // Fokusfahrt auf einen Treffer: Hüllbox mindestens so gross (Bauteil >= 60 px)
      fokusFahrtMs: 600, // Dauer der Fokusfahrt (reduzierte Bewegung: sofort)
    },
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
