# 0002 – Hosting Exoscale (Zuerich, Offsite Genf)

Status: vorgeschlagen · 2026-11-08 · Bezug: E7, NFR Datenstandort CH

## Kontext
E7 verlangt verwaltete Dienste in der Schweiz und Portabilitaet (Docker, Standard-Postgres, S3-API). 02-tech-recherche Kap. 1 vergleicht Exoscale, Infomaniak, Nine, cloudscale, AWS, Azure, GCP.

## Entscheid
- **Exoscale**, Zone `ch-dk-2` (Zuerich) primaer, `ch-gva-2` (Genf) fuer Offsite-Backups und Dokument-Replikat.
- Managed PostgreSQL Plan **Business** (PITR, 1 Replikat/HA, 15 Tage Backup, SLA 99.99 %) [F, Q11/Q12-Tech]. Start Business-4 (CHF 195.43/Monat) [F, Q13-Tech].
- Objektspeicher SOS (S3-API) [F, Q13-Tech].
- Rechenleistung: Start mit **Docker Compose auf 2 VMs** (api+worker+docproc auf VM 1, Keycloak+Monitoring auf VM 2) hinter Exoscale-Load-Balancer [A]. Wechsel auf SKS (Kubernetes), sobald ca. 5 Mandanten oder eine SLA-Zusage besteht [A, 02 Kap. 1.4].
- Nur Standard-Schnittstellen nutzen (libpq, S3-API, OCI-Images), keine Exoscale-spezifischen APIs im Anwendungscode.

## Alternativen
- AWS Zuerich: vollstaendig, gleiche Cloud wie Bedrock; aber US-Konzern (CLOUD Act [A]), USD, mehr Komplexitaet. Bleibt **Plan B**; Wechsel dank Standard-Schnittstellen in Tagen, nicht Monaten [A].
- Azure Switzerland North: teurer bei HA [F, 02 Kap. 1.3]; Option fuer Microsoft-lastige Kunden.
- Infomaniak (PG-Status unklar), Nine (PITR/HA nicht belegt), cloudscale (kein DBaaS) [F, 02 Kap. 1.1].

## Konsequenzen
- + CH-Firma, CHF, ISO 27001 + BSI C5 [F, Q10-Tech].
- − DBaaS "powered by Aiven" → Subprozessor, Control-Plane-Standort [?]; PG-Hauptversion [?]; Verschluesselung at rest [?]. **Vor Vertragsabschluss schriftlich klaeren** (Spike S7).
- − Kein verwalteter Secret-Store bekannt [A] → Secrets ausserhalb des Repos in einem Passwort-Tresor, Auslieferung auf die VMs beim Deploy (03 Kap. 9.5).
- Kosten Start ca. CHF 325/Monat, 20 Mandanten CHF 915–1'275/Monat [A auf F-Preisen, 02 Kap. 1.3].
