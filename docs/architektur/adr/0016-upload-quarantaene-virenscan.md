# 0016 – Upload-Sicherheit: Quarantaene und Virenscan

Status: vorgeschlagen · 2026-11-08 · Bezug: FA-07, FA-08, NFR Security

## Kontext
Kunden laden fremde Dateien hoch (Hersteller-PDFs, Excel mit Makros, Scans). Diese Dateien werden in Parsern (PDF, Excel, OCR) verarbeitet und anderen Benutzern angezeigt.

## Entscheid
- Upload direkt in den Objektspeicher per **signierter PUT-URL** in den Bereich `quarantaene/m/<mandant_id>/<upload_id>`; Groessenlimit in der Signatur (max. 512 MB pro Datei [A]; 1 GB/50 Dateien pro Vorgang laut FA-07 [A]).
- Nach Upload: Job `scan` → **ClamAV** (eigener Container, Signaturen taeglich aktualisiert [A: Lizenz GPL-2.0, als separater Dienst unkritisch, Version im Scaffold]) + Magic-Byte-Typpruefung + SHA-256.
- Nur "sauber" und erlaubter Typ → Kopie nach `dok/m/<mandant_id>/<sha256>` (inhaltsadressiert, unveraenderlich), Quarantaene-Objekt geloescht. Sonst Status `abgelehnt` mit Grund; Datei bleibt 7 Tage in Quarantaene fuer Analyse [A], dann geloescht.
- Excel-Makros werden nie ausgefuehrt; Parser laufen mit Speicher- und Zeitlimit; `docproc` ohne Netzausgang (ADR 0009).
- Vorschau im Browser nur ueber pdf.js aus eigener Domain, PDFs ohne JavaScript-Ausfuehrung [A]; Downloads mit `Content-Disposition: attachment`.

## Alternativen
- Kein Scan: fuer Enterprise-Frageboegen nicht vertretbar.
- Kommerzieller Scan-Dienst (Cloud): Daten verlassen Planora-Infrastruktur.

## Konsequenzen
- + Unveraenderliche, deduplizierte Dokumentablage pro Mandant.
- − ClamAV braucht ca. 1–2 GB RAM [A].
