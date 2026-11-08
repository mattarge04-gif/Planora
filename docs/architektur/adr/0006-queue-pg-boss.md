# 0006 – Job-Queue pg-boss mit transaktionaler Job-Erzeugung

Status: vorgeschlagen · 2026-11-08 · Bezug: E7 (Hintergrund-Worker), KI-Pipeline

## Kontext
KI-Jobs laufen Sekunden bis Minuten. E7 verlangt Portabilitaet (Standard-Postgres). Kandidaten: pg-boss 12.38.1 (MIT), Graphile Worker 0.18.0 (MIT), BullMQ 6.7.2 (braucht Redis) [F, Q50-Tech].

## Entscheid
- **pg-boss** in derselben Datenbank, eigenes Schema `pgboss`.
- Jobs werden **in derselben Transaktion** wie die ausloesende Fachaenderung erzeugt (z.B. Dokument-Datensatz + Scan-Job). Kein Job ohne Fachdatensatz, kein Fachdatensatz ohne Job.
- Jede Job-Nutzlast traegt `mandant_id`, `ausloeser_user_id`, `korrelations_id`. Der Worker setzt den Mandantenkontext (ADR 0010) vor jeder Fachaktion.
- Jeder Job ist **idempotent**: fachlicher Schluessel (`singletonKey`), z.B. `scan:<dokument_id>` oder `extrakt:<dokument_id>:<seitenblock>:<pipeline_version>`. Der Handler prueft vor der Arbeit den Fachzustand (Zustandsautomat, 03 Kap. 5).
- Retries exponentiell mit Jitter, Grenzen je Jobtyp (03 Kap. 5.4). Danach Status `fehlgeschlagen`, sichtbar in UI und Monitoring (Dead-Letter).
- Getrennte Warteschlangen je Typ mit eigener Parallelitaet; KI-Aufrufe begrenzt, damit Bedrock-Quoten und Budget halten.

## Alternativen
- Graphile Worker: geringere Latenz, gleichwertig; Reserve.
- BullMQ/Redis: zusaetzliche Komponente, verletzt "nur Standard-Postgres".
- SQS oder andere Cloud-Queue: nicht portabel (On-Prem).

## Konsequenzen
- + Keine weitere Infrastruktur; Backup/PITR deckt Jobs mit ab.
- − Durchsatzgrenze bei sehr grossen Importen [A] → Seitenbloecke statt Einzelseiten-Jobs; Spike S8 misst.
