# Planora

Software fuer die schematische 3D-Gebaeudewelt, technischen Bestand und zugeordnete Dokumente, mit einer eigenen Instanz pro Kunde.

## Hier weiterarbeiten

**[Aktueller Fortschritt, offene Abnahmen und naechste Aufgaben](docs/superpowers/plans/2026-11-11-fortsetzung.md)** – gemeinsamer Fortsetzungsstand vom 11.11.2026.

- [Betriebsanleitung](betrieb/README.md)
- [M1b-Integrationsbericht](docs/superpowers/plans/2026-11-10-m1b-integrationsbericht.md)
- [Sicherheitsnachpruefung](docs/superpowers/plans/2026-11-10-m1b-pp-nachpruefung.md)
- [Bestaetigte 3D-Erfassung: Huelle vorbereiten, Kunde erfasst Einheiten/Technik](docs/architektur/adr/0032-gebaeude-vorbereiten-kunde-erfasst-technik.md)
- [Architektur](docs/architektur/03-architektur.md)

M1 ist technisch abgeschlossen und lokal abgenommen (WSL-Ersatz-VM); offen sind echte CH-VM, SMTP-Versandtest und menschliche Lizenzfreigabe. M2a und der erste sichtbare M2b-Schnitt sind umgesetzt: Login, Gebaeudeliste, 3D-Uebersicht und Seitenpanel. Weitere M2-Schritte und M3–M7 bleiben offen. Historische Wochenangaben sind keine aktuellen Lieferzusagen.

## Lokale Demo

Der erste Schnitt ist funktional abgeschlossen; das endgueltige Erscheinungsbild folgt dem [visuellen Zielbild mit drei PO-Referenzen](docs/design/2026-11-12-visuelle-zielrichtung.md). [Screenshots und technischer Pruefstand](docs/abnahme/2026-11-12-m2b1/README.md).

Einmalig in `app/` und `app/web/` jeweils `npm ci` ausfuehren. Danach in `app/`: `npm run entwicklung`. Unter `http://localhost:3000` mit `admin@planora.invalid` und dem zufaelligen Passwort aus der Konsole anmelden, dann das Beispielgebaeude oeffnen. Der blaue Verteiler-Pin zeigt die versorgten Einheiten Restaurant und Buero C.

Jeder Start legt eine frische temporaere Datenbank samt Beispieldaten an; beim Beenden mit Ctrl+C wird sie verworfen. Nur fuer lokale Entwicklung, kein Kundensystem. Optional: `PLANORA_PORT` (Standard 3000) und `PLANORA_PG_PORT` (Standard 54500). Das Backend bindet ausschliesslich an Loopback.

## Lokale Pruefung

Im Verzeichnis `app`: `npm ci`, `npm test` und `npm run pruefe:typen`. Docker-Pruefungen gemaess Betriebsanleitung mit eigenen Projektnamen und freien Ports ausfuehren.
