# FM-Manager-Review nach Umbau «Heizungserfassung vereinfachen» – 17.11.2026

Kennzeichnung: [F] Fakt (im Browser gemessen), [A] Annahme, [?] offen.

- [F] Branch `m2c-interview`, Stand `23398b9`. Testinstanz `werkzeug/design/instanz.sh` (Port 3100), Chromium headless mit echter GPU (ANGLE D3D11, RTX 3070 Ti), Fenster 1440×900, gesteuert mit Playwright.
- [F] Gleicher Auftrag wie am 16.11.: Bürohaus UG1, EG, OG1–OG5; 4 Büros je OG, OG5 nur 3; Gastro EG; Technik UG1; Wärmepumpe und Speicher; Standard Heizkörper; FBH in OG4, OG5 und Gastro (statt Heizkörper, wie im Vorher-Review); 3 Gruppen; FBH-Verteiler automatisch; Wärmezähler an allen FBH-Verteilern.
- [F] Hauptlauf am Gebäude «Bürohaus FM». Zwei Vorläufe («Probe 1/2») dienten nur dazu, das Skript einzurichten. «Probe 3» lief identisch zum Hauptlauf und wurde für Prüfung 6 genutzt. `fm-01`/`fm-02` zeigen den Betreiber-Schritt am Gebäude «Probe 3»; dort sind die Eingaben identisch.
- Zählregel: Jeder Klick zählt 1. Auch ein Tippvorgang in ein Feld zählt 1 (Fokus-Klick inklusive). Ein Auswahlfeld (Select) zählt 1 [A]: Ein echter Nutzer klickt dafür 2× (öffnen, wählen). Keine Tastaturkürzel. Das Anmelden zählt nicht.

## 1. Klicks und Eingaben je Schritt

| Schritt | Vorher (16.11.) | Nachher | Was nachher nötig war |
|---|---|---|---|
| 1 Gebäude (Betreiber, separat) | nicht ausgewiesen | **5** | Neues Gebäude, Name, UG +, OG «5» tippen, Gebäude anlegen |
| Einstieg Kunde | in «Rest» | **2** | «Bearbeiten» in der Liste, «Weiter» aus dem schreibgeschützten Schritt 1 |
| 2 Geschosse & Einheiten | 30 (Einheiten) | **13** | + Regelgeschoss, «Büros», «4» tippen, 5 Chips OG1–OG5, OG5 aufklappen, 1 Büro entfernen, EG «Gastro», UG1 «Technik», Weiter |
| 3 Heizung | 41 (Abgaben) | **10** | Standard Heizkörper Ja, FBH Nein, TABS Nein; je OG4/OG5/EG: Heizkörper Nein + FBH Ja (6 Selects), Weiter |
| 4 Zentrale | in «Rest» | **3** | Wärmepumpe, Pufferspeicher, Weiter (Raum war vorbelegt) |
| 5 Gruppen & FBH-Verteiler | 39 (Gruppen) + 36 (Unterverteiler) = 75 | **3** | «Eigene Gruppe für» Gastro, «Wärmezähler an allen FBH-Verteilern», Weiter |
| 6 Weitere Teile | in «Rest» | **1** | Weiter |
| 7 Prüfen | in «Rest» | **1** | Übernehmen |
| Rest (Einstieg, Zentrale, Weitere Teile, Prüfen) | ~19 | (oben: 7) | |
| **Summe Kunde** | **~165** | **33** | |

- [F] **Ziel ≤ 40 erreicht: ja (33).** Das sind 80 % weniger als vorher.
- [F] Von den 33 sind zwei Klicks (FBH Nein, TABS Nein) nicht zwingend. Sie sind aber nötig, damit «Prüfen» keine «weiss nicht»-Angaben zeigt. Minimal wären es 31.
- [A] Sollen auch die drei Gruppen je einen Wärmezähler erhalten, kommen 6 Klicks dazu (je Gruppe «Bestückung» aufklappen und Schalter). Das ergäbe 39, immer noch ≤ 40. Nicht gemessen.
- [F] Die Vorher-Zahlen stammen aus `docs/abnahme/2026-11-16-fm-review/README.md`. Dort sind nur die vier grossen Blöcke ausgewiesen; den Rest (~19) habe ich nicht weiter aufgeteilt.

