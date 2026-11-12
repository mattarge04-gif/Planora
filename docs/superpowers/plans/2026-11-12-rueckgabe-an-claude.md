# Rückgabe an Claude – Redesign Digital Twin

12.11.2026 · Codex übergibt die vollständige Verantwortung zurück an Claude. Deutsch de-CH, kein Eszett, UI-Texte mit echten Umlauten; [F]/[A]/[?].

## Zuerst lesen

1. Diese Datei vollständig.
2. `CLAUDE.md`, Abschnitt 0b (aktueller Codex-Stand oben).
3. `.claude/skills/planora-design/SKILL.md`, `docs/design/prinzipien.md`, `docs/design/designsystem.md`, `docs/design/fehler.md`.
4. `docs/design/entscheide/2026-11-12-redesign-digital-twin.md` – PO-Wahl und Schnittregel am Ende.
5. `docs/abnahme/2026-11-12-redesign-szene/README.md` und Schlusskritik `docs/design/kritiken/2026-11-12-redesign-szene-r2.md`.

## Arbeitsort und Grenzen [F]

- Aktueller Checkout `C:/web agency/planora/Planora`, Branch **`m2b2-redesign`**. Hier bleiben, nicht wechseln und nicht pushen. Keine neue Worktree nötig.
- Alle Arbeiten bis zur Übergabe sind committet. Codex und seine Designer/Critics arbeiten nach Zustellung der Übergabe nicht weiter.
- PO-Server **3000/54500 nicht stoppen oder neu starten**. Eigene Designinstanz 3100/54600 ist gestoppt. Für echte GPU-Aufnahmen ausschliesslich `werkzeug/design/instanz.sh` und `screenshot.mjs` benutzen.
- Stash `stash@{0}` blieb unangetastet; nicht anwenden/pop. Die neue Szene ist bereits regulär implementiert.
- Keine Architektur-/Datenmodell-/API-Änderung. Alte Seiten «Ansicht» und «Entwurf» bleiben erreichbar.

## Was Codex gemacht hat [F]

### Teilaufgabe 1 – Richtung gewählt

- Zwei eigenständige lokale Three.js-/HTML-Gesamtentwürfe, echte GPU-Bilder bei 1440 × 900 und unabhängige Kritik über drei Bildrunden.
- Bilder: `docs/design/entscheide/2026-11-12-redesign/ansatz-a.png`, `ansatz-b.png`.
- PO wählte **A – Architekturatelier**, aber mit einem geschossbezogenen Schnitt statt permanentem Eckfenster.
- Verbindlich: Bei Auswahl von z. B. OG1 bleiben darunter EG und vorhandene UG sichtbar. Oberhalb alle Geschosse und das Dach vollständig ausblenden. Das gewählte Geschoss ist oben offen; beide zur Kamera gerichteten Aussenwände mit ihren Fenstern/Rahmen entfallen. Rückseiten und Raumunterteilung bleiben; alles bleibt hell. Grundrissdaten bleiben unverändert. Regel 7, Spec und Entscheid sind entsprechend nachgeführt.

### Teilaufgabe 2 – gemeinsame Tokens

- `app/web/src/design/tokens.ts`, Export `TOKENS`, ohne React-/Three-Abhängigkeit. Farbe, Inter 12/13/15/22 px, Abstände, UI-/3D-Radien, Flächen, Schatten, Materialien, Licht und Bewegung.
- Heizungsrot **`#e5322d`**. Statusfarben nur für tatsächliche Zustände. Keine eigene neue Szenenpalette anlegen.
- Übersicht importiert Tokens direkt: `docs/abnahme/2026-11-12-redesign-tokens/`; GPU-Prüfung 1440/1280 und unabhängige Kritik, kein Korrekturbedarf.

### Teilaufgabe 3 – echte Szene und Schnitt

- Neue Seite `app/web/src/seiten/Twin.tsx` / `Twin.css`; in der bisherigen Gebäudeansicht über «Digital Twin» erreichbar. App-Navigation integriert, Rückweg vorhanden. Nur einfache Geschoss-/Qualitätssteuerung; Dashboard kommt später.
- `app/web/src/szene3/Szene3.tsx`, `Gebaeude3.tsx`, `Kulisse3.tsx`, `Instanzen.tsx`: parametrische geschlossene Hülle mit echten Fensteröffnungen, Laibungen, Rahmen, Fensterbänken, Plattenstärke, Attika, Dachaufbau und neutraler Kulisse.
- `schnitt.ts` und `geometrie.ts` mit Tests; Kamera für steileren Geschosseinblick erweitert. Zwei kameraseitige Fassaden werden beim Seitenwechsel nachgeführt. Innenwände aus den echten Einheitenrechtecken.
- Lightformer lokal, Neutral-Tone-Mapping, N8AO, BasicShadowMap plus drei `SoftShadows` (PCSS), einmalig akkumulierte Kontakte. Kulisserand 7 m.
- Wichtig: VSM plus `AccumulativeShadows` hatte grosse graue Flächen erzeugt, weil VSM auch `receiveShadow`-Objekte als Schattenwerfer behandelt. Behoben, unter **F8** in `docs/design/fehler.md` dokumentiert. Nicht erneut auf VSM umstellen.
- Neue Szenario-Datei `werkzeug/design/szenarien/twin-schnitt.json`: Übersicht, OG1, EG, Drehung, Nahaufnahme, reduziert, drei Fenstergrössen. Acht Wheel-Ereignisse sind nötig für deutlichen Zoom in der installierten OrbitControls-Version.
- Screenshot-Werkzeug ergänzt: lokale HTML-Dateien ohne Login via `--datei`; FPS-Drag läuft über die ganze Messdauer; exakte Buttonnamen unterstützt.

