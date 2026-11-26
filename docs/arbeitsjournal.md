# Arbeitsjournal Planora

Chronologisch, neueste Sitzung zuoberst. Was gilt, steht in `CLAUDE.md` Abschnitt 0b.
Kennzeichnung: [F] Fakt, [A] Annahme, [?] offene Frage.

## 2026-11-26 (spaet) – Suche T1/T2, Startseite entschieden

- [F] Suche T1 fertig + Fix: trusted extensions legen Mitgliedsobjekte unter `postgres` an; Restore als `planora_migrator` scheiterte an `COMMENT ON EXTENSION` -> Extensions im Superuser-Init/Host-Restore, `pg_restore --no-comments`. Lokal unsichtbar, erst `test:docker` fand es.
- [F] Suche T2 Review: `resourceLimits` eines worker_threads begrenzt nur den V8-Heap, nicht ArrayBuffer (pdf.js-Flate-Bombe) -> Kindprozess mit RSS-Waechter (Ruling 10, Zwischenstand ungeprueft).
- [F] E49 Startseite Modellplatte. PO-Regel: ponytail-Bestaetigung je Bericht.
- Offen: T1 Fixrunde 2 (`backup.test.ts:164`, `test:docker:b`), T2 Fix fertig + Re-Review, T3–T10, Startseite.

## 2026-11-25/26 – Siemens-Demo (E47), Anlagenakte fertig, Suche + Ablage geplant

### 1. Was gemacht wurde

- [F] E47: Zustimmung fuer Siemens-Demo in 3–4 Wochen, Online-Server nur wenige Tage als letzter Schritt, Budget da. Fahrplan `docs/superpowers/plans/2026-11-25-siemens-demo.md`.
- [F] Anlagenakte T8 (3 Kritikrunden), T9 (GLB Ausdehnungsgefaess/Sonstiges, Platzierung am Reihenanfang), T10 Abnahme, Gesamtreview, Fixwelle; `test:docker` mit echtem clamd gruen.
- [F] E48 und Brainstorming Schlaue Suche + Ordner-Ablage (Teile 1–4 "passt"), Spec und Plan (10 Tasks). Skill `ponytail` installiert, gilt fuer Code.

### 2. Gelernt

- [F] Neue Geraetetypen ohne Wandplatz und Leitung wirken sofort wie Platzhalter; Platzierung zwischen Speicher und langem Verteiler kollidiert mit dessen Zuleitung (Reihe rechnet mit Katalogbreite 1.2 m statt Verteilerlaenge).
- [F] ClamAV gibt ohne `AlertExceedsMax yes` Dateien bei Grenzueberschreitung als sauber frei.
- [F] Die Compose-Konfiguration reicht KI-Variablen nicht an die api und steht auf Stufe 1 – vor dem Demo-Server beheben.

### 3. Offen

- [?] Datenschutz Siemens (Textabschnitte an OpenAI); Modellnamen/Preise Embedding pruefen; Leser-Konto im Entwicklungsstart.

## 2026-11-23/24 – Anlagenakte schlank (E46), T1–T7 fertig, T8 begonnen

### 1. Was gemacht wurde

- [F] PO-Entscheide E46: Kostenpflichtiges (CH-VM, KI-Laeufe, bezahlte Dienste) erst nach Gruendung einer internen Firma mit Budget; Probe/Messlauf Preis aus Dokument ganz am Schluss. Anlagenakte "schlank": Ablage je Gebaeude mit Verknuepfung zu Bauteilen, Quarantaene + ClamAV, Viewer PDF/Bild, Office nur Download, Bibliothek Heizung fertig.
- [F] Spec `docs/superpowers/specs/2026-11-23-anlagenakte-design.md`, Nachtrag ADR 0016 (kein Multipart), Plan `docs/superpowers/plans/2026-11-23-anlagenakte.md` (10 Tasks). Umsetzung per Subagenten mit Review je Task.
- [F] Fertig und reviewt: T1 Modul `dokumente` + Migration 018 (gemeinsame Helfer `app/src/rechte/zugriff.ts`), T2 Dateityp aus Magic Bytes (inkl. OLE2-Verzeichnis, Makro-Ablehnung), T3 Quarantaene + Scanner-Port + clamd + Pruefer (fail-closed, kein stiller Fake-Scanner), T4 Verknuepfen/Kategorie/Loeschen, "Preise lesen" nur per Knopf, T5 ClamAV fest im Compose-Paket (Update startet clamav, Dossier-Text), T6 Bibliothek (Datenblatt-Felder, Quelle, Icon, Ausdehnungsgefaess, Sonstiges, Datenblatt-API), T7 Web-Typen/API/Fehlertexte.
- [F] T8 (Seite Dokumente, PDF-Viewer, Unterlagen, Datenblatt) auf PO-Wunsch abgebrochen; Zwischenstand `93ebeb8` committet, ungeprueft (tsc gruen, Web 572/572, kein Build, kein Review, keine visuelle Kritik).
- [F] Pruefstand: Backend 757/757, Web 572/572, Typen gruen.

### 2. Gelernt

- [F] Reviews fanden wiederholt Sicherheitsluecken, die der Plan-Code vorgab (Makro-Umgehung ueber ZIP-Limit/OLE2-Teilstring, stiller Fake-Scanner im Update-Smoke, Update ohne clamav-Start). Plan-Code nicht ungeprueft uebernehmen.
- [F] Docker Desktop lief nicht; `test:docker` mit echtem clamd ist offen (Healthcheck/nc im Image, clamd.conf-Override, Speicherbedarf beim Signatur-Reload ungeprueft).

### 3. Offen

- [?] Offline-Betrieb ClamAV (vorbefuelltes Signaturvolume) – Entscheid Stufe 4; Netzfreigabe freshclam (HTTPS) mit Siemens.
- [?] clamav-SBOM im Abnahme-Dossier (Stufe 4); WSL-Gesamtabnahme weiter nicht wiederholt.
- [A] Datenblatt-Felder, Lebensdauer-Quellen und Werte der neuen Typen fachlich nicht freigegeben; 100 MB, 7 Tage Quarantaene, alte Office-Formate.
- Weiter: T8 fertigstellen (Review + visual-critic), T9 GLB-Modelle, T10 Browser-Abnahme; danach Gesamtreview. Ledger `.superpowers/sdd/2026-11-23-anlagenakte/progress.md` (lokal, git-ignoriert) mit allen Rulings und Minors.

