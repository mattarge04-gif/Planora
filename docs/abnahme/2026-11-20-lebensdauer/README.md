# Abnahme Lebensdauer/Ampel (Task 11) – 20.11.2026

Browser-Abnahme der Testinstanz (`bash werkzeug/design/instanz.sh start --muster`, Port 3100, Wegwerfdaten, echte GPU RTX 3070 Ti / D3D11) an «Muster 6 L-Form viele Gruppen» (17 Bauteile). Stichtag 2026. Bedient per Playwright wie ein Benutzer (Klick, Eingabe), Zahlen aus der Oberfläche ausgelesen und mit API und CSV verglichen. Code nicht geändert.

**Ergebnis: Abnahme bestanden.** Karte, Twin-Legende, Plan (Balken, Liste, Summe) und CSV zeigen dieselben Zahlen, in beiden geprüften Zuständen. Zwei geringe Befunde (CSV-Namen ohne Umlaute, Rappenrundung), siehe «Befunde». Excel selbst war nicht verfügbar, die CSV wurde maschinell ausgewertet.

## 1. Ablauf (Zustand A, Vorgabe aus dem Plan)

| Schritt | Bedienung | Bild |
|---|---|---|
| Ausgangslage | Erneuerung ohne Daten: alle Bauteile «Baujahr fehlt» | `01-twin-erneuerung-leer.png`, `02-plan-leer.png` |
| Baujahr-Standard 2008 | Erneuerungsplan, Feld «Baujahr Heizung» | `03-plan-baujahr.png` |
| Preise Typ Heizkörper CHF 800, Wärmepumpe CHF 35'000 | Plan, Typwerte | `04-plan-typwerte-gesetzt.png` |
| Wärmepumpe Baujahr 2019 | Anlagenkarte, Bearbeiten | `06-wp-*.png` |
| Heizkörper (EG · Kern) Baujahr 2000 | Anlagenkarte, Bearbeiten | `07-hk-*.png` |
| Verteiler Zustand «Schlecht», Stückpreis CHF 2'500 | Anlagenkarte, Bearbeiten | `08-verteiler-*.png` |
| Vergleich | Twin-Legende, Plan, CSV | `09-twin-erneuerung.png`, `10-plan.png` |

Zustand A (API = Oberfläche): rot 4, gelb 4, grün 9, grau 0. Fällig 2026: 4 Umwälzpumpen (Ersatzjahr 2020, überfällig, zählen im Stichtagsjahr), 2028: 2 × 3-Weg- und 2 × Durchgangsventil, 2033: Speicher und Verteiler (Verteiler 2008 + 30 Jahre − 5 Jahre «Schlecht» = 2033). Wärmepumpe 2039 (CHF 35'000), Heizkörper Kern 2040 (2 × 800 = CHF 1'600), Heizkörper Büro A/Gastro 2048 (CHF 6'400 / 3'200).

Beobachtung zur Demo: Im Zustand A liegt nichts Bepreistes in den nächsten 5 Jahren, die 5-Jahres-Summe ist also CHF 0 («Unvollständig, 8 Bauteile ohne Preis»). Konsistent, aber als Demonstration der Summe schwach. Deshalb zusätzlich Zustand B.

## 2. Zahlenvergleich

Verglichen je Zeile (Ort, Menge, Ersatzjahr, Kosten) und in den Summen. Ausgelesen: Anlagenkarte je Tabellenzeile (17 Klicks), Twin-Legende, Plan (Summe, Ampelzähler, Balken-Beschriftung, Liste), CSV über `GET /api/lebensdauer/gebaeude/:id/export.csv` mit Session-Cookie (200, `text/csv; charset=utf-8`, BOM `EF BB BF`, Semikolon). Rohdaten: `export-zustand-a.csv`, `export-variante-b.csv` (hier ohne BOM gespeichert).

**Zustand A**

