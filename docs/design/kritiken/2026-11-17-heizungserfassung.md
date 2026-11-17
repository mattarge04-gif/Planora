# Heizungserfassung (Assistent Schritte 2, 3, 5, 7) – Kritik Runde 1

- Datum: 17.11.2026, Branch `m2c-interview`, Stand `23398b9`. Skill `planora-design`, Stufe mittel.
- Renderer (eigene Messung je Lauf): `ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Ti (0x00002207) Direct3D11 vs_5_0 ps_5_0, D3D11)` – echte GPU, gültig.
- Eigene Testinstanz `werkzeug/design/instanz.sh` (Port 3100/54600), am Ende gestoppt. Port 3000/54500 nicht berührt. Gesteuert mit Playwright (gleiche Startargumente wie `screenshot.mjs`), eigenes Gebäude «Bürohaus VK» über das Betreiber-Konto angelegt, danach als Admin erfasst: UG1 Technik, EG Gastro, OG1–OG5 Regelgeschoss mit 4 Büros, OG5 3 Büros, FBH in OG4/OG5/Gastro, Heizkörper-Standard mit Hersteller, WP + Speicher, eigene Gruppe Gastro, Wärmezähler an allen FBH-Verteilern.
- Ansichten: Schritte 2, 3, 5, 7 in 1440×900 und 1280×720; aufgeklappte Details in Schritt 2 (OG5, EG) und 5 (Bestückung, Verbraucher, FBH-Ausnahmen, Teilen); Tastaturfokus Chip und Select; dazu Schritt 4, 6 und Twin nach Übernahme. 1920×1080 nicht aufgenommen (nicht beauftragt).
- Bilder: `docs/abnahme/2026-11-16-heizungserfassung/vk-*.png` (30 Bilder; `vk-01`…`vk-19`, `vk-27`…`vk-30` in 1440×900, `vk-20`…`vk-26` in 1280×720).

## Noten

| Kriterium | Note | Beleg |
|---|---|---|
| Gestaltungsqualität | 4 | Ruhige weisse Karten, eine Akzentfarbe (Eis), klare Schritt-Navigation; Prüfen-Tabelle sauber (`vk-19`). Schritt 3 und FBH-Ausnahmen wirken durch Wiederholung formularlastig (`vk-07`, `vk-14`). |
| Originalität | 3 | Regelgeschoss mit Geschoss-Chips ist eine eigenständige, gute Idee (`vk-03`). Sonst bekannte Formularmuster (native Selects, Linkreihen). |
| Räumliche Wirkung | 3 | Nur Vorschau: Hülle mit weichem Licht und Kontaktschatten, aber ohne Einheiten oder Technik (bekannt, Spec 8.3). |
| Komposition | 4 | Formular links, Gebäude rechts im Gleichgewicht; Vorschau bei 1440 rechts angeschnitten (`vk-02`, Bodenplatte x ≈ 1408). |
| Typografie | 4 | Inter 22/13/12 konsistent, Umlaute korrekt, kein Eszett. Einzelne Doppelungen («Büro 1 Büro», `vk-07`). |
| Abstände | 4 | 4-px-Raster eingehalten; Segment-Spur läuft über die volle Breite mit leerem Rest (`vk-08`), WMZ-Schalter ~4 px tiefer als Select (`vk-14`). |
| Bedienbarkeit | 3 | Fokus sichtbar (`vk-21` Chip, `vk-17` Select, `vk-05` Plus-Knopf). Schwächen: Aktion als Select getarnt, Schalter-Aus-Kontrast, sehr lange Seiten (Schritt 3: 2300 px Inhalt bei 487 px Sicht in 1280×720). |
| Funktion | 3 | Ablauf vollständig, Übernahme korrekt (21 Einheiten, 44 Anlagen, Hersteller 12× im Twin, Regelgeschoss nach Wiederöffnen da). Aber stiller Datenverlust über «Zurücksetzen» (B1). |
| Leistung | 5 | Assistent öffnet in ~350 ms, Vorschau ruhig 61 fps, Twin-Drehung 60 fps. |

## Messungen (objektiv)

