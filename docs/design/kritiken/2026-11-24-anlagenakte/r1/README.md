# Anlagenakte T8 – Kritik Runde 1 (visual-critic, unabhängig)

- Datum 25.11.2026, Branch `m2c-interview`, Commit `4176ddf`
- Renderer: `ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Ti … Direct3D11 vs_5_0 ps_5_0, D3D11)` – echte GPU, kein SwiftShader
- Testinstanz Port 3100 (laufend übernommen, nicht neu gestartet/gestoppt)
- Fenster 1440 × 900, 1280 × 720, 1920 × 1080
- Eigene Bilder: dieser Ordner (`k-*.png`, `bericht.json`); gesichtet auch `../r1-selbst/` und `../r1-selbst/zustaende/`
- Eigene Szenarien (nicht im Repo, Scratchpad): Ladezeit, PDF Bild ab, Suche + Enter, Esc in Suche, Bild-Zoom + Ziehen, Karte → Viewer → Esc → Esc, fps; Ablegen per Playwright (PNG + EXE getarnt als .pdf, danach wieder gelöscht, Bestand wie vorher 7 Dokumente)

## Gesamturteil: **verbessern**

Die Seite Dokumente, die Detailansicht und die Unterlagen in der Anlagenkarte wirken ruhig und präzise. Sie passen zur Twin-Sprache: weisse Panels, kleine Inter-Typografie, Statusfarben nur für echte Zustände. Ablegen, Virenprüfung, Abweisen, Öffnen, Seitenwechsel und der Esc-Rückweg funktionieren. Ein Versprechen löst der Viewer aber nicht ein: Die Textsuche meldet «1 Treffer», zeigt im Blatt jedoch nichts an. Zudem bleibt die Seitenleiste leer. Daher noch nicht «bereit».

## Die 3 wirksamsten Punkte (zuerst umsetzen, ui-ux-designer)

1. **P1 – Suchtreffer im Blatt markieren.** Die Suche «Kenn» springt auf Seite 1 und meldet «1 Treffer». Das Wort «Kennlinie» ist im Blatt aber nicht hervorgehoben (`k-pdf-suche-enter-1440x900.png`, Bereich y ≈ 550; ebenso `../r1-selbst/zustaende/viewer-suche-1440x900.png` mit «Pumpe», 4 Treffer, nichts markiert). Ursache im Code: `trefferSeiten` zählt nur Treffer je Seite, es gibt keine Textebene. Vorschlag: eine PDF.js-Textebene (`TextLayer`) über dem Canvas, Treffer als `eis`-Fläche mit 1 px `eis-akzent`-Rand, der aktive Treffer kräftiger und mit «2 / 4» im Suchfeld. Enter scrollt zum nächsten Treffer, nicht nur zur nächsten Seite. Nebeneffekt: Die Werte aus dem Datenblatt lassen sich dann markieren und kopieren, was heute nicht geht.
2. **P2 – Seitenleiste mit echten Miniaturen.** Die drei Blätter links sind leere weisse Rechtecke (`k-pdf-pagedown-1440x900.png`, x 42–74). Sie dienen nur als Zähler und brauchen 96 px Breite. Vorschlag: Miniaturen mit kleiner Auflösung (ca. 48 px breit, verzögert gerendert) oder die Leiste bei ≤ 3 Seiten ganz weglassen. Den Treffer-Punkt an der Miniatur beibehalten.
3. **P2 – Bild-Zoom um die Mitte, mit Ziehen und Einpassen.** Bei 200 % ist das Bild links oben verankert, der Inhalt läuft rechts und unten aus dem Fenster. Ziehen mit der Maus verschiebt nichts (`k-bild-zoom-1440x900.png` und `k-bild-zoom-gezogen-1440x900.png` sind identisch). Vorschlag: um die Fenstermitte bzw. den Mauspunkt zoomen, Ziehen zum Verschieben (Cursor `grab`), Doppelklick bzw. Taste 0 für «Einpassen». Dieselbe Einpassen-Stufe auch für PDF: Bei 1280 × 720 zeigt 150 % nur die obere Hälfte des Blatts (`k-pdf-suche-enter-1280x720.png`).

## Weitere Befunde

### P2

