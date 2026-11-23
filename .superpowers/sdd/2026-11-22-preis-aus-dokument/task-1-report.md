# Task 1 Report

Status: DONE_WITH_CONCERNS (Step 7 bewusst nicht ausgefuehrt, per Controller-Ruling).

Gebaut: 6 HTML-Offerten, `erzeuge.mjs` (6 PDFs erzeugt; o3 = 3 Seiten, o5 = 1 Seite Bild-PDF ohne Font), `soll.json` (Katalog-IDs aus katalog.v2.ts), `probe.mjs`, `README.md` (Abschnitt "Probe: offen"), `.gitignore` (pdf/), `openai@7.62.0` (exakt gepinnt, Apache-2.0).

Verifikation: `erzeuge.mjs` laeuft, 6 PDFs; `probe.mjs` ohne Key bricht mit "OPENAI_API_KEY fehlt – PO legt ihn lokal an" ab (Exit 1); soll.json parst. Doku per WebFetch geprueft, Feldnamen zusaetzlich gegen `openai/resources/responses/responses.d.ts` (7.62.0).

Abweichungen/Concerns: (1) Modellseite listet nur text+image als Eingabe, PDF-Eingabe nicht ausdruecklich [A] bis Probe. (2) `["number","null"]` in strict nur fuer string belegt, number [A]. (3) Echter API-Aufruf offen.
Geaendert: werkzeug/preisdokument/*, .gitignore, app/package.json, app/package-lock.json.

## Fix round 1
- probe.mjs: Import jetzt `import(pathToFileURL(require.resolve("openai")).href)` (pathToFileURL aus node:url). SDK liest `OPENAI_BASE_URL` selbst, kein expliziter baseURL im Skript.
- Pruefung ohne externen Aufruf: `OPENAI_API_KEY=x OPENAI_BASE_URL=http://127.0.0.1:9 node werkzeug/preisdokument/probe.mjs` -> Paket laedt, `APIConnectionError: Connection error.` (probe.mjs:35). Kein Kontakt zu api.openai.com.
- o3-PDF: genau 3 Seiten (Zaehlung `/Type /Page`), keine Aenderung noetig.
- README: Hinweis, dass o6-Werte nur Injection-Test sind.
