# Planora: Kontext und Entscheide (aktualisiert 2026-11-11)

Aktueller Entwicklungsstand: [gemeinsame Fortsetzung](../superpowers/plans/2026-11-11-fortsetzung.md). M1a integriert; M1 technisch abgeschlossen und lokal abgenommen (WSL-Ersatz-VM); offen: echte CH-VM, SMTP-Versandtest, menschliche Lizenzfreigabe. Historische Abschnitte anhand neuerer Entscheide lesen.

## E41 – Gekuerzter Weg zu V1, Interview zuerst als Web-Assistent (PO, 2026-11-12)

Der PO bestaetigt den gekuerzten Plan (Interview → Twin → Anlagenakte → Ampel → Installation, ≈ 25–30 PT [A]) und das Interview zuerst als gefuehrten Web-Assistenten ohne KI. Suche, KI-Interview, KI-Auslesen, Excel-Import und weitere Gewerke folgen nach V1. Leitungsfuehrung bleibt schematisch (unter der Decke); detaillierte Leitungsplanung ist nicht Ziel. Raumgroessen sollen dem Inhalt folgen; Zubehoer (Pumpen, Ventile, Zaehler) muss flexibel an beliebigen Orten im Fluss moeglich sein. Plan und Konzept: [Weg zu V1](../superpowers/plans/2026-11-12-weg-zu-v1.md).

## E40 – Plastische 3D-Welt und ausgearbeitete Oberflaeche (PO, 2026-11-12)

Der PO bestaetigt die Kombination seiner drei Bildreferenzen: Bild 2 fuer eine helle, plastische Gebaeudeuebersicht, Bild 3 fuer aufgeschnittene Geschoss-/Technikansichten mit erkennbaren Bauteilen und Versorgungsbeziehungen, Bild 1 fuer die Anordnung der Informationskarten und Navigation. M2b-1 ist ein funktionaler Schnitt, keine visuelle Endabnahme. Die einfache Quader-/Pin-Ansicht ist kein finales Erscheinungsbild. Schematisch und datengetrieben bleibt verbindlich; hochwertige Gestaltung ist damit vereinbar.

Referenzen, naechster Schnitt und Schaetzannahmen: [Visuelle Zielrichtung](../design/2026-11-12-visuelle-zielrichtung.md). Zusatzaufwand [A]: **6–10 PT, Planungswert +8 PT**, zusaetzlich zum bisherigen Funktionsumfang, ohne Geschossauswahl/Explosion und grundlegenden Katalog doppelt zu zaehlen. Vollstaendige Innenausstattung und massgetreue Leitungsnetze sind nicht in dieser Schaetzung enthalten.

## E39 – Betrieb durch Planora, Alarm, Aufbewahrung, Lizenzmodell (PO, 2026-11-11)

- Hosting: Planora stellt Server und Domain je Kunde; Kunde braucht keine eigene IT und erhaelt Zugang durch uns. Vorschlag Server: CH-VM 4 vCPU/8 GB/100+ GB, z. B. Infomaniak VPS Lite (CHF 18/Monat bei Jahresvertrag laut Anbieterseite 11.11.2026, vor Bestellung bestaetigen) [A]. [?] AVV/Lieferantenpruefung mit Siemens klaeren.
- Backup-Aufbewahrung 14 taeglich / 8 woechentlich / 12 monatlich freigegeben.
- Alarm per SMTP an die Konto-E-Mail-Adressen des Kunden (Standard Admin-Konten [A], umschaltbar auf alle) plus eine Planora-Adresse je Kunde zum Filtern.
- Lizenz: Planora proprietaer, Nutzungsrecht je Instanz waehrend Vertragsdauer, kein Quellcode. Fixture @fastify/deepmerge: MIT- und ISC-Text beilegen. Menschliche Lizenzfreigabe bewusst offen.

## E38 – Kunden-Erfassung in vorbereiteter 3D-Welt (PO bestaetigt, 2026-11-11)

Planora bereitet je Kunde die schematische Gebaeudehuelle mit Geschossen vor. Kunden definieren Einheiten und Technik ueber gefuehrte Formulare, zuerst Heizung (HK/FBH/TABS, Verteiler, Kreise, Mengen). Standort und versorgte Einheiten getrennt; kein automatischer Verteiler je Einheit. Unbekannt, Kopieren, einfache Layoutkorrektur und bestaetigte Vorschlaege gehoeren dazu. Eine Codebasis, deterministischer Generator. Verbindliche Praezisierung: [ADR 0032](adr/0032-gebaeude-vorbereiten-kunde-erfasst-technik.md). Zusatzschaetzungen im Fortsetzungsplan; noch nicht implementiert.