| Messung | Wert | Bild |
|---|---|---|
| Inhaltshöhe vs. sichtbare Höhe Formular, 1280×720 | Schritt 2: 1376/487 px · Schritt 3: **2300/487 px (4,7 Bildschirme)** · Schritt 5: 1176/487 px · Schritt 7: 616/487 px | `vk-20`, `vk-23`, `vk-24`, `vk-26` |
| Horizontaler Überlauf 1280 | keiner (scrollWidth 1280) | – |
| Kontrast Schalter «aus» (Spur RGB 201/206/214 auf Weiss) | **1,58 : 1** (Soll ≥ 3 : 1, WCAG 1.4.11) | `vk-15`, «Wärmezähler in der Gruppe» |
| Kontrast deaktivierter Knopf «Neue Gruppe» | 1,58 : 1 (deaktiviert, ohne Begründung) | `vk-16` |
| Chip gewählt / nicht gewählt (Fläche) | 219/230/240 vs. 242/243/245 = 1,14 : 1; Unterscheidung trägt der Rand RGB 95/136/176 (≈ 3,6 : 1 auf Weiss) | `vk-03` |
| Hilfetext grau auf Weiss | 4,78 : 1 (ok) | `vk-15` |
| Segment inaktiv auf Spur | 4,91 : 1 (ok) | `vk-07` |
| Badge «Vorschlag» | 5,41 : 1 (ok) | `vk-12` |
| Zurücksetzen OG4 in Schritt 2 → Schritt 3 OG4 | vorher HK «nein», FBH «ja» → nachher beide «Standard» | `vk-27`, `vk-28` |
| Öffnen Assistent / fps | ~350 ms bis Formular; 61 fps ruhig; Twin-Drehung 60 fps | – |
| Konsole | je Seite 1× 401 (bekannt), beim Öffnen des Assistenten 1–2× 404 [? URL nicht ermittelt], bekannte Three-Warnungen (`THREE.Clock`, X4000/X3595). Keine CSP-Verletzung, keine pageerror. | – |

## Befunde

### P1

**B1 – «Zurücksetzen» in Schritt 2 löscht Heizungs-Ausnahmen aus Schritt 3 ohne Warnung.**
Bild `vk-27` (OG4 «wie Regelgeschoss» + «Abweichung» + «Zurücksetzen»), `vk-28` (danach OG4 wieder Standard). Gemessen: OG4 Heizkörper «nein»/FBH «ja» → beide «Standard». Ursache sichtbar: Schritt 2 zählt Heizungs-Ausnahmen als «Abweichung» («8 Abweichungen in einzelnen Geschossen», `vk-20`), zeigt sie dort aber nicht. Wer in Schritt 2 aufräumt, verliert FBH in einem Geschoss, und Schritt 5 leitet danach weniger FBH-Verteiler ab. Bestätigt den offenen Punkt G2 aus dem FM-Review.
Vorschlag (ui-ux-designer + Zustand): In Schritt 2 nur Felder aus Schritt 2 (Anzahl, Nutzung, Bezeichnung) als Abweichung zählen und zurücksetzen. Heizungs-Ausnahmen in Schritt 2 höchstens als leises Schild «Heizung abweichend» mit Link zu Schritt 3. Falls ein Gesamt-Zurücksetzen gewollt ist: Rückfrage mit Liste («Setzt 1 Einheit und Heizung FBH in OG4 zurück»).

### P2

**B2 – Schritt 3 ist zu lang und repetitiv.** `vk-07`, `vk-08`, `vk-23`. 2300 px Inhalt bei 1280×720; der Abschnitt «Regelgeschoss» wiederholt je Platz drei Selects «Standard (…)» plus «Anzahl», danach folgt jedes Geschoss noch einmal mit eigenen Selects. Der eigentliche Fall (FBH statt HK in 3 Geschossen) liegt unten.
Vorschlag (ui-ux-designer): Regelgeschoss-Plätze als kompakte Tabelle (Zeilen Büro 1–4, Spalten HK/FBH/TABS/Anzahl) und standardmässig eingeklappt; Geschoss-Ausnahme als eine Auswahl «Heizkörper / FBH / beides / wie Standard» statt zwei Selects (deckt sich mit FM-Idee 1).

