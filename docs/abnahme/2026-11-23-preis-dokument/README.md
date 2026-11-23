# Abnahme Preis aus Dokument (Stand 23.11.2026)

## Was gebaut ist

- Backend-Modul `app/src/preisdokument/`: PDF-Upload mit Prüfung (Grösse, Seiten), Ablage, Lesen über OpenAI (`gpt-6.2-sol`, Responses API, `store: false`, strukturierte Antwort), Prüfung der Antwort (`pruefeVorschlaege`), Läufer mit zwei gleichzeitigen Lesungen und Monatsbudget (Standard 20 USD), Vorschläge übernehmen oder verwerfen, Quelle "Dokument" am Preis. Ohne `OPENAI_API_KEY` bleibt das Lesen aus (Status "aus").
- Web: Seite "Dokumente" (Upload, Fortschritt, Vorschläge mit Zitat und Rechenweg, "Alle sicheren übernehmen"), Einstiege aus Legende, Anlagenkarte und Erneuerungsplan, Quelle neben dem Preis.
- Werkzeug: `werkzeug/preisdokument/` mit sechs fiktiven Offerten, `soll.json`, `probe.mjs`, `messlauf.mjs` (neu), `vorschlaege-fixture.mjs`.
- Kein echter KI-Aufruf ist erfolgt (kein Schlüssel vorhanden, kein PO-OK).

## Prüfstand (23.11.2026)

| Prüfung | Ergebnis |
|---|---|
| Backend `npx vitest run` (app) | 675/675 (68 Dateien) |
| Backend `npm run pruefe:typen` | grün |
| Web `npx vitest run` (app/web) | 560/560 (58 Dateien) |
| Web `npx tsc --noEmit -p .` | grün |
| Web `npm run build` | grün |

## Nachtrag Zeichensatz (Task 9)

Die eingebettete Entwicklungs- und Test-PostgreSQL lief unter Windows mit WIN1252. KI-Antworten enthalten Zeichen wie das Minuszeichen U+2212, die dort nicht gespeichert werden konnten (Lesevorgang endete mit "Interner Fehler beim Lesen"). Behoben: neue Cluster werden mit `--encoding=UTF8 --locale=C` angelegt (`app/test/globalSetup.ts`, `app/entwicklung/start.ts`; die Testinstanz `werkzeug/design/instanz.sh` startet über `start.ts`). Produktion (Docker-Image `postgres:18-bookworm`, Standard UTF8) war nicht betroffen. Regressionstest: `app/test/preisdokument-kodierung.test.ts` (Minus, Euro, Pfeil, Apostroph, Emoji werden gespeichert und unverändert gelesen). Eine bereits laufende Testinstanz muss neu gestartet werden, damit sie einen UTF8-Cluster erhält.

## Bilder

Kritiken und Screenshots (1440/1280, Funktion, Leerzustand, Filter): `docs/design/kritiken/2026-11-23-preis-dokument/` (zuletzt `r2.md`, `r2/`, `r2-funktion/`, `r2-leer/`, `r2-filter/`; Urteil r2 "bereit").

## Offen – wartet auf PO

Alle Punkte brauchen einen OpenAI-Schlüssel und das ausdrückliche OK des PO. Es sind echte, kostenpflichtige Aufrufe.

**Schlüssel lokal setzen (nie im Repo):** Windows-Einstellungen, "Umgebungsvariablen für Ihr Konto bearbeiten", neue Benutzervariable `OPENAI_API_KEY`. Oder nur für das aktuelle PowerShell-Fenster: `$env:OPENAI_API_KEY = "sk-..."`. Danach neues Terminal öffnen. Optional anderes Modell: `PLANORA_KI_MODELL_PREIS`.

1. **Probe** (ein Aufruf, unter 0.05 USD [A]): `node werkzeug/preisdokument/probe.mjs`. Prüft, ob `gpt-6.2-sol` PDF-Eingabe und das Schema mit `["number","null"]` akzeptiert. Schlägt es fehl: anhalten und PO fragen (Spec Abschnitt 10). Ergebnis in `werkzeug/preisdokument/README.md` nachtragen.
2. **Messlauf** (sechs Aufrufe, unter 2 USD [A]). Zuerst den Kontext aus der Testinstanz sichern, einmalig:
   ```
   bash werkzeug/design/instanz.sh start --muster
   node werkzeug/design/lebensdauer-daten.mjs
   cd app
   npx tsx ../werkzeug/preisdokument/messlauf.mjs --export-kontext
   ```
   Dann der echte Lauf (aus `app/`): `npx tsx ../werkzeug/preisdokument/messlauf.mjs`. Ohne Schlüssel bricht er mit "OPENAI_API_KEY fehlt – PO legt ihn lokal an" ab. Ergebnis: `docs/abnahme/2026-11-23-preis-dokument/messlauf.md` (Dokument, Treffer/Soll, Zeit, Tokens, Kosten). Treffer = Ersatzpreis ±1 CHF und gleiche Katalog-ID; Fall o6 gilt als bestanden, wenn kein Preis 1.00 und keine Zuordnung vorkommt. Ziel Trefferquote ≥ 80 % [A]; darunter Prompt nachschärfen (höchstens 2 Runden) oder PO fragen. Die Auswertung ist offline mit `app/test/messlauf-logik.test.ts` und `--trocken antworten.json` geprüft.
3. **Browser-Abnahme mit Schlüssel** (Muster 6): Testinstanz mit gesetztem `OPENAI_API_KEY` neu starten (`bash werkzeug/design/instanz.sh stop`, dann `start --muster`; Demo-Daten `node werkzeug/design/lebensdauer-daten.mjs`), `http://localhost:3100/entwicklung/anmelden`, "Muster 6", Seite Dokumente.
   - o1, o2 und o4 hochladen (PDFs: `node werkzeug/preisdokument/erzeuge.mjs`, Ordner `werkzeug/preisdokument/pdf/`), Vorschläge prüfen, "Alle sicheren übernehmen".
   - Legende "ohne Preis" von 8 auf höchstens 2.
   - Ampel, Erneuerungsplan und CSV zeigen dieselben Summen.
   - Klicks zählen; Screenshots 1440 und 1280.
4. Danach: visual-critic Gesamtblick, CLAUDE.md-Block und Journal (Virenscan, Siemens/OpenAI-Vertrag, EU-Datenresidenz bleiben offene Punkte).
