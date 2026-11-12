⚠️ DEGRADED: single-context (Planora-Criticauftrag verbietet weitere Subagenten; eigene Sichtprüfung vor Messungen/Detektor).

# Redesign Szene – Schlusskritik Runde 2

12.11.2026 · Ausgangscommit `7acc246`, uncommittierter Stand nach gezielter Schatten-/Kulissenkorrektur · **bereit für Abnahme 1, mit Restauflagen**.

Eigene GPU-Prüfung mit `werkzeug/design/screenshot.mjs`, aktualisiertem `twin-schnitt.json` und acht Scrollereignissen. 18 eigene Bilder: Übersicht, OG1, EG, Drehung, echte Nahaufnahme, reduziert; je 1440 × 900, 1920 × 1080 und 1280 × 720. [Messprotokoll](2026-11-12-redesign-szene-r2/bericht.json). Renderer: `ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Ti (0x00002207) Direct3D11 vs_5_0 ps_5_0, D3D11)`.

## Noten

| Kriterium | Note 1–5 | Beleg / Beurteilung |
|---|---:|---|
| Gestaltungsqualität | 4 | [Übersicht 1440](2026-11-12-redesign-szene-r2/uebersicht-1440x900.png): ruhiges Architekturmodell; graue Rechteckfläche beseitigt. |
| Originalität | 3 | Architekturatelier erkennbar; Hülle und Bäume noch repetitiv. Subjektiv. |
| Räumliche Wirkung | 4 | [OG1 1440](2026-11-12-redesign-szene-r2/schnitt-og1-1440x900.png): räumlicher Schnitt, Plattenstärke und erhaltenes EG gut lesbar. |
| Komposition | 4 | [1280](2026-11-12-redesign-szene-r2/uebersicht-1280x720.png): kompaktere Kulisse; Hülle und Bedienung bleiben vollständig erreichbar. Vertikaler Hüllenanteil ca. 68 % der freien Höhe; kein Fitverstoss aus Breite allein ableitbar. |
| Geometrie | 4 | [Nah 1920](2026-11-12-redesign-szene-r2/nah-1920x1080.png): Laibungen, Attika, Platten und Dachaufbau plastisch; kein auffälliges Z-Fighting. |
| Licht | 3 | Weich und hell; [EG 1920](2026-11-12-redesign-szene-r2/schnitt-eg-1920x1080.png) zeigt noch körnige Baumschatten. |
| Materialien | 4 | Matte weissgraue Hülle, zurückhaltend bläulicher Technikboden; Rahmen tragen durch Volumen statt schwarze Kontur. |
| Typografie | 4 | Sachliche kleine UI, Inter, echte Umlaute; Gebäudename aus bestehenden Daten. |
| Abstände | 4 | Geschosssteuerung in allen Grössen sauber, keine abgeschnittenen Bedienelemente. |
| Referenz-Qualitätsrichtung | 3 | Referenzen 01/02 selbst gesehen. Solide Annäherung; deren Detail-/Lichtreichtum noch nicht vollständig erreicht. Anlagen und Dashboard bewusst erst später. |
| Bedienbarkeit | 4 | Geschosswechsel, Esc, Drehen, Scrollzoom und Reduktion praktisch ausgeführt. |
| Funktion | 4 | Kern-Schnittregel erfüllt; keine Szenenblockade. Kein Anspruch auf Vollprüfung der erst später folgenden Anlagenfunktionen. |
| Leistung | 4 | Werkzeug zählt 60/60/60 fps bei Drehung. Kein Ersatz für GPU-Framezeiten und spätere Prüfung mit Anlagen. |

## Messungen (objektiv)

[Helligkeit und Weissanteil](2026-11-12-redesign-szene-r2/helligkeit.json), OpenCV-HSV V/S 0–255. Weissanteil V > 230, S < 25.

| Übersicht 1440 | V Mittel | V p95 | S Mittel | Weissanteil |
|---|---:|---:|---:|---:|
| Runde 1 | 224,58 | 240 | 3,77 | 72,15 % |
| Runde 2 | 232,88 | 240 | 3,60 | 90,58 % |

Die Aufhellung entsteht vor allem durch entfernte graue Schattenfläche und kleinere Kulisse; die Geometrie/Komposition änderte sich ebenfalls. Keine isolierte Materialmessung behauptet. Freier Hintergrund bei (90,90) bleibt normal RGB (232,233,235), reduziert (243,244,246): Renderingketten noch sichtbar unterschiedlich. Ganzbildvergleich Normal/Reduziert wäre wegen des inzwischen stärkeren Zooms im Szenario irreführend; der Hintergrundpunkt ist davon unabhängig.

