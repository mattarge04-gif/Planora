# Anlagenakte T8 – Kritik Runde 3 (visual-critic, Schlusskontrolle)

- Datum 25.11.2026, Commit `4389208` (Fixrunde 2 auf `772f53c`)
- Renderer: `ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Ti … D3D11)`, echte GPU
- Testinstanz Port 3100 (läuft weiter, nicht neu gestartet und nicht gestoppt)
- Fenster 1440 × 900, 1280 × 720, 1920 × 1080
- Eigene Bilder: dieser Ordner (`k-*.png`, `bericht.json`); Ladegerüst aus `../r3-selbst/dokumente-laedt-1440x900.png`

## Gesamturteil: **bereit**

Der P1 aus r2 ist behoben, die P2- und P3-Auflagen ebenfalls. Offen bleibt nur ein kleiner Punkt (siehe unten), der kein neues Bauen verlangt.

## Kontrolle der r2-Auflagen

| Punkt | Ergebnis | Beleg |
|---|---|---|
| P1 Sprungmarke «2 Unterlagen» | **behoben**: Kopf mit Titel, Status und ×, Geschossleiste und Kartenrahmen bleiben stehen, keine Lücke. Nur der Karteninhalt scrollt bis «Datenblatt»; «Unterlagen» ist danach in allen drei Fenstern sichtbar. Die Marke hat jetzt eine eigene Pill-Fläche. | `k-karte-sprung-1440x900.png`, `-1280x720.png`, `-1920x1080.png` |
| P2 PDF-Start | **behoben**: Start mit Seitenbreite, höchstens 125 %. Der Text ist ca. 13 px hoch und lesbar; «Einpassen» bleibt als Knopf. | `k-pdf-start-1280x720.png` (125 %) |
| P3 Bild über den Rand ziehen | **behoben**: Auch bei einem starken Zug (bis 2 % / 5 % des Fensters) liegt das Bild bündig am Rand, kein grauer Streifen | `k-bild-gezogen-1440x900.png` |
| P3 Fokusrahmen nach Taste 0 | **behoben**: Der Rahmen folgt der Rundung des Panels | `k-bild-taste0-1440x900.png` |
| P3 Bearbeiten-Ansicht der Karte | **behoben**: Kein halber Knopf mehr unter dem Kopf; «DN 25», Einheiten bündig | `k-karte-bearbeiten-1440x900.png` |
| Ladegerüst | **belegt**: Umschalter, Skelettzeilen und Detail-Skelett in der Inhaltsspalte | `../r3-selbst/dokumente-laedt-1440x900.png` |
| Zweimal Esc | Funktion ok: Viewer zu, dann Karte zu, Geschossliste sichtbar | `k-ende-1440x900.png` |

## Rest (P3, nicht blockierend)

- Nach zweimal Esc liegt weiterhin ein 2 px blauer Fokusrahmen um den ganzen Bildschirm, und die Tastenhilfe ist eingeblendet (`k-ende-1440x900.png`).
- Vermutlich ist das die bestehende Twin-Logik: Bei Tastaturfokus erscheint die Hilfe. Im Lauf folgte zudem eine fps-Drehung. Mit T8 hängt das nicht direkt zusammen.
- Empfehlung: Fokus nach dem Schliessen der Karte auf die gewählte Tabellenzeile setzen. Eine Entscheidung des Hauptagenten, ein Teil von T8 ist das nicht.

## Messungen (objektiv)

- GPU vor dem Lauf mit 27 % belegt (`nvidia-smi`); das liegt nahe an «frei».
- fps bei der Kameradrehung: **54 (1440) / 60 (1280) / 60 (1920)**.
- Konsole in allen drei Fenstern: keine CSP-Verletzung, kein `pageerror`. Nur der bekannte 401 vor dem Login und die bekannten Shader-Warnungen.

## Kandidaten für Lessons Learned

- `scrollIntoView` in schwebenden Karten vermeiden und nur den eigenen Scrollbereich bewegen. Beleg: r2 P1, Fix r3 in drei Fenstern bestätigt. Vorlage an den PO.
- Vor jeder fps-Messung die GPU-Auslastung festhalten. Beleg: r1 (99 %, ungültig), r2 (55 %), r3 (27 %, gültig).
