# Redesign Schritt 1: Szene-Look Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Neue Seite "Digital Twin" mit einer 3D-Szene im Stil eines hellen Architektur-Dioramas (Referenz 01-dashboard.png / 02-gebaeude.png): detaillierte Huelle, Kulisse, weiches Licht, Schatten, AO, eingepasste Kamera – bis zur PO-Abnahme 1.

**Architecture:** Reine, getestete Funktionen in `app/web/src/szene3/` (Fensterrahmen, Kulisse, Kamera-Einpassen) ergaenzen die bestehende Huellen-Ableitung `szene2/huelle.ts`. Die Darstellung nutzt `@react-three/drei` (Environment mit Lightformern, AccumulativeShadows, RoundedBox) und N8AO ueber `@react-three/postprocessing`. Die Seite `seiten/Twin.tsx` laeuft vollflaechig ohne die alte Kopfzeile; das Dashboard-UI folgt in Schritt 3.

**Tech Stack:** React 19.3, @react-three/fiber 9.8.2, three 0.187.0, neu: @react-three/drei 10.7.9, @react-three/postprocessing 3.2.2, postprocessing 6.39.6, n8ao 2.0.1, @fontsource-variable/inter 5.3.0, lucide-react 1.72.0; Vite 8, vitest 5 (Umgebung node).

**Spec:** `docs/superpowers/specs/2026-11-12-redesign-digital-twin-design.md` (Abschnitte 2, 4, 5 Schritt 1, 6)

## Global Constraints

- Branch `m2b2-redesign`; nicht pushen; `.superpowers/` nie committen.
- Paketversionen exakt (`--save-exact`): `@react-three/drei@10.7.9`, `@react-three/postprocessing@3.2.2`, `postprocessing@6.39.6`, `n8ao@2.0.1`, `@fontsource-variable/inter@5.3.0`, `lucide-react@1.72.0`. Keine weiteren Pakete.
- CSP `default-src 'self'` (siehe `app/src/web.ts` `WEB_CSP`): keine externen Ladevorgaenge. Verboten: drei `Environment` mit `preset` oder `files` von fremden URLs, `useGLTF` mit Draco-CDN, drei `Text` ohne lokale Schriftdatei, Google Fonts. Erlaubt: `Environment` mit `Lightformer`-Kindern, lokale Dateien aus dem Bundle.
- Farben: Weiss mit Grautoenen, nur ganz leichte Blauakzente (Eisblau) fuer Glas; keine dunklen Flaechen; keine schwarzen Umrandungen. Rot ist der Heizung (KOO) vorbehalten (`szene2/farben.ts`).
- UI-Texte mit echten Umlauten (ä, ö, ü), kein Eszett. Code-Bezeichner ohne Umlaute wie im bestehenden Code.
- Alle Ableitungen deterministisch (kein `Math.random`).
- Bestehende Seiten `Ansicht` und `Entwurf` bleiben unveraendert erreichbar.
- Tests: `app/web/src/**/*.test.ts`, vitest-Umgebung `node`, nur reine Funktionen.
- Befehle in `app/web`: `npm test`, `npm run pruefe:typen`, `npm run build`.
- Commit-Nachrichten Deutsch, Muster `Redesign: ...`, mit Zeile `Co-Authored-By: <das Modell, das den Code geschrieben hat> <noreply@anthropic.com>`.
- Browserpruefung immer mit echter GPU (siehe "Screenshot-Werkzeug" unten), nicht SwiftShader.

## Gestaltungs-Skills (PO-Vorgabe: Subagents nutzen echte UI-/Design-Skills)

Implementer von Task 3 und Task 4 laden vor dem Gestalten per Skill-Tool und folgen deren Vorgaben, soweit sie mit Spec und Global Constraints vereinbar sind (Spec gewinnt bei Widerspruch):

- `impeccable` – Gestaltungsqualitaet, Kritik/Audit und Feinschliff (Hierarchie, Farbe, Licht, "ambitious visual effects"). In Task 4 zuerst als Kritik des aktuellen Screenshots gegen die Referenzen anwenden.
- `reference-look-calibration` – Methode, den Look messbar gegen Referenzbilder abzugleichen (Helligkeit, Saettigung, Farbton, Weissanteil). Die Blender-spezifischen Teile entfallen; die Mess- und Vergleichsmethode auf Browser-Screenshots anwenden (z. B. Mittelwerte/Histogramme der Bildflaechen mit einem kleinen Node- oder Python-Skript im Scratchpad).
- `soft-skill` (high-end-visual-design) – Massstab fuer "teuer wirkende" Weissflaechen, Schatten und Tiefe; nur die auf eine 3D-Szene uebertragbaren Prinzipien.

In jedem Report angeben, welche Skills geladen wurden und welche ihrer Vorgaben konkret umgesetzt bzw. bewusst verworfen wurden.

## Screenshot-Werkzeug (fuer Task 3 und 4)

Eigene Entwicklungsinstanz, damit der laufende Server des PO (Port 3000) unberuehrt bleibt:

```bash
cd app/web && npm run build
cd .. && PLANORA_PORT=3100 PLANORA_PG_PORT=54600 npx tsx entwicklung/start.ts > "$SP/twin-server.log" 2>&1 &
# warten bis "Login:" im Log steht; Passwort aus der Zeile "Login: admin@planora.invalid / <pw>"
```

