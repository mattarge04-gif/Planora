# 0011 – Bauteil-Katalog: global, versioniert; ETIM und eBKP-H nur als Mappings

> **Status ab Welle 4: angepasst (E34–E37, 2026-11-09).**
> [A] Versionierter Produktkatalog wird mit jeder Instanz ausgeliefert; lokale Kunden-Overrides bleiben bei Katalog-Updates erhalten, keine gemeinsame Laufzeitdatenbank.
> [A] Demo nur DE, Preis-/Kostenbezug entfaellt (E24); stabile IDs, GLB-Hashes und optionale Mappings bleiben.
> Der folgende Text ist die bisherige Fassung und bleibt als Historie erhalten.

Status: vorgeschlagen · 2026-11-08 · Bezug: E8, E11, E12, E13, E17, E20, FA-14, FA-19..FA-21

## Kontext
E8: KI waehlt nur aus Katalog-IDs, Unbekanntes in die Pruefliste. 01 Kap. 3.3 empfahl drei Ebenen (eBKP-H, Planora-Katalog-ID, ETIM). Die PO-Antworten praezisieren: eigene Katalog-ID fuehrend, ETIM und eBKP-H nur als austauschbare Mappings (E12, E13: keine eBKP-H-Lizenzanfrage, Restrisiko), keine CRB-Lebensdauerwerte (E11), DE/FR/IT (E20), Ampel-Schwelle pro Bauteiltyp (E17).

## Entscheid
- Katalog ist **global** (keine `mandant_id`), gepflegt durch Planora, ausgeliefert als **versionierte Datendatei im Repository** (`katalog/katalog.vN.json`) und per Migration in die Tabellen `katalog_*` geladen. Fuer `planora_app` nur lesbar.
- **Katalog-ID**: stabiler, sprechender Schluessel `<gruppe>.<typ>` in Kleinbuchstaben, z.B. `leuchte.downlight`, `lueftung.monoblock`, `pumpe.umwaelz`. **Nie umbenannt, nie wiederverwendet**; Ausmusterung per `gueltig_bis` + `ersetzt_durch`.
- Pro Eintrag: Planora-Gruppe (fuer Plan und Filter), GLB-Datei + Hash, Icon, Planora-Standard-Lebensdauer min/mittel/max mit `referenzquelle` (Text), Nutzungsgrenze (ZHAW), Ampel-Default, Betriebsstunden/Jahr-Default, Bezugsgroesse fuer Kosten. Texte (Name, Beschreibung) in `katalog_text` je Sprache de/fr/it.
- **Klassifikation als Mapping:** `klassifikation_mapping(katalog_id, system, code, system_version)`, `system` ∈ {`etim`, `ebkp_h`, …}. Optional, mehrere Systeme parallel, ohne Schemaaenderung erweiterbar; ein eigenes System ist nur ein weiterer `system`-Wert. ETIM mit Attribution ODC-BY [F, Q9-Dom], englische Klassennamen; eBKP-H nur als Code (Format `D05.02` [F, Q7-Dom]) ohne CRB-Texte, pro Installation abschaltbar.
- Sonder-ID `unbekannt` existiert **nicht** im Katalog; die KI liefert dafuer `null` → Pruefliste.
- **Lebensdauer:** keine CRB-Zahlen (E11). Planora-Standardwerte vom Chef mit Verweis als Text; sie werden bei Anlage eines Elementtyps in die Lebensdauer-Tabelle des Mandanten kopiert (ADR 0021).
- **Mandanten-Anpassungen** (Lebensdauer pro Typ, Ampel pro Bauteiltyp, Preise, Betriebsstunden) in eigenen Mandantentabellen (`mandant_lebensdauer`, `mandant_ampel`, `mandant_preis`), nie im globalen Katalog.
- Mandantenspezifische **Elementtypen** (Hersteller + Typenbezeichnung) verweisen auf genau eine Katalog-ID (ADR 0012).

## Alternativen
- Katalog pro Mandant: Divergenz, keine gemeinsame GLB-Bibliothek, KI-Prompts mandantenabhaengig → verworfen.
- ETIM als Primaerschluessel: zu feinkoernig, CH-Uebersetzungen nur fuer Mitglieder [F, Q9-Domaene].
- Freie Typen durch KI: verletzt E8.

## Konsequenzen
- + KI-Ausgabe ist auf eine geschlossene Menge pruefbar.
- + Katalog-Aenderungen sind Code-Reviews mit Versionsnummer; Golden-Set-Lauf bei Aenderung.
- − Neue Bauteiltypen brauchen ein Release (bewusst, Qualitaetssicherung).
