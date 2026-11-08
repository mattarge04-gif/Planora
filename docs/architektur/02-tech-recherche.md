# 02 – Tech-Recherche (Welle 1)

Stand: 2026-11-08 · Autor: Tech-Rechercheur (Claude Code, Orca-Task task_378d392f487e) · Basis: `00-kontext.md` (E1–E10)
Kennzeichnung: **[F]** Fakt mit Quelle · **[A]** Annahme/Schaetzung · **[?]** offene Frage.
Alle Quellen wurden am **2026-11-08** abgerufen (Liste in Abschnitt 8). Quellen-Kuerzel stehen in eckigen Klammern, z.B. `[Q12]`.
Waehrung: USD-Preise umgerechnet mit **1 USD = 0.815 CHF** [F, Q40]. Monat = 730 Stunden. Alle Preise ohne MWST, wenn nicht anders vermerkt.

---

## Zusammenfassung (fuer den Architekten)

1. **Hosting: Exoscale (CH, Zone Zuerich `ch-dk-2` / Genf `ch-gva-2`) empfohlen.** Es bietet Managed PostgreSQL mit HA, PITR und 15 Tagen Backup im Plan „Business“, S3-kompatiblen Speicher und Managed Kubernetes. Abgerechnet wird in CHF. Zertifizierungen: ISO 27001 und BSI C5 [F, Q10–Q13]. Alternative: AWS Zuerich (am vollstaendigsten, gleiche Cloud wie Bedrock).
2. **Hosting-Kosten [A, auf F-Preisen gerechnet]:** Start ca. **CHF 300–400/Monat** (Exoscale). Bei 20 Enterprise-Mandanten ca. **CHF 900–1'300/Monat** ohne KI. AWS und Azure in der Schweiz liegen etwa gleich hoch bis +20 %.
3. **KI: Es gibt keine vertraglich zugesicherte Verarbeitung *in der Schweiz* fuer Claude.** Die Anthropic-API kennt nur `global` oder `us` [F, Q21]. Am besten passt **AWS Bedrock aus eu-central-2 (Zuerich) mit EU-Inferenzprofil**: Die Verarbeitung bleibt in der EU, Logs bleiben in Zuerich, Anthropic hat keinen Zugriff [F, Q23, Q24]. Alternative: Google Vertex AI, EU-Multi-Region-Endpunkt [F, Q25].
4. **Modell: Claude Sonnet 5.5** (USD 2/10 pro Mio. Tokens) fuer das Auslesen, **Haiku 5.5** (USD 0.10/0.50) fuer Klassifikation und Vorsortierung. Beide unterstuetzen PDF und Vision mit 1 Mio. Tokens Kontext [F, Q20]. Kosten pro Gebaeude (500 PDF-Seiten): ca. **CHF 5–20** mit Sonnet 5.5, mit Batch halbiert [A, Rechnung in 2.5].
5. **Dokumente: Claude-PDF direkt plus Docling (MIT) als Vorverarbeitung und Fallback, OCRmyPDF fuer Scans.** Marker meiden: Die Modellgewichte sind fuer Firmen ueber USD 5 Mio. Umsatz/Funding lizenzpflichtig [F, Q31]. Azure Document Intelligence ist in Switzerland North fuer USD 10 / 1'000 Seiten verfuegbar [F, Q32], als Reserve.
6. **Grundrisse: Es gibt keinen belastbaren Benchmark fuer „Claude erkennt Raum-Rechtecke“.** Die Forschung (CubiCasa5k, Raster2Seq, FloorplanVLM) zeigt: Allgemeine VLMs sind semantisch stark und geometrisch ungenau [F, Q34–Q36]. Erwartung: **Vorschlag plus Korrektur-UI ist Pflicht.** Machbarkeitstest (Spike) mit IoU-Messung ist die naechste Aufgabe.
7. **3D: three 0.187 + @react-three/fiber 9.8 + drei 10.7 (alle MIT)** [F, Q50]. 10'000+ Elemente laufen ueber `InstancedMesh`/`BatchedMesh` (ein Draw-Call pro Bauteiltyp). Die Pins werden hierarchisch gruppiert (Geschoss → Raum → Element). Pipeline: Blender → glTF → `gltf-transform` (Meshopt). **xeokit ist AGPL-3.0, deshalb ausschliessen** [F, Q53].
8. **Stack: Vite + React 19 (SPA) mit Fastify-API, Drizzle ORM (RLS ueber `pgPolicy`), pg-boss als Job-Queue (nur Postgres, kein Redis).** Alles unter MIT- oder Apache-Lizenz [F, Q50, Q54].
9. **Auth: Keycloak 26.8 (Apache-2.0) selbst gehostet** fuer SSO mit Entra ID und Mandanten. Alternative: Zitadel v4 (seit v3 AGPL-3.0, unveraendert nutzbar) [F, Q56, Q57]. WorkOS waere ein US-SaaS mit ca. USD 125 pro Verbindung und Monat [F, Q58], fuer den Datenstandort CH unguenstig.
10. **Groesste Risiken:** (a) kein CH-Only fuer Claude, deshalb braucht es eine revDSG-Begruendung „EU = angemessen“ [A] und einen Schalter pro Mandant; (b) Genauigkeit der Grundriss-Erkennung unbekannt; (c) Drizzle ist noch vor 1.0; (d) Exoscale-DBaaS laeuft ueber Aiven, als Subprozessor pruefen.

---

## 1. Hosting Schweiz

### 1.1 Funktionsvergleich