## PO-Abnahme 1 ist freigegeben [F]

Nach den endgültigen Szenenbildern schrieb der PO:

> passt machen wir in 30 min weiter wegen dem nutzung guthaben

Das ist die Freigabe von **Abnahme 1 (Gebäude, Licht, Schnitt)**. Die frühere Kennzeichnung «PO-Abnahme offen» ist überholt und in den aktuellen Standdateien korrigiert. **Keine erneute Freigabe desselben Schnitts verlangen.** Danach bat der PO um die Rückgabe an Claude und eine Mitteilung, was Codex gemacht hat.

Die angekündigte Nutzungspause respektieren: Übergabe übernehmen und kurz bestätigen; mit neuer Umsetzung beim nächsten Fortsetzungssignal des PO beginnen. Diese Rückgabe ist keine Aufforderung, während der Pause ungefragt weiterzuarbeiten.

## Commits dieser Codex-Übernahme [F]

- `e960912` – zwei Gestaltungsrichtungen mit GPU-Bildern zur PO-Wahl.
- `7acc246` – PO-Wahl A, verbindlicher Geschossschnitt, gemeinsame Design-Tokens.
- `711d32d` – plastische Gebäudehülle mit hellem Geschossschnitt, App-/Seitenintegration, Tests und Abnahmebilder.
- Zusätzlicher Rückgabe-Commit: dieses Dokument und nachgetragene PO-Abnahme. `git log -1` für dessen Hash.

## Prüfstand [F]

- Web **63/63**, Backend **417/417**, beide Typprüfungen und Webbuild grün. Auf PowerShell `npm.cmd` verwenden; `npm.ps1` war per Execution Policy gesperrt. Keine Systemrichtlinie ändern.
- Root und unabhängiger Critic je 18 endgültige GPU-Bilder: **RTX 3070 Ti / D3D11**, 1440 × 900, 1920 × 1080, 1280 × 720; **60/60/60 fps** bei kontinuierlichem Drehen. FPS zählt Browser-Animationstakte, kein GPU-Framezeitbenchmark.
- Endbilder `docs/abnahme/2026-11-12-redesign-szene/r2/`, Bericht und Übersicht im dortigen README. Eigene unabhängige Aufnahmen unter `docs/design/kritiken/2026-11-12-redesign-szene-r2/`.
- Keine CSP-Verletzungen oder `pageerror`. Auth-401 vor/um Login, `THREE.Clock`-Deprecation, im 1440-Lauf D3D-Shaderwarnungen X4000/X3595 ohne beobachteten Funktionsausfall; vollständig dokumentiert. Keine Warnungen verschweigen oder Bibliotheken ungefragt patchen.
- Docker-Suiten nicht erneut ausgeführt. Webbundle ca. 1,57 MB / gzip 476 kB, Feinschliff in Teilaufgabe 8.

## Als Nächstes: Teilaufgabe 4 [F]

**Anlagen als eigene GLB-Modelle aus Blender, Leitungen mit runden Bögen**, danach Technikansicht als GPU-Bilder an den PO. Nur echte Anlagen-/Standortdaten und IDs. Datenquelle/Katalog und bestätigten Umfang in der Spec nachlesen. Eine gemeinsame Tokenquelle für UI und 3D beibehalten, KOO-Heizungsrot kalibrieren.

Danach einzeln: 5 Dashboard-Rahmen, 6 Datenkarten/Tabelle/Objektkarte bis Abnahme 2, 7 Interaktionsfeinschliff und Separieren, 8 Leistung/Lizenzen/Doku. Nach jeder Teilaufgabe kurzer Stand plus Bilder; unabhängig durch Visual Critic prüfen.

## Bekannte Restauflagen [F]

- Körnige Baumschatten später beruhigen; Hintergrund normal/reduziert noch unterschiedlich hell. Critic stuft beides als P2 ein, kein erneuter Richtungsentscheid nötig.
- Vollständige 360°-/Achsengrenzenprüfung, echte UG, Anlagenauswahl, reduzierte Bewegung, umfassende Tastatur-/Screenreaderprüfung in Teilaufgabe 7. Der UG-Schnitt ist bisher mit reinen Tests belegt; die Demo enthält nur EG/OG1.
- Kamera-/Dashboardfit mit Karten erst in 5/6 endgültig abstimmen. Mehrrechteck-Hüllen erben eine bestehende Annahme der alten Ableitung.
- `frameloop="always"` vorerst; Schatten 64 Frames, Neuaufbau bei Fokus-/Kameraseitenwechsel. Weiterer Leistungsfeinschliff in 8.
- Anlagen und Dashboard sind **noch nicht** umgesetzt. Keine Teilaufgaben als fertig behandeln, die nur als Richtungsbild vorhanden sind.

Bei älteren widersprüchlichen Einstiegsangaben gewinnt diese Rückgabe samt aktueller PO-Freigabe.
