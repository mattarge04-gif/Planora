# Redesign Digital-Twin-Dashboard – Design

Stand 12.11.2026. Ersetzt die Gestaltung aus [visueller Zielentwurf](2026-11-12-visueller-zielentwurf-design.md); dessen Daten- und Logikteile bleiben.
Kennzeichnung: [F] Fakt, [A] Annahme, [?] offene Frage. de-CH, kein Eszett. UI-Texte mit echten Umlauten.

## 1. Ausgangslage und Ziel

[F] PO-Bewertung des Entwurfs vom 12.11.: "kein Leben, keine Farben, keine Schatten, fuehlt sich nicht 3D an". Der PO hat einen ausfuehrlichen Redesign-Brief geliefert (Premium Isometric 3D Digital Twin Dashboard).

Ziel: Beim ersten Oeffnen soll Planora wie eine hochwertige Digital-Twin-Plattform wirken, nicht wie ein technischer 3D-Prototyp. Stil: isometrisches Architektur-Diorama, stilisiert-semirealistisch, ruhige Enterprise-Oberflaeche. Kein Gaming-, Comic- oder Drahtgitter-Look.

Referenzen (`docs/design/referenzen/`): **01-dashboard.png ist Hauptreferenz** (Komposition, Panels, Licht); 02-gebaeude.png fuer Gebaeudegeometrie; 03-technik.png fuer technische Anlagen.

### PO-Entscheide dieser Runde [F]

1. Vorgehen: Huelle parametrisch aus den Daten, Anlagen als GLB-Modelle aus Blender, Licht im Browser einmalig weich berechnet (Variante 1).
2. Farben: Weiss mit verschiedenen Grautoenen, nur ganz leichte Blauakzente, damit die Koordinationsfarben (KOO) herausstechen. Heizung bleibt rot.
3. Geschossfokus (PO-Praezisierung nach Wahl von Ansatz A, 12.11.): alles bleibt hell. Oberhalb des gewaehlten Geschosses entfallen alle Geschosse und das Dach; darunter bleibt der Baukoerper sichtbar. Das gewaehlte Geschoss ist oben offen, seine beiden zur Kamera gerichteten Aussenwaende entfallen. Siehe `docs/design/entscheide/2026-11-12-redesign-digital-twin.md`.
4. Umfang: Geschosse separieren (Explosion) und Dokumente-Bereich als Platzhalter gehoeren in diese Runde. 2D-Ansicht fuer schwache Geraete kommt spaeter.
5. Abschnitte 3D-Welt, Dashboard und Technik/Vorgehen wie unten bestaetigt. Zwei Abnahmepunkte (nach Szene-Look, nach UI).

## 2. Die 3D-Welt

### Huelle (aus Daten, deterministisch)

- Geschossplatten mit sichtbarer Dicke (0.25 m [A]) und leicht abgerundeten Kanten; Stirnseite etwas heller als die Wand.
- Fassade als Raster aus Pfosten und Fensterbaendern, hellgraue Rahmen, Glas leicht blaeulich und teiltransparent nur wo es der Lesbarkeit hilft.
- Attika, Dachaufbau ueber Technik (Lueftungsgitter, Gelaender), Sockel.
- Innen: Waende 2.6 m [A]; im Fokus auf Bruestungshoehe geschnitten. Zonen ueber leicht verschiedene Bodengrautoene lesbar, Technikraeume etwas kuehler.
- Grundlage: bestehende Ableitung `app/web/src/szene2/huelle.ts` (Waende, Fensterraster, Baender, Attika, Aufbau, Platte), erweitert statt ersetzt.

### Kulisse (gestalterisch, nicht aus Daten) [A]

- Helle Grundplatte mit abgerundetem Rand wie ein Architekturmodell.
- Gehweg, einige stilisierte Baeume, Parkfelder; alles weiss/grau, zurueckhaltend; deterministisch platziert aus dem Grundriss-Bereich.

### Anlagen