## 2026-11-23 – Preis aus Dokument umgesetzt

### 1. Was gemacht wurde

- [F] Plan `docs/superpowers/plans/2026-11-22-preis-aus-dokument.md` (E43 Teil 2): T1–T8 vollstaendig, T9 (Messlauf-Werkzeug, UTF8-Cluster, Abnahme-README) teilweise, per Subagenten mit Review je Task. Commits `0abe702`..HEAD auf `m2c-interview`, nicht gepusht, kein Merge.
- [F] Gesamtreview "mit Korrekturen" -> Fixwelle `b8028f4` -> Re-Review ohne offene Befunde. visual-critic r1 "verbessern", r2 "bereit" (`docs/design/kritiken/2026-11-23-preis-dokument/`).
- [F] Pruefstand: Backend 693/693, Web 560/560, Typen und Build gruen.

### 2. Inhaltlich gelernt (Rulings)

- [F] Budget laeuft ueber die Buchungstabelle `preis_lesung`: jede bezahlte Lesung zaehlt, auch Fehler, Neu-Lesen und Loeschen.
- [F] Kein FK dokument->datei; Schutz ueber `datei_referenz`. Seitenzaehlung mit zlib-Inflate. Uebersicht liefert `stand`. Nach Neustart werden Lesungen im Zustand neu/liest zu abgebrochen.
- [A] PDF-Eingabe bei gpt-6.2-sol unbestaetigt (Modellseite nennt nur Text/Bild). [A] `["number","null"]` im strict-Schema unbestaetigt.

### 3. Ueber die Zusammenarbeit gelernt

- [F] Der Schluessel fehlt noch; alles, was das echte Modell braucht (Probe, Messlauf, Browser-Abnahme), wartet auf PO-OK und Umgebungsvariable. Bis dahin ist die Abnahme nur teilweise moeglich.

### 4. Technisch zeitsparend

- [F] Dev/Test-Postgres war auf Windows WIN1252 (Umlaute kaputt, Prod nicht betroffen); jetzt UTF8 mit `--locale=C` (weicht von Prod-Kollation ab). Laufende alte Testinstanzen neu starten, sonst bleibt die alte Kodierung.
- [F] Messlauf-Werkzeug `werkzeug/preisdokument/probe.mjs` (Probe < $0.05) und Messlauf (< $2) nur mit PO-OK starten.

### 5. Wo es weitergeht

- Wartet auf PO: `OPENAI_API_KEY` als Benutzer-Umgebungsvariable setzen, OK fuer Probe und Messlauf; danach Browser-Abnahme (o1, o2, o4, "Alle sicheren", Legende ohne Preis 8 -> <= 2) und CLAUDE.md-Nachtrag. Details: `docs/abnahme/2026-11-23-preis-dokument/README.md`, Abschnitt "Offen – wartet auf PO".
- Kann: P3 aus r2 (Dateiname gekuerzt bei 1440, Kartenende bei 1280, Legende 3–4 px); "Alle sicheren" ueberspringt Vorschlag bei geloeschtem Bauteil; Messlauf misst nur Recall.

## 2026-11-19/20 – Lebensdauer/Ampel umgesetzt

### 1. Was gemacht wurde

- [F] Brainstorming abgeschlossen (Teil 3, CSV statt .xlsx), Spec `docs/superpowers/specs/2026-11-19-lebensdauer-ampel-design.md`, PO-Review: keine Standardpreise, Preise spaeter aus Dokumenten, Zuschnitt zwei Teile (E43).
- [F] Plan `docs/superpowers/plans/2026-11-19-lebensdauer-ampel.md` (11 Tasks) per Subagenten umgesetzt, je Task Review; Commits `3b20832`..`8e331a4` auf `m2c-interview`, nicht gepusht.
- [F] Gestaltung planora-design mittel: 3 Runden, visual-critic r3 "bereit"; Entscheid `docs/design/entscheide/2026-11-19-lebensdauer-ampel.md`, Fehler F9 (Tone Mapping).
- [F] Browser-Abnahme `docs/abnahme/2026-11-20-lebensdauer/README.md`: Zahlen Karte/Twin/Plan/CSV identisch, 8 Klicks + 3 Eingaben fuer Baujahr + 2 Preise. Gesamtreview "bereit mit kleinen Fixes" -> Fixwelle `8e331a4` (Rappen, CSV-Texte mit Umlauten, Preisquelle "dokument" bleibt, Plan-Eingaben). Pruefstand Backend 616/616, Web 503/503, Typen und Build gruen.

### 2. Entscheide des Controllers (Rulings; PO-bestaetigt 22.11.: "passt")

1. `FachFehler.status` um 400/404 erweitert (Spec verlangt 400 fuer fremde Bauteil-ID).
2. Plan-Testfehler korrigiert (Akte mit Preis braucht Quelle).
3. `lebensdauer_typ` haelt nur Kundenwerte; fehlende Zeile = Planora-Richtwert (keine Kopie).
4. GET-Antwort liefert `darfAendern`, da `/api/ich` nur die ID kennt.
5. Modus E schaltet aus der Uebersicht in die Technikansicht; Uebersicht beendet E mit Meldung.
6. Kein Komponententest der Seite Erneuerungsplan; abgedeckt durch reine Tests + Browser-Zahlenvergleich.
7. Lebensdauer-Aenderung am Baujahr erhoeht `gebaeude.stand` -> Assistent mit altem Stand bekommt 409 (im Browser bestaetigt).
8. Dritte Designrunde fuer zwei sichtbare Demo-Fehler (verdeckte Marker, Marker ueber Tabelle).

### 3. Offen (geringe Befunde, Kann)

