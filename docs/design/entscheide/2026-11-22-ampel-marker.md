# Ampel-Marker im Modus Erneuerung – Design-Entscheid

22.11.2026, art-director. Brief `.superpowers/sdd/2026-11-22-ampel-marker/brief.md` mit drei PO-Screenshots (`po-1-zentrale.png`, `po-2-zentrale.png`, `po-3-uebersicht.png`).

**Auftrag:** Der PO findet die Ampelanzeige unruhig ("spacken noch rum"). Heute: Hud-Punkte konstanter Pixelgrösse über jedem Bauteil, die `markerReihen` zu einer Perlenkette über dem Verteiler zusammenschiebt (Zuordnung nur per Hover), in der Übersicht schwebt die UG-Kette halbtransparent neben dem Gebäude ins Leere, dazu Bodenringe in Ampelfarbe als zweite Codierung. Gesucht: ruhige, eindeutig zuordenbare, hochwertige Darstellung – Übersicht beantwortet "wo ist es rot?", Nahsicht "welches Bauteil?".

**Betroffene Ansichten:** Twin Modus E in Übersicht/Technik, Geschossfokus, Zentrale nah; 2D-Legende nur am Rand (unverändert).

**Einstufung: Richtungswechsel** (der 3D-Teil des Entscheids 19.11. "Hud-Marker + Bodenring" wird ersetzt). Unverändert gilt aus 19.11.: Neutralisierung von Technik und Leitungen im Modus E, Farben nur aus `AMPEL_FARBE`, Form zusätzlich zur Farbe, Farbtreue im Bild messen (F9).

## Diagnose (warum es heute unruhig wirkt)

1. **Losgelöst von der Welt:** Die Punkte liegen im Hud über allem, ohne Schatten, ohne Bezug zur Geometrie. Sie lesen als Aufkleber auf dem Bildschirm, nicht als Teil des Modells (Regel 12: 3D-Welt ist das Zentrum).
2. **Verschiebung zerstört Zuordnung:** `markerReihen` löst Überlappung, indem es Punkte vom Bauteil wegschiebt. Genau dort, wo am meisten Bauteile sind (Verteiler, 9 Inline-Teile), ist die Zuordnung am schlechtesten.
3. **Drei Grössen + zwei Codierungen:** Punktgrösse je Stufe, Bodenring, gedimmte Variante – zu viele Variablen für eine Aussage.
4. **Verdeckte Geschosse ohne Ort:** Die UG-Punkte haben in der Übersicht keinen sichtbaren Träger und schweben.

Folgerung für alle Ansätze: **Kein Element darf sich vom Bauteil wegbewegen**, und **in der Übersicht wird nicht je Bauteil markiert**, sondern je Ort (Geschoss/Anlage).

## PO-Nachtrag 22.11.: Legende als Filter (gilt für alle Ansätze)

PO (`po-4-legende.png`): "hier sollte man rauf druecken koennen und auf die bauteile zoomen dann damit man einzeln sieht welche ersetzt werden muessen welche noch zb angaben fehlen".

Gemeinsames Verhalten, in jedem Ansatz gleich (2D-Teil), unterschiedlich nur in der 3D-Hervorhebung (siehe "Filter" je Ansatz):