Quelle fuer alle Worker des Architektur-Teams. Kennzeichnung: [F] Fakt, [A] Annahme, [?] offene Frage.
Sprache aller Dokumente: Deutsch (de-CH), kein Eszett, immer `ss`.

## Produktidee

Software fuer Facility Manager (FM) fuer die Phase nach der Inbetriebnahme (Bewirtschaftung, SIA-Phase 6 [A]).
Marktluecke: Gebaeude im Betrieb strategisch managen, insbesondere Erneuerungsplanung der Gebaeudetechnik.

Ablauf aus Kundensicht:
1. Kunde laedt Grundriss(e) und Uebergabedokumente hoch (Datenblaetter, Auslegungen, Revisionsunterlagen, Anlage-/Leuchten-/Apparatelisten).
2. KI erkennt Geschosse und Raeume (als Rechtecke) aus Grundrissen und Elemente (Leuchten, Monoblocks, Pumpen ...) aus Listen und Schemas.
3. Kunde prueft und korrigiert KI-Vorschlaege mit wenigen Klicks.
4. Software erzeugt ein darstellerisches, klickbares 3D-Modell: Geschoss → Raum → Element.
5. Klick auf Element zeigt zugeordnete Dokumente und ausgelesene Kennwerte (Lebensdauer, Hersteller, Typ, Einbaudatum) mit Herkunft.
6. Software berechnet Restlebensdauer und informiert FM, was bald ersetzt werden muss, mit Kosten und Investitionsplan.

## Entscheide (vom Product Owner bestaetigt)

| # | Entscheid |
|---|---|
| E1 | Version 1 enthaelt alle Teile in einfacher Form: Struktur, Dokumente, KI-Auslesen, Erneuerungsplanung, 3D. |
| E2 | 3D ist **darstellerisch**, kein BIM. Look: weisses "Ton-Modell", isometrisch, Geschosse explodierbar/einzeln, schwebende Pins mit Icons (Referenz: Smart-Building-Dashboards, Warehouse-Isometrie). |
| E3 | Raeume sind **nur Rechtecke**. Raumerkennung per **KI aus Grundriss-PDF/Bild**, minimaler Kundenaufwand, mit Korrekturschritt. |
| E4 | Elemente werden per **KI aus Listen und Schemas** ausgelesen (nicht aus Plansymbolen). Unterlagen gemischt: PDF, Excel, teils Scans [A]. |
| E5 | Zielkunden: **Enterprise**, grosse, technisch dichte Anlagen (Beispiel Siemens). Sowohl FM-Dienstleister (viele Eigentuemer) als auch Eigentuemer/Betreiber mit eigenem FM. → Mandantenfaehigkeit ab Tag 1. |
| E6 | Ausgabe: Erneuerungsliste mit Zeitachse und Ampel, **Kostenschaetzung, 10–20-Jahre-Investitionsplan** (Excel-Export), **Zustandsbewertung vor Ort** passt Restlebensdauer an. |
| E7 | Architektur **A1**: modularer Monolith in TypeScript, PostgreSQL mit Row-Level-Security, S3-kompatibler Objektspeicher, Hintergrund-Worker fuer KI, **verwaltete Dienste in der Schweiz**, portabel (Docker, Standard-Postgres, S3-API) damit spaeter Self-Hosting / On-Premise beim Kunden moeglich. |
| E8 | 3D: **Three.js + React Three Fiber**, plus **Bauteil-Katalog** (Daten) und **.glb-Bibliothek** (selbst in Blender modelliert, Ton-Look, ca. 30–50 Bauteile [A]). KI waehlt nur aus Katalog-IDs; Unbekanntes landet in Pruefliste. Klassifikation an Standard koppeln (ETIM und/oder eBKP-H [A]). |
| E9 | REA (Reverse Engineering) nur spaeter fuer Import-Schnittstellen aus Bestandssystemen (Interoperabilitaet), nicht fuer Kernlogik. |
| E10 | Keine Wartungsauftraege, Stoerungsmeldungen, Tickets, Live-Sensordaten in V1 (klassisches CAFM, nicht die Marktluecke). |

