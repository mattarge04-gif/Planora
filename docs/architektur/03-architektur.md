# 03 – Architektur Planora V1

Stand: 2026-11-08 · Rolle: System-Architekt (Welle 2, Orca-Task task_5a6b938dca10) · Status: **Entwurf zur Freigabe**
Basis (verbindlich): `00-kontext.md` (E1–E10 und PO-Antworten E11–E22), `01-domaene.md` (FA-01..FA-38), `02-tech-recherche.md`.
Die PO-Antworten E11–E22 (Stand 2026-11-08) sind eingearbeitet; wo 01-domaene ein anderes Default vorschlug, gilt E11–E22.
Kennzeichnung: **[F]** Fakt mit Quelle · **[A]** Annahme (durch Spike oder PO zu bestaetigen) · **[?]** offen.
Quellenkuerzel: `Qn-Dom` = Quelle n in 01-domaene, `Qn-Tech` = Quelle n in 02-tech-recherche, `FA-nn` = Anforderung in 01 Kap. 7.
**E31 (2026-11-09): Pflicht-Bausteine** laut `06-bausteine-open-source.md` und ADR 0022–0024 sind eingearbeitet (Kap. 2.2, 5, 6, 10, 15).
Entscheide im Detail: `adr/0001`–`adr/0024` (Index: `adr/0000-adr-vorlage-und-index.md`). BMAD-Arbeitsprotokoll und Spine: `bmad/planning-artifacts/architecture/architecture-Planora-2026-11-08/`.

---

## 1. Zusammenfassung und Qualitaetsziele

### 1.1 Zusammenfassung (10 Punkte)

1. **Modularer Monolith in TypeScript, ein Image, drei Prozessrollen** (`api`, `worker`, `migrator`). 13 Fachmodule mit fester Datenhoheit, Import-Grenzen per Lint erzwungen (ADR 0001).
2. **"Bedingungslos funktionieren" heisst hier:** keine stillen Fehler, kein Datenverlust, kein Mandantenleck, jede Zahl erklaerbar. Es heisst **nicht** 99.99 % Verfuegbarkeit; Ziel V1 ist 99.5 % pro Monat [A]. Jede KI-Funktion hat einen manuellen Weg, der ohne KI zum gleichen Ergebnis fuehrt.
3. **Mandantentrennung dreifach:** PostgreSQL-RLS mit `FORCE` und fail-closed-Kontext, zusammengesetzte Fremdschluessel `(mandant_id, id)`, Rechtepruefung in der App. Pflicht-Tests in der CI (ADR 0010).
4. **Herkunft ist das Datenmodell:** Jeder Kennwert ist eine `angabe` mit Dokument, Seite, Zitat, Konfidenz, Status. In die Rechnung fliessen **nur bestaetigte** Angaben (ADR 0012).
5. **KI liefert Vorschlaege, nie Wahrheit:** Claude Sonnet/Haiku 5.5 ueber **AWS Bedrock eu-central-2 mit EU-Profil** (Abweichung vom PO-Entscheid "Datenstandort CH" fuer den KI-Pfad, ADR 0003). Ausgabe nur gegen Katalog-IDs, Pruefung von Schema, Plausibilitaet und Zitat im Seitentext. KI pro Mandant **opt-in**; vor jedem Aufruf Kostenschaetzung und Budgetreservierung, Antwort-Cache, globaler Not-Aus (ADR 0017).
6. **Erneuerungsrechnung als reine Funktion:** Stichtag explizit, Geld in Rappen, Rechenweg pro Zeile, eingefrorene Planstaende mit Hash; gleiche Eingabe = gleiches Ergebnis. Zustand nach **ZHAW-Methode** (E14), Lebensdauer pro Typ **und pro Element** ueberschreibbar (E11), Ampel-Schwelle pro Bauteiltyp (E17), Preise aus eigener **Preisdatenbank** (E15) (ADR 0013, 0018, 0021).
7. **Grundriss hybrid:** Vektor-Stempel + Claude Vision + deterministische Geometriepruefung + Pflicht-Korrektur-UI; manuelles Zeichnen immer verfuegbar (ADR 0014).
8. **3D darstellerisch:** BatchedMesh, Sprite-Pins mit hierarchischem Clustering, Element-Positionen per deterministischem Auto-Layout im Raum; Budget 10'000 Elemente bei 60 fps auf Laptop mit integrierter GPU [A] (ADR 0008).
9. **Offen fuer Austausch und Sprachen:** Klassifikation (ETIM, eBKP-H) nur als austauschbare Mappings an der fuehrenden Planora-Katalog-ID (E12/E13); DE/FR/IT ab V1 (E20); Export/Import Richtung Stratus ueber einen Adapter (E22) (ADR 0011, 0019, 0020).
10. **Betrieb Schweiz:** Exoscale Zuerich (Managed PG Business mit PITR/HA, SOS), Offsite Genf, Docker Compose zum Start, On-Prem mit denselben Images; RPO 5 min / RTO 4 h [A], monatlicher automatischer Restore-Test (ADR 0002).

### 1.2 Qualitaetsziele (priorisiert)

Bei Zielkonflikten gewinnt das hoeher stehende Ziel.

| Rang | Qualitaetsziel | Konkretes Szenario / Messgroesse | Hauptmechanismen |
|---|---|---|---|
| 1 | **Korrektheit der Daten** | Kein unbestaetigter KI-Wert in Rechnung oder Export (Test: 0 Treffer). Summen Investitionsplan = Summe der Zeilen auf den Rappen (FA-26). Rechnung reproduzierbar: gleicher Planstand → byte-identisches Ergebnis. | ADR 0012, 0013; Validator; Optimistic Locking |
| 2 | **Mandantentrennung** | 0 Fremdzeilen in RLS-, Pool-Leak- und API-Tests (FA-01); fehlender Kontext → Fehler, nie leere oder fremde Daten. | ADR 0010; CI-Katalogpruefung |
| 3 | **Nachvollziehbarkeit** | Fuer jede Aenderung wer/wann/alt/neu abrufbar (FA-06); fuer jeden effektiven Wert Quelle + Rangstufe (FA-21); fuer jedes KI-Ergebnis Prompt-, Modell-, Katalog- und Pipeline-Version. | ADR 0015, 0012; `extraktion_lauf` |
| 4 | **Verfuegbarkeit und Wiederherstellbarkeit** | 99.5 %/Monat [A]; RPO DB ≤ 5 min, Dokumente ≤ 24 h; RTO ≤ 4 h [A]; KI-Ausfall blockiert keine Nicht-KI-Funktion. | Kap. 10; Schutzschalter; manuelle Wege |
| 5 | **Performance** | API p95 ≤ 300 ms fuer Lesezugriffe [A]; Erneuerungsliste 10'000 Elemente ≤ 2 s [A]; 3D 60 fps median / p95-Frame ≤ 33 ms bei 10'000 Elementen [A]. | Projektion `element_effektiv`; Kap. 7 |
| 6 | **Portabilitaet** | Gleiche Images laufen auf Exoscale, AWS und On-Prem; nur libpq, S3-API, OIDC, OCI (E7). | ADR 0001, 0002 |

---

## 2. Kontext- und Containerdiagramm (C4)

### 2.1 Systemkontext

```mermaid
flowchart LR
  fm["FM-Mitarbeitende<br/>(Mandanten-Admin, Bearbeiter,<br/>Bewerter, Leser)"]
  ops["Planora-Betrieb<br/>(Matt)"]
  idp["Kunden-IdP<br/>Microsoft Entra ID"]
  planora[["Planora<br/>SaaS in CH (Exoscale)"]]
  bedrock["AWS Bedrock<br/>eu-central-2, EU-Profil<br/>(Claude Sonnet/Haiku 5.5)"]
  mail["E-Mail-Versand CH [A]"]
  fm -- "Browser/Tablet, HTTPS" --> planora
  ops -- "Deploy, Monitoring" --> planora
  planora -- "OIDC/SAML-Brokering" --> idp
  planora -- "Seitenbilder + Text, nur wenn KI fuer Mandant aktiv" --> bedrock
  planora -- "Benachrichtigungen" --> mail
```

### 2.2 Container

```mermaid
flowchart TB
  subgraph browser["Browser"]
    spa["SPA React 19 + R3F<br/>(Vite-Build, statisch)"]
  end
  subgraph exo["Exoscale ch-dk-2 (Zuerich)"]
    lb["Load Balancer + TLS"]
    api["Prozess api<br/>Fastify BFF, Node"]
    wrk["Prozess worker<br/>pg-boss-Handler, Node"]
    mig["Prozess migrator<br/>(laeuft vor Deploy)"]
    doc["docproc<br/>Docling Serve, OCRmyPDF, Gotenberg<br/>kein DB-Zugriff, kein Internet"]
    av["ClamAV"]
    kc["Keycloak 26.8"]
    pg[("Managed PostgreSQL<br/>Business, HA, PITR<br/>Fachdaten + pgboss + Audit")]
    sos[("SOS Objektspeicher<br/>quarantaene/ dok/ abgeleitet/ planstand/ export/")]
    mon["Monitoring<br/>OTel Collector, Prometheus,<br/>Loki, Grafana [A], GlitchTip, Healthchecks"]
  end
  subgraph gva["Exoscale ch-gva-2 (Genf)"]
    off[("SOS Offsite<br/>pg_dump verschluesselt,<br/>Dokument-Replikat")]
  end
  bedrock["AWS Bedrock eu-central-2"]
  spa --> lb --> api
  lb --> kc
  api --> pg
  api --> sos
  api --> kc
  wrk --> pg
  wrk --> sos
  wrk --> doc
  wrk --> av
  wrk --> bedrock
  doc --> sos
  mig --> pg
  api -.-> mon
  wrk -.-> mon
  pg -. "taeglich" .-> off
  sos -. "naechtlich" .-> off
```

Regeln: Nur `api` und `keycloak` sind von aussen erreichbar. `docproc`, `ClamAV` sind nur aus dem Worker-Netz erreichbar. Nur `worker` spricht mit Bedrock.

---

## 3. Module des Monolithen

### 3.1 Innenstruktur jedes Moduls (ADR 0001)

```text
src/
  plattform/            # Kern: DB-Wrapper mitMandant(), IDs, Fehler, Konfig, Logging, Audit-Funktion, Job-Registry
  module/<name>/
    api/index.ts        # einziger Import-Punkt fuer andere Module (Funktionen + Typen)
    domain/             # reine Logik, kein IO, kein Date.now()
    ports/              # Interfaces (Repository, Provider)
    adapters/           # Postgres, S3, HTTP, KI
    jobs/               # pg-boss-Handler
    http/               # Fastify-Routen (duenn: Validierung → api → Antwort)
web/                    # SPA
docproc/                # Python-Sidecar
katalog/                # katalog.vN.json + GLB-Quellen
eval/                   # Golden-Set-Definitionen (ohne Kundendokumente)
```

Testbarkeit: `domain/` mit reinen Unit-Tests; `adapters/` gegen echte Postgres-Testinstanz (Container) mit RLS aktiv; jedes Modul ersetzt fremde Module in Tests durch Fakes ihrer `api/index.ts`-Typen.

### 3.2 Abhaengigkeitsrichtung

```mermaid
flowchart BT
  plattform["plattform (Kern)"]
  identitaet --> plattform
  mandant --> plattform
  identitaet --> mandant
  katalog --> plattform
  struktur --> identitaet
  dokumente --> identitaet
  bestand --> struktur
  bestand --> katalog
  bestand --> dokumente
  zustand --> bestand
  erneuerung --> bestand
  erneuerung --> zustand
  erneuerung --> mandant
  extraktion --> dokumente
  extraktion --> bestand
  extraktion --> struktur
  extraktion --> katalog
  extraktion --> mandant
  szene --> struktur
  szene --> bestand
  szene --> erneuerung
  export --> erneuerung
  export --> bestand
  export --> dokumente
  preise --> katalog
  preise --> mandant
  erneuerung --> preise
  austausch --> bestand
  austausch --> struktur
  austausch --> erneuerung
```