- **Klickbar:** die vier Zähler (Ersetzen, Bald ersetzen, In Ordnung, Baujahr fehlt), die Segmente des Mengenbands darüber und der Hinweis "Unvollständig, 8 Bauteile ohne Preis". Jeder wird ein Umschaltknopf (`aria-pressed`), aktiv mit `eis`-Fläche `#dbe6f0` und Rahmen `#5f88b0`; erneuter Klick oder Esc hebt den Filter auf. Ein Filter zugleich (einfach verständlich); "Angaben fehlen" als Sammelbegriff = Baujahr fehlt **oder** ohne Preis, erreichbar über den Hinweis.
- **Kamera:** fährt auf die Hüllbox der gefilterten Bauteile (bestehendes `ampelBereich`, mit gefilterter Menge; 600–900 ms). Liegen sie in mehreren Geschossen: Fokus auf das Geschoss mit den meisten Treffern, die Geschoss-Chips zeigen die Trefferzahl je Geschoss ("UG 4, OG1 1").
- **Einzeln unterscheidbar:** Unter dem aktiven Zähler klappt eine kurze Liste der Treffer auf (Bauteilname, Geschoss, Ersatzjahr bzw. "Preis fehlt"). Hover in der Liste hebt das Bauteil in 3D hervor und umgekehrt; Klick öffnet die Anlagenkarte und fährt nah heran. Pfeiltasten gehen durch die Treffer ("2 von 5").
- **"Ohne Preis" ist kein Ampelzustand:** Er bekommt keine Statusfarbe (Regel 10), sondern eine eigene Form in Neutral `#8a929e` – je Ansatz beschrieben – und erscheint nur, solange dieser Filter aktiv ist.
- **Rest der Szene:** nicht passende Bauteile und ihre Ampelzeichen treten auf ca. 25 % zurück (wie das bestehende Dimmen fremder Leitungen bei Geräteauswahl), Bauteile bleiben weiss/neutral. Keine Abdunkelung der Szene (Regel 7, F5).

---

## Ansatz A – Prüfmanschette am Bauteil

- **Leitidee:** Der Zustand sitzt dort, wo ein Haustechniker ihn hinkleben würde: als farbige Manschette direkt am Bauteil bzw. am Rohr davor – wie eine Prüfplakette oder ein Kabelbinder-Anhänger bei der Revision.
- **Verhalten nah:** Jedes Inline-Bauteil (Pumpe, Ventil, Zähler) bekommt einen Ring um seine Leitungsachse, 1.5× Rohrdurchmesser, etwa 6 cm hoch; stehende Anlagen (WP, Speicher, Kessel) ein umlaufendes Band auf halber Gehäusehöhe (ersetzt Bodenring). Form zusätzlich zur Farbe: **Rot = zwei Ringe**, Gelb = ein breiter Ring, Grün = ein schmaler Ring, Grau = Ring gestrichelt (Segmente). Keine Verschiebung, keine Kette – jedes Bauteil trägt seine Farbe selbst.
- **Verhalten Übersicht:** Manschetten bekommen eine Bildschirm-Mindestbreite wie die Rohrverdickung (Lesson 15.11., ~5 px), bleiben also lesbar. Verdeckte Geschosse: keine Anzeige im Modell; die Antwort kommt aus der Legende/Geschoss-Chips (Zähler je Geschoss).
- **Filter (Legende):** Treffer behalten ihre Manschette und bekommen zusätzlich den Auswahlumriss `#5f88b0`; alle anderen Manschetten auf 25 %. "Ohne Preis": neutraler Anhänger (kleines Schild am Ring, `#8a929e`, hohl) nur im Filter. Schwäche: in der Übersicht sind die Treffer klein, die Kamerafahrt muss daher nah genug gehen.
- **Eigenständig:** Status als Materialeigenschaft der Installation statt als Grafik; passt zur Revisionspraxis (Prüfplakette) und zu den Pressfittings, die bereits als echte Installation lesen.
- **Tokens:** Rot `#d64541`, Gelb `#e08a1e`, Grün `#2f9e6b`, Grau `#8a929e`, Gehäuse neutral `#e6e9ed`, Auswahl `#5f88b0`. Material: `MeshBasic`, Farbe vor Tone Mapping korrigiert (`vorNeutralToneMapping`, F9), leichte Eigenhelligkeit statt Emission. Bewegung: beim Einschalten E Manschetten 280 ms von Breite 0 aufziehen, sonst statisch.
- **Skizze (Zentrale nah):**

```
   |    |    |    |    |    |
  =#=  =#=  =#=  -#-  -#-  ·#·   <- Ring am Rohr
  =#=  =#=   |    |    |    |      (= doppelt rot,
  [P]  [P]  [V]  [P]  [V]  [V]      - einfach gelb,
   |    |    |    |    |    |       · schmal grün)
 ==+====+====+====+====+====+== Verteiler
 .------.        .-----.
 |  WP  |==      |SPEI-|==[ring gelb]
 |======|  rot   | CHER|
 '------'        '-----'
```