| Anbieter | Managed PostgreSQL | Backups / PITR / HA | S3-Objektspeicher | Container / K8s | ISO 27001 | Bemerkung |
|---|---|---|---|---|---|---|
| **Exoscale** (Lausanne; Zonen Genf `ch-gva-2`, Zuerich `ch-dk-2`) | Ja, „powered by Aiven“ [F, Q11]. Extensions u.a. PostGIS, pgvector [F, Q11]. Versionen auf den gelesenen Seiten nicht genannt [?] | Retention: Hobbyist 2 Tage, Startup 3, Business 15, Premium 31 [F, Q11]. PITR ab Business [F, Q12]. Replikate: Business 1, Premium 2 [F, Q11]. SLA 99.99 % ab Business [F, Q12] | SOS, S3-kompatibel. CHF 0.0000275/GB/h ≈ **CHF 0.020/GB/Monat**, Egress CHF 0.02/GB [F, Q13] | SKS: Starter gratis (ohne SLA), Pro CHF 0.054995/h ≈ CHF 40/Monat, SLA 99.95 % [F, Q13, Q14] | Ja, plus BSI C5 [F, Q10]. Scope nicht geprueft [?] | Schweizer Firma, Preise direkt in CHF |
| **Infomaniak** (Genf, eigene RZ in CH) | Database Service: MySQL/MariaDB GA. **PostgreSQL widerspruechlich:** Produktseite „bald verfuegbar“, FAQ nennt PostgreSQL [F, Q15, Q16] | Backup CHF 0.000015/GB/h, SLA 99.9 % [F, Q15]. PITR/HA fuer PG unbekannt [?] | Ja, ca. CHF 0.000016/GB/h inkl. MWST ≈ CHF 0.012/GB/Monat, 10 TB Egress inkl. [F, Q17] | Managed Kubernetes. Control Plane z.B. CHF 0.04/h [F, Q17, Drittquelle] | ISO 27001 seit 2018 [F, Q18]. Ob die Public Cloud im Scope ist: [?] | Sehr guenstig. Instanz 4 vCPU/8 GB ≈ CHF 16.10/Monat [F, Q15]. PG-Reife unklar |
| **Nine** (Zuerich, Tier-IV-RZ) | On-Demand PostgreSQL. Business XS (2 vCPU/4 GB) CHF 68.20, L (6 vCPU/16 GB) CHF 160.20 [F, Q19] | Taeglich, Retention bis 365 Tage. **PITR nicht erwaehnt.** HA nur als Managed Service auf Anfrage [F, Q19] | CHF 0.033/GiB/Monat, Egress CHF 0.02/GiB [F, Q19] | NKE ab CHF 305.30/Monat inkl. 1 Worker [F, Q19] | Ja, Reg. 15-282-908, gueltig bis 15.12.2027 [F, Q19] | Gut fuer Managed Services. K8s teuer im Einstieg |
| **cloudscale.ch** | **Nein** [F, Q19] | – | Ja, CHF 0.03/GB (Einheit unklar) [F, Q19] | Kein Managed K8s [F, Q19] | Ja (Aussage auf der Website) [F, Q19] | Nur IaaS, fuer uns zu viel Eigenbetrieb |
| **AWS eu-central-2 Zuerich** | RDS PostgreSQL. Multi-AZ = HA [F, Q1] | Automatische Backups mit PITR [A, AWS-Standard]. Backup ueber Freikontingent USD 0.1133/GB-Mt [F, Q1] | S3 Standard **USD 0.02695/GB/Mt** (erste 50 TB) [F, Q2] | EKS USD 0.10/Cluster-h [F, Q3]. ECS/Fargate [A] | Ja [A, bekannt, Report via AWS Artifact] | Bedrock in derselben Region verfuegbar |
| **Azure Switzerland North** | PostgreSQL Flexible Server [F, Q4] | PITR 7–35 Tage, zonenredundante HA [A, Doku nicht gelesen]. Backup LRS USD 0.1133/GB-Mt [F, Q4] | Blob Hot LRS **USD ~0.0216/GB/Mt** [F, Q4] | AKS Standard USD 0.10/h. Container Apps (Env. USD 0.10/h) [F, Q4] | Ja [A, bekannt] | Fuer Microsoft-Kunden vertraut. Entra ID nah |
| **Google Cloud europe-west6 Zuerich** | Cloud SQL / AlloyDB | HA, PITR [A] | GCS [A] | GKE [A] | Ja [A] | **Preise nicht abrufbar** (JS-Seiten) [?]. Drittquelle: ca. USD 0.126/vCPU-h (gemischt) [Q5] |

**RLS-Unterstuetzung:** Row-Level-Security ist ein Kernfeature von PostgreSQL und bei allen Managed-Angeboten nutzbar [A]. Voraussetzung: Die App verbindet sich mit einer Rolle, die **nicht** Tabellenbesitzer ist, oder es gilt `FORCE ROW LEVEL SECURITY` [A, vgl. Q55]. Pflicht im Spike: Auf Exoscale und RDS pruefen, dass `BYPASSRLS` fuer die App-Rolle nicht gesetzt ist.

### 1.2 Preis-Rohdaten (pro Monat, 730 h)

| Posten | Exoscale (CHF) [Q13] | AWS Zuerich (USD) [Q1–Q3] | Azure CH-Nord (USD) [Q4] |
|---|---|---|---|
| PG klein, ohne HA | Startup-4 (2 vCPU/4 GB/80 GB): **99.86** | db.t4g.medium Single-AZ: 59.86 | B2s: 63.92 |
| PG klein, **HA** | Business-4 (1 Replika, PITR): **195.43** | db.t4g.medium Multi-AZ: 119.72 + gp3 0.3014/GB | D2ds_v5: 189.80 (x2 fuer HA [A]) |
| PG mittel, **HA** | Business-8 (4 vCPU/8 GB/175 GB): **384.20** | db.m7g.large Multi-AZ: 322.66 | D4ds_v5: 379.60 (x2 fuer HA [A]) |
| PG gross, **HA** | Business-16 (16 GB/350 GB): **743.48** | db.m7g.xlarge Multi-AZ: 645.32 | D8ds_v5: 759.20 (x2 [A]) |
| DB-Storage | im Plan enthalten | gp3 0.1507 (Single) / 0.3014 (Multi-AZ) pro GB | 0.15059 pro GB |
| VM 2 vCPU/4 GB | 34.06 (+ Disk 0.102/GB) | [A] ca. 35 | [A] ca. 70 |
| VM 4 vCPU/8 GB | 68.13 | [A] ca. 70 | [A] ca. 140 |
| K8s Control Plane | Starter 0 / Pro 40.15 | 73.00 | AKS Free 0 / Standard 73.00 |
| Objektspeicher / GB | 0.020 | 0.02695 | 0.0216 |

### 1.3 Kostenschaetzung Hosting (CHF/Monat, ohne KI)

Annahmen [A]: **Start** = 1–3 Pilot-Mandanten, 100 GB Dokumente, 1 App-Knoten, 1 Worker, DB mit HA. **20 Mandanten** = 20 Enterprise-Kunden mit je ca. 5 Gebaeuden. 2 TB Dokumente, 500 GB Egress/Monat, 3 App-Knoten, 2 Worker, DB 8–16 GB RAM mit HA. Zuschlag fuer Load Balancer, Monitoring und Offsite-Backup pauschal.

