# Anlagenakte – Abnahmewerkzeug (nur Entwicklung)

Browser-Abnahme der Anlagenakte (Plan `docs/superpowers/plans/2026-11-23-anlagenakte.md`, Task 10) gegen die Testinstanz auf Port 3100. Nicht Teil des Produkts.

```bash
node werkzeug/preisdokument/erzeuge.mjs            # einmalig: Offerten-PDFs (o1 wird kopiert)
node werkzeug/anlagenakte/erzeuge.mjs              # Abnahmedateien nach dateien/ (git-ignoriert)
bash werkzeug/design/instanz.sh start --muster     # je Lauf frisch (Abnahme legt Dateien ab und loescht)
node werkzeug/design/lebensdauer-daten.mjs
node werkzeug/design/anlagenakte-daten.mjs
node werkzeug/anlagenakte/abnahme.mjs --aus docs/abnahme/<datum>-anlagenakte --fenster 1440x900
```

- `erzeuge.mjs`: `datenblatt-pumpe.pdf` (2 Seiten, Seite 2 "Förderhöhe 6.5 m"), `foto-zentrale.png`, `kosten.xlsx` (minimales SpreadsheetML, ZIP ohne Kompression), `o1-pumpen.pdf`.
- `eicar-ablegen.mjs`: legt eine PDF-Huelle mit EICAR-Zeichenkette ueber die API ab (nur im Speicher) und wartet auf den Scan-Befund. Erwartet "abgelehnt (Eicar-Test-Signature)".
- `abnahme.mjs`: Ablaeufe 1–8 mit echter GPU (Chromium `--use-angle=d3d11`), zaehlt Nutzerklicks je Ablauf, Screenshots und `bericht-<fenster>.json` in `--aus`. Die Leser-Ansicht ist nur in der Anzeige simuliert (`darfAendern=false` in den JSON-Antworten), weil der Entwicklungsstart kein Leser-Konto hat und keine API eines anlegt.
- Playwright wird wie in `werkzeug/design/screenshot.mjs` im npx-Cache gesucht.
