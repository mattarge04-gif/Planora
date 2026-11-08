# S2 Elemente aus Plan-Tabelle + Kennwerte aus Datenblaettern (Lindenhof)

Stand 2026-11-08 · Test-Architekt (Welle 3) · Wegwerf-Spike, kein Produktivcode.
Kennzeichnung: [F] gemessen/belegt · [A] Annahme · [?] offen.

## Ziel

Pruefen, ob die Extraktion (03 Kap. 5.3–5.6) aus den Uebergabe-PDFs verlaessliche Vorschlaege liefert:
- Elemente: Anzahl je Typ und Raum aus der Tabelle "Raum / Ausstattung" auf den Grundrissen, gegen `bauteile.csv` und `pruefwerte.json`.
- Elementtypen: Katalog-ID, Hersteller, Typbezeichnung, Leistung aus den 9 Datenblaettern.
- **Halluzinationstest:** Erfindet die Pipeline eine Lebensdauer, wo keine steht? Soll: 0 erfundene Werte.

## Vorgehen

1. Testkatalog `prompt/katalog.test.json` mit 18 Katalog-IDs, davon 9 bewusst aehnliche Ablenker (z.B. Sole/Wasser-WP, Linienleuchte, Brandschutzklappe).
2. KI-Schritt im "Abo-Modus": 3 frische Subagenten (E1–E3), gleicher Auftrag `auftrag_subagent.md`, lesen die 11 PDFs mit dem Read-Werkzeug (wie ein PDF-Request: Bild + Text) und schreiben JSON nach `prompt/schema.json`. Prompt: `prompt/elemente_kennwerte@0.1.0.md` (Regel "nicht raten, null wenn nicht im Dokument", jedes Feld mit `wert/einheit/dokument/seite/zitat/konfidenz`).
3. `auswerten.py` vergleicht automatisch und wendet den **deterministischen Validator** aus 03 Kap. 5.6 an: Katalog-ID gueltig, Grounding (Zitat im Seitentext, exakt oder unscharf ≥ 0,9), Wert im Zitat (inkl. W → kW), Plausibilitaet, Stufen hoch/mittel/tief.

Sollwerte Lebensdauer (aus den Datenblaettern, [F]): **Jahre bei keinem Typ**; Betriebsstunden nur bei LT-01 (50'000 h L80/B10) und LT-02 (40'000 h). Die Aussage im Auftrag "Datenblaetter enthalten keine Lebensdauer" stimmt also nur fuer 7 von 9 Typen.

Wiederholen per API: `prompt/` enthaelt Prompt, Schema und Katalog; Ergebnis als `laeufe/E<n>.json`, dann `_werkzeuge/venv/Scripts/python s02-extraktion/auswerten.py`.

## Ergebnis [F, gemessen 2026-11-08]

| Lauf | Typfelder korrekt (9 Typen × 6 Merkmale) | Erfundene Werte | Elementzeilen Typ+Raum+Menge | Anzahl je Typ vs. pruefwerte | Summe Instanzen (Soll 113) | Validator-Stufen hoch/mittel/tief | Praezision "hoch" | Falsch, aber Validierung bestanden |
|---|---|---|---|---|---|---|---|---|
| E1 | 54/54 (100 %) | **0** | 55/55, 0 falsch-positiv | 9/9 | 113 | 26 / 4 / 7 | 26/26 | 0 |
| E2 | 54/54 (100 %) | **0** | 55/55, 0 falsch-positiv | 9/9 | 113 | 35 / 2 / 0 | 35/35 | 0 |
| E3 | 54/54 (100 %) | **0** | 55/55, 0 falsch-positiv | 9/9 | 113 | 36 / 1 / 0 | 36/36 | 0 |

