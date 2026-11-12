# Interaktionen (Teilaufgabe 7) – Kritik Runde 1

- Datum: 12.11.2026, visual-critic (unabhängig; Umsetzerberichte und Root-Bilder `docs/abnahme/2026-11-12-interaktion/` nur als Szenario-Quelle, Urteil nur aus eigenen Aufnahmen)
- Stand: Commit `bc74ec8` auf `m2b2-redesign`, Arbeitskopie sauber
- Renderer: `ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Ti (0x00002207) Direct3D11 vs_5_0 ps_5_0, D3D11)` – echte GPU, kein SwiftShader
- Eigene Instanz 3100/54600, nach Prüfung gestoppt. PO-Server 3000/54500 nicht berührt.
- Ansichten:
  - `rundgang/` (twin-rundgang.json): Drehung 0–3, Polar flach/steil, OG1 gedreht, Tastaturfokus, Auswahl mit reduzierter Bewegung, Übersicht normal/reduziert – je 1440×900, 1920×1080, 1280×720
  - `dashboard/` (twin-dashboard.json): Übersicht, Technik, Tabellenauswahl, OG1, separiert, ausgeblendet, Profilmenü, Gebäudewahl, reduziert – je drei Fenster
  - `zusatz/` (eigenes Skript, 1440×900): volle Tab-Reihenfolge (45 Schritte, protokolliert), alle Szenenkürzel (←→↑↓, +/−, Bild ↑/↓, T, S, Esc) mit aria-live-Text, 360° in 10°-Schritten im Technik-EG inkl. Achsengrenzen (85°/95°, 175°/185°) und Hysterese-Hin-und-her, Polargrenzen per Tastatur, Verteiler-Auswahl mit Nahaufnahme (5 und 8 Zoomschritte, gedreht), reduzierte vs. normale Bewegung (Bilder 60/250/2000 ms nach Auslösen). Protokoll [zusatz/pruefung.json](2026-11-12-interaktion-r1/zusatz/pruefung.json)
- Screenshots: `docs/design/kritiken/2026-11-12-interaktion-r1/`

## Prüfung der Restauflagen aus Vorrunden

| Auflage (Quelle) | Stand | Beleg |
|---|---|---|
| Hintergrund normal/reduziert gleich hell (Szene R2, Dashboard R2) | **erledigt** | Freifläche (245, 246, 248) in normal und reduziert, alle drei Fenster, beide Szenarien (vorher 234/245) |
| Körnige Baum-/Bodenschatten (Szene R2, Anlagen R3) | **erledigt** | Baumschatten glatt ([uebersicht-normal 1920](2026-11-12-interaktion-r1/rundgang/uebersicht-normal-1920x1080.png) x 560–960, y 420–700); Bodenschatten am Verteiler weich, kaum Restkorn ([verteiler-nah-gedreht](2026-11-12-interaktion-r1/zusatz/verteiler-nah-gedreht-1440x900.png) x 850–1050, y 380–460) |
| Kontaktschatten unter Geräten (Anlagen R3) | erledigt für Verteiler | weicher Schatten unter Verteilerbalken sichtbar (ebd.); WP/Speicher nur aus Distanz geprüft |
| Verteiler als Knoten (Anlagen R3 Top-1) | **weitgehend erledigt** | Zuleitung mit Bögen und konstantem Querschnitt, Abgänge mit kurzen Bügeln, Reduzierungen an den Stutzen erkennbar ([verteiler-nah-gedreht](2026-11-12-interaktion-r1/zusatz/verteiler-nah-gedreht-1440x900.png) x 800–1050, y 160–450). Wandhülse auf Zentraleseite in meinen Ausschnitten nicht erkennbar – nicht bestätigt |
| 360°-Schnitt, Achsengrenzen (Szene R2 Top-3) | **erledigt** | 16 Azimute, an 85°/95° und 175°/185° jeweils genau die zwei kameraseitigen Fassaden offen, kein Fehlschnitt ([zusatz/r360-*](2026-11-12-interaktion-r1/zusatz/), [dreh-2 1920](2026-11-12-interaktion-r1/rundgang/dreh-2-1920x1080.png)). Hysterese 3° mit 10°-Schritten nicht auflösbar, aber hyst-a/b/c ohne Sprung |
| Polargrenzen | erledigt | 20°/75° greifen ([polar-min](2026-11-12-interaktion-r1/zusatz/polar-min-1440x900.png), [polar-max](2026-11-12-interaktion-r1/zusatz/polar-max-1440x900.png)); nie unter die Platte, oben bleibt Wandtiefe lesbar |
| UG | **nicht prüfbar** | Beispieldaten ohne UG; nur Unittests. Kein GPU-Beleg |
| Objektkarte 1280 Abstand 12 px (Dashboard R2 Top-3b) | erledigt | Kartenunterkante y 507, Tabellenoberkante y 520 ([tabelle-auswahl 1280](2026-11-12-interaktion-r1/dashboard/tabelle-auswahl-1280x720.png) x 1100) |
| Einpassung auf Auswahl (Dashboard R2 Top-1) | erledigt, mit neuem Folgeproblem | Verteiler zentriert im Freiraum, ca. 60 px; siehe Top-1/Top-2 |