`$SP` = `C:/Users/matta/AppData/Local/Temp/claude/bcf0c113125feb8e/81e03ff2-c2b6-4f47-a5ee-2cda7dee08ed/scratchpad`. Playwright-Import (bereits im npx-Cache vorhanden):

`$SP/twin-shot.mjs`:

```js
import { chromium } from "file:///C:/Users/matta/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs";
// Aufruf: node twin-shot.mjs <passwort> <ausgabe.png> [warteMs]
const [pw, aus, warte = "6000"] = process.argv.slice(2);
const b = await chromium.launch({ headless: true, args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const log = [];
p.on("console", (m) => { if (["error", "warning"].includes(m.type())) log.push(`${m.type()}: ${m.text()}`); });
p.on("pageerror", (e) => log.push(`pageerror: ${e.message}`));
await p.goto("http://localhost:3100");
await p.fill("input[type=email]", "admin@planora.invalid");
await p.fill("input[type=password]", pw);
await p.click("button[type=submit]");
await p.getByText("Beispielgebaeude").first().click();
await p.getByRole("button", { name: "Digital Twin" }).click();
await p.waitForTimeout(Number(warte));
await p.screenshot({ path: aus });
console.log(JSON.stringify(log, null, 1));
await b.close();
```

Die Instanz am Ende beenden (Prozess auf Port 3100 und das zugehoerige `postgres.exe` mit `-p 54600`). Die Renderer-Kennung muss "NVIDIA ... D3D11" sein, nicht SwiftShader.

## Dateistruktur

| Datei | Neu/Aendern | Verantwortung |
|---|---|---|
| `app/web/package.json`, `package-lock.json` | aendern | neue Pakete exakt |
| `app/web/src/main.tsx` | aendern | Inter einbinden |
| `app/web/src/szene3/rahmen.ts` | neu | Fensterrahmen als achsparallele Quader |
| `app/web/src/szene3/kulisse.ts` | neu | Grundplatte, Wege, Baeume, Parkfelder aus dem Bereich |
| `app/web/src/szene3/kamera.ts` | neu | isometrische Orthokamera einpassen (freie Flaeche, Fuellgrad) |
| `app/web/src/szene3/palette.ts` | neu | Material-Farbwerte der Szene |
| `app/web/src/szene3/Szene3.tsx` | neu | Canvas, Licht, Schatten, AO, Kamera |
| `app/web/src/szene3/Gebaeude3.tsx` | neu | Huelle mit Platten, Waenden, Glas, Rahmen, Attika, Aufbau |
| `app/web/src/szene3/Kulisse3.tsx` | neu | Darstellung der Kulisse |
| `app/web/src/seiten/Twin.tsx` | neu | Seite: Daten laden, vollflaechige Szene, Zurueck-Knopf |
| `app/web/src/App.tsx` | aendern | Zustand `twin`, Knopf "Digital Twin" in der Ansicht |
| `app/web/src/stil.css` | aendern | Stile fuer `.twin` |
| Tests `*.test.ts` neben `rahmen`, `kulisse`, `kamera` | neu | |

---

### Task 1: Abhaengigkeiten und Schrift

**Files:**
- Modify: `app/web/package.json`, `app/web/package-lock.json`
- Modify: `app/web/src/main.tsx`
- Modify: `app/web/src/stil.css` (nur `font-family` in `:root`)

**Interfaces:**
- Produces: installierte Pakete (Versionen siehe Global Constraints); Schrift "Inter Variable" global verfuegbar.

- [ ] **Step 1: Pakete exakt installieren**

```bash
cd app/web
npm install --save-exact @react-three/drei@10.7.9 @react-three/postprocessing@3.2.2 postprocessing@6.39.6 n8ao@2.0.1 @fontsource-variable/inter@5.3.0 lucide-react@1.72.0
```

Expected: keine Peer-Dependency-Fehler (three 0.187.0 liegt in `postprocessing` `>=0.168 <0.188`). Bei ERESOLVE-Fehler stoppen und melden, nicht `--force`/`--legacy-peer-deps` verwenden.

- [ ] **Step 2: Schrift einbinden**

`app/web/src/main.tsx` – als erste Importzeile ergaenzen:

```ts
import "@fontsource-variable/inter";
```

In `app/web/src/stil.css` in der `:root`-Regel `font-family: system-ui, -apple-system, "Segoe UI", sans-serif;` ersetzen durch:

```css
font-family: "Inter Variable", system-ui, -apple-system, "Segoe UI", sans-serif;
```

- [ ] **Step 3: Pruefen**

Run: `cd app/web && npm test && npm run build`
Expected: Tests gruen; Build erzeugt `dist/assets/inter-*.woff2` (Schrift lokal im Bundle). Pruefen: `ls dist/assets | grep -i woff2` zeigt mindestens eine Datei.

Run: `cd app && npx vitest run test/dossier.test.ts`
Expected: PASS (Dossier liest das Web-Lockfile; neue Pakete erscheinen dort automatisch unter `npmWeb`).

- [ ] **Step 4: Commit**

```bash
git add app/web/package.json app/web/package-lock.json app/web/src/main.tsx app/web/src/stil.css
git commit -m "Redesign: drei, Postprocessing, N8AO, Inter und lucide als Abhaengigkeiten

Co-Authored-By: <Modell> <noreply@anthropic.com>"
```

---

### Task 2: Reine Ableitungen – Rahmen, Kulisse, Kamera

