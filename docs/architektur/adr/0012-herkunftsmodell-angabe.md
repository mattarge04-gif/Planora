# 0012 – Herkunftsmodell "Angabe" je Kennwert

Status: vorgeschlagen · 2026-11-08 · Bezug: Datenmodell-Grundsaetze 00-kontext, FA-15, FA-16, FA-18, FA-21, FA-35

## Kontext
"Jede ausgelesene Angabe hat Herkunft: Dokument, Seite, KI-Konfidenz, Status (vorgeschlagen / bestaetigt von wem, wann)" (00-kontext). Lebensdauer-Rangfolge manuell > Herstellerdatenblatt > Richtwert (00-kontext), verfeinert durch E11 (Override pro Typ und pro Element, Lebensdauer-Tabelle des Mandanten).

## Entscheid
- Fachliche Kennwerte (Hersteller, Typ, Lebensdauer, Leistung, Einbaudatum, Menge, Raumzuordnung, Katalogzuordnung …) werden **nicht als nackte Spalten** gepflegt, sondern als Zeilen in `angabe`:
  `ziel_typ (elementtyp|element)`, `ziel_id`, `merkmal` (geschlossene Liste), `wert` (typisiert, JSON mit Schema je Merkmal), `einheit`, `quelle_art` (manuell | ki | import | abgeleitet), `dokument_id`, `seite`, `zitat` (max. 500 Zeichen), `bbox` (optional), `konfidenz` (0..1, nur KI), `status` (vorgeschlagen | bestaetigt | verworfen | ersetzt), `extraktion_lauf_id`, `erstellt_von/am`, `entschieden_von/am`.
- Der **effektive Wert** je Ziel und Merkmal wird von einer reinen Funktion `effektivWert(angaben, regeln)` bestimmt: **nur `bestaetigt`**, dann Rangfolge der Quelle (manuell > Datenblatt [ki/import mit Dokumentart Datenblatt] > Protokoll > abgeleitet), bei Gleichstand die juengste Entscheidung. Eine Angabe am Element schlaegt eine Angabe am Elementtyp (E11). Fuer die Lebensdauer kommen die Lebensdauer-Tabelle des Mandanten und der Planora-Standard als weitere Stufen dazu (ADR 0021, 03 Kap. 8.1).
- Fuer schnelle Listen und 3D wird eine Projektion `element_effektiv` gepflegt (in derselben Transaktion wie die Statusaenderung neu berechnet). Die Projektion ist **wegwerfbar** und jederzeit aus `angabe` neu aufbaubar (Job `projektion:neuaufbau`).
- Angaben werden nie geaendert, nur ersetzt (neue Zeile, alte `ersetzt`). Damit ist jede Wertgeschichte vollstaendig.
- Excel-Import ohne KI erzeugt Angaben mit `quelle_art=import` und Status `bestaetigt` durch den importierenden Benutzer (er hat die Spaltenzuordnung bestaetigt, FA-38).

## Alternativen
- Spalten + separate Herkunftstabelle: zwei Wahrheiten, Herkunft driftet.
- Event Sourcing des ganzen Bestands: maechtiger, fuer 1 Entwickler zu aufwendig.

## Konsequenzen
- + FA-21 (welche Lebensdauer gilt und warum) faellt direkt aus dem Modell.
- + KI-Vorschlaege koennen die Rechnung nie beeinflussen, solange sie nicht bestaetigt sind.
- − Mehr Zeilen (ca. 10–20 Angaben pro Element [A]; 10'000 Elemente → 200'000 Zeilen pro Gebaeude, fuer PG unkritisch [A]).
