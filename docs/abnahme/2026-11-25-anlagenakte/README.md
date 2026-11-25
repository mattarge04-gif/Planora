# Abnahme Anlagenakte (Stand 25.11.2026)

Plan `docs/superpowers/plans/2026-11-23-anlagenakte.md`, Task 10. Lokale Testinstanz (Port 3100, `--muster`, Fake-Scanner), Gebäude "Muster 6 L-Form viele Gruppen", Daten aus `lebensdauer-daten.mjs` und `anlagenakte-daten.mjs`. Kein `OPENAI_API_KEY`, keine KI-Aufrufe.

Durchführung: `werkzeug/anlagenakte/abnahme.mjs` (siehe `werkzeug/anlagenakte/README.md`), je Fenster auf frischer Instanz. Renderer: ANGLE NVIDIA GeForce RTX 3070 Ti, Direct3D11 (echte GPU). Beide Läufe (1440x900, 1280x720) mit identischem Ergebnis. Protokolle: `bericht-1440x900.json`, `bericht-1280x720.json` (Konsole: nur bekannte three.js-Shaderwarnungen, keine Fehler, keine CSP-Verletzung).

## Ergebnis je Schritt

| # | Ablauf | Ergebnis | Klicks | Bilder |
|---|---|---|---|---|
| 1 | Ablegen: Datenblatt-PDF, Foto, Excel per Knopf (eine Dateiauswahl), Offerte o1 per Ziehen; EICAR über `eicar-ablegen.mjs` | ok: 4 Dateien "geprüft", EICAR "abgelehnt (Eicar-Test-Signature)", gesperrt mit Hinweis 7 Tage | 5 (inkl. 3 Navigation, 1 Detail EICAR) | `01-*` |
| 2 | Datenblatt: Kategorie "Datenblatt", 2 Pumpen verknüpfen (Filter Typ Umwälzpumpe) | ok | 7 | `02-*` |
| 3 | Twin, Anlagenkarte Pumpe, "1 Unterlage", Viewer, Seite 2, Suche "Förderhöhe", Esc | ok: Seite 2, Treffer "1 / 1", Esc schliesst nur den Viewer | 6 | `03-*` |
| 4 | Datenblatt DN 32, Förderhöhe 6.5 erfassen | **teilweise**: gespeichert und angezeigt; zweite verknüpfte Pumpe bleibt leer (siehe Befund B1) | 4 | `04-*` |
| 5 | Excel herunterladen | ok: Download `kosten.xlsx`, kein Öffnen-Knopf, kein Viewer | 4 (inkl. 2 Navigation) | `05-*` |
| 6 | Offerte o1: "Preise lesen", Umschalter "Preise prüfen (n)" | **Befund B2**: "Preise lesen" ohne Schlüssel gar nicht sichtbar; Umschalter "Preise prüfen 0" vorhanden | 3 | `06-*` |
| 7 | Foto löschen mit Rückfrage, Offerte bleibt | ok | 3 | `07-*` |
| 8 | Leser-Ansicht | ok, aber **nur simuliert** (siehe Offen): kein Ablegen, Löschen, Verknüpfen, Kategorie nur lesbar, PDF öffnet im Viewer, Karte ohne Datenblatt-Bearbeiten und ohne Ablegen | 4 | `08-*` |

Summe 36 Klicks für alle acht Abläufe (inkl. Navigation).

### Funktionsbefunde

- **B1 Datenblatt je Bauteil:** Werte werden nur beim Bauteil der geöffneten Karte gespeichert (`bauteil_akte.datenblatt`). Die zweite mit demselben Datenblatt verknüpfte Pumpe zeigt "–". Plan-Erwartung "zweite Pumpe zeigt die Werte" nicht erfüllt. PO-Frage: Werte an alle mit dem Datenblatt verknüpften Bauteile (oder gleichen Typ) übernehmen?
- **B2 "Preise lesen" ohne Schlüssel unsichtbar:** Plan erwartet sichtbar und gesperrt mit Hinweis. Im Detail fehlt der Knopf ganz; einzig "Preise prüfen" sagt "Auslesen ist ausgeschaltet. Der Admin kann es einschalten." (siehe D2).
- Hinweis: Der Datenblatt-Vorschlag ("Vorgeschlagen") greift erst, wenn schon ein Bauteil verknüpft ist (`datenblattVorschlag`); beim ersten Verknüpfen ist der Typ-Filter nötig. Entspricht dem Code, für FM aber nicht offensichtlich.

## Demo-Befunde (vor Siemens peinlich, nicht behoben)