**Files:**
- Create: `app/web/src/szene3/rahmen.ts`, `app/web/src/szene3/kulisse.ts`, `app/web/src/szene3/kamera.ts`
- Test: `app/web/src/szene3/rahmen.test.ts`, `kulisse.test.ts`, `kamera.test.ts`

**Interfaces:**
- Consumes: `Fenster`, `Quader`, `Bereich`, `V3` aus `../szene2/huelle` (bestehend: `Fenster { mitte: V3; breite; hoehe; drehungY }`, `Quader { mitte: V3; groesse: V3 }`, `Bereich { xMin; xMax; zMin; zMax; yMin; yMax }`).
- Produces:
  - `rahmenFuer(f: Fenster, staerke?: number, tiefe?: number): Quader[]`
  - `interface Baum { position: V3; hoehe: number; radius: number }`
  - `interface Kulisse { platte: Quader; wege: Quader[]; parkfelder: Quader[]; baeume: Baum[] }`
  - `KULISSE` (Masse), `kulisse(b: Bereich): Kulisse`
  - `ISO_RICHTUNG: V3`, `interface Freiraum { links: number; rechts: number; oben: number; unten: number }`
  - `interface Einpassung { ziel: V3; position: V3; zoom: number }`
  - `einpassen(b: Bereich, breite: number, hoehe: number, frei: Freiraum, fuellung?: number): Einpassung`

- [ ] **Step 1: Failing tests schreiben**

`app/web/src/szene3/rahmen.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { rahmenFuer } from "./rahmen";
import type { Fenster } from "../szene2/huelle";

const SUED: Fenster = { mitte: [10, 2, -0.02], breite: 1.2, hoehe: 1.6, drehungY: Math.PI };
const OST: Fenster = { mitte: [30.02, 2, 5], breite: 1.2, hoehe: 1.6, drehungY: Math.PI / 2 };

describe("rahmenFuer", () => {
  it("vier Leisten um das Fenster, Fassade entlang x", () => {
    const r = rahmenFuer(SUED, 0.06, 0.08);
    expect(r).toHaveLength(4);
    const [oben, unten, links, rechts] = r;
    expect(oben.mitte[1]).toBeCloseTo(2 + 0.8 + 0.03);
    expect(unten.mitte[1]).toBeCloseTo(2 - 0.8 - 0.03);
    expect(oben.groesse[0]).toBeCloseTo(1.2 + 0.12);
    expect(oben.groesse[2]).toBeCloseTo(0.08);
    expect(links.mitte[0]).toBeCloseTo(10 - 0.6 - 0.03);
    expect(rechts.mitte[0]).toBeCloseTo(10 + 0.6 + 0.03);
    expect(links.groesse[1]).toBeCloseTo(1.6);
  });
  it("Fassade entlang z vertauscht die Achsen", () => {
    const [oben, , links] = rahmenFuer(OST, 0.06, 0.08);
    expect(oben.groesse[2]).toBeCloseTo(1.32);
    expect(oben.groesse[0]).toBeCloseTo(0.08);
    expect(links.mitte[2]).not.toBeCloseTo(5);
    expect(links.mitte[0]).toBeCloseTo(30.02);
  });
});
```

`app/web/src/szene3/kulisse.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { KULISSE, kulisse } from "./kulisse";
import type { Bereich } from "../szene2/huelle";
import type { Quader } from "../szene2/huelle";

const B: Bereich = { xMin: 0, xMax: 30, zMin: 0, zMax: 15, yMin: 0, yMax: 6.5 };
const ueberlapptGebaeude = (q: Quader) => {
  const [mx, , mz] = q.mitte, [gx, , gz] = q.groesse;
  return mx + gx / 2 > B.xMin - 0.5 && mx - gx / 2 < B.xMax + 0.5 && mz + gz / 2 > B.zMin - 0.5 && mz - gz / 2 < B.zMax + 0.5;
};
const inPlatte = (x: number, z: number, p: Quader) =>
  Math.abs(x - p.mitte[0]) <= p.groesse[0] / 2 + 1e-9 && Math.abs(z - p.mitte[2]) <= p.groesse[2] / 2 + 1e-9;

describe("kulisse", () => {
  const k = kulisse(B);
  it("Grundplatte umschliesst Gebaeude mit Rand", () => {
    expect(k.platte.groesse[0]).toBeCloseTo(30 + 2 * KULISSE.rand);
    expect(k.platte.groesse[2]).toBeCloseTo(15 + 2 * KULISSE.rand);
    expect(k.platte.mitte[1]).toBeCloseTo(-KULISSE.platteHoehe / 2);
  });
  it("Wege, Parkfelder und Baeume liegen auf der Platte und nicht im Gebaeude", () => {
    expect(k.wege.length).toBeGreaterThan(0);
    expect(k.parkfelder.length).toBeGreaterThan(0);
    expect(k.baeume.length).toBeGreaterThan(0);
    for (const q of [...k.wege, ...k.parkfelder]) {
      expect(ueberlapptGebaeude(q)).toBe(false);
      expect(inPlatte(q.mitte[0], q.mitte[2], k.platte)).toBe(true);
    }
    for (const b of k.baeume) {
      expect(inPlatte(b.position[0], b.position[2], k.platte)).toBe(true);
      const imGebaeude = b.position[0] > B.xMin - 1 && b.position[0] < B.xMax + 1 && b.position[2] > B.zMin - 1 && b.position[2] < B.zMax + 1;
      expect(imGebaeude).toBe(false);
    }
  });
  it("deterministisch", () => {
    expect(kulisse(B)).toEqual(k);
  });
  it("kleines Gebaeude ergibt trotzdem eine gueltige Kulisse", () => {
    const klein = kulisse({ xMin: 0, xMax: 4, zMin: 0, zMax: 4, yMin: 0, yMax: 3 });
    expect(klein.platte.groesse[0]).toBeGreaterThan(4);
    expect(klein.baeume.every((b) => b.hoehe > 0 && b.radius > 0)).toBe(true);
  });
});
```