| Grösse | API | Karte | Twin-Legende | Plan | CSV |
|---|---|---|---|---|---|
| Zähler rot/gelb/grün/grau | 4/4/9/0 | – | 4/4/9/0 | 4/4/9/0 | 4/4/9/0 (aus Zeilen) |
| Kosten 5 Jahre | CHF 0 | – | CHF 0 | CHF 0 | 0 (Jahresblock und Zeilen) |
| Ohne Preis (5 J.) | 8 | – | 8 | 8 | 8 |
| Jahre mit Beträgen | 2026: 0 / 4 ohne Preis; 2028: 0 / 4; 2033: 2'500 / 1 | – | – | gleiche drei Balken | Jahresblock identisch; Summen aus den Zeilen identisch |
| 17 Zeilen (Ort, Menge, Ersatzjahr, Kosten) | – | identisch | – | identisch | Referenz |

**Zustand B** (zusätzlich, per API gesetzt, damit die 5-Jahres-Summe nicht 0 ist): Baujahr-Standard 1998, Heizkörper Gastro Baujahr 1990, Speicher Stückpreis CHF 4'000, Typ Umwälzpumpe CHF 450.50. Bilder `11-variante-b-twin.png`, `12-variante-b-plan.png`.

| Grösse | API | Twin-Legende | Plan | CSV |
|---|---|---|---|---|
| rot/gelb/grün/grau | 10/0/7/0 | 10/0/7/0 | 10/0/7/0 | 10/0/7/0 |
| Kosten 5 Jahre | CHF 11'502 | CHF 11'502 | CHF 11'502 | 11502 (Jahresblock 8302 + 3200, aus Zeilen gleich) |
| Ohne Preis (5 J.) | 4 | 4 | 4 | 4 |
| Balken | 2026: 8'302 / 4 ohne Preis; 2030: 3'200 | – | gleich | gleich |

Gegenprobe 2026: 2'500 (Verteiler) + 4'000 (Speicher) + 4 × 450.50 = 8'302. Stimmt.

**Ergebnis: keine Abweichung in Mengen, Jahren, Ampeln und Summen.** Einzige Differenz: Befund B2 (Rappen).

## 3. Weitere Prüfungen

- **Assistent mit altem Stand (Schritt 1.6):** Assistent «Muster 6» bis «Prüfen» geöffnet; in einem zweiten Zugriff Baujahr-Standard auf 2009 geändert (`gebaeude.stand` steigt, Stand der Antwort 10); im Assistenten «Übernehmen» geklickt. Ergebnis: HTTP 409, Meldung im Assistenten «Die Beschreibung wurde inzwischen geändert. Bitte den Assistenten schliessen und neu öffnen.» (`14-assistent-409.png`), Baujahr danach weiter 2009, kein stilles Überschreiben. Per API gegengeprüft: alte Beschreibung PUT → 409 `stand_veraltet`; Beschreibung mit aktuellem Stand PUT → 200 und die Lebensdauer-Daten (Baujahr-Standard, eigene Baujahre WP 2019 / Heizkörper 2000, Ampelzähler) bleiben unverändert. Die Meldung nennt nicht, dass es um Lebensdauerdaten geht und sagt nur «neu öffnen»; ein offener Entwurf bleibt erhalten (Hinweis «Dein Entwurf ist wieder geöffnet» im Bild).
- **Rolle Leser (Schritt 1.7):** im Browser nicht geprüft. In der Testinstanz gibt es nur Admin und Betreiber, ein Leser-Konto bräuchte Direktzugriff auf die Datenbank. Per API-Test abgedeckt (`app/test/lebensdauer-api.test.ts`: Leser liest mit `darfAendern: false`, PUT 403, Fremde 404). Die UI-Seite («Text statt Felder» ohne `darfAendern`) ist in den Web-Tests nicht als Browserlauf belegt.
- **CSV-Download:** Header `attachment; filename="erneuerungsplan-a67cf62f-2026.csv"`, BOM vorhanden, Semikolon, Formelschutz im Test abgedeckt.
- **Konsole:** nur bekannte Bibliothekswarnungen (THREE.Clock, Shader X4000/X3595); ein 409 (Absicht). Keine CSP-Verletzung, keine `pageerror`.