| Variante | Start | 20 Mandanten |
|---|---|---|
| **Exoscale** | DB Business-4 195 + 2 VM medium 68 + Disk 10 + SOS 2 + LB/Monitoring 50 [A] ≈ **CHF 325** | DB Business-8 384 (oder -16: 743) + SKS Pro 40 + 5 VM large 341 + SOS 40 + Egress 10 + LB/Monitoring/Offsite 100 [A] ≈ **CHF 915–1'275** |
| **AWS Zuerich** | RDS t4g.medium MAZ 120 + 100 GB MAZ 30 + Compute ~70 [A] + S3 3 + ALB/CloudWatch ~40 [A] ≈ USD 263 ≈ **CHF 215–300** [A] | RDS m7g.large MAZ 323 + 500 GB 151 + EKS 73 + Compute ~350 [A] + S3 54 + Egress ~45 [A] + Rest ~100 [A] ≈ USD 1'096 ≈ **CHF 895–1'100** |
| **Azure CH-Nord** | PG D2ds HA ~380 [A: x2] + Storage 40 + Container Apps ~100 [A] + Blob 2 ≈ USD 522 ≈ **CHF 425** | PG D4ds HA ~760 + Storage 154 + Compute ~400 [A] + AKS 73 + Blob 43 ≈ USD 1'430 ≈ **CHF 1'165** |
| **Nine** | PG Business XS 68 (ohne HA/PITR) + NKE 305 + S3 3 ≈ **CHF 376** | PG Business L 160 (HA auf Anfrage [?]) + NKE 305 + 3 Worker 181 + S3 66 + Egress 10 ≈ **CHF 722 + HA-Aufpreis [?]** |

Einordnung [A]: Die Hosting-Kosten machen weniger als 5 % eines Enterprise-Abos aus. Bei der Anbieterwahl zaehlen deshalb Funktionen (PITR, HA, Zertifikate, CH-Firma) mehr als der Preis.

### 1.4 Empfehlung Hosting

- **Empfehlung: Exoscale**, Zone `ch-dk-2` (Zuerich) als primaer, `ch-gva-2` fuer Offsite-Backups [A]. Gruende: Schweizer Anbieter, CHF-Abrechnung, Managed PG mit PITR und HA ab Business, S3-API, Kubernetes optional und gratis im Starter-Tarif, ISO 27001 und BSI C5. Damit ist E7 abgedeckt (Standard-Postgres, S3-API, Docker) und auch der spaetere On-Prem-Betrieb moeglich.
- **Start ohne Kubernetes [A]:** Docker Compose auf 1–2 VMs plus Managed PG plus SOS. Kubernetes (SKS) erst ab ca. 5 Mandanten oder mit erster SLA-Zusage. Fuer 1 Entwickler senkt das den Betriebsaufwand.
- **Risiken:** Die Exoscale-DBaaS basiert auf Aiven, also gibt es einen Subprozessor mit Control Plane ausserhalb der Schweiz [?]. Die PG-Hauptversionen sind nicht dokumentiert gefunden [?]. Beides vor dem Entscheid schriftlich bei Exoscale anfragen.
- **Alternative 1: AWS Zuerich.** Alles aus einer Hand, inkl. Bedrock, und die meisten Enterprise-Security-Fragebogen kennen AWS. Nachteil: US-Konzern (CLOUD Act [A]), Abrechnung in USD, hoehere Komplexitaet.
- **Alternative 2: Azure Switzerland North,** wenn Kunden stark auf Microsoft setzen.
- **Nicht empfohlen fuer V1:** Infomaniak (PG-Status unklar), cloudscale (kein DBaaS), Nine (PITR und HA nicht belegt, K8s-Einstieg teuer). Infomaniak im Q1/2027 neu pruefen [A].

---

## 2. KI: Claude mit Datenstandort-Zusagen

### 2.1 Aktuelle Modelle und Preise (Anthropic, USD pro Mio. Tokens) [F, Q20]

| Modell | API-ID | Input | Output | Batch (−50 %) | Cache-Read | Kontext / max. Output |
|---|---|---|---|---|---|---|
| Claude Fable 5.1 | `claude-fable-5-1` | 10 | 50 | 5 / 25 | 0.25 | 1M / 128k |
| Claude Opus 5.5 | `claude-opus-5-5` | 4 | 20 | 2 / 10 | 0.20 | 1M / 128k |
| **Claude Sonnet 5.5** | `claude-sonnet-5-5` | **2** | **10** | 1 / 5 | 0.10 | 1M / 128k |
| **Claude Haiku 5.5** (≤100k Prompt) | `claude-haiku-5-5` | **0.10** | **0.50** | 0.05 / 0.25 | 0.01 | 1M / 128k |
| Claude Haiku 5.5 (>100k Prompt) | – | 0.50 | 2.50 | 0.25 / 1.25 | 0.05 | – |

- Alle aktuellen Modelle verarbeiten **Bilder (Vision) und PDFs** [F, Q20]. PDF: bis 600 Seiten und 128 MB pro Request. Jede Seite wird als Bild **und** extrahierter Text gesendet. Kosten: **1'500–3'000 Text-Tokens pro Seite** plus Bild-Tokens [F, Q20].
- Bild-Tokens = ⌈Breite/28⌉ × ⌈Hoehe/28⌉. Ab Claude 4.7 gelten max. ca. 2'576 px Kantenlaenge und ca. 4'784 Tokens pro Bild [F, Q20].
- Ab Claude 4.7 erzeugt der Tokenizer ca. 30 % mehr Tokens fuer denselben Text [F, Q20].
- `inference_geo: "us"` kostet x1.1. Bei Bedrock und Vertex kosten regionale Endpunkte **+10 %** gegenueber global [F, Q20, Q23].
- „Covered Models“ (Fable 5.1, Mythos 5.1) verlangen bei Anthropic eine Aufbewahrung von 30 Tagen und sind **nicht ZDR-faehig** [F, Q22]. Fuer Planora deshalb Sonnet und Haiku verwenden.

### 2.2 Zugangswege und Datenstandort

| Weg | Verarbeitung | Speicherung / Retention | Training | Vertrag | Eignung Planora |
|---|---|---|---|---|---|
| **Anthropic API direkt** | Nur `global` (Default) oder `us`. **Kein EU/CH** [F, Q21] | Standard: Loeschung nach 30 Tagen [F, Q22a]. ZDR auf Anfrage pro Organisation; nicht fuer Files API und Batch (29 Tage) [F, Q22] | Kein Training auf API-Daten [F, Q22b, Q26] | Vertragspartner Anthropic Ireland fuer CH-Kunden. DPA mit SCC und **Swiss Addendum** (EDOEB) [F, Q26, Q27] | Nur fuer Entwicklung und Spikes mit Testdaten |
| **AWS Bedrock, Quelle eu-central-2 (Zuerich)** | Zuerich unterstuetzt **„Global“ und „EU“**, nicht „In-region only“ [F, Q23]. EU-Profil routet u.a. nach Stockholm, Paris, Mailand, Spanien, Irland, Frankfurt, Zuerich [F, Q24] | Prompts in Zielregionen „exist in memory only“. Logs nur in der Quellregion [F, Q24]. Anthropic-Personal hat keinen Zugriff („zero operator access“) [F, Q23] | Gemaess Bedrock-Datenschutz [Q23]. Details [?] | AWS-DPA [A] | **Empfohlen.** EU-Verarbeitung, Konto und Logs in CH |
| **Google Vertex AI** | Endpunkte fuer `europe-west6` (Zuerich) gelistet, **Claude-Verfuegbarkeit dort nicht bestaetigt** [F/?, Q25]. EU-Multi-Region-Endpunkt sichert ML-Verarbeitung in der EU zu [F, Q25]. Global: „doesn't support data residency“ [F, Q25] | Optionales 30-Tage-Request-Logging, abschaltbar [F, Q25] | [A] nein | Google Cloud DPA [A] | Alternative |
| **Microsoft Foundry** | Claude verfuegbar [F, Q20]. Region Schweiz nicht belegt [?] | [?] | [?] | [?] | Nicht vertieft |

