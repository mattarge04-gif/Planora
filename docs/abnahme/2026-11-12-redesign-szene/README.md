# Abnahme 1 – Gebäude, Licht und Geschossschnitt

12.11.2026 · Teilaufgabe 3 · Richtung A, [PO-Entscheid](../../design/entscheide/2026-11-12-redesign-digital-twin.md).

**[?] PO-Abnahme offen. Weiter mit Anlagen (Teilaufgabe 4) erst nach PO-OK.**

## Ergebnis

[F] In der bisherigen Gebäudeansicht öffnet «Digital Twin» die neue Szene. «Gebäude» führt zurück; «Ansicht» und «Entwurf» bleiben erreichbar. Die Hülle nutzt die echten Grundriss-/Geschossdaten und dieselbe Tokenquelle wie das künftige Dashboard.

- Übersicht: geschlossene Hülle, echte Fensteröffnungen mit Laibungen/Rahmen/Bänken, Plattenstärke, Attika, Dachaufbau und neutrale Kulisse.
- Geschosswahl: alle höheren Geschosse und das Dach entfallen; tiefere Geschosse bleiben als Baukörper erhalten. Das ausgewählte Geschoss ist oben offen. Die zwei kameraseitigen Aussenwände samt Fenstern und Rahmen entfallen; Rückseiten und datenbasierte Innenunterteilung bleiben.
- Ortho-Kamera mit steilerem Einblick beim Fokus, Drehung, Scrollzoom, Escape zur Übersicht und reduzierte Darstellung ohne AO/Schatten.
- Lightformer, Neutral-Tone-Mapping, N8AO, weiche direkte Schatten und einmalig akkumulierte Kontakte. Keine externen Assets oder neuen Pakete.

[F] Anlagen/GLB und Leitungen folgen in Teilaufgabe 4; der Dashboard-Rahmen und die Datenkarten in 5/6. Die jetzige Geschossleiste dient der Bedienung und Prüfung dieser Szene. Das Beispiel enthält EG/OG1; UG wird durch reine Tests geprüft, nicht durch erfundene Produktdaten dargestellt.

## Endgültige Bilder (Runde 2)

| Ansicht | 1440 × 900 | 1920 × 1080 | 1280 × 720 |
|---|---|---|---|
| Übersicht | [Bild](r2/uebersicht-1440x900.png) | [Bild](r2/uebersicht-1920x1080.png) | [Bild](r2/uebersicht-1280x720.png) |
| OG1, EG bleibt | [Bild](r2/schnitt-og1-1440x900.png) | [Bild](r2/schnitt-og1-1920x1080.png) | [Bild](r2/schnitt-og1-1280x720.png) |
| EG, OG1 entfällt | [Bild](r2/schnitt-eg-1440x900.png) | [Bild](r2/schnitt-eg-1920x1080.png) | [Bild](r2/schnitt-eg-1280x720.png) |
| EG gedreht | [Bild](r2/schnitt-eg-gedreht-1440x900.png) | [Bild](r2/schnitt-eg-gedreht-1920x1080.png) | [Bild](r2/schnitt-eg-gedreht-1280x720.png) |
| Nahaufnahme | [Bild](r2/nah-1440x900.png) | [Bild](r2/nah-1920x1080.png) | [Bild](r2/nah-1280x720.png) |
| Reduziert, nah | [Bild](r2/reduziert-1440x900.png) | [Bild](r2/reduziert-1920x1080.png) | [Bild](r2/reduziert-1280x720.png) |

## Prüfung

[F] Root-Aufnahmen und [unabhängige Schlusskritik](../../design/kritiken/2026-11-12-redesign-szene-r2.md) mit eigenen weiteren 18 Aufnahmen: NVIDIA RTX 3070 Ti / D3D11, drei Fenstergrössen. Urteil **bereit für PO-Abnahme 1 mit Restauflagen**. [GPU-Bericht](r2/bericht.json).

- Web **63/63**, darunter acht neue Schnitt-/Geometrie-/Projektionsfälle: UG/EG/OG, ungeordnete Höhen, entfernte Fassaden, Fensteröffnungen, Raumgrenzen und Kamerafit.
- Web-Typprüfung/Build und Backend-Typprüfung erfolgreich; Backend **417/417**. Docker-Suiten in diesem Schritt nicht ausgeführt.
- **60/60/60 fps** während kontinuierlicher Kameradrehung, gemessen über Browser-Animationstakte. Kein Nachweis für GPU-Framezeiten oder spätere Leistung mit Anlagen.
- Keine CSP-Verletzungen oder `pageerror`. Pro Login der 401 der vorgelagerten Authentifizierungsprüfung; `THREE.Clock`-Deprecation aus der installierten Renderingkette. Im ersten 1440-Lauf zusätzlich fünf D3D-Shaderwarnungen X4000 und eine X3595. Kein beobachteter Funktionsausfall; Meldungen stehen ungekürzt im Bericht.
- Vite-Bundle rund **1,57 MB** (gzip rund 476 kB), Grössenwarnung bleibt für Teilaufgabe 8 offen.
- Eigene Instanz ausschliesslich über `werkzeug/design/instanz.sh`, Ports 3100/54600; nach Prüfung gestoppt. PO-Prozesse auf 3000/54500 nicht gestoppt oder neu gestartet.

## Zwei Sichtungsrunden

1. [Runde 1](r1/uebersicht-1440x900.png): Schnitt korrekt, aber VSM erzeugte grosse graue Flächen aus der Schattenempfängerebene. Kulisse zu dominant; ein Scrollereignis gab keinen brauchbaren Nahbeleg.
2. Runde 2: VSM durch BasicShadowMap plus PCSS ersetzt, Kulisserand 9 → 7 m und Parkabstand angepasst. Acht Scrollereignisse liefern einen echten Nahbeleg. Schattenfehler beseitigt; Schnitt unverändert. Ursache und Korrektur unter [F8](../../design/fehler.md) dokumentiert.

## Restauflagen

- Körnige Baumschatten beim späteren Lichtfeinschliff beruhigen; Hintergrund normal/reduziert noch unterschiedlich hell. Keine dritte Skizzenrunde nötig laut Critic.
- Vollständige 360°-Drehung/Achsengrenzen, reale UG und Anlagenauswahl in Teilaufgabe 7 nachprüfen. Reduzierte Bewegung und vollständige Tastatur-/Screenreaderprüfung noch nicht praktisch abgenommen.
- Mehrrechteck-Hüllen erben die bekannte Annahme der bestehenden Ableitung. Datengeometrie und IDs bleiben unverändert.
- Die Szene nutzt vorerst `frameloop="always"`; Schatten akkumulieren 64 Frames und werden bei Schnitt-/Kameraseitenwechsel neu berechnet. Weiterer Leistungsfeinschliff folgt in Teilaufgabe 8.

## Reproduktion

```powershell
& 'C:/Program Files/Git/usr/bin/bash.exe' werkzeug/design/instanz.sh start
node werkzeug/design/screenshot.mjs --szenario werkzeug/design/szenarien/twin-schnitt.json --aus docs/abnahme/2026-11-12-redesign-szene/pruefung
& 'C:/Program Files/Git/usr/bin/bash.exe' werkzeug/design/instanz.sh stop
```
