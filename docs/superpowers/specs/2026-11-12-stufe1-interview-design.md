# Stufe 1 – Interview-Assistent, Gruppen, Raumkomposition (Design)

12.11.2026 · Branch `m2c-interview` · PO-Entscheid E41 · Plan: [Weg zu V1](../plans/2026-11-12-weg-zu-v1.md)

Kennzeichnung: [F] Fakt, [A] Annahme (Startwert, am Bild nachstellen), [?] offen.

## 1. Ziel

Ein Kunde beschreibt sein Gebäude in einem gefuehrten Web-Assistenten. Daraus entsteht automatisch ein Digital Twin, der **funktional richtig und aufgeraeumt** aussieht:

- Raeume und Gebaeude erhalten ihre Groesse aus dem Inhalt, nicht aus echten Massen.
- Heizgruppen sind eigene Objekte; Leitungen verschiedener Gruppen werden nie zusammengefuehrt.
- Zubehoer (Pumpen, Ventile, Waermezaehler) kann an beliebigen Orten im Fluss sitzen.

Nur Gewerk Heizung. Ohne KI (KI-Interview folgt in Stufe 8 auf demselben Schema).

## 2. PO-Entscheide aus dem Brainstorming [F]

| # | Entscheid |
|---|---|
| 1 | Ein Assistent fuer alles: Gebaeude/Form/Geschosse → Einheiten → Abgaben → Zentrale → Gruppen → Unterverteiler → weitere Teile. |
| 2 | Gruppen: zuerst Anzahl, dann je Gruppe Art, Bestueckung, Verbraucher (z. B. "HK Restaurant"). Art schlaegt Bestueckung vor, aenderbar. |
| 3 | Standardbestueckung je Gruppenart (Abschnitt 4.3) bestaetigt. |
| 4 | Darstellung: ein Rohr pro Gruppe, einheitlich Heizungsrot; Hover/Auswahl hebt ganze Gruppe hervor. |
| 5 | Architektur: Gruppen als Tabellen, Raumkomposition im Server, Leitungen im Browser. |
| 6 | Keine echten Flaechen. Eingabe nur Form, Geschosse, Einheiten; Groesse ergibt sich aus dem Inhalt (Modulmatrix). Kein Bedienabstand. |
| 7 | Jedes Bauteil hat einen festen Anschluss bis unter die Decke; Hauptleitung = Strang + kuerzeste T-Abzweige. |
| 8 | Umsetzung nach Vertragsschritt parallel in getrennten Worktrees (Generator, Assistent, Leitungen). |

## 3. Architektur

```
Assistent (Web) ──Entwurf──► Server: entwurf (JSON, Autosave)
      │ Vorschau                    │ Uebernehmen
      ▼                             ▼
POST /api/szene/vorschau     PUT /api/struktur/gebaeude/:id/beschreibung
      │                             │ (Tabellen = Wahrheit)
      └──────► Generator v2 (rein, deterministisch) ──► Welt
                                                         │
                                       Browser: netz.ts (Leitungen) + Szene3
```

- Generator bleibt eine reine Funktion `weltErzeugen(huelle, beschreibung, regelwerk)`; v2 ist ein eigener Codepfad, gewaehlt ueber `regelwerkVersion`.
- Leitungsfuehrung bleibt im Browser, weil sie die Anschlusspunkte der GLB-Modelle braucht.

## 4. Datenmodell (Migration `014_gruppen.sql`)

### 4.1 Neue Tabellen

```sql
gruppe(
  id uuid pk, liegenschaft_id, gebaeude_id,
  verteiler_bauteil_id uuid not null  -- bauteil mit katalog_id 'heizung.verteiler'
  nummer int not null                 -- 1..n, eindeutig je Verteiler
  bezeichnung text (<= 200),
  art text check (art in ('ungeregelt','beimisch','drossel','einspritz','umlenk')),
  reihenfolge int not null
)
gruppe_verbraucher(
  gruppe_id, bauteil_id,
  primary key (gruppe_id, bauteil_id),
  unique (bauteil_id)                 -- ein Bauteil in hoechstens einer Gruppe
)
entwurf(
  gebaeude_id pk, liegenschaft_id, stand int, daten jsonb, geaendert_am timestamptz
)
```

Fremdschluessel mit `liegenschaft_id` wie in `013_gebaeude.sql`; Loeschen eines Verteilers loescht seine Gruppen (cascade), Loeschen eines Verbrauchers dessen Zuordnung.

### 4.2 Ort im Fluss an `bauteil`

Zwei neue nullable Spalten, `check (num_nonnulls(gruppe_id, vor_bauteil_id) <= 1)`:

