# Dashboard, Tabellenweg, Objektkarte (Teilaufgaben 5+6) – Kritik Runde 2

- Datum: 12.11.2026, visual-critic (unabhängig; Umsetzerberichte und Root-Bilder `docs/abnahme/2026-11-12-dashboard/r2/` nur als Szenario-Quelle, Urteil nur aus eigenen Aufnahmen)
- Stand: Commit `3be7bfe`, Arbeitskopie sauber
- Renderer: `ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Ti (0x00002207) Direct3D11 vs_5_0 ps_5_0, D3D11)` – echte GPU
- Eigene Instanz 3100/54600, nach Prüfung gestoppt. PO-Server 3000/54500 nicht berührt.
- Ansichten: Übersicht, Technik (EG), Tabellenauswahl «Heizungsverteiler», OG1, separiert (OG1-Fokus), OG1 ausgeblendet, Profilmenü, Gebäudewahl, reduziert – je 1440×900, 1920×1080, 1280×720. 3D-Hover und 3D-Klick je Fenster (`3d-1440/1280/1920`). Zusatz (1440, 1280): Separieren aus Übersicht, «Zum Ort in OG1», Esc-Kette nach Hinweis und nach Auswahl, Zeilen-Hover, Tastaturweg (Tab/Enter), Zoom Übersicht/Technik.
- Screenshots: `docs/design/kritiken/2026-11-12-dashboard-r2/` (+ `3d-*/`, `zusatz/`)
- Referenz: `docs/design/referenzen/01-dashboard.png`; Vorrunde `2026-11-12-dashboard-r1.md`

## Stand der Top-3 aus Runde 1

| R1-Massnahme | Stand | Beleg |
|---|---|---|
| 1. Komposition schliessen, Legende einbinden, Platte nicht unter Karten | **Grösstenteils behoben.** Anlagenkarte läuft volle Breite (20–1420 bei 1440), Legende sitzt im Tabellenkopf rechts, rechte Spalte trägt jetzt Leerzustand bzw. Objektkarte – umlaufender Rahmen wie Bild 1 erreicht. **Offen (szene):** Modellplatte läuft weiterhin unter Tabelle (Spitze bei y≈630 unter Tabellenoberkante 617) und links unter die Hinweise-Karte bei ausgeblendetem OG1. | `uebersicht-1440x900.png`, `ausgeblendet-1440x900.png` x 300–348 / y 330–350 |
| 2. Tabellenweg vollständig | **Behoben.** Ganze Zeile fokussier- und klickbar (`tr tabIndex=0`, `aria-current`), Auswahl in Eis über volle Breite, Fokusring über volle Zeile, Zeilenklick wählt Anlage in 3D und öffnet Objektkarte, 3D-Klick markiert die Zeile. Scrollhinweis «Liste scrollbar» plus Ausblendverlauf. | `tabelle-auswahl-*.png`, `3d-1440/klick-3d-1440x900.png` (Zeile «Speicher»), `zusatz/esc1-nach-auswahl-1440x900.png` |
| 3. Typo- und Kontrastskala | **Behoben.** Keine 10/11/17/20-px-Werte mehr in `ui.css`/`Twin.css`; Link #4a7298 auf Weiss 5.06:1 (vorher 3.73). | Messung unten |

## Noten

