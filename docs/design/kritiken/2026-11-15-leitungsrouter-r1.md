# Leitungsrouter und Formstücke – Kritik Runde 1

- Datum: 15.11.2026, Branch `m2c-interview`, HEAD `384eca0` plus ungespeicherte Arbeitsstände (Formstücke, FBH-GLB).
- Renderer laut `bericht.json` (beide Sätze): `ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Ti ... Direct3D11 ... D3D11)` – echte GPU, gültig.
- Grundlage: vorhandene Bildsätze, keine eigene Testinstanz (Auftrag: 1 Runde, Stufe mittel, Bewertung der gelieferten Bilder).
  - Gesamtsatz `docs/abnahme/2026-11-15-leitungsrouter/*.png` (58 Bilder je Fenster), Schwerpunkt 1440x900, Stichproben 1280x720.
  - Formstücke `docs/abnahme/2026-11-15-leitungsrouter/formstuecke/*.png` (6 Bilder je Fenster).
  - Vergleich alt: `docs/abnahme/2026-11-12-gruppen/m3-zentrale-1440x900.png`, `m6-zentrale-1440x900.png`.
- Nicht bewertet (Auftrag): Hinweistext "seitenverhaeltnis".

## Noten

| Kriterium | Note | Beleg |
|---|---|---|
| Gestaltungsqualität | 4 | Zentrale m3/m6 nah wirkt ruhig, technisch, glaubwürdig (`formstuecke/m3-zentrale-nah-1440x900.png`, `formstuecke/m6-zentrale-nah-1440x900.png`). Geschossbilder fallen ab (Haarlinien, s. B1). |
| Originalität | 4 | Eigenständige, schematisch-plastische Rohrsprache mit Pressringen; keine Kopie. |
| Räumliche Wirkung | 4 | Rohre mit Volumen und Glanzkante, Bögen plastisch; im Geschossfokus flach (1–2 px). |
| Komposition (Leitungsbild) | 4 | Zentrale: klare Ordnung, parallele Spuren (`formstuecke/m6-zentrale-1440x900.png`, Bildmitte). Geschoss: unauffällig bis unsichtbar. |
| Geometrie | 4 | Keine Schleifen, keine sichtbaren Berührungen, 90°-Bögen sauber. Bügel über der WP bleibt formal korrekt, liest sich aber als Umweg (`formstuecke/m6-zentrale-1440x900.png`, x 580–700 / y 160–250). |
| Licht | 4 | Unverändert gut; KOO-Rot gesättigt (gemessen, s. unten). |
| Materialien | 4 | Rot matt-seidig, Pressringe silbergrau, FBH-Kasten weiss geschlossen (Vorschau `docs/design/modelle/vorschau/heizung.fbh_kreis.png`). |
| Typografie / Abstände | – | Nicht Gegenstand. |
| Referenz-Qualitätsrichtung | 4 | Zentrale erreicht die Richtung von `03-technik.png` (Formstücke, Ordnung); Geschossbilder nicht. |
| Bedienbarkeit | 3 | Rohrbündel laufen sichtbar durch die halbtransparenten linken Panels und stören deren Lesbarkeit (s. B4). |
| Funktion | 3 | Szenario-Fehler: Geschossbilder m3-EG zeigen Übersicht ohne Fokus (s. B2). Konsole: 1x 401 je Fenster, sonst nur bekannte Three-Warnungen, keine CSP-Verletzung. |
| Leistung | 5 | 60 fps in allen drei Fenstern, beide Sätze (`bericht.json`). |

## Messungen (objektiv)

- Rohrfarbe Zentrale (`formstuecke/m6-zentrale-nah-1440x900.png`): RGB (206,26,18) bis (234,41,34), Farbton 2–3°, Sättigung 0.85–0.91, Helligkeit 0.81–0.92 – KOO-Rot hält (F3 nicht wiederholt).
- Pressring (gleiches Bild, x 905/y 250): RGB (197,198,199), Sättigung 0.01, Helligkeit 0.78 – neutrales Silbergrau, kein Blaustich.
- Strichbreite Gruppenleitungen im Geschossfokus, horizontale Abtastlinien bei 1440x900:
  - `m3-geschoss-og1-1440x900.png` (y 250/300/330): 1–2 px.
  - `m6-geschoss-eg-1440x900.png` (y 320/340): 1 px.
  - `formstuecke/m5-og1-1440x900.png` (y 250/300): 1–3 px.
  → Haarlinien im Sinn der bestätigten Lesson (12.11.: "Rohre verdicken, sonst Haarlinien").