- **Risiken:** Übersicht beantwortet "wo ist es rot?" nur für sichtbare Geschosse (UG verdeckt). Kleine Ringe von Wänden verdeckt, wenn nicht im Technikschnitt. Achse der Inline-Bauteile muss aus `masse`/Leitung bestimmt werden (heute vorhanden, [A] eindeutig). N8AO dunkelt Ringe nahe Wand ~7 % (F9 Rest).

## Ansatz B – Senkel mit Sammelmarke

- **Leitidee:** Eine Marke je Anlage/Bauteilgruppe, durch ein feines Lot (Senkel) fest an ihren Ort gebunden; erst beim Annähern oder Klick fächert die Gruppe zu Einzelmarken auf, jede wieder mit eigenem Lot.
- **Verhalten nah:** Verteiler mit 9 Inline-Teilen zeigt zuerst **eine** Marke "Verteiler · 4 ersetzen" in der dringendsten Farbe (Form: Achteck für Rot, Uhr-Kreis für Gelb, wie `Ampel.tsx`). Klick oder Zoom über Schwelle: die Marke klappt in eine kurze, senkrechte Leiste aus, je Bauteil ein Punkt mit Lot zum Bauteilkopf. Lote 1 px `#8a929e`, Marke im Hud (farbtreu).
- **Verhalten Übersicht:** Je Geschoss höchstens eine Sammelmarke je Technikzone; verdeckte Geschosse werden auf ihre Grundrisskante innerhalb der Gebäudesilhouette geklemmt (nie ausserhalb), blass mit Geschossname.
- **Filter (Legende):** Alle betroffenen Gruppen klappen automatisch auf, nur die Treffer bleiben voll, der Rest auf 25 %. "Ohne Preis": Marke als hohles Quadrat `#8a929e` mit Lot. Gut unterscheidbar, aber bei 8 Treffern wieder viele schwebende Marken.
- **Eigenständig:** Der Senkel ist ein Plan-/Vermessungszeichen (Höhenkote, Bezugslinie) und macht die Zuordnung physisch, statt sie zu verschieben.
- **Tokens:** wie A; zusätzlich Lot `#8a929e` 1 px, Markenrand `#ffffff` 2 px, Zahl Inter 12/600 tabellarisch. Bewegung: Aufklappen 280 ms, Kurve `cubic-bezier(0.2,0.8,0.2,1)`.
- **Skizze (Zentrale nah, aufgeklappt):**

```
        (●4)  Verteiler – zugeklappt
          |
  ● ● ● ● ◐ ◐ ◐ ◐ ○      <- aufgeklappt
  | | | | | | | | |      Lote zu Bauteilen
  P P V P V P V V P
 =+=+=+=+=+=+=+=+=+= Verteiler
   (◐)            (●)
    |              |
  [SPEICHER]     [WP]
```

- **Risiken:** Bleibt ein Overlay (Hud) – löst "losgelöst" nur teilweise. Aufklapp-Zustand ist neue Interaktion (Tastatur, Fokus, Esc). Lote kreuzen bei schrägen Ansichten Rohre und können wie Leitungen lesen. Am meisten Logik (Gruppierung, Schwellen).

## Ansatz C – Pegelband an der Plattenstirn + Manschetten im Fokus (Empfehlung)