**B3 – Gruppenkarte mischt Eigenschaft und Aktion.** `vk-12`, `vk-15`. «Eigene Gruppe für [Einheit wählen …]» steht als gleichrangiges Feld neben «Art», sieht aus wie ein Zustand, ist aber eine Aktion, die eine neue Karte erzeugt. Dazu drei Aktionsstile in einer Karte (Select, umrandeter Pillenknopf «Nach Geschossen teilen», Textlinks «Bestückung»/«Einzelne Verbraucher»). Hilfetext «Zum Beispiel ein Restaurant …» je Karte wiederholt.
Vorschlag (ui-ux-designer): Nur «Art» als Feld. Darunter eine Aktionszeile «Aufteilen: [Nach Geschossen] [Eigene Gruppe für Einheit …]» im selben Knopfstil (`as-textknopf-rand`), Einheitenwahl erst im aufgeklappten Bereich wie beim Teilen (`vk-16`). Beispieltext einmal im Abschnittskopf.

**B4 – FBH-Ausnahmen als flache Liste mit 8 fast gleichen Karten.** `vk-14`. Je Karte ~106 px, OG-Schild, Schalter, «Gespeist von», Wärmezähler-Schalter; der WMZ-Schalter sitzt ~4 px tiefer als die Mitte des Selects. Uneinheitlich zur Verbraucherliste, die nach Geschoss gruppiert und einklappbar ist (`vk-15`).
Vorschlag (ui-ux-designer): gleiche Gruppierung nach Geschoss wie bei «Einzelne Verbraucher», je Verteiler eine Zeile (Schalter · Name · Speisung · WMZ), Ausrichtung `align-items: center`; abweichende Einträge hervorheben.

**B5 – Schalter «aus» kaum sichtbar.** `vk-15`: Spur 1,58 : 1 auf Weiss. «Wärmezähler in der Gruppe» liest als leeres Oval. Vorschlag (ui-ux-designer): Spur aus mit `--tw-grau-3` oder 1-px-Rand in Textgrau, damit ≥ 3 : 1.

**B6 – Badge «Vorschlag» an selbst angelegter Gruppe.** `vk-13`: Gruppe 3 «Fussbodenheizung Gastro 0.01» entstand durch eine Kundenaktion und trägt trotzdem «Vorschlag». Widerspricht H6 sichtbar (angefasst = bestätigt). Vorschlag: Badge entfällt, sobald die Gruppe angelegt oder geändert wurde; dieselbe Regel wie beim Übernehmen.

**B7 – Twin meldet nach Übernahme «Leitungsführung unsauber – 2 Konflikte».** `vk-29`. Gleiches Gebäudeprogramm wie im FM-Hauptlauf (dort 0 Konflikte); Unterschied in meinem Lauf: Hersteller am Standard, OG4-Ausnahme einmal zurückgesetzt und neu gesetzt. Nicht Teil der Gestaltung, aber für den Kunden das erste Bild nach dem Assistenten. Vorschlag: an Router-Restliste (42 Welten) anhängen, Gebäude als Testfall nachbauen.

### P3

