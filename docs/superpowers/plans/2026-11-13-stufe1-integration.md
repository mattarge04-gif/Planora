# Stufe 1 – Integration der Tracks A/B/C

13.11.2026 · Branch `m2c-interview` · Stand `fe85d42` (+ dieser Doku-Commit).

## Erledigt [F]

| Bereich | Commits | Nachweis |
|---|---|---|
| Track A Generator v2 / Raumkomposition (A1–A6) | `5a0bf8c`…`530422c`, Merge `2a155d2` | Modulmatrix, Reihen, Fluegelpfad (Rechteck/Quadrat/L/U), Layout, Einrichtung, Steigzone, Hinweise `ohne_gruppe`/`gruppe_leer`, abgeleitete Masse in `gebaeude` (v2) |
| Track C Leitungen mit Gruppen (C1–C4) | bis `4b1a03c`, Merge `f16ab79` | Gruppenstraenge mit T-Abzweigen, Gruppenstock, Ort "vor Bauteil", GLB Ventile/WMZ + Verteiler n1–n8 (Blender, `pruefen.py` 20/20), Gruppenhervorhebung, Karte `TwinGruppe`; 57 GPU-Bilder `docs/abnahme/2026-11-12-gruppen/` |
| Track B Interview-Assistent (B1–B5) | bis `dc94655`, Merge `29e292a` | acht Schritte, Autosave/Entwurf, Vorschau, Uebernehmen, Tastatur; 36 GPU-Bilder `docs/abnahme/2026-11-12-assistent/` |
| I1 Twin -> Assistent | `fe85d42` | Gebaeude-Menue im Kopf: "Gebäude bearbeiten" |

Pruefstand nach Integration: Backend 565/565, Web 251/251, beide Typpruefungen, Webbuild gruen. `npm run muster:welt` ergibt keine Fixture-Aenderung.

## Offen

1. **Vorschau im Assistenten zu nah [F, Ursache offen]:** Gebaeude ragt bei 1280/1440 unter das Formular, auch bei 1920 deutlich mehr als `FIT_ANTEIL` 0.7 des Freiraums. `einpassen()` rechnet korrekt; Verdacht [A]: Kamera nach Benutzer-/Werkzeug-Eingriff nicht neu eingepasst, oder Zoom-Untergrenze in `Kamera3`/`Bewegung`. In laufender Instanz messen.
2. Hauptleitungen Erzeuger -> Speicher -> Verteiler bilden Schleifen ueber der Zentrale (alte `kantenNetz`-Fuehrung), sichtbar in `docs/abnahme/2026-11-12-gruppen/*-zentrale-*`.
3. Gruppenauswahl: Kamera faehrt auf Geschossansicht statt auf Gruppenverlauf; Umriss in Uebersicht schwach.
4. visual-critic-Gesamtrunde (I2) und GPU-Bilder aller Muster nach Integration; danach PO-Sichtung.
5. Annahmen pruefen: Steigzone 0.3 m innerhalb der Zentrale-Ecke; Verteiler `n8` 12 608 Dreiecke / 256 kB (ueber bisherigem Budget 8000 / 200 kB); Abschwaechung nicht gewaehlter Leitungen.
6. Liegengebliebener untracked Ordner `wt-b-assistent/docs/design/kritiken/2026-11-12-assistent-r1/` (abgebrochener Lauf), Loeschen durch PO.
7. Doku-Nachtraege I2: `00-kontext.md` (Masse ab Regelwerk v2 abgeleitet), `lessons-learned.md` nur nach PO-Bestaetigung.

Kein Push, kein Merge nach `main`, kein Deployment. Worktrees `wt-a-generator`, `wt-b-assistent`, `wt-c-leitungen` noch vorhanden (Branches gemergt).