[Reference-Look-Skript](2026-11-12-redesign-szene-r2/look-fit.json) erneut ausgeführt. Wie in R1 ist dessen S > 30-Maske für die absichtlich neutrale Architektur ungeeignet; automatische Entsättigungsdiagnose und IoU werden nicht als Produktfehler gewertet. Noch keine KOO-Anlagenfarben im geprüften Umfang. Hue-Drift bei nahezu neutralen Pixeln nicht interpretieren.

Impeccable-Detektor nach Sichtprüfung erneut `[]`; kein Produktcode geändert. Pflichtskills/Referenzen wie in [R1](2026-11-12-redesign-szene-r1.md). Keine zusätzlichen Agenten/Server oder Live-Overlays; Instanz bleibt in Hoheit des Hauptagenten.

## Top-3-Restauflagen

1. **3d-designer, P2:** Körnige Baumschatten beim späteren Lichtfeinschliff reduzieren. Besonders am ersten Baum links und in offenem EG sichtbar; keine erneute grosse Schattenfläche einführen.
2. **3d-designer, P2:** Hintergrundhelligkeit von normaler und reduzierter Renderingkette angleichen. Aktueller Unterschied ist sichtbar/messbar, aber hell genug und kein Fokusfehler.
3. **Hauptagent, spätere Teilaufgabe 7:** Schnitt bei vollständiger 360°-Drehung, Achsengrenzen, vorhandenen UG und echter Anlagenauswahl erneut prüfen. Aktuelles Beispiel enthält nur EG/OG1; keine erfundenen Untergeschosse als Testbeleg.

## Funktion und Leistung

- Geschlossene Übersicht mit Dach und Kulisse; OG1 nimmt Dach weg und erhält EG. EG entfernt OG1 und Dach. Zwei kameraseitige Aussenwände mit Fenstern/Rahmen fehlen am aktiven Geschoss. Rückwände und Raumunterteilung bleiben. Keine Abdunkelung.
- Drehung funktioniert und erhält Einblick; Szenario umfasst keine vollständige 360°-Grenzwinkelprüfung. Esc schliesst Schnitt, acht Scrollereignisse ergeben klar erkennbare Nahaufnahme. Beim freien starken Zoom darf Kulisse über den Bildrand laufen; das ist kein initialer Fitfehler.
- Reduzierte Darstellung funktioniert; Kamera/Geometrie bleiben erhalten, Schatten/AO entfallen.
- 60 fps in allen drei Fenstern während Drehung; erste ruhige Szene nicht zeitlich instrumentiert, pauschale 7-Sekunden-Wartezeit ist keine Ladezeitmessung.
- Je Fenster HTTP 401 vor/um Login, Quelle vom Standardwerkzeug nicht identifiziert. Je Fenster `THREE.Clock`-Deprecation. Bei 1440 zusätzlich fünf Shaderwarnungen X4000 (`f_getShadow_float4`) und eine X3595. Keine `pageerror`-/CSP-Meldung. Warnungen bei späterem Rendererupgrade prüfen; kein beobachteter Funktionsausfall.
- Vollständige Tastatur-/Screenreaderprüfung und `prefers-reduced-motion` nicht durch dieses Szenario nachgewiesen. «Reduziert» bezeichnet Qualitätsreduktion und ist kein solcher Nachweis.

## Geschmacksurteile / Kandidaten für Lessons Learned

Die kleinere Kulisse verbessert die Hierarchie deutlich. Der auffällige Schattenfehler ist beseitigt. Repetition von Bäumen/Fassaden und die noch flache Farbvariation bleiben subjektive Verfeinerungspunkte, keine neuen Prinzipien. Kandidat: Renderingqualität immer gegen den reduzierten Modus vergleichen, damit Hintergrunddrift und Effektartefakte schnell sichtbar werden. Noch keine neue bestätigte Regel.

## Gesamturteil: bereit

**Bereit für den PO-Abnahmeschritt «Gebäude, Licht, Schnitt»**, mit den genannten P2-Restauflagen. Keine dritte Korrekturrunde nötig. Keine Abnahme zukünftiger Anlagen, Karten oder Dashboardfunktionen. Fragen übersprungen: PO-Richtung und konkreter Teilauftrag sind festgelegt; Schlussrückmeldung erfolgt an den Hauptagenten.