- **B8 – Widersprüchliche Schilder.** `vk-04`, `vk-27`: «wie Regelgeschoss» und «Abweichung» nebeneinander, Knopf nur «Zurücksetzen». Vorschlag: ein Schild «Regelgeschoss · 1 Abweichung», Knopf «Auf Regelgeschoss zurücksetzen».
- **B9 – Linkreihe «+ Nutzung Büros Wohnungen Gastro Allgemein Kerne Technik»** in jeder Geschosskarte (`vk-02`: 7× sechs blaue Links untereinander), dazu wechselnd «Nutzung»/«Zusätzlich» (`vk-04`). Geschmacksurteil: wirkt als Linkteppich. Vorschlag: ein Knopf «+ Nutzung» mit kleinem Menü, oder Chips nur in leeren Geschossen; einheitliche Bezeichnung.
- **B10 – Segment-Spur volle Breite.** `vk-08`: Spur ~340 px, Optionen ~190 px, rechts leer. Vorschlag: Spur auf Inhalt breit (`justify-self: start`).
- **B11 – «Neue Gruppe» deaktiviert ohne Grund.** `vk-16`: 1,58 : 1, keine Erklärung. Vorschlag: Hinweis «Mindestens ein Geschoss wählen» oder Knopf erst nach Auswahl einblenden.
- **B12 – Aktiver Schritt verliert die Eis-Fläche beim Überfahren.** `vk-18` (Schritt 6 grau statt Eis, Maus über der Liste) vs. `vk-12`. Vorschlag: `[aria-current="step"]:hover` behält `--tw-eis`.
- **B13 – Prüfen unvollständig.** `vk-19`: Wärmezähler und Hersteller fehlen in der Zusammenfassung; «FBH-Verteiler 8, an «…», «…»» ohne Aufteilung 7+1; «Weitere Teile 0» statt «keine». Bei 1280×720 liegen die Hinweise unter der Falz, «Übernehmen» ist sichtbar (`vk-26`). Vorschlag: Zeilen ergänzen, Hinweise über der Tabelle oder Zähler im Fusskopf («2 Hinweise»).
- **B14 – FBH-Satz holprig.** `vk-13`: «8 FBH-Verteiler, automatisch an «Fussbodenheizung», an «Fussbodenheizung Gastro 0.01».» Vorschlag: «8 FBH-Verteiler, automatisch: 7 an «Fussbodenheizung», 1 an «Fussbodenheizung Gastro 0.01».»
- **B15 – Vorschau angeschnitten und ohne Inhalt.** `vk-02`/`vk-03` 1440×900: Bodenplatte rechts am Rand abgeschnitten; Einheiten/Technik fehlen (bekannt, Spec 8.3). Vorschlag (3d-designer): Kamera-Rahmung mit 24 px Rand; Inhalt der Vorschau separat planen.
- **B16 – Unklare 404 beim Öffnen des Assistenten** (Konsole, auch bei vorhandener Vorlage). Vorschlag: URL ermitteln; falls erwartete «keine Vorlage»-Antwort, als 200 mit leerem Inhalt liefern, damit die Konsole sauber bleibt.

## Top-3-Massnahmen

1. **B1 beheben (Zustand + ui-ux-designer):** Zurücksetzen in Schritt 2 auf Schritt-2-Felder beschränken, Heizungs-Ausnahmen dort nicht als «Abweichung» zählen; sonst Rückfrage mit Liste.
2. **Schritt 3 verdichten (ui-ux-designer, B2):** Regelgeschoss-Plätze als Tabelle und eingeklappt, Geschoss-Ausnahme als eine Auswahl «Heizkörper / FBH / beides». Ziel: Schritt 3 in 1280×720 höchstens ~2 Bildschirme.
3. **Schritt 5 ordnen (ui-ux-designer, B3+B4+B5):** Aktionen einheitlich in einer Zeile statt Select neben «Art»; FBH-Ausnahmen nach Geschoss gruppiert, einzeilig; Schalter-Aus-Kontrast ≥ 3 : 1.

## Funktion und Leistung

- Ausgeführt: Gebäude anlegen (Betreiber), Regelgeschoss anlegen/zuweisen, Einheit entfernen, Nutzungen hinzufügen, Standard und Geschoss-Ausnahmen, Hersteller am Standard, Zentrale, eigene Gruppe Gastro, «Nach Geschossen teilen» öffnen/abbrechen, WMZ an allen, Zurücksetzen in Schritt 2, Übernehmen, Wiederöffnen. Tastatur: Tab auf Chip und Select mit sichtbarem Fokus.
- Korrekt: 21 Einheiten, 44 Anlagen, 31/44 bestätigt, «Zehnder» 12× in der Anlagenliste, Regelgeschoss nach Wiederöffnen vorhanden.
- Fehler: B1 (stiller Verlust), B7 (2 Router-Konflikte nach Übernahme), B16 (404 in Konsole).
- Leistung: Assistent ~350 ms, 61 fps ruhig, Twin-Drehung 60 fps (1440×900).

## Geschmacksurteile (subjektiv, nicht automatisch Regel)

- Der Assistent wirkt aufgeräumt und erwachsen, die Prüfen-Tabelle ist das stärkste Bild der Runde.
- Rote «FBH-Kreis»-Schilder im Formular (`vk-09`) folgen der KOO-Farbe Heizung, lesen im Formular aber leicht als Fehler. Kein Handlungsbedarf ohne PO-Meinung.
- Native Selects und schwarze Checkboxen (`vk-15`) sind solide, aber der generischste Teil der Oberfläche.

## Kandidaten für Lessons Learned

- «Zurücksetzen» darf nur zurücksetzen, was im selben Schritt sichtbar ist; schrittübergreifende Abweichungen nicht unter demselben Schild zählen (B1, FM-Review G2 – zweite unabhängige Quelle).
- Schalter- und Chip-Zustände nicht nur über helle Flächenfarbe unterscheiden; Kontrast ≥ 3 : 1 gegen die Umgebung messen (B5).

