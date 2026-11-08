# Lindenhof - fiktives TGA-Testprojekt

Zwei zusammengehörige Geschosse eines frei erfundenen Bürogebäudes.
Alle Produkte, Hersteller, technischen Werte und Raumansätze sind synthetisch.
Es handelt sich um ein bewusst vereinfachtes Testmodell, nicht um ein genehmigungsfähiges Gebäude.

## Dateien
- 01_Grundriss_EG.pdf und 01_Grundriss_OG.pdf: A3 quer, 1:100 bei 100 % Druck.
- 02_Datenblatt_*.pdf: neun A4-Datenblätter, je ein Bauteiltyp.
- Gesamtunterlagen.pdf: zwei Pläne plus neun Datenblätter, 11 Seiten.
- raeume.csv: 18 Räume inklusive Korridore; UTF-8 mit BOM, Semikolon.
- bauteile.csv: 113 Bauteilinstanzen mit stabiler Typ-ID, Raum-ID und Position.
- projekt.json: dieselben Daten plus Typinformationen; keine externen Abhängigkeiten.
- pruefwerte.json: erwartete Summen für Import- und Zuordnungstests.

## Geometrie und Zuordnung
Jedes Geschoss misst nominal 24 x 16 m, also 384 m². Summe: 768 m².
Flächen beruhen auf Achsmassen und sind keine Nettoraumflächen nach einer Norm.
Koordinaten in Metern, Ursprung je Geschoss Südwest, x nach Ost, y nach Nord.
Die Treppe liegt übereinander; ihre Zeichnung ist schematisch und kein Treppennachweis.
Alle Symbole sind schematisch; Positionen beziehen sich auf die Symbolmitte.
WP-01 liegt ausserhalb des Grundrissrahmens (8 / 18 m); auf beiden Plänen als Verweis erwähnt.
Die neun Typ-IDs sind keine individuellen Seriennummern. asset_id bezeichnet einzelne Instanzen.

## Bekannte Vereinfachungen
Keine Leitungen, Schächte, Verteiler, Sanitärinstallation, Brandschutzbauteile oder Notbeleuchtung.
Keine vollständige Heizungs-/Lüftungsanlage: Speicher, Armaturen, Abtau-/Frostschutz usw. fehlen.
Luftmengen sind Testwerte; Überströmwege zwischen Räumen sind nicht konstruiert.
Zuluftregler sind nur in Räumen mit Zuluft vorhanden. Abluftregler werden nicht modelliert.
Heizlast, Lichtverteilung, Schall, Druckverluste und Normerfüllung sind nicht nachgewiesen.
Es gibt keine DWG-, IFC-, LDT- oder IES-Dateien. PDF-Geometrie ist vektorbasiert, Text auswählbar.

## Prüfsummen und Testideen
- 18 Räume, 9 Bauteiltypen und 113 Instanzen korrekt einlesen.
- Luftbilanz EG: 600 m³/h Zuluft und 600 m³/h Abluft.
- Luftbilanz OG: 900 m³/h Zuluft und 900 m³/h Abluft.
- Gesamt 1500 / 1500 m³/h = Nennluftmenge MB-01.
- Leuchten-Anschlussleistung bei voller Leistung: 2032 W.
- Heizkörper-Summenleistung am Testpunkt 55/45/20 °C: 11800 W.
- Heizkörper plus Monoblock-Nacherwärmer: 16800 W; keine Gebäudeheizlast.
- Jede asset.type_id muss auf ein Datenblatt verweisen.
- Jede asset.room_id muss vorhanden sein, ausser explizit AUSSEN-NORD.
- PDF-Extraktion, Raumzuordnung und Stücklisten gegen JSON/CSV vergleichen.

## Herkunft
Alle gelieferten Pläne, Zeichnungen und Produktdaten wurden für dieses Testprojekt neu erstellt.
Es wurden keine fremden Grundrisse, Produktlogos oder Herstellerdatenblätter übernommen.
Nur als Orientierung für typische Datenblatt-Felder wurden folgende Herstellerseiten konsultiert:
https://www.trox.de/produkte/raumlufttechnische-geraete-6f2180889e962ba7
https://www.zumtobel.de/de-de/anwendungen/buero
Keiner dieser Hersteller ist Urheber oder Anbieter der fiktiven Testprodukte.
