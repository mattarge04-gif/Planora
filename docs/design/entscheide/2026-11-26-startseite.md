# Startseite (Login + Gebäudeliste) – Design-Entscheid

- Datum: 26.11.2026, art-director, Branch `m2c-interview`
- Auftrag: Login und Gebäudeliste sind der erste Bildschirm der Siemens-Demo (E47, Fahrplan Punkt 5b). Kritik r1 (`docs/design/kritiken/2026-11-26-fixwelle-akte/r1/`) P1: Liste nutzt bei 1920 nur ~21 % der Fläche, je Zeile nur Name + Geschosszahl, generisches Listenmuster; Login ohne Marke, Knopf im Browser-Standardstil. PO-Wahl "Neu gestalten": je Gebäude echte Kennzahlen (Ampel/Erneuerung, fällige Kosten, Unterlagen) und eine Miniatur; Login im Markenstil. Massstab PO: nichts darf intern, roh oder generisch wirken.
- Betroffene Ansichten: `app/web/src/seiten/Login.tsx`, `seiten/Liste.tsx` (+ CSS), neue Übersichts-Endpunkte (siehe Datenbedarf).
- Einstufung: **Richtungswechsel** (neues Layout-Konzept des ersten Bildschirms, PO-Freigabe vor Umsetzung nötig). Modus nach impeccable: *Operate* (Liste) mit einem *Persuade*-Moment (Login).

## Ausgangslage Daten (geprüft im Code, 26.11.)

| Kennzahl | Heute verfügbar? | Quelle | Für die Liste nötig |
|---|---|---|---|
| Name, Liegenschaft, Anzahl Geschosse | ja, in der Liste | `GET /api/struktur/gebaeude` (`welt/routen.ts`) | – |
| Grundform, Breite/Tiefe, Geschosscodes + Höhen | je Gebäude | `GET /api/struktur/gebaeude/:id/huelle` | in die Liste aufnehmen [A] 0.25 PT. Achtung: bei Regelwerk v2 sind `breite_m`/`tiefe_m` null (Migration 014) – Miniatur dann mit Normproportion je Grundform [A], oder Hüllbox aus dem Generator [?] |
| Ampel-Zähler rot/gelb/grün/grau, Kosten 5 J. (+ Anzahl ohne Preis), Kosten je Jahr | je Gebäude, volle Rechnung | `GET /api/lebensdauer/gebaeude/:id` → `ergebnis.zaehler`, `summe5`, `jahre` | neuer Sammelendpunkt `GET /api/lebensdauer/uebersicht` (alle lesbaren Gebäude, nur Zähler, `summe5`, frühestes Ersatzjahr, optional Zähler je Geschoss aus `bauteile[].ort`) [A] 0.5–0.75 PT inkl. Tests |
| Anzahl Unterlagen | nur über die volle Ablage | `GET /api/dokumente/gebaeude/:id` (lädt alles) | neuer Endpunkt `GET /api/dokumente/uebersicht` (Anzahl sauber / in Prüfung / abgelehnt je Gebäude) [A] 0.25 PT |
| Adresse, Baujahr Gebäude, Fläche, Lageplan-Position | **nein** | – | nicht zeigen (Regel 17). Adresse wäre neues Feld + Assistent [A] 1 PT – nicht für die Demo |

Jede `/api`-Route gehört einem Modul: darum zwei kleine Übersichtsendpunkte statt eines gemischten. N+1-Aufrufe aus dem Browser (je Gebäude Lebensdauer + Ablage laden) wären für 3–8 Demogebäude machbar, aber unsauber und langsam; nicht empfohlen.

## Ansatz A – Modellplatte

