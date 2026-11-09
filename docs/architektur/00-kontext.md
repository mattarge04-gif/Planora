# Planora: Kontext und Entscheide (Stand 2026-11-08)

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

## Naechste Schritte (Stand Ende Sitzung 2026-11-08, noch NICHT gestartet)

Grund fuer Pause: Abo-Nutzungsvolumen knapp. Wiederaufnahme hier:
1. **Ueberarbeitungsauftrag an Architekt (Welle 4):** 03-architektur.md + ADRs an E23–E27 anpassen:
   - Scope: Kosten/Investitionsplan/Preis-Modul aus V1 entfernen, als Erweiterungspunkt markieren.
   - Neues Modul **Dokument-Viewer** (Formate, Umwandlung beim Upload, Seiten-Sprung + Markierung, kurzlebige mandantengebundene Links).
   - Neues Modul **Suche** (E26/E27): Indexierung, Hybridsuche, Embedding-Modell + Server-Modell begruenden (Kosten pro Gebaeude, Datenstandort), Tech-Recherche dazu.
   - 3D: InstancedMesh als Standard, 2D-Fallback bei Software-Renderer (E-T2, E-T3).
   - Kritische/hohe Befunde aus 04-review.md schliessen, soweit V1 betroffen (K01 Upload zwingend; K02 entfaellt mit E24).
   - Test-Empfehlungen E-T1, E-T5, E-T6, E-T8, E-T9, E-T10 aus 05-tests.md Kap. 1.3 einarbeiten.
   - Bausteine-Abgleich `06-bausteine-open-source.md` einarbeiten (Uppy-Multipart schliesst K01, Gotenberg/Docling Serve fuer Viewer und docproc, pgvector fuer Suche, React-Konva fuer Grundriss).
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
