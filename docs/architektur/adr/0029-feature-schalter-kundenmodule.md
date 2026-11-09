# 0029 – Feature-Schalter / Kundenmodule pro Instanz

Status: vorgeschlagen · 2026-11-09 · Bezug: E37, E34, ADR 0001, `07-analyse-b2b.md` Kap. 2 (0001), Kap. 3, Kap. 6, Kap. 8 Punkt 3

## Kontext
[F] E37: eine Codebasis, Kundenfeatures als Module mit Schalter pro Instanz. [A] Ohne verbindlichen Vertrag entstehen versteckte UI-Elemente ohne Serversperre, kaputte Abhaengigkeiten und Datenverlust beim Abschalten (07 Kap. 2, Abschnitt «Zusaetzliche Entscheide»). Eine externe Flag-Plattform ist nicht noetig (07 Kap. 3 Zeile 15).

## Entscheid
- **Modulmanifest** im Code (versioniert, Teil des Versionsmanifests ADR 0027): je Modul `id`, Lieferstufe, Abhaengigkeiten, betroffene HTTP-Routen und Job-Typen, Default.
- **Default aus** fuer alle optionalen Module; Kernmodule der Stufe 2 sind immer an [A].
- **Abhaengigkeiten:** Einschalten nur, wenn alle Abhaengigkeiten an sind; Abschalten eines Moduls, von dem ein aktives Modul abhaengt, wird abgelehnt.
- **Pruefung serverseitig an HTTP- und Job-Grenze:** Jede Route und jeder Job-Handler eines Moduls prueft `modulAktiv(id)` vor Rolle/Recht; deaktiviert → HTTP 404/403 bzw. Job wird nicht gestartet und als `pausiert_modul` markiert [A]. UI-Ausblenden ist nur Komfort.
- **Abschalten erhaelt Daten:** Tabellen und Dokumente eines Moduls bleiben unveraendert; Wiedereinschalten setzt fort. Loeschen ist ein separater, auditierter Admin-Vorgang.
- **Speicherung:** Tabelle `modul_schalter` in der Instanz-DB (`modul_id`, `aktiv`, `geaendert_von/am`, `manifest_version`). Ein Update mit unbekanntem/altem Manifest laesst unbekannte Module aus [A].
- **Rechte und Audit:** Schalten nur Instanz-Admin (ADR 0028); jede Aenderung im Audit (ADR 0015).
- **KI** ist ein Modul (ADR 0030): «KI aus» ergibt 0 neue externe Requests.
- **Freischaltung:** [?] PO: Wer darf bezahlte Module freischalten – nur Planora (Betreiber) oder auch der Kunden-Admin On-Premise; genuegt vertragliche Lizenzierung? [A] Ein lokaler Host-/DB-Admin kann Schalter technisch veraendern; ein zentraler Lizenzdienst waere eine weitere externe Abhaengigkeit (07 Kap. 8 Punkt 3).

## Alternativen (verworfen, mit Grund)
- Externe Flag-Plattform (z.B. SaaS): zusaetzliche externe API, widerspricht E36/N3 [A].
- Kundenspezifische Branches/Builds: widerspricht E37.
- Nur UI-Ausblenden: keine Sicherheit, direkter API-Aufruf moeglich.

## Konsequenzen
- Positiv: ein Build fuer alle Kunden, verkaufbare Module ohne Fork.
- Negativ: jede Route/jeder Job braucht Modulzuordnung; Testaufwand fuer Kombinationen.
- Folgearbeit: Tests (05-tests, Neu: Feature-Schalter): direkter API-Aufruf trotz versteckter UI, fehlende Abhaengigkeit, unberechtigter Toggle, wartende/laufende Jobs, altes Manifest; kritische Modulpaare statt 2^n-Volltest.