## Gesamturteil: verbessern

Regelgeschoss, Gruppenvorschlag und Prüfen in Klartext sind gestalterisch gelungen und funktionieren. Vor der PO-Sichtung B1 beheben (stiller Datenverlust); B2–B5 machen die Schritte 3 und 5 deutlich ruhiger und sind mit einer Designer-Runde machbar. B7 gehört in die Router-Restliste.

---

## Runde 2 (17.11.2026)

- Stand `f6cc9e3` (Branch `m2c-interview`). Renderer je Lauf: `ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Ti (0x00002207) Direct3D11 vs_5_0 ps_5_0, D3D11)` – echte GPU, gültig.
- Eigene Testinstanz `werkzeug/design/instanz.sh` (3100/54600), am Ende gestoppt; 3000/54500 nicht berührt. Gebäude «Bürohaus VK2» durch das Betreiber-Konto angelegt (UG1, EG, OG1–OG5), gleiches Programm wie Runde 1: UG1 Technik, EG Gastro, Regelgeschoss 4 Büros für OG1–OG5, OG5 ohne 4. Büro, OG4 erste Einheit «Empfang», Hersteller Zehnder, WP + Speicher. Neu für diese Runde: **Kern in OG4**. Ausgangszustand per Reducer als Entwurf gespeichert; alle geprüften Handlungen danach **im Browser geklickt** (Playwright): FBH für OG4/OG5/EG über die neue Geschoss-Auswahl, «Einzeln», Zurücksetzen OG4/OG5 in Schritt 2, eigene Gruppe Gastro, Teilen öffnen/abbrechen, WMZ an allen, WMZ 4.02 aus, Verteiler 5.03 aus, Tastaturfokus, Übernehmen, Twin.
- Bilder `docs/abnahme/2026-11-16-heizungserfassung/vk2-*.png` (36): `vk2-01`…`vk2-17` und `vk2-26` in 1440×900; `vk2-20`…`vk2-25` in 1280×720, 1440×900 (Namen mit `-b`) und 1920×1080.

### Messungen (objektiv)

| Messung | R1 | R2 | Bild |
|---|---|---|---|
| Inhaltshöhe/Sichthöhe Formular 1280×720, Schritt 2 | 1376/487 | 1364/487 (2,8 Bildschirme) | `vk2-20-…-1280x720` |
| Schritt 3 | 2300/487 | **939/487 (1,9)**; Tabelle offen 1138 | `vk2-21`, `vk2-22` |
| Schritt 5 (zu) / FBH-Ausnahmen offen (1440) | 1176/487 | 1122/487 / 1596/667 | `vk2-23`, `vk2-16` |
| Schritt 7 | 616/487 | 616/487 | `vk2-25` |
| Schalter «aus», Spur 138/146/158 auf Weiss | 1,58 : 1 | **3,14 : 1** | `vk2-16` |
| Markierung «abweichend» (2 px, 95/136/176) | – | 3,6 : 1 | `vk2-16`, x 305–306 |
| «Neue Gruppe» deaktiviert (Text 201/206/214) | 1,58 : 1 | 1,58 : 1, jetzt mit Grund | `vk2-12` |
| Ausrichtung Schalter · Select · WMZ je Zeile | ~4 px Versatz | bündig (sichtbar) | `vk2-16` |
| Zurücksetzen OG4 in Schritt 2 → Schritt 3 OG4 | FBH verloren | **bleibt «Fussbodenheizung»** | `vk2-07`…`vk2-09` |
| Assistent öffnen / ruhig / Twin-Drehung | 350 ms / 61 / 60 fps | 340–344 ms / 60 fps (1280, 1440, 1920) / 60 fps | – |
| Konsole, HTTP ≥ 400 beim Öffnen | 401 + 1–2× 404 | keine; nur `THREE.Clock`, X4000/X3595; keine CSP-Verletzung, kein pageerror | – |
| Horizontaler Überlauf | keiner | keiner (1280, 1440) | – |
| Twin nach Übernahme | 2 Konflikte | 0 Hinweise, 42 Anlagen, 32/42 bestätigt | `vk2-26` |

### Befunde Runde 1 – Status

