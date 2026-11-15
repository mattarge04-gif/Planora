# Leitungsrouter und Formstücke – Kritik Runde 2 (scoped)

- Datum: 15.11.2026, Branch `m2c-interview`, Commit `d2c7229` (Fixrunde 1 zu `2026-11-15-leitungsrouter-r1.md`).
- Renderer laut `bericht.json` und `formstuecke/bericht.json`: `ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Ti ... Direct3D11 ... D3D11)` – echte GPU, gültig.
- Grundlage: neu aufgenommene Bildsätze `docs/abnahme/2026-11-15-leitungsrouter/*.png` und `.../formstuecke/*.png`; Schwerpunkt 1440x900, Stichproben 1280x720 und 1920x1080. Keine eigene Testinstanz (scoped Nachprüfung der gelieferten Bilder). Ergänzend Commit-Diff gelesen (nur für Schatten/Treffer-Risiko, s. N3).
- Umfang: nur B1, B2, B3, B5 und Folgen der Verdickung. B4, B6 bewusst offen (P2-Restauflagen aus r1).

## Status der r1-Befunde

| Befund | Status | Beleg |
|---|---|---|
| B1 Haarlinien im Geschossfokus | **behoben** | Strichbreite senkrecht zur Rohrachse 1440x900: `m3-geschoss-og1` ~4–5 px (vertikale Abtastung x 700: 5 px; diagonale Läufe 6–7 px horizontal ≙ ~3.5–4 px quer), `m6-geschoss-eg` 4–6 px, `m6u-geschoss-og1` 3–5 px, `m5-geschoss-og1` 4–6 px. 1280x720: `m3-geschoss-og1` 4–5 px, `m6-geschoss-eg` 3–5 px. 1920x1080: `m3-geschoss-og1` 4–5 px. Vorher 1–2 px. Rohre lesen jetzt als Rohre mit Glanzkante, nicht als Draht (`m3-geschoss-og1-1440x900.png`, Bildmitte). |
| B2 Szenario m3-EG ohne Fokus, `-nah` = Normalbild | **behoben** | `m3-geschoss-eg-1440x900.png`: Technik aktiv, EG gewählt, Zentrale mit Leitungen sichtbar. `m3-geschoss-eg-nah-1440x900.png` ist deutlich näher (Rohre, Pressbogen, FBH-Kasten bildfüllend) – kein Doppelbild mehr. |
| B3 T-Stück nicht nachweisbar | **behoben, knapp** | `formstuecke/m3-t-stueck-nah-1440x900.png`, x ~740 / y ~237: Abzweig mit Kern und drei Pressringen klar als T lesbar (Ausschnitt 4x vergrössert geprüft). Im Gesamtbild aber nur ~25 px gross und nicht im Bildzentrum – die PO muss es suchen. |
| B5 FBH-Kasten nur angewählt | **behoben** | `formstuecke/m5-fbh-kasten-nah-1440x900.png`, x 730–785 / y 380–470: Kasten ohne Auswahl, geschlossen, Lüftungsschlitze und Griff erkennbar, hellgrau-weiss (Front im Eigenschatten RGB ~170/173/178). Anschluss jetzt unten seitlich über Pressbogen in den Kasten – glaubwürdiger als in r1. |

## Neue Befunde durch die Verdickung

### N1 – Band-Effekt bei eng parallelen Strängen (P2)

Objektiv: In `m6-technik-1440x900.png` (x 750–960 / y 320–470) liegen die Vor-/Rücklaufpaare aus der Distanz ohne sichtbare Fuge aneinander; senkrechte Abtastung x 850 ergibt rote Läufe von 15 und 10 px statt vier Einzelrohren. Bei 1280x720 (`m6-technik-1280x720.png`, x 640–880 / y 240–400) überlappen die Paare am linken Bogen zu zwei Bändern (Läufe 14–17 px). In `m5-geschoss-og1-1440x900.png` (x 660–840 / y 200–300) bleiben die Paare dagegen mit schmaler heller Fuge getrennt; in `formstuecke/m6-zentrale-1440x900.png` (Zentrale, grösserer Zoom) sind alle Stränge einzeln lesbar.

Geschmacksurteil (subjektiv): In der Technik-Gesamtübersicht ist ein Bündel als "Trasse" akzeptabel und sogar lesbarer als fünf Haarlinien – die Struktur (wie viele Stränge, wohin) wird aber erst in Zentrale/Geschoss lesbar. Das Bündel wirkt in `m6-technik` etwas plump und farblich dominant (gesättigte rote Masse in einem sonst weissen Bild), ist aber kein Fehler im Leitungsbild. Kein Blocker für die PO-Sichtung, wenn der PO darauf hingewiesen wird.

Vorschlag (3d-designer, nach PO-Rückmeldung): Obergrenze des Faktors im Technik-Gesamtbild senken (z. B. 2.5 statt 3.5) oder Zielbreite nur im Geschossfokus auf 4.4 px setzen; alternativ die Verdickung so begrenzen, dass sie die Fuge zwischen Parallelspuren nicht überschreitet (Faktor ≤ (r + Fuge/2)/r für gebündelte Spuren).