- **Leitidee:** Wie im Architekturmodell trägt die Schnittkante der Geschossplatte die Information: aus der Übersicht zeigt ein schmales Band an der Plattenstirn je Geschoss, wo es rot ist; im Fokus/nah übernehmen die Prüfmanschetten aus Ansatz A die Zuordnung zum Bauteil.
- **Verhalten Übersicht ("wo ist es rot?"):** Jede Geschossplatte bekommt auf ihrer zur Kamera gerichteten Stirn ein Band (ca. 6 cm hoch, Bildschirm-Mindesthöhe 4 px), **segmentiert nach Anteilen** der Bauteile des Geschosses (Rot | Gelb | Grün | Grau, links das Dringendste, Länge proportional zur Anzahl). Zusätzlich liegt eine kleine Ortsmarke (Fussabdruck in Ampelfarbe, flach auf der Platte, keine Hud-Punkte) unter jeder Anlage mit Rot. **UG/verdeckte Geschosse:** das UG-Band liegt an der Sockelkante unter dem EG – sichtbar, auch wenn das UG selbst nicht sichtbar ist; nichts schwebt mehr neben dem Gebäude. Klick aufs Band = Geschossfokus.
- **Verhalten nah ("welches Bauteil?"):** Im Geschossfokus und ab Zoomschwelle verschwinden die Fussabdrücke, jedes Bauteil trägt seine Manschette (Rot doppelt, Gelb breit, Grün schmal, Grau gestrichelt). Hover hebt Manschette + Bauteil mit `eisAkzent` hervor, Anlagenkarte wie heute.
- **Filter (Legende):** Klick auf "Ersetzen" lässt im Plattenband nur das rote Segment voll stehen (Band zeigt so direkt, welche Geschosse betroffen sind), Kamera fährt ins Geschoss mit den meisten Treffern; dort tragen die Treffer Manschette + Auswahlumriss, alle anderen 25 %. "Ohne Preis" / "Baujahr fehlt": neutraler Anhänger `#8a929e` am Bauteil, im Band ein graues Segment mit Anzahl je Geschoss. Übersicht und Nahsicht greifen hier ineinander – Band = wohin, Manschette = welches.
- **Weg:** Hud-Marker, `markerReihen`, Bodenringe, gedimmte Markervariante.
- **Eigenständig (die mutige Stelle):** Das Gebäude selbst wird zur Legende – die Plattenstirn als Pegel ist ein Zeichen aus Schnittplan und Architekturmodell, kein App-Overlay. Rest bleibt ruhig: keine schwebenden Elemente, nur Farbe auf vorhandenen Kanten.
- **Tokens:** Rot `#d64541`, Gelb `#e08a1e`, Grün `#2f9e6b`, Grau `#8a929e`, Plattenstirn `#f2f3f5`, Auswahl `#5f88b0`. Typo: keine 3D-Schrift; Geschossname/Zähler nur im bestehenden Geschoss-Panel (Inter 12/13). Material: Band und Manschetten `MeshBasic`, vor Tone Mapping korrigiert, 1 mm vor der Stirn (kein Z-Fighting), Schatten empfangen nein. Bewegung: Band füllt sich beim Einschalten E von links (280 ms); Wechsel Übersicht -> Fokus blendet Fussabdrücke aus und Manschetten ein (160 ms), sonst statisch.
- **Skizze (Übersicht, Isometrie):**

```
        ______________________
       /    OG2              /|
      /_____________________/ |
      |▓▓▓▓░░░░░░██████████|  |  OG2 Band
      |   OG1   [■]        |  |  ■ Fussabdruck rot
      |▓▓░░░░░░░███████████| /   OG1 Band
      |   EG                |/
      |████████████████████|    EG nur grün
      '====================='
       ▓▓▓▓▓▓░░░░░░░░███▒▒      UG an Sockelkante
   ▓ rot  ░ gelb  █ grün  ▒ grau (gestrichelt)
```

- **Risiken / Machbarkeit:** Plattenstirn-Geometrie existiert (`szene2/huelle.ts`); Band = zusätzliche Box je Geschoss und sichtbarer Stirnseite, billig (≤ 8 Meshes). Welche Stirn zur Kamera zeigt, ändert sich beim Drehen -> Band auf beiden kameraseitigen Stirnen oder Wechsel mit 160 ms Blende. Anteil-Band braucht Zähler je Geschoss (aus vorhandenen Ampel-Daten ableitbar, keine API-Änderung). Manschetten wie A. Rot im Band neben rotem KOO-Rohr ist durch die Neutralisierung im Modus E entschärft. Bandsegmente müssen bei 1–2 Bauteilen je Geschoss eine Mindestlänge haben ([A] 12 % der Stirn).

---

## Bewertung (1–5)