- [?] Rolle Leser im Browser nicht geprueft (API-Test deckt es ab); CSV in Excel nicht geoeffnet.
- Testluecken, N+1-Selects, dupliziertes `zugriff`, BOM-Literal, `AmpelRinge` ohne eigenes dispose, Vektor-Allokation je Frame in `AmpelMarker3`, Typwerte-`katalogId` nicht gegen Katalog geprueft, Twin verschluckt Ladefehler ausser 401, Zuordnung Markerreihe zu Pumpe nur per Hover, Einstiegsrahmung leicht rechts, AO dunkelt Ringe ~7 %, Backend-Anzeigenamen doppelt zum Web.
- Fuer die Demo Testdaten `werkzeug/design/lebensdauer-daten.mjs` (Zustand B) verwenden.

### 4. Was inhaltlich gelernt wurde

- [F] Postprocessing-ToneMapping wirkt auch auf `toneMapped={false}`-Materialien; Farben weichen im Bild ab (`docs/design/fehler.md` F9).
- [F] Statusfarbe Rot kollidiert mit dem KOO-Rot der Heizung; im Modus Erneuerung wird die Technik neutralisiert (Entscheid `docs/design/entscheide/2026-11-19-lebensdauer-ampel.md`).
- [F] Eine Baujahr-Aenderung in der Lebensdauer erhoeht `gebaeude.stand`, damit der Assistent nicht still ueberschreibt.

### 5. Was ueber die Zusammenarbeit gelernt wurde

- [F] Das Claude-Nutzungslimit brach den 3D-Designer mitten in Runde 2 ab. Fortsetzung per Nachricht an denselben Agenten, mit Hinweis auf den ungesicherten Stand im Arbeitsverzeichnis, klappte.
- [F] Bei knappem Kontingent wuenscht der PO: Stand frueh in CLAUDE.md sichern, Reviews auf guenstigerem Modell.
- [F] PO-Antworten sind kurz ("ja aber bei demo will ich..."). Folge-Entscheide als Teilprojekt-Zuschnitt mit einer AskUserQuestion klaeren.
- [F] Die Selbstmessung des Designers "pixelgenau" war falsch (Tone Mapping). Farbtreue immer vom visual-critic im Bild nachmessen lassen.

## 2026-11-17 (spaet) – Testdaten, PO-Befunde, Brainstorming M7

- [F] Entwicklungsstart legt nur noch ein leeres "Testgebäude" an; Muster mit `instanz.sh start --muster` (`7725a3e`).
- [F] PO-Befunde aus dem Browser in CLAUDE.md (`a38d614`): Leitungsueberlappungen, Hauptverteiler bei FBH, Assistent fuer FM zu umstaendlich.
- [F] PO will Richtung Demo: Brainstorming Lebensdauer/Ampel, Entscheide als E43. Entwurf Teil 1 (Daten/Rechnung) und Teil 2 (Ansichten) bestaetigt; Teil 3 (Pruefung/Abnahme), Spec und Plan offen.
- Entwurfsdetails (Tabellen, Standardwerte, Ansichten) stehen im Sitzungsverlauf; naechste Sitzung aus E43 und diesem Eintrag die Spec `docs/superpowers/specs/2026-11-18-lebensdauer-ampel-design.md` schreiben:
  - Migration 016: `gebaeude_erneuerung` (Heizungs-Baujahr), `bauteil_akte` (Zustand, Lebensdauer, Stueckpreis, Notiz; cascade), `lebensdauer_typ` (L min/mittel/max, Preis, Ampelschwelle je Typ, aus Katalog-Standard kopiert).
  - Rechenteil rein (Stichtag als Eingabe), Rangfolge Bauteil > Typ > Standard, grau ohne Baujahr, gelb <= 3 J. [A], Kosten im Ersatzjahr, Ueberfaelliges im laufenden Jahr, Quelle je Wert.
  - Standard [A]: WP 20 J./35'000, Kessel 20/18'000, Fernwaerme 30/15'000, Speicher 25/6'000, Pumpe 12/900, Verteiler 30/2'500, WMZ 10/600, HK 40/800 Stk., FBH-Kreis 50/1'200, TABS 50/1'500.
  - API `GET/PUT /api/lebensdauer/gebaeude/:id`, `GET .../excel`.
  - Ansichten: Anlagenkarte mit Ampel/Bearbeiten, Twin-Modus "Erneuerung" (E, Legende mit Zahlen, Summe 5 J.), Seite "Erneuerungsplan" (Baujahr-Standard oben, 10 Jahresbalken, Liste, Excel); Gestaltung ueber planora-design Stufe mittel.

## 2026-11-17 (abends) – E42: Automatik nach Wiederoeffnen

### 1. Was gemacht wurde

- [F] PO-Antworten zur Abnahme Heizungserfassung als E42 festgehalten (`d6698fd`).
- [F] Automatik-Merker in `geschoss_vorlage` gespeichert und geladen (`55c48ef`, `488cad2`); Pruefhinweis `keine_abgaben`.
- [F] Browsermessung: FBH in OG3 nach Wiederoeffnen 5 statt 17 Klicks, FBH-Verteiler und Gruppenzuordnung automatisch, Twin 0 Hinweise. Backend 585/585, Web 457/457.

### 2. Was inhaltlich gelernt wurde

- [F] Assistent-Merker gehoeren nicht in die Beschreibung, aber muessen das Uebernehmen ueberleben; `geschoss_vorlage` traegt sie mit (Index-Verweise per IDs der eben geschriebenen Beschreibung aufloesen).

### 3. Was ueber die Zusammenarbeit gelernt wurde

- [?] PO-Antwort "wir entschieden" zu beheizten Kernen ist mehrdeutig; Verhalten unveraendert, nachfragen.
- [F] Bash-Heredocs mit Backticks scheitern im Werkzeug; Skripte per Write-Tool anlegen.

## 2026-11-17 – Heizungserfassung umgesetzt und abgenommen (ohne PO-Sichtung)

### 1. Was gemacht wurde

