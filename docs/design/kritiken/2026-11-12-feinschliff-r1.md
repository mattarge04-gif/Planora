# Feinschliff Teilaufgabe 8 – Kritik Runde 1

12.11.2026 · unabhängige Bildprüfung des aktuellen uncommitteten Stands auf `m2b2-redesign`.

**Prüfumfang:** Zehn vorhandene GPU-Aufnahmen selbst angesehen, keine eigene Browserfahrt. Die Bilder und Messprotokolle stammen vom Hauptagenten unter `docs/abnahme/2026-11-12-feinschliff/`. Deshalb ist dies eine unabhängige Bildkritik, keine unabhängig wiederholte Funktions- oder Leistungsmessung. Fenster: 1280×720, 1440×900, 1920×1080. Laut beiden `bericht.json`: RTX 3070 Ti, ANGLE / D3D11. Kein Software-Renderer.

## Restauflagen aus Interaktionen R1

| Auflage | Ergebnis und Beleg |
|---|---|
| Auswahl wandert beim Zoom unter die Kopfzeile | **Im Bild behoben.** In `zoom/auswahl-1280x720.png`, `tastaturzoom-1280x720.png` und `mausradzoom-1280x720.png` bleibt der Verbindungspunkt des Verteilers ungefähr bei (652, 296), während das Modell sichtbar grösser wird. Auch `tastaturzoom-1440x900.png` und `mausradzoom-1920x1080.png` zeigen die Auswahl frei zwischen den Panels. |
| Rohre und Platte laufen unter der Tabelle durch | **In den betrachteten Nahaufnahmen behoben.** Rohre und Platte enden an der Tabellenoberkante; im Tabellenkörper keine durchlaufende Geometrie sichtbar. Belege: `zoom/mausradzoom-1280x720.png`, `zoom/tastaturzoom-1440x900.png`, `zoom/mausradzoom-1920x1080.png`. |
| Graue Baumkugel vor ausgewählter Anlage | **Im Bild behoben.** Alle betrachteten Auswahl-/Nahaufnahmen ohne Bäume; Übersicht und Technikübersicht behalten die Kulisse. Die genaue Schwelle/Hysterese ist aus Standbildern nicht belegbar. |
| T ohne sichtbare Rückmeldung | **Sichtbar behoben.** `zoom/technik-rueckmeldung-1280x720.png`: gut lesbarer Hinweis «Bereits im Technikmodus, EG». Screenreader-Ansage und erneute Auslösung hier nicht selbst geprüft. |
| Tabellenfokus / ein Tab-Stopp | **Fokusring belegt**, `zoom/tabellenfokus-1440x900.png`, Zeile «Speicher». Die Anzahl der Tab-Stopps und Pfeil-/Pos1-/Ende-Funktion sind aus diesem Bild nicht beurteilbar. |
| Alte Ansichten im Profilmenü | **Im Bild entfernt.** `dashboard/profilmenue-1280x720.png` enthält nur reduzierte Darstellung und Abmelden. Direkter Einstieg ist in den vorhandenen Szenarien enthalten, hier nicht selbst ausgeführt. |

Alle oben genannten Bildpfade relativ zu `docs/abnahme/2026-11-12-feinschliff/`.

## Noten 1–5 (Bildurteil)

| Kriterium | Note | Beleg / Einordnung |
|---|---:|---|
| Gestaltungsqualität | 4 | Ruhige helle Panels und klare Hierarchie, `dashboard/uebersicht-1440x900.png`. |
| Originalität | 3 | Eigenständiges Architekturmodell; gegenüber Vorrunde keine neue Stilrichtung. Subjektiv. |
| Räumliche Wirkung | 4 | Gerätebögen, Plattenstärke und weicher Bodenkontakt in `zoom/tastaturzoom-1440x900.png`. |
| Komposition | 4 | Gewählte Anlage bleibt frei; Übersicht und Separieren ordnen sich zwischen Karten ein, `dashboard/separiert-1920x1080.png`. |
| Geometrie | 4 | Verteileranschlüsse und Geschossschnitt glaubwürdig; keine auffälligen Lücken in den betrachteten Ausschnitten. |
| Licht | 4 | Weiche Geräteschatten und heller Schnitt; Schattenkörnung nicht auffällig. |
| Materialien | 4 | Matte Umgebung, sattes Heizungsrot, dezente Gerätedetails in den Zoomaufnahmen. |
| Typografie | 4 | Kleine, klare Schrift; T-Rückmeldung bleibt auch bei 1280 gut lesbar. |
| Abstände | 4 | Objektkarte endet bei 1280 vor der Tabelle; konsistente Kartenabstände. |
| Referenz-Qualitätsrichtung | 4 | Atelier-/Technikrichtung bleibt erhalten; kein erneuter Richtungsentscheid nötig. |
| Bedienbarkeit | 4 | Sichtbare Tabellenfokussierung und verständliche T-Rückmeldung. Nur Bildzustände bewertet. |
| Funktion | – | Keine eigene Interaktionsprüfung; nicht aus Standbildern ableitbar. |
| Leistung | – | Keine eigene Messung; übergebene Protokolle melden 60 fps. |

## Top-Massnahmen

Keine neue zwingende Produktkorrektur aus den betrachteten Bildern. Vor einer Aussage «vollständig unabhängig funktional abgenommen» müssten ein Tabellen-Tab-Stopp, Pfeilnavigation, wiederholtes T inklusive `aria-live` und die Zoomgrenzen separat im Browser ausgeführt bzw. gemessen werden. Ein normaler Screenshot des Fokusrings reicht dafür nicht.

## Funktion und Leistung laut übergebenem Protokoll

Beide Szenarien melden 60 fps je Fenstergrösse. Keine `pageerror`- oder CSP-Meldung enthalten. Vor Login jeweils 401; `THREE.Clock`-Deprecation und im 1440-Durchgang bekannte D3D-Shaderwarnungen X4000/X3595. Diese Angaben wurden gelesen, nicht unabhängig reproduziert. GPU-Drehung, reduzierte Bewegung, UG und Hysterese wurden in dieser Bildprüfung nicht selbst getestet.

## Geschmacksurteile und Lessons Learned

Die Rohre hinter den halbtransparenten seitlichen Panels sind in Nahsicht präsent, beeinträchtigen in den betrachteten Bildern aber keine Beschriftung wesentlich. Kein neuer Befund und keine neue Geschmacksregel. Das gezielte Vergleichspaar vor/nach Zoom ist als Nachweis erheblich aussagekräftiger als eine einzelne Nahaufnahme.

## Gesamturteil: **bereit für PO-Sichtung (Bildprüfung)**

Die drei visuellen Hauptbefunde aus Interaktionen R1 sind in den betrachteten Bildern behoben. Kein Rückweg an den Entscheid, keine neue zwingende visuelle Korrektur. Die Aussage umfasst die Bildzustände; sie ersetzt keine eigene Funktionsabnahme und keine Lieferfreigabe.
