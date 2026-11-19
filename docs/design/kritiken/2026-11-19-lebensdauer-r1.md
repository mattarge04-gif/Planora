# Lebensdauer/Ampel – Kritik Runde 1

- Datum: 19.11.2026, visual-critic (unabhängig, nur eigene Bilder)
- Stand: Branch `m2c-interview`, HEAD `37c23a3` (2D `6788026`, 3D `37c23a3`)
- Renderer: `ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Ti (0x00002207) Direct3D11 vs_5_0 ps_5_0, D3D11)`: echte GPU, in allen Läufen gleich
- Testdaten: `instanz.sh start --muster`, danach `node werkzeug/design/lebensdauer-daten.mjs` → Muster 6: rot 5, gelb 5, grün 5, grau 2; 5 J. CHF 37'600, 8 ohne Preis
- Fenster: 1440×900, 1920×1080, 1280×720
- Bilder: `docs/design/kritiken/2026-11-19-lebensdauer-r1/`; Szenarien `szenario-3d.json`, `szenario-nah.json`, `szenario-funktion.json`, `szenario-separiert.json`, `szenario-taste.json` und `werkzeug/design/szenarien/lebensdauer.json`; Vergrösserungen unter `ausschnitte/`
- Nicht geprüft: Rolle ohne Schreibrecht. Die Testinstanz hat kein Konto mit `fach.lesen` ohne `fach.aendern`; der Betreiber hat keine Fachdaten. Speichern im Kartenformular wurde nicht ausgelöst.

## Noten

| Kriterium | Note | Beleg |
|---|---|---|
| Gestaltungsqualität | 3 | 2D ruhig und präzise (Legende, Plan). 3D-Ampel als flache, ungeschattete Farbtafeln hinter den Geräten: `ausschnitte/zentrale-nah-1920-x4.png` (orange Tafel hinter der WP, grüne Platte unter dem Verteiler) |
| Originalität | 3 | Die Idee "Modus neutralisiert Gewerk, nur Ampel farbig" ist eigenständig und richtig. Die Ausführung als Silhouetten-Aufkleber wirkt generisch |
| Räumliche Wirkung | 3 | Die neutralisierte Technik bleibt plastisch (`zentrale-nah-1920x1080.png`). Die Ampelflächen sind unbeleuchtet und flach, sie heben die Plastizität lokal auf |
| Komposition | 2 | Der Einstieg in Modus E zeigt fast nur leeres UG1. Die Zentrale nimmt ca. 60×50 px von ~750×550 px Szene ein (`modus-e-technik-1440x900.png`). Die Ampelfarben belegen 0.02–0.10 % der Szene (Messung unten) |
| Geometrie | 3 | Die Hülle folgt dem Geräteumriss; beim Speicher/Verteiler entsteht eine grosse Platte, die auf dem Boden und hinter den Pumpen sichtbar ist (`ausschnitte/zentrale-nah-1920-x4.png`). Kein z-fighting gesehen |
| Licht | 4 | Unverändert weich, keine dunklen Flächen; mittlere Luminanz der Szene 231–239 |
| Materialien | 3 | Leitungen neutral grau, kein KOO-Rot neben Status-Rot: Ziel erreicht. Die Ampelfarben weichen messbar von den Tokens ab (siehe Messungen) |
| Typografie | 4 | Inter, saubere Hierarchie; Plan-Kennzahl "CHF 37'600" gross, Umlaute korrekt. Kleinigkeit: Eingabe "35000" ohne Tausendertrenner neben "CHF 35'000" (`plan-typwerte-1440x900.png`, `karte-bearbeiten-1440x900.png`) |
| Abstände | 4 | Plan und Legende im Raster, Panels bündig. Legende endet bei 1440×900 nur ~12 px über der Tabelle (`modus-e-technik-1440x900.png`, y≈600) |
| Referenz-Qualitätsrichtung | 3 | Die 2D-Seiten erreichen das Niveau. Die 3D-Ampel erreicht die Qualität von `03-technik.png` nicht: Farbflächen statt eines Materials oder Lichtakzents |
| Bedienbarkeit | 2 | Die Anlagenkarte ist bei 1440 und 1280 abgeschnitten; im Bearbeiten sind die Speichern-Knöpfe nicht im Bild, bei 1280 fehlt der Kartentitel (`karte-bearbeiten-1280x720.png`). Taste E schaltet nicht wieder aus (siehe Funktion). Positiv: Fokus kehrt nach Esc auf "Bearbeiten" zurück (`f-nach-esc-1440x900.png`) |
| Funktion | 3 | Plan-Filter, Typwerte, Karte und Legende funktionieren, die Zahlen stimmen zwischen Legende, Plan und Karte überein. Fehler: Taste E (siehe unten). Konsole: keine CSP-Verletzung |
| Leistung | 5 | 60 fps bei Drehung in Modus E in allen drei Fenstergrössen |