- Ein GLB-Modell je Katalogtyp: Waermepumpe, Gas-/Oelkessel, Fernwaerme-Uebergabe, Speicher, Umwaelzpumpe, Heizungsverteiler, Heizkoerper, FBH-/TABS-Verteiler (Flaechenmuster bleibt am Boden).
- Gehaeuse weiss/silbergrau mit Details (Luefter, Anschluesse, Typenschild). Ein Farbband/Anschlussstutzen in der KOO-Farbe des Gewerks (Heizung rot) als eigenes Material, damit die Farbe zentral aus `farben.ts` kommt.
- Gleiche Anlagen instanziert. Unbekannter Typ: neutraler abgerundeter Kasten.
- Echte IDs (Symbol-Schluessel, Bauteil-IDs) bleiben an jedem Objekt fuer Auswahl und Tabelle.

### Leitungen

- Rechtwinklig und schematisch wie bisher (`leitungen.ts`), aber als Rohr mit runden Boegen; KOO-Rot, matt statt leuchtend. Hauptleitung dicker als Verteilung. Hinweis "schematischer Verlauf" bleibt.
- Rohrachse so hoch, dass das Rohr nicht im Boden liegt (Radius + Abstand).

### Licht und Materialien

- Matte weisse und hellgraue PBR-Materialien, subtile Unterschiede zwischen Boden, Wand und Anlagen; keine schwarzen Umrandungen.
- Umgebungslicht aus Licht-Panels (drei `Environment` mit `Lightformer`, ohne externe Datei), eine Sonne von links oben.
- Weiche Schatten einmalig berechnet und eingefroren (drei `AccumulativeShadows`/`SoftShadows` oder gleichwertig) plus Kontaktschatten; N8AO fuer Ecken und Kanten.

### Kamera

- Orthografisch, isometrische 3/4-Ansicht. Gebaeude fuellt 65–75 % der freien Flaeche zwischen den Karten; automatisches Zentrieren und Einpassen.
- Weiche Kamerafahrten bei Geschoss- oder Anlagenauswahl.

### Fokus und Separieren

- Fokus: gewaehltes Geschoss von schraeg oben einsehbar, ohne Decke und ohne die beiden zur Kamera gerichteten Aussenwaende. Hoehere Geschosse und Dach vollstaendig ausblenden; tiefere Geschosse einschliesslich vorhandener UG bleiben sichtbar. Rueckwaertige Aussenwaende und Raumunterteilung erhalten die Orientierung. Alles bleibt hell. Diese PO-Praezisierung ersetzt die fruehere Halbtransparenz-Regel fuer andere Geschosse.
- Separieren: Schalter faehrt Geschosse senkrecht auseinander (je ca. halbe Geschosshoehe [A]), animiert.
- Ein-/Ausblenden einzelner Geschosse.

## 3. Dashboard-Oberflaeche (nach Bild 1)

3D-Szene vollflaechig; Karten schweben darueber. Nur echte Daten, keine erfundenen Diagramme.

- **Kopfzeile** (transparent): links Logo und Wortmarke; Mitte Pill-Navigation "Übersicht" / "Technik" (aktive Pill dunkelgrau gefuellt); rechts Gebaeudewahl (Dropdown), Glocke mit Anzahl Hinweise, Profil-Kreis mit Menue (Abmelden).
- **Links:** Karte "Gebäude" (Name, Liegenschaft, drei Kennzahl-Kacheln Geschosse/Einheiten/Anlagen, Balken Anteil bestaetigter Anlagen in %); Karte "Hinweise" mit Filter-Chips (Alle/Offen), Klick faehrt zum Ort.
- **Rechts:** Karte "Geschosse" (Code, Anzahl Einheiten, Auge zum Ein-/Ausblenden, Schalter "Separieren").
- **Unten:** Karte "Anlagen" als kompakte Tabelle (Typ, Standort, Menge, Status); Klick auf Zeile waehlt die Anlage in 3D (Tabellenweg). Legende klein unten rechts (Gewerkefarben, "schematischer Verlauf").
- **Am Objekt:** Anlagenkarte (Icon, Name, Hersteller/Typ, ID, Status-Badge, Menge, Standort, versorgte Einheiten, Bereich "Dokumente" als Platzhalter "Noch keine Dokumente" mit deaktiviertem Hochladen-Knopf "folgt"); duenne Verbindungslinie zum Objekt.
- **Stil:** Panels Weiss 85 % mit leichtem Weichzeichner, 1 px heller Rahmen, weicher Schatten, Radius 12 px. Schrift Inter lokal, Groessen 12/13/15/22 px, Kennzahlen fett. Hintergrund `#f5f6f8` [A], Text Graphit, Grautoene fuer Hierarchie, Eisblau nur fuer Auswahl und Hover. Statusfarben nur fuer Zustaende: Gruen bestaetigt, Orange vorgeschlagen, Rot Stoerung (spaeter). Icons lucide-react.
- **Hover:** Anlage hebt sich leicht an, heller Umriss, kleiner Namens-Tooltip.