Pfeil = "darf aufrufen". Alles darf `plattform` nutzen. Rueckwaerts-Aufrufe und Zyklen sind verboten; Rueckmeldungen laufen ueber Jobs/Ereignisse (pg-boss), z.B. `bestand` → Ereignis `angabe.entschieden` → Handler in `szene` invalidiert Cache.

### 3.3 Modulkatalog

| Modul | Zweck | Oeffentliche API (Auszug) | Abhaengig von | Datenhoheit (Tabellen) |
|---|---|---|---|---|
| **plattform** | Querschnitt: Transaktion mit Mandantenkontext, IDs (UUIDv7), Fehlerformat, Konfiguration, Logging/Tracing, Audit-Ereignis, Job-Registrierung, Feature-Flags | `mitMandant(ctx, fn)`, `neueId()`, `auditEreignis()`, `jobs.senden()` | – | `feature_flag`, `audit_eintrag` (Schreiben nur per Trigger/Funktion) |
| **identitaet** | Login (OIDC-BFF), Sessions, Benutzer, Mitgliedschaften, Rollen, Liegenschafts-Scope, Autorisierung | `aktuellerKontext(req)`, `pruefe(recht, liegenschaftId)`, `mandantWechseln()`, `mitgliedschaftenVerwalten()` | mandant | `benutzer`, `mitgliedschaft`, `mitgliedschaft_liegenschaft`, `sitzung` |
| **mandant** | Mandantenstammdaten und Parameter: KI-Schalter + Zustimmung, ZHAW-Parameter, Teuerung, Ampel-Default, Sprache, Budget, Betriebsstunden-Defaults | `parameter(mandantId)`, `kiErlaubt(mandantId)`, `parameterAendern()` | plattform | `mandant`, `mandant_parameter`, `ki_zustimmung` |
| **katalog** | Globaler Bauteil-Katalog (Katalog-ID fuehrend), Texte DE/FR/IT, Klassifikations-Mappings (ETIM, eBKP-H, weitere), Planora-Standard-Lebensdauern, Lebensdauer-Tabelle des Mandanten pro Typ (E11), Ampel-Schwellen pro Bauteiltyp (E17) | `eintrag(katalogId, sprache)`, `alle(version)`, `mapping(katalogId, system)`, `lebensdauerTabelle(mandantId)`, `ampelSchwelle(mandantId, katalogId)` | plattform | `katalog_version`, `katalog_eintrag`, `katalog_text`, `klassifikation_mapping`, `mandant_lebensdauer`, `mandant_ampel` |
| **struktur** | Liegenschaft → Gebaeude → Geschoss → Raum; Raum-Vorschlaege aus Grundriss annehmen | `baum(gebaeudeId)`, `raumVorschlaegeErfassen()`, `geschossBestaetigen()`, CRUD | identitaet | `liegenschaft`, `gebaeude`, `geschoss`, `raum`, `raum_vorschlag` |
| **dokumente** | Upload, Quarantaene/Scan, Ablage, Metadaten inkl. KBOB-Fachbereich und Dokumenttypcode (E21), Verknuepfungen, Vorschau-URLs | `uploadBeginnen()`, `status()`, `seitenText(dokId, seite)`, `verknuepfen()`, `vorschauUrl()` | identitaet | `dokument`, `dokument_seite`, `dokument_verknuepfung` |
| **bestand** | Elementtypen, Elemente, Angaben (Herkunft), Pruefliste, Projektion `element_effektiv` | `vorschlaegeErfassen(lauf, angaben[])`, `entscheiden(angabeIds, aktion, version)`, `effektiv(elementIds)`, `pruefliste()`, CRUD | struktur, katalog, dokumente | `elementtyp`, `element`, `angabe`, `element_effektiv` |
| **zustand** | Zustandsbewertungen vor Ort nach ZHAW-Methode (E14), Sammelbewertung, Historie, Vorschlag naechste Inspektion | `bewerten(elementIds, zustandswert, notiz, foto?)`, `aktuelleBewertung(elementIds)` | bestand | `zustandsbewertung` |
| **erneuerung** | Reiner Rechenkern, Erneuerungsliste, Investitionsplan, manuelle Verschiebung, Planstaende | `berechne(eingabe)` (rein), `liste(filter, stichtag)`, `plan(horizont)`, `verschieben()`, `planstandEinfrieren()` | bestand, zustand, mandant, preise | `ersatz_planung` (Verschiebungen), `planstand` |
| **preise** | Preisdatenbank pro Typ (E15): Herstellerpreise global, Mandantenpreise, Preishistorie mit `gueltig_ab`, Port `PreisQuelle` (V1: manuell, Excel/CSV-Import; spaeter Feeds) | `preis(elementtypId|katalogId, stichtag)`, `importieren(datei, zuordnung)`, `quelleSynchronisieren(quelleId)` | katalog, mandant | `preisquelle`, `hersteller_artikel`, `preis_eintrag`, `mandant_preis` |
| **austausch** | Export/Import mit Drittsystemen, V1 Stratus (E22), Port `AustauschFormat` | `exportieren(format, gebaeudeIds)`, `importVorschau(format, datei)`, `importieren()` | bestand, struktur, erneuerung | `austausch_auftrag` |
| **extraktion** | KI-Pipeline: Klassifikation, Auslesen, Grundriss-Analyse, Validierung, Kostenbremse, Prompt-/Modellversionen, Port `KiProvider` | `dokumentVerarbeiten(dokId)`, `grundrissAnalysieren(dokId, seite)`, `budgetStatus()` | dokumente, bestand, struktur, katalog, mandant | `extraktion_lauf`, `ki_aufruf`, `ki_budget`, `ki_cache` |
| **szene** | Lese-Modell fuer 3D: kompakte Szene je Gebaeude, Auto-Layout, Cluster-Vorberechnung | `szene(gebaeudeId)` → Binaer/JSON mit `datenstand` | struktur, bestand, erneuerung | keine eigenen Fachdaten (nur Cache) |
| **export** | Excel-Export (Liste, Plan), Mandanten-Gesamtexport, Loeschlauf | `excel(planstandId)`, `mandantExport()`, `mandantLoeschen()` | erneuerung, bestand, dokumente | `export_auftrag` |

Hinweis: Die Grundriss-Analyse lebt in `extraktion` (KI-Teil) und `struktur` (Vorschlaege annehmen, Raeume besitzen). Die Korrektur-UI schreibt ueber `struktur`.

---

## 4. Datenmodell

### 4.1 Kernentitaeten

```mermaid
erDiagram
  MANDANT ||--o{ LIEGENSCHAFT : hat
  LIEGENSCHAFT ||--o{ GEBAEUDE : hat
  GEBAEUDE ||--o{ GESCHOSS : hat
  GESCHOSS ||--o{ RAUM : hat
  RAUM ||--o{ ELEMENT : enthaelt
  ELEMENTTYP ||--o{ ELEMENT : typisiert
  KATALOG_EINTRAG ||--o{ ELEMENTTYP : klassifiziert
  ELEMENT ||--o{ ANGABE : "Kennwerte (ziel)"
  ELEMENTTYP ||--o{ ANGABE : "Kennwerte (ziel)"
  DOKUMENT ||--o{ ANGABE : belegt
  EXTRAKTION_LAUF ||--o{ ANGABE : erzeugt
  DOKUMENT ||--o{ DOKUMENT_VERKNUEPFUNG : ""
  ELEMENT ||--o{ ZUSTANDSBEWERTUNG : hat
  ELEMENT ||--o{ ERSATZ_PLANUNG : verschiebt
  MANDANT ||--o{ MITGLIEDSCHAFT : ""
  BENUTZER ||--o{ MITGLIEDSCHAFT : ""
  MANDANT ||--o{ PLANSTAND : friert_ein
```

### 4.2 Tabellen (Auszug, verbindliche Spalten)

Gemeinsame Spalten jeder Mandantentabelle: `id uuid` (UUIDv7, PK), `mandant_id uuid NOT NULL`, `version int NOT NULL` (Optimistic Locking), `erstellt_am/von`, `geaendert_am/von`, `UNIQUE (mandant_id, id)`.

| Tabelle | Schluessel / wichtige Spalten | Bemerkung |
|---|---|---|
| `mandant` | `id`, `name`, `status` (aktiv/gekuendigt/geloescht), `ki_aktiv bool DEFAULT false` | RLS: Zeile sichtbar nur fuer eigenen Mandanten |
| `mandant_parameter` | `zustandsmodell` (Default `zhaw_v1`, E14), `zhaw_knick` (Default 0,75 [A]), `nutzungsgrenze_default` (Default 0,25 [A, Bereich 0,1–0,4 laut Q12-Dom]), `teuerung_satz numeric(6,4)` (fester Satz, anpassbar, E16; Default 0,0100 [A]), `ampel_gelb_jahre_default` (Default 3 [A, FA-23]; pro Bauteiltyp ueberschreibbar, E17), `sprache_default` (de/fr/it, E20) | eine Zeile pro Mandant, versioniert |
| `benutzer` | `id`, `keycloak_sub UNIQUE`, `email`, `name`, `sprache` (de/fr/it) | global (keine mandant_id), RLS: nur eigener Datensatz + Mitglieder des aktiven Mandanten via Funktion |
| `mitgliedschaft` | `(mandant_id, benutzer_id) UNIQUE`, `rolle` | Rollen Kap. 9.2 |
| `mitgliedschaft_liegenschaft` | `(mandant_id, mitgliedschaft_id, liegenschaft_id)` | leer = alle Liegenschaften |
| `liegenschaft`, `gebaeude` | `gebaeude.uebergabedatum date` | Uebergabedatum = Default-Einbaudatum (FA-16) |
| `geschoss` | `gebaeude_id`, `bezeichnung`, `reihenfolge int`, `hoehe_m numeric`, `grundriss_dokument_id`, `grundriss_seite`, `massstab_m_pro_einheit`, `status` (entwurf/bestaetigt) | |
| `raum` | `geschoss_id`, `nummer`, `bezeichnung`, `x_m, y_m, breite_m, tiefe_m numeric(9,3)`, `quelle_art`, `raum_vorschlag_id` | Rechteck im Geschoss-Koordinatensystem (E3) |
| `raum_vorschlag` | `geschoss_id`, `extraktion_lauf_id`, normierte Koordinaten, Stempeltext, `konfidenz`, `status` | wird bei "Geschoss bestaetigen" zu `raum` |
| `katalog_version`, `katalog_eintrag` | `katalog_id text` (stabil, fuehrend, z.B. `leuchte.downlight`), `version`, `gruppe` (Planora-Gruppe fuer Plan und Filter), `glb_datei`, `glb_sha256`, `icon`, `ld_min/mittel/max_jahre` (Planora-Standard, E11), `nutzungsgrenze`, `ampel_gelb_jahre`, `betriebsstunden_pro_jahr`, `kosten_bezugsgroesse`, `referenzquelle` | global, read-only fuer App (ADR 0011). **Keine CRB-Werte** (E11) |
| `katalog_text` | `(katalog_id, version, sprache)` PK, `name`, `beschreibung` | DE/FR/IT (E20); eigene Uebersetzungen |
| `klassifikation_mapping` | `(katalog_id, system, code)`, `system_version`, `bezeichnung` | `system` ∈ {`etim`, `ebkp_h`, weitere}; optional, austauschbar (E12/E13); ETIM mit Attribution ODC-BY [F, Q9-Dom] |
| `mandant_lebensdauer` | `elementtyp_id` UNIQUE, `ld_min/mittel/max_jahre`, `nutzungsgrenze`, `quelle` (`planora_standard@vN` / `manuell`), `begruendung` | **Lebensdauer-Tabelle des Mandanten** (E11): bei Anlage eines Elementtyps automatisch aus dem Planora-Standard kopiert, danach frei editierbar |
| `mandant_ampel` | `katalog_id` UNIQUE, `ampel_gelb_jahre` | Schwelle pro Bauteiltyp (E17) |
| `preisquelle`, `hersteller_artikel`, `preis_eintrag` | Quelle (manuell/import/feed, Format, Lizenz), Artikel (`hersteller_norm`, `artikelnr`, `gtin` opt., `katalog_id`), Preis (`preis_rappen`, `bezugsgroesse`, `preisjahr`, `gueltig_ab`, `preisquelle_id`) | **global**, Preisdatenbank pro Typ (E15), nur einfuegend (Historie) |
| `mandant_preis` | `elementtyp_id` oder `katalog_id`, `preis_rappen`, `bezugsgroesse`, `preisjahr`, `gueltig_ab`, `quelle` | Mandantenpreise und Import (FA-24) |
| `elementtyp` | `katalog_id NOT NULL`, `hersteller`, `typbezeichnung`, `UNIQUE (mandant_id, katalog_id, hersteller_norm, typ_norm)` | Typ-Ebene: Lebensdauer, Datenblatt, Preis |
| `element` | `elementtyp_id`, `raum_id` (oder `geschoss_id` falls Raum unbekannt), `anlagekennzeichen`, `menge int ≥ 1`, `position jsonb NULL` (manuell), `status` (vorgeschlagen/aktiv/verworfen/ausgebaut) | Element-Ebene: Einbaudatum, Standort, Zustand. `menge` erlaubt Sammelelemente gleicher Typ/Raum/Einbaudatum [A] |
| `angabe` | siehe 4.4 | Herkunft je Wert |
| `element_effektiv` | `element_id PK`, effektive Werte + `quelle_rang` je Merkmal (ohne aufgeloeste Lebensdauer; die loest nur `erneuerung` auf, Kap. 8.1), `datenstand` | Projektion, neu aufbaubar |
| `zustandsbewertung` | `element_id`, `datum`, `zustandswert numeric(2,1)` (1,0 … 0,0 in 0,1-Schritten, ZHAW, E14), `notiz`, `foto_dokument_id`, `bewerter_id` | nur Einfuegen; neueste gilt (FA-31) |
| `ersatz_planung` | `element_id`, `zyklus int`, `geplantes_jahr`, `begruendung` | ueberschreibt nie das berechnete Jahr (FA-28) |
| `planstand` | `stichtag`, `horizont`, `regelwerk_version`, `eingabe_hash`, `eingabe_objekt` (S3), `summen jsonb`, `eingefroren_von/am` | unveraenderlich |
| `dokument` | `sha256`, `UNIQUE (mandant_id, sha256)`, `dateiname`, `mime`, `groesse`, `seiten`, `dokumentart`, `kbob_fachbereich`/`kbob_dtc` (Werteliste nach KBOB-Richtlinie [F, Q3-Dom], E21; KI schlaegt vor), `status` (Zustandsautomat Kap. 5.2), `gebaeude_id` | Objekt: `dok/m/<mandant>/<sha256>` |
| `dokument_verknuepfung` | `dokument_id`, `ziel_typ` (elementtyp/element/gebaeude/geschoss), `ziel_id` | n:m (FA-10) |
| `extraktion_lauf` | `dokument_id`, `stufe`, `seiten_von/bis`, `pipeline_version`, `prompt_id@version`, `modell_id`, `katalog_version`, `docproc_version`, `eingabe_hash`, `status`, `versuche`, `fehler` | eine Zeile pro Stufe und Seitenblock |
| `ki_aufruf` | `extraktion_lauf_id`, `provider`, `profil`, `modell_id`, `tokens_in/out`, `kosten_rappen`, `dauer_ms`, `ergebnis` (ok/fehler/cache) | **ohne Inhalt**; Beleg fuer FA-37 |
| `ki_budget` | `monat`, `limit_rappen`, `verbraucht_rappen`, `reserviert_rappen` | ADR 0017 |
| `audit_eintrag` | siehe ADR 0015 | append-only, Hash-Kette |