- [F] Plan `docs/superpowers/plans/2026-11-16-heizungserfassung.md` (12 Tasks) per Subagenten umgesetzt, je Task Review; Commits `3fbdfc5`..`817ff91`. Backend: Migration 015 `geschoss_vorlage`, Route `GET .../vorlagen`, `PUT .../beschreibung` mit `vorlagen` in einer Transaktion. Web: Zustand v2 (7 Schritte), Regelgeschoss, Standard-Hersteller, FBH-Verteiler automatisch, Gruppenvorschlag, Pruefen in Klartext, neue Schritte 2/3/5.
- [F] Gesamtreview "mit Korrekturen" -> Fixwelle `23398b9` (u. a. Zaehlerfeld loeschte beim Tippen Einheiten).
- [F] FM-Review im Browser: 33 statt 165 Klicks (Ziel <= 40). visual-critic 2 Runden "verbessern" -> 2 Designrunden (`f6cc9e3`, `817ff91`), P1/P2 behoben.
- [F] Pruefstand: Web 452/452, Backend 581/581, Typpruefung und Build gruen. Abnahme `docs/abnahme/2026-11-16-heizungserfassung/README.md`.

### 2. Was inhaltlich gelernt wurde

- [F] Automatik nur fuer neue Gebaeude (Plan-Annahme 5) reicht nicht: Ergaenzungen nach dem ersten Uebernehmen kosten 17 statt 6 Klicks und haben keine Gruppenzuordnung -> PO-Entscheid noetig.
- [F] Geschossweite Heizungswahl darf nur Einheiten aendern, in denen die Heizart erlaubt ist (sonst wird der Kern unbeheizt).
- [F] Zuruecksetzen muss je Schritt nur dessen Felder betreffen (Schritt 2 loeschte sonst Heizungs-Ausnahmen aus Schritt 3).

### 3. Was ueber die Zusammenarbeit gelernt wurde

- [F] Gesamtreview vor der Abnahme ziehen: der kritische Datenverlust im Zaehlerfeld waere sonst in Klickzaehlung und Bildkritik eingeflossen.

## 2026-11-16 – FM-Review und Spec Heizungserfassung

### 1. Was gemacht wurde

- [F] FM-Manager-Review per Agent im echten Browser: Buerohaus mit 7 Geschossen brauchte rund 165 Klicks/Eingaben. Bilder und README `docs/abnahme/2026-11-16-fm-review/`.
- [F] Brainstorming mit PO (Integrationsplan Punkt 12) -> Spec `docs/superpowers/specs/2026-11-16-heizungserfassung-design.md` (`c660047`), PO-Entscheide H1–H7.
- [F] Kein Code geaendert; Pruefstand unveraendert (Backend 569/569, Web 384/384).

### 2. Was inhaltlich gelernt wurde

- [F] Klicktreiber: keine Mehrfachbearbeitung je Geschoss, Gruppen-Verbraucher als Einzel-Checkboxen, FBH-Verteiler je Einheit einzeln.
- [F] PO-Begriff: es gibt keine Unterverteiler, nur FBH-Verteiler, die automatisch je Einheit mit FBH entstehen (H4).
- [F] Regelgeschoss-Zuordnung wird dauerhaft gespeichert (H2, neue Tabelle `geschoss_vorlage`, Migration 015 geplant).
- [A] Ziel hoechstens 40 Klicks fuer das Review-Gebaeude; Aufwand 4–5 Arbeitstage.

### 3. Was ueber die Zusammenarbeit gelernt wurde

- [F] Ein Rollen-Review (FM-Manager) mit Klickzaehlung machte das PO-Gefuehl "zu aufwendig" messbar und lieferte die Ursachen im Code.

## 2026-11-15 – Leitungsrouter T9/T10, Befunde, Gesamtreview

### 1. Was gemacht wurde

- [F] T9 `384eca0`: alte Schablonenfuehrung entfernt, Router Pflicht.
- [F] T10: GPU-Bilder aller 7 Muster (`docs/abnahme/2026-11-15-leitungsrouter/`), Formstuecke Pressbogen/T-Stueck/Winkel (`3a574ae`, an Strangecken `2391a3e`), FBH-Kasten geschlossen (GLB), Rohre aus Distanz verdickt (`d2c7229`). visual-critic r1 "verbessern", r2 "bereit"; PO-Sichtung "passt".
- [F] Befunde behoben: Heizkoerper in der Aussenwand (`5688b4a`), Assistent-Vorschau mittig (`68b5995`), Kamera auf Gruppenverlauf + Panels 0.94 deckend (`c540de2`), Rohr-Klickflaeche (`d90d698`), Temp-Ordner beim Beenden loeschen (`6f307b0`). Betreiber-Ablauf im Browser geprueft; ~10 GB alte Temp-/Abnahmeordner geloescht.
- [F] PO-Entscheide umgesetzt: Direktverbindung naher Geraete (`c43713f`), fremde Leitungen dimmen (`afafb39`), Hinweis `seitenverhaeltnis` nur intern (`6fb15a1`); Band-Effekt bleibt.
- [F] Gesamtreview Router "Mit Korrekturen": 3 wichtige Befunde behoben (`6a2a681`), 12 geringe offen (lokal `.superpowers/sdd/2026-11-13-leitungsrouter/gesamtreview.md`).
- [F] Anschlussbilder aller 74 Bauteile als private Artifact-Galerie (Link in CLAUDE.md 0b).
- [F] Pruefstand: Backend 569/569, Web 384/384, tsc und Build gruen. Branch gepusht bis `d0e509d`, kein Merge.

### 2. Was inhaltlich gelernt wurde

- [F] Heizkoerper-Wandabstand 0.1 m lag innerhalb der 0.3 m dicken Aussenwand; 0.35 m setzt sie davor.
- [F] Die Assistent-Vorschau sass nicht wegen `einpassen()` falsch, sondern weil `zielKorrektur` das verschobene Kameraziel zurueckklemmte.
- [F] Direktverbindung naher Geraete auf Anschlusshoehe veraendert die 2000er-Bilanz nicht (42 Welten mit harten Befunden; Seed 891 neu, eine andere sauber); Kreuzungen 38.9 %, ~240 ms je Welt.
- [A] Grenze 2.0 m fuer Direktverbindung und die Shader-Verdickung der Rohre sind gesetzt, nicht gemessen bzw. nicht vom PO beziffert.

