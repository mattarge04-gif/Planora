# 0009 – Dokumentverarbeitung: Python-Sidecar "docproc" (OCRmyPDF, Docling) + Claude

Status: vorgeschlagen, angepasst durch E31 · 2026-11-08 / 2026-11-09 · Bezug: E4, E7, FA-07..FA-15

> **Abweichung vom PO-Entscheid (gering):** E7 nennt einen Monolithen in TypeScript. Die besten lokal betreibbaren Werkzeuge fuer OCR und Tabellenstruktur sind Python-Bibliotheken. Planora betreibt deshalb einen **zustandslosen Python-Hilfscontainer ohne Fachlogik und ohne Datenbankzugriff**. Die gesamte Fachlogik bleibt im TypeScript-Monolithen.

## Kontext
Docling v2.149.0 (MIT), OCRmyPDF v17.13.0 (MPL-2.0), PaddleOCR v3.7.0 (Apache-2.0); Marker-Gewichte mit Umsatzschwelle → Lizenzrisiko [F, Q30/Q31-Tech]. Benchmarks widerspruechlich [F, Q33-Tech]. Excel braucht kein OCR [A, 02 Kap. 3].

## Entscheid
> **Angepasst durch E31 (2026-11-09):** docproc besteht aus **fertigen, unveraenderten Containern** statt eigenem Python-Dienst. Details: `06-bausteine-open-source.md` Kap. 4.3.

- `docproc` = drei Container, nur vom `worker` erreichbar, **kein DB-Zugriff, keine Netzverbindung nach aussen**, Speicher- und Zeitlimit je Container:
  - **Docling Serve** (MIT): Layout, Tabellen, Textbloecke **mit Seite und Bounding Box** aus PDF/DOCX/XLSX/PPTX als JSON.
  - **OCRmyPDF** (MPL-2.0, duenner Job-Wrapper): Textebene fuer Scans (deu+fra+ita+eng [A]) und PDF/A fuer das Vorschau-PDF (ADR 0022).
  - **Gotenberg** (MIT, nur LibreOffice-Route, Chromium-Route gesperrt, Makros aus): Office → Vorschau-PDF (ADR 0022).
- Der Worker spricht mit allen ueber den Port **`DokumentAufbereitung`** (ein Adapter je Container, AD-1). Eingabe: Objekt-Schluessel mit kurzlebiger, nur-lesender Signatur; Ausgabe: JSON bzw. PDF in `abgeleitet/`.
- Stufen: Typ-Erkennung per Magic Bytes (**file-type**) → bei Scan OCRmyPDF → Docling Serve → bei Office zusaetzlich Gotenberg. Die Image-Tags der drei Container sind Teil von `docproc_version` und damit von `pipeline_version` (03 Kap. 5.8).
- Excel/CSV werden im TS-Worker mit **exceljs** (MIT) geparst.
- Vektor-PDF-Text mit Koordinaten fuer Grundrisse liest der TS-Worker mit pdfjs-dist (Apache-2.0) [F, Q50-Tech].
- Claude erhaelt pro Seitenblock: die Seitenbilder (mit **sharp** skaliert) **und** den Docling-Text als klar abgegrenzte Daten (AD-6, Prompt-Injection-Schutz); die Antwort muss Seitenzahl und Zitat enthalten (ADR 0012).
- Reserve-Adapter `azure-di` (Switzerland North, USD 10 / 1'000 Seiten [F, Q32-Tech]) hinter demselben Port, standardmaessig aus.

## Alternativen
- Nur Claude-PDF ohne Vorverarbeitung: keine lokale Textgrundlage fuer die Zitat-Pruefung, kein Weg bei "KI aus".
- Marker: Lizenzrisiko [F, Q31-Tech].
- JavaScript-OCR (Tesseract-WASM): schwaecher bei Tabellen [A].

## Konsequenzen
- + Pipeline funktioniert auch mit KI aus (Text, Tabellen, Suche, regelbasiertes Mapping).
- + Lokal in CH, keine Daten an Dritte.
- + Kein eigener Python-Code mehr zu pflegen; Updates = Image-Tag erhoehen + Golden Set.
- − Drei Container statt einem (Betrieb, RAM). Ressourcen: Docling braucht viel RAM [A] → eigener Container mit Speicherlimit, Spike S8.
