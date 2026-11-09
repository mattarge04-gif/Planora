# S3b 3D "einfacher Look" ohne Grafikkarte (schlechtester Fall)

Stand 2026-11-09 · Wegwerf-Messseite, kein Produktivcode. Kennzeichnung: [F] gemessen · [A] Annahme.

## Ziel
Pruefen, ob der vereinfachte Look der Referenzbilder (isometrisch, Glas-Geschosse, Raeume als Linien, Elemente als **Pins statt 3D-Modelle**, Geschoss-Beschriftungen, graue Umgebungsbloecke) auch auf Rechnern **ohne GPU-Beschleunigung** bedienbar ist. Das ist der Fall, an dem S3 gescheitert ist (4–7 fps mit 10'000–20'000 Bauteil-Modellen).

## Vorgehen
- `app.jsx`: React 19 + R3F 9.8.2 + three 0.187.0 (gleiche Versionen wie S3). 10 Geschosse, 50 Raeume/Geschoss, N Pins (1 Draw-Call), 10 Text-Sprites, 40 Umgebungsbloecke (1 Geometrie). `frameloop="demand"`: gezeichnet wird nur bei Aenderung.
- `messen.mjs`: Playwright-Chromium mit **SwiftShader** (reines Software-Rendering, entspricht Citrix/AVD ohne GPU). Gemessen: synchrone Frame-Kosten (render + readPixels), Picking.
- Stellschrauben per URL: `dpr`, `aa` (Kantenglaettung), `glas` (transparente Fassade).

```
npm ci
npx esbuild app.jsx --bundle --outfile=dist/app.js --minify --jsx=automatic --define:process.env.NODE_ENV=\"production\"
PW_PFAD=$(npm root -g)/playwright node messen.mjs
```

## Ergebnis [F, gemessen 2026-11-09, Cloud-Container ohne GPU]

| Pins | Viewport | dpr | Glaettung | Glas | Draw-Calls | Frame median / p95 | fps | Picking p95 |
|---|---|---|---|---|---|---|---|---|
| 500 | 1920×1080 | 1 | an | an | 17 | 47 / 57 ms | ≈ 21 | 0.1 ms |
| 2'000 | 1920×1080 | 1 | an | an | 17 | 52 / 67 ms | ≈ 19 | 0.1 ms |
| 10'000 | 1920×1080 | 1 | an | an | 17 | 73 / 78 ms | ≈ 14 | 0.3 ms |
| 2'000 | 1920×1080 | 1.5 | an | an | 17 | 110 / 128 ms | ≈ 9 | 0.1 ms |
| 2'000 | 1366×768 | 1 | an | an | 17 | 35 / 46 ms | ≈ 29 | 0.2 ms |
| 2'000 | 1920×1080 | 1 | aus | an | 17 | 31 / 40 ms | ≈ 32 | 0.2 ms |
| 2'000 | 1920×1080 | 1 | aus | aus | 16 | 31 / 40 ms | ≈ 33 | 0.2 ms |
| 2'000 | 1920×1080 | 0.75 | aus | aus | 16 | 18 / 27 ms | ≈ 55 | 0.1 ms |

Szene: 634 Dreiecke + Linien + Pins, 16–17 Draw-Calls. Erste Darstellung lokal ≤ 0,4 s.

## Befunde
1. **Die Geometrie kostet fast nichts.** Die Zeit geht in die Pixel (Bildschirmgroesse, dpr, Kantenglaettung, Transparenz). Mehr Pins (500 → 10'000) kosten nur +50 %.
2. **Ohne GPU, Full HD, mit allen Effekten: ≈ 19 fps** (S3 mit Bauteil-Modellen: 4–7 fps). **Mit Stufe "schwach"** (Glaettung aus, dpr 0,75): **≈ 55 fps** median. Damit ist das 3D sogar auf virtuellen Desktops ohne GPU bedienbar.
3. **dpr 1,5** (typische Laptop-Skalierung) verdoppelt die Kosten → dpr auf schwachen Geraeten begrenzen.
4. Durch `frameloop="demand"` braucht die Szene im Ruhezustand **0 % GPU/CPU**; gerechnet wird nur waehrend Drehen/Zoomen.
5. Auf jedem Laptop mit integrierter GPU (Iris Xe o.ae.) ist dieser Look um ein Vielfaches schneller als SwiftShader [A: Messung auf echtem Kundengeraet bleibt Pflicht].

## Empfehlung Leistungsstufen (automatisch)
| Stufe | Erkennung | Einstellungen |
|---|---|---|
| normal | echte GPU | Glaettung an, dpr ≤ 1,5, Glas, Umgebung, weicher Schatten als Bild |
| schwach | Renderer "SwiftShader"/"llvmpipe"/"Basic Render" **oder** < 30 fps in den ersten 2 s | Glaettung aus, dpr 0,75, kein Glas, keine Umgebung |
| 2D | < 15 fps in Stufe "schwach", kein WebGL2, oder Benutzerwahl | 2D-Grundriss (Konva) + Tabellen, alle Funktionen |

## Grenzen
- Keine Icons in Pins, kein Clustering, keine HTML-Overlays gemessen; Headless ohne vsync.
- Nur Software-Rendering gemessen, kein echter Laptop.
