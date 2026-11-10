# Planora

Software fuer die schematische 3D-Gebaeudewelt, technischen Bestand und zugeordnete Dokumente, mit einer eigenen Instanz pro Kunde.

## Hier weiterarbeiten

**[Aktueller Fortschritt, offene Abnahmen und naechste Aufgaben](docs/superpowers/plans/2026-11-11-fortsetzung.md)** – gemeinsamer Fortsetzungsstand vom 11.11.2026.

- [Betriebsanleitung](betrieb/README.md)
- [M1b-Integrationsbericht](docs/superpowers/plans/2026-11-10-m1b-integrationsbericht.md)
- [Sicherheitsnachpruefung](docs/superpowers/plans/2026-11-10-m1b-pp-nachpruefung.md)
- [Bestaetigte 3D-Erfassung: Huelle vorbereiten, Kunde erfasst Einheiten/Technik](docs/architektur/adr/0032-gebaeude-vorbereiten-kunde-erfasst-technik.md)
- [Architektur](docs/architektur/03-architektur.md)

M1 ist implementiert und lokal getestet; reale Betriebsabnahmen und Lieferfreigaben stehen aus. M2–M7 sind noch zu bauen. Historische Wochenangaben sind keine aktuellen Lieferzusagen.

## Lokale Pruefung

Im Verzeichnis `app`: `npm ci`, `npm test` und `npm run pruefe:typen`. Docker-Pruefungen gemaess Betriebsanleitung mit eigenen Projektnamen und freien Ports ausfuehren.
