# Stufe 1 – Abschluss der gemeinsamen Grundlage

12.11.2026 · Branch `m2c-interview` · Implementierungsstand `c5a335e`.

Claude hat Phase V bis zum letzten Muster-Commit umgesetzt. Codex hat den Stand geprüft, den Demostart getestet und die veralteten Einstiegsdokumente aktualisiert. Dies schliesst die gemeinsame Grundlage ab, nicht die gesamte Stufe 1.

## Fortschritt

| Bereich | Stand | Nachweis / nächster Schritt |
|---|---|---|
| M1 Betriebsfundament | technisch umgesetzt, lokal abgenommen | CH-VM, echter SMTP-Test und menschliche Lizenzfreigabe offen |
| M2a Datenkern | umgesetzt und integriert | normalisierte Tabellen als Wahrheit |
| M2b Digital Twin | nach `main` integriert | Merge `ba3f339`; bisherige GPU-Bilder unter [Feinschliff](../../abnahme/2026-11-12-feinschliff/README.md) |
| Stufe 1 / V1 Typen und Schema | umgesetzt | Gruppen, Zubehör-Ort, optionale Gebäudemasse, Web-Eingabetypen |
| V2 Migration und Regelwerk | umgesetzt | Migration 014, Katalog und Regelwerk v2 |
| V3 Speichern und Prüfen | umgesetzt | Gruppen/Verbraucher/Ort, Referenzen, Entwurf beim Übernehmen entfernen |
| V4 Entwurf und Vorschau | umgesetzt | CRUD mit Standprüfung, Vorschau ohne Schreibzugriff, v2-Generator als Stub |
| V5 Muster und Fixtures | umgesetzt | sechs Muster plus U-Variante, sieben mit dem Generator verglichene Welt-Fixtures |
| Track A Raumkomposition | offen | Modulmatrix, Form/Flügel, Einrichtung, abgeleitete Gebäudemasse |
| Track B Web-Assistent | offen | acht Schritte, Autosave, Vorschau, Übernehmen |
| Track C Gruppenleitungen | offen | Stränge/T-Abzweige, Zubehör, Modelle und Hervorhebung |
| Integration und Abnahme | offen | A → C → B, GPU-Prüfung und PO-Sichtung |
| Weitere V1-Stufen | offen | Anlagenakte → Ampel → Teilabnahme → Excel → Suche → KI → Gesamtabnahme |

Die fünf Vertragspakete V1–V5 sind umgesetzt. Daraus folgt kein belastbarer Prozentwert für die gesamte Stufe oder V1: Generator, Oberfläche und Darstellung bilden den grösseren noch offenen Teil.

## Prüfung am Abschluss

- Backend: 48 Testdateien, **477 Tests bestanden**; der bestehende v1-Referenzhash bleibt unverändert.
- Frontend: 17 Testdateien, **174 Tests bestanden**.
- `npm.cmd run pruefe:typen` in `app/` und Typprüfung im Webbuild bestanden.
- `npm.cmd run build` in `app/web/` bestanden.
- Echte Entwicklungsinstanz per HTTP geprüft: Start mit frischer Datenbank, Startseite HTTP 200, Login erfolgreich, acht Gebäude vorhanden, alle acht Welt-Endpunkte HTTP 200. Sieben Gebäude gehören zu «Muster Stufe 1» und liefern v2-Gruppen.
- Port 54600 war bereits belegt; der erfolgreiche eigene Demolauf verwendete automatisch freie Ports. Bestehende Dienste auf 3000/54500 und 3100/54600 wurden nicht verändert.
- Die eigene Demo-Datenbank ist beendet. Beim Backendlauf blieb die PostgreSQL-Testinstanz im Windows-Sandbox-Teardown hängen; nach Prüfung von PID, Datenpfad und Port wurde nur diese eigene Instanz (54400) beendet. Der Testprozess schloss danach mit Exit 0 ab.
- Bekannte `pg`-Deprecation zur gleichzeitigen Abfrage auf einem Client beobachtet; keine fehlgeschlagenen Assertions.
- `*.tsbuildinfo` im Web-Ignore ergänzt, damit der generierte TypeScript-Cache keinen offenen Arbeitsstand vortäuscht.

## Sichtbarer Stand und Grenzen

Der bestehende Digital Twin ist nutzbar. Die neuen Muster werden beim nächsten Entwicklungsstart zusätzlich angelegt; laufende ältere Instanzen erhalten sie nicht automatisch. Der v2-Generator verwendet noch feste Ersatzmasse und die bisherige Layoutlogik. Gruppen und neue Zubehörtypen sind noch nicht vollständig an die Weboberfläche angeschlossen. Kein fertiger Assistent und keine visuelle Endabnahme dieser Muster behauptet.

Keine neue GPU-, Docker-, CH-VM- oder Lieferabnahme durchgeführt. Kein Push, Merge oder Deployment. Der aktuelle Arbeitsbranch bleibt `m2c-interview`.

Fortsetzung gemäss [Umsetzungsplan](2026-11-12-stufe1-umsetzung.md), zunächst Track A/B/C, anschliessend Integration. Verbindliche Anforderungen stehen in der [Spec](../specs/2026-11-12-stufe1-interview-design.md); die [V1-Reihenfolge](2026-11-12-weg-zu-v1.md) bleibt unverändert.
