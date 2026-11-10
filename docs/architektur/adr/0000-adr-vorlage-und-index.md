# ADR-Index Planora (Stand 2026-11-09, Welle 4/4b B2B)

Kennzeichnung: [F] Fakt mit Quelle aus `01-domaene.md` (Qn-Domaene) bzw. `02-tech-recherche.md` (Qn-Tech) · [A] Annahme · [?] offen.

**Zwei getrennte Status (Welle 4b, Befund 15 in `08-pruefung.md`):**
- **Freigabestatus** = ist der Entscheid durch PO/Koordinator freigegeben? Werte: `vorgeschlagen` · `akzeptiert` · `abgelehnt`. Er aendert sich nur durch einen ausdruecklichen PO-Entscheid.
- **Aenderungsstatus ab Welle 4** = was die B2B-Umstellung (E34–E37) mit dem Entscheid gemacht hat. Werte: `unveraendert` · `angepasst` · `ersetzt` · `zurueckgestellt bis nach Demo` · `neu`.
- Eine Anpassung ist **keine** Freigabe: Aus "angepasst" folgt keine stillschweigende Akzeptanz einer zuvor nur vorgeschlagenen ADR. Freigabe-Historie: 0001–0021 vorgeschlagen (0009/0014/0016 durch E31, 0008 durch E33 inhaltlich angepasst); 0022–0024 akzeptiert durch E31, 0025 durch E32, 0026 durch E33; 0027–0031 vorgeschlagen.

**Welle 4 (E34–E37, 2026-11-09):** [F] B2B, eine Instanz pro Kunde, Docker-Compose-Paket, lokaler Login, KI nur ueber Claude API, Kundenmodule mit Schalter. [A] Aenderungsstatus pro ADR gemaess `07-analyse-b2b.md` Kap. 2; jede betroffene ADR traegt oben einen Block «Status ab Welle 4», die bisherige Fassung bleibt als Historie darunter. **Lieferstufen** [A, Plan V2]: Stufe 1 = 3D + Dokumente, Erfassung Formular/Excel · Stufe 2 = + Lebensdauer und Ampel (Ziel Uebergabe Siemens) · Stufe 3 = + lokale Suche · Stufe 4 = + Claude-Interview und KI-Auslesen · spaeteres Modul = nach der Demo, eigener PO-Entscheid.

[F] Dateiname `0008-3d-r3f-batchedmesh.md` bleibt aus Gruenden der Verlinkung (u.a. `07-analyse-b2b.md`) unveraendert; massgeblich ist der Titel (InstancedMesh).