## 4. Technik

- Weiterverwendet: `huelle.ts`, `leitungen.ts`, `farben.ts` (Gewerke), `panelDaten`/`uebersicht`, Datenladen, Login, API, Fokus-/Auswahllogik. Keine Backend-Aenderung, keine Aenderung an Datenstruktur oder IDs.
- Neu: Szene mit drei (Kamera/Einpassen, Schatten, Lightformer), N8AO ueber @react-three/postprocessing, GLB-Anlagen, Kulisse, Dashboard-Layout.
- Neue Pakete [F, Stand 12.11.2026]: `@react-three/drei` 10.7.9 (MIT), `@react-three/postprocessing` 3.2.2 (MIT), `postprocessing` 6.39.6 (Zlib, peer three <0.188), `n8ao` 2.0.1 (ISC), `@fontsource-variable/inter` 5.3.0 (OFL-1.1), `lucide-react` (ISC [A], Version bei Umsetzung pruefen). Alle in Lizenz-Dossier und SBOM nachfuehren.
- CSP `default-src 'self'` bleibt: keine externen Ladevorgaenge. drei-Bausteine mit CDN-Standard (Environment-Presets, Draco-Decoder, Standardschrift von `Text`) nicht oder nur mit lokalen Dateien verwenden.
- GLB-Modelle mit Blender erstellt, unter `app/web/public/modelle/`, unkomprimiert (kein Draco), klein gehalten. Eigene Modelle, keine Fremd-Assets.
- Leistung: Schatten einmal berechnen und einfrieren; Schalter "reduziert" schaltet AO und Schattenberechnung ab; Instanzierung gleicher Anlagen.
- Alte Ansicht und bisherige Entwurf-Seite bleiben bis zur PO-Abnahme erreichbar, danach entfernen.

## 5. Vorgehen

| # | Schritt | Aufwand [A] |
|---|---|---|
| 1 | Szene-Look: Huelle mit Rahmen/Glas, Licht, Schatten, AO, Kulisse, Kamera | 2–3 PT |
| | **Abnahme 1:** Screenshots Uebersicht; weiter erst nach PO-OK | |
| 2 | Anlagen als GLB (Blender) mit KOO-Farbband, Leitungen mit Boegen | 2–3 PT |
| 3 | Dashboard-UI: Kopfzeile, Karten, Tabelle, Anlagenkarte, Inter, Icons, Umlaute | 2–3 PT |
| | **Abnahme 2:** Screenshots aller Zustaende | |
| 4 | Interaktionen: Hover, Fokus hell, Separieren, Tabelle <-> 3D, Kamerafahrten | 1–2 PT |
| 5 | Feinschliff, Lizenz-Dossier, Doku | 1 PT |
| | **Total** | **8–12 PT** |

Zusaetzlich zu den bisherigen +8 PT aus E40 (teilweise verbraucht). Neue Gesamtschaetzung nach Abnahme 1.

## 6. Pruefung

- Screenshots aus echtem Chrome mit Grafikkarte (Claude in Chrome), nicht nur Software-Rendering; neben die Referenzbilder legen.
- Tests der reinen Funktionen, Typpruefung, Build, CSP-Pruefung in der Browser-Konsole.
- Abnahme-Unterlagen unter `docs/abnahme/<datum>-redesign/`.

## 7. Nicht im Umfang

2D-Ansicht, echte Dokumentenablage, Stoerungsstatus aus Daten, weitere Gewerke ausser Heizung (Farbtabelle vorbereitet), Mobiliar, massgetreue Leitungsnetze.

## 8. Branch

`m2b2-redesign` ab `80db2a1` (`m2b1-sichtbarer-schnitt` bleibt unveraendert).
