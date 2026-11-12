# Anlagenmodelle Heizung (Teilaufgabe 4)

Eigene, parametrisch aus Python erzeugte Modelle – keine Fremd-Assets, keine generierten Modelle. Quelle der Wahrheit ist `anlagen.py`; die GLB-Dateien unter `app/web/public/modelle/` sind Exporte daraus.

## Aufruf (Repo-Wurzel)

```powershell
& "C:/Program Files/Blender Foundation/Blender 5.1/blender.exe" --background --factory-startup --python docs/design/modelle/anlagen.py
python docs/design/modelle/pruefen.py
```

- Ohne Argumente: alle 9 Modelle bauen, GLB exportieren, je ein Vorschaubild rendern, danach `vorschau/alle.png` aus den **re-importierten** GLB (prüft Ausrichtung und Massstab auf dem Rückweg).
- `-- --nur heizung.speicher,heizung.verteiler` nur diese Modelle; `-- --ohne-render` nur Export; `-- --uebersicht` nur `alle.png`; `-- --teile` listet die teuersten Teile (Dreiecksbudget).
- `pruefen.py` (nur Standardbibliothek) prüft jede GLB gegen den Vertrag; Exit 0 = bestanden.
- Laufzeit ca. 2–3 min (Eevee, RTX 3070 Ti).

## Vertrag (Kurzfassung, verbindlich: `docs/superpowers/plans/2026-11-12-teilaufgabe-4.md`)

