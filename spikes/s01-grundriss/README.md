# S1 Grundriss → Raum-Rechtecke (Lindenhof EG + OG)

Stand 2026-11-08 · Test-Architekt (Welle 3) · Wegwerf-Spike, kein Produktivcode.
Kennzeichnung: [F] gemessen/belegt · [A] Annahme · [?] offen.

## Ziel

Pruefen, ob Claude Vision Raeume aus einem Grundriss als achsparallele Rechtecke liefert, die gut genug sind fuer die Annahme "Hybrid erkennt Raeume brauchbar" (03 Kap. 6, ADR 0014). Messgroessen: Recall, IoU je Raum, Eckabweichung in Metern, Streuung ueber 3 unabhaengige Laeufe.

## Vorgehen

1. `vorbereiten.py` rendert beide Plaene als PNG (2382 × 1684 px, ganze A3-Seite) und zieht alle Textzeilen der Vektor-PDF mit normierten Koordinaten heraus (entspricht dem pdfjs-Schritt).
2. KI-Schritt im "Abo-Modus": je Lauf ein **frischer Subagent** (Claude, gleicher Auftrag `auftrag_subagent*.md`), der nur die erlaubten Eingaben sieht und JSON nach `prompt/schema.json` schreibt. Prompt: `prompt/grundriss_raeume@0.1.0.md`. Kein Zugriff auf Sollwerte, kein Mess-Code.
   - **A** nur Bild (3 Laeufe) · **B** Bild + Textzeilen (hybrid, 3 Laeufe) · **C** Stresstest: Bildausschnitt ohne Plankopf, Massketten, Massstab und Tabelle, ungerade Pixelgroesse (3 Laeufe, `vorbereiten_c.py`).
3. `auswerten.py` vergleicht automatisch mit `raeume.csv`:
   - **M1** Massstab 1:100 bekannt + Referenzpunkt (Suedwestecke) einmal pro Geschoss gesetzt (so in 03 Kap. 6 vorgesehen).
   - **M2** vollautomatisch: Massstab = Median(Stempelflaeche / Rechteckflaeche), Ursprung = Huelle der erkannten Rechtecke.
   - **Vektor-Baseline** ohne KI: gefuellte Rechtecke direkt aus der PDF, Zuordnung ueber den Stempeltext im Rechteck.

Wiederholen per API: Systemteil und Benutzerteil aus `prompt/grundriss_raeume@0.1.0.md`, Tool-Schema `prompt/schema.json`, Eingaben `eingabe/`. Ergebnisse als `laeufe/<id>.json` ablegen, dann `_werkzeuge/venv/Scripts/python s01-grundriss/auswerten.py`.

## Ergebnis [F, gemessen 2026-11-08]

18 Soll-Raeume (9 je Geschoss, inkl. Korridor und Treppe).

| Lauf | Recall (IoU ≥ 0,5) | Median-IoU M1 | Min-IoU M1 | Median Eckabw. | Max Eckabw. | Stempel (Nr., Name, m²) | Median-IoU M2 | Massstab M2 (Soll 28,346 pt/m) |
|---|---|---|---|---|---|---|---|---|
| A1 | 100 % | 0,994 | 0,994 | 0,012 m | 0,019 m | 18/18 | 0,995 | 28,353 |
| A2 | 100 % | 0,994 | 0,994 | 0,012 m | 0,019 m | 18/18 | 0,995 | 28,353 |
| A3 | 100 % | 0,994 | 0,994 | 0,012 m | 0,019 m | 18/18 | 0,995 | 28,353 |
| B1 | 100 % | 0,994 | 0,994 | 0,012 m | 0,019 m | 18/18 | 0,995 | 28,353 |
| B2 | 100 % | 0,995 | 0,994 | 0,010 m | 0,012 m | 18/18 | 0,998 | 28,353 |
| B3 | 100 % | 0,993 | 0,992 | 0,013 m | 0,013 m | 18/18 | 0,999 | 28,342 |
| C1 | 100 % | 0,995 | 0,991 | 0,016 m | 0,026 m | 18/18 | 0,993 | 28,313 |
| C2 | 100 % | 0,994 | 0,991 | 0,017 m | 0,026 m | 18/18 | 0,995 | 28,314 |
| C3 | 100 % | 0,995 | 0,991 | 0,016 m | 0,026 m | 18/18 | 0,991 | 28,321 |
| Vektor-Baseline (ohne KI) | 100 % | 1,000 | 1,000 | 0,000 m | 0,000 m | – | – | – |

