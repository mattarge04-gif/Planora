# S10 Rechenkern: Determinismus, ZHAW-Kurve, Rappen-Rundung, Override-Rangfolge

Stand 2026-11-08 · Test-Architekt (Welle 3) · Wegwerf-Prototyp, kein Produktivcode.
Kennzeichnung: [F] gemessen/belegt · [A] Annahme · [?] offen.

## Ziel

Beweisen, dass sich die Erneuerungsrechnung aus 03 Kap. 8 als reine, deterministische Funktion umsetzen laesst: gleiche Eingabe → byte-identisches Ergebnis, Geld exakt in Rappen, Rangfolge der Lebensdauer Element > Typ > Datenblatt > Standard, ZHAW-Kurve und ihre Umkehrung korrekt.

## Vorgehen

- `kern.ts`: TypeScript-Prototyp der Formeln 8.1–8.7. Keine Abhaengigkeiten. Dezimalarithmetik als BigInt-Festkomma mit 30 Nachkommastellen, Quadratwurzel per Newton, Rundung half-up, Sortierung nach Codepunkten.
- `orakel.py`: **unabhaengige** Zweitimplementierung der Formeln mit Python `Decimal` (40 Stellen). Erzeugt `erwartet.json` fuer die Testtabelle `faelle.json` (16 Faelle, FA-22).
- `kern.test.ts` (node:test, Node 24 mit Typ-Stripping), `zufall.ts` (Zufalls-Schnappschuesse mit festem Seed), `hash_lauf.ts` (Gesamt-Hash fuer Vergleich zwischen Prozessen/Maschinen), `last.ts` (10'000 Elemente).

```
python s10-rechenkern/orakel.py
node --test s10-rechenkern/kern.test.ts
node s10-rechenkern/hash_lauf.ts 10000     # Soll: 12e1e8ea…c3b8d3
node s10-rechenkern/last.ts
```

## Ergebnis [F, gemessen 2026-11-08, Node 24.18, Windows 11]

| Test | Messwert | Ergebnis |
|---|---|---|
| Testtabelle FA-22: 16 Faelle Kern vs. Python-Orakel (J1, RL, Ampel, Ereignisjahre, Kosten) | 16/16 identisch | gruen |
| ZHAW-Kurve: z(0)=1, z(0,75 L)=0,4, z(L)=g; monoton; Umkehr a*(z(a)) = a fuer 201 Punkte | Fehler < 1e-10 | gruen |
| Override-Rangfolge, alle 8 Kombinationen (Element manuell / Typ manuell / Datenblatt) | 8/8 richtiger Rang | gruen |
| Unbestaetigte, verworfene, ersetzte Angaben veraendern nichts | 3/3 | gruen |
| Stunden → Jahre (FA-17): 50'000 h / 2'500 h/a = 20,0; 3'000 h/a → 16,7 → 2037; ohne h/a → naechster Rang | korrekt, Rechenweg-Text vorhanden | gruen |
| Bandbreite proportional (15/20/25, Datenblatt 30 → 22,5/30/37,5 → 2023/2030/2038) | korrekt | gruen |
| Fehlender Preis → `null` und "ohne Kosten", nie 0 | korrekt | gruen |
| Ohne Einbaujahr/Uebergabe/Bewertung → unvollstaendig, grau | korrekt | gruen |
| Rappen half-up (16,5 → 17; Banker-Rundung waere 16) | korrekt | gruen |
| **10'000 Zufalls-Schnappschuesse** zweimal gerechnet → byte-identisch; umgekehrte Eingabereihenfolge → identisch; Summe Plan = Summe Zeilen | 10'000/10'000 | gruen (2,7 s) |
| Zweiter Prozess mit anderer Zeitzone (Pacific/Kiritimati) und Locale (fr_CH) → gleicher Hash | identisch | gruen |
| Laufzeit 1 Schnappschuss mit 10'000 Elementen, 16'700 Ereignissen | 124–149 ms | Ziel ≤ 2 s erfuellt |

Gesamt: **12/12 Tests gruen.** Gesamt-Hash ueber 10'000 Snapshots: `12e1e8ea9d37947a1d372493709789a72530f491b7af0c9f101d4c2934c3b8d3`.

## Urteil gegen das Kriterium (03 Kap. 13.2, S10)

| Kriterium | Ergebnis | Urteil |
|---|---|---|
| Eigenschaftstest 10'000 Zufalls-Snapshots, 2 Laeufe **auf 2 Maschinen** byte-identisch | 2 Laeufe, 2 Prozesse, 1 Maschine | **teilweise** (zweite Maschine: `hash_lauf.ts` dort ausfuehren und Hash vergleichen) |
| Testtabelle des Test-Architekten (FA-22) 100 % gruen | 16/16 | **bestanden** |
| ZHAW-Kurve gegen Originalartikel und 10 Beispielrechnungen des Chefs, Abweichung ≤ 1 Jahr | Artikel und Beispiele nicht vorhanden | **nicht geprueft** |
| Excel-Formelsummen = Kernsummen | kein Excel-Export im Spike | **nicht geprueft** |

**Gesamturteil S10: technisch bestanden (Determinismus, Rundung, Rangfolge), fachlich offen (Kurve gegen Quelle, Excel).**

## Befunde fuer die Architektur (wichtig)

1. **[?] Folgezyklus nach Ueberfaelligkeit (03 Kap. 8.4):** Fall F10 (Einbau 2000, L = 15, Stichtag 2026) ergibt nach der Formel `J(n+1) = J(n) + L` Ereignisse **2026 (ueberfaellig seit 2015), 2030, 2045**. Fachlich erwartet man nach einem Ersatz 2026 den naechsten 2041. Der Prototyp rechnet wie spezifiziert; die Regel muss der PO entscheiden. Vorschlag: Folgezyklus ab `max(J1, s)`.
2. **[?] Folgezyklus nach manueller Verschiebung (FA-28):** Unklar, ob J2 vom berechneten J1 oder vom geplanten Jahr aus zaehlt. Der Prototyp zaehlt vom geplanten Jahr. Muss in 03 Kap. 8.4 festgelegt werden.
3. **`localeCompare` ist im Kern verboten:** Sortierung nach Locale haengt von ICU und Betriebssystem ab. Der Prototyp nutzt Codepunkt-Vergleich. Lint-Regel fuer `domain/` neben `Date.now()` und `Math.random()` aufnehmen.
4. **Rechenweg-Text enthaelt Zahlen im Format "20.0"**; die Lokalisierung (de-CH "20,0", fr-CH "20,0") gehoert in die Anzeige, nicht in den Kern, sonst haengt der Hash von der Sprache ab.
5. Die 16 Faelle sind ein Startpunkt fuer die FA-22-Tabelle; der Chef soll 10 reale Beispiele ergaenzen (Kriterium S10).
6. BigInt-Festkomma ohne Bibliothek genuegt; eine Dezimalbibliothek ist nicht zwingend [A].

## Grenzen

- Nur Lebensdauer, Zustand, Zyklen, Kosten, Ampel. Nicht enthalten: Planstand-Einfrieren, Excel, Mehrwaehrung, Demontagezuschlag, Preis-Rangfolge ueber mehrere Stufen (nur ein Preis je Typ).
- ZHAW-Parameter k = 0,75 und g = 0,25 sind Annahmen aus 03; die Kurvenform ist nicht gegen Hubbuch/Paganini 2015 geprueft.
- Zweite Maschine fehlt (siehe Urteil).