| # | Befund | Schritt / Bild |
|---|---|---|
| D1 | Startseite Gebäudeliste wirkt roh (Standard-Tabelle, blaue Links, "Assistent/Bearbeiten"), Musternamen ohne Umlaute ("Beispielgebaeude", "Zubehoer", "ueber"). Neu laden der Seite führt immer hierher zurück (Ort nicht in der URL). | Einstieg / `00-gebaeudeliste-1440x900.png` |
| D2 | Ohne Schlüssel: "Auslesen ist ausgeschaltet. Der Admin kann es einschalten." – der Admin kann es nicht einschalten, es fehlt der Schlüssel. Liste zeigt bei jedem PDF "Auslesen ausgeschaltet". Vor der Demo Schlüssel setzen oder Text anpassen. | 6 / `06-preise-pruefen-*` |
| D3 | Uneinheitliche Grössen und Symbole zwischen den Ansichten: "77 B"/"50 KB" (Alle Dokumente) vs. "1 kB"/"50 kB" (Preise prüfen); abgelehnt einmal Schild-, einmal Warndreieck-Symbol. | 1, 6 / `01-abgelegt-*`, `06-preise-pruefen-*` |
| D4 | Anlagenkarte: nach Sprung zu "Unterlagen" scheint oben ausgeblendeter Text "Preis erfassen · aus Dokument" durch; zwei "Bearbeiten"-Knöpfe direkt übereinander (Lebensdauer und Datenblatt) ohne Bezug. | 3 / `03-karte-unterlagen-1440x900.png` |
| D5 | Anlagentabelle: gleiche Pumpen als identische Zeilen ("Umwälzpumpe, UG1 · Technikzentrale") ohne Unterscheidung; in der Bauteilwahl dagegen "Nr. 1/2". | 3 / `03-karte-*` |
| D6 | Datenblatt-Quelle "Quelle Planora-Richtwert, angelehnt an VDI 2067 Blatt 1 (2012)" liest sich intern; Datenblatt-Felder sind nicht freigegeben [A]. | 3, 4 / `04-gespeichert-*` |
| D7 | 1280: Platzhalter der Bauteilsuche abgeschnitten ("Name, Ort, Herstel"); Anlagentabelle zeigt nur 2–3 Zeilen. | 2, 4 / `02-auswahl-1280x720.png`, `04-gespeichert-1280x720.png` |
| D8 | Offerte o1 erhält beim Ablegen auf "Alle Dokumente" Kategorie "Sonstiges" (nur über "Preise prüfen" abgelegt wird sie "Offerte"); EICAR-Huelle zeigt "1 Seite". | 1 / `01-abgelegt-*` |

## Prüfstand (25.11.2026)

| Prüfung | Ergebnis |
|---|---|
| Backend `npx vitest run` (app) | 758/758 (75 Dateien) |
| Backend `npm run pruefe:typen` | grün |
| Backend `npm run test:docker` | **offen**: Docker Desktop lief nicht (`docker info` fehlgeschlagen), nicht gestartet |
| Web `npx vitest run` (app/web) | 579/579 (61 Dateien) |
| Web `npx tsc --noEmit -p .` | grün |
| Web `npm run build` | grün |

## Kritik-Runden

- Seite, Viewer, Unterlagen, Datenblatt: `docs/design/kritiken/2026-11-24-anlagenakte/` r1 verbessern, r2 verbessern (ein P1), r3 **bereit**.
- GLB-Modelle (T9): `docs/design/kritiken/2026-11-25-anlagenakte-modelle/` r1 verbessern, r2 **bereit**.

## Offen

- Leser-Ansicht mit echtem Konto: Entwicklungsstart legt kein Leser-Konto an, keine API/Admin-Funktion setzt Rollen (`setzeRolle` ohne Route). Hier nur Anzeige simuliert; Backend-Rechte (Leser 403) sind durch `app/test/dokumente-api.test.ts` belegt.
- `test:docker` mit echtem clamd (Docker lief nicht); WSL-Gesamtabnahme mit clamav-Image offen.
- Siemens-Fragebogen Signaturversorgung ClamAV (offline/freshclam) [?].
- 7-Tage-Aufbewahrung abgelehnter Dateien [A].
- Datenblatt-Felder und Lebensdauer-Quellen fachlich nicht freigegeben [A].
- Alte Office-Formate (.doc/.xls/.ppt) [A]; HEIC ohne Vorschau.
- Assistent kennt die neuen Typen (Wärmezähler, Ausdehnungsgefäss, Sonstiges) nicht.
- PO-Sichtung steht aus.

## PO-Fragen

1. B1: Datenblatt-Werte für alle verknüpften Bauteile (bzw. alle gleichen Typs) übernehmen?
2. B2/D2: "Preise lesen" ohne Schlüssel sichtbar und gesperrt mit Hinweis zeigen – oder vor der Siemens-Demo Schlüssel setzen?
3. Welche Demo-Befunde D1–D8 vor der Siemens-Demo beheben?