| Nr | Titel | Bezug | Abweichung vom PO? | Freigabestatus | Aenderungsstatus ab Welle 4 | ersetzt / ersetzt durch | Lieferstufe |
|---|---|---|---|---|---|---|---|
| 0001 | Modularer Monolith mit hexagonalen Modulen und drei Prozessrollen | E7 | nein | vorgeschlagen (keine PO-Freigabe erteilt) | angepasst | – | 1 |
| 0002 | Hosting Exoscale (Zuerich, Offsite Genf) | E7 | nein | vorgeschlagen (keine PO-Freigabe erteilt) | ersetzt | ersetzt durch 0027 | – (ersetzt) |
| 0003 | KI-Zugang AWS Bedrock eu-central-2 mit EU-Inferenzprofil | E7, NFR Datenstandort | **ja, teilweise** | vorgeschlagen (keine PO-Freigabe erteilt) | ersetzt | ersetzt durch 0030 | – (ersetzt) |
| 0004 | Framework: Vite-SPA + Fastify als BFF | E7 | nein | vorgeschlagen (keine PO-Freigabe erteilt) | angepasst (Login 0028) | – | 1 |
| 0005 | ORM Drizzle, RLS und Trigger als handgeschriebenes SQL | E7 | nein | vorgeschlagen (keine PO-Freigabe erteilt) | angepasst (ohne RLS) | – | 1 |
| 0006 | Job-Queue pg-boss mit transaktionaler Job-Erzeugung | E7 | nein | vorgeschlagen (keine PO-Freigabe erteilt) | angepasst | – | 1 |
| 0007 | AuthN Keycloak, AuthZ in der Planora-Datenbank | NFR SSO | nein | vorgeschlagen (keine PO-Freigabe erteilt) | ersetzt | ersetzt durch 0028 | – (ersetzt) |
| 0008 | 3D: Three.js/R3F mit InstancedMesh, Sprite-Pins, Auto-Layout, Leistungsstufen | E2, E8 | nein | vorgeschlagen (keine PO-Freigabe erteilt) | angepasst | – | 1 |
| 0009 | Dokumentverarbeitung: Python-Sidecar (OCRmyPDF, Docling) + Claude | E4, E7 | **ja, gering** (Python neben TS) | vorgeschlagen (keine PO-Freigabe erteilt) | angepasst (Stufen) | – | 1 Vorschau/OCR · 3 Indexierung · 4 Extraktion |
| 0010 | Mandantentrennung: RLS + zusammengesetzte Fremdschluessel | E5, E7 | nein | vorgeschlagen (keine PO-Freigabe erteilt) | ersetzt | ersetzt durch 0031 | – (ersetzt) |
| 0011 | Bauteil-Katalog global, versioniert; ETIM/eBKP-H nur als Mappings | E8, E12, E13 | nein | vorgeschlagen (keine PO-Freigabe erteilt) | angepasst | – | 1 |
| 0012 | Herkunftsmodell "Angabe" je Kennwert | Datenmodell-Grundsaetze | nein | vorgeschlagen (keine PO-Freigabe erteilt) | angepasst | – | 1 Formular/Excel · 4 Interview/KI |
| 0013 | Deterministische Erneuerungs- und Investitionsrechnung | E6 | nein | vorgeschlagen (keine PO-Freigabe erteilt) | angepasst (ohne Kosten) | – | 2 |
| 0014 | Grundriss-Erkennung hybrid mit Pflicht-Korrektur und manuellem Fallback | E3 | nein | vorgeschlagen (keine PO-Freigabe erteilt) | zurueckgestellt bis nach Demo | – | spaeteres Modul |
| 0015 | Audit-Log per Datenbank-Trigger mit Hash-Kette | NFR Nachvollziehbarkeit | nein | vorgeschlagen (keine PO-Freigabe erteilt) | angepasst | – | 1 |
| 0016 | Upload-Sicherheit: Quarantaene und Virenscan | NFR Security | nein | vorgeschlagen (keine PO-Freigabe erteilt) | angepasst | – | 1 |
| 0017 | KI-Kostenbremse und Schutzschalter | NFR, E5 | nein | vorgeschlagen (keine PO-Freigabe erteilt) | angepasst (Stufe 4) | – | 4 |
| 0018 | Preisdatenbank pro Typ mit Quellen-Port | E15 | nein | vorgeschlagen (keine PO-Freigabe erteilt) | zurueckgestellt bis nach Demo | – | spaeteres Modul |
| 0019 | Mehrsprachigkeit DE/FR/IT | E20 | nein | vorgeschlagen (keine PO-Freigabe erteilt) | zurueckgestellt bis nach Demo | – | spaeteres Modul (DE/de-CH ab 1) |
| 0020 | Austausch-Port mit Stratus-Adapter | E22, E9 | nein | vorgeschlagen (keine PO-Freigabe erteilt) | angepasst, [?] Stratus-Scope | – | [?] Stratus-Scope |
| 0021 | Zustandsmodell nach ZHAW und Lebensdauer-Tabelle | E11, E14 | nein | vorgeschlagen (keine PO-Freigabe erteilt) | angepasst, [?] Zustands-Scope | – | 2, Umfang [?] |
| 0022 | Dokument-Viewer: Vorschau-PDF, PDF.js, Markierung per Docling-Box | E23, E31 | nein | akzeptiert (E31) | angepasst | – | 1 |
| 0023 | Suche: PostgreSQL-Volltext + pgvector, RRF | E26, E27, E31 | nein | akzeptiert (E31) | angepasst (Stufe 3) | – | 3 |
| 0024 | Pflicht-Bausteine (Open Source) und Lizenzregeln | E28, E31 | nein | akzeptiert (E31) | angepasst (Stufenliste) | – | 1–4 (Liste je Stufe) |
| 0025 | Oeffentliche APIs: geo.admin.ch/GWR, Nager.Date, Pwned Passwords | E32 | nein | akzeptiert (E32) | zurueckgestellt bis nach Demo | – | spaeteres Modul |
| 0026 | Geschlossene 3D-Welt: Regelwerk, Interview-Agent, Weltgenerator | E2, E3, E33 | nein | akzeptiert (E33) | angepasst (Formular/Excel zuerst) | – | 1 Formular/Excel · 4 Agent |
| 0027 | Betrieb: ein Docker-Compose-Paket pro Kunde (CH-VM oder On-Premise) | E34, E35, E37 | nein | vorgeschlagen (neu Welle 4) | neu | ersetzt 0002 | 1 |
| 0028 | Lokaler Login mit Rollen | E34 | nein | vorgeschlagen (neu Welle 4) | neu | ersetzt 0007 | 1 |
| 0029 | Feature-Schalter / Kundenmodule pro Instanz | E37 | nein | vorgeschlagen (neu Welle 4) | neu | – | 1 |
| 0030 | KI ueber Claude API direkt (Stufe 4, pro Instanz aus) | E36, E37 | **ja, teilweise** (Datenregion us/global) | vorgeschlagen (neu Welle 4) | neu | ersetzt 0003 | 4 |
| 0031 | Instanz-Isolation statt RLS | E34, E35 | nein | vorgeschlagen (neu Welle 4) | neu | ersetzt 0010 | 1 |
| 0032 | Gebaeude vorbereiten, Kunde erfasst Einheiten und Technik | E38 | nein | akzeptiert (PO 2026-11-11) | praezisiert 0026/0008 | – | 1 Erfassung · 2 Ampel · 4 Agent |

## Vorlage

```
# NNNN – Titel
Freigabestatus: vorgeschlagen | akzeptiert | abgelehnt · Datum · freigegeben durch (PO-Entscheid E-Nr.)
Aenderungsstatus: unveraendert | angepasst | ersetzt | zurueckgestellt bis nach Demo | neu · Datum · Anlass (E-Nr.)
Ersetzt: NNNN | –   ·   Ersetzt durch: NNNN | –
Lieferstufe: 1 | 2 | 3 | 4 | spaeteres Modul (bei Teilen je Teil angeben)
Bezug: E-Nr. (inkl. E34–E37 falls betroffen), FA-Nr., AD-Nr. der Spine
## Kontext
## Entscheid
## Alternativen (verworfen, mit Grund)
## Konsequenzen (positiv / negativ / Folgearbeit, Spike)
```

Regeln zur Vorlage: Bei Ersetzung bleibt die alte ADR mit Statusblock und Verweis auf den Nachfolger als Historie erhalten; die neue ADR nennt den Vorgaenger in «Ersetzt». Zurueckgestellte ADRs nennen die Bedingung der Wiederaufnahme (eigener PO-Entscheid, Modul nach ADR 0029).