## 2. Die 5 teuersten Stellen (Hauptlauf) und Ideen

1. **Heizart je Geschoss umstellen – 6 Eingaben (S3).** Für «FBH statt Heizkörper» braucht jedes Geschoss 2 Selects. Idee: eine Zeile «Fussbodenheizung statt Heizkörper in: [OG5] [OG4] [EG]» mit Geschoss-Chips (3 Klicks) oder eine Auswahl je Geschoss «Heizkörper / FBH / beides» (1 statt 2). Spart 3.
2. **Regelgeschoss zuweisen – 5 Chips (S2).** Idee: Knopf «alle Obergeschosse» oder Bereich wählen (OG1 klicken, Shift-frei OG5 klicken = Bereich). Spart 3–4.
3. **Gebäudestandard – 3 Klicks (S3).** Beim Kunden steht der Standard für alle Heizarten auf «Weiss nicht». Im Code ist für neue Gebäude Ja/Nein/Nein vorgesehen. Idee: Standard beim ersten Öffnen mit Heizkörper Ja, FBH Nein, TABS Nein als Vorschlag vorbelegen. Spart 3 und verhindert Befund W3.
4. **Weiter-Klicks ohne Inhalt – 3 (Einstieg, S6, S4→S5 eingeschlossen).** Der Kunde landet im schreibgeschützten Schritt 1, und «Weitere Teile» ist meist leer. Idee: Bestehende Gebäude öffnen direkt in Schritt 2; Schritt 6 als aufklappbarer Teil von Schritt 5 oder «direkt zu Prüfen». Spart 2.
5. **Regelgeschoss anlegen – 3 Klicks (S2).** «+ Regelgeschoss», «Büros», «4» tippen. Idee: Wenn ≥ 2 OG leer sind, das Regelgeschoss direkt mit Zähler «Büros» anbieten. Spart 1–2. Kleiner Hebel; die Stelle ist schon gut.

Ausserhalb des Hauptlaufs ist das **Ergänzen nach Übernehmen** am teuersten. FBH in OG3 kostet 17 Klicks statt 6 (siehe Prüfung 5, Befund K1).

## 3. Ergebnisse der Prüfungen

### Prüfung 3 – Twin nach Übernehmen (`fm-16`, `fm-17`)

- [F] **Einheiten: 21** (OG1–OG4 je 4, OG5 3, EG 1 Gastro, UG1 1 Technik). Das entspricht dem Auftrag. Kerne habe ich nicht erfasst, weil der Auftrag keine verlangt. Die im Auftrag erwarteten «32» ergäben sich nur mit zusätzlichen Kernen [?].
- [F] Anlagen 44, bestätigt 31 von 44, Hinweise 0.
- [F] **8 FBH-Verteiler** (4× OG4, 3× OG5, 1× Gastro), alle heissen **«FBH-Verteiler»**. «Unterverteiler» kommt nirgends vor. Der Hauptverteiler heisst «Heizungsverteiler».
- [F] **Status:** FBH-Verteiler «Vorgeschlagen», Heizkörper «Bestätigt», FBH-Kreise «Bestätigt», Wärmezähler «Bestätigt». Wärmepumpe, Speicher und Hauptverteiler sind «Bestätigt», Pumpen und 3-Weg-Ventile der Gruppen «Vorgeschlagen». Das entspricht H6.
- [F] 3 Gruppen: «Heizkörper» (12), «Fussbodenheizung» (7 FBH-Verteiler), «Fussbodenheizung Gastro 0.01» (1).
- [F] **Hinweis «Leitungsführung unsauber»: nein.**