- **Ladezustand der Seite Dokumente:** Nach 0.8 s (eigenes Bild) und nach 2 s (Designerbild) steht nur «Dokumente werden geladen …» bei x = 14 px auf leerer Fläche, ausserhalb der Inhaltsspalte (x = 124) (`k-liste-800ms-1440x900.png`, `../r1-selbst/dokumente-liste-1440x900.png`). Gemessen: 1.8 s bis zur ersten Zeile. Vorschlag: das Gerüst (Umschalter, zwei Panels, 4–5 Skelettzeilen) sofort zeigen, den Text in der Spalte ausrichten.
- **Vorauswahl der abgelehnten Datei:** Mit «neueste zuerst» steht beim Öffnen die abgelehnte Rechnung oben und ist gewählt. Der erste Eindruck ist ein rotes «Gesperrt» (`k-liste-3800ms-1440x900.png`, `-1920x1080.png`). Vorschlag: die neueste *saubere* Datei vorwählen oder nichts vorwählen. Abgelehnte Dateien bleiben in der Liste sichtbar.
- **Unterlagen in der Anlagenkarte unter dem Falz:** Bei 1440 × 900 und 1280 × 720 sieht man beim Öffnen der Karte weder «Datenblatt» noch «Unterlagen (2)». Beides erscheint erst nach dem Scrollen (`../r1-selbst/karte-1440x900.png` gegenüber `k-karte-unterlagen-1440x900.png`). Vorschlag: einen kleinen Hinweis «2 Unterlagen» im Kopf der Karte neben dem Status, der zum Abschnitt springt. Alternativ die Unterlagen vor dem Abschnitt Lebensdauer einordnen.

### P3

- Datenblatt bearbeiten: Die Einheit steht hinter dem Wert («25 DN»), fachlich richtig ist «DN 25». Die Einheiten sitzen zudem ca. 2 px höher als die Ziffern (`../r1-selbst/zustaende/karte-datenblatt-bearbeiten-1440x900.png`, x ≈ 1385, y 323–391).
- Die Werkzeugleiste des Viewers springt beim Aktivieren der Suche um 28 px nach links, weil das Suchfeld breiter wird (Seitengruppe x 488 → 460; `k-pdf-pagedown` gegenüber `k-pdf-suche-enter`, 1440). Vorschlag: feste Breite für das Suchfeld.
- Detail einer abgelehnten Datei: «Kategorie: Sonstiges» steht als 15 px fett ohne Auswahlfeld und hebt sich so von den übrigen Werten ab (`k-liste-3800ms-1440x900.png`, x ≈ 1265, y 503).
- Meldung beim Löschen eines Fotos: «Übernommene Preise bleiben erhalten.» Für Bilder ist das ohne Bezug (`k-ablegen-aufgeraeumt-1440x900.png`). Den Satz nur bei PDFs mit übernommenen Preisen zeigen.
- EXE mit Endung .pdf: «Dateityp nicht erlaubt …» ist richtig. Genauer wäre «Inhalt passt nicht zur Endung .pdf» (`k-ablegen-sofort-1440x900.png`).
- Esc im Suchfeld schliesst sofort den ganzen Viewer, die Suche wird nicht zuerst geleert (`k-nach-esc-in-suche-1440x900.png`). Das ist laut Spec («Esc schliesst») korrekt und entspricht der PO-Linie «Esc einstufig». Nur als Hinweis, keine Änderung ohne PO.

## Noten (1–5)

| Kriterium | Note | Beleg |
|---|---|---|
| Gestaltungsqualität | 4 | Liste und Detail ruhig, klare Hierarchie (`../r1-selbst/detail-datenblatt-1440x900.png`); Viewer sauber, aber Seitenleiste leer |
| Originalität | 3 | Solide Dokumentenablage nach bekanntem Muster; eigenständig ist die Verknüpfung Bauteil ↔ Unterlage in der Karte |
| Räumliche Wirkung | – | T8 ändert die Szene nicht (Spec Abschnitt 5); Karte schwebt korrekt über dem Twin |
| Komposition | 4 | 2-Spalten-Raster zentriert, auch bei 1920 stimmig; Viewer-Overlay mit 20 px Rand; Karte zu lang (Unterlagen unter dem Falz) |
| Geometrie | – | nicht betroffen |
| Licht | – | nicht betroffen |
| Materialien | – | nicht betroffen |
| Typografie | 4 | Inter, 12/13/15, echte Umlaute (Grösse, Prüfung, Umwälzpumpe); kleine Ausreisser «Sonstiges» fett, «25 DN» |
| Abstände | 4 | 4-px-Raster eingehalten, Zeilenhöhe 50 px gleichmässig; Sprung der Werkzeugleiste |
| Referenz-Qualitätsrichtung | 4 | Panels und Karten auf dem Niveau von `01-dashboard.png`; Viewer noch unter Premium-Niveau (leere Leiste, keine Treffer) |
| Bedienbarkeit | 3 | Fokus kehrt nach Esc zum Auslöser zurück (`k-nach-esc-in-suche`, `k-karte-nach-esc`); Bild ab funktioniert; Suche ohne Markierung, Zoom ohne Ziehen |
| Funktion | 4 | Ablegen, Prüfung, Abweisen, Öffnen, Seite n, Esc zweistufig in der Karte (Viewer → Karte), Löschen ok; keine CSP-Verletzung |
| Leistung | – | Messung ungültig (siehe unten) |