### 3. Was ueber die Zusammenarbeit gelernt wurde

- [F] Der PO entscheidet offene Gestaltungsfragen gesammelt in einer Liste (fuenf Entscheide in einer Antwort).
- [F] Eine Artifact-Galerie war fuer die PO-Sichtung von 74 Anschlussbildern praktischer als PNGs im Repo (37 MB).

### 4. Was technisch Zeit spart

- [F] Anschlussbilder nicht committen: Szenario `werkzeug/design/szenarien/twin-anschluesse.json` erzeugt sie neu.
- [F] Sackgasse: Entwicklungsstart und `instanz.sh` hinterliessen je Lauf einen Temp-Ordner (ueber Tage ~10 GB). Jetzt beim Beenden geloescht; bei abgebrochenen Laeufen trotzdem gelegentlich pruefen [A].
- [F] Sackgasse: Leitungshinweis und Bild rechneten den Router doppelt; eine gemeinsame Berechnung spart Laufzeit und verhindert Abweichungen.

### 5. Wo es weitergeht

1. Brainstorming Heizungserfassung mit PO (Integrationsplan Punkt 12).
2. 12 geringe Review-Befunde, 42 Restwelten des Routers.
3. Integrationsplan Punkte 5/6/7; Regelwerk-v1-Freigabe, CH-VM, SMTP, Lizenz/Vertraege weiter offen.
4. Merge nach `main` nur auf PO-Auftrag.

## 2026-11-14 – Leitungsrouter T6–T8 (Pause in T8)

### 1. Was gemacht wurde

- [F] T6 Re-Review abgeschlossen, Fixrunde 2 `52229c4`. T7 Einbau `64df567` + Fixrunde `fafd06e`: alle 7 Muster ohne Befund, Web 326/326.
- [F] T8 Zwischenstand `d1f6764`, `96e5216`, `5e3eec7`: Laufzeit 1.05 s -> ~230 ms je Welt, Hinweis im Twin, Boegen je Geschoss, realistischer Zufallsgenerator. 13/300 Zufallswelten noch mit harten Befunden.
- [F] Ausfuehrung durch Claude-Subagenten (Implementierer, Reviewer, Re-Reviewer je Task); Ledger lokal unter `.superpowers/sdd/2026-11-13-leitungsrouter/`.

### 2. Was inhaltlich gelernt wurde

- [F] Die alten Adapter (`anschlussFuehrung`) erzeugten allein harte Befunde (Wende im Verteileradapter, Speicheradapter ausserhalb des Grundrisses, Zuleitung durch Aussenwand). Entscheid: Adapter nur noch senkrecht, Router fuehrt den Rest.
- [F] PO-Entscheid "Annahmen anpassen": max. 6 Boegen je Geschoss statt je Verbindung; Zentrale im Zufallsgenerator mit 0.8 m Geraeteabstand [A]; Kreuzungsschwelle nach Messung; ~230 ms je Welt akzeptiert (Spec-Ziel war 50 ms).
- [F] Ebenenwechsel-Kosten 25 schlagen 3 in allen Messgroessen (weniger harte Befunde und Kreuzungen).

### 3. Was ueber die Zusammenarbeit gelernt wurde

- [F] Der PO entscheidet bei Annahmekonflikten schnell, wenn drei Optionen mit Aufwand vorliegen.

### 4. Was technisch Zeit spart

- [F] Zufallstest in der Standardsuite mit 100 Welten (~25 s); `PLANORA_ZUFALL=2000` fuer die Abnahme (~8 min).

## 2026-11-13 – Stufe 1: Tracks abgeschlossen, integriert, Betreiber legt Gebaeude an

### 1. Was gemacht wurde

- [F] Abgebrochene Tracks fertig: A6 `530422c` (Steigzone, Hinweise `ohne_gruppe`/`gruppe_leer`, abgeleitete Masse v2); B4/B5 `43a5515`, `dc94655` (Assistent-Schritte 5–8, Tastatur, GPU-Szenario, 36 GPU-Bilder `abnahme/2026-11-12-assistent/`); C3/C4 `95536ea`, `4b1a03c` (Gruppenstock, Ort vor Bauteil, GLB `ventil_3weg`/`ventil_2weg`/`wmz` und Verteiler n1–n8 via Blender `design/modelle/anlagen.py`, Gruppenhervorhebung, Karte `TwinGruppe`, 57 GPU-Bilder `abnahme/2026-11-12-gruppen/`, 60 fps).
- [F] Integration auf `m2c-interview`: Merges A `2a155d2`, C `f16ab79`, B `29e292a` ohne Konflikte; `npm run muster:welt` ohne Fixture-Diff. I1 `fe85d42` (Twin-Menue "Gebäude bearbeiten" oeffnet Assistent), Doku `f10d597`.
- [F] `5b2bf4b`: `GET /api/struktur/liegenschaften`, Liegenschaftswahl ohne sichtbare Gebaeude, Meldung statt Fehler fuer Betreiber nach Anlegen, Entwicklungslogin `betreiber@planora.invalid` (Passwort zufaellig, im Startfenster). Per HTTP geprueft, nicht im Browser.
- [F] Pruefstand: Backend 568/568, Web 251/251, Typpruefungen und Webbuild gruen.
- [F] PO hat lokal gestartet und den Assistenten gesehen ("ist mal ein grosser Fortschritt") und den Push des Branches beauftragt (kein Merge nach `main`).

### 2. Was inhaltlich gelernt wurde

- [F] Ein Benutzer hat genau eine Rolle (`rolle_zuordnung.benutzer_id` Primaerschluessel); Admin hat kein `huelle.verwalten`. Deshalb braucht der Betreiber einen eigenen Weg zu den Liegenschaften, auch wenn ihm keine Gebaeude sichtbar sind (E38).
- [A] Steigzone 0.3 m innerhalb der Zentrale-Ecke, Abschwaechung nicht gewaehlter Leitungen und Verteiler `n8` mit 12 608 Dreiecken / 256 kB (ueber Budget 8000 / 200 kB) sind ungeprueft.
- [F] Sichtbare Maengel: Vorschau im Assistenten zoomt zu nah (`einpassen()` rechnet korrekt, Ursache offen); Hauptleitungen bilden Schleifen ueber der Zentrale; Gruppenauswahl faehrt nicht auf den Gruppenverlauf.

