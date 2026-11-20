# Lebensdauer/Ampel – Kritik Runde 3 (gezielte Nachprüfung)

- Datum: 20.11.2026, visual-critic
- Stand: `m2c-interview`, HEAD `11efe06`
- Renderer: ANGLE RTX 3070 Ti D3D11 (echte GPU)
- Testdaten wie in r1/r2 (`lebensdauer-daten.mjs`)
- Szenario: `docs/design/kritiken/2026-11-19-lebensdauer-3d/szenario-3d.json`, dasselbe Vorgehen wie in r2. Die Situation "Marker über Tabelle" entstand dort im Schritt `modus-e-eg-auswahl` (EG-Fokus, Tabellenzeile 12 wählen → Kamerafahrt nah auf den Heizkörper).
- Fenster: 1440×900, 1920×1080, 1280×720
- Bilder: `docs/design/kritiken/2026-11-19-lebensdauer-r3/`

## r2-Reste

| r2 | Stand r3 | Beleg |
|---|---|---|
| P2.1 Marker anderer Geschosse wirken im Fokusgeschoss | **Behoben.** Die UG1-Reihe ist bei EG-Fokus kleiner (≈ 12 px) und blass; sie liest als "darunter" und konkurriert nicht mehr mit dem roten Heizkörper-Marker im EG | `modus-e-eg-1440x900.png`, `ausschnitte/eg-gedimmte-reihe-x4.png` |
| P2.2 Marker durch Tabellenpanel / im Seitenrand | **Behoben.** Dieselbe Kamera wie in r2 nachgestellt: keine Marker auf oder unter dem Tabellenpanel, kein Marker im unteren Rand. Die farbigen Pixel im unteren Drittel stammen nur von den Ampelzeichen in der Tabellenspalte | `modus-e-eg-auswahl-1440x900.png`, `ausschnitte/tabelle-rechts-unten-x3.png` (vgl. r2 `ausschnitte/marker-ueber-tabelle-x3.png`) |
| P3 Überlappung in der Reihe | **Behoben.** 11 Marker mit gleichmässigem Abstand, keine Überdeckung | `ausschnitte/eg-gedimmte-reihe-x4.png` |

## Nebenwirkungen geprüft

- Einstieg Modus E: unverändert gegenüber r2 (Zentrale gerahmt, Marker in voller Grösse und Farbe, weisser Rand) (`modus-e-technik-1440x900.png`).
- Lesbarkeit: Der Fokusgeschoss-Marker (Rot im EG) bleibt dominant. Die gedimmten Marker sind noch als Rot/Gelb/Grün unterscheidbar, aber bewusst zurückgenommen.
- Leistung: 60 fps bei Drehung in allen drei Fenstern.
- Konsole: nur `401` vor dem Entwicklungslogin (Werkzeug), keine CSP-Verletzung.

## Weiterhin offen (P3, unverändert aus r2, kein Blocker)

- Die Reihe vor den Pumpen erschwert die Zuordnung Marker ↔ Gerät ohne Hover.
- Einstiegsrahmung leicht rechts der Mitte.
- "Geschosse separieren" ohne sichtbare Wirkung in der Nahrahmung.

## Gesamturteil: **bereit**
