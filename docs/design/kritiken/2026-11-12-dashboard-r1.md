# Dashboard-Rahmen (Teilaufgabe 5) – Kritik Runde 1

- Datum: 12.11.2026, visual-critic (unabhängig, keine Umsetzerberichte verwendet)
- Stand: HEAD `1da8531` plus nicht committete Arbeitskopie (`seiten/Twin*`, `ui/**`, `karten/Twin*`, `dashboard/**`)
- Renderer: `ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Ti (0x00002207) Direct3D11 vs_5_0 ps_5_0, D3D11)` – echte GPU
- Eigene Instanz 3100/54600, nach Prüfung gestoppt. PO-Server 3000/54500 nicht berührt.
- Ansichten: Übersicht, Technik (EG), OG1, Profilmenü, Gebäudewahl, reduziert – je 1440×900, 1920×1080, 1280×720. Zusatz (1440, 1280): Tastaturweg Tab/Enter/Pfeil/Esc, Tabellenweg (Klick «Heizkörper»), Hover, Zoom.
- Screenshots: `docs/design/kritiken/2026-11-12-dashboard-r1/` und `.../zusatz/`
- Referenzen: `docs/design/referenzen/01-dashboard.png` (Hauptreferenz), `docs/design/entscheide/2026-11-12-redesign/ansatz-a.png`

## Noten

| Kriterium | Note | Beleg |
|---|---|---|
| Gestaltungsqualität | 4 | Ruhige, saubere Glaspanels, präzise Kopfzeile, gute Grautonhierarchie (`uebersicht-1440x900.png`). Abzug: leere rechte Spalte und schwebende Legende wirken unfertig (rechts unterhalb «Geschosse», x 1124–1420 / y 223–840). |
| Originalität | 4 | Eigenständige, zurückhaltende Umsetzung; keine Versal-Eyebrows, keine Deko-Diagramme, keine generischen KI-Muster (Gradient, Glow, Emoji). Pill-Navigation und Kennzahlkacheln sind gängig, aber gut ausgeführt. |
| Räumliche Wirkung | 4 | Panels schweben glaubwürdig (Weichzeichner, weicher Schatten), Szene bleibt Zentrum. Szene selbst nicht Gegenstand dieser Runde. |
| Komposition | 3 | Übersicht 1440/1920 gut gefüllt (Gebäude ohne Platte ca. 76 % Breite / 72 % Höhe der freien Fläche bei 1440). Aber: Modellplatte läuft unter Hinweise-Karte und Anlagentabelle (`uebersicht-1440x900.png` links x≈315, unten y≈665); Technik 1280 zu klein, Zentrale winzig (`technik-1280x720.png`, Wärmepumpe bei x≈805/y≈365 nur ca. 20 px); rechte Spalte ab y 223 leer, linke ab y 478 – Gewicht oben gestaut, Mitte-unten-rechts leer. |
| Geometrie | – | Nicht Gegenstand (Szene3, Teilaufgabe 3/4). |
| Licht | – | Nicht Gegenstand. Hinweis: Hintergrund normal (234,235,237) vs. reduziert (245,246,248) – bekannter P2 aus Szene-Runde weiter offen. |
| Materialien | 4 | Panels Weiss 85 % + Blur; Panel-Pixel (252,252,252) heben sich vom Grund klar, aber leise ab. |
| Typografie | 4 | Inter, Titel 15/600, Daten 12–13, Kennzahlen 22/600 tabellarisch; echte Umlaute in allen UI-Texten («Übersicht», «Gebäude», «Wärmepumpe», «Bestätigt», «Heizkörper», «öffnen», «vergrössern»). Abweichungen von der Skala 12/13/15/22: Wortmarke 17 px, Zähler-Badge 10 px, Kennzahl 20 px bei Höhe ≤ 820 px (`ui.css` Z. 33/67, `Twin.css` Z. 127). |
| Abstände | 4 | Rand 20 px, Kartenabstand 12 px, Spalten 328/296 px – im Token-Rahmen; Innenabstände konsistent. Tabellenzeilen 36 px. |
| Referenz-Qualitätsrichtung | 3 | Panelstil, Kopfzeile und Leichtigkeit erreichen die Richtung von Bild 1. Was fehlt gegenüber Bild 1: Dichte und Verzahnung – dort umrahmen Karten die Szene auf allen Seiten in ruhigem Raster, hier stehen drei Blöcke mit grossen Lücken. (Inhalte folgen in Teilaufgabe 6 – teilweise erwartbar.) |
| Bedienbarkeit | 3 | Tastatur gut: sichtbarer Fokusring (`zusatz/tab3-1440x900.png`), Enter öffnet Menü mit Fokus auf erstem Eintrag (`tab5-enter`), Pfeiltasten (`tab5-pfeil`), Esc schliesst und gibt Fokus an Auslöser zurück (`nach-esc`). Abzüge: Tabelle zeigt 4 von 8 (1280: 3 von 8) Zeilen ohne sichtbaren Hinweis auf Scrollbarkeit; Tabellenzeile nur über den Namens-Knopf klickbar, Fokusring umschliesst nur den Text (`zusatz/zoom-1440x900.png`, «Heizkörper»); Linkfarbe «OG1 öffnen» 3.7:1 auf Weiss bei 12 px (unter 4.5:1). |
| Funktion | 3 | Pills, Geschosskarte, Gebäudewahl, Profilmenü, reduzierte Darstellung, Esc-Rückweg funktionieren. Tabellenweg führt nur zum Geschoss (Technik EG), keine Auswahl der Anlage in 3D (`zusatz/tabelle-klick-1440x900.png`) – laut Spec Abschnitt 3 Pflicht, offenbar auf 6/7 verschoben. Konsole: 1× 401 beim Laden (Sitzungsprüfung vor Login, vermutlich erwartet), THREE.Clock-Deprecation, bekannte D3D-Shaderwarnungen; keine CSP-Verletzung. |
| Leistung | 5 | 60 fps bei Kameradrehung in allen drei Fenstern; Szene nach ≤ 7 s ruhig (nicht feiner gemessen). |

