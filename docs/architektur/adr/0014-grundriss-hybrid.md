# 0014 – Grundriss-Erkennung hybrid mit Pflicht-Korrektur und manuellem Fallback

Status: vorgeschlagen, ergaenzt durch E31 · 2026-11-08 / 2026-11-09 · Bezug: E3, FA-12

## Kontext
Kein belastbarer Benchmark fuer "Claude erkennt Raum-Rechtecke"; allgemeine VLMs sind semantisch stark, geometrisch ungenau [F, Q34–Q36-Tech]. Erwartung: Raumliste 80–95 %, Rechteck-Geometrie 60–80 % innerhalb ±5 % bei Vektor-PDF [A, 02 Kap. 4]. Hoechstes fachliches Risiko in V1.

## Entscheid
- Ablauf pro Grundrissseite (Details 03 Kap. 6):
  1. **Vektor-Extraktion** (pdfjs-dist): Textstuecke mit Koordinaten → Raumstempel-Kandidaten (Raumnummer, Name, Flaeche in m²); Liniensegmente fuer Einrasten.
  2. **Claude Vision** (Sonnet 5.5, Kacheln in hoher Aufloesung) schlaegt Rechtecke in **normierten Seitenkoordinaten (0..1)** vor, mit Stempeltexten als Kontext.
  3. **Geometrie-Pruefung** deterministisch: Rechteck innerhalb der Seite, Ueberlappung < 10 % [A], Stempel liegt im Rechteck, Flaeche vs. Stempelflaeche (Abweichung > 15 % [A] → Konfidenz runter), Einrasten an naechste parallele Linie innerhalb 1 % der Seitenbreite [A].
  4. **Massstab**: Median aus (Stempelflaeche / Rechteckflaeche) ueber alle Raeume mit Stempel; sonst Benutzer setzt Massstab mit zwei Klicks und einer bekannten Masszahl. Speicherung in **Metern im Geschoss-Koordinatensystem**.
  5. **Korrektur-UI** (Pflicht): Rechtecke verschieben, skalieren, loeschen, neu ziehen, Bezeichnung aendern; Grundriss als Unterlage. Erst "Geschoss bestaetigen" uebernimmt Raeume in den Bestand.
     **Bausteine (E31, Pflicht):** Unterlage = Seite per PDF.js gerendert; Editor mit **react-konva** (`Rect` + `Transformer`), Editor-Zustand in **Zustand**, Rueckgaengig/Wiederholen mit **zundo**, Einrasten und Ueberlappung ueber einen **flatbush**-Index der Linien und Rechtecke. Muster: As-Built-Editor, Floor Maker (MIT). Die Geometrie-Pruefung ist eine reine Funktion in `domain/` und laeuft identisch im Browser und im Worker.
- **Manueller Modus** (Rechtecke auf der Unterlage zeichnen, ohne KI) ist immer verfuegbar und Standard, wenn KI aus ist oder die KI scheitert.
- Scans/Fotos: nur Schritte 2–5; Konfidenz grundsaetzlich "mittel" oder tiefer.
- Kennzahl fuer Qualitaet: **Korrekturzeit pro Geschoss** und Recall/IoU (Spike S1).

## Alternativen
- Spezialmodell (Raster2Seq u.a.): bessere Geometrie, aber Trainingsdaten-Lizenz (CubiCasa5k "NOASSERTION") unklar und eigener ML-Betrieb [F/A, Q30/Q35-Tech]. Option V2.
- Nur manuell: sicher, aber verfehlt das Produktversprechen "minimaler Kundenaufwand" (E3).
- OpenCV-Wanderkennung im Kern: Option als Einrast-Verbesserung, wenn Spike S1 es rechtfertigt.

## Konsequenzen
- + Software funktioniert auch bei 0 % KI-Treffern (manueller Weg).
- − Korrektur-UI ist eine der aufwendigsten UI-Komponenten in V1; durch react-konva/zundo/flatbush entfaellt der Eigenbau von Interaktion, Undo und Raumindex.
