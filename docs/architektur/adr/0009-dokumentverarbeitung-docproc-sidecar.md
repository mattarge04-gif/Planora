# 0009 – Dokumentverarbeitung: Python-Sidecar "docproc" (OCRmyPDF, Docling) + Claude

Status: vorgeschlagen · 2026-11-08 · Bezug: E4, E7, FA-07..FA-15

> **Abweichung vom PO-Entscheid (gering):** E7 nennt einen Monolithen in TypeScript. Die besten lokal betreibbaren Werkzeuge fuer OCR und Tabellenstruktur sind Python-Bibliotheken. Planora betreibt deshalb einen **zustandslosen Python-Hilfscontainer ohne Fachlogik und ohne Datenbankzugriff**. Die gesamte Fachlogik bleibt im TypeScript-Monolithen.

## Kontext
Docling v2.149.0 (MIT), OCRmyPDF v17.13.0 (MPL-2.0), PaddleOCR v3.7.0 (Apache-2.0); Marker-Gewichte mit Umsatzschwelle → Lizenzrisiko [F, Q30/Q31-Tech]. Benchmarks widerspruechlich [F, Q33-Tech]. Excel braucht kein OCR [A, 02 Kap. 3].

## Entscheid
- Container `docproc` (Python), interne HTTP-Schnittstelle, nur vom `worker` erreichbar. Eingabe: Objekt-Schluessel im Quarantaene-freien Bucket mit kurzlebiger, nur-lesender Signatur. Ausgabe: JSON (Seiten, Textbloecke mit Koordinaten, Tabellen) in den Objektspeicher. **Kein DB-Zugriff, keine Netzverbindung nach aussen.**
- Stufen: Typ-Erkennung per Magic Bytes → bei Scan OCRmyPDF (deu+fra+ita+eng [A]) → Docling (Layout, Tabellen) → Ergebnis versioniert (`docproc_version`).
- Excel/CSV werden im TS-Worker direkt geparst [A: Bibliothek im Scaffold waehlen, Lizenz pruefen].
- Vektor-PDF-Text mit Koordinaten fuer Grundrisse liest der TS-Worker mit pdfjs-dist 6.5 (Apache-2.0) [F, Q50-Tech].
- Claude erhaelt pro Seitenblock: die Seitenbilder **und** den Docling-Text; die Antwort muss Seitenzahl und Zitat enthalten (ADR 0012).
- Reserve-Adapter `azure-di` (Switzerland North, USD 10 / 1'000 Seiten [F, Q32-Tech]) hinter demselben Port, standardmaessig aus.

## Alternativen
- Nur Claude-PDF ohne Vorverarbeitung: keine lokale Textgrundlage fuer die Zitat-Pruefung, kein Weg bei "KI aus".
- Marker: Lizenzrisiko [F, Q31-Tech].
- JavaScript-OCR (Tesseract-WASM): schwaecher bei Tabellen [A].

## Konsequenzen
- + Pipeline funktioniert auch mit KI aus (Text, Tabellen, Suche, regelbasiertes Mapping).
- + Lokal in CH, keine Daten an Dritte.
- − Zweite Sprache im Betrieb (Python-Image, eigene Updates). Ressourcen: Docling braucht viel RAM [A] → eigener Container mit Speicherlimit, Spike S8.