## Noten

| Kriterium | Note 1–5 | Beleg / Beurteilung |
|---|---:|---|
| Gestaltungsqualität | 4 | Ruhiges Atelier, Panels sauber, Verteiler in Nahsicht jetzt ein glaubwürdiges Technikmodell. Abzug: graue Baumkugel im Vordergrund der Auswahlansicht ([tabelle-auswahl 1440](2026-11-12-interaktion-r1/dashboard/tabelle-auswahl-1440x900.png) x 400–560, y 510–610; ebenso 1280). |
| Originalität | 3 | Unverändert eigenständige helle Modellwelt; Kürzelleiste über der Szene ist eine schöne, unaufdringliche Lösung. Subjektiv. |
| Räumliche Wirkung | 4 | Schnitt bei jeder Drehung offen und plastisch; weiche Schatten tragen. |
| Komposition | 3 | Auswahl- und Zoomansichten: Szene läuft unter der Tabelle durch (Top-2), gewählte Anlage wandert beim Zoomen unter die Kopfzeile (Top-1). Nach Drehung/Neigung keine Neueinpassung (polar-max: Gebäude ca. 25 % der Freifläche) – als Nutzeraktion vertretbar. |
| Geometrie | 4 | Verteilerknoten mit Bögen/Reduzierungen; keine Lücken beim Schnitt. Kleine Auffälligkeit: helle Rauten-Platten unter jedem Baum mit feiner Kante ([uebersicht-normal 1920](2026-11-12-interaktion-r1/rundgang/uebersicht-normal-1920x1080.png) x 600–800, y 500–640). |
| Licht | 4 | Körnung behoben, Hintergrund angeglichen. Baumschatten jetzt eher glatte, gleichförmige Ellipsen (Geschmack). |
| Materialien | 4 | KOO-Rot satt, Verteiler grau/blau gut abgesetzt. |
| Typografie | 4 | Kürzelleiste mit `kbd` sauber; echte Umlaute in UI-Texten. «Buero»/«Beispielgebaeude» stammen aus den Beispieldaten, nicht aus UI-Text. |
| Abstände | 4 | 12-px-Raster jetzt auch bei 1280 eingehalten. |
| Referenz-Qualitätsrichtung | 4 | Nahsicht der Zentrale erreicht die Richtung von `03-technik.png` ohne Kopie. |
| Bedienbarkeit | 4 | Tab-Reihenfolge exakt wie verlangt: Kopfzeile → linke Karte → Szene → rechte Karten → Tabelle; sichtbare Fokusringe 2 px #5f88b0 (≈ 3.6:1 auf Weiss, ≥ 3:1). Abzug: Tabelle mit 8 Tab-Stopps (Top-3), T ohne Rückmeldung, wenn Technik schon aktiv. |
| Funktion | 4 | Alle Kürzel wirken; aria-live meldet «OG1 geöffnet», «Geschosse separiert/zusammengeführt», «Übersicht, Gebäude geschlossen», «Heizungsverteiler gewählt, EG · Technik». Reduzierte Bewegung springt (messbar, s. u.). Keine CSP-Verletzung. |
| Leistung | 5 | 60 fps bei Drehung in allen drei Fenstern, beide Szenarien. |

## Messungen (objektiv)

- **Hintergrund:** Freifläche normal = reduziert = (245, 246, 248) in 1440/1920/1280, Rundgang und Dashboard.
- **Reduzierte Bewegung** (mittlere Graustufen-Differenz im Freiraum zum Endbild nach 2 s):
  - Technik: reduziert 0.54 (60 ms) / 0.50 (250 ms); normal 7.91 / 3.60
  - Separieren: reduziert 1.13 / 1.00; normal 7.09 / 3.59
  - Reduziert ist also nach 60 ms am Ziel (Restwert = Schattenakkumulation), normal fährt sichtbar. Auswahl reduziert ([rundgang](2026-11-12-interaktion-r1/rundgang/reduzierte-bewegung-auswahl-1440x900.png), 300 ms) ist pixelgleich mit dem normalen Endbild ([dashboard](2026-11-12-interaktion-r1/dashboard/tabelle-auswahl-1440x900.png)). Hover-Anheben im reduzierten Modus nicht geprüft.