## Messungen (objektiv)

| Messung | Wert |
|---|---|
| fps Drehung 1440 / 1920 / 1280 | 60 / 60 / 60 |
| Mittlere Helligkeit (Luma) Übersicht / Technik / reduziert, 1440 | 234.8 / 235.7 / 241.5 |
| Mittlere Sättigung | 1.3–1.5 % (Farbe nur in KOO-Rot, Status-Grün, Warn-Orange – korrekt) |
| Anteil Pixel ≥ 240 normal / reduziert | 31 % / 80 % (Tonwertsprung, siehe oben) |
| Hintergrund normal / reduziert | rgb(234,235,237) / rgb(245,246,248); Token `grund` #f5f6f8 |
| Kontrast Sekundärtext #64717f auf Weiss / auf Kachel #f2f3f5 | 4.99 / 4.49 (Kachel knapp unter 4.5) |
| Kontrast Link #5f88b0 auf Weiss | 3.73 (zu tief für 12-px-Text) |
| Kontrast Badge Weiss auf #e08a1e | 2.68 (10 px; Zahl zusätzlich im aria-label, visuell schwach) |
| Kontrast Auswahl Text auf Eis #dbe6f0 | 12.0 |
| Freie Fläche 1440 (zwischen Karten) | x 348–1124, y 72–655 |

## Top-3-Massnahmen (ui-ux-designer; Dateien `seiten/Twin*`, `ui/**`, `karten/Twin*`)

