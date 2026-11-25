# Anlagenakte T8 – Kritik Runde 2 (visual-critic, unabhängig)

- Datum 25.11.2026, Branch `m2c-interview`, Commit `772f53c` (Fixrunde auf `4176ddf`)
- Renderer: `ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Ti … D3D11)`, echte GPU
- Testinstanz Port 3100 (läuft weiter, nicht neu gestartet und nicht gestoppt)
- Fenster 1440 × 900, 1280 × 720, 1920 × 1080
- Eigene Bilder: dieser Ordner (`k-*.png`, `bericht.json`); gesichtet ausserdem `../r2-selbst/` und `../r2-selbst/zustaende/`

## Gesamturteil: **verbessern** (ein neuer P1, sonst bereit)

Fast alle Befunde aus r1 sind sauber behoben. Die Suche markiert Treffer und zählt mit, die Miniaturen sind echt, Bild-Zoom und Ziehen funktionieren, und es wird die richtige Datei vorgewählt. Neu ist aber die Sprungmarke «2 Unterlagen» in der Anlagenkarte: Sie verschiebt die ganze rechte Spalte nach oben. Kartenkopf, Schliessen-Knopf und Geschossleiste verschwinden dabei. Wird dieser Punkt behoben, ist die Runde aus meiner Sicht **bereit**. Eine weitere volle Kritikrunde braucht es dafür nicht, eine Bildkontrolle der Sprungmarke in drei Fenstern genügt.

## Die 3 wirksamsten Punkte

1. **P1 – Die Sprungmarke verschiebt die Kartenspalte (neu, ui-ux-designer).** Nach einem Klick auf «2 Unterlagen» ist die Karte oben abgeschnitten. Sie beginnt erst mit «Datenblatt», Titel «Umwälzpumpe», Status, × und die Geschossleiste OG1/EG/UG1 sind weg. Darunter bleibt eine Lücke bis zur Tabelle (`k-karte-sprung-1440x900.png`: Karte endet bei y ≈ 407; `k-karte-sprung-1280x720.png`: Karte endet bei y ≈ 362, «Wartungsplan 2025.xlsx» halb abgeschnitten). Dasselbe zeigen die Designerbilder `../r2-selbst/karte-sprung-unterlagen-1280x720.png`. Ursache: `zuUnterlagen` in `TwinObjekt.tsx` ruft `scrollIntoView({ block: "start" })` auf. Das scrollt auch Vorfahren mit `overflow: hidden`, hier die Spalte des Overlays. Vorschlag: nur den eigenen Scrollbereich der Karte bewegen (`scroller.scrollTo({ top: ziel.offsetTop - kopfhöhe, behavior })`). Danach in allen drei Fenstern prüfen, dass Kopf und Geschossleiste stehen bleiben. Kleinigkeit: Die Marke heisst «Unterlagen», springt aber zu «Datenblatt», das darüber liegt. Das ist akzeptabel, solange beide Abschnitte danach sichtbar sind.
2. **P2 – Startmassstab für PDF: Seitenbreite statt Einpassen.** Gemessen: Bei Einpassen ist der Fliesstext im Datenblatt bei 1440 × 900 (87 %) ca. 9 px hoch, bei 1280 × 720 (66 %) ca. 7 px (`k-pdf-start-1440x900.png`, `k-pdf-start-1280x720.png`). Die Werte der Tabelle sind ohne Zoom nicht lesbar. Bei 125 % ist der Text ca. 13 px hoch und gut lesbar (`k-pdf-zoom-1440x900.png`). Meine Empfehlung (Geschmacksurteil mit messbarer Grundlage): Start mit **Seitenbreite, begrenzt auf höchstens 125 %**. Datenblätter liest man von oben nach unten, man betrachtet sie nicht als ganzes Blatt. «Einpassen» bleibt als Knopf und auf Taste 0. Bilder starten weiter mit Einpassen. Ob so entschieden wird, ist Sache des Hauptagenten bzw. PO (Stufe klein).
3. **P3 – Fokus und Ränder nach Tastaturaktionen.**
   - Nach Esc, Esc (Viewer zu, dann Karte zu) liegt ein 2 px blauer Fokusrahmen um den ganzen Bildschirm, und die Tastenhilfe überdeckt das Gebäude (`k-ende-1440x900.png`). In r1 war das nicht so (`../r1/k-karte-esc2-1440x900.png`). Vorschlag: Fokus auf die gewählte Tabellenzeile oder die Szene ohne sichtbaren Rahmen. Die Tastenhilfe nur auf Anfrage zeigen. Hinweis: Im Lauf folgte eine fps-Drehung, die Ursache ist deshalb nachzuprüfen.
   - Nach Taste 0 im Bild-Viewer hat der Fokusrahmen der Fläche eckige Ecken an der abgerundeten Unterkante des Overlays (`k-bild-taste0-1440x900.png`). Vorschlag: `outline-offset: -4px` und Radius wie das Panel.
   - Nach dem Ziehen bleibt rechts ein 24 px grauer Streifen; das Bild lässt sich über den Rand hinausschieben (`k-bild-gezogen-1440x900.png`, x 1396–1420). `klemmeVersatz` sollte bei Zoom > Einpassen bündig am Rand begrenzen.
   - Beim Bearbeiten des Datenblatts überdeckt der klebende Kartenkopf einen halben «Bearbeiten»-Knopf (`../r2-selbst/zustaende/karte-datenblatt-bearbeiten-1440x900.png`, y ≈ 230).

