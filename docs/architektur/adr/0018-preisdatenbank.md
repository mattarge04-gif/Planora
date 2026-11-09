# 0018 – Preisdatenbank pro Typ mit Quellen-Port

> **Status ab Welle 4: zurueckgestellt bis nach Demo (E34–E37, 2026-11-09).**
> [F] E24: keine Preise, Feeds, Teuerung oder Investitionsplanung in V1.
> [A] Spaeteres Kundenmodul (ADR 0029) mit eigener Fachabnahme fuer Preisbasis, Einheiten und Herkunft.
> Der folgende Text ist die bisherige Fassung und bleibt als Historie erhalten.

Status: vorgeschlagen · 2026-11-08 · Bezug: E15, E16, FA-24, FA-25

## Kontext
E15: Preisdatenbank pro Typ, die sich automatisch aktualisiert, wenn Hersteller Preise aendern. Machbarkeit und Quellen offen (Feeds wie BMEcat/Datanorm/Grosshandel [A]); V1-Fallback manuell + Import, Auto-Update als eigenes Modul vorbereiten. Die Rechnung muss deterministisch bleiben (ADR 0013).

## Entscheid
- Eigenes Modul `preise` mit Datenhoheit ueber `preisquelle`, `hersteller_artikel`, `preis_eintrag` (global, von Planora gepflegt) und `mandant_preis` (Mandantenpreise).
- **Nur einfuegen, nie ueberschreiben:** jeder Preis hat `preisjahr` und `gueltig_ab`. Eine Aktualisierung erzeugt eine neue Zeile. Die Rechnung waehlt je Stufe den juengsten Eintrag mit `gueltig_ab ≤ Stichtag`; eingefrorene Planstaende behalten ihre Preise.
- Rangfolge: Mandantenpreis Elementtyp > Mandantenpreis Katalog-ID > Herstellerpreis (Abgleich Hersteller + Artikelnummer/Typ, optional GTIN) > Planora-Standardpreis Katalog-ID [A] > keiner ("Kosten fehlen").
- Port `PreisQuelle { abrufen(seit): PreisDatensatz[] }`. V1-Adapter: `manuell` (UI) und `datei` (Excel/CSV mit Spaltenzuordnung). Spaetere Adapter: `bmecat`, `datanorm`, Grosshandels-API [A] — erst nach Spike S12.
- Synchronisation als pg-boss-Job pro Quelle (idempotent per Quelle + Abrufzeitpunkt + Datensatz-Hash). Neue Herstellerpreise, die keinem Artikel sicher zugeordnet werden koennen, landen in einer Preis-Pruefliste.
- Pro Mandant einstellbar, ob neue Herstellerpreise **automatisch** gelten oder erst nach Bestaetigung [A, Default: automatisch, wie E15 verlangt; Aenderung wird im Audit und im Plan als "Preis aktualisiert am" sichtbar].

## Alternativen
- Preise als Spalte am Elementtyp: keine Historie, Planstaende nicht reproduzierbar → verworfen.
- Nur Mandantenpreise ohne globale Herstellerpreise: Auto-Update aus Herstellerquellen unmoeglich.

## Konsequenzen
- + Auto-Update ohne Bruch der Nachvollziehbarkeit.
- − Machbarkeit der Feeds offen (Risiko R11, Spike S12); ohne Feeds bleibt die Datenbank manuell gepflegt.
- − Lizenzbedingungen von Preisfeeds koennen die Weitergabe an Mandanten einschraenken [?].