Streuung zwischen den 3 Laeufen (Standardabweichung der Eckkoordinaten, Median/Max): A 0,000/0,000 m · B 0,004/0,006 m · C 0,007/0,007 m. Keine falsch-positiven Raeume (Legende, Tabelle, Plankopf wurden nie als Raum gemeldet). Details je Raum: `ergebnis.json`.

Beobachtung [F, Selbstauskunft der Subagenten]: Die Modelle lesen die Wandachsen an wenigen Stellen ab (5 x-Achsen, 4 y-Achsen) und verwenden sie fuer alle Raeume. Bei Lindenhof (strenges Raster) ist das ideal; daher die Streuung von fast 0.

## Urteil gegen das Kriterium (03 Kap. 13.2, S1)

| Kriterium | Ergebnis | Urteil |
|---|---|---|
| Raum-Recall ≥ 80 % bei Vektor (FA-12) | 100 % in 9/9 Laeufen | **bestanden auf Lindenhof** |
| Median-IoU ≥ 0,70 | 0,993–0,995 | **bestanden auf Lindenhof** |
| 10 echte Grundrisse (5 Vektor, 5 Scan) | 2 synthetische Vektor-Plaene | **nicht geprueft** |
| Korrekturzeit ≤ 5 min pro Geschoss mit 30 Raeumen | keine Korrektur-UI vorhanden | **nicht geprueft** |

**Gesamturteil S1: auf Lindenhof bestanden, das Spike-Kriterium bleibt offen.** Lindenhof ist eine Obergrenze: regelmaessiges Raster, nur Rechtecke, saubere Vektoren, eindeutige Stempel.

## Grenzen

- Das Raster ist trivial. Echte Plaene haben L-Raeume, Schaechte, Waende unterschiedlicher Dicke, Moeblierung, Bemassung im Raum, schiefe Scans. Das ist hier nicht abgebildet.
- Abo-Modus: Ein Claude-Subagent ist nicht identisch mit `claude-sonnet-5-5` ueber Bedrock (anderes Modell/Parameter moeglich, Bildverkleinerung im Werkzeug auf 2296 px Breite). Vor dem Entscheid mit dem Produktionsmodell per API wiederholen.
- Die Vektor-Baseline funktioniert nur, weil die Plaene gefuellte Raumflaechen haben. Echte CAD-Exporte haben meist nur Linien.
- M1 setzt den Referenzpunkt exakt. Ein Benutzerklick ist ungenauer (± 1 Bildschirmpixel ≈ ± 2–5 cm [A]).

## Folgerungen fuer die Architektur

1. **Vektor-Pfad zuerst ausbauen** (ADR 0014 Schritt 1): Wenn die PDF Flaechen oder geschlossene Polygone hat, ist die deterministische Extraktion exakt und kostet nichts. Die KI dient dann nur der Zuordnung von Stempeln und als Rueckfall.
2. **Massstab automatisch aus Stempeln** (M2) funktioniert: Abweichung ≤ 0,12 % gegen 1:100. Die 2-Klick-Kalibrierung braucht es nur ohne Flaechenstempel.
3. **Rastereinrasten** an gemeinsame Achsen (wie die Modelle es selbst tun) als deterministischen Schritt in die Geometriepruefung aufnehmen.
4. Golden Set fuer S1 muss **unregelmaessige und gescannte Plaene** enthalten; Lindenhof taugt nur als Regressions-Rauchtest.