`app/web/src/szene3/kamera.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { einpassen, ISO_RICHTUNG } from "./kamera";
import type { Bereich } from "../szene2/huelle";

const B: Bereich = { xMin: 0, xMax: 30, zMin: 0, zMax: 15, yMin: 0, yMax: 6.5 };
const OHNE = { links: 0, rechts: 0, oben: 0, unten: 0 };

describe("einpassen", () => {
  it("ohne Freiraum zielt auf die Mitte des Bereichs", () => {
    const e = einpassen(B, 1440, 900, OHNE, 0.7);
    expect(e.ziel[0]).toBeCloseTo(15);
    expect(e.ziel[1]).toBeCloseTo(3.25);
    expect(e.ziel[2]).toBeCloseTo(7.5);
  });
  it("Kamera liegt in Iso-Richtung vom Ziel", () => {
    const e = einpassen(B, 1440, 900, OHNE, 0.7);
    const d = [e.position[0] - e.ziel[0], e.position[1] - e.ziel[1], e.position[2] - e.ziel[2]];
    const l = Math.hypot(...d);
    d.forEach((v, i) => expect(v / l).toBeCloseTo(ISO_RICHTUNG[i]));
  });
  it("Zoom waechst linear mit der Ansicht und faellt mit der Gebaeudegroesse", () => {
    const a = einpassen(B, 1440, 900, OHNE, 0.7).zoom;
    expect(einpassen(B, 2880, 1800, OHNE, 0.7).zoom).toBeCloseTo(2 * a);
    const gross = { ...B, xMax: 60, zMax: 30 };
    expect(einpassen(gross, 1440, 900, OHNE, 0.7).zoom).toBeLessThan(a);
  });
  it("Fuellgrad skaliert den Zoom", () => {
    expect(einpassen(B, 1440, 900, OHNE, 0.35).zoom).toBeCloseTo(einpassen(B, 1440, 900, OHNE, 0.7).zoom / 2);
  });
  it("Freiraum links verschiebt das Bild nach rechts (Ziel nach links)", () => {
    const mitte = einpassen(B, 1440, 900, OHNE, 0.7);
    const links = einpassen(B, 1440, 900, { links: 320, rechts: 0, oben: 0, unten: 0 }, 0.7);
    expect(links.zoom).toBeLessThan(mitte.zoom);
    // Bildschirm-rechts-Vektor der Iso-Kamera zeigt in (+x, 0, -z)/sqrt2: Ziel wandert entgegen
    const verschiebung = (links.ziel[0] - mitte.ziel[0]) - (links.ziel[2] - mitte.ziel[2]);
    expect(verschiebung).toBeLessThan(0);
  });
});
```

- [ ] **Step 2: Tests laufen lassen, muessen fehlschlagen**

Run: `cd app/web && npx vitest run src/szene3`
Expected: FAIL, Module nicht gefunden.

- [ ] **Step 3: Implementieren**

`app/web/src/szene3/rahmen.ts`:

```ts
import type { Fenster, Quader } from "../szene2/huelle";

/** Vier achsparallele Leisten (oben, unten, links, rechts) um ein Fenster. Fassaden sind achsparallel. */
export function rahmenFuer(f: Fenster, staerke = 0.06, tiefe = 0.08): Quader[] {
  const [x, y, z] = f.mitte;
  const entlangX = Math.abs(Math.sin(f.drehungY)) < 0.5; // Normale entlang z -> Fassade verlaeuft in x
  const quer = f.breite + 2 * staerke;
  const yOben = y + f.hoehe / 2 + staerke / 2, yUnten = y - f.hoehe / 2 - staerke / 2;
  const seite = f.breite / 2 + staerke / 2;
  if (entlangX) {
    return [
      { mitte: [x, yOben, z], groesse: [quer, staerke, tiefe] },
      { mitte: [x, yUnten, z], groesse: [quer, staerke, tiefe] },
      { mitte: [x - seite, y, z], groesse: [staerke, f.hoehe, tiefe] },
      { mitte: [x + seite, y, z], groesse: [staerke, f.hoehe, tiefe] },
    ];
  }
  return [
    { mitte: [x, yOben, z], groesse: [tiefe, staerke, quer] },
    { mitte: [x, yUnten, z], groesse: [tiefe, staerke, quer] },
    { mitte: [x, y, z - seite], groesse: [tiefe, f.hoehe, staerke] },
    { mitte: [x, y, z + seite], groesse: [tiefe, f.hoehe, staerke] },
  ];
}
```

`app/web/src/szene3/kulisse.ts`:

```ts
import type { Bereich, Quader, V3 } from "../szene2/huelle";

/** Gestalterische Kulisse [A]: rein aus dem Bereich abgeleitet, deterministisch. Masse in m. */
export const KULISSE = {
  rand: 9, platteHoehe: 0.4, wegBreite: 2, wegAbstand: 1.5, wegHoehe: 0.04,
  parkBreite: 2.5, parkTiefe: 5, parkAbstand: 3, parkHoehe: 0.02,
  baumAbstand: 6, baumHoehe: 4, baumRadius: 1.4, baumRand: 4,
} as const;

export interface Baum { position: V3; hoehe: number; radius: number }
export interface Kulisse { platte: Quader; wege: Quader[]; parkfelder: Quader[]; baeume: Baum[] }

export function kulisse(b: Bereich): Kulisse {
  const K = KULISSE;
  const breite = b.xMax - b.xMin, tiefe = b.zMax - b.zMin;
  const cx = (b.xMin + b.xMax) / 2, cz = (b.zMin + b.zMax) / 2;
  const platte: Quader = { mitte: [cx, -K.platteHoehe / 2, cz], groesse: [breite + 2 * K.rand, K.platteHoehe, tiefe + 2 * K.rand] };

  // Gehweg vor der Suedfassade (z < zMin) und entlang der Ostfassade (x > xMax), L-foermig
  const wz = b.zMin - K.wegAbstand - K.wegBreite / 2;
  const wx = b.xMax + K.wegAbstand + K.wegBreite / 2;
  const wege: Quader[] = [
    { mitte: [cx + K.wegAbstand / 2, K.wegHoehe / 2, wz], groesse: [breite + K.wegAbstand + K.wegBreite, K.wegHoehe, K.wegBreite] },
    { mitte: [wx, K.wegHoehe / 2, cz], groesse: [K.wegBreite, K.wegHoehe, tiefe] },
  ];

  // Parkfelder westlich des Gebaeudes, eine Reihe entlang z
  const px = b.xMin - K.parkAbstand - K.parkTiefe / 2;
  const anzahl = Math.max(1, Math.floor(tiefe / K.parkBreite));
  const start = cz - (anzahl * K.parkBreite) / 2 + K.parkBreite / 2;
  const parkfelder: Quader[] = Array.from({ length: anzahl }, (_, i) => ({
    mitte: [px, K.parkHoehe / 2, start + i * K.parkBreite] as V3,
    groesse: [K.parkTiefe, K.parkHoehe, K.parkBreite - 0.15] as V3,
  }));

  // Baumreihe noerdlich (z > zMax), ausserhalb des Gebaeudes, innerhalb der Platte
  const bz = b.zMax + K.baumRand;
  const n = Math.max(2, Math.floor((breite + 2 * K.baumRand) / K.baumAbstand));
  const x0 = cx - ((n - 1) * K.baumAbstand) / 2;
  const baeume: Baum[] = Array.from({ length: n }, (_, i) => ({
    position: [x0 + i * K.baumAbstand, 0, bz] as V3,
    hoehe: K.baumHoehe * (i % 3 === 1 ? 1.15 : i % 3 === 2 ? 0.9 : 1),
    radius: K.baumRadius,
  }));

  return { platte, wege, parkfelder, baeume };
}
```

Pruefrechnung Testwelt: Platte 30 + 18 = 48 x 33; Baumreihe z = 19, innerhalb Platte (zMax+9 = 24); n = floor(38/6) = 6, x von 0 bis 30 → innerhalb 48-Platte (−9..39). Parkfelder x = −3 − 2.5 = −5.5, Rand −9 → innerhalb. Kleines Gebaeude 4 x 4: n = max(2, floor(12/6)=2).

`app/web/src/szene3/kamera.ts`:

```ts
import type { Bereich, V3 } from "../szene2/huelle";

/** Blickrichtung von Ziel zu Kamera: isometrisch 3/4 (45 Grad gedreht, ca. 35 Grad Neigung). */
export const ISO_RICHTUNG: V3 = (() => { const l = Math.sqrt(3); return [1 / l, 1 / l, 1 / l] as V3; })();
export interface Freiraum { links: number; rechts: number; oben: number; unten: number }
export interface Einpassung { ziel: V3; position: V3; zoom: number }

const kreuz = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; };
const punkt = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * Passt eine Orthokamera so ein, dass der Bereich `fuellung` (0..1) der freien Flaeche fuellt
 * (Ansicht minus Freiraum fuer Karten, in px) und in deren Mitte liegt. zoom = px pro Welteinheit.
 */
export function einpassen(b: Bereich, breite: number, hoehe: number, frei: Freiraum, fuellung = 0.7): Einpassung {
  const rechts = norm(kreuz([0, 1, 0], ISO_RICHTUNG));   // Bildschirm-rechts
  const oben = kreuz(ISO_RICHTUNG, rechts);               // Bildschirm-oben
  const mitte: V3 = [(b.xMin + b.xMax) / 2, (b.yMin + b.yMax) / 2, (b.zMin + b.zMax) / 2];
  let r0 = Infinity, r1 = -Infinity, o0 = Infinity, o1 = -Infinity;
  for (const x of [b.xMin, b.xMax]) for (const y of [b.yMin, b.yMax]) for (const z of [b.zMin, b.zMax]) {
    const p: V3 = [x - mitte[0], y - mitte[1], z - mitte[2]];
    const r = punkt(p, rechts), o = punkt(p, oben);
    r0 = Math.min(r0, r); r1 = Math.max(r1, r); o0 = Math.min(o0, o); o1 = Math.max(o1, o);
  }
  const freiB = Math.max(1, breite - frei.links - frei.rechts), freiH = Math.max(1, hoehe - frei.oben - frei.unten);
  const zoom = fuellung * Math.min(freiB / Math.max(r1 - r0, 1e-6), freiH / Math.max(o1 - o0, 1e-6));
  // Bildmitte des Bereichs (Projektion) soll in die Mitte der freien Flaeche:
  const projMitteR = (r0 + r1) / 2, projMitteO = (o0 + o1) / 2;
  const dxPx = (frei.links - frei.rechts) / 2, dyPx = (frei.unten - frei.oben) / 2; // + = Inhalt nach rechts / oben
  const sR = projMitteR - dxPx / zoom, sO = projMitteO - dyPx / zoom;
  const ziel: V3 = [mitte[0] + rechts[0] * sR + oben[0] * sO, mitte[1] + rechts[1] * sR + oben[1] * sO, mitte[2] + rechts[2] * sR + oben[2] * sO];
  const abstand = 200;
  const position: V3 = [ziel[0] + ISO_RICHTUNG[0] * abstand, ziel[1] + ISO_RICHTUNG[1] * abstand, ziel[2] + ISO_RICHTUNG[2] * abstand];
  return { ziel, position, zoom };
}
```