| Kriterium | A Manschette | B Senkel/Sammelmarke | C Pegelband + Manschette |
|---|---|---|---|
| Gestaltungsqualität | 4 | 3 | 5 |
| Eigenständigkeit | 4 | 3 | 5 |
| Referenz-Qualitätsrichtung | 4 | 3 | 4 |
| Produktanforderung / Lesbarkeit | 3 (Übersicht schwach, UG fehlt) | 4 | 5 |
| Machbarkeit / Leistung | 4 | 3 | 4 |
| Aufwand (5 = gering) | 4 | 2 | 3 |
| **Summe** | **23** | **18** | **26** |

## Empfehlung

**Ansatz C**, Einstufung **Richtungswechsel** (PO-Freigabe nötig).

Begründung: C trennt die beiden Fragen sauber nach Zoomstufe – die Übersicht antwortet je Geschoss am Gebäude selbst (inkl. UG an der Sockelkante, nichts schwebt), die Nahsicht je Bauteil direkt am Objekt (keine Verschiebung, keine Perlenkette). Es entfallen alle Hud-Overlays und die doppelte Codierung mit Bodenringen; die Zahl der Ampel-Elemente sinkt in der Übersicht von 17 Punkten auf höchstens ein Band je Geschoss plus wenige rote Fussabdrücke. A ist die Teilmenge von C für die Nahsicht und kann zuerst gebaut werden (Stufe 1), das Band folgt als Stufe 2. B verworfen: bleibt ein Overlay und bringt die meiste neue Interaktion.

Aufwand [A]: C gesamt 3–4 PT (Manschetten 1.5 PT, Plattenband + Fussabdruck 1–1.5 PT, Prüfung GPU/visual-critic 0.5–1 PT) plus Legende als Filter 1–1.5 PT (Umschaltknöpfe, Trefferliste, Kamerafahrt, Dimmen, Anhänger "ohne Preis") = **4–5.5 PT**. Nur A mit Filter: ~3–3.5 PT.

Prüfung nach Umsetzung: Szenario `werkzeug/design/szenarien/lebensdauer.json` um eine Nahaufnahme Zentrale (UG-Fokus) ergänzen; Farbtreue ±5 je Kanal an Band und Manschette messen (F9); 60 fps.

Ist-Belege: die drei PO-Screenshots im Brief-Ordner (keine zusätzlichen GPU-Bilder erstellt).

## Offene Fragen an den PO

1. Soll Grün im Modus E überhaupt am Bauteil markiert werden, oder nur Rot/Gelb/Grau (Grün = neutral, ruhigeres Bild)? Empfehlung: Grün schmal markieren, damit "erfasst und in Ordnung" von "nicht erfasst" unterscheidbar bleibt.
2. Band zeigt Anteile (Rot|Gelb|Grün) oder nur die dringendste Farbe je Geschoss? Empfehlung: Anteile.
3. Legende: ein Filter zugleich (Empfehlung) oder mehrere kombinierbar (z. B. "Ersetzen" + "ohne Preis")?

## Regelvorschlag (PO-Bestätigung nötig)

- **Zustandsanzeigen haften an der Geometrie:** Statusmarken sitzen am Objekt oder an Gebäudekanten und werden nie vom Objekt weggeschoben; schwebende Bildschirm-Overlays nur für Text (Karten, Tooltips). Quelle: PO-Befund 22.11.2026 "die ampeln anzeigen spacken noch rum".

## PO-Entscheid (vom Hauptagenten nachgetragen)

22.11.2026, per Auswahl:
- **Ansatz C** (Pegelband an der Plattenstirn + Manschetten).
- Frage 1: **Grün schmal markieren** – ja.
- Frage 2: **Band zeigt Anteile** – ja.
- Frage 3: Empfehlung "ein Filter zugleich" **nicht** gewählt -> [A] Legendenfilter mehrfach kombinierbar (z. B. "Ersetzen" + "ohne Preis"); Verknüpfung als ODER (Vereinigung der Treffer) [A].
- PO hat das Legendenbild nochmals geschickt: Legende klickbar mit Kamerafahrt ist Kern des Auftrags.
- Regelvorschlag "Zustandsanzeigen haften an der Geometrie": noch nicht bestätigt [?].
