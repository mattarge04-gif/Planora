# Anlagenakte (Stufe 2 Rest) – Design

23.11.2026 · PO-Entscheid E46 · Bezug: Weg zu V1 Stufe 2 (M3, M4, M5), ADR 0016, ADR 0022, ADR 0027, Spec Preis aus Dokument (2026-11-22)

## 1. Ziel und Umfang

Der FM legt Unterlagen (Datenblaetter, Plaene, Offerten, Fotos, Protokolle) je Gebaeude ab, verknuepft sie mit Bauteilen und oeffnet sie direkt in Planora. Jede Datei wird vor der Freigabe auf Viren geprueft. Die Bauteil-Bibliothek der Heizung wird vervollstaendigt.

Umfang "schlank" (PO 23.11.):

- **Teil A – Upload und Scan:** Ablage je Gebaeude, Verknuepfung mit 0..n Bauteilen, Quarantaene + ClamAV.
- **Teil B – Viewer:** PDF (PDF.js) und Bilder im Planora-Fenster; Office nur herunterladen.
- **Teil C – Bibliothek:** Heizung fertig (Datenblatt-Felder, Lebensdauer-Quelle, Icon je Typ; neue Modelle Waermezaehler, Ausdehnungsgefaess, Sonstiges).

Nicht dabei: Office-/Scan-Anzeige (Gotenberg, OCRmyPDF), Excel als Tabelle, Miniaturen, KI-Auslesen von Datenblaettern (Stufe 7), Suche (Stufe 6), weitere Gewerke.

Kosten: Alles laeuft lokal und ohne Kosten (PO: Kostenpflichtiges erst nach Firmengruendung mit Budget). ClamAV ist freie Software als eigener Container.

## 2. Ansatz

Die bestehende Ablage aus "Preis aus Dokument" (Tabelle `dokument`, Migration 017) wird zum allgemeinen Modul `dokumente`. `preisdokument` bleibt Optionsmodul und haengt von `dokumente` ab; es besitzt nur noch Vorschlaege und das Lesen.

Abweichung von ADR 0016: kein Multipart-/tus-Upload (Speicher ist lokal, ADR 0027); Upload in einem Request. Quarantaene, ClamAV, Magic-Byte-Pruefung und "Fehler gilt nie als sauber" bleiben. ADR 0016 erhaelt einen Nachtrag.

Verworfen: Vollausbau nach ADR 0016 (Uppy/tus, ~+4 PT ohne Nutzen bei lokalem Speicher); eigenes Modul neben der Preis-Ablage (doppelte Ablage und Rechtepruefung).

## 3. Daten und Module

**Modul `dokumente`** (Lieferstufe 1, Routen `/api/dokumente/`; der Eintrag im Manifest existiert). Die Dokumentrouten aus `src/preisdokument/routen.ts` (Upload, Liste, Datei, Loeschen) wandern nach `src/dokumente/`; `preisdokument` behaelt Vorschlaege, Lesen, Uebernehmen.

**Migration 018:**

- `dokument` verallgemeinert:
  - `art` (`pdf` | `bild` | `office`) und `mime`, erkannt aus Magic Bytes, nie aus der Endung.
  - `kategorie` (`datenblatt` | `plan` | `offerte` | `foto` | `protokoll` | `sonstiges`), vorbelegt aus der Art [A] (Bild -> foto, sonst sonstiges), vom FM aenderbar.
  - `scan_status` (`quarantaene` | `sauber` | `abgelehnt` | `scan_fehler`), `scan_grund` (Signaturname/Fehlertext, ≤ 300), `gescannt_am`.
  - `auslesen_status` bleibt, gilt nur fuer PDFs; neuer Startwert fuer neue Dokumente `aus` (kein automatisches Lesen, siehe 4.9).
  - `seiten` nullable (nur bei PDF bekannt); Check `seiten between 1 and 100` entfaellt fuer die Ablage, die 100-Seiten-Grenze gilt nur beim Lesen.
  - Groesse ≤ 100 MB je Datei [A].
- `dokument_bauteil(dokument_id, bauteil_id)` mit Primaerschluessel aus beiden, beide `on delete cascade`.
- Bestehende Dokumente aus 017: `art='pdf'`, `kategorie='offerte'`, `scan_status='sauber'` [A] (nur Testdaten, vor dem Scan abgelegt); bestehende `preis_vorschlag.bauteil_ids` bleiben unveraendert, sie sind keine Verknuepfung.

