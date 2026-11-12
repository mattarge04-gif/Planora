---
name: planora-design
description: Verbindlicher Ablauf fuer jede gestalterische Arbeit an Planora (3D-Szene, Dashboard, Karten, Farben, Typografie, Bewegung, Anlagenmodelle). Stuft die Aufgabe ein (klein / mittel / Richtungswechsel), koordiniert die Agenten art-director, 3d-designer, ui-ux-designer und visual-critic, regelt PO-Freigaben, GPU-Screenshots und das Nachfuehren von Lessons Learned. Verwenden, bevor visuelle Aenderungen geplant oder umgesetzt werden.
---

# Planora-Designprozess

Der Hauptagent (die Sitzung) koordiniert. Subagenten haben klar getrennte Aufgaben und arbeiten nie gleichzeitig an denselben Dateien. Bestehende Architektur, Datenbank, APIs und funktionierende Features bleiben unberuehrt.

## 0. Immer zuerst

1. `docs/design/prinzipien.md` (verbindliche Geschmacksregeln), `docs/design/designsystem.md`, `docs/design/lessons-learned.md`, `docs/design/fehler.md` lesen – auch bei kleinen Aufgaben (kurz ueberfliegen genuegt).
2. Aufgabe einstufen (Abschnitt 1) und die Einstufung dem PO in einem Satz nennen.

## 1. Einstufung

| Stufe | Merkmale | Ablauf | PO-Freigabe |
|---|---|---|---|
| **klein** | Ein Wert, ein Abstand, eine Farbe innerhalb der Palette, ein Text, ein Icon, ein Fehler im bestehenden Design; aendert keine Regel aus `prinzipien.md`; betrifft eine Ansicht | Hauptagent setzt direkt um (oder ein Designer-Agent bei viel Code); eigener GPU-Screenshot zur Kontrolle; kein Art Director, kein Critic | nein |
| **mittel** | Neue Komponente oder Ansicht im bestehenden Stil, mehrere Werte zusammen, neue Anlagenmodelle im festgelegten Stil | Designer-Agent setzt um -> visual-critic (1 Runde, bei "verbessern" max. 2 weitere) | nein; Ergebnis zeigen |
| **Richtungswechsel** | Neue Stilrichtung, neues Layout-Konzept, neue Farbwelt/Typografie, neue Lichtstimmung, Aenderung an `prinzipien.md`, alles, was der PO als Hauptreferenz sieht | Vollablauf (Abschnitt 2) | **ja, vor der Umsetzung** |

Im Zweifel eine Stufe hoeher. Taucht waehrend der Arbeit eine Richtungsfrage auf: anhalten, hochstufen.

## 2. Vollablauf (Richtungswechsel, groessere Aufgaben)

1. **Brief** schreiben (Ziel, betroffene Ansichten, Daten, Grenzen, Referenzen) und an `art-director` geben.
2. **Ansaetze:** art-director liefert `docs/design/entscheide/<datum>-<thema>.md` mit 2–3 eigenstaendigen Ansaetzen, Bewertungsmatrix, Empfehlung.
3. **Entscheid:** Hauptagent legt dem PO die Ansaetze kurz vor (AskUserQuestion mit Vorschau, wo sinnvoll). Entscheid in der Entscheid-Datei festhalten.
4. **Umsetzung:** `3d-designer` und/oder `ui-ux-designer` nacheinander, je mit Entscheid-Pfad, Dateihoheit und Testauftrag. Bei Abhaengigkeit (z. B. Tokens) zuerst die Quelle (Tokens), dann die Nutzer.
5. **Pruefung:** `visual-critic` mit Liste der Ansichten. Ergebnis in `docs/design/kritiken/`.
6. **Iteration:** nur die vom Critic genannten wirksamsten Punkte, gezielt an den zustaendigen Designer; danach erneut Critic. Hoechstens 3 Runden; dann PO entscheiden lassen.
7. **Abschluss:** Tests/Build gruen, Screenshots unter `docs/abnahme/<datum>-<thema>/`, Lessons Learned nachfuehren (Abschnitt 4), Commit.

Tests und technische Reviews (z. B. superpowers:subagent-driven-development) bleiben zusaetzlich gueltig, wenn Code entsteht.

## 3. Werkzeug und Pruefstandard

- Screenshots nur mit `werkzeug/design/` (siehe dortige README): eigene Instanz Port 3100, **echte GPU** (Renderer-Kennung NVIDIA/D3D11 o. ae.), nie SwiftShader als Beleg.
- Ansichten je nach Aufgabe: Uebersicht, Nahaufnahme, Geschossfokus, Auswahl, Separieren, reduziert; Fenster 1440 x 900, 1920 x 1080, 1280 x 720.
- Funktion und Leistung gehoeren dazu: betroffene Interaktionen ausfuehren, Konsole (CSP), fps waehrend Kameradrehung.

## 4. Lernen: Lessons Learned und Geschmacksregeln

- `docs/design/lessons-learned.md`: bestaetigte erfolgreiche Entscheidungen und wiederkehrende Fehler mit Beleg. Eintragen, wenn (a) der PO ein Ergebnis bestaetigt, oder (b) derselbe Befund in zwei unabhaengigen Kritiken auftritt. Einzelne subjektive Kritik wird **nicht** automatisch Regel.
- `docs/design/fehler.md`: gescheiterte Ansaetze mit Screenshot und Ursache.
- `docs/design/prinzipien.md` (dauerhafte Geschmacksregeln) **nur nach ausdruecklicher PO-Bestaetigung** aendern. Vorschlaege sammeln Agenten unter "Regelvorschlag" bzw. "Kandidaten"; der Hauptagent legt sie dem PO gebuendelt vor.
- `docs/design/beispiele/`: vom PO abgenommene Screenshots als Gut-Beispiele.

## 5. Dateihoheit (keine Ueberschneidung)

| Agent | Schreibt |
|---|---|
| art-director | `docs/design/entscheide/**` |
| 3d-designer | `app/web/src/szene3/**`, `app/web/public/modelle/**`, `docs/design/modelle/**` |
| ui-ux-designer | `app/web/src/karten/**`, `seiten/**`, `ui/**`, `design/**`, Stil-Dateien, `App.tsx` (Rahmen) |
| visual-critic | `docs/design/kritiken/**` |
| Hauptagent | `prinzipien.md`, `lessons-learned.md`, `fehler.md`, `beispiele/`, Commits |

Gemeinsame Tokens (`app/web/src/design/**`) gehoeren dem ui-ux-designer; 3D-relevante Token-Aenderungen stimmt der Hauptagent ab.

## 6. Effizienz

- Klein = keine Agentenrunde. Mittel = ein Designer + ein Critic. Nur Richtungswechsel = Vollablauf.
- Agenten bekommen Pfade statt eingefuegter Inhalte; Berichte kurz, Details in Dateien.
- Keine parallelen Schreib-Agenten. Critic darf parallel zu nicht-schreibender Arbeit laufen.