## Messungen (objektiv)

**Anteil der Ampelfarben an der Szenenfläche** (Pixel mit HSV-Sättigung ≥ 0.45, Farbton rot <12°/>345°, gelb 25–45°, grün 140–170°; Ausschnitt ohne Panels):

| Bild | rot | gelb | grün |
|---|---|---|---|
| `modus-e-technik-1440x900` (Einstieg Modus E) | 84 px / 0.02 % | 138 px / 0.03 % | 415 px / 0.10 % |
| `modus-e-technik-1920x1080` | 124 px / 0.02 % | 212 px / 0.03 % | 561 px / 0.07 % |
| `modus-e-technik-1280x720` | 55 px / 0.02 % | 92 px / 0.03 % | 282 px / 0.10 % |
| `modus-e-eg-1440x900` (EG-Fokus) | 20 px / 0.00 % | 0 | 354 px / 0.09 % |
| `zentrale-nah-1920x1080` (Zentrale nah) | 757 px / 0.10 % | 917 px / 0.12 % | 1987 px / 0.26 % |

Folgerungen:
- Aus Gebäudedistanz liegt die Ampel unter jeder Lesbarkeitsschwelle. Im EG sind 4 Bauteile "Ersetzen" (Heizkörper 1985), sichtbar sind 20 rote Pixel; der rote Heizkörper steht hinter der Aussenwand (`ausschnitte/eg-nah-links-x4.png`).
- **Das Gewicht ist umgekehrt:** Grün ("In Ordnung") hat 2.6× die Fläche von Rot ("Ersetzen"), weil die Hüllfläche mit der Gerätegrösse wächst (Speicher, Verteiler) und nicht mit der Dringlichkeit.

**Farbtreue 3D gegenüber Tokens** (Mittelwert der Ampelpixel in `zentrale-nah-1920x1080`, Gegenlicht ohne Schatten):

| Stufe | Token | Gerendert | HSV-Sättigung Token → Bild |
|---|---|---|---|
| Ersetzen | `#d64541` | `#b82620` | 0.70 → 0.83 |
| Bald ersetzen | `#e08a1e` | `#c47708` | 0.87 → 0.96 |
| In Ordnung | `#2f9e6b` | `#0e8c5a` | 0.70 → 0.90 |

Kein einziges Pixel liegt innerhalb ±18 je Kanal um den Tokenwert. Die gerenderten Farben sind dunkler und gesättigter; das passt zu einer doppelten sRGB→linear-Umrechnung oder zu einem Material, das trotz `toneMapped={false}` beleuchtet wird. Punkt 3 des Entscheids ("im Bild exakt den UI-Farben entsprechen") ist damit **nicht erfüllt**, und Legende und Modell zeigen sichtbar verschiedene Grüntöne.

**Leistung:** 60 fps in 1440×900, 1920×1080 und 1280×720 (fps-Schritt während der Drehung in Modus E). Ladezeit: die Szene war innerhalb der 7-s-Wartezeit des Szenarios ruhig, genauer nicht gemessen.

**Konsole:** je Lauf 1× `401 (Unauthorized)` vor dem Entwicklungslogin (Werkzeug, nicht Produkt), `THREE.Clock deprecated`, bekannte D3D-Shaderwarnungen X4000/X3595. Keine CSP-Verletzung, keine React-Fehler.

## Wirksamste Massnahmen (höchstens 5)

