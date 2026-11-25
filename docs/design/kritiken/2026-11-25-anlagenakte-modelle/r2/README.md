# Anlagenakte T9 – GLB-Modelle – Kritik Runde 2 (visual-critic)

- Datum 25.11.2026
- Stand: Backend `ea484c5`, Web `e768a5d`
- Renderer `ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Ti … D3D11)`, echte GPU
- Testinstanz 3100, nicht neu gestartet
- Fenster 1440 × 900, 1280 × 720, 1920 × 1080
- Eigene Bilder in diesem Ordner (`k-*.png`, `bericht.json`), gesichtet auch `../r3-selbst/`

## Gesamturteil: **bereit**

Der P1 aus r1 ist behoben. Ausdehnungsgefäss und Sonstiges stehen an der Wand am Reihenanfang vor der Wärmepumpe. Beide sind mit einer eigenen Leitung über die Decke angeschlossen. Der KOO-Stutzen von Sonstiges endet nicht mehr ins Leere. In der Standardkamera verdeckt die Sammelleitung das Gefäss nicht mehr (`k-mag-nah-1440x900.png`). Im Twin steht «Hinweise 0». Damit wirkt die Zentrale wie eingebaute Technik und nicht mehr wie verstreute Platzhalter.

## Designerfrage: zwei parallele senkrechte Leitungen zur Decke

**Beibehalten.** Fachlich ist das richtig: Das Gefäss hängt am Rücklauf, Sonstiges am Vorlauf. Zwei getrennte Stränge sind ehrlich, eine zusammengelegte Leitung wäre falsch.

- Im Bild lesen die beiden Steigleitungen als sauber gesetzte Installation. Sie haben einen klaren Abstand (ca. 85 px bei 1440 nah) und Pressbögen wie im übrigen Netz (`k-sonst-nah-1440x900.png`, x 640 und x 725).
- Einziger Hinweis (P3, Geschmack): Aus der gedrehten Sicht laufen beide roten Stränge auf ca. 10–20 px eng an den rosa Gruppenleitungen beim Speicher vorbei (`k-mag-nah-gedreht2-1440x900.png`, x 740–800 / y 180–460). Das ist nicht falsch, wirkt aber dort dicht. Kein Handlungsbedarf vor der Demo; bei Gelegenheit kann der Router die Deckenführung etwas weiter von den Gruppensträngen absetzen.

## Weitere Beobachtungen

- Die r1-P3 (`dunkel` für Kappen und Verschraubungen) bleibt so empfohlen; dazu den Modellvertrag ergänzen.
- Testartefakte, keine Befunde:
  - In der Übersicht 1280 steht ein Hover-Label «Speicher», weil die Maus des Szenarios dort liegen blieb.
  - Der Fokusrahmen an der Tabellenzeile «Wärmezähler» stammt von der vorherigen Auswahl und Esc (`k-uebersicht-1280x720.png`).

## Messungen (objektiv)

- GPU vor dem Lauf mit 34 % belegt. fps **60 / 60 / 60** bei der Kameradrehung.
- Konsole in allen drei Fenstern: keine CSP-Verletzung und kein `pageerror`. Nur der bekannte 401 vor dem Login und die bekannten Shader-Warnungen.

## Kandidaten für Lessons Learned

- Wie r1: Ein Anlagenmodell ist erst demo-fähig, wenn es angeschlossen und an der Wand bzw. in der Reihe platziert ist. Beleg: r1 → r2, sichtbare Wirkung im Bild.