**Wichtigste Erkenntnis:** Fuer Claude konnte ich bei keinem Anbieter eine **zugesicherte Verarbeitung nur in der Schweiz** finden [F, Q21, Q23, Q25]. Der beste belegte Stand ist die **EU-Verarbeitung**. revDSG-Einordnung [A, vom Architekten bzw. juristisch zu pruefen]: EU/EWR-Staaten gelten laut Bundesrat (Anhang 1 DSV) als Staaten mit angemessenem Datenschutz. Damit ist die Bekanntgabe in die EU ohne SCC zulaessig. Pflicht bleibt die Information im Vertrag und im Verzeichnis der Subprozessoren. E5-Kunden koennen trotzdem „CH only“ verlangen. Deshalb **KI pro Mandant abschaltbar** (NFR bereits vorgesehen) und eine OCR/Docling-Pipeline ohne LLM als Fallback.

### 2.3 Empfehlung KI

- **Empfehlung:** AWS Bedrock mit Konto in **eu-central-2** und **EU-Inferenzprofil**. Modelle `anthropic.claude-sonnet-5-5` und `anthropic.claude-haiku-5-5` [F, Q23]. Die aktuellen Zielregionen des Profils per `aws bedrock get-inference-profile` dokumentieren [F, Q24].
- **Alternative:** Vertex AI mit EU-Multi-Region. Zusaetzlich bei Google klaeren, ob `europe-west6` Claude regional anbietet [?].
- **Abstraktion:** KI-Zugriff im Code hinter einen eigenen Port legen (Provider: Bedrock | Vertex | Anthropic), damit ein Wechsel ohne Umbau geht [A].
- **Risiken:** EU statt CH; die Liste der Zielregionen im Profil kann gemaess AWS-Blog je nach Modell abweichen [F, Q24]; Modellversionen wechseln etwa halbjaehrlich, deshalb Modell-ID pro Mandant oder global konfigurierbar halten [A].

### 2.4 Grobe Kosten pro Gebaeude (500 PDF-Seiten) [A, Rechnung auf F-Preisen]

Annahmen [A]: pro Seite 2'000 Text-Tokens + 1'600 Bild-Tokens (Standard-Aufloesung) bis 2'500 + 4'800 (High-Res). Ein Durchgang plus 50 % Nachfragen und Validierung. Output 500 Tokens pro Seite (JSON). Dazu 5 Grundriss-Bilder pro Geschoss bei 10 Geschossen, vernachlaessigbar (unter 100k Tokens).

| Modell | Input-Tokens | Output-Tokens | USD | CHF |
|---|---|---|---|---|
| Haiku 5.5 (Vorsortierung, Klassifikation) | 1.8–3.7 Mio. | 0.25 Mio. | 0.30–0.50 | **0.25–0.40** |
| **Sonnet 5.5** (Auslesen) | 2.7–5.5 Mio. (inkl. +50 %) | 0.4 Mio. | 9.40–15.00 | **≈ 8–12** |
| Opus 5.5 (schwierige Faelle) | 2.7–5.5 Mio. | 0.4 Mio. | 18.80–30.00 | ≈ 15–25 |
| Sonnet 5.5 via **Batch** | wie oben | wie oben | 4.70–7.50 | **≈ 4–6** |

Zuschlag Bedrock-EU-Profil gegenueber global: **+10 %** [F, Q23]. Erstbefuellung von 100 Gebaeuden (20 Mandanten × 5) mit Sonnet: ca. **CHF 800–1'200 einmalig** [A]. Laufender Betrieb (neue Dokumente) ca. **CHF 50–200/Monat** [A].

---

## 3. Dokumentverarbeitung