1. **Komposition schliessen: Kartenraster statt drei Inseln.** Anlagentabelle nicht bei x 1108 enden lassen, sondern als untere Leiste bis unter die rechte Spalte führen (rechte Kante bündig mit «Geschosse», 20 px Rand) und die Legende in den Kopf der Anlagenkarte rechts oder als Fusszeile der Geschosskarte setzen. Linke und rechte Spalte unten auf eine gemeinsame Oberkante zur Tabelle ausrichten. Damit entsteht der umlaufende Rahmen von Bild 1, ohne Inhalte zu erfinden. Zusätzlich den `freiraum` an Szene3 exakt aus den gemessenen Kartenrechtecken (inkl. Tabellenoberkante) liefern, damit die Modellplatte nicht unter Karten läuft. *(Geschmack teilweise; Überlappung objektiv)*
2. **Anlagentabelle als echter Tabellenweg.** Ganze Zeile klickbar und fokussierbar (Zeile mit `aria-selected`/Fokusring über volle Breite statt Text-Knopf), Auswahl sichtbar in Eis (#dbe6f0) wie bei den Geschossen; Scrollbarkeit zeigen: weicher Ausblendverlauf am unteren Rand plus «4 von 8» bzw. Höhe so wählen, dass bei 1440×900 alle 8 Zeilen Platz haben (Platz ist rechts/unten vorhanden). Auswahl in 3D über die neue Szene3-Prop anbinden, sobald Codex sie liefert. *(objektiv: Spec Abschnitt 3)*
3. **Typo- und Kontrastskala bereinigen.** Wortmarke 15 px/600 oder 22 px (statt 17), Kennzahl bei kleiner Höhe 22 bleiben lassen und stattdessen Kachel-Padding reduzieren (statt 20 px), Badge 11–12 px mit dunklerem Orange oder graphitfarbener Zahl auf Orange-Punkt; Linkfarbe für Text auf mindestens 4.5:1 (z. B. #4a7298) – Eisblau-Akzent bleibt für Flächen/Ränder. Sekundärtext auf Kacheln minimal dunkler (#5e6b78). *(objektiv: Tokenskala und WCAG AA)*

## Funktion und Leistung

- Technik-Modus Kamera-Fit [F, bekannt, an Codex beauftragt]: Beim Wechsel auf Technik wird nicht auf das fokussierte Geschoss bzw. die Zentrale eingepasst; bei 1280×720 ist die Zentrale ca. 20 px gross, bei 1920 gut. Zusätzlich läuft die Kulisse bei 1440 unter die Tabelle. Bestätigt das Erfordernis eines Fits auf `freiraum`.
- Tabellenweg wählt keine Anlage in 3D, nur das Geschoss (siehe oben).
- Esc-Kette: Menü → schliesst; zweites Esc → zurück zu Übersicht – funktioniert, Hinweistext unten rechts wechselt korrekt («Esc: zurück zur Übersicht»).
- Gebäudewahl zeigt nur ein Gebäude plus «Alle Gebäude» – korrekt für Demo.
- Konsole: 401 (vor Login), THREE.Clock deprecated, D3D-Shaderwarnungen X4000/X3595 (bekannt); keine CSP-Verletzung.
- Leistung: 60 fps in allen Fenstern.

## Geschmacksurteile (subjektiv, nicht automatisch Regel)

- Die Kopfzeile ist das stärkste Element: leicht, präzise, die dunkle aktive Pill setzt einen klaren Anker. Die drei Rundknöpfe rechts wirken etwas gross (40 px) neben der 32-px-Pillhöhe; 36 px würden ruhiger wirken.
- Die Kennzahlkacheln sind gut, die Zeilen «Grundfläche/Bestätigte Bauteile» darunter etwas klein und nah am Balken – 4 px mehr Luft vor dem Balken.
- «Nicht erfasst» in drei von vier Zeilen der Spalte Hersteller/Typ dominiert die Tabelle grau; ein Gedankenstrich «–» mit Tooltip wäre ruhiger.
- Der Glasweichzeichner ist über dem fast weissen Grund kaum wahrnehmbar – kein Problem, aber die 85 % Deckkraft könnten bei hellerem Grund (Token #f5f6f8) noch dezenter wirken.

## Kandidaten für Lessons Learned

- Kamera-`freiraum` muss aus den tatsächlich gerenderten Kartenrechtecken (inkl. Kulisse/Modellplatte) abgeleitet und je Modus neu eingepasst werden; sonst läuft die Szene unter die Karten.
- Scrollbare Tabellen in schwebenden Karten brauchen einen sichtbaren Scrollhinweis – dünne Scrollbars sind in Screenshots und auf Touchpads unsichtbar.

## Gesamturteil: **verbessern**

Solider, hochwertiger Rahmen mit guter Tastaturbedienung und 60 fps; Panelstil und Kopfzeile treffen die Richtung. Vor einer PO-Abnahme: Komposition schliessen (Tabellenbreite, Legende, Überlappung mit der Kulisse), Tabellenweg vollständig und Skala/Kontrast bereinigen. Kein Rückgang an den Entscheid nötig.
