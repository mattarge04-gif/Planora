# Planora

Software fuer die schematische 3D-Gebaeudewelt, technischen Bestand und zugeordnete Dokumente, mit einer eigenen Instanz pro Kunde.

## Hier weiterarbeiten

**[Aktueller Abschluss und Fortschritt: Stufe 1](docs/superpowers/plans/2026-11-12-stufe1-abschluss.md)** – gemeinsame Grundlage V1–V5 auf `m2c-interview` umgesetzt und geprüft. Der Digital Twin ist auf `main` integriert; Assistent, Raumkomposition und Gruppenleitungen folgen. [Umsetzungsplan](docs/superpowers/plans/2026-11-12-stufe1-umsetzung.md), [Weg zu V1](docs/superpowers/plans/2026-11-12-weg-zu-v1.md).

- [Betriebsanleitung](betrieb/README.md)
- [M1b-Integrationsbericht](docs/superpowers/plans/2026-11-10-m1b-integrationsbericht.md)
- [Sicherheitsnachpruefung](docs/superpowers/plans/2026-11-10-m1b-pp-nachpruefung.md)
- [Bestaetigte 3D-Erfassung: Huelle vorbereiten, Kunde erfasst Einheiten/Technik](docs/architektur/adr/0032-gebaeude-vorbereiten-kunde-erfasst-technik.md)
- [Architektur](docs/architektur/03-architektur.md)

M1 ist technisch abgeschlossen und lokal abgenommen (WSL-Ersatz-VM); offen sind echte CH-VM, SMTP-Versandtest und menschliche Lizenzfreigabe. M2a und M2b sind umgesetzt: Login, Gebäudeliste, Digital Twin, Geschossschnitt, Anlagentabelle und Objektkarten. M2c ist in Arbeit; die gemeinsame Daten-/API-Grundlage für den Assistenten steht. Weitere V1-Stufen bleiben offen. Historische Wochenangaben sind keine aktuellen Lieferzusagen.

## Lokale Demo

Gebäude öffnen direkt im Digital Twin mit Geschossschnitt, Technik, Anlagentabelle und Objektkarten. Die alten Seiten «Ansicht» und «Entwurf» sind nach PO-Freigabe entfernt. Das Erscheinungsbild folgt dem [visuellen Zielbild mit drei PO-Referenzen](docs/design/2026-11-12-visuelle-zielrichtung.md).

Einmalig in `app/` und `app/web/` jeweils `npm ci` ausfuehren. Danach in `app/`: `npm run entwicklung`. Unter `http://localhost:3000` mit `admin@planora.invalid` und dem zufaelligen Passwort aus der Konsole anmelden, dann das Beispielgebaeude oeffnen. Der blaue Verteiler-Pin zeigt die versorgten Einheiten Restaurant und Buero C.

Jeder Start legt eine frische temporäre Datenbank samt Beispieldaten an; beim Beenden mit Ctrl+C wird sie verworfen. Zusätzlich zum bisherigen Beispiel erscheinen sechs Muster und eine U-Variante in «Muster Stufe 1». Diese v2-Welten verwenden noch das Übergangslayout; ihre Gruppen sind noch nicht in der Oberfläche angebunden. Nur für lokale Entwicklung, kein Kundensystem. Optional: `PLANORA_PORT` (Standard 3000) und `PLANORA_PG_PORT` (Standard 54500). Das Backend bindet ausschliesslich an Loopback.

## Lokale Pruefung

Im Verzeichnis `app`: `npm ci`, `npm test` und `npm run pruefe:typen`. Docker-Pruefungen gemaess Betriebsanleitung mit eigenen Projektnamen und freien Ports ausfuehren.
