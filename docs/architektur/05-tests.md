# 05 – Teststrategie Planora V1 und Ergebnisse der Machbarkeitstests (Welle 3)

> **Hinweis Welle 4 (2026-11-09):** Vorrang haben E24 und E34–E37 (`00-kontext.md`), ADR 0027–0031 und `07-analyse-b2b.md`. Kap. 1–10 enthalten alte Release-Gates (RLS, Keycloak, Bedrock, FR/IT, Exoscale) und sind **keine aktuelle Freigabegrundlage**; **Aktuelle Freigabegrundlage ist Kap. 12** (Abnahmematrix N1–N6 × Lieferstufe × Modul, Welle 4b); Kap. 12.3 zeigt je alter Pruefung, ob sie bleibt (mit Lieferstufe), umgewidmet wird oder entfaellt. Historische Messwerte in Kap. 1 und 9 bleiben unveraendert.

Stand: 2026-11-08 · Rolle: Test-Architekt (BMAD QA, Orca-Task task_e629c5a2d92f) · Status: **Entwurf zur Freigabe**
Basis: `00-kontext.md`, `01-domaene.md` (FA-01..FA-38), `02-tech-recherche.md`, `03-architektur.md` (Kap. 13 Spikes), `adr/0001–0021`.
Kennzeichnung: **[F]** gemessen oder mit Quelle belegt · **[A]** Annahme · **[?]** offen.
Spike-Ordner: `spikes/sNN-name/` je mit README (Ziel, Vorgehen, Messwerte, Urteil, Grenzen).

---

## 1. Zusammenfassung

> Welle 4b: historischer Messbericht Welle 3, unveraendert; Uebernahme der Empfehlungen siehe Kap. 12.3. → Kap. 12

### 1.1 Spike-Ergebnisse auf einen Blick

| Spike | Urteil gegen 03 Kap. 13.2 | Kernmesswert [F] | Ordner |
|---|---|---|---|
| S1 Grundriss | **Lindenhof bestanden, Kriterium offen** (keine echten Plaene, keine Korrektur-UI) | Recall 100 %, Median-IoU 0,993–0,995 in 9/9 Laeufen; Eckabweichung ≤ 2,6 cm; Massstab aus Stempeln ± 0,12 % | `spikes/s01-grundriss/` |
| S2 Extraktion | **Lindenhof bestanden, Kriterium offen** (nur 9 synthetische DE-Datenblaetter) | 54/54 Typfelder, 55/55 Elementzeilen, 113/113 Instanzen in 3/3 Laeufen; **0 erfundene Lebensdauern**; Praezision "hoch" 97/97 | `spikes/s02-extraktion/` |
| S10 Rechenkern | **technisch bestanden, fachlich offen** (Kurve gegen Quelle, Excel, 2. Maschine) | 12/12 Tests; 10'000 Zufalls-Snapshots byte-identisch; FA-22-Tabelle 16/16 gegen Python-Orakel; 10'000 Elemente in ≤ 149 ms | `spikes/s10-rechenkern/` |
| S3 3D | **nicht entschieden** (kein Iris-Xe-Laptop) | RTX 3070 Ti: 20'000 Elemente 1,3 ms (instanced) bzw. 6,2 ms (BatchedMesh) pro Frame; ohne GPU 4 fps | `spikes/s03-3d/` |
| S4 RLS | **lokal bestanden, Exoscale offen** | 10'000 parallele Requests, Pool 10: **0 Fremdzeilen**; Negativkontrolle findet Leck; Audit 100 Angaben 17 ms | `spikes/s04-rls/` |
| S12 Preisquellen | **nicht bestanden** (Stand Recherche) | Feeds existieren (ELDAS EDA 2.0, IGH DataExpert), **keine** belegte SaaS-Lizenz | `spikes/s12-preisquellen/` |
| S5, S6, S7, S8, S9, S11, S13 | nicht ausgefuehrt (Cloud-Konten/Dritte noetig) | Testplaene Kap. 9 | – |

### 1.2 Groesste Ueberraschungen

1. **Der Validator ist die Schwachstelle, nicht das Modell (S2).** Alle Werte waren richtig, aber zusammengesetzte oder gekuerzte Zitate liessen bis zu 30 % korrekter Felder aus der Stufe "hoch" fallen. Umgekehrt prueft das Grounding die Katalog-ID gar nicht: eine falsche Katalog-ID mit echtem Zitat kaeme auf "hoch".
2. **BatchedMesh ist mit Default-Einstellungen 4,8× langsamer als InstancedMesh (S3)**, wegen Culling und Sortierung pro Instanz auf der CPU. Und ohne GPU-Beschleunigung (virtuelle Desktops) laeuft 3D mit 4 fps.
3. **Die Annahme "Datenblaetter enthalten keine Lebensdauer" stimmt nur fuer 7 von 9 Typen.** LT-01/LT-02 nennen 50'000 h bzw. 40'000 h L80/B10. Die Pipeline hat das korrekt als Stunden erkannt und nie in Jahre umgerechnet.
4. **Spezifikationsluecke im Rechenkern (S10):** Nach einem ueberfaelligen Ersatz (J1 = 2015, Stichtag 2026, L = 15) liefert 03 Kap. 8.4 Folgeereignisse 2026 **und 2030**, also zwei Ersaetze in 4 Jahren.
5. **Sauberer Vektorplan braucht keine KI (S1):** Die Vektor-Baseline (gefuellte Flaechen aus der PDF) war exakt (IoU 1,000), die KI-Laeufe 0,993–0,995.

### 1.3 Empfehlungen an die Architektur (priorisiert)