- **Zoom-Drehpunkt:** Verteiler nach Auswahl bei (730, 345) = Freiraummitte. Nach 5× «+» (Faktor 2.01) und 8× «+» (3.06) bei y ≈ 130 ([verteiler-sehr-nah](2026-11-12-interaktion-r1/zusatz/verteiler-sehr-nah-1440x900.png)) – genau die Projektion um die **Canvasmitte (720, 450)**: 450 − 105 × 3.06 = 129. Der Zoom ignoriert also den Freiraum.
- **Tab-Reihenfolge** (1440, protokolliert): Übersicht, Technik, Gebäude wählen, Hinweise, Profil → «Zum Ort in OG1» → Canvas → OG1, OG1 ausblenden, EG, EG ausblenden, Geschosse separieren → 8 Tabellenzeilen → Body. Landmarken: `main[Digital Twin]`, `header`, `nav[Ansicht]`, `aside[Gebäude und Hinweise]`, `aside[Geschosse und Anlage]`, `region[Anlagenliste]`, `status` (aria-live). Canvas: `tabindex=0`, `aria-label` mit Pfeil-/Zoomhinweis, `aria-keyshortcuts` um Bild ↑/↓, Pos1, 0, T, S, Esc ergänzt, `aria-describedby` auf die Kürzelleiste.
- **Polargrenzen:** 20° bis 75° (Code `POLAR_GRENZEN`), im Bild bestätigt.

## Top-3-Massnahmen

1. **szene – Zoom um das Ziel im Freiraum statt um die Canvasmitte** (`szene3/TastaturKamera.tsx`, `Kamera3.tsx`, ggf. Mausrad über OrbitControls). Heute wandert die gewählte Anlage bei Tastaturzoom unter die Kopfzeile «Übersicht/Technik» ([verteiler-sehr-nah](2026-11-12-interaktion-r1/zusatz/verteiler-sehr-nah-1440x900.png) x 560–860, y 0–250), beim Gebäude geht das Dach unter die Kopfzeile ([k-zoom-plus3](2026-11-12-interaktion-r1/zusatz/k-zoom-plus3-1440x900.png)). Vorschlag: Kamera mit `setViewOffset` auf den Freiraum versetzen (dann ist der Orbit-Mittelpunkt die Freiraummitte) oder nach jedem Zoomschritt das Orbit-Ziel so nachführen, dass der Zielpunkt seine Bildschirmposition behält. Mausrad mit derselben Regel prüfen [A: Mausrad nicht separat gemessen]. *(objektiv: Messung oben; Prinzip 6 Füllgrad/Freiraum)*
2. **szene – Freiraumschnitt und Kulisse in Nah-/Auswahlansichten** (`szene3/FreiraumSchnitt.tsx`, `Kulisse3.tsx`, `Szene3.tsx`). (a) Der Schnitt an der Tabellenoberkante gilt nur für einen Teil der Meshes: in Auswahl/Nahsicht laufen rote Rohre und Plattenkanten unter der halbtransparenten Tabelle durch, direkt neben der Legende «Heizung» ([verteiler-nah-gedreht](2026-11-12-interaktion-r1/zusatz/verteiler-nah-gedreht-1440x900.png) x 900–1300, y 620–900; [verteiler-sehr-nah](2026-11-12-interaktion-r1/zusatz/verteiler-sehr-nah-1440x900.png) x 480–560, y 780–880). Alle Szenengruppen in denselben Schnitt einbeziehen. (b) Ein Kulissenbaum steht als 150-px-Kugel im Vordergrund der Auswahlansicht (s. Noten, Gestaltungsqualität). Kulisse ab einer Zoomstufe (z. B. Faktor > 2 gegenüber Übersicht) ausblenden oder kameraseitige Bäume weglassen wie die Fassaden.
3. **ui – Tabelle als ein Tab-Stopp und Kürzel-Rückmeldung** (`karten/TwinAnlagen.tsx`, `karten/TwinSzenenTasten.tsx`). (a) Roving tabindex: nur die aktuelle/erste Zeile `tabindex=0`, übrige `-1`; ↑/↓ ist bereits vorhanden. Heute kostet die Tabelle 8 Tab-Stopps, bei grösseren Gebäuden Dutzende, bevor man wieder zur Kopfzeile kommt. (b) «T» im Technikmodus ohne sichtbare oder angesagte Wirkung (Ansage bleibt «OG1 geöffnet», [k-technik](2026-11-12-interaktion-r1/zusatz/k-technik-1440x900.png)): entweder T als Umschalter Übersicht/Technik mit Ansage oder Ansage «Technik bereits aktiv». (c) Optional: `aria-label` des Canvas nennt nur Pfeile/Zoom; die übrigen Kürzel stehen nur in `aria-describedby` – akzeptabel, aber «Bild auf/ab für Geschosse» ins Label aufnehmen wäre kürzer zugänglich.