- **Leitidee:** Die Startseite ist der Modelltisch des Architekturateliers: jede Liegenschaft ist eine helle Grundplatte, auf der ihre Gebäude als kleine isometrische Miniaturen stehen, und der Zustand sitzt dort, wo er im Twin sitzt – als Pegelband an der Stirn jeder Geschossplatte.
- **Eigenständig daran:** Keine Kartenliste, sondern Objekte. Die Miniatur ist kein Bildchen, sondern dieselbe Zustandssprache wie im Twin (Entscheid 2026-11-22, Regel 20): rot/gelb/grün-Anteile als Band an der Plattenstirn je Geschoss, UG unter der Geländelinie. Wer die Startseite gesehen hat, liest den Twin sofort – die Demo erzählt eine durchgehende Geschichte vom ersten Bild an. Die Miniatur entsteht parametrisch als SVG aus Grundform + Geschossen (keine WebGL-Instanz je Gebäude).
- **Signatur-Moment (die eine mutige Stelle):** Hover/Fokus hebt die oberste Platte der Miniatur um 4 px an (der Twin-Schnitt im Kleinen, 160 ms); Klick blendet die Miniatur in die Twin-Kamera über (gleiche 3/4-Ansicht, 280 ms Überblendung, dann normaler Twin-Start). Sonst nichts bewegt sich.
- **Tokens:**
  - Farben: `grund` #f5f6f8 (Seite), `modellplatte` #eceef1 (neu [A], Liegenschafts-Grundplatte, zwischen grund und grau1), `flaeche` #ffffff (Gebäudekörper, Kennzahlenfeld), `grau-2` #c9ced6 (Plattenstirn/Schattenseite der Miniatur), `text` #1f2630, Status #d64541 / #e08a1e / #2f9e6b nur im Pegelband und Ampelzähler; `eis-akzent` #5f88b0 nur Fokusring.
  - Typo: Gebäudename 15/600, Kennzahl Kosten 22/600 tabular-nums, Nebentext 12/400 `textSekundaer`; Liegenschaftsname 15/600 links auf der Platte (keine Versal-Eyebrow).
  - Material/Licht (SVG): drei Flächentöne je Körper (Dach `flaeche`, linke Seite #e9ecf0, rechte Seite `grau-2` mit 60 %), weicher Schlagschatten nach rechts unten wie `schatten.objekt` (Sonne 225°); keine Konturlinien (Regel 11, F1).
  - Bewegung: 160 ms Hover (Plattenheben), 280 ms Überblendung in den Twin, `prefers-reduced-motion`: kein Heben, direkter Wechsel.
- **Skizze 1920x1080:**

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ [▣] Planora   Gebäude                                     ( Suche … )   [+ Neues Gebäude] [⎋] │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                              │
│  ╭─ Areal Industriestrasse ─────────────── 3 Gebäude · 5 J.: CHF 118'400 (unvollst.) ─────╮   │
│  │                                                                                      │   │
│  │      ▟▀▀▀▀▙            ▟▀▀▀▀▀▀▀▙                 ▟▀▀▀▙                                │   │
│  │      █    █▌           █       █▌                █   █▌                               │   │
│  │      █▀▀▀▀█▌ ▬▬▬▬░░    █▀▀▀▀▀▀▀█▌ ▬▬▬░░░░        █▀▀▀█▌ ░░░░░░                        │   │
│  │      █▄▄▄▄█▘ ▬▬░░░░    █▄▄▄▄▄▄▄█▘ ▬░░░░░░        █▄▄▄█▘ ░░░░░░  ← Pegelband je Geschoss│   │
│  │  ~~~~UG~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ Geländelinie       │   │
│  │                                                                                      │   │
│  │   Bürohaus Nord          Werkhalle 2               Pförtnerhaus                      │   │
│  │   4 Geschosse            2 Geschosse               1 Geschoss                        │   │
│  │   ● 5 ersetzen ● 5 bald  ● 1 ersetzen ● 3 bald     ● alle in Ordnung                 │   │
│  │   CHF 37'600  in 5 J.    CHF 80'800  in 5 J.       CHF 0  in 5 J.                    │   │
│  │   ⚠ 8 ohne Preis         12 Unterlagen             3 Unterlagen                      │   │
│  │   14 Unterlagen                                                                      │   │
│  ╰──────────────────────────────────────────────────────────────────────────────────────╯   │
│                                                                                              │
│  ╭─ Zweite Liegenschaft ─ … (gleiches Muster, Platte schmaler bei weniger Gebäuden) ──────╮   │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
 Spalten je Gebäude: min 300, max 440 px; Miniatur 200–280 px hoch; Platte volle Inhaltsbreite (max 1600)
```

- **Skizze 1280x720:**

```
┌──────────────────────────────────────────────────────────────────────┐
│ [▣] Planora  Gebäude                       [+ Neues Gebäude] [⎋]      │
├──────────────────────────────────────────────────────────────────────┤
│ ╭ Areal Industriestrasse ──── 3 Gebäude · 5 J.: CHF 118'400 ───────╮ │
│ │    ▟▀▀▙ ▬░        ▟▀▀▀▀▀▙ ▬░        ▟▀▙ ░                         │ │
│ │    █▄▄█ ▬░        █▄▄▄▄▄█ ░░        █▄█ ░                         │ │
│ │  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~           │ │
│ │  Bürohaus Nord     Werkhalle 2        Pförtnerhaus                │ │
│ │  ● 5 ● 5           ● 1 ● 3            ● in Ordnung                │ │
│ │  CHF 37'600 / 5 J. CHF 80'800 / 5 J.  CHF 0 / 5 J.                │ │
│ │  14 Unterlagen     12 Unterlagen      3 Unterlagen                │ │
│ ╰──────────────────────────────────────────────────────────────────╯ │
└──────────────────────────────────────────────────────────────────────┘
 Miniatur 150–170 px hoch; ab < 3 Spalten Platte bricht in Reihen um
```

- **Login A:** links (40 %) das Formular auf `flaeche` ohne Kartenrahmen, Bildmarke 40 px + Wortmarke 22/600, darunter eine Zeile Produktbeschreibung ("Erneuerungsplanung und Anlagenakte für Gebäudetechnik"), Felder 40 px hoch mit Label darüber, Knopf `ep-knopf-haupt` (Graphit-Pill, volle Breite). Rechts (60 %) auf `modellplatte` eine einzige grosse Miniatur in Markenform (drei Platten, oberste aufgeschnitten – die Bildmarke als Gebäude), ohne Daten, ohne Bewegung. Bei 1280 rechts 50 %, darunter ausgeblendet ab < 960 px.
- **Wirkung:** "Digital-Twin-Plattform" ab dem ersten Bild; der Zustand eines Gebäudes ist ohne Lesen erfassbar (Band rot/gelb/grün), Kosten und Unterlagen beantworten "warum öffne ich dieses Gebäude". Füllt 1920 auch bei 3 Gebäuden.
- **Datenbedarf:** Liste + Grundform/Geschosse (0.25 PT), `lebensdauer/uebersicht` mit Zähler je Geschoss (0.75 PT), `dokumente/uebersicht` (0.25 PT).
- **Aufwand [A]:** Backend 1.25 PT, Frontend (SVG-Miniatur-Generator für quader/l_form/u_form + Pegelband, Platte, Login, Zustände Laden/leer/Fehler, 1280/1440/1920) 2 PT, Kritikrunde 0.5 PT → **ca. 3.75 PT**.
- **Risiken:** (1) Skaliert schlecht über ~20 Gebäude je Liegenschaft – für Siemens-Portfolios später eine Registeransicht (Ansatz B) als Umschalter nötig. (2) Bei Regelwerk v2 fehlen echte Masse → Proportionen geschätzt; muss als schematisch lesen, nicht als massstäblich [A]. (3) Pegelband in 4–6 px Höhe an Miniaturen: Lesbarkeit im GPU-/Browser-Bild messen (Lesson 22.11.: Rot-Fläche ≥ Grün-Fläche). (4) L/U-Form isometrisch im SVG sauber zu zeichnen kostet Sorgfalt (Verdeckung der Flügel).

## Ansatz B – Erneuerungsregister

- **Leitidee:** Die Startseite ist das Planregister eines Facility Managers: eine ruhige, breite Tabelle aller Gebäude, sortiert nach Dringlichkeit, mit einem Geschossschnitt als Zeilenkopf und einem Zehnjahresband, das zeigt, wann es teuer wird.
- **Eigenständig daran:** Die Silhouette ist kein Icon, sondern ein **Schnitt** (Ansicht von vorn): Geschosse als gestapelte Streifen, UG unter der Geländelinie, jeder Streifen in seinem Ampelanteil eingefärbt – ein Planunterlagen-Motiv statt Gebäudesymbol. Rechts je Zeile ein kleines Jahresband 2026–2035 (Säulen = echte `jahre[].betrag`, gestrichelt wo Preise fehlen – dieselbe Sprache wie der Erneuerungsplan). Oben eine Portfolio-Zeile über alle Gebäude (Summe 5 J., Zähler). Die Startseite wird damit selbst zum Arbeitswerkzeug.
- **Tokens:**
  - Farben: `grund` #f5f6f8, `flaeche` #ffffff (Register), `flaeche-2` #f2f3f5 (Kopfzeile, Hover-Zeile `eis` #dbe6f0), `grau-1` #e6e9ed (Zeilentrenner), `text` #1f2630, Säulen #a3b8cc (wie Kosten je Jahr im Erneuerungsplan), Status nur im Schnitt und im Zähler.
  - Typo: Zeilen 13/400, Name 13/600, Beträge 13/600 tabular-nums rechtsbündig, Portfolio-Summe 22/600.
  - Bewegung: Zeilen-Hover 160 ms, Sortierwechsel ohne Animation; keine Eintrittsanimation.
- **Skizze 1920x1080:**

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ [▣] Planora   Gebäude                                     ( Suche … )   [+ Neues Gebäude] [⎋] │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│  Alle Liegenschaften   CHF 118'400 in 5 Jahren (unvollständig, 9 ohne Preis)                   │
│  ● 6 ersetzen   ● 8 bald ersetzen   ● 21 in Ordnung   ◌ 7 Baujahr fehlt                         │
│ ┌──────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ Schnitt  Gebäude ▾            Liegenschaft     Ersetzen Bald  5 J. (CHF)  2026 ……… 2035  Unterl.│
│ ├──────────────────────────────────────────────────────────────────────────────────────────┤ │
│ │ ▤▤▤▤     Bürohaus Nord        Areal Industr.     5      5     37'600 ⚠   ▁ ▇ ▁ ▁ ▁ ▁ ▂ ▁   14   │ │
│ │ ▤▤▤▤ ~                                                                                  │ │
│ │ ▤▤       Werkhalle 2          Areal Industr.     1      3     80'800     ▃ ▁ ▁ ▆ ▁ ▁ ▁ ▁   12   │ │
│ │ ▤        Pförtnerhaus         Areal Industr.     –      –          0     ▁ ▁ ▁ ▁ ▁ ▁ ▁ ▁    3   │ │
│ │ …                                                                                          │ │
│ └──────────────────────────────────────────────────────────────────────────────────────────┘ │
│   Zeile 72 px; Schnitt 56×56; Klick Zeile → Twin, Klick Jahr → Erneuerungsplan gefiltert       │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Skizze 1280x720:** Spalte "Liegenschaft" wird Gruppenkopf; Jahresband auf 5 Jahre gekürzt; Spalten Schnitt · Gebäude · Ersetzen · Bald · 5 J. · Band · Unterlagen.
- **Login B:** zweispaltig: links Formular wie A; rechts ein grosser Geschossschnitt der Bildmarke im Planstil (Platten, Geländelinie, feine Höhenkoten) auf `flaeche-2` – Planunterlagen-Ästhetik, ohne Linienzeichnung im 3D-Sinn.
- **Wirkung:** Sehr seriös, FM-nah, skaliert auf hunderte Gebäude, nutzt die Breite vollständig. Spricht Siemens' FM-Sicht direkt an (Dringlichkeit, Kosten, Zeit).
- **Datenbedarf:** wie A, zusätzlich `jahre[]` (10 Werte) in `lebensdauer/uebersicht` (bereits berechnet, nur mitliefern).
- **Aufwand [A]:** Backend 1.25 PT, Frontend 1.75 PT (Tabelle, Sortierung, Schnitt-SVG, Mini-Säulen), Kritik 0.5 PT → **ca. 3.5 PT**.
- **Risiken:** (1) Wirkt näher am "Software-Verwaltung"-Urteil der Kritik als A – die 3D-Welt ist nicht spürbar; Regel 12 ("3D-Welt ist das visuelle Zentrum") wird auf der Startseite nur durch den Schnitt bedient. (2) Mini-Säulen je Zeile grenzen an Dashboard-Dichte; bei wenigen Demogebäuden (3–4 Zeilen) bleibt unten wieder Leere. (3) Rot im Schnitt neben KOO-Rot nicht relevant (keine Gewerkefarbe auf der Seite) – unkritisch.

## Ansatz C – Lebendes Areal (3D-Einstieg)

- **Leitidee:** Die Startseite ist bereits eine 3D-Szene: alle Gebäude einer Liegenschaft stehen als reduzierte Hüllen auf einer gemeinsamen Diorama-Platte, mit Pegelband an der Stirn, und ein Klick fliegt die Kamera ohne Seitenwechsel ins Gebäude.
- **Eigenständig daran:** Kein Seitenwechsel zwischen Liste und Twin – die Kamerafahrt vom Areal ins Gebäude ist die Signatur. Rechts eine schwebende Liste mit denselben Kennzahlen wie A (Name, Zähler, Kosten, Unterlagen); Hover in der Liste hebt das Gebäude in der Szene hervor und umgekehrt.
- **Tokens:** wie Twin (Architekturatelier), dazu nichts Neues; Panels 0.94 Deckkraft, Kamera ortho 3/4.
- **Skizze 1920x1080:**

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ [▣] Planora   ( Areal Industriestrasse ▾ )                              [+ Neues Gebäude] [⎋] │
│                                                                    ╭───────────────────────╮ │
│            ▟▀▀▀▀▀▙                                                 │ Bürohaus Nord          │ │
│            █     █▌ ▬░         ▟▀▀▀▀▀▀▀▀▀▀▙                        │ ● 5  ● 5   CHF 37'600  │ │
│            █▄▄▄▄▄█▘ ▬░         █          █▌ ▬░                    │ 14 Unterlagen          │ │
│      ░░░░░░░░░░░░░░░░░░░░░░░░░ █▄▄▄▄▄▄▄▄▄▄█▘ ░░                    ├───────────────────────┤ │
│      ░ Diorama-Platte (Wege, Bäume aus Kulisse)  ▟▀▙               │ Werkhalle 2  …         │ │
│      ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ █▄█▘ ░            │ Pförtnerhaus …         │ │
│                                                                    ╰───────────────────────╯ │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Skizze 1280x720:** Szene links ~70 %, Liste rechts 300 px, Kennzahlen auf zwei Zeilen.
- **Login C:** Formular über einem einmal gerenderten, unscharfen Standbild der Areal-Szene – widerspricht Regel 16 ("nie statische Hintergrundgrafik") nur knapp; besser wie A mit Markenminiatur.
- **Wirkung:** Maximal eindrucksvoll, am nächsten an `01-dashboard.png`.
- **Datenbedarf:** wie A, plus Lage der Gebäude auf dem Areal – **existiert nicht** (keine Lagekoordinaten); automatische Reihung [A] oder neues Feld + Eingabe (1–1.5 PT). Weltgeometrie je Gebäude laden (`/api/szene/gebaeude/:id/welt` erzeugt jeweils die ganze Welt) – für eine Übersicht zu schwer; reduzierte Hüllen-Variante nötig [A] 1 PT.
- **Aufwand [A]:** Backend 2.25–2.75 PT, Frontend/3D 4–5 PT, Kritik 1 PT → **ca. 7–9 PT**.
- **Risiken:** (1) Sprengt den Fahrplan (5b = 1.5 PT) deutlich; in 3–4 Wochen neben Suche/Ablage/Server riskant. (2) Erfundene Lage der Gebäude auf dem Areal widerspricht Regel 17 im Geist (suggeriert einen Lageplan). (3) Zweite WebGL-Szene vor dem Twin: Ladezeit beim ersten Bild der Demo, Speicher. (4) Skaliert nicht auf viele Gebäude.

## Bewertung (1–5)

| Kriterium | A Modellplatte | B Register | C Areal 3D |
|---|---|---|---|
| Gestaltungsqualität | 5 | 4 | 5 |
| Eigenständigkeit | 5 | 4 | 3 |
| Referenz-Qualitätsrichtung (01/02) | 4 | 3 | 5 |
| Produktanforderung / Lesbarkeit | 4 | 5 | 3 |
| Machbarkeit / Leistung | 4 | 5 | 2 |
| Aufwand (5 = gering) | 3 | 3 | 1 |
| **Summe** | **25** | **24** | **19** |

## Empfehlung

**Ansatz A – Modellplatte**, Login nach A (Formular links, Markenminiatur rechts).

Begründung: A beantwortet die Kritik P1 am direktesten (Fläche gefüllt, Objekte statt Zeilen, echte Kennzahlen) und macht den ersten Bildschirm zum Vorspann des Twins: dieselbe Zustandssprache (Pegelband an der Plattenstirn, Regel 20), dieselbe Lichtrichtung, dieselbe Isometrie. Für eine Demo mit wenigen Gebäuden ist das stärker als ein Register (B), das bei 3–4 Zeilen wieder leer wirkt, und ohne die Machbarkeits- und Wahrheitsrisiken von C (erfundene Lage, zweite 3D-Szene). B bleibt der richtige Weg für grosse Portfolios und kann später als Umschalter "Register" mit denselben Endpunkten folgen (Zusatz [A] ca. 1.5 PT).

Einstufung: **Richtungswechsel** – PO-Freigabe vor Umsetzung.

Hinweise an den Hauptagenten:
- Aufwand ca. 3.75 PT gegen 1.5 PT im Fahrplan (5b, inkl. Restpunkte) – PO muss den Mehraufwand bestätigen oder Abstriche wählen (z. B. ohne Zähler je Geschoss: Band einfarbig je Gebäude statt je Geschoss, –0.5 PT).
- Die Wirkung hängt an den Demodaten (Kritik P5): echte Gebäudenamen statt "Muster 6 L-Form viele Gruppen", mindestens 3 Gebäude mit unterschiedlichen Zuständen, Hersteller an allen Zentralgeräten. Ohne das bleibt auch A "intern".
- Kosten nur mit Hinweis "unvollständig" zeigen, wenn `summe5.ohnePreis > 0` (wie Erneuerungsplan); Gebäude ohne Bauteile zeigen "Noch keine Anlagen erfasst" statt CHF 0.
- Leer- und Fehlerzustände: Liegenschaft ohne Gebäude = leere Platte mit "Gebäude anlegen" (nur mit Recht), sonst Text.
- Optionaler visueller Schnellentwurf (statisches HTML/SVG der Miniaturen) vor der PO-Wahl, falls die ASCII-Skizze nicht reicht – nicht erstellt.

## Regelvorschlag (PO-Bestätigung nötig)

- "Gebäudedarstellungen ausserhalb des Twins (Startseite, Vorschauen) nutzen dieselbe Zustandssprache wie der Twin: Pegelband an der Plattenstirn je Geschoss, keine eigenen Icons oder Punkte für den Zustand." (Erweiterung von Regel 20)

## Offene Fragen an den PO

1. Mehraufwand A (~3.75 PT statt 1.5 PT) freigeben?
2. Soll der Login den Kundennamen der Instanz zeigen (z. B. "Instanz für …")? Wäre ein Konfigurationswert je Instanz [A] 0.25 PT; ohne Freigabe nur Planora-Marke.
3. Adresse je Gebäude für die Demo gewünscht? Existiert nicht; neues Feld + Assistent [A] 1 PT.

## PO-Entscheid (vom Hauptagenten nachgetragen)

offen

## PO-Entscheid (26.11.2026)

Rohantworten: Ansatz "A Modellplatte (Recommended)"; Kundenname im Login "Ja (Recommended)"; Adresse je Gebaeude "Nein, später (Recommended)".

- Umsetzung Ansatz A (Pegelband je Geschoss), Aufwand [A] ca. 3.75 PT, nach der Suche.
- Login zeigt den Kundennamen der Instanz (Konfigurationswert).
- Keine Adresse in diesem Schritt. Regelvorschlag (Regel 20 ausserhalb des Twins) bleibt Vorschlag bis zur ausdruecklichen PO-Bestaetigung.
