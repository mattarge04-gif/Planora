# Schlaue Suche und Ordner-Ablage – Design

Stand 26.11.2026. PO-Entscheide E47 (Siemens-Demo in 3–4 Wochen) und E48 (Suche + Ordner-Ablage, gemeinsame Spec). Brainstorming Teile 1–4 vom PO bestaetigt ("passt"). Code nach Skill `ponytail`, Gestaltung ueber `planora-design` (Stufe mittel). Aufwand [A] ca. 8 PT.

## 1. Ziel und Umfang

Ein FM findet in den Unterlagen eines Gebaeudes, was er braucht, ohne Dokumente zu oeffnen: "Leistung Wärmepumpe" liefert die Antwort mit Quelle und oeffnet das Datenblatt auf der richtigen Seite, die Stelle markiert. Ein ganzer Explorer-Ordner laesst sich auf einmal ablegen und Bauteilen, Geschossen, Einheiten, dem Gebaeude ("allgemein") oder "undefiniert" zuordnen, mit KI-Vorschlag.

Im Umfang:

- Text auslesen aus PDF mit Text, Word (.docx), Excel (.xlsx); Index je Abschnitt.
- Suche: Wortsuche mit Tippfehlertoleranz (ohne KI), Sinnsuche (Embeddings), Antwort mit Quelle (KI).
- Register "Ablage": Ordner waehlen, Zuordnung je Datei, Mehrfachauswahl, KI-Vorschlag, gemeinsames Ablegen.
- Zuordnung von Dokumenten zu Geschoss, Einheit, Gebaeude (allgemein) zusaetzlich zur bestehenden Bauteil-Verknuepfung.

Nicht im Umfang (YAGNI): Texterkennung fuer Scans und Fotos (diese nur per Dateiname), Suche ueber mehrere Gebaeude, Chat mit Verlauf, alte Office-Formate (.doc/.xls), Office-Vorschau im Viewer.

## 2. Ansatz

Ansatz A (PO 25.11.): Hybrid im eigenen System. Dokumente bleiben in Planora; an OpenAI gehen nur Textabschnitte, `store: false` wie bei "Preis aus Dokument" (E45). Postgres hat `pg_trgm` und `unaccent` [F], kein `pgvector` [F]; Vektoren werden als `real[]` gespeichert und die Aehnlichkeit in SQL berechnet. Fuer einige tausend Abschnitte je Gebaeude ausreichend [A]; `shortcut: lineare Suche ueber alle Abschnitte des Gebaeudes, bei > 50 000 Abschnitten pgvector pruefen`.

Abgelehnt: B OpenAI File Search (ganze Dokumente beim Anbieter, Speichergebuehr, keine Wortsuche ohne KI), C ohne Embeddings (Sinnsuche haengt an Synonymen der KI).

## 3. Daten und Module

**Modul `suche`** (neu, Routen `/api/suche/`), nutzt `dokumente` (Bytes, Rechte, Scanstatus). Ablage-Zuordnung erweitert das Modul `dokumente`.

**Migration (naechste freie Nummer):**

- `dokument_abschnitt(id, dokument_id → dokument on delete cascade, nr, ort_art 'seite'|'blatt'|'absatz', ort int, text, tsv tsvector generated (german, unaccent), vektor real[] null, modell text null)`; GIN auf `tsv`, GIN `gin_trgm_ops` auf `text`; Index `(dokument_id, nr)`.
- `dokument.text_status` (`offen` | `fertig` | `ohne_text` | `fehler`), `text_grund` ≤ 300.
- Zuordnung: `dokument_ort(dokument_id, geschoss_id null, einheit_id null, allgemein bool)` oder Spalten direkt an `dokument` [A: Implementierung waehlt die kleinere Form]; "undefiniert" = keine Bauteil-, Geschoss-, Einheit- oder Allgemein-Zuordnung. Fremde Gebaeude-IDs werden abgewiesen (400).
- Buchung KI-Verbrauch ueber dieselbe Budget-Tabelle wie `preis_lesung` (Zweck `suche_vektor`, `suche_antwort`, `ablage_vorschlag`) und dasselbe Monatsbudget [A: Tabelle verallgemeinern oder zweite Tabelle, kleinere Form].

**Auslesen** (Hintergrundjob, Muster wie Pruefer/Laeufer): startet, sobald ein Dokument `sauber` ist; beim Start einmalig fuer alle sauberen Dokumente mit `text_status = offen`.

- PDF: `pdfjs-dist` (im Web vorhanden, im Backend neu als Abhaengigkeit, gleiche Version, ohne eval/XFA/wasm) Seite fuer Seite; Seite ohne Text -> keine Abschnitte, Dokument ganz ohne Text -> `ohne_text` (Scan).
- docx/xlsx: ZIP lesen (vorhandener ZIP-Code aus der Typpruefung, sonst `node:zlib` inflateRaw), `word/document.xml` nach Absaetzen, `xl/sharedStrings.xml` + Blaetter je Blatt. Grenzen wie Typpruefung (fail closed).
- Abschnitte: je Seite/Blatt, bei langem Text in Stuecke ~1500 Zeichen mit kleiner Ueberlappung [A].
- Embeddings: nur wenn KI an und Schluessel gesetzt; Modell konfigurierbar, Standard ein kleines Embedding-Modell von OpenAI [A: Name und Preis vor dem Bauen auf der Modellseite pruefen]. Fehlt die KI: `vektor null`, Wortsuche funktioniert.

## 4. Ablaeufe

**4.1 Suchen** `GET /api/suche/gebaeude/:id?q=…`:

1. Rechte: nur Gebaeude, die der Benutzer sieht; nur `sauber`-Dokumente.
2. Wortsuche: `websearch_to_tsquery('german', unaccent(q))` plus `similarity(text, q)` (pg_trgm) fuer Tippfehler.
3. Sinnsuche (wenn KI an): Embedding der Frage, Kosinus gegen `vektor`.
4. Mischen per Reciprocal Rank Fusion [A]; Bonus fuer Dokumente, die mit Bauteilen verknuepft sind, deren Katalogname oder Hersteller/Typ ein Suchwort trifft ("Wärmepumpe" -> Unterlagen der Waermepumpe zuerst).
5. Antwort: bis 8 Fundstellen (Dokument, Ort, Ausschnitt mit Fettung, verknuepfte Bauteile).

**4.2 Antwort** `POST /api/suche/gebaeude/:id/antwort { q }` (getrennt, damit Fundstellen sofort erscheinen): die besten 6–8 Abschnitte gehen an das Antwortmodell (gleicher Anbieter, Modell konfigurierbar, Standard wie E45 [A]) mit festem JSON-Schema `{ gefunden: boolean, antwort: string, quellen: string[] }`. Planora akzeptiert nur Quellen-IDs, die es mitgeschickt hat; sonst `gefunden: false`. Kein Treffer -> "Nicht in den Unterlagen gefunden." plus naechstbeste Fundstellen. Budget erreicht oder KI aus -> nur Fundstellen, ruhiger Hinweis.

**4.3 Ordner ablegen:**

1. Browser liest den Ordner (`<input type="file" webkitdirectory>`, Pfade relativ); nichts wird hochgeladen, bevor der FM "Ablegen" waehlt.
2. Vorschlag ohne KI: Regeln nach Ordner-/Dateiname (Geschossname, Einheitsname, Bauteil-Hersteller/Typ, Katalogname); Rest "undefiniert".
3. Vorschlag mit KI `POST /api/dokumente/gebaeude/:id/vorschlag` mit Dateinamen, Ordnerpfad und Text der ersten Seite (Browser liest PDF-Text mit pdf.js; Office nur Name) und der Liste von Bauteilen/Geschossen/Einheiten des Gebaeudes; Antwort nur mit IDs aus dieser Liste (Schema, gegengeprueft).
4. Ablegen: bestehender Upload je Datei (Magic Bytes, Quarantaene, Scan unveraendert), dann Zuordnung setzen. Duplikate werden uebersprungen und gemeldet, ihre Zuordnung wird ergaenzt (Ruling 5 der Anlagenakte).

**4.4 Fehler:** Auslesen scheitert -> `text_status = fehler` mit Grund, Dokument bleibt nutzbar, kein Abbruch der Ablage. KI-Fehler -> Wortsuche bleibt. Alle Texte ueber `ablageFehlerText` bzw. eine Textquelle je Modul, nie rohe Codes.

## 5. Oberflaeche (planora-design Stufe mittel)

- **Suchfeld** in der Kopfzeile (Twin, Dokumente, Ablage, Erneuerungsplan), Kuerzel `/` und `Ctrl+K`, Bereich aktuelles Gebaeude.
- **Ergebnis-Panel**: oben Antwort (1–3 Saetze) mit Quellen-Links "Datenblatt WP.pdf, S. 3"; darunter bis 8 Fundstellen mit Dokument, Ort ("S. 3", "Blatt 2", "Abschnitt 4"), Bauteil, Ausschnitt.
- **Klick**: PDF -> Viewer `oeffne(d, seite, begriff)` mit markierter Stelle (T8); Sinn-Treffer ohne Wortgleichheit markieren den Abschnitt [A]. Office -> Ausschnitt plus Download.
- **Register "Ablage"** neben "Erneuerungsplan": Liste aller Dokumente mit Filter nach Zuordnung (Bauteil, Geschoss, Einheit, allgemein, undefiniert (n)); Knopf "Ordner ablegen" -> grosses Fenster mit Tabelle (Name, Pfad, Groesse, Zuordnung), Vorschlaege hellgrau, angefasst = bestaetigt, Mehrfachauswahl (Shift/Ctrl) + "Zuordnen zu …", "Ablegen (n Dateien)" mit Fortschritt und Ergebnisliste.
- Kein interner Text, keine Annahme-Marker, keine rohen Codes in der Oberflaeche (E47).

## 6. Pruefung und Abnahme

- Testsatz `werkzeug/suche/`: ca. 15 echt wirkende Dateien in Praxis-Ordnern (Datenblaetter WP/Pumpe/Kessel, Offerte, Wartungsvertrag, Excel-Anlageliste, Grundriss je Geschoss, 2 unklare), erzeugt per Skript, nicht im Repo als Binaer [A].
- 20 feste Fragen mit erwarteter Fundstelle; ohne KI ≥ 14/20 richtige Seite unter den ersten 3; mit KI ≥ 18/20 richtige Antwort, 0 erfundene Werte, 3 Fragen ohne Antwort ergeben "Nicht gefunden".
- Ordner-Ablage: ≥ 80 % richtige Vorschlaege, Zuordnung des Testordners in ≤ 10 Klicks [A].
- Kosten-Messlauf < $1 [A], nur mit PO-OK und Schluessel.
- Unit-/API-Tests (Auslesen, Rechte, Mischen, Quellenpruefung, Zuordnung fremder IDs), Gesamtreview, visual-critic mit echter GPU, PO-Sichtung.

## 7. Offen

- [A] Modellnamen und Preise (Embedding, Antwort) vor dem Bauen pruefen.
- [A] Abschnittsgroesse, RRF-Gewichte, Bonus fuer Bauteil-Bezug nach Messung anpassen.
- [?] Datenschutz mit Siemens: Textabschnitte gehen an OpenAI (fuer die Demo eigene Testdokumente, unkritisch).