## 4. Klickzahl «Baujahr + 2 Preise setzen»

Weg über den Erneuerungsplan (mit Maus, Feld anklicken, Eingabe, Speichern):

| Klick | Aktion |
|---|---|
| 1 | Pill «Erneuerung» |
| 2 | «Erneuerungsplan öffnen» |
| 3 | Feld Baujahr |
| 4 | «Speichern» |
| 5 | «Typwerte» aufklappen |
| 6 | Preisfeld Heizkörper |
| 7 | Preisfeld Wärmepumpe |
| 8 | «Typwerte speichern» |

**8 Klicks und 3 Texteingaben** (2008, 800, 35000), davon 6 Klicks und 3 Eingaben im Plan selbst. Zum Vergleich je Bauteil über die Anlagenkarte: Zeile, «Bearbeiten», Feld(er), «Speichern» = 3 Klicks, plus 1 bzw. 2 Eingaben (Wärmepumpe Baujahr: 3 Klicks, 1 Eingabe; Verteiler Zustand und Preis: 3 Klicks, 1 Auswahl und 1 Eingabe). Ein Zielwert war im Plan nicht festgelegt.

## 5. Gesamtprüfung (Step 3)

| Prüfung | Ergebnis |
|---|---|
| Backend `app/`: `npx vitest run` | 59 Dateien, **614/614** grün |
| Backend `npm run pruefe:typen` | grün |
| Web `app/web/`: `npx vitest run` | 50 Dateien, **502/502** grün |
| Web `npm run build` (inkl. tsc) | grün |

Die Instanz wurde danach gestoppt (Port 3100/54600), Port 3000/54500 nicht berührt.

## 6. Befunde

| Nr. | Gewicht | Befund |
|---|---|---|
| B1 | gering | CSV nennt Bauteile ohne Umlaute («Waermepumpe», «Umwaelzpumpe», «Heizkoerper»), die Oberfläche mit Umlauten («Wärmepumpe»). Ursache: `routen.ts` nimmt die Namen direkt aus `KATALOG_V2` (ASCII), die Oberfläche übersetzt sie in `anzeigeName`. Zahlen unberührt; im Excel wirkt es uneinheitlich (UI-Texte mit echten Umlauten ist Projektregel). |
| B2 | gering | Beträge mit Rappen: Oberfläche rundet je Anzeige auf ganze Franken (Karte «CHF 451»), CSV führt 450.5. Summen sind unrunde Summen (8'302), die Addition der angezeigten Einzelwerte ergäbe 8'304. Nur relevant, wenn Preise mit Rappen erfasst werden; Eingabe erlaubt sie. |
| B3 | Hinweis | CSV-Jahresblock und Plan-Balken decken nur 10 Jahre (2026–2035) ab; Bauteile mit späterem Ersatzjahr stehen nur in den Zeilen. Entspricht der Spec (Jahressummen Stichtag bis Stichtag+9); für die Excel-Auswertung hier festgehalten. |
| B4 | Hinweis | Demo-Eignung: Mit dem Plan-Zustand A (Baujahr 2008, Preise für Heizkörper und Wärmepumpe) ist die 5-Jahres-Summe CHF 0. Für eine Vorführung eignet sich Zustand B (`werkzeug/design/lebensdauer-daten.mjs` setzt Daten mit Treffern im Fünfjahresfenster). |
| B5 | Hinweis | 409-Meldung im Assistenten ist allgemein (Beschreibung geändert); sie sagt nicht, dass das Baujahr im Plan geändert wurde. Verhalten korrekt. |

## 7. Offen [?]

- PO-Sichtung der 3D-Darstellung und des Erneuerungsplans.
- Leser im Browser nicht geprüft (API-Test deckt es ab).
- Excel-Öffnung der CSV (de-CH) nicht mit Excel selbst geprüft.
- B1 (Namen mit Umlauten im CSV) und B2 (Rappen) vom Controller zu entscheiden.
- Nächstes Teilprojekt: «Preis aus Dokument» (E43, Zuschnitt zwei Teile).