Hinweis zur Vorzeichenkonvention im letzten Test: `rechts = norm(kreuz([0,1,0], ISO))` = (1, 0, −1)/√2. Freiraum links schiebt den Inhalt nach rechts, also das Ziel nach Bildschirm-links (−rechts), d. h. `Δx − Δz < 0`. Wenn der Test wegen eines Vorzeichenfehlers in der Implementierung scheitert, die Implementierung korrigieren (die Erwartung ist geometrisch begruendet), nicht den Test.

- [ ] **Step 4: Tests laufen lassen, muessen bestehen**

Run: `cd app/web && npx vitest run src/szene3`
Expected: PASS (11 Tests). Dann `npm test && npm run pruefe:typen`.

- [ ] **Step 5: Commit**

```bash
git add app/web/src/szene3/rahmen.ts app/web/src/szene3/kulisse.ts app/web/src/szene3/kamera.ts app/web/src/szene3/*.test.ts
git commit -m "Redesign: Fensterrahmen, Kulisse und Kamera-Einpassen als reine Funktionen

Co-Authored-By: <Modell> <noreply@anthropic.com>"
```

---

### Task 3: Szene, Gebaeude, Kulisse und Seite "Digital Twin"

Sichtbares Ergebnis: In der bisherigen Ansicht gibt es einen Knopf "Digital Twin". Er oeffnet eine vollflaechige, helle Diorama-Szene des Beispielgebaeudes mit Geschossplatten, Waenden, Glas mit Rahmen, Attika, Dachaufbau, Kulisse, weichen Schatten und AO. Oben links ein Zurueck-Knopf. Kein Dashboard-UI (folgt in Schritt 3).

**Files:**
- Create: `app/web/src/szene3/palette.ts`, `Szene3.tsx`, `Gebaeude3.tsx`, `Kulisse3.tsx`
- Create: `app/web/src/seiten/Twin.tsx`
- Modify: `app/web/src/App.tsx`, `app/web/src/stil.css`

**Interfaces:**
- Consumes: `huelle(welt): Huelle` und `wandQuader`, `MASSE` aus `../szene2/huelle`; `rahmenFuer`, `kulisse`, `einpassen`, `Freiraum` (Task 2); Typen `Welt`, `Katalog`, `Beschreibung` aus `../typen`; `holeJson`, `ApiFehler` aus `../api`.
- Produces:
  - `PALETTE` (palette.ts): `{ hintergrund, platte, plattenRand, boden, wand, wandStirn, decke, glas, rahmen, attika, aufbau, weg, parkfeld, parkLinie, baumKrone, baumStamm }` als Hex-Strings.
  - `Szene3({ welt, freiraum, reduziert }: { welt: Welt; freiraum: Freiraum; reduziert: boolean })`
  - `Twin({ gebaeudeId, name, onZurueck, onAbgelaufen })`
  - App-Zustand `{ art: "twin"; gebaeudeId: string; name: string }`

Anforderungen an die Darstellung (Ziel: Referenz 01/02, siehe Spec Abschnitt 2):

1. `palette.ts`: Werte [A] als Startpunkt:

```ts
/** Szenenfarben [A]: Weiss mit Grautoenen, nur leichte Eisblau-Akzente im Glas. Abstimmung in Task 4. */
export const PALETTE = {
  hintergrund: "#eef0f3", platte: "#f7f8fa", plattenRand: "#e3e6ea",
  boden: "#eceef1", wand: "#fbfbfc", wandStirn: "#ffffff", decke: "#f2f3f5",
  glas: "#cfdbe6", rahmen: "#dfe3e8", attika: "#f4f5f7", aufbau: "#e9ecef",
  weg: "#e6e9ed", parkfeld: "#eceff2", parkLinie: "#ffffff", baumKrone: "#e4e8e6", baumStamm: "#d5d9dd",
} as const;
```