**Speicher:** bestehender sha256-Speicher `ablage` plus Quarantaene-Bereich (eigener Unterordner, gleicher Mechanismus). Nach sauberem Scan werden dieselben Bytes in die Ablage uebernommen und die Quarantaene-Kopie geloescht. Abgelehnte Dateien bleiben 7 Tage [A] in der Quarantaene, ohne Vorschau und Download; danach loescht die Bereinigung sie.

**Scanner-Port** `VirenScanner { pruefe(datei): Promise<{ ergebnis: "sauber" } | { ergebnis: "befund"; signatur: string }> }`, wirft bei Ausfall.

- Produktion: `clamd` per TCP (`INSTREAM`), eigener Container im Compose-Paket, Signaturen per `freshclam` taeglich [A], RAM 1–2 GB [A].
- Entwicklung/Tests: Fake-Scanner, meldet sauber, lehnt die EICAR-Testzeichenkette ab.
- Konfiguration `PLANORA_CLAMD_HOST`/`PLANORA_CLAMD_PORT`; ohne Konfiguration im Entwicklungsstart der Fake-Scanner, in Produktion Pflicht (Start bricht ab [A]).

**Teil C Bibliothek:** Katalog `heizung.*` erhaelt je Typ:

- Datenblatt-Felder (Schluessel, Bezeichnung, Einheit), z. B. Waermepumpe Leistung kW / COP, Speicher Volumen l, Pumpe DN / Foerderhoehe m, Ventil DN / kvs;
- Lebensdauer-Quelle (Text und Jahr der Quelle) zu den bestehenden Standardwerten [A];
- Icon.

Neue Typen mit GLB: `heizung.wmz` erhaelt ein Modell (Typ existiert), neu `heizung.ausdehnungsgefaess` und `heizung.sonstiges`. Werte der Datenblatt-Felder speichert `bauteil_akte` (neue Spalte `datenblatt jsonb`, Schluessel aus dem Katalog geprueft).

## 4. Ablaeufe

1. **Ablegen:** Drag & Drop oder Knopf auf der Seite "Dokumente" oder in der Anlagenkarte (dann gleich mit dem Bauteil verknuepft). Mehrere Dateien moeglich.
2. **Pruefen beim Upload:** Groesse, Magic Bytes, erlaubter Typ (PDF; JPG, PNG, HEIC; docx, xlsx, pptx sowie doc, xls, ppt [A]). Sonst 400 mit Grund. Office-Dateien werden nie ausgefuehrt oder geparst.
3. **Quarantaene:** Status `quarantaene`. Gleicher Inhalt im gleichen Gebaeude: kein Duplikat, Meldung "Ist schon abgelegt." (wie Preis aus Dokument).
4. **Scan** im Hintergrund-Laeufer (max. 2 gleichzeitig): sauber -> Uebernahme in die Ablage, `sauber`; Befund -> `abgelehnt` mit Signatur, Audit-Eintrag; Scanner nicht erreichbar/Fehler -> `scan_fehler`, gesperrt, "Erneut pruefen" (Schreibrecht). Nach Neustart werden `quarantaene`-Dateien neu eingereiht (kostenlos).
5. **Verknuepfen:** Detailansicht, Mehrfachauswahl gefiltert nach Typ, Geschoss, Name; bei Kategorie Datenblatt werden Bauteile des passenden Typs vorgeschlagen [A]. Nur bei `sauber`.
6. **Oeffnen:** PDF und Bild im Planora-Viewer, Sprung auf Seite n; Office und "Herunterladen" als `attachment`. Antworten mit `x-content-type-options: nosniff`.
7. **Rechte:** lesen `fach.lesen`, ablegen/verknuepfen/Kategorie/loeschen `fach.aendern`; fremde Gebaeude 404; nicht `sauber` liefert nie Bytes (auch nicht an den Admin [A]).
8. **Loeschen:** Verknuepfungen weg, uebernommene Preise behalten Quelle "Dokument (geloescht)", Datei ueber Loeschjournal in die Bereinigung.
9. **Preise lesen:** Knopf nur bei sauberen PDFs und KI an; kein automatisches Lesen nach dem Upload mehr (aendert Spec Preis aus Dokument Abschnitt 4: Lesen startete bisher automatisch).

