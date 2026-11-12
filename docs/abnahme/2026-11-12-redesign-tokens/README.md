# Teilaufgabe 2 – gemeinsame Design-Tokens

12.11.2026 · Richtung A, PO-Wahl und Geschossschnitt siehe [Entscheid](../../design/entscheide/2026-11-12-redesign-digital-twin.md).

[F] Quelle: `app/web/src/design/tokens.ts`, Export `TOKENS`, ohne React-/Three-Abhängigkeit. Gruppen: Farbe, Typografie, Abstände, Radien, Flächen, Schatten, Material, Licht und Bewegung. UI-Masse in px, Weltmasse in m, Zeiten in ms. Die Übersicht importiert die Quelle direkt.

- Weiss/Grau, leichte Eisblauakzente, Heizung `#e5322d`; Statusfarben ausschliesslich für tatsächliche Zustände.
- Inter mit 12/13/15/22 px; Sekundärtext `#64717f`.
- Panels 12 px, Kacheln 8 px, Plattenkanten 0,05 m, Gerätekanten 0,03 m.
- Neutral-Tone-Mapping, matte Materialien, weiche UI-Schatten; Lichtwerte bleiben Arbeitswerte für die Szenenabnahme.
- Hover 160 ms, Panels 280 ms, Kamera 750 ms, Separieren 800 ms; reduzierte Bewegung 0 ms.

## Prüfung

[F] Webtests 55/55, Typprüfung und Build erfolgreich. Vite meldet die bekannte Bundlegrösse von rund 1,24 MB; es wurden keine Pakete hinzugefügt. Auf Windows wurden die Prüfungen mit `npm.cmd` ausgeführt.

[F] Eigene GPU-Aufnahmen: [1440 × 900](bilder/tokens-1440x900.png), [1280 × 720](bilder/tokens-1280x720.png), [Bericht](bilder/bericht.json). Renderer NVIDIA RTX 3070 Ti / D3D11, beide Fenster ohne Konsolenfehler/-warnungen. Beide Bilder visuell geprüft, alle Gruppen vollständig sichtbar.

[Unabhängige Kritik](../../design/kritiken/2026-11-12-redesign-tokens-r1.md).

## Reproduktion

```powershell
node docs/abnahme/2026-11-12-redesign-tokens/bauen.mjs
node werkzeug/design/screenshot.mjs --datei docs/abnahme/2026-11-12-redesign-tokens/index.html --szenario docs/abnahme/2026-11-12-redesign-tokens/szenario.json --aus docs/abnahme/2026-11-12-redesign-tokens/bilder
```

[F] Keine Produktansicht ist in diesem Schritt umgestaltet. Die Tokens werden bei Szene und Dashboard gezielt angebunden. Diese Übersicht belegt Werte und Lesbarkeit; sie ist kein Nachweis für Lichtwirkung, Funktion oder Leistung der späteren Szene. Dafür folgt Teilaufgabe 3 auf der eigenen Instanz 3100/54600.
