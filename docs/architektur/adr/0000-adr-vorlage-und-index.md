# ADR-Index Planora (Stand 2026-11-09, Welle 4 B2B)

Kennzeichnung: [F] Fakt mit Quelle aus `01-domaene.md` (Qn-Domaene) bzw. `02-tech-recherche.md` (Qn-Tech) · [A] Annahme · [?] offen.
Status-Werte: vorgeschlagen · akzeptiert · angepasst · ersetzt durch NNNN · zurueckgestellt bis nach Demo. ADRs 0001–0021: **vorgeschlagen** (Freigabe durch PO/Koordinator); 0009, 0014, 0016 durch E31 angepasst. ADRs 0022–0024: **akzeptiert** (E31); 0025: **akzeptiert** (E32); 0026: **akzeptiert** (E33); 0008 durch E33 angepasst.

**Welle 4 (E34–E37, 2026-11-09):** [F] B2B, eine Instanz pro Kunde, Docker-Compose-Paket, lokaler Login, KI nur ueber Claude API, Kundenmodule mit Schalter. [A] Status pro ADR gemaess `07-analyse-b2b.md` Kap. 2; jede betroffene ADR traegt oben einen Block «Status ab Welle 4», die bisherige Fassung bleibt als Historie darunter. Neue ADRs 0027–0031 sind **vorgeschlagen** (Freigabe PO/Koordinator). Lieferstufen: Stufe 2 = installierte App mit Kundendaten (Demo), Stufe 3 = lokale Suche, Stufe 4 = Claude-Interview und KI-Auslesen [A, 07].

| Nr | Titel | Bezug | Abweichung vom PO? | Status ab Welle 4 |
|---|---|---|---|---|
| 0001 | Modularer Monolith mit hexagonalen Modulen und drei Prozessrollen | E7 | nein | angepasst |
| 0002 | Hosting Exoscale (Zuerich, Offsite Genf) | E7 | nein | **ersetzt durch 0027** |
| 0003 | KI-Zugang AWS Bedrock eu-central-2 mit EU-Inferenzprofil | E7, NFR Datenstandort | **ja, teilweise** | **ersetzt durch 0030** |
| 0004 | Framework: Vite-SPA + Fastify als BFF | E7 | nein | angepasst (Login 0028) |
| 0005 | ORM Drizzle, RLS und Trigger als handgeschriebenes SQL | E7 | nein | angepasst (ohne RLS) |
| 0006 | Job-Queue pg-boss mit transaktionaler Job-Erzeugung | E7 | nein | angepasst |
| 0007 | AuthN Keycloak, AuthZ in der Planora-Datenbank | NFR SSO | nein | **ersetzt durch 0028** |
| 0008 | 3D: Three.js/R3F mit BatchedMesh, Sprite-Pins, Auto-Layout | E2, E8 | nein | angepasst |
| 0009 | Dokumentverarbeitung: Python-Sidecar (OCRmyPDF, Docling) + Claude | E4, E7 | **ja, gering** (Python neben TS) | angepasst (Stufen) |
| 0010 | Mandantentrennung: RLS + zusammengesetzte Fremdschluessel | E5, E7 | nein | **ersetzt durch 0031** |
| 0011 | Bauteil-Katalog global, versioniert; ETIM/eBKP-H nur als Mappings | E8, E12, E13 | nein | angepasst |
| 0012 | Herkunftsmodell "Angabe" je Kennwert | Datenmodell-Grundsaetze | nein | angepasst |
| 0013 | Deterministische Erneuerungs- und Investitionsrechnung | E6 | nein | angepasst (ohne Kosten) |
| 0014 | Grundriss-Erkennung hybrid mit Pflicht-Korrektur und manuellem Fallback | E3 | nein | zurueckgestellt bis nach Demo |
| 0015 | Audit-Log per Datenbank-Trigger mit Hash-Kette | NFR Nachvollziehbarkeit | nein | angepasst |
| 0016 | Upload-Sicherheit: Quarantaene und Virenscan | NFR Security | nein | angepasst |
| 0017 | KI-Kostenbremse und Schutzschalter | NFR, E5 | nein | angepasst (Stufe 4) |
| 0018 | Preisdatenbank pro Typ mit Quellen-Port | E15 | nein | zurueckgestellt bis nach Demo |
| 0019 | Mehrsprachigkeit DE/FR/IT | E20 | nein | zurueckgestellt bis nach Demo |
| 0020 | Austausch-Port mit Stratus-Adapter | E22, E9 | nein | angepasst, [?] Stratus-Scope |
| 0021 | Zustandsmodell nach ZHAW und Lebensdauer-Tabelle | E11, E14 | nein | angepasst, [?] Zustands-Scope |
| 0022 | Dokument-Viewer: Vorschau-PDF, PDF.js, Markierung per Docling-Box (**akzeptiert**) | E23, E31 | nein | angepasst |
| 0023 | Suche: PostgreSQL-Volltext + pgvector, RRF (**akzeptiert**) | E26, E27, E31 | nein | angepasst (Stufe 3) |
| 0024 | Pflicht-Bausteine (Open Source) und Lizenzregeln (**akzeptiert**) | E28, E31 | nein | angepasst (Stufenliste) |
| 0025 | Oeffentliche APIs: geo.admin.ch/GWR, Nager.Date, Pwned Passwords (**akzeptiert**) | E32 | nein | zurueckgestellt bis nach Demo |
| 0026 | Geschlossene 3D-Welt: Regelwerk, Interview-Agent, Weltgenerator (**akzeptiert**) | E2, E3, E33 | nein | angepasst (Formular/Excel zuerst) |
| 0027 | Betrieb: ein Docker-Compose-Paket pro Kunde (CH-VM oder On-Premise) | E34, E35, E37 | nein | vorgeschlagen, ersetzt 0002 |
| 0028 | Lokaler Login mit Rollen | E34 | nein | vorgeschlagen, ersetzt 0007 |
| 0029 | Feature-Schalter / Kundenmodule pro Instanz | E37 | nein | vorgeschlagen |
| 0030 | KI ueber Claude API direkt (Stufe 4, pro Instanz aus) | E36, E37 | **ja, teilweise** (Datenregion us/global) | vorgeschlagen, ersetzt 0003 |
| 0031 | Instanz-Isolation statt RLS | E34, E35 | nein | vorgeschlagen, ersetzt 0010 |

## Vorlage

```
# NNNN – Titel
Status · Datum · Bezug (E-Nr., FA-Nr.)
## Kontext
## Entscheid
## Alternativen (verworfen, mit Grund)
## Konsequenzen (positiv / negativ / Folgearbeit, Spike)
```
