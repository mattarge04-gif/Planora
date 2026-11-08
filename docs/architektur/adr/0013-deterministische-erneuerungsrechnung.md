# 0013 – Deterministische Erneuerungs- und Investitionsrechnung

Status: vorgeschlagen · 2026-11-08 · Bezug: E6, E11, E14–E17, FA-17, FA-20..FA-29, FA-31

## Kontext
Investitionsentscheide von Enterprise-Kunden stuetzen sich auf die Zahlen. Gleiche Eingabe muss gleiches Ergebnis liefern und erklaerbar sein. Vorgaben aus den PO-Antworten: Lebensdauer pro Typ und Element (E11), ZHAW-Zustandsmethode (E14), Preisdatenbank mit Auto-Update (E15), fester Teuerungssatz pro Mandant (E16), Ampel-Schwelle pro Bauteiltyp (E17).

## Entscheid
- Modul `erneuerung` enthaelt einen **reinen Rechenkern** `berechne(eingabe): ergebnis` ohne IO, ohne `Date.now()`, ohne Zufall, ohne Gleitkomma fuer Geld.
- Eingabe ist ein **Schnappschuss**: Elemente mit effektiven Werten, Lebensdauer-Tabelle, gueltige Preise zum Stichtag, Mandantenparameter, `stichtag` (explizit), `horizont` (10|20), `regelwerk_version`.
- Geld in **Rappen als Ganzzahl** (bigint); Faktoren (Teuerung, Zustand) als Dezimalzahl mit fester Genauigkeit (Dezimalbibliothek [A: im Scaffold waehlen]); Rundung kaufmaennisch (half-up) **einmal pro Ersatzereignis** auf ganze Rappen; Summen werden aus gerundeten Ereignissen gebildet (Summe = Summe der Zeilen, FA-26).
- Jahre ganzzahlig; Lebensdauer in Jahren mit einer Nachkommastelle, Ersatzjahr = Rundung half-up.
- Formeln, Rangfolge und Ampel: 03 Kap. 8. Zustandsmodell als versionierte Strategie (`zustandsmodell: "zhaw_v1"`, ADR 0021). Preise werden aus der Preisdatenbank zum Stichtag gelesen und im Planstand eingefroren (ADR 0018).
- Jedes Ergebnis traegt `regelwerk_version`, `eingabe_hash` (SHA-256 ueber kanonisches JSON) und pro Zeile einen **Rechenweg** (Liste von Schritten mit Quelle), der im UI und im Excel-Export erscheint (FA-17, FA-21, FA-25, FA-29).
- **Planstand:** Fuer Exporte und Entscheide wird ein Schnappschuss eingefroren (`planstand`: Eingabe-JSON komprimiert im Objektspeicher, Hash, Ergebnis-Summen). Ein Planstand ist unveraenderlich und jederzeit nachrechenbar (gleicher Hash → gleiches Ergebnis, im CI und auf Abruf geprueft).
- Laufende Ansichten rechnen auf Anfrage (10'000 Elemente in Millisekunden [A]), mit Cache-Schluessel `datenstand`.

## Alternativen
- Gespeicherte Ergebnisspalten am Element: veralten, Rechenweg geht verloren.
- Rechnen in SQL: schwer testbar, Rundung schwer kontrollierbar.
- Gleitkomma (JS `number`) fuer Geld: Rundungsdrift zwischen Zeilen und Summen → verworfen.

## Konsequenzen
- + Eigenschaftsbasierte Tests (gleiche Eingabe → byte-identisches Ergebnis), Tabellentests des Test-Architekten (FA-22).
- + Regelwerkaenderung = neue Version; alte Planstaende bleiben mit alter Version nachrechenbar (alte Regelwerke bleiben im Code).
- − Disziplin: keine Datumsfunktionen im Kern (Lint-Regel fuer das Verzeichnis `domain/`).