### 3. Was ueber die Zusammenarbeit gelernt wurde

- [F] Getrennte Worktrees je Track liessen sich ohne Konflikte zusammenfuehren; Reihenfolge A, C, B (Daten vor Darstellung vor Oberflaeche).
- [A] Der PO testet selbst lokal und gibt knappe Rueckmeldung; ein startbarer Stand mit Login fuer jede Rolle ist dafuer wichtiger als Testzahlen.

### 4. Was technisch Zeit spart

- [F] PowerShell des PO blockiert `npm.ps1` -> `npm.cmd`, Befehle aus `app/`.
- [F] Sackgasse: Entwicklungsstart auf Standardports 3000/54500 kollidiert mit dem laufenden PO-Server und stuerzt mit `undefined` ab [A, wahrscheinliche Ursache]. Eigene Ports via `$env:PLANORA_PORT`/`$env:PLANORA_PG_PORT`.
- [F] Sackgasse: Testlauf mit `timeout` abbrechen kann die eingebettete PostgreSQL verwaist zuruecklassen. Am Ende lauschte auf 54800 ein nicht sichtbarer/beendbarer Prozess [?]. Tests nicht hart abbrechen; vor dem naechsten Start Port pruefen.

### 5. Wo es weitergeht

1. Vorschau-Zoom im Assistenten in laufender Instanz messen und beheben [A: Kamera nach Eingriff nicht neu eingepasst oder Zoom-Untergrenze].
2. Hauptleitungen Erzeuger -> Speicher -> Verteiler ohne Schleifen fuehren.
3. Gruppenauswahl: Kamera auf Gruppenverlauf, Umriss in Uebersicht staerker.
4. I2: GPU-Bilder aller Muster, visual-critic-Gesamtrunde, PO-Sichtung.
5. Annahmen oben pruefen; Doku-Nachtrag `00-kontext.md` (Masse ab Regelwerk v2, Liegenschaften-Endpunkt).
6. Aufraeumen: Worktrees wt-a/b/c nach Push; untracked Ordner `wt-b-assistent/docs/design/kritiken/2026-11-12-assistent-r1/` loescht der PO.

Details: [Integrationsstand](superpowers/plans/2026-11-13-stufe1-integration.md).

## 2026-11-12 – Stufe 1: Vertragsphase nach Claude-Stopp abgeschlossen

- [F] Aktueller Branch `m2c-interview`, Implementierungsstand `c5a335e`; M2b bereits mit `ba3f339` nach `main` integriert. Ältere Einstiegsangaben korrigiert.
- [F] Phase V1–V5 umgesetzt: Gruppen-/Ort-Vertrag, Migration/Katalog/Regelwerk v2, Speicher/Prüfung, Entwurf/Vorschau, Generator-Stub, sechs Muster plus U-Variante.
- [F] Abschlussprüfung: 477 Backendtests, 174 Webtests, beide Typprüfungen und Webbuild bestanden. Echte Demo per HTTP mit Login, acht Gebäuden und allen Welt-Endpunkten geprüft. Eigene temporäre Dienste beendet; bestehende Dienste unberührt.
- [F] Windows-Sandbox-Teardown der eigenen Testdatenbank erforderte gezieltes Beenden der nach Datenpfad/Port identifizierten Instanz. Danach erster Testprozess Exit 0.
- [F] [Abschluss und Fortschritt](superpowers/plans/2026-11-12-stufe1-abschluss.md). Generator-Raumkomposition, Assistent und Gruppenleitungen bleiben offen; keine neue GPU-/Docker-/Lieferabnahme, kein Push/Merge/Deployment.

## 2026-11-12 – Teilaufgabe 8 nach erneutem Claude-Nutzungslimit übernommen

- [F] Letzten Auftrag aus Claudes lokalem Sitzungsverlauf rekonstruiert: Restauflagen Interaktionen abschliessen, vom PO freigegebene Altansichten entfernen, Lizenzhinweise und Dokumentation ergänzen, GPU-Prüfung. Orca-CLI war in dieser Sitzung nicht auf dem PATH.
- [F] Vorhandene Änderungen an Zoom, Beschnitt, Nahkulisse, Lazy-Loading, Tabellenfokus und T-Rückmeldung übernommen. Vor dem Abbau: 186 Webtests und Build grün.
- [F] Altansichten samt ausschliesslich alten Komponenten und 14 alten Tests entfernt. Gemeinsame Geometrie-, Leitungs- und Paneldatenmodule bleiben samt Tests erhalten. Gebäude öffnen direkt im Digital Twin.
- [F] Nach dem Abbau: 172 Webtests, Typprüfung und Build grün. Drittanbietertexte von 66 Produktionspaketen beigelegt; fünf fehlende Pakettexte ausdrücklich gelistet, keine Lieferfreigabe behauptet.
- [F] Weiterer Prüfstand und offene Punkte: [Teilaufgabe 8](superpowers/plans/2026-11-12-teilaufgabe-8.md). Kein Merge, Push oder Deployment.

## 2026-11-12 – Visueller Zielentwurf (E40) umgesetzt

- [F] Prototyp nach Spec und Plan (6 Tasks) auf `m2b1-sichtbarer-schnitt`: plastische Uebersicht, Fokusmodus je Geschoss, schematische Leitungen, schwebende Karten. [Abnahmestand](abnahme/2026-11-12-entwurf/README.md).
- [F] Gelernt: ACES-Tonwertabbildung verfaelscht das Heizungsrot zu Lachs; `NeutralToneMapping` haelt die KOO-Farben. `shadows="soft"` ist in three 0.187 entfallen.
- [F] Frontend 43/43, Backend 417/417, Typpruefungen/Build gruen, keine CSP-Verletzungen. fps nur im Software-Rendering gemessen [A].
- [?] PO-Korrekturrunde: weisser Auswahl-Umriss, Zentrale->Verteiler [A], Dachaufbau [A], Masse/Farben [A].

