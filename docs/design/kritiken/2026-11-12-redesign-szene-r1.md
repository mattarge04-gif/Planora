⚠️ DEGRADED: single-context (Planora-Criticauftrag verbietet weitere Subagenten; Sichtprüfung zuerst, danach unabhängige Messungen/Detektor im selben Kontext).

# Redesign Szene – Kritik Runde 1

12.11.2026 · Ausgangscommit `7acc246`, uncommittierte Szene-Erstfassung · **verbessern**.

Eigene Aufnahmen mit `werkzeug/design/screenshot.mjs`, Szenario `twin-schnitt.json`; 1440 × 900, 1920 × 1080 und 1280 × 720. Renderer: `ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Ti (0x00002207) Direct3D11 vs_5_0 ps_5_0, D3D11)`. [Eigene Belege und Messprotokoll](2026-11-12-redesign-szene-r1/bericht.json). Instanzverwaltung ausschliesslich durch Hauptagenten. Pflichtskills Planora-Design, Impeccable, Reference Look Calibration und Frontend Design gelesen und angewandt. Kein Produktcode geändert. Keine Dashboard-/Anlagenbewertung vor Teilaufgaben 4–6.

## Noten

| Kriterium | Note 1–5 | Beleg / Befund |
|---|---:|---|
| Gestaltungsqualität | 3 | [Übersicht 1440](2026-11-12-redesign-szene-r1/uebersicht-1440x900.png): glaubwürdiges ruhiges Architekturmodell, jedoch graue Schattenfläche dominiert. |
| Originalität | 3 | Modellbrett mit schlichter Landschaft passt zum Architekturatelier; Fassadenraster und Bäume noch repetitiv. Subjektiv. |
| Räumliche Wirkung | 4 | [OG1](2026-11-12-redesign-szene-r1/schnitt-og1-1440x900.png): Plattenstärke, Fassadenlaibungen und verbleibendes EG klar lesbar. |
| Komposition | 2 | [1280](2026-11-12-redesign-szene-r1/uebersicht-1280x720.png): Baukörper ca. 470 px breit, Kulisse ca. 980 px; grosser Umgebungsanteil. |
| Geometrie | 4 | [EG](2026-11-12-redesign-szene-r1/schnitt-eg-1440x900.png): offene Vorderseite einschliesslich Fenster/Rahmen sauber, Raumunterteilung und Rückwände erhalten. |
| Licht | 2 | [Drehung](2026-11-12-redesign-szene-r1/schnitt-eg-gedreht-1440x900.png): grosse rechtwinklige graue Fläche um Modellbrett, helle Ringe an Baumkontakten. |
| Materialien | 3 | Architektur matt, Rahmen plastisch; Eisglas kaum vom neutralgrauen Umfeld differenziert. |
| Typografie | 4 | Kleine klare Inter-UI und echte Umlaute; «Beispielgebaeude» ist bestehender Datenname. |
| Abstände | 4 | Steuerung kompakt und sauber ausgerichtet, in drei Fenstergrössen bedienbar. |
| Referenz-Qualitätsrichtung | 3 | Referenzen 01/02 selbst angesehen: Referenz 02 hat subtilere Umgebung und reichere Licht-/Materialdifferenzierung. Noch keine gleiche Qualität. |
| Bedienbarkeit | 3 | Geschosswechsel, Esc und Reduktion erfolgreich; einzelner Zoomschritt ist noch keine echte Nahpr?fung. Tastaturvollständigkeit nicht separat geprüft. |
| Funktion | 4 | Übersicht, OG1, EG, Drehen, Esc und Reduktion in drei Grössen ausgeführt. Konsole enthält Meldungen, siehe unten. |
| Leistung | 4 | Werkzeug meldet 60 fps in allen drei Grössen bei Drehung. Messung zählt requestAnimationFrame, keine GPU-Framezeit. |

## Messungen (objektiv)

[Ganzbild-HSV-/Weissanteilmessungen](2026-11-12-redesign-szene-r1/helligkeit.json), V/S in 0–255. Weissanteil definiert als V > 230 und S < 25. Ganzbilder haben verschiedene Kompositionen; deshalb keine strikte Soll-Ist-Kopie oder Nachweis falscher Sättigung.

| Bild | V Mittel | V p95 | S Mittel | Weissanteil |
|---|---:|---:|---:|---:|
| Referenz 02 | 230,28 | 254 | 29,78 | 63,85 % |
| Übersicht 1440 | 224,58 | 240 | 3,77 | 72,15 % |
| Reduziert 1440 | 240,94 | 248 | 3,66 | 91,60 % |