| Spalte | Bedeutung | Beispiel |
|---|---|---|
| `gruppe_id` | Teil sitzt im Gruppenstock | Pumpe + Mischer Gruppe 2, WMZ Gruppe 1 |
| `vor_bauteil_id` | Teil sitzt in der Leitung vor diesem Bauteil | Pumpe vor WP, Pumpe vor FBH-Verteiler OG1 |
| beide leer | normales Bauteil | WP, HK |

`standort` bleibt Pflicht; der Assistent setzt ihn auf den Standort des Bezugs (Verteiler bzw. Bauteil).

### 4.3 Katalog und Regelwerk v2

Neue Katalogeintraege: `heizung.ventil_3weg`, `heizung.ventil_2weg`, `heizung.wmz` (Bereich `zubehoer`). Vorhanden: `heizung.umwaelzpumpe`.

Standardbestueckung je Gruppenart (PO-bestaetigt):

| Art | Pumpe | Ventil |
|---|---|---|
| ungeregelt | 1 | – |
| beimisch | 1 | 1 × ventil_3weg |
| drossel | – | 1 × ventil_2weg |
| einspritz | 1 | 1 × ventil_2weg |
| umlenk | – | 1 × ventil_3weg |

WMZ optional bei jeder Art. Vorgeschlagene Teile: `status = vorgeschlagen`; vom Kunden bestaetigt/geaendert: `bestaetigt`.

Jeder Katalogeintrag erhaelt `masse: [breite, hoehe, tiefe]` (Meter, schematisch); diese ersetzen die Tabelle `MASSE` in `app/web/src/szene3/technik.ts` als einzige Quelle.

### 4.4 Beschreibung (API) und Welt

- `Beschreibung.gruppen: GruppeEingabe[]` mit `id?`, `verteiler: BauteilVerweis`, `nummer`, `art`, `bezeichnung`, `verbraucher: BauteilVerweis[]`.
- `BauteilEingabe.ort?: { gruppe: GruppeVerweis } | { vorBauteil: BauteilVerweis }`.
- Verweise wie bei Einheiten: bestehend per ID, im selben Request neu per Index. ID-Regeln wie M2a (ohne id = neu, fehlend = loeschen).
- `Welt` erhaelt `gruppen: { id, verteiler, nummer, art, bezeichnung, verbraucher: string[], zubehoer: string[] }[]` (Symbolschluessel), `steigzone: { x, z }`, und `WeltSymbol.ort?`.
- **Gruppierungsschluessel der Symbole** um Gruppe/Ort erweitert: gleiche Teile in verschiedenen Gruppen bleiben getrennte Symbole.
- `versorgung` bleibt fuer Unterverteiler → Einheiten (FBH-Kreise).

### 4.5 Huelle

Fuer Regelwerk v2 sind `breiteM`/`tiefeM` keine Eingabe mehr, sondern Ergebnis des Generators (Abschnitt 5). Eingabe: Name, Grundform (`quader` = Rechteck wie bisher, neu `quadrat`, `l_form`, `u_form`; Migration 014 erweitert die Check-Bedingung), Geschosse. Bestehende v1-Gebaeude behalten Masse und v1-Logik. Hinweis: das passt E38/M2a an (Masse werden abgeleitet statt von Planora gesetzt).

## 5. Generator v2 – Raumkomposition

### 5.1 Modulmatrix [A]

1 Modul = 3 × 3 m (rein gestalterisch).

| Raum | Groesse (Laenge × Tiefe in Modulen) |
|---|---|
| Abgaberaum mit 1 Symbol | 2 × 2 |
| 2 Symbole | 3 × 2 |
| 3–4 Symbole | 3 × 3 |
| je 2 weitere Symbole | +1 Laenge |
| Zentrale / Technik | Laenge = Anzahl Geraete-Symbole (min. 2), Tiefe 2 |
| Kern | 2 × 2 fix |
| Raum ohne Symbol | 2 × 2 |

Gezaehlt werden Symbole, nicht Mengen. Gruppenzubehoer zaehlt nicht (sitzt am Verteiler).

### 5.2 Anordnung in der Form

