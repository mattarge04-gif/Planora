# S3 3D-Performance: 20'000 Elemente, 10 Geschosse (R3F + three)

Stand 2026-11-08 · Test-Architekt (Welle 3) · Wegwerf-Messseite, kein Produktivcode.
Kennzeichnung: [F] gemessen/belegt · [A] Annahme · [?] offen.

## Ziel

Pruefen, ob BatchedMesh + Sprite-Pins das Budget aus 03 Kap. 7.3 halten: 60 fps median, p95-Frame ≤ 33 ms, Draw-Calls ≤ 100, ≤ 2 Mio. Dreiecke, erste Darstellung ≤ 3 s, Picking ≤ 16 ms.

## Vorgehen

- `app.jsx`: React 19.3.1 + @react-three/fiber 9.8.2 + three 0.187.0 (exakt gepinnt, lokal unter `s03-3d/node_modules`). Gebaeude 60 × 30 m, 10 Geschosse, 50 Raeume je Geschoss als zusammengefuehrte Geometrie. 10 Platzhalter-Geometrien (12–256 Dreiecke, Mittel ~85) statt GLB. Farbe pro Instanz (Ampel). Pins als ein `Points`-Objekt (instanzierte Sprites, 1 Draw-Call). Orthografische Kamera, dreht sich.
- Modi: `batched` (BatchedMesh, per-Objekt-Culling + Sortierung, Default von three), `batched-roh` (ohne Culling/Sortierung), `instanced` (ein InstancedMesh pro Katalogtyp = Fallback aus ADR 0008).
- `messen.mjs`: lokaler Chrome (playwright-core 1.65, `channel: chrome`), Viewport 1920 × 1080, dpr 1, headless. Zwei Profile: **GPU** (ANGLE/D3D11) und **Software** (SwiftShader = Rechner ohne GPU-Beschleunigung, z.B. virtuelle Desktops).
- Messgroessen: Frame-Abstaende im Render-Loop (6 s), **synchron gemessene Frame-Kosten** (render + `readPixels` 1 px, erzwingt GPU-Abschluss; aussagekraeftiger als headless-fps), erste Darstellung ab Navigationsbeginn, Draw-Calls, Dreiecke, Raycast-Picking an 50 Bildschirmpunkten.

```
cd spikes/s03-3d && npm ci
npx esbuild app.jsx --bundle --outfile=dist/app.js --minify --jsx=automatic --define:process.env.NODE_ENV=\"production\"
node messen.mjs
```

## Ergebnis [F, gemessen 2026-11-08]

Messrechner: Desktop mit NVIDIA GeForce RTX 3070 Ti (laut WebGL-Renderer-String). **Kein Laptop mit Iris-Xe-Klasse verfuegbar.**

| Profil | Modus | Elemente | Draw-Calls | Dreiecke | Frame-Kosten synchron median / p95 | fps im Loop median | Loop p95 | Erste Darstellung | Picking p95 |
|---|---|---|---|---|---|---|---|---|---|
| GPU | batched | 10'000 | 3 | 0,85 Mio. | 3,3 / 4,1 ms | 238 | 4,3 ms | 201 ms | 1,2 ms |
| GPU | batched | 20'000 | 3 | 1,69 Mio. | 6,2 / 7,5 ms | 233 | 4,8 ms | 157 ms | 2,3 ms |
| GPU | batched-roh | 20'000 | 3 | 1,69 Mio. | 2,0 / 2,6 ms | 238 | 4,3 ms | 163 ms | 2,5 ms |
| GPU | instanced | 20'000 | 12 | 1,69 Mio. | **1,3 / 2,2 ms** | 238 | 4,3 ms | 157 ms | 1,7 ms |
| Software | batched | 10'000 | 3 | 0,85 Mio. | 148 / 442 ms | 7 | 157 ms | 240 ms | 0,9 ms |
| Software | batched | 20'000 | 3 | 1,69 Mio. | 285 / 841 ms | 4 | 317 ms | 177 ms | 2,2 ms |
| Software | instanced | 20'000 | 12 | 1,69 Mio. | 267 / 1'074 ms | 4 | 533 ms | 171 ms | 1,5 ms |

Rohdaten: `ergebnis.json`, Bild: `screenshot_20000_batched.png`. Die fps im Loop sind headless nicht an die Bildschirmfrequenz gebunden; massgeblich sind die synchronen Frame-Kosten.

## Urteil gegen das Kriterium (03 Kap. 13.2, S3)

| Kriterium | GPU (RTX 3070 Ti) | Software (ohne GPU) | Iris-Xe-Laptop |
|---|---|---|---|
| 60 fps median (≤ 16,7 ms) | erfuellt (6,2 ms) | **nicht erfuellt** (4 fps) | nicht gemessen |
| p95-Frame ≤ 33 ms | erfuellt (7,5 ms) | **nicht erfuellt** | nicht gemessen |
| Draw-Calls ≤ 100, Dreiecke ≤ 2 Mio. | erfuellt (3–12; 1,69 Mio.) | erfuellt | – |
| Erste Darstellung ≤ 3 s | erfuellt (≤ 0,2 s, lokal, ohne Netz/GLB) | erfuellt | – |
| Picking ≤ 16 ms | erfuellt (≤ 2,5 ms) | erfuellt | – |

**Gesamturteil S3: nicht entschieden.** Auf einer dedizierten GPU mit grosser Reserve bestanden (Faktor 2–12 unter Budget), ohne GPU klar nicht bestanden. Das Zielgeraet (Iris Xe) ist nicht gemessen; eine Hochrechnung waere eine Annahme [A: Iris Xe etwa 5–10× langsamer als RTX 3070 Ti → batched 20'000 ≈ 30–60 ms, instanced ≈ 7–13 ms].

## Groesste Befunde

1. **BatchedMesh ist mit Default-Einstellungen 4,8× langsamer als InstancedMesh** (6,2 vs. 1,3 ms): Per-Objekt-Frustum-Culling und Sortierung von 20'000 Instanzen kosten CPU pro Frame. Ohne beides (`batched-roh`) 2,0 ms. ADR 0008 sollte **InstancedMesh pro Katalogtyp als Standard** nehmen (12–50 Draw-Calls sind weit unter Budget) oder BatchedMesh nur mit abgeschaltetem Culling/Sorting.
2. **Rechner ohne GPU-Beschleunigung sind unbrauchbar fuer 3D** (4–7 fps). Enterprise-Kunden arbeiten oft auf virtuellen Desktops (Citrix/AVD) ohne GPU [A]. Die Degradation (03 Kap. 7.3) muss frueh greifen und die 2D-/Tabellenansicht muss vollwertig sein. Erkennung: Renderer-String enthaelt "SwiftShader"/"llvmpipe"/"Microsoft Basic Render" → direkt 2D anbieten.
3. Picking per Raycast ist auch mit 20'000 Instanzen schnell genug (≤ 2,5 ms); GPU-ID-Picking ist nicht noetig.

## Grenzen

- Platzhalter-Geometrien statt echter GLB (keine Ladezeit, kein Meshopt-Decoding gemessen).
- Keine Postprocessing-AO, keine Schatten, keine LOD-Umschaltung, kein Pin-Clustering, keine HTML-Overlays.
- Headless-Chrome; ein echtes Fenster mit vsync und hoeherem dpr (1,25–1,5 auf Laptops) erzeugt mehr Pixelarbeit.
- **Naechster Schritt:** `messen.mjs` auf einem Iris-Xe-Laptop mit `headless: false` laufen lassen (ca. 10 min).