## Nachprüfung der r1-Befunde

| r1-Befund | Stand r2 | Beleg |
|---|---|---|
| P1 Suche ohne Markierung | **behoben**: Textebene, alle Treffer eisblau, der aktive kräftiger, «1 / 4» → «3 / 4», Pfeile und Enter, Sprung auf die Trefferseite | `k-suche-pumpe-1440x900.png`, `k-suche-enter2-1440x900.png` |
| P2 Seitenleiste leer | **behoben**: echte Miniaturen, Trefferpunkt an der Miniatur | `k-pdf-start-*` |
| P2 Bild-Zoom | **behoben**: Mausrad zoomt um den Zeiger (144 %), Ziehen verschiebt, Taste 0 / «Einpassen» → 92 % mittig; Rest siehe P3 | `k-bild-rad`, `k-bild-gezogen`, `k-bild-taste0` |
| P2 Ladezustand | **nicht beobachtbar**: Liste nach 300 ms schon vollständig (`k-liste-300ms-1440x900.png`); Ladegerüst laut Commit vorhanden, im Bild nicht belegt | – |
| P2 Vorwahl abgelehnte Datei | **behoben**: vorgewählt wird `o1-pumpen.pdf`, die neueste geprüfte Datei | `k-liste-fertig-1440x900.png` |
| P2 Unterlagen unter dem Falz | **teilweise**: Sprungmarke «2 Unterlagen» im Kopf gut sichtbar (`k-karte-1440x900.png`), Sprung aber fehlerhaft (P1 oben) | `k-karte-sprung-*` |
| P3 «25 DN» | **behoben**: «DN 25», Einheiten bündig | `../r2-selbst/zustaende/karte-datenblatt-bearbeiten-1440x900.png` |
| P3 Werkzeugleiste springt | **behoben**: Suchfeld mit fester Breite, Gruppen bleiben bei x 396 | `k-pdf-start` / `k-suche-pumpe` (1440) |
| P3 «Sonstiges» fett | **behoben** | `../r2-selbst/detail-abgelehnt-1440x900.png` |
| P3 Löschtext / Endungstext | laut Commit umgesetzt; in dieser Runde nicht erneut abgelegt | – |

## Noten (1–5)

| Kriterium | Note | Beleg |
|---|---|---|
| Gestaltungsqualität | 4 | Viewer jetzt auf Produktniveau (Miniaturen, Trefferstand); Karte nach dem Sprung beschädigt |
| Originalität | 3 | Bewährtes Viewer-Muster, sauber umgesetzt |
| Komposition | 3 | Sprungmarke zerlegt die rechte Spalte (P1); sonst stimmig |
| Typografie | 4 | Werkzeugleiste fein und ruhig; PDF-Start zu klein zum Lesen (P2) |
| Abstände | 4 | Werkzeugleiste stabil, 4-px-Raster |
| Referenz-Qualitätsrichtung | 4 | Panels wie `01-dashboard.png` |
| Bedienbarkeit | 4 | Suche, Enter/Umschalt+Enter, Taste 0, Mausrad, Ziehen, Doppelklick; Fokus-Ränder (P3) |
| Funktion | 4 | Alles geprüfte läuft; Sprungmarke mit Layoutfehler |
| Leistung | 4 | 47/51/52 fps bei geteilter GPU (siehe unten) |
| Räumliche Wirkung, Geometrie, Licht, Materialien | – | Szene nicht betroffen |

## Messungen (objektiv)

- GPU vor dem Lauf laut `nvidia-smi` mit 53–56 % durch andere Programme belegt (kein Spiel mehr, aber Desktop-Anwendungen). fps bei der Kameradrehung nach Viewer und Karte: **47 (1440) / 51 (1280) / 52 (1920)**. Die Selbstkontrolle der Designer nennt 60/60/60. Meine Werte liegen bei geteilter GPU nahe daran und zeigen keine Regression durch T8. Eine Messung bei ganz freier GPU steht aus.
- Konsole in allen drei Fenstern: keine CSP-Verletzung, kein `pageerror`. Nur der bekannte 401 vor dem Login und die bekannten Shader-Warnungen X4000/X3595 sowie `THREE.Clock`.
- Ladezeit Dokumente: unter 300 ms bis zur vollständigen Liste (Daten warm).
- Textgrösse PDF bei Einpassen: ca. 9 px (1440, 87 %), ca. 7 px (1280, 66 %); bei 125 % ca. 13 px.

## Geschmacksurteile (subjektiv)

- Die Treffer sind mit Fläche und Rand gut zu finden. Der aktive Treffer könnte noch etwas stärker abgesetzt sein, etwa mit voller `eis-akzent`-Unterlinie, weil inaktive und aktive Markierung bei 87 % nah beieinander liegen.
- Der Knopf «Einpassen» als Textknopf neben dem Zoom ist klar; im eingepassten Zustand ausgegraut, das ist richtig.

## Kandidaten für Lessons Learned

- `scrollIntoView` in schwebenden Karten nicht verwenden, weil es auch Vorfahren mit `overflow: hidden` scrollt; nur den eigenen Scrollbereich bewegen. Beleg: diese Runde P1, in den Designer- und Kritikbildern gleich. Eintrag erst nach Bestätigung.
- fps-Messung: GPU-Auslastung vorher festhalten. Beleg: r1 (Spiel, 99 %) und r2 (Desktop, 55 %). Zweimal aufgetreten, Kandidat für Lessons.
