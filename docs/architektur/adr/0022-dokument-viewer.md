# 0022 – Dokument-Viewer: Vorschau-PDF beim Upload, PDF.js, Markierung per Docling-Box

> **Status ab Welle 4: angepasst (E34–E37, 2026-11-09).**
> [A] Viewer, lokale Office-/Scan-Konvertierung und unveraenderte Originale bleiben Stufe 2; Pfade ohne `m/<mandant_id>`.
> [A] URLs nach Objekt-/Rollenrechten; Box-Feld/Koordinatensystem und Vorschau-Version vereinheitlichen. Suche und KI sind keine Voraussetzung zum Oeffnen.
> Der folgende Text ist die bisherige Fassung und bleibt als Historie erhalten.

Status: akzeptiert (PO-Entscheid E31) · 2026-11-09 · Bezug: E23, E26, FA-11

## Kontext
E23: Dokumente oeffnen sich direkt im Browser ohne Download (PDF, Bilder, Excel, Word→PDF); Herkunft einer Angabe springt auf Seite + Markierung. Ein eigener Viewer pro Office-Format waere teuer. E31 legt die Bausteine fest (`06-bausteine-open-source.md` Kap. 2, 4.2).

## Entscheid
- **Umwandlung beim Upload, nicht beim Anzeigen:** Nach dem Scan (ADR 0016) erzeugt ein Job ein **Vorschau-PDF** unter `abgeleitet/m/<mandant_id>/<sha256>.pdf`:
  - Word/Excel/PowerPoint → **Gotenberg** (LibreOffice-Route; Chromium-Route gesperrt; Makros aus; kein Internet).
  - Scans → **OCRmyPDF** (Textebene, PDF/A), damit auch Scans markier- und durchsuchbar sind.
  - Vektor-PDF → Original wird direkt angezeigt.
  - Das Original bleibt unveraendert und massgeblich (AD-4).
- **Anzeige:** **PDF.js** (`pdfjs-dist`) aus eigener Domain, ohne Skriptausfuehrung, ueber kurzlebige, mandantengebundene URLs. Bilder direkt. DWG/IFC: "nicht auswertbar" (FA-08).
- **Markierung:** Docling liefert je Textblock Seite + Bounding Box. `angabe` erhaelt die Spalte **`zitat_box`** (normierte Seitenkoordinaten 0..1); `such_abschnitt` (ADR 0023) speichert ebenfalls `bbox`. **React PDF Highlighter** zeichnet die Box und scrollt dorthin. Rueckfall bei fehlender Box: Textsuche im PDF.js-Textlayer.
- `pdfjs-dist` wird im Scaffold auf **eine** Version gepinnt, die Viewer und Highlighter gemeinsam nutzen.
- **Excel zusaetzlich als Tabelle:** exceljs liest die Blaetter im Worker nach JSON; der Viewer bietet eine Tabellenansicht mit **TanStack Table + TanStack Virtual**.
- Seiten-Vorschaubilder (Miniaturen) erzeugt der Worker mit **sharp**.

## Alternativen
- Collabora/ONLYOFFICE: AGPL, schwer, Bearbeitung nicht benoetigt.
- Umwandlung beim Anzeigen: Wartezeit fuer Benutzer, Last bei Spitzen.
- Markierung nur per Textsuche im Browser: unzuverlaessig bei Silbentrennung, Ligaturen, OCR-Fehlern.

## Konsequenzen
- + Ein einziger Viewer fuer alle Formate; Herkunftssprung (FA-11) und Suchtreffer (E26) nutzen dieselbe Markierung.
- − Zusaetzlicher Speicher in `abgeleitet/` (ca. Groesse der Originale [A]); Gotenberg-Container im Betrieb.
- Folgearbeit: Spalte `angabe.zitat_box`, Job `vorschau_erzeugen` im Dokument-Zustandsautomaten zwischen `geprueft` und `aufbereitet`.