- Datei `app/web/public/modelle/<katalogId>.glb`, ohne Draco/Meshopt, ohne Texturen, ohne UV, keine Erweiterungen.
- glTF +Y oben, Vorderseite +Z, Ursprung Mitte Grundfläche (y = 0), Meter, Transformationen angewendet. Ein Mesh-Knoten (vier Primitive = vier Draw-Calls) plus Empty `anschluss`.
- Materialien genau `gehaeuse` (#eef0f3, rough 0.55, metal 0.05), `detail` (#a7aeb8, 0.45 / 0.35), `dunkel` (#5e6670, 0.6 / 0.1, nur Display, Lüftergitter, Schauglas), `koo` (#e5322d, 0.6 / 0 – Farbe ersetzt der Code zur Laufzeit).
- Kanten per Bevel (Gehäuse 3–4 cm, Kleinteile 0.3–1 cm), Normalen weich, Kanten > 50° hart.
- KOO-Teile: Anschlussmanschetten, Kugelhahnhebel Vorlauf, Farbband (Speicher-Kappenfuge, Ölbrenner-Flansch), Thermostatring, FBH-Vorlaufmanschetten. Keine roten Knöpfe/Punkte (Verwechslung mit Status, Prinzip 10).

## Prüfergebnis (12.11.2026, `pruefen.py`)

| Datei | B × H × T ist (m) | Soll | Dreiecke | Grösse | anschluss (x, y, z) | Ergebnis |
|---|---|---|---|---|---|---|
| `heizung.waermepumpe.glb` | 1.004 × 1.200 × 0.623 | 1.00 × 1.20 × 0.60 | 5080 | 114.0 kB | -0.25, 1.20, -0.08 | ok |
| `heizung.gaskessel.glb` | 0.600 × 1.580 × 0.626 | 0.60 × 1.60 × 0.60 | 3928 | 75.6 kB | -0.13, 1.57, 0.12 | ok |
| `heizung.oelkessel.glb` | 0.700 × 1.440 × 0.814 | 0.70 × 1.40 × 0.80 | 4636 | 89.0 kB | -0.16, 1.37, -0.05 | ok |
| `heizung.fernwaerme_uebergabe.glb` | 1.000 × 1.400 × 0.321 | 1.00 × 1.40 × 0.35 | 4612 | 93.3 kB | 0.00, 0.08, -0.03 | ok |
| `heizung.speicher.glb` | 0.888 × 1.800 × 0.934 | 0.90 × 1.80 × 0.90 | 7168 | 135.5 kB | 0.00, 1.48, 0.49 | ok |
| `heizung.umwaelzpumpe.glb` | 0.350 × 0.450 × 0.260 | 0.35 × 0.45 × 0.30 | 3132 | 61.8 kB | 0.17, 0.12, 0.00 | ok |
| `heizung.verteiler.glb` | 1.180 × 1.000 × 0.300 | 1.20 × 1.00 × 0.30 | 7200 | 146.7 kB | -0.60, 0.62, 0.02 | ok |
| `heizung.heizkoerper.glb` | 0.963 × 0.633 × 0.110 | 1.00 × 0.65 × 0.12 | 3256 | 73.7 kB | 0.44, 0.05, 0.00 | ok |
| `heizung.fbh_kreis.glb` | 0.600 × 0.800 × 0.152 | 0.60 × 0.80 × 0.15 | 5122 | 112.2 kB | -0.26, 0.06, -0.02 | ok |

Geprüft: 9, bestanden: 9. Geprüft wird: Bounding-Box gegen Zielmass (±5 cm), Unterkante y = 0 (±5 mm), Grundflächenmitte im Ursprung (±5 cm), alle vier Materialnamen vorhanden und keine fremden, mindestens ein Primitive mit `koo`, Empty `anschluss`, Dreiecke < 8000, Datei < 200 kB, keine Erweiterungen/Bilder/Texturen. Summe aller Dateien ca. 900 kB.

## Kontrollbilder

`vorschau/<katalogId>.png` (Eevee, orthografisch 3/4 von rechts vorn oben, Khronos-PBR-Neutral-Ansicht wie das Neutral-Tone-Mapping der Szene, heller Grund #f5f6f8, Sonne links oben) und `vorschau/alle.png` (alle GLB re-importiert, nebeneinander im gleichen Massstab). Die Bilder sind Blender-Renders zur Modellkontrolle, keine Browser-Abnahme.

## Annahmen [A]

- Zielmasse aus dem Vertrag sind Annahmen; Masse innerhalb ±5 cm. Abweichungen: Gaskessel 1.58 hoch (Abgasrohr), Speicher Ø 0.888 mit Stutzen nach vorn (Tiefe 0.934, Ursprung = Zylindermitte, nicht Mitte der Bounding-Box), Ölkessel 1.44 hoch (Abgasstutzen), Pumpe 0.26 tief.
- `anschluss`-Lage: Wärmepumpe, Kessel oben (Vor-/Rücklaufstutzen); Speicher vorn am oberen Vorlaufstutzen (z = +0.49); Fernwärme, Heizkörper und FBH-Schrank **unten** (Rohrgruppe bzw. Zuleitung zum Boden, y = 0.05–0.08); Pumpe am rechten Rohrende; Verteiler am linken Balkenende (Vorlauf). Falls Codex die Leitungen einheitlich oben andocken will, nur die `anschluss(...)`-Zeile im Skript anpassen.
- Wärmepumpe als Kompaktgerät mit sichtbarem Lüfter (Lesbarkeit aus Distanz), nicht als glattes Innengerät.
- `heizung.tabs_feld` nutzt laut Vertrag `heizung.fbh_kreis.glb` (Zuordnung im Code), keine eigene Datei.

## Stufe 1, Track C4 (12.11.2026): Gruppenzubehör und Verteiler-Reihe

- Neu im selben Skript: `heizung.ventil_3weg`, `heizung.ventil_2weg`, `heizung.wmz` (Teile in einer senkrechten Leitung: Rohrachse durch den Ursprung, Rohrenden bei y = 0 und y = H, `anschluss` = unteres Rohrende, Stellantrieb/Rechenwerk nach vorn +Z, Rohrradius 0.02 wie `ROHR.stock`) und `heizung.verteiler.n1` … `n8` (Verteiler mit k Gruppenabgängen im Abstand 0.34 m, Länge wie `verteilerLaenge()` in `szene3/technik.ts`).
- `pruefen.py`: 20/20 bestanden. Für die drei Leitungsteile wird statt der Grundflächenmitte die Rohrachse im Ursprung geprüft (Antrieb vorn verschiebt die Bounding-Box). Verteiler-Reihe mit wachsendem Budget (+1400 Dreiecke, +30 kB je Abgang über 4); `n8` = 12 608 Dreiecke, 256 kB [A].
- Masse aus Katalog v2 (`masse`) innerhalb ±5 cm; Ventile schmaler als der Katalogwert (0.15 statt 0.20 bzw. 0.11 statt 0.15 m).