| Kriterium | Note | Beleg |
|---|---|---|
| Gestaltungsqualität | 4 | Ruhiger, geschlossener Rahmen; Objektkarte mit Status-Badge, Versorgt-Chips und Dokumente-Platzhalter wirkt präzise und hochwertig (`tabelle-auswahl-1440x900.png`, x 1124–1420 / y 271–600). Abzug: Verbindungslinie verschwindet über dem Modell (siehe Funktion). |
| Originalität | 4 | Eigenständig, keine generischen KI-Muster (kein Glow, keine Deko-Diagramme, keine Versal-Eyebrows). Der gestrichelte Leerzustand «Anlage im Modell oder in der Liste wählen …» ist ein guter, eigener Platzhalter. |
| Räumliche Wirkung | 4 | Panels schweben glaubwürdig, Szene bleibt Zentrum. Separieren aus der Übersicht zeigt einen schmalen, aber erkennbaren Spalt (ca. 12–15 px bei 1440, `zusatz/separiert-uebersicht-1440x900.png` y≈320–345); im OG1-Fokus ist die Separation kaum ablesbar (`separiert-1440x900.png` vs. `og1-1440x900.png` fast identisch). |
| Komposition | 4 | Übersicht 1440: Gebäude ohne Platte ca. 73 % Breite / 70 % Höhe der freien Fläche – im Ziel. Abzüge: Technik ohne Einpassung auf die Zentrale (Wärmepumpe/Speicher ca. 18–22 px bei 1440, ca. 14 px bei 1280, `technik-1280x720.png` x≈805/y≈368); Platte unter Tabelle. |
| Geometrie | – | Nicht Gegenstand (Szene3, Teilaufgabe 3/4). |
| Licht | – | Nicht Gegenstand. Hinweis: Grund normal (234,235,237) vs. reduziert (245,246,248) weiter verschieden (bekannter P2). |
| Materialien | 4 | Panels Weiss 85 % + Blur unverändert sauber; Auswahl Eis (#dbe6f0) in Tabelle und Geschossliste konsistent. |
| Typografie | 4 | Skala 12/13/15/22 eingehalten, echte Umlaute überall («Wärmepumpe», «Bestätigt», «Heizkörper», «Gebäude wählen»). Abzug klein: Objektkarte «Hersteller / Typ: Nicht erfasst», Tabelle zeigt für dieselbe Anlage «–» – zwei Formulierungen für denselben Zustand. |
| Abstände | 4 | Rand 20, Kartenabstand 12, Zeilen 36 px. **Abweichung (objektiv):** bei 1280×720 liegen Objektkarte und Anlagenkarte nur 2 px auseinander (Unterkante 520, Oberkante 523; `tabelle-auswahl-1280x720.png` x 1100) statt 12 px. |
| Referenz-Qualitätsrichtung | 4 | Verzahnter Kartenrahmen um die Szene, Objektkarte mit Linie zum Objekt – Richtung von Bild 1 erreicht, ohne Kopie. Was noch fehlt: die Szene im Technik-Modus füllt den Rahmen nicht so selbstbewusst wie Bild 1 (Zentrale zu klein). |
| Bedienbarkeit | 4 | Tastatur: Tab erreicht Glocke, Geschosszeilen, Tabellenzeilen; Enter auf Geschosszeile fokussiert OG1 (`zusatz/tab15`, `tab-enter`); Fokusringe sichtbar; nach Esc geht Fokus an den Auslöser zurück (Ring um «Zum Ort in OG1», `zusatz/zum-ort-esc1`). Hover-Tooltip «Speicher» erscheint (`3d-1440/hover-3d-1440x900.png` x 935–1005 / y 453–477). Abzüge: Auswahl-/Hover-Rückmeldung am 3D-Objekt bei ca. 20 px Objektgrösse kaum ablesbar; falscher Ausblendverlauf bei 1920 (siehe Funktion). |
| Funktion | 4 | Tabelle → 3D, 3D → Zeile, Objektkarte, Esc-Kette, Auge, Separieren, Gebäudewahl, Profilmenü, reduziert funktionieren. Abzüge siehe Abschnitt Funktion: Verbindungslinie über dem Modell unsichtbar, «Zum Ort» ohne Ortsmarke, Verlauf ohne Scrollbedarf. Konsole ohne CSP-Verletzung. |
| Leistung | 5 | 60 fps bei Kameradrehung in 1440/1920/1280; Szene nach ≤ 7 s ruhig (nicht feiner gemessen). |

## Messungen (objektiv)

| Messung | Wert |
|---|---|
| fps Drehung 1440 / 1920 / 1280 | 60 / 60 / 60 |
| Mittlere Helligkeit (Luma) Übersicht / Technik / reduziert, 1440 | 236.6 / 237.9 / 242.5 |
| Mittlere Sättigung | 1.2–1.3 % (Farbe nur KOO-Rot, Status-Grün/-Orange, Eis-Auswahl – korrekt) |
| Anteil Pixel ≥ 240 normal / reduziert | 42 % / 82 % |
| Hintergrund normal / reduziert | rgb(234,235,237) / rgb(245,246,248) – unverändert gegenüber R1 |
| Kontrast Link #4a7298 auf Weiss | 5.06:1 (R1: 3.73) |
| Kontrast Verbindungslinie (gemessen ≈ rgb(201,206,214)) auf Grund 234 / auf Boden Technikraum ≈ (206,217,227) | **1.33:1 / 1.10:1** – ab ca. 40 % der Strecke praktisch unsichtbar (Abtastung entlang 1096,301 → 826,485 in `tabelle-auswahl-1440x900.png`) |
| Abstand Objektkarte ↔ Anlagenkarte, 1280 | 2 px (Soll 12) |
| Tabelle 1920: dunkelster Textwert Zeile 1–6 / Zeile 7–8 | 37 / 111 – letzte zwei Zeilen ausgeblendet, obwohl alle 8 Zeilen vollständig sichtbar sind (`tabelle-auswahl-1920x1080.png` y 994/1030) |
| Sichtbare Tabellenzeilen 1280 / 1440 / 1920 | 3 / 5 / 8 von 8 (1280 ohne Spalte Hersteller/Typ – zulässige Verdichtung) |

## Top-3-Massnahmen

1. **szene – Einpassung auf Ziel und Freiraum (Technik, Auswahl, «Zum Ort»).** Beim Wechsel auf Technik auf die Bounding-Box des fokussierten Geschosses einpassen und bei Auswahl einer Anlage sanft auf Anlage + Umfeld zoomen (Ziel: Anlage ≥ 60 px, Gebäude füllt 65–75 % von `freiraum`), `freiraum` unten mit Tabellenoberkante + 12 px, sodass die Modellplatte nicht mehr unter die Tabelle läuft. «Zum Ort» soll den Zielpunkt des Hinweises (Büro D) anfahren und ihn markieren (gleicher Ring wie Endpunkt der Verbindungslinie), nicht nur das Geschoss öffnen. Ohne das bleiben Hover-Umriss und Auswahlmarke bei ca. 20 px Objektgrösse kaum lesbar. *(objektiv: Spec Abschnitt 3 «Klick fährt zum Ort», Prinzip 6 Füllgrad)*
2. **ui – Verbindungslinie lesbar machen** (`karten/TwinObjekt.tsx`, `seiten/Twin.css` `.tw-verbindung`). Heute grau-2, 1 px, Kontrast 1.1–1.3:1 – über dem hellen Modell unsichtbar, die Linie scheint an der Gebäudeecke zu enden. Vorschlag: Strich Graphit mit 55 % Deckkraft (≈ #6b7480), 1 px, darunter 3 px weisser Halo (zweiter Pfad, `stroke: rgb(255 255 255 / .9)`), damit sie auf Weiss und Grau gleichermassen trägt; Endpunkt 4 px Radius mit Eis-Akzent-Ring beibehalten. Prinzip 11 bleibt gewahrt (keine schwarze Kontur, nur eine Linie). *(objektiv: Kontrast; Farbwahl Geschmack)*
3. **ui – Randfälle Tabelle/Objektkarte** (`karten/TwinAnlagen.tsx`, `karten/TwinObjekt.tsx`, `seiten/Twin.css`). (a) Ausblendverlauf `tw-mehr-unten` nur setzen, wenn `scrollTop + clientHeight < scrollHeight - 1` (bei 1920 fälschlich aktiv, letzte zwei Zeilen wirken deaktiviert). (b) Objektkarte bei 1280 auf `max-height: calc(Tabellenoberkante - Kartenoberkante - 12px)` begrenzen, Inhalt intern scrollen (heute 2 px Abstand). (c) «Nicht erfasst» und «–» vereinheitlichen – in der Karte «Nicht erfasst», in der Tabelle «–» mit `title="Nicht erfasst"`, oder beides gleich. *(objektiv: 12-px-Raster, falscher Zustandshinweis)*

## Funktion und Leistung

- **Tabellenklick → 3D:** «Heizungsverteiler» wählt die Anlage, Zeile in Eis, Objektkarte mit Linie, Technik/EG aktiv – funktioniert in allen drei Fenstern.
- **3D-Klick → Zeile:** Klick auf Speicher markiert Zeile «Speicher» und öffnet die Objektkarte (ohne «Versorgt», korrekt mangels Daten) – funktioniert in 1440/1280/1920.
- **Hover-Tooltip:** erscheint als Pille «Speicher» rechts unter dem Objekt; Umriss/Anheben am Objekt bei dieser Grösse nicht verlässlich erkennbar.
- **Objektkarte mit Linie:** Linie existiert, verläuft geometrisch korrekt zum Objekt, ist aber über dem Modell nicht sichtbar (Messung oben). [F, Befund]
- **Esc-Kette:** Auswahl → Esc schliesst Karte, Technik bleibt (`zusatz/esc1-nach-auswahl`) → Esc zurück zur Übersicht (`esc2`). Nach «Zum Ort» führt ein Esc direkt zur Übersicht und gibt den Fokus an den Link zurück – konsistent.
- **Auge:** OG1 ausblenden zeigt EG oben offen, Zeile durchgestrichen/blass, Symbol «Auge durchgestrichen» – gut. Einblenden funktioniert.
- **Separieren (Sichtbarkeit):** Aus Übersicht erkennbarer Spalt; im Geschossfokus kaum wahrnehmbar. Für die PO-Abnahme klar sagen, dass Separieren primär in der Übersicht wirkt, oder den Abstand im Fokus vergrössern (szene, P2).
- **«Zum Ort in OG1»:** öffnet Technik/OG1, aber ohne Markierung von Büro D und ohne Kamerafahrt dorthin; die Hinweiszeile wird nicht als aktiv markiert. (szene/ui, siehe Top-1)
- **Tastatur:** Tab-Reihenfolge Kopfzeile → Karten → Tabellenzeilen; Tabelle scrollt beim Durchtabben mit; Enter auf Geschosszeile wirkt. Gut.
- **Zoom:** Mausrad in Übersicht und Technik wirkt (`zusatz/zoom-ein`, `technik-zoom`). Einmal beobachtet [?]: Mausrad unmittelbar nach zwei Esc (Kamerafahrt läuft noch) blieb ohne Wirkung (`zusatz/zoom-1440x900.png`) – vermutlich Eingabe während der Fahrt verworfen; nicht weiter untersucht.
- **Konsole:** 401 beim Laden (Sitzungsprüfung vor Login, wie R1), THREE.Clock-Deprecation, D3D-Shaderwarnungen X4000/X3595 (bekannt). **Keine CSP-Verletzung.**
- **Leistung:** 60 fps in allen Fenstern.

## Geschmacksurteile (subjektiv, nicht automatisch Regel)

- Die Objektkarte ist das stärkste neue Element; das rote Gewerke-Icon auf zartem Rot verbindet Karte und Leitung gut.
- Der Hinweis «Liste scrollbar» im Tabellenkopf ist funktional, aber textlastig; der Ausblendverlauf allein plus «5 von 8» wäre ruhiger.
- Der knickende Linienansatz (horizontal 28 px, dann diagonal) wirkt technisch-präzise; mit sichtbarer Linie wäre er ein Markenzeichen.
- Der Leerzustand rechts (gestrichelt) ist bei 1920 etwas verloren unter der Geschosskarte – akzeptabel.

## Kandidaten für Lessons Learned

- DOM-Linien über einer hellen 3D-Szene brauchen einen Halo oder einen dunkleren Ton; eine 1-px-Linie in Grau-2 ist auf hellen Böden unsichtbar (gemessen 1.1:1).
- Scroll-Hinweise (Ausblendverlauf) nur bei tatsächlichem Überlauf setzen und bei Grössenänderung neu prüfen.

## Gesamturteil: **bereit für PO-Abnahme 2 mit Restauflagen**

Alle drei Massnahmen aus Runde 1 sind umgesetzt (Platte unter Tabelle bleibt szene-seitig offen). Tabellenweg in beide Richtungen, Objektkarte, Esc-Kette, Auge, Tastatur und 60 fps funktionieren. Restauflagen vor bzw. kurz nach der Abnahme: Einpassung/«Zum Ort» (szene), sichtbare Verbindungslinie (ui), Tabellen-/Abstand-Randfälle (ui). Kein Rückgang an den Entscheid nötig.
