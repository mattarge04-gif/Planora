# Stufe 1 – Integration der Tracks A/B/C

13.11.2026 · Branch `m2c-interview` · Stand `5b2bf4b` (+ Doku-Commit). Branch auf PO-Auftrag gepusht, kein Merge nach `main`.

## Erledigt [F]

| Bereich | Commits | Nachweis |
|---|---|---|
| Track A Generator v2 / Raumkomposition (A1–A6) | `5a0bf8c`…`530422c`, Merge `2a155d2` | Modulmatrix, Reihen, Fluegelpfad (Rechteck/Quadrat/L/U), Layout, Einrichtung, Steigzone, Hinweise `ohne_gruppe`/`gruppe_leer`, abgeleitete Masse in `gebaeude` (v2) |
| Track C Leitungen mit Gruppen (C1–C4) | bis `4b1a03c`, Merge `f16ab79` | Gruppenstraenge mit T-Abzweigen, Gruppenstock, Ort "vor Bauteil", GLB Ventile/WMZ + Verteiler n1–n8 (Blender, `pruefen.py` 20/20), Gruppenhervorhebung, Karte `TwinGruppe`; 57 GPU-Bilder `docs/abnahme/2026-11-12-gruppen/` |
| Track B Interview-Assistent (B1–B5) | bis `dc94655`, Merge `29e292a` | acht Schritte, Autosave/Entwurf, Vorschau, Uebernehmen, Tastatur; 36 GPU-Bilder `docs/abnahme/2026-11-12-assistent/` |
| I1 Twin -> Assistent | `fe85d42` | Gebaeude-Menue im Kopf: "Gebäude bearbeiten" |
| Neues Gebaeude als Betreiber | `5b2bf4b` | `GET /api/struktur/liegenschaften` (ID+Name; Betreiber/Admin alle, sonst zugeordnete); Assistent waehlt Liegenschaft auch ohne sichtbare Gebaeude; Betreiber erhaelt nach Anlegen Meldung statt Fehler (E38); Entwicklungsstart legt `betreiber@planora.invalid` an (Passwort zufaellig, im Startfenster). Per HTTP geprueft (Betreiber legt L-Gebaeude an, Admin sieht und bearbeitet es), nicht im Browser |

Pruefstand nach `5b2bf4b`: Backend 568/568 (nach Integration 565), Web 251/251, beide Typpruefungen, Webbuild gruen. PO hat lokal gestartet und den Assistenten gesehen: "ist mal ein grosser Fortschritt". `npm run muster:welt` ergibt keine Fixture-Aenderung.

## Offen

1. **Vorschau im Assistenten zu nah [F, Ursache offen]:** Gebaeude ragt bei 1280/1440 unter das Formular, auch bei 1920 deutlich mehr als `FIT_ANTEIL` 0.7 des Freiraums. `einpassen()` rechnet korrekt; Verdacht [A]: Kamera nach Benutzer-/Werkzeug-Eingriff nicht neu eingepasst, oder Zoom-Untergrenze in `Kamera3`/`Bewegung`. In laufender Instanz messen.
2. **In Arbeit (Leitungsrouter, Plan `2026-11-13-leitungsrouter.md`):** Hauptleitungen Erzeuger -> Speicher -> Verteiler bilden Schleifen ueber der Zentrale (alte `kantenNetz`-Fuehrung), sichtbar in `docs/abnahme/2026-11-12-gruppen/*-zentrale-*`.
3. Gruppenauswahl: Kamera faehrt auf Geschossansicht statt auf Gruppenverlauf; Umriss in Uebersicht schwach.
4. visual-critic-Gesamtrunde (I2) und GPU-Bilder aller Muster nach Integration; danach PO-Sichtung.
5. Annahmen pruefen: Steigzone 0.3 m innerhalb der Zentrale-Ecke; Verteiler `n8` 12 608 Dreiecke / 256 kB (ueber bisherigem Budget 8000 / 200 kB); Abschwaechung nicht gewaehlter Leitungen.
6. Liegengebliebener untracked Ordner `wt-b-assistent/docs/design/kritiken/2026-11-12-assistent-r1/` (abgebrochener Lauf), Loeschen durch PO.
7. Doku-Nachtraege I2: `00-kontext.md` (Masse ab Regelwerk v2 abgeleitet; Liegenschaften-Endpunkt fuer Betreiber), `lessons-learned.md` nur nach PO-Bestaetigung.
8. [?] Port 54800: am Sitzungsende lauschte ein nicht sichtbarer/beendbarer Prozess (PID 17248), vermutlich verwaiste eingebettete PostgreSQL nach Testlauf mit `timeout` [A]. Beim naechsten Start pruefen.
9. Betreiber-Ablauf im Browser durchklicken (bisher nur HTTP).

## Lokal starten [F]

- PowerShell des PO blockiert `npm.ps1` -> `npm.cmd` verwenden, Befehle aus `app/`.
- Laeuft der PO-Server auf 3000/54500, eigene Ports via `$env:PLANORA_PORT` / `$env:PLANORA_PG_PORT`. Kollision zeigt sich als Absturz mit `undefined` [A, wahrscheinliche Ursache].
- Ein Benutzer hat genau eine Rolle; Admin hat kein `huelle.verwalten`, die Huelle legt der Betreiber an.

Branch gepusht (PO-Auftrag); kein Merge nach `main`, kein Deployment. Worktrees `wt-a-generator`, `wt-b-assistent`, `wt-c-leitungen` noch vorhanden (Branches gemergt), koennen nach dem Push aufgeraeumt werden.