- **Halluzinationstest bestanden:** In allen 3 Laeufen `lebensdauer_jahre = null` fuer alle 9 Typen, `lebensdauer_stunden` nur bei LT-01/LT-02, keine Umrechnung Stunden → Jahre. Mehrdeutiger Wert VAV-01 "3 VA" wurde in allen 3 Laeufen als `null` gemeldet (nicht in kW umgedeutet) und begruendet.
- Raumzuordnung inkl. Sonderfall WP-01 (Aussenaufstellung, `raum_nummer = null`, Standorttext zitiert) in 3/3 Laeufen korrekt. Die Menge 1 fuer WP-01 stammt aus dem Datenblatt ("1 Stück im Projekt"), nicht aus dem Plan; die Laeufe haben das selbst offengelegt und die Konfidenz gesenkt.
- Pruefsummen aus den extrahierten Werten nachgerechnet: Leuchten 44 × 36 W + 32 × 14 W = **2'032 W** [Soll 2'032]; Heizkoerper 10 × 1'000 W + 3 × 600 W = **11'800 W** [Soll 11'800].
- Katalogzuordnung 9/9 in allen Laeufen, kein Ablenker gewaehlt.

**Wichtigster Befund: der Validator, nicht das Modell, ist die Schwachstelle.** Alle Werte waren richtig, trotzdem landeten bis 11 von 37 Feldern unter "hoch":
1. **Zusammengesetzte Zitate:** E1 hat fuer die Katalog-ID ein Zitat aus zwei Textstellen mit "; " gebaut ("LED-Panel Büro; Bauart LED-Deckenpanel; Anbau") → Grounding "fehlt". E2 hat Tabellenzeilen gekuerzt ("EG-01 Empfang 1 × CO2-01", Mittelteil weggelassen) → 10 von 55 Elementzeilen ohne Grounding.
2. **Katalog-ID hat keinen Wert im Text**: Grounding fuer `katalog_id` prueft nur die Begruendung, nicht die Zuordnung. Eine falsche Katalog-ID mit echtem Zitat wuerde "hoch".
3. Streuung zwischen Laeufen zeigt sich nur in der Zitierweise, nicht in den Werten.

## Urteil gegen das Kriterium (03 Kap. 13.2, S2)

| Kriterium | Ergebnis | Urteil |
|---|---|---|
| Feld-Trefferquote Excel ≥ 90 % / Scan ≥ 70 % (FA-13) | Vektor-PDF 100 % (Excel und Scan nicht getestet) | **bestanden fuer Vektor-PDF, Excel/Scan offen** |
| Praezision Stufe "hoch" ≥ 98 % | 97/97 = 100 % | **bestanden auf Lindenhof** |
| Falsche Werte, die die Validierung bestehen ≤ 1 % | 0 | **bestanden auf Lindenhof** |
| 20–30 oeffentliche Datenblaetter + synthetische Listen DE/FR/IT | 9 synthetische DE-Datenblaetter, 2 Plan-Tabellen | **nicht geprueft** |
| Halluzination Lebensdauer (Zusatz Auftrag) | 0 erfundene Werte in 3/3 Laeufen | **bestanden** |

**Gesamturteil S2: auf Lindenhof bestanden, das Spike-Kriterium bleibt offen** (Umfang, Sprachen, Scans, Excel fehlen).

## Grenzen

- Datenblaetter sind einheitlich gestaltet, einseitig, deutsch, mit Etikett-Wert-Paaren. Echte Datenblaetter haben Mehrfachvarianten in einer Tabelle (z.B. 10 Leistungsstufen), Fussnoten, Lebensdauer als Grafik, FR/IT-Texte.
- Die Plan-Tabelle nennt Typ-IDs, die exakt den Datenblaettern entsprechen. In echten Projekten fehlt diese Verknuepfung oft.
- Abo-Modus statt Produktionsmodell (siehe S1).
- Validator-Stufe "hoch" verlangt hier Modellkonfidenz ≥ 0,90; die Modellkonfidenz ist nicht kalibriert [A].

## Folgerungen fuer die Architektur

1. **Zitatregel im Prompt und im Schema schaerfen:** "zitat = ein zusammenhaengender, woertlicher Ausschnitt; fuer mehrere Stellen mehrere Zitate (Array)". Validator: jedes Teilzitat einzeln pruefen. Sonst fallen korrekte Werte in "mittel".
2. **Katalog-ID gesondert validieren:** Grounding reicht nicht. Vorschlag: deterministische Gegenpruefung ueber Schluesselwoerter je Katalogeintrag (DE/FR/IT) und Typ-Konsistenz (alle Elemente eines Typs gleiche Katalog-ID); sonst nie "hoch".
3. **Quelle der Menge kennzeichnen:** WP-01 zeigt, dass Mengen auch aus Datenblaettern kommen. Merkmal `menge` braucht Herkunft wie jeder andere Wert; Widerspruch Plan ↔ Datenblatt → "mittel".
4. **Querpruefung lohnt sich:** Datenblatt-Stueckzahl ("44 Stück im Projekt") = Summe der Plan-Tabelle. Diese Pruefung (03 Kap. 5.6 Punkt 5) als Pflicht fuer Listen + Datenblaetter vorsehen.
5. Einheiten wie "VA" fehlen in der Normalisierung; Merkmalsliste braucht `leistung_va` oder eine Regel.