| Nr. | Befund | Status | Beleg R2 |
|---|---|---|---|
| B1 (P1) | Zurücksetzen Schritt 2 löscht Heizungs-Ausnahmen | **behoben** – im Browser geprüft, OG4 bleibt FBH; Schritt 2 zeigt nur noch «Heizung abweichend» | `vk2-07`, `vk2-08`, `vk2-09` |
| B2 | Schritt 3 lang und repetitiv | **behoben** – 1,9 Bildschirme, Regel-Tabelle eingeklappt, eine Auswahl je Geschoss | `vk2-03`, `vk2-21`, `vk2-22` |
| B3 | Gruppenkarte mischt Feld und Aktion | **behoben** – Aktionszeile «Aufteilen: [Nach Geschossen] [Eigene Gruppe für Einheit]» einheitlich | `vk2-11`, `vk2-12` |
| B4 | FBH-Ausnahmen als flache Liste | **behoben** – je Geschoss einklappbar, einzeilig, Spaltenköpfe, Abweichung im Kopf gezählt | `vk2-15`, `vk2-16` |
| B5 | Schalter «aus» unsichtbar | **behoben** – 3,14 : 1 | `vk2-16` |
| B6 | «Vorschlag» an eigener Gruppe | **behoben** – Gruppe 3 Gastro ohne Schild | `vk2-13`, `vk2-16` |
| B7 | Twin «2 Konflikte» | nicht reproduziert (0 Hinweise); bleibt auf Router-Restliste | `vk2-26` |
| B8 | Widersprüchliche Schilder | **behoben** – «Regelgeschoss · 1 abweichend» + «Zurücksetzen» | `vk2-02` |
| B9 | Linkreihe «+ Nutzung …» | offen | `vk2-08` |
| B10 | Segment-Spur volle Breite | **behoben** | `vk2-03` |
| B11 | «Neue Gruppe» deaktiviert ohne Grund | teilweise – Grund steht da, aber hinter «Abbrechen» («Neue Gruppe · Abbrechen · Einheit wählen.»), Knopf weiter 1,58 : 1 | `vk2-12` |
| B12 | Aktiver Schritt verliert Eis beim Überfahren | offen – gemessen 245/246/247 statt 219/230/240 unter der Maus | `vk2-21`, `vk2-25` |
| B13 | Prüfen unvollständig | offen – WMZ, Hersteller, Verteiler ohne Aufteilung, «Weitere Teile 0»; FBH-Kreis ohne Verteiler (Büro 5.03) nicht erwähnt | `vk2-25` |
| B14 | FBH-Satz holprig | teilweise – Schritt 5 korrekt («7 FBH-Verteiler, automatisch: 6 an …, 1 an …»), Prüfen weiter «7, an «…», «…»» | `vk2-16`, `vk2-25` |
| B15 | Vorschau | offen – bei 1440 nicht mehr angeschnitten, aber siehe N5 | `vk2-03`, `vk2-09` |
| B16 | 404 beim Öffnen | **behoben** (nicht mehr beobachtet) | – |

Summe: **9 behoben, 2 teilweise, 4 offen**, 1 nicht reproduziert (B7).

### Neue Befunde

**N1 (P1) – Kern in einem FBH-Geschoss verliert still seine Heizung.**
`vk2-05`, `vk2-06`: OG4 auf «Fussbodenheizung» gestellt → Kern 4.05 (nur Heizkörper erlaubt) steht auf Heizkörper «Nein». Die Geschoss-Auswahl zeigt trotzdem «Fussbodenheizung», nicht «Eigene Angaben»; sichtbar nur unter «Einzeln». Folge bis zum Twin: Gruppe 1 «13 Heizkörper in OG5, OG3, OG2, OG1» (OG4 fehlt, `vk2-11`), Twin ohne Hinweis (`vk2-26`). Der Kunde liest «Fussbodenheizung» nicht als «Treppenhaus unbeheizt». Gleiche Fehlerklasse wie B1 (stille Folge einer Sammelaktion).
Vorschlag (Zustand + ui-ux-designer): Die Geschoss-Auswahl ändert nur Einheiten, in denen die gewählte Heizart erlaubt ist; übrige behalten den Standard. Unter der Auswahl eine leise Zeile «Kern 4.05: keine Fussbodenheizung möglich – bleibt bei Heizkörper». [?] PO: Sollen Kerne im Standard überhaupt beheizt sein?