Freier Hintergrund bei (90,90): Normalmodus RGB (232,233,235), reduziert (243,244,246). Damit ist die sichtbare Änderung durch die Renderingkette messbar, unabhängig von Schattengeometrie. Normal/Reduziert sollten dieselbe helle Grundwelt behalten.

[Pflicht-Kalibrationsskript](2026-11-12-redesign-szene-r1/look-fit.json) ausgeführt. Seine S > 30-Maske erfasst die matte Architektur nicht sinnvoll, sondern fast nur UI-Akzente; IoU und automatisch gemeldete Entsättigung sind hier **kein** gültiger Form-/Farbfehlernachweis. Kein KOO-Rot vor Teilaufgabe 4 zu prüfen. Hue-Drift bei S nahe null ist nicht aussagekräftig.

Impeccable-Detektor nach Sichtprüfung: `detect --json app/web/src/szene3` → `[]`. Keine Detektorprobleme. Kein zusätzlicher Live-Overlayserver wegen vorgeschriebener GPU-Werkzeug-/Instanzhoheit; kein sichtbares Overlay behauptet.

## Top-3-Massnahmen

1. **3d-designer, P1: Schattenbegrenzung und Normalmodus aufhellen.** Geradkantige graue Fläche ausserhalb des Modellbretts entfernen; Baumschatten ohne helle Ringe. Hintergrund über beide Modi konsistent halten. Beleg: Übersicht und EG gedreht in jeder Grösse.
2. **3d-designer, P2: Kulisse dem Gebäude unterordnen.** Platten-/Umgebungsrand reduzieren; den Baukörper präsenter einpassen, ohne Teile abzuschneiden. Das Gebäude beansprucht nur ca. 44 % der Fensterbreite bei 1440, ca. 37 % bei 1280; 65–75 % der tatsächlich freien Szene sind die Zielrichtung. Dieses Breitenmass ist eine Näherung, kein Flächenfüllgrad.
3. **3d-designer, P2: Zoom nachvollziehbar machen.** Nach dem ausgeführten Scrollschritt -300 ist die Hülle nur ca. 4 % breiter als in der Übersicht. [Nahaufnahme](2026-11-12-redesign-szene-r1/nah-1440x900.png). Scrollskalierung prüfen oder für die echte Detailabnahme grösseren Schritt verwenden; kein Funktionsausfall behauptet.

## Funktion und Leistung

- OG1: Dach weg, unteres EG bleibt sichtbar. EG: OG1 und Dach weg. Ausgewählte Geschosse oben offen; zwei kameraseitige Wände samt Fenstern und Rahmen fehlen. Hintere Wände und Raumunterteilung bleiben. Keine dunkle Fokusmaske. Kernregel erfüllt.
- Freie Drehung im Szenario verschiebt die Ansicht erfolgreich; vollständige 360°-Wandwechsel und Grenzwinkel sind erst Teilaufgabe 7, hier nicht vollständig nachgewiesen.
- Esc führt in die geschlossene Übersicht zurück. Reduktion entfernt aufwendige Effekte und verändert auffällig die Bildhelligkeit.
- Je Fenster ein HTTP 401 vor/um Login; Quelle im Werkzeugprotokoll nicht identifiziert. Keine CSP-Verletzung aufgezeichnet. `THREE.Clock`-Deprecation in allen Fenstern, einmal Shaderwarnung X3595 bei 1440. Keine beobachtete Szenenblockade.
- 60/60/60 fps. Zeit bis erste ruhige Szene nicht belastbar gemessen: Szenario wartet pauschal 7 Sekunden. Daraus keine Ladezeitbehauptung ableiten.
- Keine Tabelle/Anlagenauswahl/Separierung im geprüften Teilumfang vorhanden oder verlangt.

## Geschmacksurteile

Das Architekturatelier ist als Richtung erkennbar. Die deutlich höhere Feinheit der Referenzen entsteht aus kontrollierter Umgebung, glaubwürdigem Licht und Materialdifferenzierung. Der Hauptgewinn liegt hier bei der Schatten-/Helligkeitskorrektur. Bäume und Fassadenraster sind subjektiv noch repetitiv; daraus entsteht keine neue Prinzipienregel.

## Kandidaten für Lessons Learned

Normal- und reduzierten Modus mit identischem Bildausschnitt auf Hintergrundwerte prüfen; unterschiedliche Renderingketten können dieselbe Farbquelle sichtbar verschieden abbilden. Noch kein bestätigter Regelkandidat.

## Gesamturteil: verbessern

Schnittdarstellung und Grundgeometrie tragen. Schattenartefakt und zu graue Normaldarstellung verhindern derzeit die visuelle Abnahme. Fragen übersprungen: konkreter Umsetzungsauftrag und bestehender PO-Richtungsentscheid liegen vor; Rückmeldung geht an den Hauptagenten.
