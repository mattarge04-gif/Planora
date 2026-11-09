# 0001 – Modularer Monolith mit hexagonalen Modulen und drei Prozessrollen

> **Status ab Welle 4: angepasst (E34–E37, 2026-11-09).**
> [F] Eine Codebasis (E37). [A] Rollen `api`/`worker`/`migrator` und Modulgrenzen bleiben; bezahlte Erweiterungen sind Kernmodule mit Schalter pro Instanz (ADR 0029).
> [A] Keycloak ist kein Grundcontainer mehr (ADR 0028); Modul-Abhaengigkeiten und Datenverhalten beim Abschalten regelt ADR 0029.
> Der folgende Text ist die bisherige Fassung und bleibt als Historie erhalten.

Status: vorgeschlagen · 2026-11-08 · Bezug: E7, alle FA

## Kontext
E7 legt einen modularen Monolithen in TypeScript fest. Entwicklung durch 1 Person mit Claude Code (00-kontext). Damit KI-Agenten und Freelancer unabhaengig an Modulen arbeiten koennen, ohne zu divergieren, braucht es harte, pruefbare Grenzen. Die Software soll "bedingungslos funktionieren": jedes Modul muss isoliert testbar sein.

## Entscheid
- Ein Repository, ein Container-Image, **drei Prozessrollen** ueber Startparameter: `api` (HTTP, BFF), `worker` (pg-boss-Jobs), `migrator` (Schema-Migrationen, laeuft vor jedem Deploy und beendet sich).
- Module unter `src/module/<name>/` mit fester Innenstruktur: `api/` (oeffentliche Schnittstelle, `index.ts` als einziger Import-Punkt), `domain/` (reine Logik, kein IO), `ports/` (Interfaces), `adapters/` (DB, S3, HTTP, KI), `jobs/`.
- Abhaengigkeitsrichtung ist fest (siehe 03-architektur Kap. 3) und wird per Lint-Regel (Import-Grenzen) in der CI erzwungen [A: Werkzeug z.B. dependency-cruiser, Version im Scaffold pruefen]. Zyklen sind verboten.
- Jede Tabelle gehoert genau einem Modul. Fremde Module lesen/schreiben nur ueber dessen API.
- Modulgrenzen-Kommunikation: synchron per Funktionsaufruf (in-process), asynchron per Job/Event ueber pg-boss (ADR 0006). Kein Message-Broker.

## Alternativen
- Microservices: fuer 1 Entwickler Betriebs- und Konsistenzaufwand unverhaeltnismaessig; verletzt E7.
- Schichtenmonolith ohne Modulgrenzen: schnell am Anfang, aber Quer-Zugriffe auf Tabellen machen Mandantentrennung und Tests unkontrollierbar.

## Konsequenzen
- + Ein Deployment, eine Datenbank, Transaktionen ueber Modulgrenzen moeglich (gleiche DB-Transaktion, ueber APIs weitergereicht).
- + Domain-Kern jedes Moduls ohne DB testbar; Adapter gegen echte Postgres-Testinstanz.
- − Disziplin noetig: Lint-Regel muss ab dem ersten Commit aktiv sein.
- Folge: Python-Sidecar (ADR 0009) und Keycloak (ADR 0007) sind zusaetzliche Container, aber keine eigenen Fachservices.
