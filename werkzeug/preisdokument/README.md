# Preis aus Dokument: Testdokumente und Probeaufruf

Sechs fiktive Offerten (erfundene Firmen, keine echten Marken) mit Sollwerten fuer die Preisextraktion (Plan "Preis aus Dokument", Task 1).

- `dokumente/*.html`: Quellen. `node werkzeug/preisdokument/erzeuge.mjs` rendert sie nach `pdf/` (git-ignoriert, reproduzierbar). `o5-scan` wird als reines Bild-PDF ohne Textschicht erzeugt. Benoetigt Playwright mit Chromium (gleicher Lader wie `werkzeug/design/screenshot.mjs`).
- `soll.json`: Sollwerte je PDF (`position`, `ersatzpreis`, `katalogId`, `anzahl`). Katalog-IDs aus `app/src/welt/katalog.v2.ts`. `o6`: keine Zuordnung (`katalogId: null`), kein Preis 1.00 (Injection-Test).
- `probe.mjs`: ein einziger Aufruf mit `o1-pumpen.pdf` an `gpt-6.2-sol`, `store: false`. Bricht ohne `OPENAI_API_KEY` ab (Meldung "OPENAI_API_KEY fehlt – PO legt ihn lokal an"; geprueft).

## Paket

`openai@7.62.0` (exakt gepinnt in `app/package.json`), Lizenz Apache-2.0 (laut npm und Paket-`package.json`).

## Probe: offen (wartet auf PO-OK und OPENAI_API_KEY)

Der echte Aufruf wurde nicht ausgefuehrt. Ausfuehren nach PO-OK: `OPENAI_API_KEY=... node werkzeug/preisdokument/probe.mjs` (Kosten < $0.05 [A]). Erwartet: JSON mit 4 Pumpen-Positionen auf Seite 1. Ergebnis (Tokens, Kosten, Abweichungen) hier nachtragen. Schlaegt PDF-Eingabe fehl: anhalten und PO fragen (Spec Abschnitt 10).

## Doku-Pruefung (Feldnamen)

Quellen: Seiten `developers.openai.com/api/docs/guides/file-inputs`, `.../guides/structured-outputs`, `.../models/gpt-6.2-sol` (per WebFetch, Zusammenfassung) sowie TypeScript-Typen des installierten Pakets `openai@7.62.0` (`resources/responses/responses.d.ts`).

Bestaetigt wie angenommen:
- `client.responses.create({ model, input: [{ role: "user", content: [...] }], store, text })`.
- `input_file` mit `filename` und `file_data` (Data-URL `data:application/pdf;base64,...`); optional `detail` (`auto|low|high`, `auto` = `high` ab GPT-5.6, davor `low`; wirkt nur auf Seitenbilder, nicht auf extrahierten Text). Alternativen `file_id`, `file_url`. Limit 50 MB je Datei und je Anfrage.
- `text.format = { type: "json_schema", name, schema, strict }`; `name` nur a-z, A-Z, 0-9, Unterstrich.
- `response.output_text`, `response.usage.input_tokens` (Typ `ResponseUsage`; `output_tokens` analog), `store?: boolean`.
- Modell `gpt-6.2-sol` existiert, Structured Outputs unterstuetzt, Preis laut Seite $2 / 1M Eingabe, $10 / 1M Ausgabe, gecachte Eingabe $0.1 / 1M.

Abweichungen / offen:
- Die Modellseite nennt als Eingabe nur "text, image", PDF-Eingabe wird dort nicht ausdruecklich genannt. Die Datei-Guide-Seite sagt, PDF-Parsing mit Seitenbildern braucht ein bildfaehiges Modell. PDF-Eingabe mit `gpt-6.2-sol` ist damit bis zur Probe [A].
- Strict Structured Outputs: `type: "integer"` ist in Doku-Beispielen belegt. `type: ["number","null"]`: Doku zeigt nur `["string","null"]` (Moderationsbeispiel); fuer `number` [A], Probe verwendet es (`preis`). Der Abschnitt "supported schemas" der Seite wurde nicht gelesen (Seite gekuerzt). Alle Felder muessen in `required` stehen, `additionalProperties: false`.
- Task 4 uebernimmt die Feldnamen unveraendert; kein Nachzug noetig ausser dem Ergebnis der Probe.
