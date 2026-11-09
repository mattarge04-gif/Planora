# 0016 – Upload-Sicherheit: Quarantaene und Virenscan

Status: vorgeschlagen, angepasst durch E31 · 2026-11-08 / 2026-11-09 · Bezug: FA-07, FA-08, NFR Security

## Kontext
Kunden laden fremde Dateien hoch (Hersteller-PDFs, Excel mit Makros, Scans). Diese Dateien werden in Parsern (PDF, Excel, OCR) verarbeitet und anderen Benutzern angezeigt.

## Entscheid
> **Angepasst durch E31 (2026-11-09):** Upload mit **Uppy** und serverseitig abgeschlossenem S3-Multipart-Upload. Schliesst Review-Befund **K01**. Details und Ablauf: `06-bausteine-open-source.md` Kap. 4.1.

- **Client:** Uppy (MIT) mit `@uppy/aws-s3` im Multipart-Modus: Drag & Drop, Fortschritt, parallele Teile, Wiederaufnahme, Abbruch (FA-07: 1 GB / 50 Dateien pro Vorgang [A]).
- **Upload-Vertrag:**
  1. `POST /uploads` → Server startet `CreateMultipartUpload` unter `quarantaene/m/<mandant_id>/<upload_id>` und legt `dokument(status=hochladen)` an. Groessenlimit max. 512 MB pro Datei [A] wird serverseitig bei jedem Teil und beim Abschluss geprueft.
  2. Je Teil signiert der Server eine **kurzlebige URL nur fuer `UploadPart`** dieser Sitzung. Der Browser erhaelt **nie** eine PUT-URL fuer das ganze Objekt.
  3. `POST /uploads/{id}/abschliessen` → **nur der Server** ruft `CompleteMultipartUpload` auf, prueft per `HEAD` Groesse und ETag/Version und schreibt `status=hochgeladen`, `objekt_etag` **und** den Job `scan` in einer Transaktion. Der Scan-Job entsteht erst jetzt.
  4. Job `scan`: Worker liest das Objekt mit `If-Match: objekt_etag`, streamt die Bytes **einmal**: SHA-256, Magic-Byte-Pruefung (**file-type**), **ClamAV** (eigener Container, Signaturen taeglich [A], GPL-2.0 als separater Dienst unkritisch). ClamAV-Ergebnis "unbekannt"/Fehler gilt nie als sauber (H22).
  5. Nur "sauber" und erlaubter Typ → **dieselben gestreamten Bytes** werden nach `dok/m/<mandant_id>/<sha256>` geschrieben (inhaltsadressiert, unveraenderlich), Quarantaene-Objekt geloescht. Sonst `abgelehnt` mit Grund; Datei bleibt 7 Tage in Quarantaene fuer Analyse [A], ohne Vorschau/Download fuer normale Nutzer.
- Haengende Multipart-Uploads werden per Lifecycle-Regel/Job nach 24 h [A] abgebrochen.
- `@fastify/rate-limit` auf `POST /uploads` und Teil-Signierung.
- Excel-Makros werden nie ausgefuehrt; Parser laufen mit Speicher- und Zeitlimit; `docproc` ohne Netzausgang (ADR 0009).
- Vorschau im Browser nur ueber PDF.js aus eigener Domain, PDFs ohne JavaScript-Ausfuehrung (ADR 0022); Downloads mit `Content-Disposition: attachment`.
- **Rueckfall** (nur falls SOS die Multipart-Semantik nicht wie S3 umsetzt, Spike): Uppy + tus mit `tusd` (MIT) als eigener Container; Browser schreibt dann nie direkt in SOS.

## Alternativen
- Kein Scan: fuer Enterprise-Frageboegen nicht vertretbar.
- Kommerzieller Scan-Dienst (Cloud): Daten verlassen Planora-Infrastruktur.

## Konsequenzen
- + Unveraenderliche, deduplizierte Dokumentablage pro Mandant.
- − ClamAV braucht ca. 1–2 GB RAM [A].
- Spike vor Baubeginn: SOS-Multipart + `If-Match`; Race-Test "zweiter Upload zwischen Scan und Promotion" (Review K01/P1).