1. **P1 – Modus E braucht eine lesbare Gesamtsicht (3d-designer, mit ui-ux-designer).** Belege: `modus-e-technik-*`, `modus-e-eg-*`, `s-e-separiert-1440x900.png`, `s-e-og1-1440x900.png`, Messtabelle. In keiner Ansicht ohne Nahzoom erkennt man, *wo* ersetzt werden muss. Vorschlag:
   - je Anlage ein kleiner Ampelmarker mit Mindestgrösse am Bildschirm (≈ 10–14 px, gleicher Mechanismus wie die Rohrverdickung aus Distanz)
   - leicht über der Anlage, nicht von Wänden verdeckt (nur der Marker ohne Tiefentest bzw. mit Okklusions-Halbton)
   - aus der Nähe weicher Bodenring statt Hülle

   Das ist kein HTML-Overlay (der Entscheid hat das verworfen), sondern ein Szenenelement mit konstanter Pixelgrösse. Zusätzlich beim Einschalten von E die Kamera auf die Anlage mit der dringendsten Ampel bzw. auf die Zentrale rahmen statt auf das leere UG1-Rechteck. Prüfen mit derselben Messung: Ziel ≥ 0.5 % Ampelfläche je Stufe in der Einstiegsansicht. Die Fläche soll von der Dringlichkeit abhängen, nicht von der Gerätegrösse.
2. **P2 – Ampelfarbe token-genau und mit ruhiger Fläche darstellen (3d-designer).** Belege: Farbtreue-Tabelle, `ausschnitte/zentrale-nah-1920-x4.png`. Vorschlag:
   - Farbraum prüfen (`MeshBasicMaterial` mit `toneMapped={false}`, Farbe einmal als sRGB gesetzt, ohne zweite Umrechnung); Abnahme ±5 je Kanal gegen `AMPEL_FARBE`
   - die vollflächige BackSide-Silhouette durch einen schmalen Rand bzw. Bodenring konstanter Breite ersetzen, damit Speicher und Verteiler keine grünen Platten mehr werfen
   - Grau gestrichelt erst prüfen, wenn Punkt 1 gelöst ist

   Bekannter offener Punkt der Designer, hiermit messbar bestätigt.
3. **P2 – Anlagenkarte passt nicht ins Fenster (ui-ux-designer).** Belege: `karte-offen-1440x900.png` (Kennzahlen bei y≈600 von der Tabelle abgeschnitten), `karte-bearbeiten-1440x900.png` (Geschosse-Panel verschwindet, Notiz und Speichern ausserhalb), `karte-bearbeiten-1280x720.png` (Titel und Status oben abgeschnitten). Vorschlag:
   - solange eine Karte offen ist, das Geschosse-Panel zu einer Zeile einklappen
   - Kartenkopf (Name, Status) sticky
   - Aktionsleiste Speichern/Abbrechen sticky am Kartenfuss
   - Inhalt dazwischen scrollt
   - Abnahme: 1280×720 mit Formular offen, beide Knöpfe ohne Scrollen sichtbar
4. **P2 – Taste E und Ansichtsschalter verhalten sich inkonsistent (ui-ux-designer).**
   - **E schaltet nur ein:** Canvas fokussiert, E → Modus an. Ein zweites E bleibt wirkungslos, weil der Canvas nach dem Wechsel den Fokus verliert (`f-taste-e-an` / `f-taste-e-aus`, Pill bleibt aktiv). Mit erneutem Canvas-Fokus schaltet E aus (`t-e-aus-mit-fokus`, `ausschnitte/t-kopf.png`).
   - **Erneuerung wirkt unabhängig, ist es aber nicht:** Die Pill ist als eigener Schalter gestaltet, ein Klick auf "Übersicht" schaltet E aber stillschweigend aus (`f-e-uebersicht-1440x900.png`). Beim Ausschalten bleibt die Ansicht in "Technik" statt in die vorherige Ansicht zurückzukehren.
   - Vorschlag: Fokus nach dem Moduswechsel auf dem Canvas halten. Entweder die Pill erkennbar an Technik koppeln (Tooltip/Untertitel "zeigt Technik") oder beim Ausschalten die vorherige Ansicht wiederherstellen.