- Zwei Raumreihen beidseits eines Mittelgangs (1 Modul breit).
- Rechteck/Quadrat: Reihen entlang der Laengsachse. L: Reihen laufen um die Ecke durch beide Fluegel. U: durch alle drei Fluegel. Quadrat: Fluegelverhaeltnis 1:1, Reihen gleich.
- Verteilung: groesste Raeume zuerst, jeweils in die aktuell kuerzere Reihe (bei L/U entlang des Fluegelpfads).
- Gebaeudelaenge = laengste Reihe ueber alle Geschosse; alle Geschosse haben dieselbe Huelle.
- Geschosse mit weniger Inhalt: alle Raeume einer Reihe gleichmaessig gestreckt, bis die Reihe voll ist. Keine Leerflaechen.
- Seitenverhaeltnis eines Raums hoechstens 1:1.6; wird es beim Strecken ueberschritten, wird die Reihe neu aufgeteilt (Raum teilt sich die Laenge mit dem Nachbarn) [A].
- Mindestgebaeude 4 × 5 Module.
- `layoutManuell` bleibt Vorrang; Ueberlappung erzeugt wie bisher einen Hinweis.

### 5.3 Anordnung im Raum

- **Zentrale:** Geraete in einer Reihe an der Rueckwand (gangabgewandt), Vorderkanten buendig, gleiche Abstaende, Flussrichtung Erzeuger → Speicher → Verteiler; Verteiler an der Wand zur Steigzone. Teile "vor Bauteil X" direkt neben X. Reicht die Laenge nicht: zweite Reihe.
- **HK:** an der Fassadenwand, gleichmaessig verteilt (bei n Symbolen auf (2k−1)/2n der Wandlaenge).
- **FBH-Verteiler/Unterverteiler:** an der Gangwand, zur Steigzone hin.
- Uebrige Symbole: wie bisher Raster, aber innerhalb des Raums mit Wandabstand.

### 5.4 Steigzone

Ein Punkt je Gebaeude: Mitte des Kerns im untersten Geschoss mit Kern; sonst die Ecke der Zentrale zur Gebaeudemitte. In der Welt als `steigzone`.

### 5.5 Hinweise

`ohne_gruppe` (Abgabe gehoert zu keiner Gruppe), `gruppe_leer` (Gruppe ohne Verbraucher), `ueberlappung` (wie bisher). Hinweise blockieren nicht.

## 6. Leitungsfuehrung (Browser, `app/web/src/szene3/netz.ts`)

1. **Anschlussleitung:** jedes Bauteil senkrecht vom Stutzen bis zur Leitungsebene (0.40 m unter Geschossoberkante, vorhanden seit `9f6fc7d`); dort Anschlusspunkt.
2. **Gruppenstock:** je Gruppe ein eigener Verteilerabgang; Zubehoer der Gruppe uebereinander auf dem Abgang; danach Steigen zur Leitungsebene. Ohne Zubehoer nur Rohrstueck.
3. **Strang + T-Abzweige:** rechtwinkliger Strang vom Abgang zum entferntesten Verbraucher (bevorzugt im Gang); jeder weitere Verbraucher an den naechsten Punkt des bisherigen Strangs (kuerzester rechtwinkliger Weg). Deterministische Reihenfolge (Entfernung, dann Schluessel).
4. **Steigzone:** Gruppen in andere Geschosse steigen gebuendelt in der Steigzone.
5. **Spuren:** jede Gruppe eine feste Spur (Abstand [A] 0.18 m) auf der Leitungsebene; keine Ueberlagerung.
6. **Vor Bauteil X:** Teil sitzt auf der Leitung unmittelbar vor X.
7. **Unterverteiler:** Verbraucher seiner Gruppe; FBH-Kreise darunter wie bisher als Maeander.
8. **Hervorhebung:** Hover/Auswahl einer Gruppe hebt Rohr, Zubehoer und Verbraucher hervor; Karte zeigt Art, Bestueckung, Verbraucher.
9. **v1-Welten ohne Gruppen:** jeder bisherige Abgang gilt als eigene Gruppe `ungeregelt`.

Neue GLB-Modelle (3d-designer, bestehender Stil): `heizung.ventil_3weg`, `heizung.ventil_2weg`, `heizung.wmz`.

## 7. Assistent (Web)

Layout: Schrittliste links, Formular Mitte, Live-3D-Vorschau rechts.

| Schritt | Inhalt |
|---|---|
| 1 Gebaeude | Name, Form (4 Kacheln), Geschosse (Anzahl UG/OG, Codes automatisch). Nur mit `huelle.verwalten` bearbeitbar, sonst lesend. |
| 2 Einheiten | je Geschoss: Bezeichnung, Nutzungsart; Schnellknoepfe "+3 Bueros". |
| 3 Abgaben | Gebaeudestandard HK/FBH/TABS, Ausnahmen je Einheit; Hersteller/Typ/Menge optional, "weiss nicht" erlaubt. |
| 4 Zentrale | Erzeuger, Speicher ja/nein, Raum der Zentrale. |
| 5 Hauptverteiler | Anzahl Gruppen; je Gruppe Bezeichnung, Art (5 Karten), Bestueckung (vorgeschlagen, +/−), WMZ ja/nein, Verbraucher (Checkliste nach Geschoss/Einheit; zugeteilte markiert). |
| 6 Unterverteiler | Vorschlag FBH-Verteiler je Einheit mit FBH; WMZ ja/nein. |
| 7 Weitere Teile | "Teil an anderem Ort": Typ + vor Bauteil X. |
| 8 Pruefen | Zusammenfassung, Hinweise (nicht blockierend), Uebernehmen. |