| Werkzeug | Lizenz | Version | Self-Hosting | Tabellen | OCR/Scans | Bemerkung |
|---|---|---|---|---|---|---|
| **Docling** (IBM / LF AI) | **MIT** [F, Q30] | v2.149.0 (2026-11-08) [F, Q30] | Ja (Python) | TableFormer. IBM nennt 97.9 % [F, Q33, Vendor-Angabe]. OmniDocBench TEDS 63.8 % [F, Q33, Drittvendor] | Integrierte OCR-Engines [A] | Breit verbreitet (70k Sterne) [F, Q30] |
| **Marker** (Datalab) | Code Apache-2.0 [F, Q30]. **Gewichte: frei nur unter USD 5 Mio. Umsatz/Funding, Wettbewerbsklausel** [F, Q31] | v2.1.0 [F, Q30] | Ja | OmniDocBench TEDS 57.9 % [F, Q33] | Ja | **Lizenzrisiko**, wenn ein Kunde oder Planora die Schwelle ueberschreitet |
| **Unstructured** (OSS) | Apache-2.0 [F, Q30] | 0.27.37 [F, Q30] | Ja | Laut Tests schwaecher, eher „generic scanner“ [F, Q33] | Ja (Tesseract) [A] | Gut fuer gemischte Formate. SaaS-Version separat [A] |
| **OpenDataLoader PDF** | Apache-2.0 [F, Q30] | v2.5.20 [F, Q30] | Ja | [?] | [?] | Neuer Kandidat, im Spike mittesten |
| **Azure Document Intelligence** | Proprietaer (Cloud), Container-Varianten „Connected/Disconnected“ [F, Q32] | – | Teilweise (Container mit Commitment ab ca. USD 8'640/Jahr) [F, Q32] | Layout-Modell gilt als stark [A] | Ja | **Switzerland North: Prebuilt/Layout USD 10 / 1'000 Seiten** [F, Q32] |
| **Claude PDF direkt** | API | – | Nein | Gut lesbar, Fehler bei grossen Tabellen moeglich [A] | Ja (Seite als Bild) [F, Q20] | Liefert Seitenreferenz fuer die Herkunft [A] |
| **OCRmyPDF** (Tesseract) | MPL-2.0 [F, Q30] | v17.13.0 [F, Q30] | Ja | – | Legt eine Textebene ueber Scans | Vorverarbeitung fuer Scans |
| **PaddleOCR** | Apache-2.0 [F, Q30] | v3.7.0 [F, Q30] | Ja | Tabellenmodul [A] | Stark bei schwierigen Scans [A] | Fallback |

**Excel-Listen:** Kein OCR noetig. Direkt parsen (z.B. SheetJS oder exceljs), Spalten per Haiku zuordnen (Mapping-Vorschlag plus Bestaetigung) [A].

**Empfehlung:** Pipeline in drei Stufen [A]:
1. Typ erkennen (Excel / Vektor-PDF / Scan).
2. Scans durch **OCRmyPDF** laufen lassen, dann **Docling** fuer Struktur und Tabellen (lokal in CH, keine Daten an Dritte).
3. **Claude Sonnet 5.5** extrahiert Kennwerte als JSON mit Seitenangabe und Konfidenz, ausgewaehlt nur aus Katalog-IDs (E8).

Wenn ein Mandant die KI abgeschaltet hat: Stufen 1–2 plus regelbasiertes Mapping.
**Risiken:** Benchmark-Zahlen sind meist Vendor-Angaben und widerspruechlich [F, Q33]. Deshalb mit 20–30 echten Datenblaettern und Anlagelisten testen (TEDS bzw. Feld-Trefferquote).
**Alternativen:** Azure DI (CH-Region, guenstig, aber Microsoft-Abhaengigkeit), Unstructured.

---

## 4. Grundriss-Erkennung (Raeume als Rechtecke)

**Stand der Technik [F]:**
- **CubiCasa5k:** 5'000 Grundrisse mit Vektor-Annotationen, De-facto-Benchmark [F, Q34]. Die Labels gelten als inkonsistent [F, Q34]. **Lizenz auf GitHub: „NOASSERTION“** [F, Q30], vermutlich nicht kommerziell nutzbar [A]. Fuer ein kommerzielles Training also nicht verwenden, ohne die Lizenz zu klaeren.
- **Spezialmodelle:** Raster2Seq (2026, SOTA auf CubiCasa5k, Structure3D, Raster2Graph) [F, Q35]. Segmentierung mit mittlerem F1 0.86 ueber 5 Klassen auf CubiCasa [F, Q35]. FloorplanVLM (feingetuntes VLM): „general VLMs … often struggle with precise spatial generation“ [F, Q36].
- **Allgemeine VLMs:** Eine Studie 2026 zur Raumflaechen-Schaetzung mit Open-Source-VLMs: Die quantitative Genauigkeit liegt „significantly below … deterministic image analysis“ [F, Q36]. **Fuer Claude gibt es keinen publizierten Benchmark zu Raum-Rechtecken** [F, Recherche ohne Treffer].

**Realistische Erwartung [A]:**
- Saubere CAD-PDFs (Vektor) mit Raumstempeln: Claude erkennt 80–95 % der Raeume **als Liste** (Name, Nummer, Flaeche aus dem Stempel). Die **Rechteck-Geometrie** liegt eher bei 60–80 % innerhalb ±5 % Toleranz.
- Scans und schiefe Fotos: deutlich schlechter.
- L-foermige Raeume und Korridore passen ohnehin nicht als Rechteck (E3), dort ist eine manuelle Korrektur noetig.

**Empfehlung (hybrid) [A]:**
1. **Bei Vektor-PDFs zuerst Text und Linien direkt auslesen** (z.B. pdf.js / pdfjs-dist 6.5, Apache-2.0 [F, Q50]). Die Positionen der Raumstempel dienen als Anker, und Flaechenangaben aus dem Stempel pruefen jedes Rechteck auf Plausibilitaet.
2. **Claude Vision** (High-Res-Kacheln) schlaegt Rechtecke in normierten Koordinaten vor, mit Stempel-Text als Kontext.
3. Optional klassische Bildverarbeitung (Wand-Erkennung mit OpenCV) zum Einrasten der Kanten.
4. **Korrektur-UI** (Rechtecke ziehen und einrasten) ist Pflicht. Die Kennzahl ist „Klicks pro Geschoss“.

**Spike-Vorschlag fuer den Test-Architekten:** 10 echte Grundrisse (5 Vektor, 5 Scan). Messen: IoU pro Raum, Recall der Raeume, Korrekturzeit.
**Risiko:** hoch, das ist die groesste fachliche Unbekannte in V1. **Alternative:** Raeume manuell auf dem Grundriss zeichnen (Unterlage plus Rechteck-Werkzeug) als garantierter Fallback, damit die Software „bedingungslos funktioniert“.

---

## 5. 3D

### 5.1 Versionen und Lizenzen [F, Q50]

| Paket | Version | Lizenz | Stand |
|---|---|---|---|
| three | 0.187.0 | MIT | 2026-10-30 |
| @react-three/fiber | 9.8.2 | MIT | 2026-10-14 |
| @react-three/drei | 10.7.9 | MIT | 2026-09-25 |
| @react-three/postprocessing | 3.2.2 | MIT | 2026-10-21 |
| react | 19.3.1 | MIT | 2026-10-14 |
| @gltf-transform/core (+ CLI) | 4.5.1 | MIT | 2026-09-28 |
| meshoptimizer | 1.3.0 | MIT | 2026-09-25 |

### 5.2 Technik fuer 10'000+ Objekte

- **InstancedMesh:** viele Objekte mit gleicher Geometrie und gleichem Material, weniger Draw-Calls, Farbe pro Instanz via `setColorAt` [F, Q51]. Bei 30–50 Bauteiltypen (E8) bedeutet das **ca. 30–50 Draw-Calls fuer 10'000+ Elemente** [A].
- **BatchedMesh:** verschiedene Geometrien mit **einem** Material; Instanzen dynamisch hinzufuegen und loeschen, Sichtbarkeit pro Instanz [F, Q51]. Passt zum Ton-Look mit nur einem Material. Damit ist potenziell **1 Draw-Call fuer alle Elemente** moeglich [A].
- **drei:** `<Instances>`/`<Merged>` fuer deklaratives Instancing (Hinweis: CPU-Overhead bei sehr vielen deklarativen Instanzen), `<Bvh>` fuer schnelles Raycasting (Klick auf Element), `<Detailed>` fuer LOD [F, Q52].
- **Pin-Clustering [A]:** Nach Hierarchie gruppieren (Geschoss → Raum → Elementtyp-Aggregat mit Zaehler) plus Gruppierung im Bildschirmraum je nach Zoom. Pins als instanzierte Sprites/Billboards im WebGL rendern, **nicht** als tausende HTML-Overlays (drei `<Html>` nur fuer den ausgewaehlten Pin).
- **Ton-Look [A]:** ein `MeshStandardMaterial` (weiss, rau), Ambient Occlusion (N8AO via postprocessing), orthografische Kamera isometrisch, Geschosse als Gruppen mit Y-Offset fuer „Explode“.

### 5.3 glTF-Pipeline aus Blender

1. Blender: Bauteil modellieren, Ursprung am Boden, Massstab in Metern, ohne Texturen (Ton-Look) [A].
2. Export glTF 2.0 (.glb) [A].
3. `gltf-transform optimize in.glb out.glb --compress meshopt` (zusaetzlich `dedup`, `weld`, `simplify`, `instance`) [F, Q53a].
4. Laden mit `GLTFLoader.setMeshoptDecoder(...)`. **Draco** (`setDRACOLoader`) und **KTX2** (`setKTX2Loader`) werden ebenfalls unterstuetzt [F, Q51].

Empfehlung **Meshopt statt Draco** [A]: schnelleres Dekodieren, kein WASM-Decoder-Pfad noetig, gut fuer viele kleine Bauteile. Bei 30–50 Bauteilen ist die Gesamtgroesse ohnehin klein.

### 5.4 Kurzvergleich Engines

| Engine | Lizenz | Version | Eignung |
|---|---|---|---|
| **Three.js + R3F** | MIT | s.o. | **Gewaehlt (E8).** Groesstes Oekosystem, React-Integration |
| Babylon.js | Apache-2.0 [F, Q50] | 9.35.0 [F, Q50] | Vollstaendige Engine, gut, aber nicht React-nativ. Kein Grund zu wechseln |
| **xeokit** | **AGPL-3.0** oder kommerzielle Lizenz auf Anfrage [F, Q53] | 2.6.114 [F, Q50] | BIM-Viewer. **AGPL heisst SaaS-Quellcode offenlegen**, deshalb ausschliessen |
| That Open Engine (@thatopen/components) | MIT [F, Q50] | 3.6.0 [F, Q50] | IFC/BIM auf Three.js-Basis. **Spaeter fuer IFC-Import (E9)** interessant, nicht fuer V1 |

**Empfehlung:** wie E8. **Risiko:** gering. Performance mit BatchedMesh frueh in einem Spike mit 20'000 Dummy-Elementen auf einem Firmen-Laptop messen [A].

---

## 6. TypeScript-Stack

### 6.1 Versionen und Lizenzen [F, Q50, Q54]

| Bereich | Option | Version | Lizenz | Bemerkung |
|---|---|---|---|---|
| Framework | Next.js | 16.4.5 | MIT | Fullstack, RSC |
| | React Router (Framework-Modus, Nachfolger von Remix) | 8.5.1 | MIT | `@remix-run/node` nur noch 2.17.5 (Juni 2026) |
| | **Vite (SPA) + Fastify (API)** | 8.3.6 / 5.12.8 | MIT | Klare Trennung von Frontend und API |
| | Hono | 4.13.17 | MIT | Alternative zu Fastify |
| ORM | **Drizzle ORM** | 0.45.4 | Apache-2.0 | `pgPolicy` fuer RLS im Schema [F, Q55]. **Noch vor 1.0** |
| | Prisma | Client 7.10.1 (CLI-Tag `latest` = 8.0.0-rc.33!) | Apache-2.0 | RLS nur ueber Extensions und Transaktionen [A] |
| Job-Queue | **pg-boss** | 12.38.1 | MIT | Nur Postgres |
| | Graphile Worker | 0.18.0 | MIT | Nur Postgres, LISTEN/NOTIFY |
| | BullMQ | 6.7.2 | MIT | **Braucht Redis** |
| Auth | **Keycloak** | 26.8.2 | Apache-2.0 | Java, selbst gehostet |
| | Zitadel | v4.20.1 | **AGPL-3.0** seit v3 (31.03.2025) [F, Q57] | Go, Mandanten (Orgs) nativ |
| | Better Auth | 1.7.18 | MIT | Bibliothek. Betreut seit 2025 auch Auth.js [F, Q59] |
| | Auth.js / next-auth | 4.24.15 | ISC | Laut Drittquellen im Wartungsmodus [F, Q59] |
| | WorkOS | Node SDK 12.2.0 | MIT (SDK), SaaS | USD 125 pro SSO-Verbindung/Monat fuer 1–15 Verbindungen [F, Q58, Drittquellen] |

### 6.2 Bewertung und Empfehlung

**Framework – Empfehlung: Vite + React SPA und Fastify-API im Monorepo [A].**
- Gruende:
  - Die App ist eine 3D-lastige Fachanwendung hinter Login, ohne SEO-Bedarf.
  - Eine klare REST/RPC-Grenze passt zum modularen Monolithen und zum Worker-Prozess aus derselben Codebasis.
  - Docker und On-Prem sind einfach (E7).
  - Es gibt keine Abhaengigkeit von Next-spezifischen Caching- und Server-Component-Eigenheiten.
- Alternative: **React Router 8 (Framework-Modus)**, wenn Server-Rendering fuer die Verwaltungsseiten gewuenscht ist. Next.js ist moeglich, bringt fuer diesen Anwendungsfall aber mehr Komplexitaet als Nutzen [A].

**ORM – Empfehlung: Drizzle.**
- Gruende:
  - SQL-nah.
  - RLS-Policies im Schema per `pgPolicy` [F, Q55].
  - Den Mandantenkontext pro Request in einer Transaktion setzen: `select set_config('app.mandant_id', $1, true)`. Die Policy prueft `current_setting('app.mandant_id', true)` [F, Q55].
- **Pflicht [A]:** App-Rolle ≠ Tabellenbesitzer oder `FORCE ROW LEVEL SECURITY`. Kontext nie ausserhalb einer Transaktion setzen, weil sonst ueber den Connection-Pool Daten zwischen Mandanten durchsickern [F, Q55]. Den RLS-Test pro Tabelle in die CI aufnehmen.
- **Risiko:** Drizzle ist vor 1.0 (API-Aenderungen). Alternative: Prisma 7 mit Client-Extension fuer RLS. Hier verwirrt das `latest`-Tag (8.0 RC) und die RLS-Integration ist umstaendlicher [A].

**Job-Queue – Empfehlung: pg-boss.**
- Gruende: Nur PostgreSQL, also keine zusaetzliche Komponente (Redis), passend zu „Standard-Postgres, portabel“ (E7). Jobs koennen transaktional mit Fachdaten angelegt werden [A]. Fuer KI-Jobs mit Sekunden bis Minuten Laufzeit ist der Durchsatz ausreichend [A].
- Pflicht: Der Worker setzt den Mandantenkontext (RLS) pro Job.
- Alternative: **Graphile Worker** (niedrigere Latenz). BullMQ nur, falls Redis ohnehin kommt.

**Auth/SSO – Empfehlung: Keycloak 26 selbst gehostet in CH.**
- Gruende: Apache-2.0 ohne Lizenzrisiko. Entra ID per OIDC/SAML-Brokering. Mandanten ueber Organizations oder Realms [A]. Enterprise-Kunden kennen Keycloak, und es ist On-Prem-faehig.
- Kosten: eine weitere JVM-Komponente (ca. 1–2 GB RAM [A]).
- **Alternative: Zitadel** (Mandanten-Modell eleganter, leichter). AGPL-3.0, aber laut FAQ unbedenklich bei unveraenderter Nutzung als IdP [F, Q57]. Kommerzielle Lizenz verfuegbar [F, Q57].
- **Nicht empfohlen:**
  - WorkOS: US-SaaS. Bei 20 Mandanten ca. USD 2'500/Monat nur fuer SSO [A, Rechnung auf Q58].
  - Auth.js: Wartungsmodus.
- Better Auth (mit SSO/Organization-Plugins [A]) ist eine schlanke Option ohne separaten IdP. Die Enterprise-SSO-Reife muesste geprueft werden [?].

---

## 7. Empfehlungen im Ueberblick

| # | Thema | Empfehlung | Begruendung (kurz) | Groesstes Risiko | Alternative |
|---|---|---|---|---|---|
| 1 | Hosting | **Exoscale** (Zuerich + Genf), Start mit VMs + Docker Compose, spaeter SKS | CH-Firma, CHF, Managed PG mit HA und PITR, S3, ISO 27001/C5, portabel | Aiven als Subprozessor; PG-Version nicht belegt | AWS Zuerich; Azure CH-Nord |
| 2 | KI | **Bedrock eu-central-2, EU-Profil**, Sonnet 5.5 + Haiku 5.5, Provider-Port | Beste belegte Datenzusage (EU), Logs in CH, kein Anthropic-Zugriff | **Kein CH-only**; Kunden-Akzeptanz | Vertex EU-Multi-Region; Anthropic direkt nur fuer Entwicklung |
| 3 | Dokumente | **OCRmyPDF → Docling → Claude (JSON + Seite + Konfidenz)** | Lokal, MIT/MPL, Herkunft je Wert | Tabellenqualitaet bei Herstellerblaettern unbekannt | Azure DI (CH, USD 10/1'000 S.); Unstructured |
| 4 | Grundriss | **Hybrid: Vektor-Text/Stempel + Claude Vision + Pflicht-Korrektur-UI**, manueller Fallback | Kein Benchmark, VLM geometrisch schwach | Genauigkeit unbekannt, Spike noetig | Spezialmodell (Raster2Seq), Lizenz der Trainingsdaten klaeren |
| 5 | 3D | **three + R3F + drei, BatchedMesh/InstancedMesh, Meshopt, hierarchisches Pin-Clustering** | MIT, grosses Oekosystem, 1–50 Draw-Calls | Pins/HTML-Overlays als Performance-Falle | Babylon.js; That Open fuer spaeteren IFC-Import |
| 6a | Framework | **Vite SPA + Fastify** | Einfach, portabel, klare API | Eigenes Routing/SSR fehlt (nicht noetig) | React Router 8; Next.js 16 |
| 6b | ORM | **Drizzle** + RLS per `pgPolicy`/`set_config` in Transaktion | RLS im Schema, SQL-nah | Vor 1.0; Pool-Leak bei Fehlbedienung | Prisma 7 |
| 6c | Queue | **pg-boss** | Nur Postgres | Durchsatz bei sehr grossen Importen [A] | Graphile Worker |
| 6d | Auth | **Keycloak 26** selbst gehostet | Apache-2.0, Entra ID, On-Prem | Betriebsaufwand JVM | Zitadel (AGPL, unveraendert ok) |

**Kosten gesamt (Hosting + KI-Betrieb) [A]:** Start ca. **CHF 350–450/Monat**. 20 Mandanten ca. **CHF 1'000–1'500/Monat**, zusaetzlich einmalig ca. CHF 800–1'200 fuer die KI-Erstbefuellung.

**Offene Punkte fuer Welle 2 [?]:**
1. Exoscale: PG-Versionen, Aiven-Control-Plane-Standort, ISO-Scope. Schriftlich anfragen.
2. Bedrock: aktuelle Zielregionen des EU-Profils fuer Sonnet/Haiku 5.5 per CLI festhalten. AWS-DPA pruefen.
3. Vertex: Claude in `europe-west6` regional verfuegbar?
4. Juristisch: Reicht „EU-Verarbeitung“ fuer die Zielkunden (E5)? Vertragsklausel pro Mandant.
5. Spikes: Grundriss (IoU), Datenblatt-Extraktion (Feld-Trefferquote), 3D mit 20'000 Elementen, RLS-Leak-Test mit Pool.

---

## 8. Quellen (alle abgerufen am 2026-11-08)

**Hosting**
- Q1 AWS Price List API, AmazonRDS eu-central-2 (publicationDate 2026-10-29): https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonRDS/current/eu-central-2/index.json
- Q2 AWS Price List API, AmazonS3 eu-central-2: https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonS3/current/eu-central-2/index.json
- Q3 AWS EKS Pricing: https://aws.amazon.com/eks/pricing/
- Q4 Azure Retail Prices API, armRegionName `switzerlandnorth` (PostgreSQL, Storage/Blob, AKS, Container Apps): https://prices.azure.com/api/retail/prices
- Q5 Google Cloud SQL Pricing (Regionswerte nicht lesbar): https://cloud.google.com/sql/pricing ; Drittquelle Spare Cores: https://sparecores.com/database/gcp/db-perf-optimized-N-64
- Q10 Exoscale Compliance (ISO 27001, BSI C5, GDPR, FDPA): https://www.exoscale.com/compliance/gdpr/ (Links auf https://www.exoscale.com/pricing/)
- Q11 Exoscale Managed PostgreSQL: https://www.exoscale.com/dbaas/postgresql/
- Q12 Exoscale Community, PostgreSQL Overview (PITR, SLA, Zonen): https://community.exoscale.com/product/dbaas/service-specific/postgresql/overview/
- Q13 Exoscale Preis-API (CHF/h): https://portal.exoscale.com/api/pricing/dbaas-pg , …/opencompute , …/sks , …/sos
- Q14 Exoscale SKS: https://www.exoscale.com/sks/
- Q15 Infomaniak Database Service: https://www.infomaniak.com/de/hosting/public-cloud/database ; Public Cloud: https://www.infomaniak.com/en/hosting/public-cloud
- Q16 Infomaniak FAQ DBaaS: https://www.infomaniak.com/en/support/faq/418/use-database-management-systems-mysql-libraries-etc
- Q17 Infomaniak Object Storage: https://www.infomaniak.com/en/hosting/public-cloud/object-storage ; Drittquelle Kubernetes-Preis: https://www.whtop.com/plans/infomaniak.com/135593
- Q18 Infomaniak Zertifizierungen: https://www.infomaniak.com/en/certifications ; Trust Center: https://www.infomaniak.com/en/trust-center
- Q19 Nine: https://www.nine.ch/en/services/databases/ , https://www.nine.ch/en/products/kubernetes/ , https://www.nine.ch/en/products/objectstorage/ , https://www.nine.ch/en/trust-centre/certifications/ ; cloudscale: https://www.cloudscale.ch/en/pricing , https://www.cloudscale.ch/en/offer

**KI**
- Q20 Anthropic Pricing / Models / PDF / Vision: https://platform.claude.com/docs/en/about-claude/pricing , https://platform.claude.com/docs/en/about-claude/models/overview , https://platform.claude.com/docs/en/build-with-claude/pdf-support , https://platform.claude.com/docs/en/build-with-claude/vision
- Q21 Anthropic Data Residency: https://platform.claude.com/docs/en/manage-claude/data-residency
- Q22 Anthropic ZDR / API Data Retention: https://platform.claude.com/docs/en/build-with-claude/zero-data-retention
- Q22a Anthropic Privacy, Retention (Stand 01.07.2026): https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data
- Q22b Anthropic Privacy, Training (Stand 18.08.2026): https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training
- Q23 Claude in Amazon Bedrock: https://platform.claude.com/docs/build-with-claude/claude-in-amazon-bedrock
- Q24 AWS Alps Blog, Cross-Region Inference Schweiz (21.10.2025): https://aws.amazon.com/blogs/alps/unlocking-ai-flexibility-in-switzerland-a-guide-to-cross-region-inference-for-eu-data-processing-and-model-access
- Q25 Vertex AI Locations / Claude: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/locations , https://docs.cloud.google.com/vertex-ai/generative-ai/docs/partner-models/use-claude
- Q26 Anthropic Commercial Terms: https://www.anthropic.com/legal/commercial-terms
- Q27 Anthropic DPA: https://www.anthropic.com/legal/data-processing-addendum

**Dokumente / Grundriss**
- Q30 GitHub-API (Lizenz, Releases): docling-project/docling, datalab-to/marker, Unstructured-IO/unstructured, opendataloader-project/opendataloader-pdf, ocrmypdf/OCRmyPDF, PaddlePaddle/PaddleOCR, CubiCasa/CubiCasa5k (via `gh api repos/<repo>`)
- Q31 Marker-Lizenz: https://pypi.org/project/marker-pdf/ , https://documentation.datalab.to/docs/on-prem/overview
- Q32 Azure Retail Prices API, Azure Document Intelligence, switzerlandnorth: https://prices.azure.com/api/retail/prices
- Q33 Tabellen-Benchmarks (Vendor-/Drittquellen): https://www.ertas.ai/blog/pdf-parsing-accuracy-benchmark-docling-unstructured , https://tensorlake.ai/blog/benchmarks , https://boringbot.substack.com/p/pdf-table-extraction-showdown-docling
- Q34 CubiCasa5k: https://www.emergentmind.com/topics/cubicasa5k-dataset-1b6b7d61-dd68-406e-aa2a-87eb0dd79b93 ; TU Delft Thesis: https://repository.tudelft.nl/file/File_3e7d7f89-cf96-4167-9f5d-b481349d0c60
- Q35 Raster2Seq: https://arxiv.org/html/2602.09016v1 ; Multi-Unit-Segmentierung: https://arxiv.org/html/2408.01526v1
- Q36 FloorplanVLM: https://arxiv.org/html/2602.06507 ; Aliyev/Barsi 2026: https://pp.omikk.bme.hu/ci/article/download/44138/24640/262788 ; WAFFLE: https://arxiv.org/pdf/2412.00955 ; Blueprint-Bench: https://arxiv.org/pdf/2509.25229

**3D / Stack**
- Q50 npm-Registry (Version, Lizenz, Datum): https://registry.npmjs.org/<paket> fuer three, @react-three/fiber, @react-three/drei, @react-three/postprocessing, react, next, react-router, @remix-run/node, vite, fastify, hono, drizzle-orm, prisma, @prisma/client, pg-boss, bullmq, graphile-worker, next-auth, @auth/core, better-auth, @workos-inc/node, keycloak-js, @babylonjs/core, @xeokit/xeokit-sdk, @thatopen/components, meshoptimizer, @gltf-transform/core, pdfjs-dist
- Q51 three.js Docs: https://threejs.org/docs/pages/InstancedMesh.html , https://threejs.org/docs/pages/BatchedMesh.html , https://threejs.org/docs/pages/GLTFLoader.html
- Q52 drei Docs: https://drei.docs.pmnd.rs/performances/instances , …/merged , …/bvh , …/detailed
- Q53 xeokit Lizenz: https://xeokit.io/
- Q53a glTF-Transform: https://gltf-transform.dev/ , https://gltf-transform.dev/cli
- Q54 GitHub-API: drizzle-team/drizzle-orm, timgit/pg-boss, graphile/worker, keycloak/keycloak, zitadel/zitadel, better-auth/better-auth, xeokit/xeokit-sdk, ThatOpen/engine_components
- Q55 Drizzle RLS: https://orm.drizzle.team/docs/rls ; Neon-Guide: https://neon.com/docs/guides/rls-drizzle ; Drittquelle Multi-Tenancy: https://ecosire.com/blog/drizzle-orm-postgres-rls-multitenancy
- Q56 Keycloak Release 26.8.2 (GitHub-API): https://github.com/keycloak/keycloak
- Q57 Zitadel AGPL: https://zitadel.com/blog/apache-to-agpl , https://zitadel.com/license-faq
- Q58 WorkOS-Preise (Drittquellen): https://clerk.com/articles/the-real-cost-of-enterprise-sso-per-connection-vs-per-mau-p-3 , https://ssojet.com/blog/workos-pricing-at-scale-50-100-200-connections
- Q59 Auth.js → Better Auth: https://better-auth.com/blog/authjs-joins-better-auth , https://github.com/nextauthjs/next-auth/discussions/13252

**Sonstiges**
- Q40 Wechselkurs USD/CHF ca. 0.815 (Anfang November 2026): https://www.fxstreet.com/news/swiss-franc-hits-fresh-seven-week-highs-as-inflation-growth-beats-expectations-202611030822 , https://www.xe.com/currencyconverter/convert/?From=CHF&To=USD
