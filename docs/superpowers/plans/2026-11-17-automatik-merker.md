# Automatik-Merker speichern – Umsetzungsplan

Kennzeichnung: [F] Fakt, [A] Annahme, [?] offen. Branch `m2c-interview`. Grundlage: PO-Entscheid E42 (17.11.2026).

**Problem [F]:** Nach dem ersten Uebernehmen gehen die Assistent-Merker verloren (`auto`/`fbh` am FBH-Verteiler, `regel`/`angefasst`/`vorgeschlagen` an Gruppen, `fbhVerteilerAus`, `fbhWmz`). `ausBeschreibung` setzt dann `automatik = false` (Plan-Annahme 5). Folge: FBH in OG3 ergaenzen erzeugt keinen FBH-Verteiler und keine Gruppenzuordnung (17 statt 6 Klicks).

**Loesung:** Die Merker in `geschoss_vorlage.daten` mitspeichern (neues optionales Feld `automatik`, Version bleibt 1). Beim Laden einlesen und `automatik` wieder einschalten. Beschreibung, Generator, Router, Twin bleiben unveraendert.

## Format (neu, optional in `VorlagenEingabe`)

```ts
automatik?: {
  fbhWmz: boolean;
  gruppenVorgeschlagen: boolean;
  fbhVerteilerAus: EinheitVerweis[];
  autoVerteiler: BauteilVerweis[];          // auto + fbh
  gruppen: { gruppe: GruppeVerweis; regel?: { heizart; geschosse?: GeschossId[]; einheit?: EinheitVerweis }; angefasst?: true; vorgeschlagen?: true }[];
}
```

Backend loest Index-Verweise in IDs auf (wie `zuordnung`), unbekannte still verwerfen.

## Tasks

1. **Backend Speicher** – `schreibeBeschreibung` liefert zusaetzlich `bauteilIds`, `gruppeIds`; `schreibeVorlagen` speichert `automatik`, Eintrag bleibt auch ohne Vorlagen bestehen, wenn `automatik` gesetzt. Tests in `welt-vorlage.test.ts`. [A] 2 Std.
2. **Backend Schema/Route** – `VORLAGEN_SCHEMA` um `automatik` erweitern, `vorlagen: []` erlaubt. Test in `welt-api.test.ts`. [A] 1 Std.
3. **Web Serialisieren** – `vorlagenZurEingabe` schreibt Merker (auch ohne Vorlagen), `vorlagenEinlesen` liest sie und setzt `automatik = true`. Tests. [A] 2 Std.
4. **Web Szenario-Test** – Review-Gebaeude uebernehmen, neu laden, FBH in OG3 ergaenzen -> FBH-Verteiler entsteht, haengt an der FBH-Gruppe; angefasste Gruppen bleiben unberuehrt. [A] 1 Std.
5. **Pruefhinweis (E42 Punkt 3)** – `pruefHinweise`: Warnung, wenn keine Heizabgabe im Gebaeude ("Keine Heizkörper oder Heizflächen erfasst – Standard prüfen"). Test. [A] 30 Min.
6. **Abschluss** – volle Suites, tsc, Webbuild; Klickzaehlung Nachtrag (Ziel 6 Klicks) per HTTP/Browser; Abnahme-README und CLAUDE.md nachfuehren. [A] 1.5 Std.

Summe [A] ca. 1 Tag.

## Grenzen [A]

- Gebaeude, die vor dieser Aenderung uebernommen wurden, haben keine Merker: Verhalten wie bisher (`automatik = false`), bis sie einmal neu uebernommen werden. Keine Heuristik ueber Namen.
- Manuell angelegte Verteiler bleiben unberuehrt (kein `auto`).

## Umsetzungsstand (17.11.2026)

- [F] Tasks 1–6 umgesetzt: `55c48ef` (Backend), `488cad2` (Web, Pruefhinweis). Browsermessung: 5 statt 17 Klicks, Details im Abnahme-README Abschnitt "Nachtrag E42".
- [F] Abweichung: Merker werden nur gesendet, wenn die Automatik an ist; Einheit-Regeln ohne speicherbare Einheit werden ohne Regel gespeichert (sonst wuerden sie zur Rest-Regel).
