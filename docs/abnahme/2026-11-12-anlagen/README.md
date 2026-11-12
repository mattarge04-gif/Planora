# Teilaufgabe 4 – Anlagen (GLB) und Leitungen

12.11.2026 · Einstufung mittel · Auftrag [2026-11-12-teilaufgabe-4.md](../../superpowers/plans/2026-11-12-teilaufgabe-4.md). **PO-Sichtung offen.**

## Ergebnis [F]

- Neun eigene Anlagenmodelle aus Blender 5.1 (Skript `docs/design/modelle/anlagen.py`, Prüfung `pruefen.py`, 9/9 bestanden): `app/web/public/modelle/*.glb`, je 62–147 kB, < 8 000 Dreiecke, ohne Draco/Texturen. [Modellübersicht](../../design/modelle/vorschau/alle.png).
- Integration in `app/web/src/szene3/` (Codex): GLB lokal mit Ersatzkasten, echte Symbol-/Bauteil-IDs als `userData`, KOO-Material zur Laufzeit aus Tokens, Rohre mit runden Bögen (Haupt 0,07 m, Verteilung 0,045 m Radius [A], schematisch verdickt), Wand-/Deckendurchgänge mit Hülsen, Netz Erzeuger → Speicher → Verteiler → Abgaben [A], FBH/TABS als flache Bänder, eingefrorene Kontaktschatten, Sichtbarkeit nach Geschossschnitt.
- Szenario `werkzeug/design/szenarien/twin-technik.json`, Zoom zur Mausposition.

## Bilder (Runde 3, endgültig)

| Ansicht | 1440 × 900 | 1920 × 1080 | 1280 × 720 |
|---|---|---|---|
| Übersicht | [Bild](r3/uebersicht-1440x900.png) | [Bild](r3/uebersicht-1920x1080.png) | [Bild](r3/uebersicht-1280x720.png) |
| EG-Technik | [Bild](r3/eg-technik-1440x900.png) | [Bild](r3/eg-technik-1920x1080.png) | [Bild](r3/eg-technik-1280x720.png) |
| Technik mittel | [Bild](r3/technik-mittel-1440x900.png) | [Bild](r3/technik-mittel-1920x1080.png) | [Bild](r3/technik-mittel-1280x720.png) |
| Zentrale nah | [Bild](r3/nahaufnahme-zentrale-1440x900.png) | [Bild](r3/nahaufnahme-zentrale-1920x1080.png) | [Bild](r3/nahaufnahme-zentrale-1280x720.png) |
| OG1 | [Bild](r3/og1-1440x900.png) | [Bild](r3/og1-1920x1080.png) | [Bild](r3/og1-1280x720.png) |
| OG1 näher | [Bild](r3/nahaufnahme-og1-1440x900.png) | [Bild](r3/nahaufnahme-og1-1920x1080.png) | [Bild](r3/nahaufnahme-og1-1280x720.png) |
| Reduziert | [Bild](r3/reduziert-1440x900.png) | [Bild](r3/reduziert-1920x1080.png) | [Bild](r3/reduziert-1280x720.png) |

## Prüfung [F]

- Web 106/106, Typprüfung und Build grün (Bundle-Grössenwarnung bleibt, Teilaufgabe 8). Backend unverändert, nicht erneut ausgeführt.
- GPU RTX 3070 Ti / D3D11, 60 fps bei Drehung in drei Fenstergrössen. Keine CSP-Verletzung/`pageerror`; bekannte 401 beim Login, `THREE.Clock`, Shaderwarnungen X4000/X3595 ([Bericht](r3/bericht.json)).
- KOO-Rot gerendert ΔE ≈ 7,9 zum Token, Farbton stabil (kein F3). Übersicht: 0 Rot-Pixel durch die Hülle.
- Drei Runden: [R1](r1/) Haarlinien und fehlende Nahaufnahme → [Kritik R2](../../design/kritiken/2026-11-12-anlagen-r2.md) «verbessern» (Netz offen, Ausschnitte) → [Schlusskritik R3](../../design/kritiken/2026-11-12-anlagen-r3.md) «bereit für PO-Sichtung mit Restauflagen».

## Restauflagen

- P2: Verteiler als echten Knoten anschliessen (Abgänge mit Leitung, Reduzierung an Gerätestutzen, Wandhülse auf Zentraleseite).
- P2: körnige Schatten (jetzt auch am Zentraleboden), sichtbarer Bodenkontakt unter Wärmepumpe/Verteiler.
- P3: Ausschnitte nachschärfen (kein Objekt unter Titel, «Technik mittel» näher, OG1 näher).
- [?] PO: FBH-Bodenmuster bewusst sehr dezent (ΔL* 2,2) – stärker gewünscht?
- Auflage 5/7: Störungsrot und Heizungsrot haben denselben Farbton → Störung nur als Badge mit Icon und Text.

## Reproduktion

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.1/blender.exe' --background --factory-startup --python docs/design/modelle/anlagen.py
& 'C:/Program Files/Git/usr/bin/bash.exe' werkzeug/design/instanz.sh start
node werkzeug/design/screenshot.mjs --szenario werkzeug/design/szenarien/twin-technik.json --aus docs/abnahme/2026-11-12-anlagen/pruefung
& 'C:/Program Files/Git/usr/bin/bash.exe' werkzeug/design/instanz.sh stop
```