Spaltenregeln: Geld `bigint` in Rappen mit Waehrung CHF implizit; Datum `date`, Zeitpunkte `timestamptz` (UTC gespeichert, Anzeige Europe/Zurich); Masse in Metern `numeric(9,3)`; Texte normalisiert fuer Vergleich in eigenen `_norm`-Spalten.

### 4.3 RLS-Policies

Fuer jede Tabelle mit `mandant_id` (Muster, handgeschrieben, ADR 0005/0010):

```sql
ALTER TABLE element ENABLE ROW LEVEL SECURITY;
ALTER TABLE element FORCE ROW LEVEL SECURITY;
CREATE POLICY mandant_isolation ON element
  USING (mandant_id = app.mandant())
  WITH CHECK (mandant_id = app.mandant());
-- app.mandant(): liest current_setting('app.mandant_id', true); leer/NULL -> RAISE EXCEPTION
```

Fremdschluessel immer mandantenrein, z.B. `FOREIGN KEY (mandant_id, raum_id) REFERENCES raum (mandant_id, id)`.
Globale Tabellen (`katalog_*`): `GRANT SELECT` an `planora_app`, kein Schreibrecht. `benutzer`: eigene Policy (eigener Datensatz oder Mitglied im aktiven Mandanten). `audit_eintrag`: RLS + nur `SELECT`.

### 4.4 Herkunft (Provenance) je ausgelesenem Wert

`angabe` (ADR 0012): `ziel_typ`, `ziel_id`, `merkmal` (geschlossene Liste: `hersteller`, `typbezeichnung`, `lebensdauer_jahre`, `lebensdauer_stunden`, `betriebsstunden_pro_jahr`, `leistung_kw`, `einbaudatum`, `menge`, `raum_zuordnung`, `katalog_zuordnung`, `anlagekennzeichen`, `garantie_bis`, …), `wert jsonb` (Schema je Merkmal), `einheit`, `quelle_art` (manuell/ki/import/abgeleitet), `dokument_id`, `seite`, `zitat`, `bbox`, `konfidenz`, `konfidenz_stufe` (hoch/mittel/tief), `status` (vorgeschlagen/bestaetigt/verworfen/ersetzt), `extraktion_lauf_id`, `entschieden_von/am`.

Aufloesung des effektiven Werts (rein, deterministisch): nur `bestaetigt` → Rang nach Quelle: (1) manuell, (2) Herstellerdatenblatt (Dokumentart Datenblatt), (3) Protokoll/Liste, (4) abgeleitet (z.B. Einbaudatum = Uebergabedatum, FA-16) → bei Gleichstand juengste Entscheidung → bei Gleichstand kleinste `id`. Fuer die Lebensdauer gilt die vollstaendige Rangfolge aus Kap. 8.1 (inkl. Lebensdauer-Tabelle des Mandanten, E11). Lebensdauer-Tabelle, Preise und Ampel-Schwellen sind **Mandanten-Parameter** (Tabellen mit Audit bzw. `gueltig_ab`), keine Angaben.

### 4.5 Versionierung und Audit

- Optimistic Locking: Jede schreibende API verlangt `erwartete_version`; Abweichung → HTTP 409 mit aktuellem Stand (AD-11).
- Fachhistorie: `angabe` und `zustandsbewertung` sind nur-einfuegend (Geschichte im Modell). Andere Tabellen: Historie ueber `audit_eintrag` (alt/neu als JSON).
- Katalog: versioniert per `katalog_version`; jede `angabe` und jeder `extraktion_lauf` kennt die Katalogversion.
- Rechenregeln: `regelwerk_version` in jedem Ergebnis und Planstand.

### 4.6 Elementtyp vs. Element, Katalog-IDs, eBKP-H/ETIM

- **Katalogeintrag** (global): "was fuer ein Bauteil" → 3D-Modell, Icon, Planora-Gruppe, Standard-Lebensdauer, Ampel-Default; ETIM/eBKP-H nur ueber `klassifikation_mapping`.
- **Elementtyp** (Mandant): "welches Produkt" (Hersteller + Typ) → Zeile in der Lebensdauer-Tabelle (`mandant_lebensdauer`), Datenblatt-Dokument, Preis.
- **Element** (Mandant): "welches Exemplar wo" → Raum, Anlagekennzeichen, Menge, Einbaudatum, Zustand, Ersatzplanung, **eigene Lebensdauer** als manuelle Angabe (E11: Monoblock 1 und 2 koennen verschiedene Lebensdauern haben; ein Sammelelement mit abweichender Lebensdauer wird dafuer geteilt).
- Ist der Hersteller/Typ unbekannt, wird ein generischer Elementtyp pro Katalog-ID und Mandant verwendet (`hersteller = NULL`).
- **Klassifikation austauschbar (E12/E13):** Die Planora-Katalog-ID ist der einzige fuehrende Schluessel. ETIM und eBKP-H sind optionale Zeilen in `klassifikation_mapping`; ein weiteres System (oder ein eigenes) kommt als neuer `system`-Wert dazu, ohne Schemaaenderung. Der Investitionsplan gruppiert standardmaessig nach Planora-Gruppe; die Gruppierung nach eBKP-H ist eine Option, wenn das Mapping vorhanden ist. eBKP-H nur als Code ohne CRB-Texte (rechtliches Restrisiko E13 [?]); ETIM-Klassennamen englisch, Anzeige ueber eigene `katalog_text` [A].
- **Mehrsprachigkeit (E20):** UI-Texte in Sprachdateien de/fr/it; Stammdaten-Texte (Katalog, Wertelisten wie Dokumentart, KBOB-Codes, Rechenweg-Bausteine) in Texttabellen je Sprache; Kundendaten (Raumnamen, Notizen) werden nicht uebersetzt. Excel-Export in der Sprache des Benutzers. Fehlende Uebersetzung → Rueckfall auf Deutsch, in CI als Warnung gezaehlt.

---

## 5. KI-Pipeline Ende-zu-Ende

### 5.1 Ablauf

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser
  participant A as api
  participant S as Objektspeicher
  participant W as worker
  participant V as ClamAV
  participant D as docproc
  participant K as Bedrock (EU)
  participant P as Postgres
  B->>A: Upload beginnen (Uppy: Dateiname, Groesse)
  A->>S: CreateMultipartUpload (quarantaene/)
  A->>P: dokument(status=hochladen)
  B->>A: je Teil: Signatur nur fuer UploadPart
  B->>S: Teile hochladen (parallel, wiederaufnehmbar)
  B->>A: abschliessen (Teile + ETags)
  A->>S: CompleteMultipartUpload + HEAD (nur Server)
  A->>P: status=hochgeladen, objekt_etag + Job scan [eine Tx]
  W->>S: Datei lesen (If-Match objekt_etag), einmal streamen
  W->>V: Scan + Magic Bytes (file-type) + SHA-256 ueber dieselben Bytes
  W->>S: dieselben Bytes nach dok/
  W->>P: status=geprueft + Jobs vorschau_erzeugen, aufbereiten
  W->>D: Office → Gotenberg, Scan → OCRmyPDF: Vorschau-PDF nach abgeleitet/
  W->>D: Docling Serve (Text, Tabellen, Bounding Boxes)
  D->>S: Seitentext/Tabellen JSON
  W->>P: dokument_seite, such_abschnitt (+ Embeddings), status=aufbereitet
  alt KI fuer Mandant aktiv und Budget reserviert
    W->>K: Haiku: Dokumentart + relevante Seiten
    W->>K: Sonnet: Extraktion je Seitenblock (Tool-Schema mit Katalog-Enum)
    W->>P: ki_aufruf, Rohantwort (S3), Validierung
    W->>P: angabe/element status=vorgeschlagen, Pruefliste
  else KI aus
    W->>P: status=manuell_erfassen (Excel-Zuordnung / manuell)
  end
  B->>A: Pruefansicht: bestaetigen/korrigieren/verwerfen (mit Version)
  A->>P: angabe status=bestaetigt, element_effektiv neu [eine Tx]