## Funktion und Leistung

- **Kürzel:** ←/→ drehen 10°, ↑/↓ neigen 5° bis an die Grenzen, +/− zoomen, Bild ↓ öffnet OG1 → EG, Bild ↑ zurück, S separiert/führt zusammen, Esc → Übersicht. Kürzelleiste erscheint nur bei Tastaturfokus auf dem Canvas ([tab-canvas](2026-11-12-interaktion-r1/zusatz/tab-canvas-1440x900.png)). Gut.
- **Esc-Kette:** Auswahl → Geschoss → Übersicht funktioniert; Fokus bleibt sinnvoll (Tabellenzeile bzw. Profilknopf mit Ring nach Menü).
- **Separieren im Geschossfokus:** Schalter und Ansage korrekt, räumlich bei OG1-Fokus kaum sichtbar ([k-separieren](2026-11-12-interaktion-r1/zusatz/k-separieren-1440x900.png)) – bekannter Punkt aus Dashboard R2, unverändert, P3.
- **Nicht geprüft:** UG (keine Daten), Hover-Anheben reduziert, Mausrad-Drehpunkt, Wandhülse Zentraleseite.
- **Konsole:** 401 vor Login (Sitzungsprüfung, bekannt), `THREE.Clock`-Deprecation, D3D-Shaderwarnungen X4000/X3595 (bekannt). **Keine CSP-Verletzung**, keine pageerrors.
- **Leistung:** 60 fps bei Drehung 1440/1920/1280 (beide Szenarien). Ladezeit bis ruhige Szene nicht neu gemessen; nach 7 s in allen Aufnahmen ruhig.

## Geschmacksurteile (subjektiv, nicht automatisch Regel)

- Die Kürzelleiste unten in der Szene ist eine der besten Detaillösungen bisher: unaufdringlich, nur bei Tastatur sichtbar.
- Die Baumschatten sind jetzt glatt, wirken aber wie gleichförmige Ellipsen-Stempel; etwas weichere Ränder (grösserer Lichtradius) würden natürlicher wirken. Kein Muss.
- Die hellen Rauten unter den Bäumen lesen als Baumscheiben; wenn nicht beabsichtigt, entfernen, sonst ruhiger (ohne Kante).
- Steile Neigung (20°) liest fast als Grundriss – fachlich nützlich, ich würde die Grenze lassen.

## Kandidaten für Lessons Learned

- Kamera-Operationen (Zoom, Fahrt, Einpassung) immer gegen den **Freiraum** statt den Canvas prüfen: zweiter Befund nach Dashboard R2 (Einpassung) – jetzt beim Zoom. Kandidat, PO-Bestätigung nötig.
- Renderingqualität normal gegen reduziert vergleichen (Kandidat aus Szene R2) hat sich bewährt: die Hintergrundangleichung ist jetzt messbar belegt. Zweite unabhängige Bestätigung – kann dem PO zur Aufnahme vorgelegt werden.

## Gesamturteil: **bereit für PO-Sichtung, mit Restauflagen (verbessern in Teilaufgabe 8)**

Alle Hauptziele von Teilaufgabe 7 sind im Bild belegt: vollständige Tastaturbedienung mit korrekter Reihenfolge, Fokusringen, Landmarken und aria-live; reduzierte Bewegung springt messbar; 360° und Polargrenzen ohne Fehlschnitt; Schattenkörnung und Hintergrunddrift behoben; Verteiler als Knoten. Kein Rückweg an den Entscheid. Restauflagen: Zoom-Drehpunkt (szene, P2), Freiraumschnitt/Kulisse in Nahsicht (szene, P2), Tabellen-Tab-Stopps und T-Rückmeldung (ui, P3). UG bleibt ohne GPU-Beleg, bis echte Daten mit UG vorliegen.