- **Entwurf:** Autosave nach jedem Schritt in `entwurf` (`PUT /api/struktur/gebaeude/:id/entwurf`, optimistische Sperre ueber `stand`). Uebernehmen schreibt die Beschreibung in einer Transaktion und loescht den Entwurf.
- **Vorschau:** `POST /api/szene/vorschau` mit Huelle-Eingabe + Beschreibung → Welt, ohne Speichern. Gleiche Validierung wie Schreiben.
- **Bestehendes Gebaeude bearbeiten:** Assistent oeffnet mit geladener Beschreibung.
- **Einstieg:** Gebaeudeliste "Neues Gebaeude" und im Digital Twin "Bearbeiten".
- **Rechte:** Vorschau und Entwurf mit denselben Rechten wie Beschreibung schreiben; Schritt 1 zusaetzlich `huelle.verwalten`.
- **Gestaltung:** Skill `planora-design`, Stufe mittel (ui-ux-designer → visual-critic), Twin-Stil, echte Umlaute, Tastaturbedienung.

## 8. Tests und Abnahme

**Automatisch:**
- API/DB: Gruppen + Ort anlegen/aendern/loeschen nach ID-Regeln; ein Bauteil in hoechstens einer Gruppe; Ort exklusiv; Verteiler-Pflicht fuer Gruppe; Rechte; Entwurf mit Stand-Konflikt.
- Generator v2: Matrixgroessen, ausgeglichene Reihen, Strecken, L/U um die Ecke, Seitenverhaeltnis ≤ 1.6, Mindestgebaeude, Steigzone, stabiler Hash; v1-Welten unveraendert (bestehende Tests gruen).
- Leitungen: keine Zusammenfuehrung verschiedener Gruppen; jeder Verbraucher an seiner Gruppe; T-Abzweige rechtwinklig; keine Spurueberlagerung; Steigleitungen nur in der Steigzone.
- Assistent: Schritte, Entwurf speichern/laden, Uebernehmen, "weiss nicht" → vorgeschlagen, Tastatur.

**Mustergebaeude** (Fixture + Test + GPU-Bild):
1. Rechteck, 1 Geschoss, 1 Raum mit 1 HK (Mindestgroesse)
2. Bisheriges Beispielgebaeude neu gerechnet
3. Gruppe ohne Zubehoer + Gruppe mit 3 Ventilen und 2 Pumpen
4. Pumpe vor WP
5. FBH-Verteiler OG1 mit WMZ, Gruppe ueber zwei Geschosse
6. L- und U-Form, 3 Geschosse, viele Gruppen

**Abnahme:** Web-/Backend-Tests, Typpruefungen, Build gruen; GPU-Bilder der 6 Muster in 1440/1920/1280; visual-critic; PO-Sichtung.

## 9. Arbeitsteilung

1. **Vertrag (sequenziell, ~1 PT):** Migration 014, Typen (`welt/typen.ts`, `web/src/typen.ts`), Katalog/Regelwerk v2, Schema/Validierung, Endpunkte als Geruest, Mustergebaeude-Fixtures.
2. **Parallel in eigenen Worktrees:**
   - A: Generator v2 + Raumkomposition + Speichern/Laden Gruppen (Server)
   - B: Assistent (Web) gegen Vertrag und Vorschau-Endpunkt
   - C: Leitungsfuehrung mit Gruppen + neue GLB (Browser) gegen Welt-Format der Fixtures
3. **Zusammenfuehren:** Integration, GPU-Bilder, Kritik, PO-Sichtung.

## 10. Nicht Teil von Stufe 1

Andere Gewerke; Vorlauf/Ruecklauf getrennt; echte Masse/Flaechen; KI-Interview; Excel-Import; Freiform-Grundrisse.

## 11. Offene Punkte [?]

- Modulgroesse, Matrixwerte, Spurabstand: Startwerte, am Bild mit dem PO nachstellen.
- E38/M2a-Anpassung (Masse abgeleitet) in `00-kontext.md` als Nachtrag festhalten, sobald umgesetzt.