## PO-Antworten zu 01-domaene.md (2026-11-08)

| # | Frage | Entscheid PO |
|---|---|---|
| E11 / PO-1 | Lebensdauer-Quelle | **Keine CRB-Lizenz.** Eigene Tabelle "Lebensdauer" mit Planora-Standardwerten. Nach dem Erfassen der Anlage entsteht diese Tabelle automatisch; Werte beliebig anpassbar **pro Typ und pro einzelner Anlage** (Monoblock 1 und Monoblock 2 koennen unterschiedliche Lebensdauern haben). → Datenmodell: Override auch am Element, nicht nur am Typ. |
| E12 / PO-2 | ETIM | ETIM nutzen, aber als **"vielleicht eigenes System"** markieren: Klassifikation austauschbar halten (eigene Katalog-ID fuehrend, ETIM als Mapping). |
| E13 / PO-3 | eBKP-H-Lizenz | **Keine Lizenzanfrage.** [?] Rechtliches Restrisiko beim Verwenden der Code-Struktur: Architekt soll eBKP-H nur als optionales Mapping fuehren. |
| E14 / PO-4 | Zustandsskala | **ZHAW-Methode** (Zustandswert, min/max-Bandbreite). |
| E15 / PO-5 | Ersatzkosten | **Preisdatenbank pro Typ**, die sich automatisch aktualisiert, wenn Hersteller Preise aendern. [?] Machbarkeit/Quellen der Herstellerpreise offen (Feeds wie BMEcat/Datanorm/Grosshandel [A]). V1-Fallback: manuelle Preise + Import, Auto-Update als eigenes Modul vorbereiten. |
| E16 / PO-6 | Teuerung | **Fester Satz pro Mandant, anpassbar.** |
| E17 / PO-7 | Ampel-Schwellen | **Kennwert pro Bauteil** (Schwelle je Bauteiltyp konfigurierbar). |
| E18 / PO-8 | Pilot-Testset | Pilotkunde ja; **momentan nur Architekturunterlagen** (Grundrisse), noch keine TGA-Dokumente. |
| E19 / PO-9 | FINMA | **Nein, vorerst nicht.** Aktuelle Zielkunden: **Manor und Siemens**. |
| E20 / PO-10 | Mehrsprachigkeit | **Ja, DE/FR/IT in V1.** |
| E21 / PO-11 | KBOB-Dokumenttypcode | **Ja.** |
| E22 / PO-12 | Positionierung zu Stratus | **Ja**, als Ergaenzung auf Element-Ebene, inkl. Export/Import. |

## Neupriorisierung durch PO nach Welle 3 (2026-11-08)

| # | Entscheid |
|---|---|
| E23 | **Kern von V1 = klickbares 3D-Modell + Dokumentablage.** Klick auf Element → Seitenpanel → hinterlegte Dokumente oeffnen sich **direkt im Browser, ohne Download** (PDF, Bilder, Excel, Word→PDF; DWG spaeter [A]). Herkunft einer Angabe → Sprung auf Seite + Markierung im Dokument. |
| E24 | **Kosten, Investitionsplan, Preisdatenbank (E6-Kostenteil, E15, E16) raus aus V1.** Spaeter als Zusatzmodul, im Auftrag und auf Kosten des Kunden nachbaubar. Viele Zielkunden haben bereits eigene Investitionsplaene. Offene Fragen E-T4 (Folgezyklus) und E-T7 (Preis-Feeds) damit fuer V1 gegenstandslos. |
| E25 | Lebensdauer + Warnung "bald ersetzen" (Ampel) bleiben in V1 [A, Bestaetigung PO ausstehend]. |
| E26 | **Intelligente Suche, KI-unterstuetzt**, in V1: (a) Dokumentnamen, (b) Volltext in allen Dokumenten, (c) **inhaltliche/semantische Suche** (z.B. Suche nach "Funktionsbeschrieb" findet entsprechende Textstellen in allen Dokumenten, auch ohne exakten Begriff). Treffer mit Dokument, Seite, Textausschnitt, Sprung in den Viewer. DE/FR/IT. |
| E27 | Fuer E26: **kostenguenstiger "Leser"** (Embedding-/Indexierungsmodell fuer alle Dokumente) und ein **genuegend schlaues Server-Modell** fuer Anfrageverstaendnis/Reranking/Antwort mit Quellen. Vorschlag [A, zu recherchieren]: Hybridsuche PostgreSQL-Volltext (tsvector DE/FR/IT) + pgvector; Embeddings mehrsprachig, entweder selbst gehostet in CH (z.B. bge-m3 / multilingual-e5) oder Voyage AI; Claude Haiku 5.5 fuer Anfrage/Reranking; Mandantentrennung auch im Vektorindex. |

