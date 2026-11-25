# Anlagenakte T9 – GLB-Modelle – Kritik Runde 1 (visual-critic, unabhängig)

- Datum 25.11.2026, Commit `4e781b8`
- Renderer `ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Ti … D3D11)`, echte GPU
- Testinstanz 3100, nicht neu gestartet
- Fenster 1440 × 900, 1280 × 720, 1920 × 1080
- Eigene Bilder: dieser Ordner (`k-*.png`, `bericht.json`; inkl. zwei gedrehte Nahansichten des Ausdehnungsgefässes). Gesichtet: `../r0-selbst/`, `docs/design/modelle/vorschau/heizung.{ausdehnungsgefaess,sonstiges,wmz}.png`, Modellvertrag `docs/design/modelle/README.md`.

## Gesamturteil: **verbessern**

Die **Modelle selbst sind bereit**. Ausdehnungsgefäss und Sonstiges treffen den Stil der bestehenden Anlagen: seidenmattes Weiss, graue Details, KOO nur am Anschluss, weiche Kanten, keine schwarzen Linien. Die Proportionen sind glaubwürdig. Der Wärmezähler passt im Stil. Für die Siemens-Demo verraten aber die **Einbindung in der Zentrale** die Platzhalter-Herkunft: zwei frei im Raum stehende Objekte ohne Leitung, eines davon hinter der Sammelleitung versteckt. Das ist Platzierung und Leitungsführung, nicht Modellierung.

## Die 3 wirksamsten Punkte

1. **P1 (Demo) – Gefäss und Sonstiges ohne Leitung, frei im Raum** (3d-designer und Generator/Router)
   - Beide Objekte stehen ohne jede Rohrverbindung mitten auf dem Boden der Technikzentrale. Beim Gefäss ist das in allen drei Blickrichtungen zu sehen: `k-mag-nah-gedreht-1440x900.png` (Gefäss bei x 665 / y 435 allein auf der Fläche), `k-mag-nah-gedreht2-1440x900.png`.
   - Der KOO-rote Vorlaufstutzen von Sonstiges endet ins Leere (`k-sonst-nah-1440x900.png`, x 735 / y 320).
   - Ein Fachbesucher sieht sofort: Ein Ausdehnungsgefäss ohne Anschluss an den Rücklauf ist nicht eingebaut.
   - Vorschlag:
     - Das Gefäss an die Wand neben Speicher/Verteiler stellen, Abstand ca. 0.3–0.5 m.
     - Eine kurze Anschlussleitung vom `anschluss` zum Rücklauf führen; der Router kann das als Direktverbindung, vgl. Entscheid 15.11. «Direktverbindung naher Geräte».
     - Sonstiges ebenso an die Wand stellen und mit dem Vorlauf verbinden. Wo das fachlich nicht stimmt, den KOO-Stutzen weglassen.
2. **P2 – Gefäss von der Sammelleitung verdeckt (Designerfrage).**
   - In der Standardkamera läuft die rote Hauptleitung genau vor dem Gefäss durch. Nur die Kalotte bleibt sichtbar (`k-mag-nah-1440x900.png`, x 735 / y 340; ebenso `../r0-selbst/mag-nah-1440x900.png`).
   - Bei 1280 ist das Gefäss etwas freier (`k-mag-auswahl-1280x720.png`).
   - Die Platzierung aus Punkt 1 an der Wand löst das mit.
   - Ohne Umstellen bliebe nur das Dimmen der Leitung bei Auswahl. Das gibt es für fremde Leitungen bereits, hier geht es aber um die eigene Gruppe, daher keine gute Lösung.
3. **P3 – Material `dunkel` für Ventilkappe und Kabelverschraubungen (Designerfrage).**
   - Im Bild sind die Teile winzig: unter 4 px bei Übersicht und Auswahl, nah ca. 6–8 px (`k-sonst-nah`).
   - Sie wirken wie echte Kunststoffkappen und verletzen Regel 11 nicht, es gibt keine Umrandung und keine dominante dunkle Fläche.
   - Empfehlung: annehmen und den Modellvertrag ergänzen: «`dunkel` auch für kleine Kunststoffteile (Kappen, Verschraubungen) bis ca. 3 cm». Das ist eine Entscheidung des Hauptagenten (Stufe klein), keine Prinzipänderung.

