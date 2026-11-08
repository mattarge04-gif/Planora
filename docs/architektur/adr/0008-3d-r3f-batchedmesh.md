# 0008 – 3D: Three.js/R3F mit BatchedMesh, Sprite-Pins und deterministischem Auto-Layout

Status: vorgeschlagen · 2026-11-08 · Bezug: E2, E8, FA-33..FA-36

## Kontext
E2: darstellerisch, Ton-Look, isometrisch, Geschosse explodierbar. E8: Three.js + R3F, GLB-Bibliothek 30–50 Bauteile. Versionen three 0.187.0, @react-three/fiber 9.8.2, drei 10.7.9, gltf-transform 4.5.1, meshoptimizer 1.3.0, alle MIT [F, Q50-Tech]. InstancedMesh/BatchedMesh [F, Q51-Tech]. Elemente aus Listen haben in der Regel **nur einen Raum, keine Koordinaten** (E4: nicht aus Plansymbolen).

## Entscheid
- Gebaeude: pro Geschoss **eine** zusammengefuehrte Geometrie aus extrudierten Raum-Rechtecken (Boden + niedrige Wandkanten), ein `MeshStandardMaterial` (weiss, rau), orthografische Kamera.
- Elemente: **BatchedMesh** mit allen Katalog-Geometrien und einem Material; Farbe pro Instanz = Ampel. Fallback `InstancedMesh` pro Katalogtyp, falls BatchedMesh im Spike S3 schlechter ist.
- **Position eines Elements ist darstellerisch**: Hat ein Element keine Koordinate, wird es per deterministischem Raster im Raum-Rechteck platziert (Reihenfolge nach Katalog-ID, dann Element-ID). Gleiche Daten → gleiches Bild. Manuell gesetzte Positionen haben Vorrang.
- Pins: instanzierte Sprites im WebGL, **keine** HTML-Overlays (nur der ausgewaehlte Pin als `<Html>`). Clustering hierarchisch (Geschoss → Raum → Katalogtyp) plus Bildschirmraum-Gruppierung je Zoomstufe.
- Picking ueber BVH (drei `<Bvh>`) oder GPU-ID-Buffer; Entscheid im Spike S3.
- GLB-Pipeline: Blender → glTF → `gltf-transform optimize --compress meshopt`; Budgets siehe 03 Kap. 7.
- Szene-Daten kommen aus einem eigenen Lese-Endpunkt (`szene`-Modul), kompakt, mit `datenstand`-Hash fuer Caching.
- Fallback: Tabellen-/2D-Ansicht ist immer vollstaendig nutzbar; 3D ist nie der einzige Weg zu einer Funktion.

## Alternativen
- Babylon.js 9.35 (Apache-2.0): gleichwertig, nicht React-nativ, kein Grund zum Wechsel [F, Q50-Tech].
- xeokit: AGPL-3.0 → ausgeschlossen [F, Q53-Tech].
- That Open Engine: IFC/BIM, fuer spaeteren Import (E9).
- Positionen aus Plansymbolen: E4/E10 schliessen Symbolerkennung aus.

## Konsequenzen
- + 1–50 Draw-Calls fuer Elemente unabhaengig von der Anzahl [A, 02 Kap. 5.2].
- − Element-Positionen sind nicht "echt"; UI muss das klar kennzeichnen ("Position schematisch").
- Spike S3 (20'000 Elemente, Laptop mit integrierter GPU).
