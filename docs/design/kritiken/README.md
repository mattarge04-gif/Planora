# Kritiken (visual-critic)

Eine Datei je Pruefrunde: `<JJJJ-MM-TT>-<thema>-r<N>.md`. Screenshots daneben in `<JJJJ-MM-TT>-<thema>-r<N>/`.

## Bewertungsraster (Noten 1–5, je mit Beleg)

| Kriterium | Frage |
|---|---|
| Gestaltungsqualitaet | Wirkt es hochwertig, ruhig, praezise? Wuerde ein Designstudio es zeigen? |
| Originalitaet | Eigenstaendige Idee oder generisches Muster / blasse Kopie? |
| Raeumliche Wirkung | Fuehlt es sich 3D an (Volumen, Licht, Schatten, Tiefe)? |
| Komposition | Gewichtung, Fuellgrad 65–75 %, Blickfuehrung, Verhaeltnis Szene/Karten |
| Geometrie | Glaubwuerdige Formen, Detail, Proportionen, keine Artefakte (z-fighting, Luecken) |
| Licht | Weichheit, Richtung, AO, keine dunklen Flaechen |
| Materialien | Matt/seidig passend, Glas, Gewerkefarben lesbar |
| Typografie | Inter, Groessen/Gewichte, Hierarchie, Umlaute |
| Abstaende | 4-px-Raster, Rhythmus, Ausrichtung |
| Referenz-Qualitaetsrichtung | Erreicht es das Niveau der Referenzen (ohne Kopie)? |
| Bedienbarkeit | Klickziele, Rueckmeldung, Fokus, Lesbarkeit, Tastatur |
| Funktion | Betroffene Interaktionen funktionieren; Konsole ohne Fehler/CSP |
| Leistung | fps bei Kameradrehung, Ladezeit bis ruhige Szene |

Messbares (Helligkeit, Saettigung, Farbton, fps) getrennt von Geschmacksurteilen ausweisen.

## Vorlage

```markdown
# <Thema> – Kritik Runde <N>
Datum, Commit, Renderer-Kennung, Ansichten/Fenstergroessen, Screenshot-Ordner
## Noten (Tabelle mit Beleg)
## Messungen (objektiv)
## Top-3-Massnahmen (konkret, mit Zustaendigkeit 3d-designer / ui-ux-designer)
## Funktion und Leistung
## Geschmacksurteile (subjektiv, nicht automatisch Regel)
## Kandidaten fuer Lessons Learned
## Gesamturteil: bereit | verbessern | zurueck an Entscheid
```