- FBH-Kasten angewählt (`formstuecke/m5-fbh-nah-1440x900.png`, Kastenfront x 720–740 / y 300–320): RGB (76,115–124,152–167), Sättigung 0.50–0.54 – das ist die Auswahlfärbung, nicht das Material; das GLB selbst ist weiss (Vorschau). Unangewähltes Nahbild fehlt.
- Leistung: 60 fps je Fenster und Satz; Renderer D3D11/RTX 3070 Ti.
- `-nah`-Geschossbilder sind praktisch bildgleich mit den Normalbildern (z. B. `m3-geschoss-og1` vs. `m3-geschoss-og1-nah`, `m6-geschoss-eg` vs. `-nah`) – Zoomgrenze, bekannt.

## Befunde

### P1 – vor PO-Sichtung beheben

**B1 – Gruppenleitungen im Geschossfokus sind Haarlinien (1–2 px).**
Bilder: `m3-geschoss-og1-1440x900.png`, `m6-geschoss-eg-1440x900.png`, `m6u-geschoss-og1-1440x900.png`, `formstuecke/m5-og1-1440x900.png`. Gerade der Geschossfokus ist die Ansicht, in der die PO den neuen Router für Gruppenstränge prüfen will; dort sieht man rote Drahtlinien wie im verworfenen F1. Das Leitungsbild der Zentrale (sehr gut) wird so im Geschoss nicht eingelöst.
Vorschlag (3d-designer): Bildschirm-Mindeststärke für Rohre im Geschossfokus, z. B. Radius-Faktor abhängig vom Kamerazoom (`max(ROHR.verteil, k / zoom)`), Ziel ≥ 4 px Strichbreite bei 1440x900 im Geschossfokus; alternativ `ROHR.verteil` im Fokus um Faktor ~2 skalieren. Danach dieselben Bilder neu aufnehmen und Strichbreite nachmessen. Abstände des Routers (r1 + r2 + 0.04 m) beziehen sich auf echte Radien – die Darstellungs-Verdickung darf Parallelspuren nicht zum Verschmelzen bringen; an m6-EG prüfen.

**B2 – Szenario-Fehler: m3-Geschoss-EG zeigt keinen Fokus.**
Bilder: `m3-geschoss-eg-1440x900.png`, `m3-geschoss-eg-nah-1440x900.png` – Umschalter auf "Übersicht", Gebäude geschlossen, keine Leitungen, EG nur gehovert. Für das Muster mit Zubehör fehlt damit jeder Geschossnachweis.
Vorschlag (Hauptagent): Schritt in `werkzeug/design/szenarien/twin-leitungsrouter.json` korrigieren (Technik-Modus vor Geschossklick setzen bzw. auf Fokus warten), m3-EG in allen drei Fenstern neu aufnehmen. Gleichzeitig prüfen, ob die `-nah`-Aufnahmen überhaupt näher sind; falls die Zoomgrenze das verhindert, die Nahansicht per Rohr-/Anlagenauswahl (Kamerafahrt auf Objekt) erzeugen statt per Zoom, oder die `-nah`-Bilder aus dem PO-Satz streichen, damit der PO keine Doppel sieht.

### P2 – Restauflagen

**B3 – T-Stücke sind in den vorliegenden Bildern nicht als solche nachweisbar.** Bögen lesen klar als Pressbögen (zwei Ringe, Bogenkörper), Muffen auf geraden Stössen ebenfalls. Ein T-Abzweig (Kugelkern plus drei Ringe) ist in keinem Bild eindeutig erkennbar (`formstuecke/m6-zentrale-nah-1440x900.png` Bereich Verteiler; Gruppenstrang-T unter der Decke fehlt laut Auftrag). Da die PO-Rückmeldung ausdrücklich "T-Stücke fehlen" lautete, sollte die Sichtung mindestens ein klares T zeigen.
Vorschlag: ein Nahbild mit sichtbarem T (Haupt- auf Gruppenleitung in der Zentrale oder Strang in der Steigzone von schräg oben) ins PO-Paket; falls der Kugelkern zu klein ist, T-Körper als kurzen Querzylinder mit leichtem Bund statt Kugel.

**B4 – Rohrbündel scheinen durch die linken Panels.** `formstuecke/m6-zentrale-1440x900.png` und `-1280x720.png`, `m6u-zentrale-1440x900.png`: fünf parallele Rohre laufen diagonal unter "Hinweise" durch und erscheinen als rosa Streifen über dem Text; bei 1280x720 deutlich. Das ist bestehende Panel-Transparenz, wird aber durch das neue, lange Bündel erstmals auffällig.
Vorschlag (ui-ux-designer): Panel-Hintergrund für Inhaltsbereiche deckender (z. B. Deckkraft ≥ 0.92 bzw. stärkerer Backdrop-Blur), oder Kamera der Zentraleansicht so versetzen, dass das Bündel in die freie Bildfläche statt unter die Panels läuft.