## Plan- und Kostenentscheid (2026-11-08)

| # | Entscheid |
|---|---|
| E28 | **Variante schnell und schlank:** Demo zuerst als durchgehender Schnitt mit Lindenhof-Daten (Woche 7), Module parallel mit Agenten, fertige Bausteine statt Eigenbau; Pilot ca. Woche 28. Externe Hilfe nur Pentest, Jurist, menschlicher Review Login/Mandanten/Upload, DevOps-Check, FR/IT-Gegenlesen (≈ CHF 10–22k). Matts Zeit zaehlt nicht als Kosten. Details: `docs/plan/umsetzungsplan.html`, `docs/plan/kosten-und-preise.md`. |
| E29 | **REA** nur fuer Importe aus Bestandssystemen (nach Pilot), nicht fuer den Aufbau von V1. |
| E30 | Architekturkarte (System, Module, Ablaeufe, Datenmodell, API-Vorschlag): `docs/plan/architektur-uebersicht.html`. Neu und ungeprueft: Modul `suche` + Tabelle `such_abschnitt`, Embedding-Dienst, Modul `hinweise`, API-Pfade → in Welle 4 pruefen. |
| E31 | **Pflicht-Bausteine (Open Source) statt Eigenbau** (2026-11-09): Alle Bausteine aus `06-bausteine-open-source.md` Kap. 2 und 5 werden eingebaut – u.a. Uppy, PDF.js, React PDF Highlighter, Gotenberg, React Konva, React Three Fiber, Docling Serve, pgvector, TanStack, Zustand, react-hook-form + zod, i18next, pino, file-type, exceljs, Nodemailer + MJML, pgTAP, Squawk, GlitchTip, Healthchecks, Uptime Kuma, Trivy, Syft, cosign, Gitleaks, Semgrep, Renovate, OWASP ZAP, axe, k6, Tolgee. Upload neu per serverseitig abgeschlossenem Multipart (schliesst K01); Prompt-Injection-Schutz verbindlich. Eingearbeitet in 03-architektur, Spine (AD-20, AD-21), ADR 0009/0014/0016, neue ADR 0022–0024, 05-tests. |
| E32 | **Oeffentliche APIs verbindlich** (2026-11-09): geo.admin.ch (Adresssuche + Gebaeude- und Wohnungsregister GWR: EGID, Baujahr, Geschosse als bestaetigungspflichtige Vorschlaege), Nager.Date (Feiertage CH inkl. Kantone, jaehrlicher Import), Have I Been Pwned Pwned Passwords (lokale Keycloak-Konten). Nie Dokument- oder Personendaten an externe APIs. ADR 0025, Spine AD-22, `06-bausteine-open-source.md` Kap. 9. |
| E33 | **Geschlossene 3D-Welt** (2026-11-09): Gebaeude- und Bauteilmodell bleiben, aber **sinngemaess** (schematisch, kein BIM). Ein versioniertes **Welt-Regelwerk** legt fest, wie die 3D-Welt aussieht, wie sie funktioniert und welche Elemente es gibt. Der Kunde beschreibt im **Interview** (Agent mit Claude oder Formular/Excel ohne KI) Gebaeude, Geschosse, Einheiten je Geschoss und technische Bauteile je Einheit; ein **deterministischer Weltgenerator** erzeugt daraus die Welt, der Kunde bestaetigt. Look wie Referenzbilder (Glas-Geschosse, Pins in der Uebersicht, Bauteil-Modelle im Detail), Leistungsstufen normal/schwach/2D (Spike S3b). ADR 0026, ADR 0008 angepasst, Spine AD-23/AD-24. |

## Modellwechsel B2B (PO-Entscheid 2026-11-09)

