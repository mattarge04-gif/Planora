# 0021 – Zustandsmodell nach ZHAW und Lebensdauer-Tabelle des Mandanten

Status: vorgeschlagen · 2026-11-08 · Bezug: E11, E14, FA-22, FA-30..FA-32

## Kontext
- E14: Zustandsbewertung nach ZHAW-Methode (Zustandswert, min/max-Bandbreite). Methode: Zustandswert 1 (neu) → 0, Alterung linear bis 0,4, darunter progressiv; Nutzungsgrenze 0,1–0,4; Kurve wird durch Inspektion angepasst; Bandbreite aus CRB-LCC [F, Q12-Dom]. Die Kurvenform ist in 01 nicht als Formel belegt.
- E11: keine CRB-Werte; eigene Lebensdauer-Tabelle mit Planora-Standardwerten, die nach Erfassen der Anlage automatisch entsteht und **pro Typ und pro einzelner Anlage** anpassbar ist.

## Entscheid
- **Lebensdauer-Tabelle** `mandant_lebensdauer`: bei Anlage eines Elementtyps automatisch aus dem Planora-Standard der Katalog-ID kopiert (`quelle = planora_standard@vN`), danach frei editierbar (`quelle = manuell`, mit Begruendung, auditiert). Abweichung pro Element als manuelle Angabe am Element (ADR 0012). Rangfolge: 03 Kap. 8.1.
- Kopieren statt Verweisen: Neue Planora-Standards aendern keine Mandantenwerte still; der Mandanten-Admin erhaelt einen Abgleich-Vorschlag.
- **Zustandsmodell `zhaw_v1`** (Formeln 03 Kap. 8.3): Zustandswert-Skala 1,0 … 0,0 in 0,1-Schritten [A]; lineare Alterung bis 0,4 bei `k × L` (k = 0,75 [A]), danach quadratisch progressiv bis Nutzungsgrenze g bei L (g Default 0,25 [A], pro Bauteiltyp einstellbar); Inspektion bestimmt das Aequivalenzalter ueber die Umkehrfunktion; Ersatzjahr-Spanne aus L_min/L_max.
- Modell als Strategie im reinen Rechenkern, versioniert. Parameter k und g sind Mandanten-/Typ-Parameter, nicht Code.
- UI-Bewertung vor Ort: 10 Stufen mit Kurzbeschreibung je Stufe (DE/FR/IT), Sammelbewertung (FA-32).

## Alternativen
- 5 Klassen mit Faktor (01-Vorschlag): einfacher, aber vom PO durch E14 ersetzt.
- NEN 2767 (Noten 1–6) [F, Q34-Dom]: kein CH-Standard, keine Lebensdauerkurve.

## Konsequenzen
- + Unbekanntes Einbaujahr ist mit einer Inspektion loesbar (ZHAW "Ansatz 2" [F, Q12-Dom]).
- − Kurvenparameter sind Annahmen → vor Umsetzung gegen den Originalartikel und Beispielrechnungen des Chefs pruefen (Spike S10).
- − Bewertende brauchen eine kurze Schulung zur 10-Stufen-Skala (ZHAW-Praxistest: Streuung zwischen Bewertenden ca. 0,05 [F, Q12-Dom]).