```

### 5.2 Zustandsautomat Dokument

`hochladen → geprueft | abgelehnt → aufbereitet | fehlgeschlagen → klassifiziert → extrahiert → zur_pruefung → abgeschlossen`; Nebenzustaende `pausiert_budget`, `pausiert_ki_aus`, `nicht_auswertbar` (DWG/IFC/DOC, FA-08). Jeder Job prueft den Ausgangszustand; ist der Folgezustand schon erreicht, endet er ohne Wirkung (Idempotenz).

### 5.3 Stufen

| Stufe | Werkzeug | Ausgabe | KI? |
|---|---|---|---|
| Scan | ClamAV, Magic Bytes, SHA-256 | sauber/abgelehnt | nein |
| Vorschau | Gotenberg (Office), OCRmyPDF (Scan), sharp (Miniaturen) – ADR 0022 | Vorschau-PDF in `abgeleitet/` | nein |
| Aufbereitung | Excel: exceljs im Worker; PDF-Vektor: pdfjs-dist + Docling Serve; Scan: OCRmyPDF → Docling Serve | `dokument_seite` (Text, Bloecke mit Koordinaten, Tabellen), `such_abschnitt` (ADR 0023) | nein |
| Klassifikation | Haiku 5.5, nur Text der ersten Seiten + Seitentitel [A] | Dokumentart, KBOB-Fachbereich und Dokumenttypcode (E21), Sprache (de/fr/it/en), Gebaeude/Geschoss-Hinweis, relevante Seitenbereiche | ja (sonst Benutzer waehlt) |
| Spaltenzuordnung Excel | Haiku 5.5: Kopfzeile + 20 Beispielzeilen [A] → Zuordnungsvorschlag | Zuordnung, vom Benutzer bestaetigt; danach deterministischer Import | ja (sonst manuell, FA-38) |
| Extraktion | Sonnet 5.5, Seitenbloecke zu 20 Seiten [A], Bild + Text | strukturierte Vorschlaege mit Seite + Zitat | ja |
| Grundriss | Kap. 6 | Raum-Vorschlaege | ja (sonst manuell) |
| Validierung | deterministisch (5.6) | Konfidenzstufe, Pruefliste | nein |
| Pruefung | Mensch | bestaetigt/verworfen | nein |

### 5.4 Idempotenz und Retries

- Job-Schluessel: `<stufe>:<dokument_id>:<seitenblock>:<pipeline_version>`. Doppelter Job = kein zweiter Lauf.
- KI-Antwort-Cache (`ki_cache`): Schluessel SHA-256(Seiteninhalt + Prompt-Version + Modell-ID + Katalog-Version) → kein Doppelbezahlen bei Retry nach DB-Fehler.
- Vorschlaege tragen `extraktion_lauf_id`; ein wiederholter Lauf ersetzt die **noch unentschiedenen** Vorschlaege desselben Laufs, nie bestaetigte Angaben.
- Dasselbe Dokument (gleicher SHA-256 im Mandanten) wird nicht neu extrahiert, ausser bei neuer Pipeline-/Prompt-Version auf Anforderung.
- Abgleich mit Bestand: Element mit gleichem `anlagekennzeichen` im gleichen Gebaeude → Vorschlag als neue Angabe am bestehenden Element, nicht als neues Element.

| Fehlerklasse | Retry | Grenze [A] |
|---|---|---|
| Bedrock Drosselung/5xx/Timeout | exponentiell 5 s … 10 min, Jitter | 6 Versuche, danach `fehlgeschlagen` + Alarm |
| Bedrock 4xx (Validierung, Groesse) | kein Retry; Seitenblock halbieren, einmal erneut | 1 |
| Antwort verletzt Schema | 1 Retry mit Fehlermeldung im Prompt | 1, danach Pruefliste "KI-Antwort ungueltig" |
| docproc Absturz/Timeout | 2 Retries, danach Seitenblock einzeln | 3 |
| DB-Konflikt (Version) | sofort, 3 Versuche | 3 |
| Schutzschalter offen | Job wartet (verschoben), zaehlt nicht als Versuch | – |

### 5.5 Strukturierte Ausgabe nur gegen Katalog-IDs

- Aufruf mit Tool-Definition/JSON-Schema; Feld `katalog_id` als **Enum der gueltigen IDs der aktuellen Katalogversion plus `null`** (null = unbekannt → Pruefliste). Freitext-Typen sind im Schema nicht vorgesehen (E8, FA-14).
- Jedes Feld eines Vorschlags hat `{ wert, einheit, seite, zitat, konfidenz }`. Ohne `seite` und `zitat` ist ein Wert ungueltig.
- Dokumente in DE/FR/IT/EN werden mit demselben Prompt verarbeitet (E20); Zitate bleiben in Originalsprache, Werte werden normalisiert (Dezimal- und Tausendertrennzeichen, Einheiten). OCR-Sprachen deu+fra+ita+eng [A].
- Prompt enthaelt: Katalogliste (ID, Name, Kurzbeschreibung), Merkmalsliste mit Einheiten, Regeln ("nicht raten; null wenn nicht im Dokument"). Prompt-Caching fuer den statischen Teil [A: Verfuegbarkeit unter Bedrock in S5 pruefen].

### 5.6 Validierung und Konfidenzschwellen

Deterministische Pruefungen nach jeder KI-Antwort:
1. Schema (Zod) und Katalog-ID gueltig in der verwendeten Katalogversion.
2. **Grounding:** `zitat` kommt im Seitentext (Docling/OCR) der angegebenen Seite vor (normalisiert: Leerraum, Bindestriche, Gross/Klein); unscharfe Uebereinstimmung ≥ 0,9 [A] zaehlt als "unscharf".
3. **Wert im Zitat:** der Zahlenwert steht im Zitat (z.B. "50'000 h" → 50000, Einheit h).
4. **Plausibilitaet je Merkmal** [A]: Lebensdauer 1–100 Jahre; Stunden 1'000–200'000; Einbaudatum zwischen 1950 und Uebergabedatum + 1 Jahr; Menge 1–10'000; Leistung > 0.
5. **Querpruefung:** derselbe Wert aus zwei Dokumenten → Bestaetigung; Widerspruch → beide "mittel" mit Hinweis.

Stufen [A, kalibriert am Golden Set so, dass Praezision der Stufe "hoch" ≥ 98 %]:

| Stufe | Bedingung | UI |
|---|---|---|
| hoch | Pruefungen 1–4 bestanden, Zitat exakt, Modellkonfidenz ≥ 0,90 | sammelbestaetigbar (FA-18: 100 in ≤ 3 Klicks) |
| mittel | 1, 3, 4 bestanden; Zitat unscharf oder Modellkonfidenz 0,60–0,90 oder Widerspruch | einzeln bestaetigen |
| tief / Pruefliste | Katalog `null`, Zitat nicht gefunden, Plausibilitaet verletzt, Modellkonfidenz < 0,60 | Pruefliste, nie automatisch |

Bei Scans ohne verlaesslichen OCR-Text ist "hoch" ausgeschlossen. Nichts wird je automatisch bestaetigt.

**Prompt Injection (E31, AD-6):** Dokumentinhalte sind nicht vertrauenswuerdig. Der Prompt grenzt Dokumenttext und -bilder als Daten ab und weist an, darin enthaltene Anweisungen zu ignorieren; das Modell hat keine Tools mit Nebenwirkung (nur das Extraktions-Schema). Das Golden Set enthaelt praeparierte Dokumente mit eingebetteten Anweisungen; erwartet wird keine Wirkung ausser Stufe "tief"/Pruefliste. Gilt auch fuer Reranking/Antworten der Suche (ADR 0023).

### 5.7 Kostenbremse, Abschaltung, Datenfluss

- Kostenbremse: ADR 0017 (Schaetzung, Reservierung, Monats-/Tages-/Dokumentgrenzen, Cache, Schutzschalter).
- Seitenvorauswahl: Haiku waehlt relevante Seiten (Datenblatt-Seiten mit Kennwerten, Listen), Sonnet sieht nur diese → Kosten und Laufzeit bei grossen Uploads begrenzt.
- **KI pro Mandant abschaltbar (FA-37):** Pruefung an drei Stellen: beim Erzeugen des Jobs, im Job-Handler und im Provider-Adapter (letzte Schranke). Jeder Aufruf steht in `ki_aufruf`; Abnahmetest: Mandant mit KI aus, Upload von 10 Dokumenten → 0 Zeilen in `ki_aufruf`, 0 Netzaufrufe am Fake-Provider.
- Protokolle mit Unterschriften: nur Textebene an die KI, keine Seitenbilder, wenn Text vorhanden [A, Datenminimierung].

### 5.8 Prompt-/Modellversionierung und Golden Set

- Prompts liegen im Repo unter `src/module/extraktion/prompts/<prompt_id>/<semver>.md` mit Schema-Datei; nie zur Laufzeit editierbar. Modell-IDs und Profil-ARN in Konfiguration. `pipeline_version` = Kombination aus Prompt-Versionen, Validator-Version, docproc-Version.
- **Golden Set:** (a) synthetische und oeffentliche Dokumente im Repo (`eval/`), (b) Pilotdokumente mit schriftlicher Zustimmung in einem separaten, zugriffsbeschraenkten Bucket in CH, nie im Repo. **Stand E18:** Der Pilotkunde liefert vorerst nur Architekturunterlagen (Grundrisse); fuer TGA-Listen und Datenblaetter stuetzt sich das Golden Set bis auf Weiteres auf oeffentlich verfuegbare Hersteller-Datenblaetter und synthetische Anlagelisten (DE/FR/IT) [A]. Die FA-13-Schwellen gelten erst als bewiesen, wenn echte TGA-Dokumente gemessen sind. Je Dokument: erwartete Raeume (Rechtecke), Elemente, Kennwerte mit Seite.
- **Messgroessen:** Feld-Trefferquote je Merkmal und Dokumentart (FA-13: Excel ≥ 90 %, Scan ≥ 70 %), Raum-Recall und IoU (FA-12: ≥ 80 % Raeume), Praezision der Stufe "hoch", Rate "falscher Wert bestand Validierung" (Ziel ≤ 1 % [A]), Kosten pro Seite, Laufzeit.
- **Regel:** Jede Aenderung an Prompt, Modell-ID, Katalog oder Validator laeuft durch das Golden Set (CI-Job, Bedrock-Staging-Konto). Release nur, wenn keine Kennzahl um mehr als 2 Prozentpunkte schlechter wird [A] und die FA-Schwellen halten. Ergebnisse versioniert unter `eval/ergebnisse/`.

---

## 6. Grundriss → Raum-Rechtecke

Hybrider Ablauf (ADR 0014):

```mermaid
flowchart LR
  pdf["Grundrissseite"] --> typ{"Vektor-PDF?"}
  typ -- ja --> vek["pdfjs: Textstuecke + Koordinaten<br/>Raumstempel: Nummer, Name, m²<br/>Liniensegmente"]
  typ -- nein --> img["Rasterbild, Kacheln"]
  vek --> llm["Claude Vision (Sonnet 5.5)<br/>Rechtecke normiert 0..1<br/>+ Stempel als Kontext"]
  img --> llm
  llm --> geo["Geometrie-Pruefung<br/>Seite, Ueberlappung, Stempel im Rechteck,<br/>Flaeche vs. Stempel, Einrasten"]
  geo --> mass["Massstab: Median Stempel-m²/Rechteck<br/>oder 2-Klick-Kalibrierung"]
  mass --> ui["Korrektur-UI (Pflicht)"]
  man["Manuell zeichnen<br/>(immer verfuegbar)"] --> ui
  ui --> ok["Geschoss bestaetigen → raum"]