| # | Entscheid |
|---|---|
| E34 | **B2B, eine Instanz pro Kunde (Single-Tenant).** Jeder Kunde bekommt eigenen Server und eigene App. Ersetzt die Mandantenfaehigkeit aus E5/E7 fuer V1; RLS, Keycloak und Microsoft-SSO werden zurueckgestellt (spaeter Kundenmodul). V1: einfacher lokaler Login mit Rollen. |
| E35 | **Betrieb als ein Docker-Compose-Paket**, Standard von uns gehostet (eigene VM in der Schweiz pro Kunde), auf Wunsch On-Premise beim Kunden mit demselben Paket. Self-Hosting und Open Source bevorzugt; ersetzt Exoscale-Managed-Dienste (ADR 0002). |
| E36 | **KI nur ueber die Claude API** (direkt Anthropic), ersetzt Bedrock (ADR 0003). App funktioniert ohne KI (Formular/Excel). KI pro Instanz abschaltbar. Embeddings fuer die Suche lokal mit Open-Source-Modell [A]. Oeffentliche APIs aus E32 bis nach der Demo zurueckgestellt. |
| E37 | **Eine Codebasis, Kundenfeatures als Module** mit Schalter pro Instanz. Ziel "Demo" = vollstaendig funktionierende App beim ersten Kunden (Siemens), geliefert in Stufen 1–4; Ziel Uebergabe Stufe 2 (ca. W12) [A], Vollzeit Matt [A]. Bedrock und Exoscale-Managed sind dauerhaft ersetzt, nicht nur verschoben. [?] PO: E27-Teil "Anfrageverstaendnis/Reranking/Antwort mit Quellen" (braucht Claude) von Stufe 3 auf Stufe 4 verschieben? Vorschlag: ja. Plan: `docs/plan/umsetzungsplan.html` (V2), Kosten/Preise: `docs/plan/kosten-und-preise.md` Abschnitt 00. Gestrichen bis nach der Demo: siehe Umsetzungsplan, Kasten "Gestrichen". Aenderungsliste fuer die Architektur: `07-analyse-b2b.md`. |

Kurzbezeichnungen N1–N6 (in `07-analyse-b2b.md` und `05-tests.md` Kap. 12 verwendet, entsprechen E34–E37): **N1** B2B Single-Tenant (E34) · **N2** Compose-Paket, CH-VM oder On-Premise (E35) · **N3** nur Claude API extern, App ohne KI nutzbar (E36) · **N4** eine Codebasis, Module mit Schalter (E37) · **N5** Demo = fertige App beim ersten Kunden in Stufen 1–4 (E37) · **N6** Streichliste bis nach der Demo (Umsetzungsplan V2, Kasten "Gestrichen").

## Naechste Schritte (Stand 2026-11-09)

Welle 4 laeuft auf Branch `welle-4-b2b`: Analyse (07-analyse-b2b.md), Umsetzung in 03-architektur/ADRs/Spine, Codex-Pruefung. Die Liste unten (2026-11-08) gilt nur noch, soweit sie nicht durch E34–E37 ueberholt ist (Mandanten, Bedrock, FR/IT, Exoscale entfallen fuer V1).

## Naechste Schritte (Stand Ende Sitzung 2026-11-08)

Grund fuer Pause: Abo-Nutzungsvolumen knapp. Wiederaufnahme hier:
1. **Ueberarbeitungsauftrag an Architekt (Welle 4):** 03-architektur.md + ADRs an E23–E27 anpassen:
   - Scope: Kosten/Investitionsplan/Preis-Modul aus V1 entfernen, als Erweiterungspunkt markieren.
   - Neues Modul **Dokument-Viewer** (Formate, Umwandlung beim Upload, Seiten-Sprung + Markierung, kurzlebige mandantengebundene Links).
   - Neues Modul **Suche** (E26/E27): Indexierung, Hybridsuche, Embedding-Modell + Server-Modell begruenden (Kosten pro Gebaeude, Datenstandort), Tech-Recherche dazu.
   - 3D: InstancedMesh als Standard, 2D-Fallback bei Software-Renderer (E-T2, E-T3).
   - Kritische/hohe Befunde aus 04-review.md schliessen, soweit V1 betroffen (K01 Upload zwingend; K02 entfaellt mit E24).
   - Test-Empfehlungen E-T1, E-T5, E-T6, E-T8, E-T9, E-T10 aus 05-tests.md Kap. 1.3 einarbeiten.
   - E31 ist eingearbeitet (Bausteine verbindlich, `06-bausteine-open-source.md`, ADR 0022–0024); Welle 4 prueft nur noch die Konsistenz mit den uebrigen Punkten.
   - Architekturkarte (E30) gegenpruefen: API-Pfade, Suche, Hinweise; Reihenfolge an Demo-Schnitt (E28) anpassen.
