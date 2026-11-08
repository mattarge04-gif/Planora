# 0019 – Mehrsprachigkeit DE/FR/IT ab V1

Status: vorgeschlagen · 2026-11-08 · Bezug: E20, E12, FA-29

## Kontext
E20: DE/FR/IT in V1. ETIM-CH-Uebersetzungen nur fuer Mitglieder [F, Q9-Dom]; eBKP-H-Texte gehoeren CRB (E13). Dokumente kommen in mehreren Sprachen.

## Entscheid
- **UI:** Texte in Sprachdateien `de`, `fr`, `it` (ICU-Message-Format [A: Bibliothek im Scaffold waehlen]); Zahlen/Datum nach Schweizer Konvention je Sprache (de-CH, fr-CH, it-CH). Sprache pro Benutzer, Default pro Mandant.
- **Stammdaten-Texte** (Katalognamen, Dokumentarten, KBOB-Codes, Rechenweg-Bausteine, Ampel-Legende) in Texttabellen je Sprache (`katalog_text` u.ae.); eigene Uebersetzungen, keine ETIM-CH- oder CRB-Texte.
- **Kundendaten** (Raumnamen, Notizen, Dokumente) werden nicht uebersetzt.
- **KI:** derselbe Prompt fuer DE/FR/IT/EN-Dokumente; Zitate bleiben in Originalsprache; Werte werden sprachunabhaengig normalisiert.
- **Exporte** (Excel, Stratus) in der Sprache des Ausloesers; Spaltenschluessel sprachneutral.
- CI: fehlende Uebersetzungen zaehlen als Warnung; fuer ein Release muss jede Sprache vollstaendig sein [A].

## Alternativen
- Nur Deutsch in V1 mit spaeterer Uebersetzung: widerspricht E20; nachtraegliche i18n ist teurer.
- Maschinelle Uebersetzung zur Laufzeit: Fachbegriffe unzuverlaessig, keine Nachvollziehbarkeit.

## Konsequenzen
- + Westschweizer und Tessiner Kunden ab Start.
- − Uebersetzungsaufwand fuer jede UI-Aenderung und fuer 30–50 Katalogeintraege; Fachpruefung FR/IT durch Muttersprachler noetig [A].
