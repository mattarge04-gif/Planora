# Teilaufgabe 8 – Feinschliff und Abschluss

12.11.2026 · Fortsetzung nach Claude-Nutzungslimit · Branch `m2b2-redesign`.

## Auftrag und Umsetzung [F]

Der PO hat im letzten Claude-Verlauf das Entfernen der alten Ansichten freigegeben. Claudes letzter Arbeitsstand wartete auf die beiden Umsetzungsergebnisse; diese lagen bei der Übernahme bereits als uncommittete Änderungen vor.

- Zoom per Tastatur und Mausrad verankert die Mitte der freien Fläche; eine gewählte Anlage bleibt innerhalb der Kartenränder. Eigene mathematische Regressionstests in `szene3/zoom.test.ts`.
- Der Tabellenbeschnitt umfasst Gebäude, Anlagen, Leitungen und Ortsmarke, auch nachgeladenes GLB. Kulisse und Bodenschatten verschwinden bei Nahzoom mit Hysterese.
- Die Anlagentabelle hat einen Tab-Stopp; Pfeile, Pos1/Ende bewegen den Fokus, Enter/Leertaste wählen. T meldet im Technikmodus sichtbar und über `aria-live`, dass dieser bereits aktiv ist.
- Digital Twin lädt dynamisch; Three, Drei und Postprocessing werden in eigene Chunks aufgeteilt.
- Altansichten `Ansicht`/`Entwurf`, alte Szene und ausschliesslich alte Karten entfernt; Profilmenü bereinigt. Der Einstieg aus der Gebäudeliste führt direkt zum Digital Twin. Gemeinsam genutzte `szene2/huelle.ts`, `szene2/leitungen.ts` und `panel/daten.ts` bleiben samt Tests erhalten.
- Aktuelle Dashboard-/Schnitt-/Rundgang-Szenarien auf direkten Einstieg umgestellt; neuer Zoom-/Tastaturdurchgang `werkzeug/design/szenarien/twin-feinschliff.json`.

## Technische Prüfung [F]

- Übernommener Stand vor dem Abbau: 186/186 Webtests.
- Nach dem Abbau: 172/172 Webtests in 17 Dateien; 14 Tests gehörten ausschliesslich zur entfernten alten Szene und Lichtstimmung.
- `npm.cmd run build` inklusive TypeScript-Prüfung erfolgreich. Einstiegschunk ca. 228 kB, grösster JS-Chunk ca. 385 kB vor gzip; die Gesamtmenge der 3D-Bibliotheken wird durch Aufteilung nicht kleiner.
- Backend und Docker nicht erneut geprüft, da keine Backend-/Docker-Änderungen vorgenommen wurden.
- GPU-Prüfung: [48 Bilder und Protokolle](../../abnahme/2026-11-12-feinschliff/README.md), RTX 3070 Ti / D3D11, drei Fenstergrössen, jeweils 60 fps bei Drehung. Keine CSP-Verletzung und kein Seitenfehler; bekannte Clock-/Shaderwarnungen dokumentiert.
- Browser-Funktionsprüfung bei 1280 × 720: genau ein Tabellen-Tab-Stopp, Pos1/Ende/Pfeiltasten und Enter erfolgreich, T-Rückmeldung sichtbar und als `aria-live`-Text gesetzt, Profilmenü ohne Altansichten. Keine echte Screenreader-Ausgabe geprüft.
- Unabhängige [Bildkritik](../../design/kritiken/2026-11-12-feinschliff-r1.md): bereit für PO-Sichtung, keine zwingende neue Korrektur. Keine PO-Endabnahme behauptet.

## Lizenzhinweise [F]

`app/web/public/lizenzen.txt` enthält die unveränderten Lizenz-/NOTICE-Dateien von 66 installierten Produktionspaketen, ausgehend vom aktuellen Web-Lockfile. Die Datei wird durch Vite mit ausgeliefert und ist unter `/lizenzen.txt` erreichbar. Darunter sind Inter, Lucide, Drei, Three, Postprocessing und N8AO.

Fünf installierte Pakete enthalten keine eigene Lizenzdatei: `@mediapipe/tasks-vision@0.10.17`, `@react-three/fiber@9.8.2`, `draco3d@1.5.9`, `maath@0.10.8`, `stats-gl@2.4.2`. Diese sind im Text ausdrücklich gelistet und für das Release-Dossier nachzuführen. Das vorhandene Dossierwerkzeug übernimmt das Web-Lockfile bereits über `--lockfile-web`; dessen aktuelle Nutzung ersetzt keine vollständige Image-SBOM und keine menschliche Lieferfreigabe. Das historische Dossier vom 11.11. wurde nicht als neu geprüft ausgegeben.

## Grenzen und nächster Schritt

Kein Merge, Push oder Deployment. PO-Server 3000/54500 blieb unberührt; die separate GPU-Instanz 3100/54600 ist nach der Prüfung wieder gestoppt. Aktuelle Bilder liegen für die PO-Sichtung vor. Bestehende offene Betriebs-/Lizenzabnahmen gelten weiter.