### Prüfung 4 – Assistent erneut öffnen (`fm-20`–`fm-22`)

- [F] **Regelgeschoss wieder da:** 4 Büros, gilt für OG1–OG5. OG5 zeigt «3 Einheiten · wie Regelgeschoss · Abweichung».
- [F] **Keine Meldung «abgelöst»** und auch sonst keine Meldung.
- [F] Auffällig: Die Karte meldet «8 Abweichungen in einzelnen Geschossen». Auch OG4 trägt das Schild «Abweichung» und den Knopf «Zurücksetzen», weil dort die Heizart abweicht (siehe G2).

### Prüfung 5 – Zusatzmessung FBH in OG3 (`fm-23`–`fm-33`)

- [F] **Erster Versuch, 6 Klicks:** Bearbeiten, Navigation Heizung, OG3 Heizkörper Nein, OG3 FBH Ja, Navigation Prüfen, Übernehmen.
- [F] **Es entsteht kein FBH-Verteiler.** Schritt 5 zeigt weiter «8 FBH-Verteiler». Die 4 Einheiten in OG3 erscheinen nur unter «Ausnahmen je Einheit (12)» mit ausgeschaltetem Verteiler.
- [F] **Die neuen Verbraucher sind keiner Gruppe zugeordnet.** In Schritt 5 erscheint keine Warnung. Erst «Prüfen» meldet «4 × FBH-Kreis gehören zu keiner Gruppe». Der Twin zeigt danach 8 Hinweise: 4× «Verteiler noch nicht erfasst» und 4× den Rohcode «ohne_gruppe» (`fm-27`, `fm-28`).
- [F] **Nachbessern von Hand:** Schritt 5 öffnen, «Ausnahmen je Einheit» aufklappen, 4 Verteiler einschalten. Die neuen Verteiler stehen auf «Keine Gruppe», und «Wärmezähler an allen» springt aus (`fm-29`). Danach 4× Speisung wählen und «Wärmezähler an allen» wieder einschalten (`fm-32`). **Optimaler Weg insgesamt 17 Klicks statt 6.**
- [F] Nach dem Nachbessern zeigt der Twin «**Leitungsführung unsauber** – 19 Konflikte in der automatischen Führung» (`fm-33`). Vorher, mit 4 Verteilern ohne Gruppe, waren es 13 Konflikte (`fm-31`).

### Prüfung 6 – Geschoss mit Mengen einem Regelgeschoss zuweisen (`fm-34`–`fm-36`, Gebäude «Probe 3»)

- [F] OG2 vom Regelgeschoss gelöst und die Anzahl Heizkörper je Büro auf 3/4/5/6 gesetzt. Danach OG2 wieder per Chip zugewiesen.
- [F] **Die Mengen bleiben erhalten** (3/4/5/6). OG2 zeigt danach «wie Regelgeschoss · Abweichung».
- [F] Danach am Regelgeschoss «Büro 1: Anzahl Heizkörper = 2» gesetzt. OG2 bleibt bei 3/4/5/6; OG1 Büro 1.01 erhält 2. Im Twin nach Übernehmen stehen in OG2 3/4/5/6 Heizkörper, alle «Bestätigt».

## 4. Befunde als FM-Manager