## 2026-11-12 – M2b-1 nach Claude-Usage-Abbruch fortgesetzt

- [F] Tagesabschluss vom PO beauftragt: Dokumentation, Commit und Push auf dem Arbeitsbranch; kein Merge/Deployment. Visuelle Endabnahme ausdruecklich offen.
- [F] E40: PO bestaetigt Bild 2 fuer Gebaeude, Bild 3 fuer Technikansicht, Bild 1 fuer Informationskarten. [Referenzen und Zusatzaufwand](design/2026-11-12-visuelle-zielrichtung.md), [dauerhaft gesicherte Screenshots](abnahme/2026-11-12-m2b1/README.md).
- [A] Zusatzaufwand +6–10 PT, Planungswert +8 PT, ohne bereits geplante Funktionen doppelt zu zaehlen. Naechste Sitzung: visueller Zielentwurf am Beispielgebaeude.

- [F] Uebernahme auf `m2b1-sichtbarer-schnitt` bei `376885d`: Tasks 1–5 committet, Task 6 mit fuenf geaenderten Dateien begonnen.
- [F] Docker-Frontend, Web-Lockfile im Lizenz-Dossier inklusive Abnahme-Aufruf und lokaler Demostart fertiggestellt. Der Update-Test kopiert jetzt auch `web/` in seinen Build-Kontext, ohne `node_modules` und `dist`.
- [F] Demostart verwendet frische temporaere Daten, bereinigt laufende Dienste bei Startfehlern und lehnt Produktion/ungueltige Ports ab. Keine bestehenden Entwicklungsdaten werden geloescht.
- [F] Backend 402 Tests, Frontend 19 Tests, Typpruefungen und Build bestanden. Browser: Login, Liste, 3D, Verteiler-Picking mit Restaurant (EG) und Buero C (OG1), keine CSP-Verletzungen. Docker-Stand im aktuellen Fortsetzungsplan.
- [F] Keine WSL-/CH-VM-Gesamtabnahme, keine vollstaendige SBOM-Neuerzeugung, kein Merge/Deployment. README, Spec und Einstieg nachgefuehrt; Branch wird zum Tagesabschluss gepusht.

## 2026-11-11 – M2a Welt-Kern

### 1. Was gemacht wurde

1. M2 vom PO in drei Teile zerlegt: M2a (Kern ohne UI), M2b (3D-Ansicht), M2c (Erfassung/Heizungsassistent). Spec `docs/superpowers/specs/2026-11-11-m2a-welt-kern-design.md`, Plan `docs/superpowers/plans/2026-11-11-m2a-welt-kern.md`.
2. Umsetzung per Subagenten (7 Tasks) mit Task-Reviews; Schlussreviews durch Opus und Codex (via Orca), alle Befunde behoben.
3. PR #1 gemergt (`bd5d7a6`), `main` gepusht, Branch `m2a-welt-kern` lokal und remote geloescht.
4. Tests auf main: `npm test` 387 ok / 37 Docker uebersprungen, Typpruefung gruen, `test:docker` 32 ok in 503 s.

### 2. Was inhaltlich gelernt wurde

- [F] PO-Entscheide: normalisierte Tabellen sind die Wahrheit, Beschreibung ist Ein-/Ausgabeformat; stabile IDs per optionaler `id` (ohne id = neu/Kopie, fehlend = loeschen, blockiert bei manueller Position); Heizungsstandard am Gebaeude plus Ausnahmen je Einheit; ein Symbol je Typgruppe unabhaengig von der Menge; Zentrale im Katalog; Flaeche je Einheit optional (Breite/Tiefe erfasst Planora); "bestaetigt" bei unbekannter Menge erlaubt; M2c-Ablauf Struktur, Zentrale, Standard, Ausnahmen, Verteiler; Demo nur Heizung.
- [F] Technische Entscheide: Routen `/api/struktur/...` und `/api/szene/gebaeude/:id/welt`; Katalog/Regelwerk als TS-Module; `bauteil.gebaeude_id`; Recht `huelle.verwalten`; ajv global strikt (`removeAdditional:false`, `coerceTypes:false`); Migration `013_gebaeude.sql`.
- [F] Es gibt noch kein Frontend (kein Vite-Projekt, keine Login-Seite, Caddy liefert nur die Wartungsseite). M2b muss das Geruest mitbringen.
- [A] Regelwerk-v1-Werte (Default-Flaechen, Mengenbereiche, Erlaubt-Matrix) sind Annahmen, PO-Freigabe vor M2b.

### 3. Was ueber die Zusammenarbeit gelernt wurde

- Zerlegen in einen UI-freien Kern zuerst gab pruefbare Schritte; der PO hat die Aufteilung selbst entschieden.
- Doppelte Schlussreview (Opus und Codex) fand weitere Befunde nach den Task-Reviews; lohnt sich vor dem Merge.

### 4. Technisches, das beim naechsten Mal Zeit spart

- Sackgasse: Katalog/Regelwerk als JSON passt nicht zum Docker-Build, der nur `.ts` kopiert. Loesung: TS-Module.
- Jede `/api`-Route muss einem Modul gehoeren; daher die Pfade `/api/struktur/...` und `/api/szene/...`.
- Der Update-Test im Docker-Lauf war an eine feste Migrationsnummer gebunden und brach mit der neuen Migration `013`. Er leitet jetzt die letzte Migration ab, die Probe heisst `999_updateprobe.sql`.
- `test:docker` dauert rund 8.5 min, im Hintergrund starten.

### 5. Wo es weitergeht

1. M2b spezifizieren (Brainstorming, Spec, Plan): Frontend-Geruest (React/Vite, ADR 0004), Login, 3D-Ansicht (ADR 0008/0032): Uebersicht, Geschossauswahl, Explosion, Seitenpanel, Leistungsstufen, Tabellenweg.
2. [?] Offene M2a-Nachtraege (Spec Abschnitt 11): 400-Fehlerformat vereinheitlichen, Regelwerk-v2-Guard im Generator, `aendereHuelle` ohne Stand-Pruefung u.a., vor M2b.
3. [A] Regelwerk-v1 vom PO freigeben lassen.
4. [?] WSL-Gesamtabnahme auf main wiederholen; weiter offen wie im Eintrag darunter (CH-VM, SMTP, Lizenz, Aufraeumen).
5. Abbruchkriterium [A] bleibt: Datenteil fertig, sichtbarer Teil fehlt.