## Weitere Befunde

- **Sonstiges ähnelt dem FBH-Schrank? (Designerfrage)**
  - In der Übersicht (`../r0-selbst/technik-uebersicht-1440x900.png`) sind beide nur als helle Quader von wenigen Pixeln zu sehen; dort unterscheidet ohnehin nichts.
  - Ab der mittleren Nähe (`k-mag-auswahl-1280x720.png`, x 580 / y 170) liest Sonstiges als freistehendes Bodengerät mit Stutzen. Der FBH-Kasten ist ein flacher Wandkasten. Die Verwechslung ist gering.
  - Subjektiv: Für «Sonstiges» ist ein neutrales Technikgehäuse richtig, ein Fragezeichen-Symbol wäre billiger.
  - Keine Änderung nötig, sobald Sonstiges nach Punkt 1 an der Wand steht und angeschlossen ist.
- **Wärmezähler:** Im Nahbild passt er stilistisch zu Ventilen und Pumpen; Rechenwerk mit Display, KOO-Manschetten (`k-wmz-nah-1440x900.png`). Bei Auswahl ist er klein, aber mit Markierung auffindbar. Bereit.
- **Gefäss-Modell:** In der Vorschau überzeugend: Umfangsnaht, Standring mit Fussblechen, Typenschild, Kappenventil mit KOO-Hebel. Im Twin wird der Hebel ab mittlerer Distanz zu einem roten Punkt. Das ist akzeptabel, weil KOO den Heizungsbezug zeigt.
- Testartefakt, kein Befund: Das Hover-Label «FBH Gastro · Beimischschaltung» überdeckt im Nahbild die Auswahl, weil die Maus des Szenarios über der Leitung lag.

## Noten (1–5)

| Kriterium | Note | Beleg |
|---|---|---|
| Geometrie (Modelle) | 4 | Vorschau-PNGs; glaubwürdige Proportionen, Details auf Fernwirkung abgestimmt |
| Materialien | 4 | Vier Vertragsmaterialien, `dunkel` sparsam (P3) |
| Stil-Einheit mit Bestand | 4 | `k-wmz-nah`, `k-sonst-nah`: neben Wärmepumpe und Speicher wie aus einer Hand |
| Räumliche Einbindung | 2 | Frei stehend, ohne Leitung, verdeckt (P1/P2) |
| Komposition Zentrale | 3 | Speicher, Verteiler und Wärmepumpe geordnet, die neuen Teile wirken zufällig gestreut |
| Referenz-Qualitätsrichtung (`03-technik.png`) | 3 | Modellniveau erreicht; die Referenz zeigt angeschlossene Technik |
| Funktion | 5 | Auswahl aus der Tabelle, Kamerafahrt, Karte mit Icon; Konsole ohne CSP-Verletzung und ohne `pageerror` |
| Leistung | 5 | 60 / 60 / 60 fps |

## Messungen (objektiv)

- GPU vor dem Lauf mit 54 % belegt (andere Programme). Trotzdem fps **60 / 60 / 60** (1440 / 1280 / 1920) bei der Kameradrehung.
- Konsole: nur der bekannte 401 vor dem Login, dazu die bekannten Shader-Warnungen.
- Modellvertrag laut README: Gefäss 5792 Dreiecke / 110 kB, Sonstiges 2428 / 48 kB, Masse innerhalb ±5 cm. Liegt unter den Grenzen 8000 Dreiecke / 200 kB.

## Kandidaten für Lessons Learned

- Ein neues Anlagenmodell ist erst «demo-fähig», wenn es angeschlossen und plausibel platziert ist. Die Modellvorschau allein genügt nicht. Beleg: diese Runde; Eintrag erst nach Bestätigung.
