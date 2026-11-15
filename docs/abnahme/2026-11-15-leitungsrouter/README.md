# Leitungsrouter – GPU-Abnahme (T10)

Stand 15.11.2026, Branch `m2c-interview`, Commits `384eca0` (T9), `3a574ae` (Formstücke), `d2c7229` (Fixrunde 1).
Echte GPU: RTX 3070 Ti / D3D11, 60 fps bei Kameradrehung in 1440×900, 1920×1080 und 1280×720. Keine CSP-Verletzung (bekannt: 1× 401 beim Login, Three-Warnungen).

Szenarien: `werkzeug/design/szenarien/twin-leitungsrouter.json` (alle 7 Muster), `twin-formstuecke.json` (Nahbilder).
Kritik: [r1](../../design/kritiken/2026-11-15-leitungsrouter-r1.md) (verbessern), [r2](../../design/kritiken/2026-11-15-leitungsrouter-r2.md) (**bereit für PO-Sichtung**, ohne P1).

## Zuerst ansehen (1440×900)

| Was | Bild |
|---|---|
| Zentrale vorher (alte Führung, Schleifen) | [m3](../2026-11-12-gruppen/m3-zentrale-1440x900.png), [m6](../2026-11-12-gruppen/m6-zentrale-1440x900.png) |
| Zentrale nachher | [m3](m3-zentrale-1440x900.png), [m6](m6-zentrale-1440x900.png), [m6u](m6u-zentrale-1440x900.png) |
| Pressbögen nah | [m3](formstuecke/m3-zentrale-nah-1440x900.png), [m6](formstuecke/m6-zentrale-nah-1440x900.png) |
| T-Stück am Gruppenstrang (Mitte oben, x 740 / y 237) | [m3](formstuecke/m3-t-stueck-nah-1440x900.png) |
| FBH-Kasten geschlossen, ohne Auswahl | [m5](formstuecke/m5-fbh-kasten-nah-1440x900.png) |
| Geschossbild (Rohre aus Distanz verdickt) | [m3 EG](m3-geschoss-eg-1440x900.png), [m3 OG1](m3-geschoss-og1-1440x900.png), [m6 EG](m6-geschoss-eg-1440x900.png) |
| Band-Effekt aus Distanz (Geschmacksfrage) | [m6 Technik](m6-technik-1440x900.png) |

Vollsatz je Muster (im Repo nur 1440×900; 1920×1080 und 1280×720 geprueft, siehe `bericht.json`): `<muster>-uebersicht | technik | geschoss-<code>[-nah] | zentrale | formstuecke`. Formstueck-Nahbilder in allen drei Fenstern.

## Was sich geändert hat

- **Führung:** Alle Leitungen über den LeitungsRouter (T1–T9). 7 Muster ohne Befund; 2000 Zufallswelten: 42 mit harten Befunden (2.1 %, bekannte Lücke), Kreuzungen 39.6 % (Schwelle 42 % [A]), ~230 ms je Welt.
- **Formstücke [A]:** Pressbogen (Bogenradius 2.5 r, Körper 1.16 r, Muffe 0.7 r, Pressring metallgrau 1.3 r), T-Stück (Kern 1.16 r, Muffen 1.9 r mit Pressring), Winkel an rechtwinkligen Stössen. Nicht anklickbar, folgen Dimmung und Geschossschnitt.
- **FBH-Kasten:** Ursache war ein vorne offener Schrank im GLB, nicht die Transparenz; jetzt geschlossene Revisionstür.
- **Rohrstärke [A]:** Aus der Distanz verdickt (Faktor `clamp(4.4 / (2 · 0.045 · zoom), 1, 3.5)`), ~4.3 px im Geschossbild statt 1–2 px; Nahansicht massstäblich.

## Restauflagen (P2)

- N1: Eng parallele Stränge verschmelzen aus Distanz zu einem Band (m6 Technik, 15–17 px). PO-Urteil; sonst Obergrenze z. B. 2.5.
- N3: Klickfläche und Schatten nutzen die dünne Geometrie; aus Distanz ist ein Rohr nur ~1.3 px treffbar. Im Browser prüfen.
- B4: Rohrbündel scheint durch die linken Panels (1280×720).
- B6: Bügel Wärmepumpe → Speicher führt kurz zur Decke und zurück.
- Muffen werden an kurzen Schenkeln nicht gekürzt; nahe Bögen können überlappen.