**N2 (P2) – Wiederhergestellte Einheit ignoriert die Geschoss-Heizung.**
`vk2-08`, `vk2-09`: OG5 auf FBH, danach in Schritt 2 «Zurücksetzen» → Büro 5.04 kommt mit Heizkörper zurück, OG5 zeigt «Eigene Angaben (unten)», 5.04 landet in der Heizkörper-Gruppe (`vk2-11`). Nicht still (Auswahl wechselt), aber überraschend; im Bericht des Designers bereits als offen genannt.
Vorschlag: Neue Einheit übernimmt die aktuelle Geschoss-Auswahl; sonst Meldung «Büro 5.04 neu angelegt – Heizung in Schritt 3 prüfen» mit Link.

**N3 (P3) – Zusatz-Kern zählt in Schritt 2 nirgends.** `vk2-08`: OG4 «5 Einheiten · Regelgeschoss» ohne Abweichung, Vorlagenkarte «20 Einheiten in 5 Geschossen» (tatsächlich 21). Vorschlag: Zusatzeinheit als «+1 Kern» im Kartenkopf und in der Summe.

**N4 (P3) – Eigene Gruppe gilt in der FBH-Liste als «abweichend».** `vk2-16`: EG «1 abweichend», obwohl Gastro absichtlich an Gruppe 3 hängt; Select abgeschnitten («3 · Fussbodenheizung Gastro»). Vorschlag: Abweichung gegen die Gruppe der Einheit messen; Option kürzer oder Select breiter.

**N5 (P3, teils Geschmack) – Vorschau zeigt Technik als rote Bruchstücke hinter den Fenstern.** `vk2-09` rechts (Fassade OG1–OG5, x ≈ 1220–1280): Steigleitung und Verteiler nur fensterweise sichtbar, liest als Störung statt als Information. Vorschlag (3d-designer, zusammen mit B15): in der Vorschau Technik entweder ganz ausblenden oder bewusst zeigen (Schnitt/Glas), nicht halb.

**N6 (P3) – Kleine Texte.** «Eigene Angaben (unten)» zeigt auf einen eingeklappten Bereich → «Eigene Angaben – unter ‹Einzeln›». Das Schild «Heizung abweichend» in Schritt 2 ist ein Sprungknopf, sieht aber aus wie ein Schild (`vk2-08`) → Pfeil oder Linkfarbe.

### Top-3-Massnahmen

1. **N1:** Geschoss-Auswahl in Schritt 3 nur auf Einheiten anwenden, in denen die Heizart erlaubt ist; Rest bleibt Standard, mit leiser Zeile. PO-Frage Kern beheizt ja/nein.
2. **N2:** Beim Zurücksetzen wiederhergestellte Einheiten erben die Geschoss-Heizung (oder sichtbare Meldung mit Link).
3. **B13/B14 Prüfen:** Wärmezähler, Hersteller, Verteiler-Aufteilung (6 + 1), FBH-Kreise ohne Verteiler, «keine» statt «0».

### Geschmacksurteile (subjektiv)

- Schritt 3 ist jetzt der ruhigste Schritt: eine Auswahl je Geschoss liest sich wie ein Formular für Fachleute, nicht wie eine Datenbankmaske. Die Regel-Tabelle passt.
- Schritt 5 wirkt geordnet; die schwarzen Schalter in drei Spalten sind gegenüber dem Rest etwas laut (viele dunkle Flächen in `vk2-16`). Kein Handlungsbedarf ohne PO-Meinung.

### Kandidaten für Lessons Learned

- Sammelaktionen («ganzes Geschoss», «Zurücksetzen») immer mit Einheiten prüfen, für die die Aktion nicht passt (Kern, wiederhergestellte Einheit) – zweiter Fall nach B1.

### Gesamturteil Runde 2: verbessern

Die Runde hat die R1-Kernbefunde sauber gelöst (B1–B6 behoben, Schritt 3 −59 %), Leistung und Konsole sind einwandfrei. Vor der PO-Sichtung N1 beheben (Kern verliert still die Heizung) und N2 entscheiden; beides ist Zustandslogik, keine neue Gestaltungsrunde. Danach «bereit»; die P3 können mit B9/B12/B13 gesammelt folgen.