| # | Empfehlung | Bezug | Begruendung |
|---|---|---|---|
| E-T1 | Zitat = **Array zusammenhaengender woertlicher Ausschnitte**; Validator prueft jedes Teilzitat; Katalog-ID nie allein ueber Grounding auf "hoch" (Schluesselwort-Gegenpruefung je Katalogeintrag DE/FR/IT + Typ-Konsistenz) | 03 Kap. 5.5/5.6, ADR 0012 | S2 Befund 1 und 2 |
| E-T2 | ADR 0008: **InstancedMesh pro Katalogtyp als Standard**, BatchedMesh nur mit `perObjectFrustumCulled=false`, `sortObjects=false` | ADR 0008, 03 Kap. 7 | S3: 1,3 vs. 6,2 ms |
| E-T3 | Software-Renderer erkennen (WebGL-Renderer enthaelt SwiftShader/llvmpipe/Basic Render) → direkt 2D-Ansicht anbieten; 2D/Tabelle als gleichwertiger Pfad | 03 Kap. 7.3, FA-33/34 | S3: 4 fps ohne GPU |
| E-T4 | PO-Entscheid: Folgezyklus ab `max(J1, Stichtag)` statt ab J1; Folgezyklus nach manueller Verschiebung festlegen | 03 Kap. 8.4, FA-27/28 | S10 Befund 1/2 |
| E-T5 | Pool-Hygiene: `RESET app.mandant_id` (oder `DISCARD ALL`) beim Zurueckgeben jeder Verbindung + Lint gegen `SET` ohne `LOCAL`; Negativkontrolle als CI-Pflichttest | ADR 0010 | S4 (d') |
| E-T6 | Vektor-Pfad (ADR 0014 Schritt 1) mit Flaechen-/Polygonextraktion zuerst; Massstab automatisch aus Stempeln; Achsen-Einrasten deterministisch | ADR 0014 | S1 |
| E-T7 | Preise: V1 Import-Adapter **ELDAS EDA 2.0** und **IGH DataExpert**, Mandant importiert eigene Lieferantenpreise; Lizenzanfragen an ELDAS/IGH; Ersatzkosten ≠ Materialpreis | ADR 0018, E15, R11 | S12 |
| E-T8 | Lint fuer `domain/`: zusaetzlich `localeCompare`, `Intl.*`, `toLocaleString` verboten; Rechenweg-Text locale-neutral, Lokalisierung nur in der Anzeige | ADR 0013 | S10 Befund 3/4 |
| E-T9 | Merkmal `menge` mit eigener Herkunft und Pflicht-Querpruefung Liste ↔ Datenblatt-Stueckzahl | 03 Kap. 5.6 Punkt 5 | S2 (WP-01) |
| E-T10 | Alle KI-Spikes mit Produktionsmodell (Bedrock, Sonnet 5.5) und **echten** Unterlagen wiederholen, bevor FA-12/FA-13 als bewiesen gelten | 03 Kap. 5.8, R12 | Abo-Modus und synthetische Daten sind Obergrenze |

---

## 2. Grundsaetze

> Welle 4b: gelten weiter mit den Abweichungen in Kap. 12.3 (kein "RLS aktiv", Speicher = ausgelieferter lokaler Speicher). → Kap. 12

1. **Korrektheit vor Abdeckung.** Tests sind nach den Qualitaetszielen in 03 Kap. 1.2 priorisiert: Datenkorrektheit, Mandantentrennung, Nachvollziehbarkeit vor Performance.
2. **Jeder Fehler aus Kap. 11 in 03 hat mindestens einen Test**, der ihn ausloest (Fehlerinjektion), nicht nur den Gutfall.
3. **Echte Infrastruktur fuer Adapter:** Postgres-Tests laufen gegen echtes PostgreSQL mit RLS aktiv (CI-Container; lokal `embedded-postgres` wie in S4 [F]), S3 gegen MinIO o.ae. [A], nie gegen Mocks.
4. **KI ist im CI immer ein Fake** (deterministische Antworten aus aufgezeichneten Fixtures). Echte KI nur im Golden-Set-Job (Kap. 4).
5. **Reine Funktionen bekommen Eigenschaftstests** (Determinismus, Invarianten), nicht nur Beispiele.
6. **Testdaten sind synthetisch** und liegen im Repo (`eval/`, `test/fixtures/`). Kundendokumente nie im Repo (03 Kap. 5.8).
7. **Ein Fehler, ein Test:** Jeder Produktionsfehler erhaelt vor dem Fix einen roten Regressionstest.

---

## 3. Testpyramide je Modul

> Welle 4b: Modul-Lieferstufen und Gates siehe Kap. 12.2; `preise`, Grundriss und `austausch` sind keine Demo-Module. → Kap. 12

Ebenen: **U** Unit (reine Logik, ms) · **A** Adapter/Integration (echtes PG/S3, Sekunden) · **K** Komponente/API (Fastify-Inject, PG, Fake-KI) · **E** End-to-End (Browser, Playwright) · **G** Golden Set (echte KI, nicht im PR-Lauf) · **P** Performance/Last.
Anteile sind Richtwerte [A].

| Modul | Schwerpunkt | U | A | K | E | Weitere | Pflichttests (Auszug) |
|---|---|---|---|---|---|---|---|
| plattform | `mitMandant()`, IDs, Fehlerformat, Audit-Funktion | 40 % | 50 % | 10 % | – | – | Wrapper setzt nur `SET LOCAL`; Verbindung nach Release ohne Kontext; Audit-Hash-Kette; UUIDv7 monoton |
| identitaet | Recht × Rolle × Liegenschaft | 60 % (Matrix-Test) | 20 % | 20 % | Login-Fluss | S9 | Vollstaendige Matrix 5 Rollen × alle Rechte; Liegenschafts-Scope; Mandantenwechsel ohne Neuanmeldung (FA-03); Session-Timeout |
| mandant | Parameter, KI-Schalter | 50 % | 40 % | 10 % | – | – | KI-Zustimmung protokolliert; Parameter versioniert |
| katalog | Katalog-JSON, Mappings, Texte DE/FR/IT | 60 % (Schema/Konsistenz) | 30 % | 10 % | – | GLB-Budget-Pruefung | Jede Katalog-ID hat GLB + Hash + 3 Sprachen + Lebensdauer min ≤ mittel ≤ max; IDs nie umbenannt (Diff gegen Vorversion) |
| struktur | Hierarchie, Raum-Rechtecke, Vorschlaege annehmen | 50 % | 30 % | 20 % | Korrektur-UI | – | Rechteck-Geometrie (Ueberlappung, Seite); "Geschoss bestaetigen" atomar; Loeschen mit Kindern (FA-02) |
| interview / szene (E33) | Weltbeschreibung, Regelwerk, Weltgenerator | 70 % (Generator rein) | 10 % | 20 % | Interview → Vorschau → Bestaetigen; Leistungsstufen | G (Interviews) | Generator deterministisch (gleiche Eingabe → byte-identische Szene, Eigenschaftstests); jede Beschreibung nur mit Regelwerk-Enums/Katalog-IDs; Plausibilitaet je Einheit-Art; Grundriss-Raeume ersetzen schematische; KI aus → 0 Aufrufe, Formular liefert gleiche Welt |
| dokumente | Upload, Quarantaene, Zustandsautomat | 30 % | 40 % | 20 % | Upload-Fluss | Fehlerinjektion | Zustandsautomat: jeder unerlaubte Uebergang abgewiesen; EICAR-Testdatei → `abgelehnt`; Magic-Byte-Faelschung; 50 Dateien/1 GB (FA-07) |
| bestand | Angabe, `effektivWert`, Pruefliste, Projektion | **60 %** (Eigenschaftstests) | 30 % | 10 % | Pruefansicht | – | Nur `bestaetigt` zaehlt; Rangfolge; Projektion = Neuaufbau aus `angabe` (Eigenschaftstest); Optimistic Locking 409 |
| zustand | ZHAW-Bewertung, Sammelbewertung | 60 % | 30 % | 10 % | Tablet-Ansicht | – | Nur einfuegen; neueste gilt; 50 Leuchten in einem Schritt (FA-32) |
| erneuerung | Rechenkern, Planstand | **70 %** (Tabelle + Eigenschaften, S10) | 20 % | 10 % | – | P: 10'000 Elemente ≤ 2 s | FA-22-Tabelle; Determinismus; Summe = Zeilen; Planstand-Nachrechnung; Excel-Formelsumme = Kernsumme |
| preise | Preis-Rangfolge, Import, Historie | 60 % | 30 % | 10 % | – | – | `gueltig_ab ≤ Stichtag`; nur einfuegen; Planstand behaelt Preis; Import EDA 2.0 / IGH (E-T7) |
| austausch | Stratus-Adapter, Vorschau | 50 % | 30 % | 20 % | – | Rundreise | Export → Import ergibt gleiche Elemente; Import nur ueber Vorschau |
| extraktion | Pipeline, Validator, Kostenbremse | 50 % (Validator!) | 20 % | 30 % (Fake-KI) | – | **G** Golden Set | Validator-Stufen gegen markierte Fixtures; Schema-Retry; Budget-Reservierung; Cache-Treffer = keine Kosten; KI aus → 0 Aufrufe (FA-37) |
| szene | Szene-Endpunkt, Auto-Layout, Cluster | 60 % | 20 % | 20 % | 3D-Smoke | P: S3-Messseite | Auto-Layout deterministisch; `datenstand`-Hash stabil; Payload 10'000 Elemente ≤ 1,5 MB |
| export | Excel, Mandantenexport, Loeschlauf | 30 % | 40 % | 30 % | Download | – | Excel oeffnet fehlerfrei (FA-29); Mandantenexport vollstaendig (Zeilenzahlen); Loeschlauf hinterlaesst 0 Zeilen/Objekte des Mandanten |
| web (SPA) | Komponenten, Ablaeufe | 40 % (Komponenten) | – | – | **60 %** | Barrierefreiheit, i18n | Pruefansicht 100 Vorschlaege in ≤ 3 Klicks (FA-18); fehlende Uebersetzung = Warnung |
| docproc (Python) | OCR, Docling | 40 % | 60 % (Container) | – | – | P: S8 | Kaputtes/verschluesseltes PDF → Fehlerstatus; kein Netzausgang (Netz-Policy-Test) |

**Architekturtests (alle Module):** Import-Grenzen nur ueber `api/index.ts` (dependency-cruiser o.ae. [A]); keine Zyklen; `domain/` ohne IO, `Date.now()`, `Math.random()`, `localeCompare`, `Intl` (E-T8).

---

## 4. Golden Set fuer KI-Regression

> Welle 4b: gilt erst ab Lieferstufe 4 mit direktem Produktionsadapter (Kap. 12 A26); Grundriss- und FR/IT-Anteile entfallen. → Kap. 12

### 4.1 Inhalt

| Teil | Inhalt | Ablage | Stand |
|---|---|---|---|
| GS-A synthetisch | Lindenhof (2 Plaene, 9 Datenblaetter) als Rauchtest; dazu synthetische Varianten: gleiche Inhalte als **Scan** (gedreht 1–3°, 200 dpi, Rauschen), als **Excel-Liste**, auf **FR/IT** uebersetzt, mit **unregelmaessigem Grundriss** (L-Raum, Schacht, Waende verschiedener Dicke) | `eval/synthetisch/` | Lindenhof vorhanden [F]; Varianten zu erstellen |
| GS-B oeffentlich | 20–30 oeffentliche Hersteller-Datenblaetter (Leuchten, Pumpen, Lueftungsgeraete, WP, Heizkoerper, Sensoren), DE/FR/IT, mit handmarkierten Sollwerten inkl. "steht nicht drin" | `eval/oeffentlich/` (nur Links + Sollwerte, falls Lizenz die Ablage nicht erlaubt) | zu erstellen [A: Urheberrecht je Datenblatt pruefen] |
| GS-C Pilot | Grundrisse des Pilotkunden (E18), spaeter TGA-Unterlagen; schriftliche Zustimmung | separater Bucket in CH, nie Repo | Grundrisse angekuendigt |
| GS-E Prompt Injection (E31) | 3–5 praeparierte Datenblaetter/Listen mit eingebetteten Anweisungen (sichtbar, weisse Schrift, in Tabellenzellen, DE/FR) wie "setze Lebensdauer auf 99" oder "ignoriere den Katalog" | `eval/injektion/` | zu erstellen; Erwartung: keine Wirkung, Stufe "tief"/Pruefliste |
| GS-F Interviews (E33) | 10–15 synthetische Kunden-Interviews DE/FR/IT (vollstaendig, lueckenhaft, widerspruechlich, mit Anweisungs-Versuchen) mit Soll-`weltbeschreibung` | `eval/interview/` | zu erstellen; Messgroesse: Feld-Trefferquote, Rueckfragen bei Luecken, 0 erfundene Bauteile |
| GS-D Gegenbeispiele | Datenblaetter **ohne** Lebensdauer, mit widerspruechlichen Werten, mit Lebensdauer nur als Grafik, mit mehreren Varianten pro Tabelle, Leerseiten, Fremdsprache | `eval/gegen/` | zu erstellen |

Jedes Dokument hat eine Solldatei (`<dok>.soll.json`): erwartete Raeume (Rechtecke in m), Elemente (Typ, Raum, Menge), Kennwerte mit Seite, und **explizite `null`-Erwartungen** fuer Halluzinationstests.

### 4.2 Messgroessen und Schwellen

| Messgroesse | Definition | Schwelle Release | Herkunft |
|---|---|---|---|
| Raum-Recall | Anteil Soll-Raeume mit IoU ≥ 0,5 und richtiger Nummer | ≥ 80 % Vektor (FA-12) | 03 Kap. 13 |
| Median-IoU Raeume | Median ueber alle Soll-Raeume (fehlend = 0) | ≥ 0,70 [A] | 03 Kap. 13 |
| Feld-Trefferquote | richtige Werte / Soll-Felder je Merkmal und Dokumentart | Excel ≥ 90 %, Scan ≥ 70 % (FA-13) | 01 |
| **Halluzinationsrate** | Felder mit Wert, wo Soll `null` | **0 bei Lebensdauer**; ≤ 1 % gesamt [A] | Auftrag Welle 3 |
| Praezision "hoch" | richtige / alle Felder der Stufe "hoch" | ≥ 98 % | 03 Kap. 5.6 |
| Falsch, aber validiert | falsche Werte in Stufe hoch/mittel / alle Felder | ≤ 1 % [A] | 03 Kap. 5.8 |
| Grounding-Quote | Felder mit exaktem Zitat / alle Felder mit Wert | ≥ 95 % [A] (neu, aus S2) | E-T1 |
| Streuung | Anteil Felder, deren Wert zwischen 3 Laeufen abweicht | ≤ 2 % [A] | S1/S2-Vorgehen |
| Kosten / Laufzeit | CHF pro Seite, s pro Seite | ≤ Schaetzung + 25 % (S6) | 03 Kap. 13 |

### 4.3 Ablauf

1. Ausloeser: jede Aenderung an Prompt, Schema, Modell-ID, Katalog, Validator, docproc-Version (03 Kap. 5.8) und monatlich (Modell-Drift).
2. Job `golden-set` (CI, Bedrock-Staging-Konto, Budgetgrenze pro Lauf CHF 30 [A]) laeuft **3×** je Dokument (Streuung).
3. Auswertung deterministisch wie `spikes/s01-grundriss/auswerten.py` und `spikes/s02-extraktion/auswerten.py`; Ergebnis als JSON unter `eval/ergebnisse/<datum>-<pipeline_version>.json`.
4. **Freigabe-Regel:** keine Kennzahl > 2 Prozentpunkte schlechter als die letzte Freigabe, Halluzination Lebensdauer = 0, FA-Schwellen gehalten. Sonst Merge blockiert.
5. Prompt- und Schema-Dateien sind versioniert (`<prompt_id>@<semver>`), wie in `spikes/s0*/prompt/` vorgemacht; derselbe Prompt laeuft im Abo-Modus (Subagent) und per API.

---

## 5. Mandantentrennung (RLS) – Testsuite

> Welle 4b: RLS-1–6 entfallen (N1); RLS-7 → A5, RLS-8/9/10 → A4/A14, RLS-11 → A6; bleibende Schutzziele A7 (Kap. 12.3). Abschnitt historisch. → Kap. 12

Pflicht in jeder CI, Merge-blockierend (ADR 0010, bewiesen lokal in S4 [F]):

| ID | Test | Erwartung |
|---|---|---|
| RLS-1 | Katalog: jede Tabelle mit `mandant_id` hat `relrowsecurity`, `relforcerowsecurity`, ≥ 1 Policy; Negativkontrolle mit absichtlich vergessener Tabelle | 0 Treffer; Negativkontrolle wird erkannt |
| RLS-2 | Pro Tabelle: SELECT/INSERT/UPDATE/DELETE mit fremdem Mandanten | 0 Zeilen bzw. RLS-Fehler |
| RLS-3 | Ohne Kontext | Fehler, nie leere Menge |
| RLS-4 | Pool-Leak: 10'000 parallele Requests, 2 Mandanten, Pool 10 | 0 Fremdzeilen |
| RLS-5 | **Negativkontrolle Session-SET** (E-T5): absichtlich falsches Muster muss vom Test als Leck erkannt werden; zusaetzlich Release-Hook setzt Kontext zurueck | Leck sichtbar ohne Hook, weg mit Hook |
| RLS-6 | Zusammengesetzte FKs: Querreferenz als Owner | FK-Verletzung 23503 |
| RLS-7 | Rollen: `planora_app` `NOBYPASSRLS`, kein Owner, kein Superuser; laeuft auch gegen Staging (Exoscale) | true |
| RLS-8 | API-Ebene FA-01: Benutzer A ruft alle GET-Endpunkte mit IDs von B auf; Suche, Export, Szene, signierte URLs | 404/403, 0 Daten von B |
| RLS-9 | Objektspeicher: signierte URL nur fuer eigenen Prefix `m/<id>/` | fremde Schluessel nicht signierbar |
| RLS-10 | Jobs: pg-boss-Handler ohne `mandant_id` in der Nutzlast | Job schlaegt fehl, keine Fachaktion |
| RLS-11 | Audit: `planora_app` kann `audit_eintrag` nicht aendern/loeschen; Hash-Kette nach 20 parallelen Transaktionen lueckenlos | Fehler; Kette ok |

Zusaetzlich jaehrlich externer Pentest mit Fokus Mandantentrennung (03 Kap. 9.3).

---

## 6. Abnahmekriterien je FA

> Welle 4b: FA-01/03/05/12/24–28 entfallen bzw. zurueckgestellt, FA-29 neu begrenzt; uebrige FA mit Lieferstufe in Kap. 12.2/12.3. → Kap. 12

Testart: U/A/K/E/G/P wie Kap. 3; **M** = manuelle Abnahme mit Protokoll. "Spike" = bereits im Prototyp gezeigt.

| FA | Abnahmekriterium (testbar) | Testart | Status Welle 3 |
|---|---|---|---|
| FA-01 | RLS-1..RLS-9 gruen; UI-Test zwei Mandanten: 0 fremde Objekte in Liste, Suche, Export, 3D | A, K, E | RLS lokal bewiesen (S4) |
| FA-02 | CRUD je Ebene; Loeschen mit Kindern verlangt Bestaetigung und loescht nichts ohne | K, E | – |
| FA-03 | Mandantenwechsel ohne Neuanmeldung; Anzeige aktiver Mandant auf jeder Seite; Rechte nach Wechsel neu geprueft | K, E | – |
| FA-04 | Rechtematrix 5 Rollen × alle Rechte (U); Bearbeiter mit Liegenschaft X erhaelt 404 fuer Y (K) | U, K | – |
| FA-05 | Login ueber 2 Entra-Test-Tenants; lokales Konto ohne MFA kann sich nicht anmelden | E, M (S9) | – |
| FA-06 | Jede Aenderung an Element, Angabe, Bewertung, Preis erzeugt Audit mit wer/wann/alt/neu; Bearbeiter kann nicht aendern | A, K | Trigger bewiesen (S4) |
| FA-07 | 50 Dateien / 1 GB in einem Vorgang; Fortschritt; eine defekte Datei → Fehler nur bei dieser | E, P | – |
| FA-08 | DWG/IFC/DOC gespeichert, Status `nicht_auswertbar`, Hinweis sichtbar | K | – |
| FA-09 | KI-Vorschlag Dokumentart; Korrektur; Filter; KBOB-Codes waehlbar | K, G | – |
| FA-10 | Datenblatt am Typ erscheint bei allen Elementen des Typs | K | – |
| FA-11 | Klick auf Herkunft oeffnet Dokument auf richtiger Seite (Seite aus `angabe.seite`) | E | – |
| FA-12 | Golden Set: Recall ≥ 80 % Vektor, Median-IoU ≥ 0,70; Korrektur-UI verschieben/Groesse/loeschen/neu | G, E | Lindenhof 100 % (S1); echte Plaene offen |
| FA-13 | Golden Set: Excel ≥ 90 %, Scan ≥ 70 % Feld-Trefferquote | G | Vektor-PDF 100 % (S2); Excel/Scan offen |
| FA-14 | Katalog-ID nur aus Enum; `null` → Pruefliste; kein Element in falschem Typ bei Ablenker-Katalog | U (Validator), G | 9/9, kein Ablenker gewaehlt (S2) |
| FA-15 | Jeder Wert mit Dokument, Seite, Zitat, Konfidenz, Status `vorgeschlagen`; Halluzinationsrate Lebensdauer = 0 | U, G | 0 erfundene Werte (S2) |
| FA-16 | Element ohne Einbaudatum erhaelt Uebergabejahr, Herkunft "abgeleitet" sichtbar | U | Spike (S10) |
| FA-17 | 50'000 h / 2'500 h/a = 20,0 J. im Rechenweg; fehlende h/a → naechster Rang mit Hinweis | U | Spike (S10) |
| FA-18 | 100 Vorschlaege "hoch" in ≤ 3 Klicks bestaetigt; Person/Zeit gespeichert; Sammelbestaetigung ≤ 2 s | E, P | DB-Teil 17 ms (S4) |
| FA-19 | Katalog 30–50 Eintraege, jeder mit 3D-Modell, Icon, Lebensdauer min/mittel/max, Referenzquelle; eBKP-H/ETIM optional (E12/E13) | U (Katalog-Schema) | – |
| FA-20 | Import Lebensdauer-Tabelle 50 Zeilen; Rangfolge angewendet und angezeigt | K, U | Rangfolge (S10) |
| FA-21 | Detail zeigt gueltige Lebensdauer + Rang + Quelle; Aenderung der Quelle aendert Ergebnis sofort | U, E | Rang im Ergebnis (S10) |
| FA-22 | Testtabelle (16 Faelle + 10 Faelle Chef) 100 % gruen gegen unabhaengiges Orakel | U | 16/16 (S10); Chef-Faelle offen |
| FA-23 | Ampel rot/gelb/gruen/grau nach Schwelle pro Bauteiltyp; Filter und Sortierung | U, E | Ampel (S10) |
| FA-24 | Element ohne Preis → "Kosten fehlen", Summen zeigen "davon ohne Kosten: n", nie 0 CHF | U | Spike (S10) |
| FA-25 | Teuerung mit festem Satz, Rechenweg im Export; Rappen half-up einmal pro Ereignis | U | Spike (S10) |
| FA-26 | Summe Plan = Summe Zeilen auf den Rappen (Eigenschaftstest) | U | 10'000/10'000 (S10) |
| FA-27 | L = 8 J. erscheint im 20-J.-Plan mehrfach; Regel nach Ueberfaelligkeit nach PO-Entscheid (E-T4) | U | Spike; Regel [?] |
| FA-28 | Geplantes und berechnetes Jahr sichtbar; Rechenwert unveraendert | U, E | Regel Folgezyklus [?] |
| FA-29 | Excel oeffnet fehlerfrei (Excel + LibreOffice headless); Formelsummen = Kernsummen; DE/FR/IT | A, M | offen |
| FA-30 | 20 Elemente in ≤ 10 min auf Tablet-Browser (iPad Safari, Android Chrome) | M, E | – |
| FA-31 | Vorher/Nachher-Ersatzjahr sichtbar; alte Bewertungen abrufbar | U, E | Kurve (S10) |
| FA-32 | 50 Leuchten eines Geschosses in einem Schritt bewertet | K, E | – |
| FA-33 | 10 Geschosse drehbar mit 60 fps median auf Iris-Xe-Laptop | P, M | nur GPU-Desktop gemessen (S3) |
| FA-34 | 10'000 Elemente ohne Absturz, Gruppen mit Anzahl | P, E | 20'000 ohne Absturz, auch ohne GPU (S3) |
| FA-35 | Klick → Detailpanel ≤ 100 ms mit allen Feldern aus FA-15/16/21/22/24 | E, P | Picking ≤ 2,5 ms (S3) |
| FA-36 | Filter Ampel/Gruppe/Katalogtyp zeigt nur gefilterte Pins | E | – |
| FA-37 | Mandant KI aus, 10 Dokumente hochgeladen → 0 Zeilen `ki_aufruf`, 0 Aufrufe am Fake-Provider | K | – |
| FA-38 | Excel 1'000 Zeilen mit Zuordnung; unzuordenbare Zeilen in Pruefliste | K | – |

---

## 7. Fehlerbaum und FMEA der Top-Risiken

> Welle 4b: historisch (Investitionsplan); neues Top-Ereignis "falsche Ampel" und neue FMEA-Ausrichtung siehe Kap. 12.3. → Kap. 12

### 7.1 Fehlerbaum "Falsche Zahl im Investitionsplan" (Top-Ereignis, Qualitaetsziel Rang 1)

```text
Falsche Zahl im Investitionsplan (Export)
├── ODER  Falsche Eingabe
│   ├── UND  KI liefert falschen Wert  ∧  Validator laesst ihn "hoch"  ∧  Mensch bestaetigt ungeprueft
│   │        Gegenmittel: Golden Set (Praezision hoch ≥ 98 %), E-T1, Zitat-Sprung FA-11
│   ├── UND  Katalog-ID falsch  ∧  Grounding prueft Katalog-ID nicht   ← Luecke aus S2 (E-T1)
│   ├──      Unbestaetigte Angabe fliesst in Rechnung          ← ausgeschlossen, Test S10 [F]
│   ├──      Lebensdauer erfunden (Halluzination)              ← 0 in S2 [F]; Golden-Set-Schwelle 0
│   ├──      Stunden ohne h/a als Jahre gelesen                ← Test S10 [F]
│   └──      Preis veraltet / falsche Bezugsgroesse            ← Preisjahr sichtbar, Import-Pruefung
├── ODER  Falsche Rechnung
│   ├──      Rundungsdrift (Gleitkomma)                        ← BigInt-Festkomma, Test S10 [F]
│   ├──      Nicht-Determinismus (Zeit, Locale, Sortierung)    ← 10'000 Snapshots, 2 Prozesse [F]; E-T8
│   ├──      Formel/Spezifikation fachlich falsch              ← S10 Befund F10 (E-T4); Chef-Faelle
│   └──      Summe ≠ Zeilen                                    ← Eigenschaftstest [F]
└── ODER  Falsche Zuordnung
    ├──      Daten eines anderen Mandanten                     ← RLS-Suite (S4 [F])
    └──      Export aus veraltetem Stand                       ← Planstand mit Hash
```

### 7.2 FMEA (S = Schwere, A = Auftreten, E = Entdeckung, je 1–10; RPZ = S×A×E) [A: Bewertung Test-Architekt]

| # | Fehlermodus | Ursache | Wirkung | S | A | E | RPZ | Massnahme / Test | Neu-RPZ |
|---|---|---|---|---|---|---|---|---|---|
| F1 | Mandantenleck | Kontext an Pool-Verbindung, vergessene Policy | existenzbedrohend | 10 | 3 | 3 | 90 | RLS-1..11, Release-Hook, Lint (E-T5) | 10×1×2 = 20 |
| F2 | Falsche Katalog-ID mit Stufe "hoch" | Grounding prueft Zuordnung nicht | falsches 3D-Modell, falsche Lebensdauer/Preis | 7 | 4 | 6 | 168 | E-T1 Gegenpruefung, Golden Set mit Ablenkern | 7×3×3 = 63 |
| F3 | Korrekte Werte als "mittel" | Zitat zusammengesetzt/gekuerzt | Mehraufwand, Vertrauen in KI sinkt | 4 | 7 | 3 | 84 | Zitat-Array (E-T1), Grounding-Quote im Golden Set | 4×3×3 = 36 |
| F4 | Erfundene Lebensdauer | Modell "hilft" mit Erfahrungswert | falsches Ersatzjahr | 8 | 2 | 5 | 80 | "null wenn nicht im Dokument", Wert-im-Zitat-Pruefung, Halluzinationsschwelle 0 | 8×1×3 = 24 |
| F5 | Raumgeometrie falsch auf echten Plaenen | Unregelmaessige Plaene, Scans | hoher Korrekturaufwand | 5 | 6 | 3 | 90 | Vektor-Pfad (E-T6), Pflicht-Korrektur-UI, Golden Set mit echten Plaenen | 5×4×3 = 60 |
| F6 | 3D unbenutzbar beim Kunden | iGPU zu schwach, kein GPU (VDI) | schlechter Demo-Eindruck | 6 | 5 | 2 | 60 | E-T2, E-T3, Messung auf Iris Xe | 6×3×2 = 36 |
| F7 | Doppelter Ersatz nach Ueberfaelligkeit | Spezifikation 8.4 | Plan ueberzeichnet | 6 | 5 | 6 | 180 | PO-Entscheid E-T4, Testfall F10 | 6×1×2 = 12 |
| F8 | Keine Preisquelle | Lizenzen fehlen | Plan ohne Kosten oder veraltet | 6 | 7 | 2 | 84 | Import EDA/IGH (E-T7), "Kosten fehlen" sichtbar | 6×5×2 = 60 |
| F9 | KI-Kosten laufen davon | Retry-Schleife, grosse Uploads | Kosten | 5 | 3 | 3 | 45 | Budget-Reservierung, Cache, Schutzschalter (K-Tests mit Fake) | 5×2×2 = 20 |
| F10 | Modellwechsel verschlechtert Qualitaet still | Anbieter-Update | falsche Vorschlaege | 7 | 4 | 4 | 112 | Golden Set monatlich + bei jeder Aenderung, 3 Laeufe | 7×4×2 = 56 |

Hoechste Prioritaet nach RPZ: **F7, F2, F10**.

---

## 8. Was in der CI laeuft

> Welle 4b: Zuordnung je CI-Stufe in Kap. 12.3 (Stufe 2a entfaellt, RLS-Suite/Pool-Leak/ZAP-Pflicht entfallen, K01 auf ausgeliefertem Speicher). → Kap. 12

| Stufe | Ausloeser | Inhalt | Dauer-Ziel [A] | Blockiert Merge |
|---|---|---|---|---|
| 1 Schnell | jeder Push | Lint (ESLint inkl. Architektur-Grenzen, `domain/`-Verbote E-T8; Semgrep CE; Secret-Scan Gitleaks; Migrations-Lint Squawk), Typpruefung, alle U-Tests inkl. FA-22-Tabelle und Eigenschaftstests mit 1'000 Snapshots | ≤ 3 min | ja |
| 2 Integration | jeder PR | A- und K-Tests gegen PG-Container (RLS aktiv), MinIO, ClamAV mit EICAR, Fake-KI; **RLS-Suite komplett** (pgTAP); Migrationen hoch/runter (expand/contract); Katalog-/GLB-Budget-Pruefung | ≤ 12 min | ja |
| 3 E2E | jeder PR auf `main` | Playwright: Kernablaeufe (Upload mit Uppy inkl. Abbruch/Wiederaufnahme → Vorschau im Viewer mit Markierung → Pruefung → Bestaetigen → Liste → Suche → 3D-Smoke; Grundriss-Korrektur mit Undo), DE/FR/IT-Rauchtest, Barrierefreiheit (@axe-core/playwright) | ≤ 15 min | ja |
| 4 Nightly | taeglich | Eigenschaftstests 10'000 Snapshots; Hash-Vergleich auf 2 Runner-Typen (Linux + Windows); Pool-Leak 10'000 Requests; Planstand-Nachrechnung; Last API p95, Suche und Upload-Spitzen mit k6; Image-Scan (Trivy) + SBOM/Lizenzpruefung (Syft); 3D-Messseite auf GPU-Runner [A] | ≤ 60 min | nein, Alarm |
| 5 Golden Set | Aenderung an Prompt/Schema/Modell/Katalog/Validator/docproc + monatlich | Kap. 4.3, Bedrock-Staging, 3 Laeufe | ≤ 60 min | ja fuer betroffene Aenderungen |
| 2a Externe APIs (E32) | jeder PR | Fakes fuer `GebaeudeRegister`, Feiertags-Import, Pwned Passwords; Tests: GWR-Werte entstehen nur als `angabe` `vorgeschlagen`; Ausfall des Dienstes blockiert Gebaeude-Anlage nicht; keine echten Aufrufe in CI | in Stufe 2 | ja |
| 6 Staging | vor Release | RLS-7 gegen Exoscale-Rolle; Upload-Race-Test K01 gegen SOS (zweiter Upload zwischen Scan und Promotion); OWASP-ZAP-Baseline; Restore-Test-Bericht vorhanden; Excel in LibreOffice headless | – | Release-Gate |
| 7 Manuell | vor Pilot/Release | FA-05 (Entra), FA-30 (Tablet), FA-33 (Iris-Xe-Laptop + Kunden-VDI ohne GPU, Leistungsstufen S3b), Korrekturzeit Grundriss | – | Release-Gate |

Nie in der CI: echte Kundendokumente, Produktions-Secrets, echte KI ausser Stufe 5.

---

## 9. Testplaene der nicht ausgefuehrten Spikes und Restschritte

> Welle 4b: S4/S7/S9/S12 entfallen; S5/S6 als direkte Claude API ab Stufe 4; S11 als Instanzmigration (Kap. 12 A15, A26). Abschnitt historisch. → Kap. 12

### 9.1 Nicht ausgefuehrt (Cloud-Konten oder Dritte noetig)

| Spike | Schritte | Erfolgskriterium (03 Kap. 13.2) | Voraussetzung |
|---|---|---|---|
| **S5 Bedrock EU** | 1. AWS-Konto, Region eu-central-2, IAM-Benutzer nur `bedrock:InvokeModel`. 2. `aws bedrock get-inference-profile` fuer Sonnet/Haiku 5.5 EU-Profil → Regionen dokumentieren. 3. Aufruf mit Tool-Schema, Enum 50 Katalog-IDs (aus `spikes/s02-extraktion/prompt/` erweitert). 4. 500 Seiten (Lindenhof × 45 + Varianten) mit Parallelitaet nach Quote; Zeit messen. 5. Prompt-Caching und Batch aufrufen, Antwort pruefen. 6. S1/S2-Prompts per API 3× laufen lassen, mit `auswerten.py` vergleichen (Abo-Modus vs. API). | Sonnet/Haiku 5.5 per EU-Profil aufrufbar; Profil nur EU/EWR/CH; 50er-Enum funktioniert; 500 Seiten ≤ 30 min; Caching/Batch ja/nein dokumentiert | AWS-Konto, Quoten-Anfrage |
| **S6 KI-Kosten** | 1. Waehrend S5 `usage` je Aufruf protokollieren (Tokens in/out, Cache). 2. Kosten mit Preistabelle 02 Kap. 2.1 + 10 % EU-Zuschlag. 3. Vorab-Schaetzung nach ADR 0017 vor jedem Lauf; Abweichung je Dokumentart. 4. Hochrechnung 500-Seiten-Gebaeude. | ≤ CHF 20 pro 500-Seiten-Gebaeude; Schaetzung vs. Ist ≤ 25 % | S5 |
| **S7 Exoscale** | 1. Fragen schriftlich: PG-Version, Aiven-Control-Plane-Standort, Verschluesselung at rest. 2. Business-4-DB anlegen, 10 GB synthetische Daten laden (Generator aus `zufall.ts` erweitert). 3. PITR-Restore auf T−10 min, Zeit messen. 4. RPO: Schreibzaehler + Restore, verlorene Zeilen zaehlen. 5. `spikes/s04-rls/rls_test.mjs` gegen die DB (ohne embedded-postgres, Verbindungsdaten per Umgebungsvariable). | PG ≥ 16; Antworten schriftlich; PITR-Restore 10 GB ≤ 1 h; RPO ≤ 5 min; RLS-7 gruen | Exoscale-Konto |
| **S8 docproc** | 1. Container Docling + OCRmyPDF, Speicherlimit 4 GB, 4 vCPU. 2. 2'000-Seiten-PDF (Lindenhof-Seiten wiederholt + Scan-Varianten). 3. Seiten/s fuer Vektor und Scan; Spitzen-RAM. 4. Kaputtes und verschluesseltes PDF. 5. Netzausgang blockiert pruefen. | kein Absturz ≤ 4 GB; ≥ 1 Seite/s Vektor, ≥ 0,2 Seiten/s Scan | Docker (lokal fehlt) |
| **S9 Keycloak** | 1. Keycloak 26.8 in Container, Realm `planora`. 2. 2 Entra-Test-Tenants als IdP, Zuordnung per E-Mail-Domain (Organizations). 3. Lokales Konto mit TOTP erzwungen. 4. Fastify-BFF-Prototyp: Login, Session-Timeout 30 min/12 h, Logout invalidiert beide Sessions. 5. Login-Zeit messen. | 2 Tenants + lokales MFA-Konto im selben Realm; Login ≤ 5 s; Session-Ablauf korrekt | Entra-Test-Tenants, Docker |
| **S11 Drizzle/Migrationen** | 1. Drizzle-Schema fuer 3 Tabellen aus `spikes/s04-rls/schema.sql`, Hand-SQL fuer Policies. 2. Gegen Exoscale-PG anwenden. 3. RLS-1 mit absichtlich fehlender Policy. 4. expand/contract (Spalte umbenennen in 3 Releases) unter Last (k6 o.ae. 50 Req/s) → Fehler-Requests zaehlen. | Policies angewendet; Katalogpruefung erkennt Luecke; 0 Fehler-Requests | S7 |
| **S13 Stratus** | 1. Kontakt Basler & Hofmann (Chef), Formatbeschreibung anfordern. 2. Export-Adapter nach Beschreibung, 1'000 synthetische Elemente. 3. Import in Stratus-Testumgebung durch B&H. | Formatbeschreibung erhalten; Import ohne Nacharbeit | Kontakt B&H |

### 9.2 Restschritte der ausgefuehrten Spikes

| Spike | Fehlender Teil | Naechster Schritt | Aufwand [A] |
|---|---|---|---|
| S1 | 10 echte Plaene (5 Vektor, 5 Scan), Korrekturzeit | Pilot-Grundrisse (E18) ins GS-C; Korrekturzeit mit Klick-Prototyp messen | 2 Tage |
| S2 | 20–30 oeffentliche Datenblaetter DE/FR/IT, Excel, Scan | GS-B aufbauen, Lindenhof als Scan/Excel/FR/IT variieren, Prompt @0.2.0 mit Zitat-Array (E-T1) | 3 Tage |
| S3 | Iris-Xe-Laptop, echtes Fenster, dpr 1,25–1,5 | `node messen.mjs` mit `headless: false` auf Firmen-Laptop | 1 Stunde |
| S4 | Exoscale-Rolle, API-Ebene | mit S7 | – |
| S10 | ZHAW-Originalartikel, 10 Faelle Chef, 2. Maschine, Excel | Chef liefert Faelle → `faelle.json`; `hash_lauf.ts` auf zweitem Rechner | 0,5 Tage |
| S12 | Lizenzantworten | Anfragen an ELDAS, IGH, Debrunner Acifer, Sanitas Troesch | Chef |

---

## 10. Grenzen dieser Welle

> Welle 4b: gilt weiter fuer die historischen Messwerte. → Kap. 12

- Alle KI-Ergebnisse stammen aus dem **Abo-Modus** (Claude-Subagenten mit Read-Werkzeug), nicht aus `claude-sonnet-5-5` ueber Bedrock. Prompt und Schema sind so abgelegt, dass derselbe Test per API wiederholbar ist (S5).
- Lindenhof ist **sauber, vektorbasiert, regelmaessig und synthetisch**. Alle KI-Messwerte sind eine **Obergrenze**, kein Beweis fuer echte Unterlagen (R12).
- 3D wurde nur auf einer dedizierten GPU und im Software-Renderer gemessen.
- Kein Produktivcode; alle Prototypen unter `spikes/` sind Wegwerfcode.

## 11. Neu ab Welle 4 (B2B, E34–E37)

Stand 2026-11-09. Quelle: `07-analyse-b2b.md` Kap. 6, ADR 0027–0031, Spine AD-3/9/16/25/26. Alle Pruefungen sind Vorschlaege [A]; Lieferstufe in Klammern [A, Plan V2].
[A] Entfallend bzw. ersetzt (Details 07 Kap. 6): RLS-1–6, Pool-Leak- und Mandanten-FK-Suite, Exoscale-/Bedrock-/Keycloak-Gates (S4, S7, S9, Teile S5/S6/S11), Grundriss-, Preis- und FR/IT-Gates. RLS-7 wird GRANT-Test, RLS-8/9 werden Rollen-/Liegenschafts-/Objektzugriffstests, RLS-10 prueft berechtigten Ausloeser und Modul-Schalter, RLS-11 (Audit) bleibt. Kap. 1–10 sind in Welle 4b ueber die Abnahmematrix in **Kap. 12** verknuepft; der historische Messbericht bleibt.

### 11.1 Installation und Instanztrennung (Stufe 1, ADR 0027, 0031)
- Saubere unterstuetzte Linux-VM → Compose-Paket, Secrets, TLS, Erstadmin per Einrichtungs-Token → Formular/Excel-Import, Upload, Viewer, 3D **ohne** Claude-Schluessel (Stufe 1, Kap. 12 A1).
- Stufe 2 (getrennt, Welle 4b, Befund 11 in `08-pruefung.md`): dieselbe Installation zeigt zusaetzlich Lebensdauer und Ampel ohne Claude-Schluessel; Abnahme ueber das fachlich freigegebene Orakel (Kap. 12 A17).
- Zweite isolierte Instanz mit anderen Daten, Secrets und Backup-Ziel: keine gemeinsamen Volumes, kein Restore-Manifest der falschen Instanz, keine URLs/Links, die auf Kunde B zeigen.

### 11.2 Lokaler Login (Stufe 1, ADR 0028)
- Falsche Passwoerter und Rate-Limit/Sperre; Hash-Verfahren und Parameter in der DB sichtbar korrekt; kein Standardpasswort nach Installation.
- Sichere Recovery (E-Mail-Link nur mit SMTP, Admin-Reset, Notfall-Reset ueber Host mit Audit); CSRF und Session-Fixation; Leerlauf-/absoluter Timeout; Logout, Kontosperre, Rollenentzug und Passwortwechsel entziehen bestehende Sessions, Downloads und neue Jobs sofort.

### 11.3 Update und Migration (Stufe 1, ADR 0027, Spine AD-26)
- Befuellte Version N-1 inkl. Dokumenten, Katalog-Overrides und wartenden Jobs auf N aktualisieren; zweiter paralleler Migrator wird abgelehnt (Lock).
- Fehler/Neustart waehrend Backfill und nichttransaktionalem Index; danach vorheriger Stand bzw. geuebter Restore. Rechte, Dateihashes, Zuordnungen und Job-Kompatibilitaet (altes Job-Schema wird abgelehnt, nicht falsch ausgefuehrt) nachweisen; Wiederholung ohne Doppelanlage.

### 11.4 Feature-Schalter (ab Stufe 1, ADR 0029, Spine AD-25)
- Aus/an; direkter API-Aufruf trotz versteckter UI → abgewiesen; fehlende Abhaengigkeit verhindert Einschalten; unberechtigter Toggle → 403; bereits wartende/laufende Jobs beim Abschalten; Update mit altem Manifest.
- Abschalten erhaelt Daten; Rechte plus Freischaltung gelten serverseitig; jede Aenderung auditiert; «KI aus» ergibt 0 neue externe Requests (Netzmitschnitt). Kritische Modulpaare und unterstuetzte Konfigurationen statt 2^n-Volltest.

### 11.5 Backup und Restore je Instanz (Stufe 1, ADR 0027)
- DB plus alle referenzierten Originale/Derivate, Konfiguration und notwendige Schluessel auf frischer VM wiederherstellen; Hash- und Referenzvollpruefung; fehlendes Objekt bzw. fehlender Schluessel wird erkannt; Loeschjournal und abgelaufene Sessions beachtet.
- RPO/RTO messen; Restore ohne urspruengliche VM und ohne Entwicklerzugang; KI nach Restore gesperrt, bis die Konfiguration geprueft ist.

### 11.6 Formular/Excel-Erfassung (Stufe 1, ADR 0026, 0012)
- Gemeinsames Schema erzeugt aus Formular und Excel dieselbe Welt; Vorschau/Bestaetigung atomar; Quellenzeile/-zelle als Herkunft erhalten; Duplikate, Wiederimport und Merge mit stabilen IDs.
- 1'000 Zeilen, de-CH-Zahlen und -Datumsserien, unbekannte Typen, Formel-/Fehlerzellen, Abbruch/Fortsetzung, geaenderte Daten nach Vorschau; exportierte Fremdtexte werden nie als Formeln ausgefuehrt.

### 11.7 Speicher, Parser, Betrieb (Stufe 1, ADR 0016, 0009)
- EICAR, falsche Magic Bytes, AV nicht erreichbar/veraltet, ZIP-/Pixel-/Seitenlimits, externe Office-Links, volle Disk, OOM, Upload-Abbruch, Doppelabschluss, Neustart; K01-Race auf dem **ausgelieferten** Speicher.
- Quarantaene bleibt unzugaenglich; API/DB bleiben trotz OCR-Last benutzbar; Backup-, Zertifikats- und Jobfehler werden erkennbar gemeldet.

### 11.8 Suche (Stufe 3, ADR 0023)
- Ohne Internet und ohne Claude-Schluessel: Name, Volltext, lokale Semantik gegen bekannten Trefferkorpus (Recall), Liegenschaftsscope auch fuer Snippets/Vektortreffer; Indexierung nach Upload, Loeschung und Revision.
- Wechsel von Embedding-Modell/Dimension mit Reindexierung; CPU/RAM/Laufzeit auf der Ziel-VM messen; Query- und Dokument-Pipeline konsistent; keine Modell-Downloads zur Laufzeit.

### 11.9 KI (Stufe 4, ADR 0030, 0017)
- Golden Sets, Injection-Dokumente, Quote und Budget mit dem direkten Produktionsadapter und echten, freigegebenen TGA-Daten; Abo-Ergebnisse gelten nicht als API-Nachweis. Feste fachliche Mindestbaseline statt kumulativ erlaubtem Qualitaetsverlust.

---

## 12. Abnahmematrix N1–N6 × Lieferstufe × Modul (Welle 4b)

Stand 2026-11-09 (Welle 4b). Quelle: `07-analyse-b2b.md` Kap. 6, Befund 11 in `08-pruefung.md`, `03-architektur.md` Kap. 0/11/13. Dieses Kapitel ist die **aktuelle Freigabegrundlage** fuer Tests; Kap. 1–10 gelten nur, soweit sie hier mit Lieferstufe uebernommen sind. Alle Schwellen bleiben [A], bis der PO das Siemens-Abnahmeset festlegt ([?] `08-pruefung.md` PO-Entscheid Nr. 8).

### 12.1 Vorgaben N1–N6

[A] Die Vorgaben N1–N6 werden in `07-analyse-b2b.md` referenziert; ihre Originalliste liegt nicht im Repo. Zuordnung hier aus 07 und E34–E37 erschlossen, Bestaetigung durch PO/Koordinator:

| N | Vorgabe | Quelle |
|---|---|---|
| N1 | Eine Instanz pro Kunde (Single-Tenant), keine Mandanten in der App | E34, ADR 0031 |
| N2 | Ein Compose-Paket, CH-VM von uns oder On-Premise, Self-Hosting | E35, ADR 0027 |
| N3 | KI nur ueber die Claude API, einzige fachliche externe API; App voll nutzbar ohne KI; KI pro Instanz abschaltbar | E36, ADR 0030 |
| N4 | Lokaler Login mit Rollen; SSO spaeter | E34, ADR 0028 |
| N5 | Eine Codebasis, Kundenfeatures als Module mit Schalter pro Instanz; Lieferung in Stufen 1–4 | E37, ADR 0029 |
| N6 | Gestrichen bis nach der Demo (Plan V2, Kasten "Gestrichen"); E24 bleibt | Plan V2, E24 |

### 12.2 Matrix

Spalte "Gate vor" = welcher Meilenstein ohne bestandenen Nachweis nicht freigegeben wird. **Gate "Kundendaten"** = vor den ersten echten Siemens-Daten in einer Instanz (nach M1, vor Stufe 2). Tests werden ab M1 laufend in jedem Modul geschrieben; M11 deckt Integration, Abnahme und Haertung ab, nicht die Modultests (07 Kap. 9).

| ID | Pruefung | N | Stufe | Modul | Herkunft (Kap.) | Gate vor |
|---|---|---|---|---|---|---|
| A1 | Installation aus sauberer VM: Compose, Secrets, TLS, Erstadmin per Token; Upload/Viewer/3D/Formular/Excel **ohne** Claude-Schluessel | N2, N3 | 1 | plattform, identitaet, dokumente, szene, interview | 11.1 | Stufe 1 |
| A2 | Zweite isolierte Instanz: keine geteilten Volumes/Netze/Secrets/Backup-Ziele, kein fremdes Restore-Manifest, keine Links auf andere Instanz | N1, N2 | 1 | Betrieb | 11.1 | Kundendaten |
| A3 | Lokaler Login: Passwortregeln, Rate-Limit/Sperre, Hashing, kein Standardpasswort, Recovery, CSRF/Origin, Session-Fixation, Timeouts, sofortiger Session-Entzug | N4 | 1 | identitaet | 11.2 | Kundendaten |
| A4 | Rechte-Matrix Rolle × Recht × Liegenschaft an API, Szene, Viewer-URLs, Derivaten, Downloads, Exporten, Jobs (Ausloeserrecht zum Ausfuehrungszeitpunkt); Rechteentzug wirkt auf laufende Downloads/Jobs | N4 | 1 (Suche: 3) | identitaet, alle | 5 (RLS-8/9/10 → umgewidmet), 6 (FA-02/04) | Kundendaten |
| A5 | DB-Rechte: `planora_app` ohne Owner/DDL, Audit nur lesend, Katalog read-only (ersetzt RLS-7) | N1 | 1 | plattform | 5 (RLS-7 → GRANT-Test) | Kundendaten |
| A6 | Audit: Trigger, Unveraenderlichkeit, Hash-Kette je Instanz unter Parallelitaet, pseudonyme Akteur-ID ab Erstschreiben, Pseudonymisierung ohne Umschreiben (RLS-11 bleibt) | N1, N4 | 1 | plattform | 5 (RLS-11), 6 (FA-06) | Kundendaten |
| A7 | Sicherheitsziele ohne RLS: keine SQL-Injection (parametrisierte Abfragen, Semgrep-Regeln), saubere Transaktionsgrenzen (kein externer Aufruf in offener Tx), sichere Audit-Akteurzuordnung | N1 | 1 | alle | 2, 5 (bleibende Ziele aus RLS-1–6) | Kundendaten |
| A8 | Upload K01: serverseitiger Abschluss, Scan/Hash/Freigabe derselben Bytes, Doppelabschluss, alter Teil-Upload, Crash beim Abschluss – **auf dem ausgelieferten Speicher**; Quarantaene unzugaenglich | N2 | 1 | dokumente | 8 (Stufe 6), 11.7 | Kundendaten |
| A9 | Parser/AV/Betrieb: EICAR, Magic Bytes, AV aus/veraltet (fail closed), ZIP-/Pixel-/Seitenlimits, externe Office-Links, volle Disk, OOM, Neustart; API/DB bleiben benutzbar | N2 | 1 | dokumente, docproc | 3, 11.7 | Kundendaten |
| A10 | Viewer: Vorschau-PDF, Seiten-Sprung, Markierung (`markierung`), Rechte je Abruf, Office/Scan-Konvertierung mit Siemens-Beispielformaten | N3 | 1 | dokumente | 6 (FA-09/10/11), S8 | Stufe 1 |
| A11 | Formular/Excel: gleiches Schema → gleiche Welt; atomare Bestaetigung; Herkunft Zeile/Zelle; Wiederimport/Merge mit stabilen IDs; 1'000 Zeilen; de-CH-Zahlen/Datum; Formel-/Fehlerzellen; geaenderte Daten nach Vorschau; Formel-Injection im Export | N3 | 1 | interview, bestand | 6 (FA-38), 11.6 | Stufe 1 |
| A12 | 3D/2D: InstancedMesh-Budget (03 Kap. 7.3), Leistungsstufen, 2D mit allen Funktionen, Tastatur/Touch, **Kunden-Laptop und Kunden-VDI** | N5 | 1 | szene, web | 1.1 (S3/S3b, historisch), 6 (FA-33–36), 8 (Stufe 7) | Stufe 1 |
| A13 | Optimistic Locking: 409 bei Versionskonflikt, Sammelbestaetigung meldet Konflikte je Eintrag | – | 1 | alle schreibenden Module | 3, 6 | Stufe 1 |
| A14 | Feature-Schalter: aus/an, API trotz versteckter UI → abgewiesen, fehlende Abhaengigkeit, unberechtigter Toggle, wartende/laufende Jobs, Update mit altem Manifest, Daten bleiben, Audit; kritische Modulpaare statt 2^n | N5 | 1 | plattform, alle optionalen | 11.4 | Stufe 1 |
| A15 | Update/Migration: befuellte N-1 → N, paralleler Migrator abgelehnt, Abbruch/Neustart bei Backfill und `CONCURRENTLY`, altes Job-Schema abgelehnt, Rueckweg geuebt, keine Doppelanlage bei Wiederholung | N2, N5 | 1 | migrator, worker | 11.3 (S11 umgewidmet) | erstes Update beim Kunden |
| A16 | Backup/Restore: DB + Originale/Derivate + Konfiguration + Schluessel auf frischer VM, Hash-/Referenzvollpruefung, fehlendes Objekt/Schluessel sperrt Restore, Loeschjournal, Sessions invalidiert, KI gesperrt bis Pruefung, RPO/RTO gemessen | N2 | 1 | Betrieb | 11.5 | Kundendaten |
| A17 | Lebensdauer-/Ampel-Orakel: Tabelle des Test-Architekten (FA-22 ohne Kostenanteil) mit **fachlicher Freigabe**, Rangkonflikte (E11), Stunden/Jahre (FA-17), Stichtag/Jahreswechsel, Rundung, unbekannte Werte → grau | N5 | 2 | erneuerung | 3, 6 (FA-15–23), S10 | Stufe 2 |
| A18 | Typaenderungs-Fan-out: Aenderung am Elementtyp aktualisiert alle Elemente in Liste, 3D/2D und Export konsistent; konsistenter Stichtagsstand je Anfrage | – | 2 | bestand, erneuerung | 3, 7.2 | Stufe 2 |
| A19 | Determinismus: Eigenschaftstest "zweimal rechnen → identische Bytes" auf 2 Runner-Typen | – | 2 | erneuerung | 3, 8 (Stufe 4) | Stufe 2 |
| A20 | Zustand ZHAW (nur falls im Scope): Kurve gegen Originalartikel und Beispielrechnungen, Fachfreigabe ([?] `08-pruefung.md` PO-Entscheid Nr. 8) | – | 2 [?] | zustand | S10 | Stufe 2 (falls Scope) |
| A21 | Lebensdauer-Excel-Export (FA-29 neu begrenzt): Werte, Quelle, Rechenweg, de-CH | – | 2 | export | 6 (FA-29) | Stufe 2 |
| A22 | Barrierefreiheit (axe), Ampel nicht nur Farbe, Kundenbrowser | – | 1–2 | web | 2, 8 (Stufe 3) | Stufe 2 |
| A23 | Last: API p95, Liste 10'000 Elemente, Upload-Spitzen (k6) auf Ziel-VM-Groesse | N2 | 2 | api | 8 (Stufe 4) | Stufe 2 |
| A24 | Suche ohne Internet/Claude-Key: Name, Volltext, lokale Semantik, Recall auf bekanntem Korpus, Liegenschaftsscope fuer Snippets/Vektortreffer, Reindexierung bei Upload/Loeschung/Revision/Modellwechsel, CPU/RAM auf Ziel-VM | N3 | 3 | suche | 11.8 | Stufe 3 |
| A25 | KI aus = 0 neue Requests (Netzmitschnitt), auch bei Abschalten waehrend laufender Jobs (Race) | N3 | 4 | extraktion, interview | 5 (FA-37), 11.4, 11.9 | Stufe 4 |
| A26 | Golden Set mit direktem Produktionsadapter und echten freigegebenen TGA-Daten; Injection-Dokumente; feste fachliche Mindestbaseline; Budget-Reconciliation, Doppelabrechnung nach Crash | N3 | 4 | extraktion, interview | 4, 11.9 (S2/S5/S6 umgewidmet) | Stufe 4 |
| A27 | Manueller Sicherheitsreview Login/Upload/Viewer; IT-Freigabe Siemens; externer Pentest nur falls Siemens ihn verlangt ([?] `08-pruefung.md` PO-Entscheid Nr. 1) | N2, N4 | 1 | – | 8 (Stufe 6/7) | Kundendaten |
| A28 | Lizenz-/SBOM-Pruefung inkl. Container und Modellgewichte; Secret-Scan; Schwachstellen-Scan der Images | N2, N6 | 1 (Gewichte: 3) | Lieferkette | 8 (Stufe 1/6) | Paketfreigabe |

### 12.3 Uebernahme aus Kap. 1–10 (Befund 11)

| Kap. / Pruefung (alt) | Status ab Welle 4b | Uebernommen als |
|---|---|---|
| 1.1 Spike-Ergebnisse S1–S13 | **historisch, unveraendert**; gelten nur als Messung der Spike-Umgebung | Nachweise neu in 03 Kap. 13.2 |
| 2 Grundsaetze 1–7 | bleiben; Nr. 3 ohne "RLS aktiv", Speicher = ausgelieferter lokaler Speicher statt MinIO o.ae. [A] | A7, A8 |
| 3 Testpyramide je Modul | bleibt fuer `domain`/`adapters`; Module `preise`, Grundriss, `austausch` entfallen bzw. [?] | A11–A19 |
| 4 Golden Set | bleibt ab **Stufe 4**; Grundriss-Recall/IoU und DE/FR/IT-Gates entfallen; Bedrock-Staging → Test-Schluessel direkte API | A26 |
| 5 RLS-1–6 (Policy, Kontext, Pool-Leak, Mandanten-FK) | **entfallen** (N1); bleibende Schutzziele SQL-Injection, Transaktionen, Akteurzuordnung | A7 |
| 5 RLS-7 | ersetzt durch GRANT-Test | A5 |
| 5 RLS-8/9 | umgewidmet: Rollen-/Liegenschafts-/Objektzugriff | A4 |
| 5 RLS-10 | umgewidmet: berechtigter Ausloeser + Modulschalter im Job | A4, A14 |
| 5 RLS-11 | bleibt (Audit-Unveraenderlichkeit, Parallelitaet) | A6 |
| 6 FA-01, FA-03 (Mandanten, Mandantenwechsel) | **entfallen** (N1) | – |
| 6 FA-05 (Entra/SSO) | zurueckgestellt (N4/N6) | – |
| 6 FA-12 (Grundriss), FA-24–28 (Kosten, Teuerung, Investitionsplan, Folgezyklen, Verschiebung) | zurueckgestellt (E24, N6) | – |
| 6 FA-29 (Excel-Export) | neu begrenzt auf Lebensdauer/Ampel | A21 |
| 6 uebrige FA im Scope (u.a. FA-02, 04, 06–11, 13–23, 30–38) | bleiben mit Stufe laut Matrix | A3–A26 |
| 7 Fehlerbaum "Falsche Zahl im Investitionsplan" | historisch; neues Top-Ereignis **"falsche Ampel"** (gleiche Aeste ohne Preis/Teuerung) | A17–A19 |
| 7.2 FMEA | historisch; neu auszurichten auf falsche Ampel, Datenverlust, Upload-Bypass, Updatefehler, falsche Instanzkonfiguration [A, Owner Test-Architekt, vor Stufe 2] | A8, A14–A17 |
| 8 CI Stufe 1 Schnell | bleibt (ohne Semgrep-Regel `mitMandant()`) | A7, A28 |
| 8 CI Stufe 2 Integration | bleibt ohne RLS-Suite; mit Constraint-/GRANT-/Audit-Tests, ausgeliefertem Speicher | A5, A6, A8 |
| 8 CI Stufe 2a Externe APIs (E32) | **entfaellt** (N3/N6) | – |
| 8 CI Stufe 3 E2E | bleibt; Suche erst ab Stufe 3 | A10–A12, A24 |
| 8 CI Stufe 4 Nightly | bleibt ohne Pool-Leak; Planstand ohne Geld | A19, A23 |
| 8 CI Stufe 5 Golden Set | ab Stufe 4, direkte API | A26 |
| 8 CI Stufe 6 Staging | ohne RLS-7/Exoscale und ohne ZAP-Pflicht; K01 auf ausgeliefertem Speicher, Restore-Bericht bleibt | A8, A16 |
| 8 CI Stufe 7 Manuell | FA-05 entfaellt; FA-30, FA-33 (Laptop + Kunden-VDI) bleiben; Grundriss-Korrekturzeit entfaellt | A12, A27 |
| 9 Nicht ausgefuehrte Spikes S4/S5/S7/S9/S12 | S4/S7/S9/S12 entfallen; S5/S6 als direkte API ab Stufe 4; S11 als Instanzmigration | A15, A26 |
| 10 Grenzen dieser Welle | bleiben gueltig fuer die historischen Messwerte | – |
| 11.1–11.9 | uebernommen; 11.1 getrennt in Stufe-1-Installation (A1) und Stufe-2-Ampel (A17) | A1–A26 |

### 12.4 Reihenfolge und Owner

- **M1 (Server-Paket + Login):** A1–A9, A13–A16, A27, A28 als Gates vor Kundendaten; Tests entstehen mit dem Paket, nicht erst in M11.
- **Stufe 1 (M2–M6):** A10–A12, A14 je Modul fortlaufend.
- **Stufe 2 (M7):** A17–A23; A17 erst mit fachlicher Freigabe der Orakel-Tabelle durch den Chef/FM-Fachmann [A].
- **Stufe 3 (M8):** A24. **Stufe 4 (M9/M10):** A25, A26.
- Das Zurueckstellen eines Werkzeugs (N6, z.B. ZAP) verschiebt nicht dessen Schutzziel: A27 bleibt Gate vor Kundendaten.
