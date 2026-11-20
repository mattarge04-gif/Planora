# Lebensdauer/Ampel – Kritik Runde 2

- Datum: 20.11.2026, visual-critic (unabhängig, nur eigene Bilder)
- Stand: `m2c-interview`, HEAD `4113ad7` (darin `29be814`, `442f76c`, `4113ad7`)
- Renderer: `ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Ti (0x00002207) Direct3D11 vs_5_0 ps_5_0, D3D11)`: echte GPU
- Testdaten wie in r1 (`lebensdauer-daten.mjs`: rot 5, gelb 5, grün 5, grau 2; CHF 37'600, 8 ohne Preis)
- Szenarien:
  - `docs/design/kritiken/2026-11-19-lebensdauer-3d/szenario-3d.json`
  - `werkzeug/design/szenarien/lebensdauer.json`
  - `szenario-funktion.json` und `szenario-separiert.json` (Kopien aus r1)
- Fenster: 1440×900, 1920×1080, 1280×720
- Bilder: `docs/design/kritiken/2026-11-19-lebensdauer-r2/`
- Nicht geprüft wie in r1: Rolle ohne Schreibrecht (kein passendes Konto), Speichern ausgelöst.

## r1-Punkte einzeln

| r1 | Befund | Stand r2 | Beleg |
|---|---|---|---|
| P1 Gesamtsicht Modus E | Ampel unlesbar (0.02–0.10 %) | **Behoben.** Rot 0.36 % / gelb 0.34 % / grün 0.19 % (1440), 0.53/0.48/0.23 % (1280), 0.19/0.19/0.13 % (1920). Marker ≈ 22 px (rot/gelb) bzw. ≈ 12 px (grün), aus jeder Geschossansicht lesbar; der rote Heizkörper im EG ist klar markiert. Die Unterschreitung des 0.5-%-Ziels ist vertretbar: Das Ziel war nur ein Stellvertreter für "lesbar", und lesbar ist es jetzt. Die Gewichtung nach Dringlichkeit überzeugt | `modus-e-technik-*`, `modus-e-eg-1440x900.png`, `modus-e-og1-1440x900.png` |
| P2 Farbtreue/Flächen | gerendert ≠ Token, grüne Platten | **Behoben.** Median der Markerpixel: Rot `#d64541`, Gelb `#e08a1e` exakt; Grün `#2f9e6b` (EG/OG1) bzw. `#2a9665` (UG1, Kantenglättung). Bodenringe mit konstanter Breite, keine Farbplatten mehr | Messung, `modus-e-technik-1920x1080.png` |
| P2 Karte passt nicht | Speichern ausserhalb, Titel abgeschnitten | **Behoben.** Geschosse als Pillenzeile, Kopf sticky, Speichern/Abbrechen am Kartenfuss, auch bei 1280×720 | `karte-bearbeiten-1280x720.png`, `modus-e-auswahl-1440x900.png` |
| P2 Taste E / Übersicht | E schaltet nicht aus; Übersicht beendet E | **Behoben.** E an → E aus funktioniert, die Ansicht kehrt zur Übersicht zurück, der Canvas behält den Fokusring. Übersicht-Klick beendet E konsistent mit der neuen Regel | `f-taste-e-an-1440x900.png`, `f-taste-e-aus-1440x900.png`, `f-e-uebersicht-1440x900.png` |
| P3 Datenklarheit | Tabelle, Chip, Zustand, Trenner | **Behoben.** Tabellenspalte "Erneuerung" mit Ampelzeichen; Chip "Fällig 2026, CHF 2'600, 4 Bauteile ohne Preis"; Spalte Zustand im Plan; Platzhalter "Typwert 35'000" | `modus-e-technik-1440x900.png`, `plan-filter-1440x900.png`, `karte-bearbeiten-1280x720.png` |

## Noten

| Kriterium | r1 | r2 | Beleg |
|---|---|---|---|
| Gestaltungsqualität | 3 | 4 | Ruhige neutrale Technik, präzise Marker mit weissem Rand, Bodenring statt Platte |
| Originalität | 3 | 4 | Marker mit fester Pixelgrösse und Dringlichkeitsgewicht ist eine eigene, passende Lösung |
| Räumliche Wirkung | 3 | 3 | Marker schweben ohne Tiefe über allem; die Zuordnung zum Raum leidet (Punkt 1 unten) |
| Komposition | 2 | 4 | Einstieg rahmt die Zentrale. Sie liegt aber rechts der Mitte, die linke Szenenhälfte ist leerer Boden (`modus-e-technik-1920x1080.png`) |
| Geometrie | 3 | 4 | Keine Platten mehr; Bodenring folgt dem Gerät |
| Licht | 4 | 4 | Unverändert; Ring-Abdunklung durch AO (~7 %) im Bild nicht störend |
| Materialien | 3 | 4 | Tokenfarben exakt |
| Typografie | 4 | 4 | Unverändert sauber |
| Abstände | 4 | 4 | Kartenfuss sauber, Pillenzeile bündig |
| Referenz-Qualitätsrichtung | 3 | 4 | Auf Niveau der Twin-Ansichten |
| Bedienbarkeit | 2 | 4 | Karte, Taste E, Tabelle gelöst; Rest siehe Punkte 2–3 |
| Funktion | 3 | 4 | Keine CSP-Verletzung; ein Darstellungsfehler (Punkt 2) |
| Leistung | 5 | 5 | 60 fps in allen drei Fenstern |

## Messungen (objektiv)

- Ampelfläche und Farbe: siehe Tabelle oben. HSV-Klassierung wie in r1, Median je Stufe.
- fps bei Drehung in Modus E: 60 / 60 / 60 (1440 / 1920 / 1280).
- Konsole: nur `401` vor dem Entwicklungslogin (Werkzeug), `THREE.Clock deprecated`, bekannte D3D-Shaderwarnungen. Keine CSP-Verletzung.

## Offene Punkte (höchstens 5)

1. **P2 – Marker anderer Geschosse wirken, als lägen sie im fokussierten Geschoss (3d-designer).** Bei Fokus EG oder OG1 liegt die Markerreihe der UG1-Zentrale mitten im Grundriss von EG/OG1 (`modus-e-eg-1440x900.png`, `modus-e-og1-1440x900.png`, Reihe bei x≈830–1060, y≈340). Die Zentrale selbst ist dort von Platten verdeckt, die Marker zeigen also auf "nichts". Vorschlag: Marker von Geräten, die durch Geschossplatten verdeckt sind, auf ~35 % Deckkraft und kleiner (≈ 8 px) setzen. Alternativ an der Geschosskante bündeln mit Kürzel "UG1".
2. **P2 – Marker bleeden durch das Tabellenpanel und erscheinen im Seitenrand (3d-designer).** Bei Auswahl im EG (Kamera nah) liegen Marker von Anlagen ausserhalb des sichtbaren Szenenbereichs halbtransparent unter bzw. auf der Anlagen-Tabelle und unterhalb davon im Rand (`modus-e-eg-auswahl-1440x900.png`, unten rechts; `ausschnitte/marker-ueber-tabelle-x3.png`). Vorschlag: Marker nur zeichnen, wenn der Ankerpunkt im Szenen-Viewport liegt (auf die freie Fläche ohne Panels zugeschnitten), oder am Rand ausblenden.
3. **P3 – Markerreihe trennt Marker vom Gerät (3d-designer).**
   - Die 9 Marker der Zentrale stehen als gerade Perlenkette vor den Pumpen. Welcher Marker zu welcher Pumpe gehört, ist nur über die Lage ungefähr zu erraten, die Reihe verdeckt die Pumpen (`modus-e-technik-1440x900.png`).
   - In EG/OG1 überlappen Rot und Orange noch leicht (x≈905, y≈335).
   - Vorschlag: Bei Hover über einen Marker das Gerät hervorheben (vorhandene Hover-Hülle), und die Reihe oberhalb der Geräte statt auf Pumpenhöhe ansetzen.
4. **P3 – Einstiegsrahmung leicht dezentriert (3d-designer).** Die Zentrale liegt bei 1920×1080 etwa bei 55 % der Breite und 30 % der Höhe der freien Fläche; links viel leerer Boden. Vorschlag: auf die Bounding Box der Zentrale samt Markern zentrieren.
5. **P3 – "Geschosse separieren" in Modus E ohne sichtbare Wirkung in der Nahrahmung (3d-designer/ui-ux).** Schalter an, Bild unverändert (`s-e-separiert-1440x900.png`). Vermutlich korrekt, weil die Kamera auf UG1 rahmt; dann sollte der Schalter in dieser Lage die Kamera auf das Gebäude zurückführen oder einen Hinweis geben.

## Geschmacksurteile (subjektiv)

- Die runden Marker mit weissem Rand lesen klar, sind aber ein UI-Element in der Szene. Als Statussicht ist das vertretbar, solange nur Modus E sie zeigt.
- Die Gewichtung (Rot/Gelb gross, Grün klein) überzeugt mehr als ein reines Flächenziel. Mein 0.5-%-Ziel aus r1 ziehe ich als Massstab zurück.

## Kandidaten für Lessons Learned

- Statusfarben in 3D per Pixelmessung gegen Token prüfen. Zweimal belegt: Befund r1, Korrektur r2 messbar erfolgreich.
- Statusmarker nach Dringlichkeit gewichten, mit fester Bildschirmgrösse (wie Rohrverdickung). Das ist der zweite Fall nach den Rohren für die Regel "aus der Übersicht prüfen, Bildschirm-Mindestgrösse statt Geometrie".

## Gesamturteil: **bereit**

Alle fünf r1-Punkte sind behoben und messbar belegt. Die offenen Punkte 1–2 (P2) betreffen Grenzfälle der Markerdarstellung bei Geschossfokus bzw. naher Kamera. Sie stören das Kernziel nicht und können in einer kleinen Nachrunde folgen; vor einer PO-Demo mit Geschossfokus EG/OG1 empfohlen.