**B5 – FBH-Kasten nur angewählt belegt.** `formstuecke/m5-fbh-nah-1440x900.png` zeigt den Kasten blau (Auswahl); ob der geschlossene weisse Kasten in der Szene wirkt, ist nur über die Modellvorschau belegt. Form (geschlossene Tür, Lüftungsschlitze, Griff) ist richtig und löst die Rückmeldung "zu durchsichtig" der Form nach.
Vorschlag: dasselbe Nahbild ohne Auswahl aufnehmen; Anschluss Rohr → Kasten prüfen (Bogen endet bei x ~675/y ~378 knapp links neben dem Kasten, Einführung von unten wie im GLB vorgesehen wäre glaubwürdiger).

**B6 – Bügel über der Wärmepumpe.** `formstuecke/m6-zentrale-1440x900.png` (x 580–700, y 160–250) und `m1-formstuecke-1440x900.png` (x 690–860, y 170–290): Verbindungen WP → Speicher/Verteiler steigen zur Decke und kommen wieder herunter; formal korrekt (keine Schleife), wirkt aber wie ein Umweg über kurze Distanz.
Vorschlag (Router, nach Messung): für Verbindungen innerhalb desselben Raums mit horizontaler Distanz < ~2 m bodennahe/halbhohe Führung zulassen statt Deckenebene; erst nach 2000er-Messung entscheiden (PO-Entscheid "Sonderfälle nicht zusammenfassen" beachten).

### P3

- **B7 – Konsole:** je Fenster ein `401 (Unauthorized)` beim Laden; vermutlich Sitzungsprüfung vor dem Login. Ursache einmal benennen, damit er nicht als Fehler im Abnahmebericht steht.
- **B8 – Ringdichte m6:** bei vielen Rohren (`formstuecke/m6-zentrale-nah-1440x900.png`) rund 40 Ringe im Bild; wirkt noch geordnet, nicht unruhig. Nicht weiter verdichten (keine Ringe an jedem Stoss ohne Formstück).

## Top-3-Massnahmen

1. **Rohr-Mindeststärke im Geschossfokus** (B1, 3d-designer) – grösster Hebel, weil der Router sonst im Geschoss nicht sichtbar wird.
2. **Szenario korrigieren und Nahbilder neu definieren** (B2, Hauptagent) – m3-EG neu, `-nah` per Objektauswahl statt Zoom oder weglassen.
3. **Ein klares T-Stück und den unangewählten FBH-Kasten ins PO-Paket** (B3/B5) – weil genau diese beiden Punkte die PO-Rückmeldung beantworten.

## Funktion und Leistung

- 60 fps in 1440x900, 1920x1080, 1280x720, beide Sätze; Renderer D3D11/RTX 3070 Ti.
- Keine CSP-Verletzung; 1x 401 je Fenster (B7); bekannte Three-Shaderwarnungen.
- Szenario m3-Geschoss-EG ohne Fokus (B2).
- Interaktionen selbst nicht ausgeführt (keine eigene Instanz in dieser Runde).

## Geschmacksurteile (subjektiv, nicht automatisch Regel)

- Der Sprung gegenüber der alten Führung ist gross: statt Knäuel über der Zentrale (`docs/abnahme/2026-11-12-gruppen/m3-zentrale-1440x900.png`, oben links) ein lesbares, technisches Leitungsbild mit gleichmässigen Spurabständen. m6 mit fünf parallelen Strängen wirkt wie eine sauber geplante Trasse.
- Pressringe in hellem Silbergrau sind die richtige Wahl: Sie geben Rhythmus und Massstab, ohne das KOO-Rot zu schwächen. Ringbreite und -überstand wirken stimmig zum Rohrdurchmesser.
- Lange Diagonalen in der Isometrie (z. B. `formstuecke/m6-zentrale-1440x900.png` oben, Strang entlang der hinteren Wand) wirken etwas grafisch-hart; kein Handlungsbedarf.

## Kandidaten für Lessons Learned

- Rohrstärke immer auch im **Geschossfokus** messen (Strichbreite in px), nicht nur in Übersicht und Nahansicht – zweite unabhängige Bestätigung der Lesson vom 12.11. (Haarlinien), diesmal für Gruppenleitungen.
- Szenarien für Abnahmebilder brauchen eine Zustandsprüfung (Modus, Fokus gesetzt) vor der Aufnahme; sonst landen falsche Bilder im PO-Satz.

## Gesamturteil: verbessern

Leitungsführung in der Zentrale und Formstücke sind bereit; vor der PO-Sichtung B1 (Haarlinien im Geschoss) und B2 (fehlende/doppelte Geschossbilder) beheben, dann ist der Satz bereit für PO-Sichtung.