### N2 – Formstücke und Pressringe aus der Distanz (kein Befund)

Ringe und Bögen werden mitverdickt und bleiben proportional zum Rohr (`m6-geschoss-eg-1440x900.png`, Bögen x 600–620 / y 280–300 und x 835–870 / y 265–300). Keine abstehenden oder verlorenen Ringe. Nahansicht unverändert (`formstuecke/m6-zentrale-1440x900.png`, `m3-geschoss-eg-nah-1440x900.png`): keine Plumpheit in der Nähe.

### N3 – Schatten und Trefferfläche nicht belegt (P2, Prüfauftrag)

Nicht im Bild belegt, aus dem Diff abgeleitet: Die Verdickung sitzt in `onBeforeCompile` des Hauptmaterials (`app/web/src/szene3/rohrStaerke.ts`). Schattentiefe-Material und Raycast nutzen die echte Geometrie. Folgen aus der Distanz: (a) Schatten der Rohre bleiben dünn – in den vorliegenden Bildern nicht störend, Pipe-Schatten sind bei diesem Zoom kaum sichtbar; (b) die klickbare Fläche ist bis zu 3.5x schmaler als das sichtbare Rohr (bei ~4.4 px sichtbar ≈ 1.3 px treffbar). Auswahl-Umriss eines Rohrs aus der Distanz ist in keinem Bild belegt (`formstuecke/m5-fbh-nah` zeigt nur Anlagenauswahl).
Vorschlag: im Browser einmal im Geschossfokus ein Rohr anklicken (Trefferquote, Umriss/Auswahlfarbe auf verdicktem Rohr) und Bild aufnehmen; falls schwer treffbar, Raycast-Toleranz bzw. unsichtbare Treffergeometrie mit gleichem Faktor.

## Noten (nur geänderte Kriterien)

| Kriterium | r1 | r2 | Beleg |
|---|---|---|---|
| Gestaltungsqualität | 4 | 4 | Geschossbilder jetzt auf Zentrale-Niveau; Bündel in `m6-technik` leicht plump (N1). |
| Räumliche Wirkung | 4 | 4 | Rohre im Geschossfokus mit Volumen und Glanzkante statt flach. |
| Komposition (Leitungsbild) | 4 | 4 | Geschoss lesbar (`m6-geschoss-eg`); Bündel in Gesamtübersicht verschmolzen (N1). |
| Funktion | 3 | 4 | Szenario korrekt, alle Geschossbilder mit Fokus, `-nah` echt nah. Rohrauswahl aus Distanz unbelegt (N3). |
| Leistung | 5 | 5 | 60 fps in allen drei Fenstern, beide Sätze. |

## Funktion und Leistung

- 60 fps in 1440x900, 1920x1080, 1280x720 (beide `bericht.json`); Renderer D3D11/RTX 3070 Ti.
- Konsole unverändert: je Fenster 1x `401 (Unauthorized)` beim Laden (B7, P3 aus r1), bekannte Three-Warnungen (`THREE.Clock` veraltet, Shader X4000/X3595). Keine CSP-Verletzung.
- Interaktionen nicht selbst ausgeführt (scoped, keine eigene Instanz).

## Verbleibend

- P1: keine.
- P2: N1 Band-Effekt in Technik-Gesamtübersicht (nach PO-Urteil), N3 Rohrauswahl/Trefferfläche aus Distanz prüfen, B4 Panels durchscheinend (Rohrbündel unter "Hinweise", weiter sichtbar in `formstuecke/m6-zentrale-1440x900.png` und `m3-t-stueck-nah`), B6 Bügel über WP.
- P3: B7 401 in Konsole; T-Stück im PO-Paket markieren oder Kamera so legen, dass es im Bildzentrum liegt.

## Top-3-Massnahmen

1. **PO-Sichtung mit Hinweis auf N1** – Bündel in `m6-technik` ausdrücklich zeigen und fragen, ob Trasse-als-Band gewünscht ist; erst danach Faktor-Obergrenze anpassen.
2. **Rohrauswahl aus Distanz prüfen** (N3) – ein Klick im Geschossfokus, Bild mit Auswahl; Trefferfläche bei Bedarf an die Verdickung angleichen.
3. **B4 Panel-Deckkraft** – die verdickten Rohre machen das Durchscheinen unter "Hinweise" noch etwas deutlicher.

## Kandidaten für Lessons Learned

- Bildschirmbezogene Verdickung (Vertex-Shader) braucht dieselbe Logik für Schatten und Treffergeometrie, sonst weichen Bild, Schatten und Klickfläche voneinander ab.
- Verdickungsfaktor gegen den kleinsten Abstand paralleler Spuren prüfen, sonst verschmelzen Bündel aus der Distanz.

## Gesamturteil: bereit für PO-Sichtung

B1, B2, B3, B5 sind behoben und im Bild belegt. Die Verdickung erzeugt einen sichtbaren Band-Effekt in der Technik-Gesamtübersicht (N1), der ein Geschmacksentscheid für die PO ist, kein Blocker. N3 vor der Endabnahme im Browser nachprüfen.
