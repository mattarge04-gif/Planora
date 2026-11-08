# ADR-Index Planora (Stand 2026-11-08)

Kennzeichnung: [F] Fakt mit Quelle aus `01-domaene.md` (Qn-Domaene) bzw. `02-tech-recherche.md` (Qn-Tech) · [A] Annahme · [?] offen.
Status-Werte: vorgeschlagen · akzeptiert · ersetzt durch NNNN. Alle ADRs dieser Welle: **vorgeschlagen** (Freigabe durch PO/Koordinator).

| Nr | Titel | Bezug | Abweichung vom PO? |
|---|---|---|---|
| 0001 | Modularer Monolith mit hexagonalen Modulen und drei Prozessrollen | E7 | nein |
| 0002 | Hosting Exoscale (Zuerich, Offsite Genf) | E7 | nein |
| 0003 | KI-Zugang AWS Bedrock eu-central-2 mit EU-Inferenzprofil | E7, NFR Datenstandort | **ja, teilweise** |
| 0004 | Framework: Vite-SPA + Fastify als BFF | E7 | nein |
| 0005 | ORM Drizzle, RLS und Trigger als handgeschriebenes SQL | E7 | nein |
| 0006 | Job-Queue pg-boss mit transaktionaler Job-Erzeugung | E7 | nein |
| 0007 | AuthN Keycloak, AuthZ in der Planora-Datenbank | NFR SSO | nein |
| 0008 | 3D: Three.js/R3F mit BatchedMesh, Sprite-Pins, Auto-Layout | E2, E8 | nein |
| 0009 | Dokumentverarbeitung: Python-Sidecar (OCRmyPDF, Docling) + Claude | E4, E7 | **ja, gering** (Python neben TS) |
| 0010 | Mandantentrennung: RLS + zusammengesetzte Fremdschluessel | E5, E7 | nein |
| 0011 | Bauteil-Katalog global, versioniert; ETIM/eBKP-H nur als Mappings | E8, E12, E13 | nein |
| 0012 | Herkunftsmodell "Angabe" je Kennwert | Datenmodell-Grundsaetze | nein |
| 0013 | Deterministische Erneuerungs- und Investitionsrechnung | E6 | nein |
| 0014 | Grundriss-Erkennung hybrid mit Pflicht-Korrektur und manuellem Fallback | E3 | nein |
| 0015 | Audit-Log per Datenbank-Trigger mit Hash-Kette | NFR Nachvollziehbarkeit | nein |
| 0016 | Upload-Sicherheit: Quarantaene und Virenscan | NFR Security | nein |
| 0017 | KI-Kostenbremse und Schutzschalter | NFR, E5 | nein |
| 0018 | Preisdatenbank pro Typ mit Quellen-Port | E15 | nein |
| 0019 | Mehrsprachigkeit DE/FR/IT | E20 | nein |
| 0020 | Austausch-Port mit Stratus-Adapter | E22, E9 | nein |
| 0021 | Zustandsmodell nach ZHAW und Lebensdauer-Tabelle | E11, E14 | nein |

## Vorlage

```
# NNNN – Titel
Status · Datum · Bezug (E-Nr., FA-Nr.)
## Kontext
## Entscheid
## Alternativen (verworfen, mit Grund)
## Konsequenzen (positiv / negativ / Folgearbeit, Spike)
```