## 2026-11-11 – M1-Abnahme mit Opus und Codex

### 1. Was gemacht wurde

1. PO-Auftrag: M1 abschliessen mit zwei Agenten (Orca-Run `run_50ccbfb66dc9`).
   - Spur A (Opus, Worktree `m1-abnahme-a`): Kunden-CA (TLS-Modus `kundenzertifikat`, Rotation/Rueckrollen), Retention 14/8/12, Alarmkanal (SMTP, optional Webhook mit HMAC).
   - Spur B (Codex, Worktree `m1-abnahme-b`): WSL-Ersatz-VM-Abnahme (offline, Bind-Mounts/UID, systemd-Timer, 2 Instanzen, Backup/Restore), VM-Totalverlust-Probe, SBOM/Lizenzdossier.
2. Mitten im Lauf brauchte der PO Codex anderweitig: Spur B ab Commit `34a1be3` an Opus uebergeben; Nachpruefung von Spur A durch einen frischen Opus-Pruefer statt Codex.
3. Reviews:
   - PP11a (Codex): nicht OK, 9 Befunde (4 hoch) -> behoben.
   - PP11a-N (Opus): OK mit Auflagen, 4 mittel + 4 niedrig -> behoben.
   - PP11b (Codex): OK mit Auflagen, 4 Befunde -> behoben; Gesamtlauf `betrieb/abnahme/abnahme.ps1` Exit 0 in 417.6 s.
4. PO-Entscheide als E39 in `docs/architektur/00-kontext.md` festgehalten (Hosting durch Planora, Retention, Alarmempfaenger, Lizenzmodell).
5. Beide Spuren lokal auf `main` gemergt (`dac37b4`, `8b2972a`), Teststand in `docs/superpowers/plans/2026-11-11-fortsetzung.md` (`b13bbba`), auf `origin/main` gepusht.
6. Tests auf main: `npm test` 314 ok / 37 skip, Typpruefung ok, `test:docker` 32 ok in 440 s, `test:docker:b` 9/9.
7. `CLAUDE.md` und dieses Journal neu angelegt.

Berichte: `docs/superpowers/plans/2026-11-11-m1-abnahme-spur-a.md`, `...-spur-b.md`, `2026-11-11-m1-lizenznachtrag-spur-b.md`.

### 2. Was inhaltlich gelernt wurde

- [F] Kunde hat keine eigene IT: Planora hostet Server und Domain. Damit wird Kunden-CA eher der Ausnahmefall; bei Eigenhosting meist eigene Domain mit oeffentlichem Zertifikat [A].
- [A] Kosten Hosting (Anbieterseite, Stand 11.11.2026, vor Bestellung bestaetigen): Infomaniak VPS Lite 4 vCPU / 8 GB / 160 GB CHF 18/Monat bei Jahresvertrag; Mail CHF 2.29/Adresse/Monat.
- [A] Preise Exoscale, Domain und Swiss Backup nur aus Drittquellen, nicht verifiziert.
- [A] Standard-Alarmempfaenger = Admin-Konten des Kunden; vom PO als umschaltbar beschlossen, Standard selbst nicht ausdruecklich bestaetigt.
- [F] Die WSL-Gesamtabnahme deckt nur den Spur-B-Stand; nach Merge von Spur A nicht wiederholt.

### 3. Was ueber die Zusammenarbeit gelernt wurde

- Der PO verteilt Agenten kurzfristig um (Codex abgezogen). Spuren deshalb so schneiden, dass eine Uebergabe an einen anderen Agenten ab einem klaren Commit moeglich ist – hat hier funktioniert.
- Kreuzpruefung durch ein anderes Modell bzw. einen frischen Pruefer findet echte Befunde (PP11a: 4 hohe). Lohnt sich vor jedem Merge.
- Rechtliche Freigaben (Lizenz, Rechtekette) entscheidet der PO bewusst nicht durch Agenten – offen lassen statt vorwegnehmen.

### 4. Technisches, das beim naechsten Mal Zeit spart

- Auf Windows `npm.cmd` statt `npm` aufrufen (PowerShell-ExecutionPolicy blockiert `npm.ps1`).
- Sackgasse: `test:docker:b` brach zuerst ab, weil alte Testvolumes `planora-b_*` vom 10.11. das Compose-Projekt belegten. Der Testdocker-Guard hat korrekt abgebrochen (kein Fehler im Code). Loesung: eigenen Projektnamen setzen, `PLANORA_TEST_PROJEKT=pr-backup`. Alte Volumes noch nicht geloescht.
- Docker-Laeufe dauern: `test:docker` rund 7.5 min, `abnahme.ps1` rund 7 min – im Hintergrund starten.

### 5. Wo es weitergeht

1. Aufraeumen: Worktrees `m1-abnahme-a`/`-b` (via Orca) und Volumes `planora-b_*` entfernen, nach Pruefung auf saubere Staende.
2. M2/M6 erster 3D-Schnitt nach E38/ADR 0032 spezifizieren und bauen (Fortsetzungsplan, "Naechste Coding-Aufgaben").
3. Echte CH-VM bestellen (Preis bestaetigen) und Abnahme darauf ausfuehren.
4. SMTP-Zugang beschaffen, echten Versandtest machen.
5. [?] Klaeren: Rechtekette Entwickler -> Firma, Vertrag/AVV mit Siemens, Lieferantenpruefung, menschliche Lizenzfreigabe.
6. [?] Pruefen, ob das anonyme `VOLUME /var/lib/postgresql` im Backup-Image noetig ist.
7. Hinweis: Fortsetzungsplan sagt bei "M1-Abnahme" noch "lokal, nicht gepusht" – inzwischen gepusht (`b13bbba`), beim naechsten Nachfuehren korrigieren.
