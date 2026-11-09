# 0008 – 3D: Three.js/R3F mit BatchedMesh, Sprite-Pins und deterministischem Auto-Layout

> **Status ab Welle 4: angepasst (E34–E37, 2026-11-09).**
> [F] E33 gilt weiter: InstancedMesh, Leistungsstufen normal/schwach/2D (Titel nennt noch BatchedMesh, historisch).
> [A] Einstieg ueber Formular/Excel und Weltgenerator; Grundriss-Editor ist keine Voraussetzung mehr (ADR 0014 zurueckgestellt). Konva nur fuer den funktionalen 2D-Fallback separat beurteilen.
> Der folgende Text ist die bisherige Fassung und bleibt als Historie erhalten.

Status: vorgeschlagen, angepasst durch E33 · 2026-11-08 / 2026-11-09 · Bezug: E2, E8, FA-33..FA-36

## Kontext
E2: darstellerisch, Ton-Look, isometrisch, Geschosse explodierbar. E8: Three.js + R3F, GLB-Bibliothek 30–50 Bauteile. Versionen three 0.187.0, @react-three/fiber 9.8.2, drei 10.7.9, gltf-transform 4.5.1, meshoptimizer 1.3.0, alle MIT [F, Q50-Tech]. InstancedMesh/BatchedMesh [F, Q51-Tech]. Elemente aus Listen haben in der Regel **nur einen Raum, keine Koordinaten** (E4: nicht aus Plansymbolen).

## Entscheid
> **Angepasst durch E33 (2026-11-09)** nach Spike S3 und S3b: einfacher, sinngemaesser Look; InstancedMesh statt BatchedMesh; automatische Leistungsstufen. Welt-Regeln und Erzeugung: ADR 0026.

- **Look (fest, Regelwerk ADR 0026):** isometrische orthografische Kamera, Glas-Geschossplatten, Raum-/Einheit-Grenzen als Linien, Fassade als leichter Glaskasten mit Kanten, Beschriftung je Geschoss (Name, Anzahl Elemente, Ampel-Zaehler), graue Umgebung optional. Keine Echtzeit-Schatten, kein Postprocessing; weicher Schatten unter dem Gebaeude als Bild.
- **Gebaeude:** pro Geschoss **eine** zusammengefuehrte Geometrie; alle Geschoss-Platten in einer transparenten Geometrie, alle Grenzlinien in einer `LineSegments`.
- **Bauteile:** Das Bauteilmodell bleibt. **Uebersicht** (ganzes Gebaeude): Elemente als Pins (instanzierte Sprites, 1 Draw-Call, Symbol je Gewerk, Farbe = Ampel), Clustering Geschoss → Einheit → Katalogtyp. **Detail** (Geschoss oder Einheit gewaehlt): Bauteil-Modelle aus der GLB-Bibliothek (Ton-Look, 30–50 Typen) als **`InstancedMesh` pro Katalogtyp** (S3: 4,8× schneller als BatchedMesh mit Defaults).
- **Position eines Elements ist darstellerisch:** deterministisches Raster in der Einheit (Reihenfolge Katalog-ID, Element-ID); manuell gesetzte Positionen haben Vorrang.
- **Zeichnen nur bei Aenderung** (`frameloop="demand"`): im Ruhezustand keine GPU-/CPU-Last.
- **Leistungsstufen automatisch** (S3b):

| Stufe | Erkennung | Einstellungen |
|---|---|---|
| normal | echte GPU | Glaettung an, dpr ≤ 1,5, Glas, Umgebung, Bauteil-Modelle im Detail |
| schwach | Renderer "SwiftShader"/"llvmpipe"/"Basic Render" oder < 30 fps in den ersten 2 s | Glaettung aus, dpr 0,75, kein Glas, keine Umgebung, im Detail nur Pins |
| 2D | < 15 fps in "schwach", kein WebGL2, oder Benutzerwahl | 2D-Ansicht (react-konva) + Tabellen, alle Funktionen |

  Gewaehlte Stufe pro Benutzer merken; jederzeit manuell umschaltbar.
- Picking per Raycast (S3: ≤ 2,5 ms bei 20'000 Instanzen; S3b: ≤ 0,3 ms fuer Pins); kein GPU-ID-Buffer.
- GLB-Pipeline: Blender → glTF → `gltf-transform optimize --compress meshopt`; Budgets siehe 03 Kap. 7.
- Szene-Daten aus dem `szene`-Modul, erzeugt durch den Weltgenerator (ADR 0026), mit `datenstand`-Hash fuer Caching.
- Fallback: Tabellen-/2D-Ansicht ist immer vollstaendig nutzbar; 3D ist nie der einzige Weg zu einer Funktion.

## Alternativen
- Babylon.js 9.35 (Apache-2.0): gleichwertig, nicht React-nativ, kein Grund zum Wechsel [F, Q50-Tech].
- xeokit: AGPL-3.0 → ausgeschlossen [F, Q53-Tech].
- That Open Engine: IFC/BIM, fuer spaeteren Import (E9).
- Positionen aus Plansymbolen: E4/E10 schliessen Symbolerkennung aus.

## Konsequenzen
- + 1–50 Draw-Calls fuer Elemente unabhaengig von der Anzahl [A, 02 Kap. 5.2].
- − Element-Positionen sind nicht "echt"; UI muss das klar kennzeichnen ("Position schematisch").
- + Gemessen ohne GPU (S3b, Full HD): ≈ 19 fps mit allen Effekten, ≈ 55 fps in Stufe "schwach".
- Offen: Messung auf echtem Kunden-Laptop (Iris-Xe-Klasse) und auf einem Kunden-VDI.