2. **Codex-Review** nur der Korrekturen.
3. **Bereitschafts-Check**, dann Spec (`docs/superpowers/specs/`) und Umsetzungsplan mit Ressourcen (writing-plans).
4. **Fuer den Chef:** echte TGA-Unterlagen vom Pilot (Manor/Siemens) beschaffen; KI-Datenstandort EU juristisch klaeren; Vertretung/Support fuer Matt regeln.
5. **API-Test** (Bedrock/Claude-API) der Spikes S1/S2 mit echten Unterlagen vor Baubeginn.

## Datenmodell-Grundsaetze (Design-Abschnitt 1, bestaetigt)

- Hierarchie: Mandant → Liegenschaft/Gebaeude → Geschoss → Raum (Rechteck x,y,b,t) → Element.
- **Elementtyp getrennt von Element**: Lebensdauer, Datenblatt, Preis am Typ; Einbaudatum, Standort, Zustand am Element.
- **Jede ausgelesene Angabe hat Herkunft**: Dokument, Seite, KI-Konfidenz, Status (vorgeschlagen / bestaetigt von wem, wann).
- **Lebensdauer-Rangfolge**: manuell > Herstellerdatenblatt > Norm-Richtwert pro Anlagetyp.
- Restlebensdauer = Einbaudatum + Lebensdauer, korrigiert durch Zustandsfaktor (pro Mandant einstellbar).
- Mandantentrennung: `mandant_id` ueberall, erzwungen per PostgreSQL Row-Level-Security.
- Kosten pro Elementtyp mit Preisjahr; Investitionsplan rechnet hoch.
- Dokumente n:m zu Elementtypen/Elementen.

## Nicht-funktionale Anforderungen [A, vom Architekten zu schaerfen]

- Datenstandort Schweiz, revDSG-konform; KI-Nutzung pro Mandant abschaltbar; Datenfluss zur KI vertraglich sauber.
- SSO (z.B. Microsoft Entra ID), Rollen und Rechte pro Mandant/Liegenschaft.
- Skalierung: 10'000+ Elemente pro Gebaeude, Pins gruppieren, 3D performant.
- Nachvollziehbarkeit (Audit-Log), Backups, Wiederherstellung.
- Enterprise-Security-Fragebogen beantwortbar (ISO 27001-Naehe [A]).
- Ziel des Product Owners: Software muss **bedingungslos funktionieren**. Planung hat deshalb hoechste Prioritaet.

## Team und Ressourcen

- Entwicklung: 1 Person (Matt) mit Claude Code.
- Verkauf, Beratung, FM-Fachwissen: Chef.
- Optional externe Freelancer (Code, Review).
- Zieldatum erste Pilot-Demo: offen.

## Offene Fragen [?]

- Welche Lebensdauer-Norm ist in der Schweiz ueblich (VDI 2067, SIA, eBKP-H-Richtwerte, Herstellerangaben)?
- Bietet Anthropic bzw. AWS Bedrock / Google Vertex Claude mit Datenverarbeitung in der Schweiz oder EU vertraglich zugesichert?
- Wie zuverlaessig erkennt Claude Vision Raeume aus Grundrissen und Lebensdauern aus Datenblaettern? (Machbarkeitstests in `spikes/`)
- Welche Schweizer Anbieter bieten Managed PostgreSQL, Objektspeicher und Container-Hosting, zu welchen Preisen?

## Arbeitsregeln fuer das Architektur-Team

- **Nichts bauen.** Kein Produktivcode, kein Projekt-Scaffold. Einzige Ausnahme: Wegwerf-Machbarkeitstests in `spikes/` durch den Test-Architekten.
- Preise, Versionen, Lizenzen, Gesetzesstaende **nachschlagen** und mit Quelle + Abrufdatum belegen, sonst [A].
- BMAD-Skills (in `.claude/skills/bmad-*`) duerfen genutzt werden. Sie sind interaktiv ausgelegt: Fragen aus diesem Dokument beantworten, Annahmen als [A] festhalten, nur echte Blocker an den Koordinator eskalieren.
- Ausgaben nach `docs/architektur/`. Keine Geheimnisse (API-Keys) in Dateien.