## 5. Oberflaeche (planora-design Stufe mittel)

**Seite "Dokumente"** (erweitert die heutige Seite "Dokumente und Preise"):

- Umschalter oben "Alle Dokumente | Preise pruefen (n)"; der zweite Zustand ist die heutige Preis-Ansicht inkl. "Alle sicheren uebernehmen".
- Links Ablage: Ablegeflaeche, Liste mit Name, Kategorie, Datum, Groesse, Scan-Status ("wird geprueft …", sauber als stiller Punkt, "abgelehnt" rot mit Grund, "Pruefung fehlgeschlagen" mit "Erneut pruefen"); Filter Kategorie und "nicht verknuepft".
- Rechts Detail: Vorschau, Kategorie, verknuepfte Bauteile (hinzufuegen/entfernen), Knoepfe Oeffnen, Herunterladen, Preise lesen (nur PDF + KI an), Loeschen; Preis-Vorschlaege der Datei darunter.

**Viewer** (Overlay, Esc schliesst): PDF.js mit Seitenleiste, Seite n, Zoom, Textsuche; Bilder mit Zoom; Kopf mit Name, Kategorie, Herunterladen, Schliessen. PDFs ohne Skriptausfuehrung (ADR 0022), `pdfjs-dist` auf eine Version gepinnt, Worker aus eigener Domain (CSP). Oeffnet aus Seite, Anlagenkarte und Fundstellen ("S. n ↗" oeffnet kuenftig den Viewer statt neuen Tab).

**Anlagenkarte:** Abschnitt "Unterlagen (n)" mit Kategorie-Icon und Name, Klick oeffnet den Viewer, "+ Ablegen" verknuepft direkt. Abschnitt "Datenblatt" mit den Feldern des Typs, Handeingabe [A].

**Twin-Szene:** keine Aenderung (Regel 20), kein Dokument-Filter in der Legende [A]. **Leser:** sieht und oeffnet alles, keine Schreibknoepfe.

## 6. Pruefung und Abnahme

- **Backend-Tests:** Magic Bytes (falsche Endung, Office, EXE als .pdf), Grenze 100 MB, Duplikat, Rechte (Leser 403, Fremd 404, nicht sauber keine Bytes), Scan-Laeufer mit Fake (sauber, EICAR, Ausfall -> `scan_fehler`, Neustart reiht neu ein), Verknuepfen/Entfernen/Bauteil geloescht, Loeschen mit Journal, Preise lesen nur bei sauberem PDF, Migration 018 mit Altbestand, Datenblatt-Felder nur mit Katalog-Schluesseln.
- **Web-Tests:** reine Funktionen (Status-Texte, Filter, Kategorie-Vorbelegung, Viewer-Seitennavigation).
- **Docker-Test** (`test:docker`): echter ClamAV-Container lehnt EICAR ab, laesst sauberes PDF durch.
- **Gestaltung:** ui-ux-designer (Seite, Viewer, Unterlagen, Datenblatt), 3d-designer (3 Modelle im bestehenden Stil), visual-critic mit GPU-Screenshots 1440/1280/1920, max. 3 Runden.
- **Browser-Abnahme (Muster 6, lokal):** 5 Dateien ablegen (Datenblatt-PDF, Foto, Excel, Offerte o1, EICAR-Testdatei) -> EICAR abgelehnt, Rest sauber; Datenblatt mit 2 Pumpen verknuepfen, in der Anlagenkarte oeffnen, Seite 2 anspringen; Excel herunterladen; Loeschen; Leser-Ansicht; Klicks zaehlen; PO-Sichtung.

**Aufwand [A]:** Teil A 3–4 PT, Teil B 2–3 PT, Teil C 2–3 PT; zusammen 7–10 PT.

## 7. Offen

- [?] Siemens-Frageboegen: Update-Takt der Virensignaturen auf der VM, Verhalten ohne Internet (Signaturversorgung On-Premise).
- [A] Aufbewahrung abgelehnter Dateien 7 Tage.
- [A] Lebensdauer-Quellen und Datenblatt-Felder fachlich nicht freigegeben.
- [A] Alte Office-Formate (doc/xls/ppt) zulassen.