2. `Szene3.tsx`:
   - `<Canvas orthographic shadows dpr={[1, 2]} gl={{ antialias: true }} camera={{ near: 0.1, far: 1000 }}>`; Hintergrund `PALETTE.hintergrund` via `<color attach="background" />`.
   - Kamera: beim Mount und bei Groessenaenderung `einpassen(h.bereich, size.width, size.height, freiraum, 0.7)` anwenden (Position, `lookAt(ziel)`, `zoom`, `updateProjectionMatrix`). Steuerung mit drei `<OrbitControls makeDefault target={ziel} enableDamping maxPolarAngle={Math.PI / 2 - 0.08} />`; eine Groessenaenderung darf eine vom Nutzer gedrehte Ansicht nicht zuruecksetzen (nur beim ersten Mount und bei geaendertem `welt` einpassen).
   - Licht: `<ambientLight intensity={0.35} />`; eine `directionalLight` von links oben (Richtung ca. (−1, 2, 1) relativ zur Gebaeudemitte) mit `castShadow`, `shadow-mapSize={[2048, 2048]}`, Schattenkamera an `h.bereich` + Kulisse angepasst.
   - Umgebung: `<Environment resolution={256} frames={1}>` mit 3–4 `<Lightformer>` (grosse weisse Flaeche oben, zwei seitliche, eine schwache Ring- oder Rechteckform) – KEIN `preset`, KEINE Dateien.
   - Weiche Bodenschatten: drei `<AccumulativeShadows temporal frames={80} alphaTest={0.85} scale={…} position={[cx, 0.001, cz]} color="#6b7280" opacity={0.55}>` mit `<RandomizedLight amount={8} radius={6} ambient={0.5} position={…} />` (Werte [A], in Task 4 abstimmen). Die Grundplatte empfaengt zusaetzlich die normale Schattenkarte.
   - AO: `<EffectComposer multisampling={4} enableNormalPass={false}>` mit `<N8AO aoRadius={2} intensity={2.5} distanceFalloff={1} halfRes={false} color="#4b5563" />` (aus `@react-three/postprocessing`); bei `reduziert` kein EffectComposer und keine AccumulativeShadows, `castShadow` aus.
   - `frameloop="always"` ist fuer Schritt 1 zulaessig (AccumulativeShadows braucht Frames). [A] Leistungsoptimierung (demand + einfrieren) folgt in Schritt 5 – als TODO-freier Hinweis im Abnahme-README vermerken, nicht im Code.
3. `Gebaeude3.tsx` (aus `huelle(welt)`):
   - Geschossplatten: je Geschoss und Grundriss-Rechteck drei `<RoundedBox args={[breite + 0.3, 0.25, tiefe + 0.3]} radius={0.06} smoothness={3}>` an `yUnten`; Dach-Platte bei `yMax` gleich. Material `PALETTE.decke`, `roughness 0.9`.
   - Waende: `wandQuader(w, yUnten + 0.125, hoehe − 0.25)` je Geschoss, Material `PALETTE.wand`, matt (`roughness 0.95`), `castShadow receiveShadow`.
   - Fenster: Glas als `InstancedMesh` aus `PlaneGeometry`, `MeshPhysicalMaterial` mit `color PALETTE.glas`, `roughness 0.08`, `metalness 0`, `transparent`, `opacity 0.55`, `envMapIntensity 1.4` (keine `transmission` – zu teuer). Glas 0.04 m vor der Wand.
   - Rahmen: alle `rahmenFuer(f)` aller Fenster als ein `InstancedMesh` (BoxGeometry 1×1×1, skaliert), Material `PALETTE.rahmen`.
   - Attika als `RoundedBox` je `h.attika`-Quader (radius 0.04); Dachaufbau `h.aufbau` als `RoundedBox` plus ein flaches Lueftungsgitter (z. B. 6 duenne Lamellen-Boxen) und ein umlaufendes Gelaender aus duennen Pfosten (Hoehe 1.0 m, Abstand 1 m) um den Dachrand – alles in `PALETTE.aufbau`/`PALETTE.rahmen`.
   - Keine Linien/Wireframes. Keine schwarzen Kanten.
4. `Kulisse3.tsx` (aus `kulisse(h.bereich)`): Platte als `RoundedBox` (radius 0.35) in `PALETTE.platte` mit einer zweiten, minimal groesseren Platte darunter in `PALETTE.plattenRand` als sichtbare Kante; Wege als flache Boxen; Parkfelder als flache Boxen mit weissen Trennlinien; Baeume stilisiert: Stamm `CylinderGeometry(0.12, 0.15, hoehe*0.4)`, Krone `IcosahedronGeometry(radius, 1)` mit `flatShading` in `PALETTE.baumKrone` (hell, nicht gruen-gesaettigt – Diorama-Stil). Alles `receiveShadow`, Baeume `castShadow`.
5. `Twin.tsx`: laedt Welt, Beschreibung, Katalog wie `seiten/Entwurf.tsx` (inkl. 401 → `onAbgelaufen`, Fehlermeldung, WebGL-Pruefung einmalig per `useState(webglVorhanden)` mit `WEBGL_lose_context` – Funktion aus `Entwurf.tsx` uebernehmen). Rendert `<main className="twin">` mit `<Szene3 welt freiraum={{ links: 340, rechts: 300, oben: 72, unten: 200 }} reduziert={false} />` (Freiraum reserviert Platz fuer die Karten aus Schritt 3 [A]) und oben links `<button className="twin-zurueck" onClick={onZurueck}>← Gebäude</button>`.
6. `App.tsx`: Zustand `twin` ergaenzen; in der Kopfzeile der Ansicht neben "Entwurf" einen Knopf "Digital Twin" (`setZustand({ ...zustand, art: "twin" })`). Im Zustand `twin` rendert App **nur** `<Twin ... onZurueck={() => setZustand({ ...zustand, art: "ansicht" })} onAbgelaufen={abgelaufen} />` ohne `.rahmen`/Kopfzeile.
7. `stil.css` anhaengen:

```css
/* Digital Twin (Redesign): vollflaechige Szene */
.twin { position: fixed; inset: 0; background: #eef0f3; }
.twin .szene { position: absolute; inset: 0; }
.twin-zurueck { position: absolute; top: 16px; left: 16px; z-index: 2; background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.9); border-radius: 999px; padding: 0.45rem 1rem; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08); font-size: 13px; color: #334155; }
```

Schritte:

- [ ] **Step 1:** `palette.ts`, `Kulisse3.tsx`, `Gebaeude3.tsx`, `Szene3.tsx`, `Twin.tsx` anlegen, `App.tsx` und `stil.css` anpassen (Anforderungen 1–7). Vor Verwendung jeder drei-Komponente deren Props in `node_modules/@react-three/drei` (Typdefinitionen) pruefen; bei Abweichungen minimal anpassen und im Report nennen.
- [ ] **Step 2:** `cd app/web && npm test && npm run build` – gruen.
- [ ] **Step 3:** Mit dem Screenshot-Werkzeug (oben) `twin-t3.png` erzeugen (warte 8000 ms fuer AccumulativeShadows). Konsole: keine CSP-Verletzungen, keine Fehler ausser dem erwarteten 401 vor dem Login. Renderer = NVIDIA/D3D11. Screenshot selbst ansehen: Gebaeude hell, plastisch, Schatten sichtbar, Kulisse vorhanden, Gebaeude ca. 65–75 % der Flaeche zwischen den Freiraeumen.
- [ ] **Step 4:** Entwicklungsinstanz beenden. Commit:

```bash
git add app/web/src/szene3 app/web/src/seiten/Twin.tsx app/web/src/App.tsx app/web/src/stil.css
git commit -m "Redesign: Diorama-Szene mit Huelle, Glas, Rahmen, Kulisse, weichen Schatten und AO

Co-Authored-By: <Modell> <noreply@anthropic.com>"
```

---

### Task 4: Look-Abstimmung und Abnahme 1

**Files:**
- Modify (Werte/Materialien/Licht, keine Strukturumbauten): `app/web/src/szene3/palette.ts`, `Szene3.tsx`, `Gebaeude3.tsx`, `Kulisse3.tsx`, ggf. `KULISSE` in `kulisse.ts` (Testerwartungen nur bewusst anpassen)
- Create: `docs/abnahme/2026-11-12-redesign-schritt1/README.md`, Screenshots `uebersicht.png`, `uebersicht-nah.png`, `reduziert.png` (falls `reduziert` per Query-Parameter oder temporaerem Schalter nicht erreichbar: weglassen und im README vermerken)

- [ ] **Step 1: Vergleich.** `twin-t3.png` neben `docs/design/referenzen/01-dashboard.png` und `02-gebaeude.png` legen. Konkret bewerten: Helligkeit/Weissanteil, Weichheit und Richtung der Schatten, AO in Ecken (Attika, Fensterlaibungen, Plattenkanten), Lesbarkeit der Geschosse, Glas wirkt leicht blaeulich (nicht grau, nicht dunkel), Kulisse unaufdringlich, keine harten schwarzen Kanten, Gebaeude fuellt 65–75 % der freien Flaeche.
- [ ] **Step 2: Bis zu 5 Abstimmungsrunden.** Je Runde: gezielt 1–3 Werte aendern (Palette, Licht-/Lightformer-Intensitaeten, AccumulativeShadows, N8AO, Material-Rauheit, Glas-Deckkraft, Fuellgrad), bauen, Screenshot `twin-r<N>.png`, ansehen, Wirkung notieren. Abbruch, wenn zwei Runden keine sichtbare Verbesserung bringen.
- [ ] **Step 3: Nahaufnahme.** Zusaetzlich einen Screenshot nach Mausrad-Zoom (Playwright `page.mouse.wheel(0, -600)` ueber der Gebaeudemitte, 1500 ms warten) als `uebersicht-nah.png` – Fensterrahmen, Glas und Attika muessen als Details erkennbar sein.
- [ ] **Step 4: Gesamtpruefung.** `cd app/web && npm test && npm run build`; `cd app && npm test && npm run pruefe:typen` (ca. 70 s). Zahlen notieren.
- [ ] **Step 5: README Abnahme 1** (Deutsch de-CH, [F]/[A]/[?], echte Umlaute erlaubt): Screenshots (Links), Renderer (NVIDIA RTX 3070 Ti, D3D11 – kein Laptop-Massstab [A]), Pruefstand, CSP-Ergebnis, Abstimmungsrunden kurz, offene Punkte fuer den PO (Kulisse ja/nein und Umfang, Glas-Ton, Schattenstaerke, Fuellgrad, `frameloop="always"` bis Schritt 5). Satz: "Abnahme 1: Szene-Look. Weiter mit Anlagen (Schritt 2) erst nach PO-OK."
- [ ] **Step 6: Commit** (Entwicklungsinstanz vorher beenden):

```bash
git add app/web/src/szene3 docs/abnahme/2026-11-12-redesign-schritt1
git commit -m "Redesign: Look-Abstimmung Szene und Unterlagen fuer Abnahme 1

Co-Authored-By: <Modell> <noreply@anthropic.com>"
```