5. **P3 – Kleine Datenklarheit (ui-ux-designer).**
   - (a) In Modus E zeigt die Anlagen-Tabelle weiter "Bestätigt/Vorgeschlagen" statt der Ampel (`modus-e-technik-1920x1080.png`). Gerade sie wäre die lesbare Gesamtliste, solange Punkt 1 offen ist; vorgeschlagen ist eine Ampelspalte im Modus E.
   - (b) Der Filterchip "Fällig 2026, CHF 2'600" verschweigt, dass 4 Bauteile ohne Preis sind (`plan-filter-1440x900.png`).
   - (c) Der Plan zeigt den Zustand nicht. Verteiler mit Baujahr 2008, Lebensdauer 30 J. und Ersatzjahr 2033 ist ohne den Hinweis "Zustand schlecht −5 J." nicht nachvollziehbar (`plan-1920x1080.png`).
   - (d) Tausendertrenner in den Preiseingaben.

## Funktion und Leistung

- In Ordnung:
  - Pill Erneuerung (Klick) an/aus
  - Legende mit echten Zählern
  - "Erneuerungsplan öffnen"
  - Jahresfilter mit Chip und Entfernen-Kreuz
  - Typwerte aufklappen
  - Karte → Bearbeiten → Esc schliesst das Formular und setzt den Fokus auf "Bearbeiten"
  - Zahlen in Legende, Plan und Karte identisch (CHF 37'600, 8 ohne Preis, 5/5/5/2)
- Fehler:
  - Taste E schaltet nicht aus (Fokusverlust, Punkt 4)
  - Übersicht-Klick beendet E (Absicht unklar, Punkt 4)
- Hinweis zum Werkzeug: Mausrad zoomt zum Cursor. Mit 14 Schritten auf die Zentrale gerät die Zentrale unter das rechte Panel (`zentrale-nah-1440x900.png`, teils vom Geschosse-Panel verdeckt). Für Nahaufnahmen eignet sich die Auswahl über die Tabelle (Kamerafahrt) besser.
- Leistung: 60 fps in allen Fenstern, keine CSP-Verletzung.

## Geschmacksurteile (subjektiv, nicht automatisch Regel)

- Der Erneuerungsplan ist die stärkste Ansicht dieser Runde: ruhig, klare Kennzahl, die gestrichelte Kappe für fehlende Preise ist eine gute eigene Idee. Mit 7 leeren Jahren wirkt das Diagramm leer. Das ist korrekt (Regel 17); eventuell genügt eine niedrigere Diagrammhöhe (~140 statt ~180 px).
- Die Legende links ist gut gewählt; der Satz "Gezählt wird je Bauteil …" erklärt die Abweichung zwischen Zähler und Modell verständlich.
- Die flachen Farbtafeln in 3D wirken eher wie eine Markierung im Plan als wie ein Material eines Premium-Twins (Regel 1 "kein Comic-Look" berührt, nicht verletzt).

## Kandidaten für Lessons Learned

- Status-/Markerfarben in 3D immer mit Pixelmessung gegen das Token prüfen (`toneMapped={false}` allein garantiert keine Farbtreue). Erstbeleg: diese Kritik.
- Statusmarker müssen nach Dringlichkeit Fläche erhalten, nicht nach Gerätegrösse. Sonst dominiert "In Ordnung" das Bild. Erstbeleg: diese Kritik.
- Aus der Übersicht prüfen (bereits bestätigt 12.11./15.11. für Rohre) gilt auch für Statusmarker. Zweiter unabhängiger Befund nach den Designerhinweisen "Heizkörper-Ampeln aus Distanz klein".

## Gesamturteil: **verbessern**

Die 2D-Seiten sind nahe an "bereit". Bei der 3D-Ampel ist das Kernziel des Modus, auf einen Blick zu sehen, was zu ersetzen ist, aus der Einstiegs- und Geschossansicht nicht erreicht (P1). Die Farben entsprechen nicht den Tokens (P2). Kein Grund für "zurück an Entscheid": Die Neutralisierung der Gewerkefarbe funktioniert und ist richtig.
