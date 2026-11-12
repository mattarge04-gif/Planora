# Design-Werkzeug (nur Entwicklung)

GPU-Screenshots, Funktions- und fps-Pruefung fuer den Designprozess (`.claude/skills/planora-design`). Nicht Teil des Produkts.

```bash
bash werkzeug/design/instanz.sh start            # baut app/web, startet Testinstanz auf Port 3100 (Wegwerfdaten)
node werkzeug/design/screenshot.mjs --szenario werkzeug/design/szenarien/twin.json --aus docs/design/kritiken/<datum>-<thema>-r1
bash werkzeug/design/instanz.sh stop             # immer am Ende
```

- **Echte GPU:** Chromium headless mit `--use-angle=d3d11 --ignore-gpu-blocklist`. Die Ausgabe nennt die Renderer-Kennung; bei SwiftShader/Software erscheint eine Warnung – solche Bilder sind kein Beleg ([docs/design/fehler.md](../../docs/design/fehler.md) F4).
- **Ergebnis:** PNGs `<name>-<breite>x<hoehe>.png` und `bericht.json` (Renderer, fps je Fenster, Konsolenfehler/-warnungen inkl. CSP).
- **Playwright:** wird im npx-Cache gesucht; sonst einmalig `npx -y playwright@1.65.0 install chromium` oder `PLAYWRIGHT_MODUL=<pfad zu playwright/index.mjs>` setzen.
- **Port 3000** (Server des PO) wird nie angefasst. Ports aenderbar ueber `PLANORA_DESIGN_PORT` / `PLANORA_DESIGN_PG_PORT`.
- Laufzeitdateien in `werkzeug/design/.lauf/` (ignoriert).

## Szenarien (`szenarien/*.json`)

`fenster`: Liste `[breite, hoehe]`; je Fenster neue Seite mit Login. `schritte` (Koordinaten relativ 0..1):

| Schritt | Wirkung |
|---|---|
| `{ "klick": "Text", "exakt": false }` | erstes Element mit dem Text anklicken |
| `{ "knopf": "Name" }` | Button nach zugaenglichem Namen |
| `{ "warte": ms }` | warten |
| `{ "bild": "name" }` | Screenshot |
| `{ "rad": [x, y, delta] }` | Mausrad (negativ = hineinzoomen) |
| `{ "ziehen": [x1, y1, x2, y2] }` | Ziehen (Kamera drehen) |
| `{ "maus": [x, y] }` / `{ "punkt": [x, y] }` | Hover / Klick an Position |
| `{ "taste": "Escape" }` | Taste |
| `{ "fps": ms }` | fps waehrend einer Kameradrehung messen |

Vorhanden: `entwurf.json` (bisheriger Prototyp), `twin.json` (Redesign-Seite, sobald vorhanden).
