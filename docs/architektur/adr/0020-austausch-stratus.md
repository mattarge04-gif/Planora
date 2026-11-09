# 0020 – Austausch-Port mit Stratus-Adapter

> **Status ab Welle 4: angepasst (E34–E37, 2026-11-09).**
> [A] Preise/Investitionsplan aus dem Austauschvertrag entfernt; Formular-/Excel-Erfassung (Stufe 2) ist vom Stratus-Adapter getrennt, Stratus als spaeteres Modul.
> [?] PO: E22 ist durch E34–E37 nicht ausdruecklich aufgehoben – gehoert Stratus-Austausch zur Demo oder nicht?
> Der folgende Text ist die bisherige Fassung und bleibt als Historie erhalten.

Status: vorgeschlagen · 2026-11-08 · Bezug: E22, E9, FA-29

## Kontext
E22: Planora positioniert sich als Ergaenzung zu Stratus (Portfolio-Ebene, Basler & Hofmann [F, Q11/Q19-Dom]) auf Element-Ebene, inklusive Export/Import. E9: Reverse Engineering nur fuer Import-Schnittstellen, nicht fuer die Kernlogik. Das Stratus-Austauschformat ist nicht oeffentlich dokumentiert [?].

## Entscheid
- Eigenes Modul `austausch` mit Port `AustauschFormat { export(gebaeudeIds), importVorschau(datei), import(bestaetigteZeilen) }`. Fachmodule kennen kein Fremdformat.
- V1-Adapter `stratus`: Export der Element-Ebene (Element, Gruppe, optional eBKP-H, Einbaujahr, Lebensdauer mit Quelle, Zustandswert, Ersatzjahr, Kosten, Planstand-ID) und Import von Liegenschafts-/Gebaeude-Stammdaten.
- Solange das Format nicht vorliegt: Excel/CSV mit dokumentierter, versionierter Spaltenstruktur als Zwischenformat [A].
- Jeder Import: Vorschau → Benutzer bestaetigt → Angaben mit `quelle_art=import` und Verweis auf die Importdatei (Herkunft bleibt erhalten). Exporte beziehen sich immer auf einen eingefrorenen Planstand (reproduzierbar).

## Alternativen
- Direkte DB-Kopplung oder Reverse Engineering von Stratus: verletzt E9, bricht bei Updates.
- Kein Austausch in V1: widerspricht E22.

## Konsequenzen
- + Weitere Systeme (CAFM, IFC spaeter) als weitere Adapter ohne Aenderung am Kern.
- − Abhaengigkeit von Basler & Hofmann fuer Formatbeschreibung (Spike S13, Risiko R13).