## Messungen (objektiv)

- Ladezeit Seite Dokumente bis zur ersten Zeile: **1824 ms** (Playwright, 1440). In den Bildern bei 800 ms und 2 s noch leer.
- Ablegen PNG: «wird geprüft …» nach 250 ms sichtbar, nach ≤ 4 s **sauber** mit Vorschau und Kategorie «Foto» vorbelegt (`k-ablegen-sofort`, `k-ablegen-4s`).
- EXE als .pdf: sofort abgewiesen (HTTP 400), Meldung in Orange mit «Ausblenden».
- Konsole (alle 3 Fenster): keine CSP-Verletzung, kein `pageerror`. Ein 401 vor dem Login (bekannt, schon in `../r1-selbst/bericht.json`), ein 400 beim absichtlich ungültigen Ablegen. Dazu die bekannten Shader-Warnungen X4000/X3595 und `THREE.Clock deprecated`.
- **fps ungültig:** gemessen 9/6/9 (1440/1920/1280) bei der Kameradrehung. Während der Messung lag die GPU-Auslastung laut `nvidia-smi` bei 99 % durch ein fremdes Programm (Spiel `cs2`). Die Werte sagen nichts über Planora aus. Bei freier GPU wiederholen. T8 ändert die Szene nicht; ein Rückgang ist nicht zu erwarten.

## Funktion und Leistung – Ablauf geprüft

| Ablauf | Ergebnis |
|---|---|
| Dokumente öffnen, Liste, Filter sichtbar | ok (1.8 s Ladezeit, siehe P2) |
| Ablegen gültig / ungültig | ok / ok |
| Detail Datenblatt → Öffnen → PDF S. 1 | ok |
| Bild ab (PageDown) und «Nächste Seite» | ok, S. 2 |
| Textsuche + Enter | springt zur Trefferseite, **keine Markierung** (P1) |
| Esc im Viewer | schliesst, Fokus zurück auf «Öffnen» |
| Bild öffnen, Vergrössern × 3 | 200 %, Anker links oben, Ziehen ohne Wirkung (P2) |
| Twin → Umwälzpumpe → Unterlagen → Datenblatt | Viewer öffnet aus der Karte |
| Esc 1 / Esc 2 | Viewer zu, Fokus auf Unterlagen-Zeile / Karte zu, Geschossliste (`k-karte-esc2`) |
| Löschen (Aufräumen) | ok, Meldung mit Bestätigung |

## Geschmacksurteile (subjektiv, nicht automatisch Regel)

- Das PDF-Blatt bei 150 % wirkt im Overlay sehr gross. Die Toolbar ist dagegen fein. «Einpassen» als Startstufe würde ruhiger wirken.
- Die roten Gewerk-Icons (Heizung) neben «Verknüpfte Bauteile» sind korrekt nach KOO. In der Dokumentenseite sind sie die einzigen kräftigen Farbflächen und ziehen den Blick etwas stark an. Eine Variante mit 50 % Deckkraft in Listen wäre zu prüfen.

## Kandidaten für Lessons Learned

- Viewer- und Suchfunktionen nicht nur an der Trefferzahl messen. Zur Prüfung gehört der sichtbare Treffer im Bild (Beleg: diese Kritik P1; erst nach einer zweiten unabhängigen Kritik oder einer PO-Bestätigung eintragen).
- fps-Messung nur bei freier GPU; vorher `nvidia-smi` prüfen und die Auslastung im Bericht vermerken (Beleg: diese Runde).