```

- **Koordinaten:** KI liefert normierte Seitenkoordinaten; nach Massstab werden Raeume in Metern im Geschoss-System gespeichert (Ursprung links unten der Seite [A]). Geschosse eines Gebaeudes werden ueber einen gemeinsamen Referenzpunkt ausgerichtet (Benutzer setzt ihn einmal pro Geschoss, Default: Seitenursprung [A]).
- **Pruefregeln [A]:** Ueberlappung zweier Rechtecke > 10 % → beide "mittel"; Flaechenabweichung zum Stempel > 15 % → "mittel"; Raum ohne Stempel → "tief"; Einrasten an parallele Linie innerhalb 1 % der Seitenbreite.
- **Nicht-Rechtecke** (L-Raeume, Korridore): Benutzer zerlegt in mehrere Rechtecke mit gleicher Raumnummer (Raum hat 1..n Rechtecke [A]) oder nimmt das umschliessende Rechteck. E3 bleibt gewahrt.
- **Korrektur-UI** (Bausteine E31: PDF.js-Unterlage, react-konva, Zustand + zundo, flatbush; ADR 0014): Unterlage (Grundrissbild), Rechtecke ziehen/verschieben/skalieren mit Einrasten, Tastatur fuer Feinschritte, Mehrfachauswahl, Liste der Raeume neben dem Plan, Farbcode nach Konfidenz, "Rueckgaengig". Kennzahl: Korrekturzeit pro Geschoss (Spike S1).
- **Fallback manuell:** gleiche UI ohne Vorschlaege; ausserdem Raumliste per Excel (Nummer, Name, Flaeche) → Rechtecke werden als Raster vorplatziert und vom Benutzer verschoben [A].
- Elemente ohne bekannten Raum haengen am Geschoss (`raum_id NULL`, `geschoss_id` gesetzt) und erscheinen in 3D in einer Geschoss-Sammelzone.

---

## 7. 3D-Pipeline

### 7.1 Katalog → GLB-Bibliothek → Szene

1. **Modellierung** in Blender: Ursprung am Boden, Meter, keine Texturen, Ton-Look; je Katalog-ID ein Modell (30–50 [A, E8]).
2. **Optimierung:** `gltf-transform optimize --compress meshopt` (+ `dedup`, `weld`, `simplify`) [F, Q53a-Tech]; LOD1 per `simplify` auf ca. 10 % [A].
3. **Pruefung in CI** (Budgets unten), Hash in `katalog_eintrag.glb_sha256`; Auslieferung als unveraenderliche, gehashte statische Dateien (lange Cache-Dauer).
4. **Szene-Endpunkt** (`szene`-Modul): pro Gebaeude kompakte Struktur: Geschosse (Hoehe, Reihenfolge), Raum-Rechtecke, Elemente (id, katalog_id, raum, Position oder Auto-Layout-Index, Ampel, Menge), Cluster-Vorberechnung; `datenstand`-Hash fuer HTTP-Caching.
5. **Client:** pro Geschoss eine zusammengefuehrte Raum-Geometrie; Elemente als `BatchedMesh` (ein Material, Farbe pro Instanz); Pins als instanzierte Sprites; Explosionsansicht = Y-Offset pro Geschossgruppe; orthografische isometrische Kamera; AO per Postprocessing nur bei ausreichender Leistung.

### 7.2 Auto-Layout, Clustering, LOD

- **Auto-Layout:** Elemente eines Raums werden nach (katalog_id, element_id) sortiert und in einem Raster mit Randabstand 0,3 m [A] im Rechteck verteilt; Sammelelemente (`menge > 1`) als ein Modell mit Zaehler-Badge. Deterministisch: gleiche Daten → gleiche Positionen.
- **Clustering:** Stufe 1 Geschoss (Zaehler je Ampelfarbe), Stufe 2 Raum, Stufe 3 Katalogtyp im Raum, Stufe 4 Einzelpin. Uebergang nach Zoomstufe und Bildschirmabstand < 24 px [A].
- **LOD:** LOD0 nahe, LOD1 ab Bildschirmgroesse < 40 px [A], unterhalb 8 px [A] nur Pin, kein Modell.
- **Filter (FA-36):** Sichtbarkeit pro Instanz (BatchedMesh `setVisibleAt`) statt Neuaufbau.

### 7.3 Performancebudget [A, Spike S3 beweist]

| Groesse | Budget |
|---|---|
| Zielgeraet "Standard-Laptop" | integrierte GPU Klasse Intel Iris Xe, 16 GB RAM, 1920×1080, aktueller Chrome/Edge |
| Elemente pro Gebaeude | 10'000 Ziel, 20'000 ohne Absturz (FA-34) |
| Bildrate | 60 fps median beim Drehen, p95-Frame ≤ 33 ms (≥ 30 fps) |
| Draw-Calls | ≤ 100 gesamt |
| Dreiecke gesamt sichtbar | ≤ 2 Mio. |
| GLB je Bauteil | LOD0 ≤ 5'000 Dreiecke, LOD1 ≤ 500, Datei ≤ 150 kB |
| GLB-Bibliothek gesamt | ≤ 5 MB komprimiert |
| Szene-Daten 10'000 Elemente | ≤ 1,5 MB komprimiert; erste Darstellung ≤ 3 s nach Navigation |
| Klick → Detailpanel | ≤ 100 ms (Picking ≤ 16 ms) |
| GPU-Speicher | ≤ 512 MB |

**Degradation:** Faellt die gemessene Bildrate 3 s unter 30 fps, schaltet der Client stufenweise AO, Schatten, LOD-Schwellen und Pin-Stufe herunter. Ohne WebGL2 oder bei Absturz: 2D-Grundriss- und Tabellenansicht (alle Funktionen dort verfuegbar).

---

## 8. Erneuerungs- und Investitionsrechnung

Reiner Rechenkern (ADR 0013). Eingabe: Schnappschuss, `stichtag` S (Jahr s), Horizont H (10|20), `regelwerk_version`.

### 8.1 Lebensdauer L (Jahre), Rangfolge der Quellen (E11)

| Rang | Quelle | Bedingung |
|---|---|---|
| 1 | Manuell am **Element** | Angabe `lebensdauer_*` am Element, `bestaetigt`, `quelle_art=manuell` (E11) |
| 2 | Manuell am **Elementtyp** | `mandant_lebensdauer.quelle = manuell` (Benutzer hat die Lebensdauer-Tabelle angepasst) |
| 3 | Herstellerdatenblatt am Elementtyp | Angabe `bestaetigt`, Dokumentart Datenblatt |
| 4 | Planora-Standard | `mandant_lebensdauer` mit `quelle = planora_standard@vN` (bei Anlage des Typs aus `katalog_eintrag` kopiert) |

(00-kontext "manuell > Herstellerdatenblatt > Richtwert", verfeinert durch E11.) Kopieren statt Verweisen: Eine neue Katalogversion aendert keine bestehenden Mandantenwerte still; ein Abgleich "neue Planora-Standards verfuegbar" wird dem Mandanten-Admin als Vorschlag angezeigt.

Bandbreite: Jede Stufe liefert L_min, L_mittel, L_max. Gibt eine Quelle nur einen Wert L' (z.B. Datenblatt), wird die Bandbreite proportional uebernommen: `L_min' = L' × L_min/L_mittel`, `L_max' = L' × L_max/L_mittel` aus dem Planora-Standard [A].

Stundenangabe (FA-17): `L = L_h / h_a`, mit `h_a` = Betriebsstunden pro Jahr (Element > Elementtyp > Katalog-Default), gerundet auf 0,1 Jahr half-up. Rechenweg-Text: "50'000 h ÷ 2'500 h/a = 20,0 J." Fehlt `h_a`, ist die Stundenangabe nicht verwendbar → naechster Rang, Hinweis im Rechenweg.

### 8.2 Einbaujahr E

Bestaetigte Angabe `einbaudatum` (Protokoll, manuell) → sonst Uebergabedatum des Gebaeudes, markiert "abgeleitet" (FA-16). Ohne beides **und** ohne Bewertung: Element ist "unvollstaendig", erscheint in der Liste mit Hinweis, nicht im Plan, nie stillschweigend mit 0. Mit Bewertung genuegt die Bewertung (8.3, Aequivalenzalter).

### 8.3 Zustand nach ZHAW-Methode, Ersatzjahr und Restlebensdauer (E14)

Grundlage: Zustandswert z von 1 (neu) bis 0, lineare Alterung bis 0,4, darunter progressiv, Nutzungsgrenze 0,1–0,4 je Anforderung, Bandbreite min/mittel/max, Kurve wird durch Inspektion angepasst [F, Q12-Dom]. Die exakte Kurvenform ist im Artikel nicht als Formel uebernommen; Planora legt sie wie folgt fest [A, vor Umsetzung mit Hubbuch/Paganini 2015 abgleichen, Spike S10]:

- Parameter je Element: L (aus 8.1), Nutzungsgrenze g (Typ > Mandant-Default 0,25 [A]), Knick k (Mandant, Default 0,75 [A]); `a_k = k × L`.
- **Alterungskurve** fuer Alter a:
  - `a ≤ a_k`: `z(a) = 1 − 0,6 × a / a_k` (linear bis 0,4)
  - `a_k < a ≤ L`: `z(a) = 0,4 − (0,4 − g) × ((a − a_k)/(L − a_k))²` (progressiv, erreicht g bei a = L)
- **Ohne Bewertung:** `J1 = E + rund(L)`.
- **Mit neuester Bewertung** im Jahr t mit Zustandswert z_t (Skala 1,0 … 0,0 in 0,1-Schritten, 10 Stufen plus 0 [A]): Aequivalenzalter a* = Umkehrfunktion der Kurve:
  - `z_t ≥ 0,4`: `a* = a_k × (1 − z_t) / 0,6`
  - `g < z_t < 0,4`: `a* = a_k + (L − a_k) × √((0,4 − z_t)/(0,4 − g))`
  - `z_t ≤ g`: `a* = L` (Ersatz faellig)
  - `RL_t = L − a*`, `J1 = t + rund(RL_t)`. Ein unbekanntes Einbaujahr ist damit kein Hindernis (ZHAW "Ansatz 2" [F, Q12-Dom]).
- **Bandbreite:** gleiche Rechnung mit L_min und L_max ergibt fruehestes und spaetestes Ersatzjahr; angezeigt als Spanne, der Plan rechnet mit L_mittel.
- **Restlebensdauer** am Stichtag: `RL = max(0, J1 − s)`.
- **Naechste Inspektion (Vorschlag, kein Auftrag, E10):** 5 Jahre vor `E + L_min`, bzw. 5 Jahre vor dem berechneten J1 nach einer Inspektion [F, Q12-Dom].
- `rund` = kaufmaennisch half-up auf ganze Jahre; Quadratwurzel in Dezimalarithmetik mit fester Genauigkeit (≥ 20 Stellen [A]).
- Das Zustandsmodell bleibt eine Strategie (`zustandsmodell = zhaw_v1`); eine spaetere Variante kommt als `zhaw_v2` daneben, alte Planstaende rechnen mit ihrer Version weiter.
- **Geplantes Jahr (FA-28):** `ersatz_planung.geplantes_jahr` ersetzt J1 nur im Plan; beide Jahre werden angezeigt.

### 8.4 Ersatzzyklen im Horizont (FA-27)

Folgejahre `J(n+1) = J(n) + rund(L_neu)` mit `L_neu` = L_mittel des Elementtyps aus der Lebensdauer-Tabelle (Rang 2 oder 4; Ersatzprodukt unbekannt) [A]; ohne Zustand. Ereignisse mit `s ≤ J ≤ s + H − 1` landen im Plan; ueberfaellige (J1 < s) werden im Jahr s ausgewiesen und als "ueberfaellig seit J1" markiert.

### 8.5 Kosten und Teuerung (FA-24, FA-25, E15, E16)

- **Preis P** (Rappen) mit Preisjahr p und Bezugsgroesse aus der Preisdatenbank (Modul `preise`), Rangfolge: Mandantenpreis am Elementtyp > Mandantenpreis an der Katalog-ID > Herstellerpreis (global, Abgleich Hersteller + Artikel/Typ) > Planora-Standardpreis je Katalog-ID [A] > keiner. Je Stufe gilt der Eintrag mit dem juengsten `gueltig_ab ≤ Stichtag`.
- **Automatische Aktualisierung (E15):** Eine Preisquelle schreibt nur **neue** `preis_eintrag`-Zeilen mit `gueltig_ab`; nichts wird ueberschrieben. Laufende Ansichten zeigen damit neue Preise ab Gueltigkeit, eingefrorene Planstaende behalten ihre Preise. V1: manuelle Pflege und Excel/CSV-Import; Feed-Adapter (z.B. BMEcat, Datanorm, Grosshandel [A]) folgen hinter dem Port `PreisQuelle`, sobald Quellen und Lizenzen geklaert sind (Spike S12, Risiko R11). Demontage/Nebenkosten als eigener Zuschlag pro Katalog-ID [A].
- **Ereigniskosten:** `K(J) = rund_rappen( Menge × P × (1 + i)^(J − p) )`, i = fester Teuerungssatz des Mandanten, anpassbar (E16; Default 1,0 %/a [A]). Exponent mit Dezimalarithmetik (≥ 20 signifikante Stellen [A]), Rundung half-up **einmal pro Ereignis**.
- Fehlender Preis → Ereignis mit `kosten = null`, Status "Kosten fehlen"; Summen zeigen "davon ohne Kosten: n Elemente", nie 0 CHF (FA-24).

### 8.6 Ampel (FA-23, E17)

N = Schwelle **pro Bauteiltyp**: `mandant_ampel(katalog_id)` > `katalog_eintrag.ampel_gelb_jahre` > `mandant_parameter.ampel_gelb_jahre_default` (Default 3 [A]). **rot** wenn J ≤ s; **gelb** wenn s < J ≤ s + N; **gruen** sonst; **grau** wenn unvollstaendig. J = geplantes Jahr falls gesetzt, sonst J1.

### 8.7 Investitionsplan und Determinismus

- Plan = Summe der gerundeten Ereigniskosten je Jahr, gruppiert nach Gebaeude und Planora-Gruppe, wahlweise nach eBKP-H, wenn gemappt (FA-26, E13). Summen werden aus Zeilen gebildet, nie getrennt gerechnet.
- Determinismus: keine Zeitfunktion, keine Zufallszahl, stabile Sortierung (Gebaeude, Gruppe, Katalog-ID, Element-ID), kanonisches JSON fuer `eingabe_hash`. Test: Eigenschaftstest "zweimal rechnen → identische Bytes"; Planstand-Nachrechnung im CI.
- Excel-Export (FA-29) in DE/FR/IT: Werte plus Spalten fuer Rechenweg und Quelle; Summenzeilen als Excel-Formeln, deren Ergebnis im Test mit dem Kern verglichen wird.

---

## 9. Sicherheit und Datenschutz

### 9.1 Authentifizierung (ADR 0007, 0004)
Keycloak 26.8, Realm `planora`; Entra ID pro Kunde via OIDC/SAML-Brokering; lokale Konten mit erzwungener MFA (FA-05). BFF: Session serverseitig, Cookie `httpOnly; Secure; SameSite=Lax`, Leerlauf-Timeout 30 min, absolut 12 h [A]. Logout invalidiert Server-Session und Keycloak-Session.

### 9.2 Rollenmodell (Autorisierung nur in Planora-DB)

| Rolle | Rechte | Scope |
|---|---|---|
| Mandanten-Admin | alles im Mandanten: Benutzer/Rollen, KI-Schalter + Zustimmung, Parameter, Budgets, Export, Loeschauftrag | ganzer Mandant |
| Bearbeiter | Struktur, Dokumente, KI starten, Vorschlaege pruefen/bestaetigen, Kosten, Planung, Planstand einfrieren | Liegenschaften laut Mitgliedschaft |
| Bewerter [A] | lesen + Zustandsbewertung (FA-30..32) | Liegenschaften |
| Leser | lesen, Excel-Export | Liegenschaften |
| Plattform-Betrieb | **kein** Zugriff auf Fachdaten; Betriebsmetriken; Break-Glass nur mit schriftlicher Kundenfreigabe, zeitlich auf 4 h begrenzt [A], vollstaendig auditiert | – |

Pruefung je Request: Session → aktiver Mandant → Mitgliedschaft → Rolle → Liegenschaft des Zielobjekts. Unit-Tests je Recht × Rolle (Matrix-Test).

### 9.3 RLS-Durchsetzung inkl. Test
ADR 0010; CI-Pflichttests (a)–(e); zusaetzlich jaehrlicher externer Pentest mit Fokus Mandantentrennung [A, vor erstem Enterprise-Vertrag].

### 9.4 Verschluesselung
- Transport: TLS 1.2+ (bevorzugt 1.3), HSTS; intern TLS zu Managed PG und SOS.
- Ruhend: Provider-Verschluesselung von DBaaS und SOS [?, Exoscale schriftlich bestaetigen, S7]; Offsite-Dumps zusaetzlich clientseitig verschluesselt (age [A]) mit Schluessel ausserhalb Exoscale.
- Felder: keine besonders schuetzenswerten Personendaten in V1 [A] → keine Feldverschluesselung.

### 9.5 Secrets
Nie im Repository (auch nicht verschluesselt) [A, konservativ nach Arbeitsregel 7]. Ablage in einem Passwort-Tresor mit 2FA; Auslieferung beim Deploy als Umgebungsdatei (Rechte 0600) auf die VMs; spaeter Kubernetes-Secrets. AWS: eigener IAM-Benutzer nur mit `bedrock:InvokeModel` auf das konkrete Inferenzprofil, Schluessel-Rotation 90 Tage [A]. DB-Passwoerter je Rolle getrennt, Rotation 90 Tage und bei Personalwechsel [A]. Secret-Scanning in CI.

### 9.6 Audit-Log
ADR 0015: Trigger, append-only, Hash-Kette, taegliche Kettenpruefung; Fachereignisse (Login, Export, KI-Aufruf, Mandantenwechsel, Break-Glass). Abruf pro Objekt in der UI (FA-06).

### 9.7 revDSG
- Planora ist Auftragsbearbeiterin (Art. 9 DSG [F, Q22-Dom]); Standard-ADV, Subprozessorliste: Exoscale (+ Aiven [?]), AWS (Bedrock, nur bei KI an), E-Mail-Dienst [A].
- Bekanntgabe ins Ausland (Art. 16 [F, Q24-Dom]): nur KI-Pfad in EU/EWR (Anhang 1 DSV [A, juristisch bestaetigen]); im Vertrag und in der KI-Zustimmung des Mandanten benannt.
- Verzeichnis der Bearbeitungstaetigkeiten, Datenschutzerklaerung, Auskunfts-/Loeschprozess.
- Personendaten in V1: Benutzerkonten, Audit-Akteure, Namen/Unterschriften in Dokumenten [A, 01 Kap. 5.1].

### 9.8 Datenfluss zur KI
Nur wenn `mandant.ki_aktiv` + Zustimmung + globaler Schalter + Budget. Inhalt: Seitenbilder/Text ausgewaehlter Seiten, Katalogliste, Prompt. Nie: Benutzerdaten, Audit, andere Mandanten. Bedrock speichert Prompts nicht persistent, Logs in Quellregion [F, Q24-Tech]. Rohantworten speichert Planora im eigenen Objektspeicher (`abgeleitet/`), geloescht mit dem Dokument.

### 9.9 Loeschkonzept

| Objekt | Ausloeser | Ablauf | Frist |
|---|---|---|---|
| Dokument | Bearbeiter loescht | Papierkorb, danach Objekt + Seiten + Rohantworten geloescht; Angaben behalten `zitat`, Dokumentbezug "geloescht" | 30 Tage [A] |
| Element/Struktur | Bearbeiter | Status `ausgebaut`/geloescht; Historie bleibt im Audit | sofort |
| Benutzer | Admin oder Austritt | Mitgliedschaften entfernt; Personendaten pseudonymisiert, Audit behaelt Pseudonym | 30 Tage [A] |
| Mandant | Vertragsende | Export bereitgestellt → Sperre → Loeschlauf (alle Zeilen mit `mandant_id`, Prefix `m/<id>/` in allen Buckets) → Loeschprotokoll an Kunden | 30 Tage nach Vertragsende [A]; Backups laufen nach max. 90 Tagen aus [A] |
| Quarantaene | automatisch | geloescht | 7 Tage [A] |

### 9.10 Mandanten-Export
Asynchroner Job, ZIP im Objektspeicher, Download-Link 24 h gueltig [A]: `manifest.json` (Formatversion, Zeitpunkt, SHA-256 je Datei), `daten/*.jsonl` je Entitaet (inkl. Angaben mit Herkunft, Bewertungen, Audit), `dokumente/` (Originale), `excel/` (Erneuerungsliste, Investitionsplan des aktuellen Stands). Format dokumentiert und versioniert (Grundlage fuer Portabilitaet und E9).

### 9.11 Austausch mit Stratus (E22)
Modul `austausch`, Port `AustauschFormat` (je Format ein Adapter: `export(gebaeudeIds)`, `importVorschau(datei)`, `import(bestaetigteZeilen)`). V1-Adapter `stratus`: Export der Element-Ebene (Element, Katalog-Gruppe, optional eBKP-H, Einbaujahr, Lebensdauer mit Quelle, Zustandswert, Ersatzjahr, Kosten) und Import von Liegenschafts-/Gebaeude-Stammdaten. Das Stratus-Austauschformat ist nicht oeffentlich dokumentiert [?] → Spike S13; bis dahin Excel/CSV mit dokumentierter Spaltenstruktur [A]. Importe laufen immer ueber eine Vorschau mit Bestaetigung und erzeugen Angaben mit `quelle_art=import` (Herkunft bleibt erhalten).

---

## 10. Betrieb

### 10.1 Umgebungen

| Umgebung | Zweck | Daten | KI |
|---|---|---|---|
| lokal | Entwicklung (Docker Compose: PG, MinIO o.ae. als S3 [A], Keycloak, docproc, ClamAV) | synthetisch | Fake-Provider; Anthropic-API nur mit synthetischen Daten |
| CI | Tests: Unit, Adapter gegen PG-Container mit RLS, RLS-Suite, Rechenkern, E2E | synthetisch | Fake; Golden-Set-Job mit Bedrock-Staging |
| staging | Exoscale, gleiche Topologie wie prod (kleiner) | synthetisch + freigegebene Golden-Set-Dokumente | Bedrock, eigenes AWS-Konto |
| prod | Exoscale ch-dk-2 | Kundendaten | Bedrock eu-central-2, EU-Profil |

### 10.2 Deployment
- CI baut ein Image pro Commit (Tag = Git-SHA), Abhaengigkeiten exakt gepinnt (Renovate), SBOM mit **Syft**, Schwachstellen-Scan mit **Trivy**, Lizenzpruefung (license-checker/SBOM), Secret-Scan mit **Gitleaks**, statische Regeln mit **Semgrep CE**, Images signiert mit **cosign** (E31, ADR 0024). Vor dem externen Pentest laeuft ein **OWASP-ZAP**-Baseline-Scan gegen staging.
- Ablauf: `migrator` (expand) → neue `api`-Container starten, Readiness `/health/ready` (DB, S3, Keycloak) → Umschalten im Reverse Proxy → alte Container 30 s drainen → `worker` neu (laufende Jobs enden oder werden idempotent wiederholt) → spaeter Release: `migrator` (contract).
- Rueckrollen: vorheriges Image; moeglich, weil Schema N-1-kompatibel ist.
- Start: Docker Compose auf 2 VMs (ADR 0002); SKS ab ca. 5 Mandanten oder SLA-Zusage [A].

### 10.3 Migrationen ohne Downtime
Expand/contract: (1) neue Spalte/Tabelle nullable oder mit Default hinzufuegen, (2) Code schreibt beides, (3) Backfill als Job in Bloecken, (4) Code liest neu, (5) alte Spalte im naechsten Release entfernen. Verboten in einem Schritt: Umbenennen, Typaenderung mit Rewrite grosser Tabellen, `NOT NULL` ohne vorherigen Backfill. Indexe `CONCURRENTLY`. `lock_timeout` 5 s in Migrationen [A].

### 10.4 Backups, PITR, Restore-Tests

| Was | Mechanismus | Aufbewahrung |
|---|---|---|
| PostgreSQL | Exoscale Business: PITR + taegliche Backups [F, Q11/Q12-Tech] | 15 Tage [F, Q11-Tech] |
| PostgreSQL logisch | taeglicher `pg_dump`, age-verschluesselt, nach SOS ch-gva-2 | 90 Tage [A] |
| Dokumente | inhaltsadressiert, unveraenderlich; naechtliche Replikation nach ch-gva-2 | wie Original + 30 Tage nach Loeschung [A] |
| Keycloak | eigene Datenbank im selben Managed-PG-Dienst [A] → gleiche Sicherung | wie PG |
| Konfiguration | Repo (ohne Secrets) + Tresor | – |

**Restore-Tests:** monatlich automatisch: PITR-Klon auf Zeitpunkt T → Integritaetspruefung (Zeilenzahlen je Mandant, Audit-Hash-Kette, Stichprobe 100 Dokument-Hashes im Objektspeicher, Planstand-Nachrechnung) → Bericht. Quartalsweise: vollstaendige Wiederherstellung in ch-gva-2 aus Offsite-Daten mit Zeitmessung gegen RTO [A].

### 10.5 RPO/RTO [A]

| Szenario | RPO | RTO |
|---|---|---|
| Fehlbedienung/Datenkorruption (DB) | ≤ 5 min (PITR) | ≤ 4 h |
| Ausfall DB-Knoten | 0 (HA-Replikat) | ≤ 15 min (Failover Exoscale) |
| Verlust Zone ch-dk-2 | DB ≤ 24 h (Dump), Dokumente ≤ 24 h | ≤ 24 h |
| Ausfall App-VM | 0 | ≤ 1 h (neue VM aus Image) |
| Ausfall Bedrock | 0 | KI-Funktionen warten; Rest unberuehrt |

### 10.6 Monitoring
OpenTelemetry (Traces, Metriken) und strukturierte Logs (JSON, mit `korrelations_id`, `mandant_id`, **ohne** Dokumentinhalte/Prompts) → Collector → Prometheus/Loki/Grafana auf VM 2 [A]; Fehlertracking mit **GlitchTip** (Sentry-SDKs, selbst gehostet in CH); externer Uptime-Check mit **Uptime Kuma** auf eigener kleiner VM ausserhalb ch-dk-2; **Healthchecks** als Dead-Man's-Switch fuer Backup-Dump, Replikation und Restore-Test (E31). Alarme: Fehlerrate > 1 % 5 min, API p95 > 1 s, Job-Alter > 30 min, fehlgeschlagene Jobs, KI-Tageskosten > 80 % Grenze, Schutzschalter offen, Bruch Audit-Kette, Backup aelter als 26 h, Restore-Test fehlgeschlagen, Zertifikat < 14 Tage, Disk > 80 %, Bedrock-Profil mit Region ausserhalb EU/EWR/CH. Log-Aufbewahrung 90 Tage [A].

### 10.7 On-Premise-Variante
Gleiche Images; Lieferung als Compose-Bundle (spaeter Helm). Voraussetzungen beim Kunden: PostgreSQL ≥ 16 [A], S3-kompatibler Speicher, OIDC-IdP (eigenes Keycloak mitgeliefert oder Kunden-IdP direkt), Container-Laufzeit. KI: aus (Default) oder Kunden-eigenes Bedrock-Konto via Konfiguration. Keine Telemetrie an Planora ohne Zustimmung. Updates als signierte Images mit Migrationen; Support-Matrix N und N-1.

---

## 11. Fehlerfaelle und Robustheit

| # | Szenario | Erkennung | Reaktion |
|---|---|---|---|
| 1 | KI liefert Unsinn (falsche Werte, erfundene Typen) | Schema, Katalog-Enum, Grounding (Zitat nicht im Text), Plausibilitaet | Vorschlag "tief" → Pruefliste; nie automatisch bestaetigt; Rate im Monitoring, Golden-Set-Lauf bei Anstieg |
| 2 | KI halluziniert plausiblen Wert mit echtem Zitat aus anderem Kontext | Querpruefung mit zweiter Quelle; Wert muss im Zitat stehen | Stufe "mittel"; Mensch bestaetigt mit Sprung auf Seite (FA-11) |
| 3 | Bedrock nicht erreichbar / gedrosselt | Fehlerquote, Schutzschalter | Jobs pausieren, UI-Hinweis "KI verzoegert"; alle anderen Funktionen laufen; Retry-Plan 5.4 |
| 4 | Bedrock-Profil routet ploetzlich in Nicht-EU-Region | monatliche Profilpruefung | Alarm, globaler KI-Schalter aus bis Klaerung |
| 5 | Modell wird abgekuendigt / Verhalten aendert sich | Anbieter-Ankuendigung, Golden-Set-Abweichung | Modell-ID per Konfiguration wechseln nach Golden-Set-Freigabe |
| 6 | Falsche Mandanten-ID (Programmfehler) | RLS-Fehler (`app.mandant()` wirft), FK-Verletzung bei Querreferenz | Request bricht ab (500, Alarm), keine Daten geschrieben/gelesen; Incident-Prozess |
| 7 | Kontext-Leck ueber Connection-Pool | Pool-Leak-Test in CI; `SET LOCAL` nur im Wrapper; Lint | strukturell ausgeschlossen; Test blockiert Merge |
| 8 | Kaputtes/verschluesseltes PDF | Parser-Fehler in Aufbereitung | Status `fehlgeschlagen` mit Grund pro Datei (FA-07); Original bleibt; manuelle Erfassung moeglich |
| 9 | Virus/Makro | ClamAV, Magic Bytes | `abgelehnt`, Quarantaene 7 Tage, Meldung an Uploader und Admin |
| 10 | 2'000-Seiten-Upload | Seitenzahl nach Aufbereitung, Kostenschaetzung | Aufbereitung in Bloecken; KI nur fuer vorausgewaehlte Seiten; > 600 Seiten oder > CHF 50 → Freigabe durch Admin (ADR 0017) |
| 11 | 1 GB / 50 Dateien gleichzeitig | Upload-Vorgang | direkte S3-Uploads parallel, Status je Datei, Wiederaufnahme einzelner Dateien |
| 12 | Gleichzeitige Bearbeitung desselben Objekts | `version`-Vergleich | 409 mit aktuellem Stand; UI zeigt Unterschied, Benutzer entscheidet; Sammelbestaetigung meldet Konflikte je Eintrag |
| 13 | Doppelte Verarbeitung (Job zweimal, Retry nach Absturz) | Job-Schluessel, Zustandsautomat, KI-Cache | zweiter Lauf ohne Wirkung, keine Doppelkosten |
| 14 | Worker stirbt mitten im Job | pg-boss Ablaufzeit | Job wird neu zugestellt, idempotent |
| 15 | Budget erschoepft | Reservierung scheitert | `pausiert_budget`, Admin-Meldung, Freigabe in UI |
| 16 | Excel mit unerwarteter Struktur | Spaltenzuordnung, Pflichtspalten | Benutzer ordnet zu; nicht zuordenbare Zeilen in Pruefliste (FA-38) |
| 17 | Grundriss nicht erkennbar | 0 Vorschlaege / alle "tief" | manueller Zeichenmodus, Hinweis |
| 18 | Element ohne Einbaudatum / Kosten / Lebensdauer | Rechenkern | "abgeleitet" bzw. "Kosten fehlen" bzw. Planora-Standard aus der Lebensdauer-Tabelle; nie stillschweigend 0 |
| 19 | 3D zu langsam / kein WebGL | Bildratenmessung, Feature-Erkennung | stufenweise Degradation, 2D/Tabelle |
| 20 | DB-Failover waehrend Schreibvorgang | Verbindungsfehler | Transaktion zurueckgerollt, Client-Retry bei idempotenten Aufrufen (Idempotenz-Schluessel im Header fuer POST [A]) |
| 21 | Migration schlaegt fehl | migrator-Exit-Code | Deploy stoppt vor App-Wechsel; Migration ist transaktional; kein Rollout |
| 22 | Restore-Test schlaegt fehl | monatlicher Bericht | Alarm, Behebung vor naechstem Release |
| 23 | Audit-Kette gebrochen | taegliche Pruefung | Alarm, Untersuchung (Hinweis auf Manipulation mit Owner-Rechten) |
| 24 | Keycloak down | Health-Check | keine neuen Logins; bestehende Sessions laufen bis Ablauf weiter (BFF) |
| 25 | Kunden-IdP (Entra) falsch konfiguriert | Login-Fehler je Mandant | lokales Notfall-Admin-Konto pro Mandant mit MFA [A] |

---

## 12. Architektur-Entscheidungsprotokolle (ADRs)

Alle unter `docs/architektur/adr/`, Status "vorgeschlagen":

| Nr | Datei | Kurz |
|---|---|---|
| 0001 | `0001-modularer-monolith.md` | Modularer Monolith, hexagonale Module, Prozessrollen |
| 0002 | `0002-hosting-exoscale.md` | Exoscale Zuerich + Genf |
| 0003 | `0003-ki-zugang-bedrock-eu.md` | Bedrock EU-Profil — **Abweichung vom PO-Entscheid (teilweise)** |
| 0004 | `0004-framework-vite-fastify-bff.md` | Vite-SPA + Fastify-BFF |
| 0005 | `0005-orm-drizzle-sql-migrationen.md` | Drizzle + handgeschriebenes Sicherheits-SQL |
| 0006 | `0006-queue-pg-boss.md` | pg-boss, transaktionale Jobs |
| 0007 | `0007-auth-keycloak-authz-in-app.md` | Keycloak AuthN, AuthZ in App |
| 0008 | `0008-3d-r3f-batchedmesh.md` | 3D BatchedMesh, Sprite-Pins, Auto-Layout |
| 0009 | `0009-dokumentverarbeitung-docproc-sidecar.md` | Python-Sidecar — **Abweichung vom PO-Entscheid (gering)** |
| 0010 | `0010-mandantentrennung-rls.md` | RLS + zusammengesetzte FKs |
| 0011 | `0011-bauteil-katalog.md` | Globaler versionierter Katalog |
| 0012 | `0012-herkunftsmodell-angabe.md` | Angabe-Modell (Provenance) |
| 0013 | `0013-deterministische-erneuerungsrechnung.md` | Reiner Rechenkern, Planstand |
| 0014 | `0014-grundriss-hybrid.md` | Grundriss hybrid + manuell |
| 0015 | `0015-audit-log-trigger.md` | Audit per Trigger, Hash-Kette |
| 0016 | `0016-upload-quarantaene-virenscan.md` | Quarantaene + ClamAV |
| 0017 | `0017-ki-kostenbremse.md` | Budget, Cache, Schutzschalter |
| 0018 | `0018-preisdatenbank.md` | Preisdatenbank pro Typ mit Quellen-Port (E15) |
| 0019 | `0019-mehrsprachigkeit.md` | DE/FR/IT in UI und Stammdaten (E20) |
| 0020 | `0020-austausch-stratus.md` | Austausch-Port, Stratus-Adapter (E22) |
| 0021 | `0021-zustandsmodell-zhaw.md` | ZHAW-Zustandsmodell und Lebensdauer-Tabelle (E11, E14) |
| 0022 | `0022-dokument-viewer.md` | Vorschau-PDF, PDF.js, Markierung per Docling-Box (E23, E31) — **akzeptiert** |
| 0023 | `0023-suche-postgres-hybrid.md` | Volltext + pgvector, RRF (E26, E31) — **akzeptiert** |
| 0024 | `0024-pflicht-bausteine-und-lizenzen.md` | Pflicht-Bausteine und Lizenzregeln (E28, E31) — **akzeptiert** |

---

## 13. Risiken und zu beweisende Annahmen

### 13.1 Top-Risiken (10 + 3 aus den PO-Antworten)

| # | Risiko | Auswirkung | Gegenmassnahme |
|---|---|---|---|
| R1 | Grundriss-Erkennung zu ungenau (kein Benchmark [F, Q34–36-Tech]) | Produktversprechen "minimaler Aufwand" verfehlt | Spike S1 frueh; manueller Modus gleichwertig; Spezialmodell als V2-Option |
| R2 | Kennwert-Extraktion liefert plausible Falschwerte | falsche Investitionsplaene, Vertrauensverlust | nur bestaetigte Werte rechnen; Grounding; Golden Set; Herkunft sichtbar |
| R3 | Kunden akzeptieren EU-Verarbeitung nicht | KI ungenutzt, Mehraufwand Kunde | opt-in, starker manueller/Excel-Pfad; V2: lokales Modell in CH / On-Prem |
| R4 | Mandantenleck | existenzbedrohend | dreifache Schranke (ADR 0010), CI-Pflichttests, Pentest |
| R5 | Ein-Personen-Entwicklung und -Betrieb (Ausfall, Ueberlast) | Ausfallzeiten, Wissensverlust | verwaltete Dienste, Compose statt K8s, Runbooks, externer Review, ADRs |
| R6 | Planora-Standard-Lebensdauern ohne CRB-Lizenz (E11) zu wenig fundiert; eBKP-H-Codes mit Restrisiko (E13) | Vertrauen in Ersatzjahre; Rechtsrisiko | Standardtabelle vom Chef mit Referenzquelle als Text, Mandant passt pro Typ/Element an; eBKP-H nur als optionales Mapping ohne CRB-Texte, abschaltbar |
| R7 | Drizzle vor 1.0 bricht | Umbauaufwand | exakt pinnen, Sicherheits-SQL getrennt, Abfragen SQL-nah |
| R8 | 3D-Performance auf schwachen Laptops | schlechter Eindruck in Demos | Budgets, Spike S3, Degradation, 2D-Fallback |
| R9 | Exoscale/Aiven: Control Plane ausserhalb CH, Verschluesselung unklar [?] | Security-Fragebogen nicht beantwortbar | schriftliche Klaerung (S7); AWS Zuerich als Plan B dank Standard-Schnittstellen |
| R10 | KI-Kosten oder Bedrock-Quoten ueberschreiten Erwartung | Kosten, lange Laufzeiten | Kostenbremse, Seitenvorauswahl, Cache, Batch; Messung S5/S6 |
| R11 | Automatische Preisaktualisierung (E15) nicht machbar: keine zugaenglichen Herstellerpreis-Feeds, Lizenzen, Zuordnung Artikel → Typ unsicher | Preisdatenbank veraltet, Plan ungenau | V1 manuell + Import; Port `PreisQuelle`; Spike S12; Preisalter im Plan sichtbar ("Preis von 2026") |
| R12 | Kein echtes TGA-Testmaterial (E18) | FA-13-Schwellen unbewiesen bis Pilot liefert | oeffentliche Datenblaetter + synthetische Listen; Abnahme FA-13 erst mit echten Dokumenten; beim Pilotkunden aktiv TGA-Unterlagen anfordern |
| R13 | Stratus-Format unbekannt (E22) | Austausch verzoegert | Adapter-Port, Excel/CSV-Zwischenformat, Kontakt Basler & Hofmann (S13) |

### 13.2 Annahmen, die in Welle 3 (`spikes/`) bewiesen werden muessen

| Spike | Annahme | Messbares Erfolgskriterium |
|---|---|---|
| S1 Grundriss | Hybrid erkennt Raeume brauchbar | 10 echte Grundrisse (5 Vektor, 5 Scan): Raum-Recall ≥ 80 % bei Vektor (FA-12), Median-IoU ≥ 0,70 [A]; Korrekturzeit ≤ 5 min pro Geschoss mit 30 Raeumen [A] |
| S2 Extraktion | Claude + Validator liefert verlaessliche Vorschlaege | 20–30 oeffentliche Hersteller-Datenblaetter + synthetische Listen in DE/FR/IT (E18, E20): Feld-Trefferquote Excel ≥ 90 %, Scan-PDF ≥ 70 % (FA-13); Praezision Stufe "hoch" ≥ 98 %; falsche Werte, die die Validierung bestehen, ≤ 1 % [A] |
| S3 3D | BatchedMesh + Sprite-Pins halten Budget | 20'000 Dummy-Elemente, 10 Geschosse, Laptop mit Iris-Xe-Klasse: 60 fps median, p95-Frame ≤ 33 ms, erste Darstellung ≤ 3 s, Picking ≤ 16 ms (Kap. 7.3) |
| S4 RLS | Mandantentrennung haelt unter Last | Pool-Leak-Test: 2 Mandanten, 10'000 parallele Requests, Pool 10 → 0 Fremdzeilen; fehlender Kontext → Fehler; `planora_app` ohne `BYPASSRLS` auf Exoscale; Audit-Trigger mit Hash-Kette: Sammelbestaetigung 100 Angaben ≤ 2 s [A] |
| S5 Bedrock EU | Modelle und Profil verfuegbar | Sonnet 5.5 und Haiku 5.5 per EU-Profil aus eu-central-2 aufrufbar; `get-inference-profile` listet nur EU/EWR/CH-Regionen; Tool-Schema mit 50er-Enum funktioniert; 500 Seiten in ≤ 30 min innerhalb der Kontingente [A]; Prompt-Caching/Batch verfuegbar ja/nein dokumentiert |
| S6 KI-Kosten | Kosten wie in 02 Kap. 2.4 | 500-Seiten-Gebaeude ≤ CHF 20 mit Sonnet 5.5 inkl. EU-Zuschlag (+10 % [F, Q23-Tech]); Abweichung Schaetzung vs. Ist ≤ 25 % [A] |
| S7 Exoscale | Betriebsannahmen halten | schriftliche Antworten: PG-Version ≥ 16 [A], Aiven-Control-Plane-Standort, Verschluesselung at rest; PITR-Restore einer 10-GB-DB ≤ 1 h; RPO ≤ 5 min nachgewiesen |
| S8 docproc | Docling/OCRmyPDF skaliert | 2'000-Seiten-PDF ohne Absturz mit ≤ 4 GB RAM; ≥ 1 Seite/s auf 4 vCPU fuer Vektor-PDF, ≥ 0,2 Seiten/s fuer Scans [A] |
| S9 Keycloak | SSO mit mehreren Kunden-IdPs | 2 Entra-Test-Tenants + 1 lokales Konto mit MFA im selben Realm, Zuordnung per E-Mail-Domain; Login ≤ 5 s; BFF-Session-Ablauf funktioniert |
| S10 Rechenkern | Determinismus und ZHAW-Kurve | ZHAW-Kurve (8.3) gegen Originalartikel Q12-Dom und 10 Beispielrechnungen des Chefs geprueft, Abweichung Ersatzjahr ≤ 1 Jahr [A]; Eigenschaftstest 10'000 Zufalls-Schnappschuesse: 2 Laeufe auf 2 Maschinen byte-identisch; Testtabelle des Test-Architekten (FA-22) 100 % gruen; Excel-Formelsummen = Kernsummen |
| S12 Preisquellen | Herstellerpreise automatisch beziehbar (E15) | ≥ 2 Quellen (Hersteller oder CH-Grosshandel) mit maschinenlesbarem Feed (z.B. BMEcat/Datanorm [A]) und kommerziell nutzbarer Lizenz; automatische Zuordnung Artikel → Katalog-ID fuer ≥ 50 % der 30–50 Katalogtypen [A] |
| S13 Stratus | Austausch technisch moeglich (E22) | Formatbeschreibung von Basler & Hofmann erhalten; Testexport von 1'000 Elementen wird von Stratus ohne manuelle Nacharbeit importiert |
| S11 Drizzle/Migrationen | ORM + Sicherheits-SQL vertragen sich | `pgPolicy`/Hand-SQL auf Exoscale-PG angewendet; CI-Katalogpruefung erkennt absichtlich fehlende Policy; expand/contract-Migration unter Last ohne Fehler-Requests |

---

## 14. Bewusst nicht in V1

- Alles aus E10: Wartungsauftraege, Stoerungsmeldungen, Tickets, Live-Sensordaten.
- BIM-Bearbeitung, IFC-/DWG-Auslesen (nur Ablage, FA-08), Plansymbolerkennung, Reverse Engineering/Import aus Bestandssystemen (E9).
- Nicht-rechteckige Raumgeometrie (E3); echte Element-Positionen aus Plaenen.
- Teuerung per Index (z.B. BFS-Baupreisindex) statt festem Satz (E16), Szenarien-Vergleich mehrerer Plaene.
- Automatische Herstellerpreis-Feeds (E15): nur Port und Datenmodell in V1, Adapter nach Spike S12.
- Automatische Uebersetzung von Kundendaten; weitere Sprachen ausser DE/FR/IT.
- Vertragsausstattung nach FINMA-RS 2018/3 (E19: keine Finanzinstitute als Zielkunden).
- SCIM-Provisionierung, kundenverwaltete Schluessel (BYOK), Datenbank pro Mandant in SaaS, Multi-Region-Aktiv-Aktiv, Kubernetes zum Start.
- Lokales/selbst betriebenes KI-Modell, Fine-Tuning, Opus/Fable als Standardmodell.
- Native Mobile-App und Offline-Modus fuer die Begehung (Tablet-Browser genuegt, FA-30) [A].
- Oeffentliche API fuer Dritte; Austauschformate ausser Stratus und Excel/CSV.
- ISO-27001-Zertifizierung von Planora selbst (Ziel: dokumentierte Kontrollen + zertifizierter Hoster, 01 Kap. 5.2).

---

## 15. Pflicht-Bausteine je Modul (E31)

Verbindlich nach ADR 0024; Begruendung und Abgleich in `06-bausteine-open-source.md`.

| Modul / Teil | Pflicht-Bausteine |
|---|---|
| `web` (allgemein) | React 19, Vite, TanStack Query, TanStack Table + Virtual, Zustand, react-hook-form + zod, shadcn/ui (Radix), i18next/react-i18next, kbar |
| `web` Upload | Uppy (`@uppy/aws-s3`, Multipart) – AD-20 |
| `web` Viewer | PDF.js, React PDF Highlighter (gleiche `pdfjs-dist`) – ADR 0022 |
| `web` Grundriss | react-konva, zundo, flatbush – ADR 0014 |
| `web` 3D | three, React Three Fiber, drei – ADR 0008 |
| `api` | Fastify, pino (mit Redaction), zod, @fastify/rate-limit |
| `dokumente` / `worker` | file-type, ClamAV, exceljs, sharp – ADR 0016 |
| `docproc` | Docling Serve, OCRmyPDF, Gotenberg – ADR 0009 |
| `suche` | PostgreSQL-Volltext (de/fr/it/en), pgvector, Embedding-Server (Anbieter E27) – ADR 0023 |
| `hinweise` | Nodemailer + MJML; lokal/CI Mailpit |
| Datenbank-CI | pgTAP (RLS-Suite), Squawk (Migrationen) |
| Betrieb | GlitchTip, Healthchecks, Uptime Kuma |
| Lieferkette | Renovate, Trivy, Syft, cosign, Gitleaks, Semgrep CE, license-checker, OWASP ZAP |
| Tests | Playwright, @axe-core/playwright, k6 |
| Uebersetzung | Tolgee (selbst gehostet), Sprachdateien im Repo bleiben Build-Quelle |

Eigenbau bleibt nur fuer den fachlichen Kern: Rechenkern, Herkunftsmodell, Audit-Hash-Kette, KI-Kostenbremse, Mandantentrennung.

---

## Anhang A – Verbleibende Annahmen mit sicherem Default (austauschbar)

Die PO-Antworten E11–E22 sind verbindlich; hier stehen nur die Annahmen, die darueber hinaus getroffen wurden.

| Thema | Default [A] | Austauschbar ueber |
|---|---|---|
| Planora-Standard-Lebensdauern (E11) | Tabelle vom Chef, je Katalog-ID min/mittel/max, Referenzquelle als Text | `katalog_eintrag`, `mandant_lebensdauer` |
| Bandbreite bei Einzelwert | proportional zum Planora-Standard | Regelwerkversion |
| ZHAW-Kurve (E14) | Knick 0,75 × L, Nutzungsgrenze 0,25, Skala in 0,1-Schritten | `mandant_parameter`, Katalog, Strategie `zhaw_vN` |
| Teuerung (E16) | 1,0 %/a | `mandant_parameter.teuerung_satz` |
| Ampel (E17) | Default 3 Jahre, pro Bauteiltyp ueberschreibbar | `katalog_eintrag`, `mandant_ampel` |
| Preise (E15) | manuell + Import; Planora-Standardpreis je Katalog-ID | Port `PreisQuelle`, `mandant_preis` |
| ETIM/eBKP-H (E12/E13) | optionale Mappings, ETIM englisch, eBKP-H nur Code | `klassifikation_mapping` |
| Stratus (E22) | Excel/CSV mit dokumentierter Struktur, bis das Format bekannt ist | Adapter `AustauschFormat` |
| KI-Zustimmung | KI bei Mandantenanlage aus (opt-in) | `mandant.ki_aktiv` |
| Verfuegbarkeit | 99,5 %/Monat, RPO 5 min, RTO 4 h | Betriebsvertrag |
| Konfidenzschwellen | 0,90 / 0,60 | Konfiguration, Golden-Set-Kalibrierung |
| Budget | CHF 200/Monat/Mandant, CHF 300/Tag global | `ki_budget`, Konfiguration |
| Zielkunden Manor, Siemens (E19) | Entra ID als IdP | Keycloak-IdP je Mandant |