| # | Schwere | Befund | Bild |
|---|---|---|---|
| K1 | **kritisch** | Wer nach dem Übernehmen eine Heizart ergänzt, bekommt keine Automatik mehr. FBH in OG3 erzeugt keinen FBH-Verteiler und keine Gruppenzuordnung. Schritt 5 warnt nicht und behauptet weiter «8 FBH-Verteiler … an «Fussbodenheizung»». Der Fehler zeigt sich erst in «Prüfen» bzw. im Twin. Das Nachbessern braucht 17 statt 6 Klicks und Wissen über versteckte Ausnahmen. Der Regelfall im Betrieb (Umbau, Nachtrag) ist damit so mühsam wie früher. | fm-24, fm-25, fm-26, fm-29 |
| W1 | wichtig | Der Twin zeigt im Hinweis den Rohcode **«ohne_gruppe»** statt Klartext, ohne Raum oder Einheit. | fm-28 |
| W2 | wichtig | Nach dem Ergänzen von OG3 meldet der Twin «Leitungsführung unsauber», 13 bzw. 19 Konflikte. Mit 11 FBH-Verteilern an einer Gruppe ist der Router offenbar überfordert. Bei der Erstanlage (7 Verteiler) gab es keinen Konflikt. | fm-31, fm-33 |
| W3 | wichtig | Der Gebäudestandard steht beim Kunden für alle Heizarten auf «Weiss nicht». Im Vorlauf «Probe 2» blieb er so stehen: Das Ergebnis waren **0 Heizkörper** in OG1–OG3 und keine Heizkörper-Gruppe. «Prüfen» meldete nur die fehlende FBH-Anzahl, nicht die fehlenden Heizkörper. Der Twin zeigte 31 statt 44 Anlagen und 0 Hinweise. | fm-08 |
| W4 | wichtig | Von Hand eingeschaltete FBH-Verteiler haben keine Gruppe und keinen Wärmezähler, obwohl «an allen» vorher an war. Ohne Gruppe heissen sie im Twin «Heizungsverteiler» statt «FBH-Verteiler». | fm-29, fm-31 |
| G1 | gering | Der Kunde landet beim Öffnen im schreibgeschützten Schritt 1. Der erste Klick ist immer «Weiter». | fm-03, fm-20 |
| G2 | gering | Heizungs-Ausnahmen gelten in Schritt 2 als «Abweichung» (OG4 mit «Zurücksetzen», «8 Abweichungen»). Unklar ist, ob «Zurücksetzen» in Schritt 2 auch die FBH-Ausnahme verwirft [?]. Als FM würde ich das nicht anklicken. | fm-21 |
| G3 | gering | Mengen am Regelgeschoss gelten nur je Platz (Büro 1 … Büro 4). «2 Heizkörper je Büro» braucht daher 4 Eingaben. Ein Feld «gleich für alle Büros» fehlt. | fm-36 |
| G4 | gering | «Wärmezähler an allen» gilt nur für FBH-Verteiler. Ein Wärmezähler je Gruppe braucht je Gruppe 2 Klicks in einer eingeklappten «Bestückung»; einen Gesamtschalter gibt es nicht. | fm-12 |
| G5 | gering | Die Live-Vorschau zeigt in allen Schritten nur die Hülle, weder Einheiten noch Technik. Das ist bekannt (Spec Abschnitt 8.3) und hilft beim Erfassen nicht. | fm-05, fm-12 |

Positiv [F]:
- Regelgeschoss, Gruppen-Vorschlag je Heizart, «Eigene Gruppe für» Gastro und die automatischen FBH-Verteiler funktionieren bei der Erstanlage wie gewünscht.
- Der Zentrale-Raum war vorbelegt.
- «Prüfen» spricht Klartext («Für 12 Einheiten fehlt die Anzahl Heizkörper.»).
- Die Bezeichnungen «Büro 4.01» und «Gastro 0.01» sind gut lesbar.

## 5. Bilder (alle 1440×900, GPU)

| Bereich | Dateien |
|---|---|
| Schritt 1 Betreiber | fm-01, fm-02 |
| Kunde: Schritt 1 lesend, Schritt 2 | fm-03 bis fm-07 |
| Schritt 3 Heizung | fm-08, fm-08b, fm-09 |
| Schritt 4–7 | fm-10 bis fm-15 |
| Twin nach Übernahme | fm-16, fm-17 |
| Wiederöffnen | fm-20 bis fm-22 |
| Zusatzmessung OG3 | fm-23 bis fm-33 |
| Mengen beim Zuweisen | fm-34 bis fm-36 |
