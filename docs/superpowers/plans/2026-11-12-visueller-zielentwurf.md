# Visueller Zielentwurf (E40) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prototyp-Seite "Entwurf" im bestehenden Frontend, die das Beispielgebaeude plastisch (Uebersicht hell), als Technikansicht im Fokusmodus und mit schwebenden Karten zeigt.

**Architecture:** Reine, getestete Funktionen in `app/web/src/szene2/` leiten aus der `Welt` Huelle, Leitungen und Stimmung ab. React-Three-Fiber-Komponenten zeichnen das Ergebnis mit Bordmitteln von `three` (Schatten, `RoomEnvironment`, `GTAOPass`). HTML-Karten liegen ueber dem Canvas; die Bauteilkarte folgt dem 3D-Punkt per Projektion. Die bestehende Ansicht bleibt unveraendert, ausser einem Knopf "Entwurf".

**Tech Stack:** React 19, @react-three/fiber 9.8, three 0.187 (inkl. `three/examples/jsm`), Vite 8, vitest 5 (Umgebung `node`), TypeScript 7.

**Spec:** `docs/superpowers/specs/2026-11-12-visueller-zielentwurf-design.md`

## Global Constraints

- Keine neuen npm-Pakete. Nur `three`, `@react-three/fiber`, `react`, `react-dom` und Module aus `three/examples/jsm/...`.
- Keine externen Ressourcen laden (CSP `default-src 'self'; style-src 'self'`). Keine `<style>`-Tags oder Inline-`style`-Attribute im HTML; Stil nur in `app/web/src/stil.css` oder per JS (`element.style...`, React `style`-Prop ist erlaubt, laeuft ueber CSSOM).
- Rot ist ausschliesslich der Heizung vorbehalten: Geraete `#8a5450`, Leitungen `#ff3b30`. Keine Gelb-/Orange-Auswahlfarbe.
- Alle Ableitungen deterministisch (keine Zufallszahlen).
- Sprache in Code-Bezeichnern und UI: Deutsch ohne Umlaute im Code (wie bestehender Code, z. B. `Gebaeude`), UI-Texte ebenfalls ohne Umlaute wie im bestehenden Frontend; kein Eszett.
- Tests: `src/**/*.test.ts`, vitest-Umgebung `node` (kein DOM, kein WebGL). Nur reine Funktionen testen.
- Befehle im Verzeichnis `app/web`: `npm test`, `npm run pruefe:typen`, `npm run build`.
- Commit-Nachrichten auf Deutsch, Muster `Entwurf: ...`, mit Zeile `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Bewusste Abweichungen von der Spec [A]

- Bauteile werden nicht instanziert (wenige Symbole, "ein Symbol je Typgruppe"); nur Fenster sind instanziert.
- Der "weisse Umriss" bei Auswahl entfaellt im Prototyp; Auswahl = staerker leuchtendes Rot. Entscheid in der Korrekturrunde (Task 6).
- Zentrale fuer die Hauptleitung: erstes Zentrale-Symbol mit Erzeuger-Katalog-ID (Waermepumpe, Gas-/Oelkessel, Fernwaerme-Uebergabe) nach Schluessel sortiert; sonst erstes Zentrale-Symbol.

## Dateistruktur

| Datei | Neu/Aendern | Verantwortung |
|---|---|---|
| `app/web/src/szene2/farben.ts` | neu | Gewerke- und Fassadenfarben, Rohrradien |
| `app/web/src/szene2/stimmung.ts` | neu | Stimmungen HELL/FOKUS, Farb- und Werteinterpolation |
| `app/web/src/szene2/huelle.ts` | neu | Welt -> Waende, Fenster, Baender, Attika, Aufbau, Grundplatte |
| `app/web/src/szene2/leitungen.ts` | neu | Haupt-/Verteilleitungen, Geschoss-Zuordnung, Schlangenmuster |
| `app/web/src/szene2/materialien.ts` | neu | gemeinsam genutzte three-Materialien |
| `app/web/src/szene2/schrift.tsx` | neu | Beschriftung als Sprite und flach auf dem Boden |
| `app/web/src/szene2/Welt3D.tsx` | neu | Canvas, Licht, Schatten, AO, Kamera, Stimmung, Gebaeude, Anker |
| `app/web/src/szene2/bauteile.tsx` | neu | Bauteilformen je Katalog-ID |
| `app/web/src/szene2/Fokus.tsx` | neu | Raeume, Bauteile, Leitungen, FBH-Muster im Fokusmodus |
| `app/web/src/karten/GebaeudeKarte.tsx` | neu | Kennzahlen, Hinweise, Schalter "reduziert" |
| `app/web/src/karten/GeschossLeiste.tsx` | neu | Geschosswahl unten |
| `app/web/src/karten/Legende.tsx` | neu | Haupt-/Verteilleitung, "schematischer Verlauf" |
| `app/web/src/karten/BauteilKarte.tsx` | neu | Karte am gewaehlten Bauteil |
| `app/web/src/seiten/Entwurf.tsx` | neu | Seite: Daten laden, Zustand, Zusammenbau |
| `app/web/src/App.tsx` | aendern | Zustand `entwurf`, Knoepfe in der Kopfzeile |
| `app/web/src/stil.css` | aendern | Stile fuer Entwurf und Glas-Karten |
| Tests `*.test.ts` neben den reinen Modulen | neu | |

Gemeinsame Testwelt (in jeder Testdatei kopiert, damit Tasks unabhaengig bleiben): Grundriss 30 x 15, EG (0, 3 m) mit Technik (x 0–10) und Restaurant (x 10–30), OG1 (3, 3.5 m) mit Buero (ganze Flaeche).

---

### Task 1: Farben und Stimmung

**Files:**
- Create: `app/web/src/szene2/farben.ts`
- Create: `app/web/src/szene2/stimmung.ts`
- Test: `app/web/src/szene2/stimmung.test.ts`

**Interfaces:**
- Produces:
  - `GEWERK: { heizung: { geraet: string; leitung: string } }`, `NEUTRAL: { geraet: string; leitung: string }`
  - `gewerkVon(katalogId: string): { geraet: string; leitung: string }`
  - `FASSADE: { wand: string; fenster: string; band: string; platte: string; boden: readonly string[] }`
  - `ROHR: { haupt: number; verteil: number }`
  - `interface Stimmung { hintergrund: string; umgebung: number; sonne: number; gebaeude: string; leuchten: number; abblenden: number }`
  - `HELL: Stimmung`, `FOKUS: Stimmung`
  - `mischeFarbe(a: string, b: string, t: number): string`
  - `mische(a: Stimmung, b: Stimmung, t: number): Stimmung` (t wird auf 0..1 begrenzt)

- [ ] **Step 1: Failing test schreiben**

`app/web/src/szene2/stimmung.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { FOKUS, HELL, mische, mischeFarbe } from "./stimmung";
import { GEWERK, NEUTRAL, gewerkVon } from "./farben";

describe("mischeFarbe", () => {
  it("interpoliert je Kanal", () => {
    expect(mischeFarbe("#000000", "#ffffff", 0)).toBe("#000000");
    expect(mischeFarbe("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mischeFarbe("#000000", "#ffffff", 1)).toBe("#ffffff");
  });
});

describe("mische", () => {
  it("liefert die Endpunkte", () => {
    expect(mische(HELL, FOKUS, 0)).toEqual(HELL);
    expect(mische(HELL, FOKUS, 1)).toEqual(FOKUS);
  });
  it("begrenzt t auf 0..1", () => {
    expect(mische(HELL, FOKUS, -1)).toEqual(HELL);
    expect(mische(HELL, FOKUS, 2)).toEqual(FOKUS);
  });
  it("interpoliert Zahlen linear", () => {
    expect(mische(HELL, FOKUS, 0.5).umgebung).toBeCloseTo((HELL.umgebung + FOKUS.umgebung) / 2);
  });
});

describe("gewerkVon", () => {
  it("Heizung ist rot", () => {
    expect(gewerkVon("heizung.verteiler")).toEqual(GEWERK.heizung);
    expect(GEWERK.heizung.geraet).toBe("#8a5450");
    expect(GEWERK.heizung.leitung).toBe("#ff3b30");
  });
  it("unbekanntes Gewerk ist neutral", () => {
    expect(gewerkVon("lueftung.geraet")).toEqual(NEUTRAL);
  });
});
```

- [ ] **Step 2: Test laufen lassen, muss fehlschlagen**

Run: `cd app/web && npx vitest run src/szene2/stimmung.test.ts`
Expected: FAIL, Module `./stimmung` / `./farben` nicht gefunden.

- [ ] **Step 3: Implementieren**

`app/web/src/szene2/farben.ts`:

```ts
/** Farben nach KOO-Logik: Farbe = Gewerk. Werte [A], Abstimmung in der Korrekturrunde. */
export const GEWERK = {
  heizung: { geraet: "#8a5450", leitung: "#ff3b30" },
} as const;

export const NEUTRAL = { geraet: "#7b8794", leitung: "#9aa5b1" } as const;

export function gewerkVon(katalogId: string): { geraet: string; leitung: string } {
  const gewerk = katalogId.split(".", 1)[0];
  return gewerk in GEWERK ? GEWERK[gewerk as keyof typeof GEWERK] : NEUTRAL;
}

export const FASSADE = {
  wand: "#f5f6f8",
  fenster: "#8fa3b8",
  band: "#ffffff",
  platte: "#e8ebef",
  boden: ["#eef1f4", "#e4e9ef", "#f4f6f8"],
} as const;

/** Rohrradien in m: Haupt- und Verteilleitung unterscheiden sich nur in der Dicke. */
export const ROHR = { haupt: 0.08, verteil: 0.04 } as const;
```

`app/web/src/szene2/stimmung.ts`:

```ts
import { FASSADE } from "./farben";

/** Licht- und Farbparameter einer Stimmung. leuchten = Emissiv-Staerke der Leitungen, abblenden = Anteil Hintergrundfarbe in der Grundplatte. */
export interface Stimmung {
  hintergrund: string; umgebung: number; sonne: number; gebaeude: string; leuchten: number; abblenden: number;
}

export const HELL: Stimmung = { hintergrund: "#eef1f5", umgebung: 0.9, sonne: 1.6, gebaeude: FASSADE.wand, leuchten: 0, abblenden: 0 };
/** Fokus: abgedunkelt/entsaettigt, Schieferblau-Grau, nicht dunkel. */
export const FOKUS: Stimmung = { hintergrund: "#5d6d80", umgebung: 0.55, sonne: 1.1, gebaeude: "#a7b1bc", leuchten: 1.4, abblenden: 0.4 };

const kanaele = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export function mischeFarbe(a: string, b: string, t: number): string {
  const ka = kanaele(a), kb = kanaele(b);
  return "#" + ka.map((v, i) => Math.round(v + (kb[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

export function mische(a: Stimmung, b: Stimmung, t: number): Stimmung {
  const u = Math.min(1, Math.max(0, t));
  const zahl = (x: number, y: number) => x + (y - x) * u;
  return {
    hintergrund: mischeFarbe(a.hintergrund, b.hintergrund, u),
    umgebung: zahl(a.umgebung, b.umgebung),
    sonne: zahl(a.sonne, b.sonne),
    gebaeude: mischeFarbe(a.gebaeude, b.gebaeude, u),
    leuchten: zahl(a.leuchten, b.leuchten),
    abblenden: zahl(a.abblenden, b.abblenden),
  };
}
```

Hinweis: `mische(HELL, FOKUS, 0)` muss `toEqual(HELL)` ergeben; `mischeFarbe` liefert Kleinbuchstaben, daher sind alle Hex-Werte oben klein geschrieben.

- [ ] **Step 4: Test laufen lassen, muss bestehen**

Run: `cd app/web && npx vitest run src/szene2/stimmung.test.ts`
Expected: PASS (6 Tests).

- [ ] **Step 5: Commit**

```bash
git add app/web/src/szene2/farben.ts app/web/src/szene2/stimmung.ts app/web/src/szene2/stimmung.test.ts
git commit -m "Entwurf: Gewerkefarben (KOO) und Stimmungen hell/Fokus

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Huelle ableiten

**Files:**
- Create: `app/web/src/szene2/huelle.ts`
- Test: `app/web/src/szene2/huelle.test.ts`

**Interfaces:**
- Consumes: `Welt`, `Rechteck` aus `../typen`.
- Produces:
  - `type V3 = [number, number, number]`
  - `MASSE` (Konstanten, siehe Code)
  - `interface Quader { mitte: V3; groesse: V3 }`
  - `interface Wand { von: [number, number]; bis: [number, number]; normale: [number, number]; laenge: number }`
  - `interface Fenster { mitte: V3; breite: number; hoehe: number; drehungY: number }`
  - `interface GeschossHuelle { geschossId: string; code: string; yUnten: number; hoehe: number; fenster: Fenster[]; band: Quader[] }`
  - `interface Bereich { xMin: number; xMax: number; zMin: number; zMax: number; yMin: number; yMax: number }`
  - `interface Huelle { grundriss: Rechteck[]; waende: Wand[]; geschosse: GeschossHuelle[]; attika: Quader[]; aufbau: Quader | null; platte: Quader; bereich: Bereich }`
  - `waendeVon(r: Rechteck): Wand[]`
  - `fensterMitten(laenge: number): number[]`
  - `wandQuader(w: Wand, yUnten: number, hoehe: number): Quader`
  - `huelle(welt: Welt): Huelle`
  - `imRechteck(r: Rechteck, x: number, z: number): boolean`

- [ ] **Step 1: Failing test schreiben**

`app/web/src/szene2/huelle.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { fensterMitten, huelle, waendeVon, wandQuader } from "./huelle";
import type { Welt } from "../typen";

const WELT: Welt = {
  regelwerkVersion: 1, hash: "x",
  grundriss: [{ x: 0, z: 0, breite: 30, tiefe: 15 }],
  geschosse: [{ id: "g0", code: "EG", yUnten: 0, hoehe: 3 }, { id: "g1", code: "OG1", yUnten: 3, hoehe: 3.5 }],
  einheiten: [
    { id: "e1", geschossId: "g0", bezeichnung: "Technik", art: "technik", rechteck: { x: 0, z: 0, breite: 10, tiefe: 15 }, quelle: "schematisch" },
    { id: "e2", geschossId: "g0", bezeichnung: "Restaurant", art: "gastro", rechteck: { x: 10, z: 0, breite: 20, tiefe: 15 }, quelle: "schematisch" },
    { id: "e3", geschossId: "g1", bezeichnung: "Buero", art: "buero", rechteck: { x: 0, z: 0, breite: 30, tiefe: 15 }, quelle: "schematisch" },
  ],
  symbole: [], hinweise: [],
};
const LEER: Welt = { ...WELT, grundriss: [], geschosse: [], einheiten: [] };

describe("fensterMitten", () => {
  it("verteilt Fenster im Raster 1.5 m mit Rand", () => {
    const m = fensterMitten(30);
    expect(m).toHaveLength(19);
    expect(m[0]).toBeCloseTo(1.5);
    expect(m[18]).toBeCloseTo(28.5);
    expect(fensterMitten(15)).toHaveLength(9);
  });
  it("keine Fenster unter 2 m", () => {
    expect(fensterMitten(1.9)).toEqual([]);
  });
});

describe("waendeVon", () => {
  it("vier Waende mit Aussennormalen", () => {
    const w = waendeVon({ x: 0, z: 0, breite: 30, tiefe: 15 });
    expect(w.map((x) => x.normale)).toEqual([[0, -1], [1, 0], [0, 1], [-1, 0]]);
    expect(w.map((x) => x.laenge)).toEqual([30, 15, 30, 15]);
  });
});

describe("wandQuader", () => {
  it("liegt innen an der Aussenlinie", () => {
    const [sued, ost] = waendeVon({ x: 0, z: 0, breite: 30, tiefe: 15 });
    expect(wandQuader(sued, 3, 0.9)).toEqual({ mitte: [15, 3.45, 0.15], groesse: [30, 0.9, 0.3] });
    expect(wandQuader(ost, 0, 3)).toEqual({ mitte: [29.85, 1.5, 7.5], groesse: [0.3, 3, 15] });
  });
});

describe("huelle", () => {
  const h = huelle(WELT);
  it("keine Fenster vor Technik", () => {
    expect(h.geschosse[0].fenster).toHaveLength(35); // 13 Sued + 0 West + 13 Nord + 9 Ost
    expect(h.geschosse[1].fenster).toHaveLength(56);
    expect(h.geschosse[0].fenster.some((f) => f.mitte[0] < 10)).toBe(false);
  });
  it("Fenster zwischen Bruestung und Sturz, nach aussen gedreht", () => {
    const f = h.geschosse[1].fenster[0];
    expect(f.hoehe).toBeCloseTo(3.5 - 0.9 - 0.5);
    expect(f.mitte[1]).toBeCloseTo(3 + 0.9 + (3.5 - 1.4) / 2);
    expect(f.mitte[2]).toBeLessThan(0); // Suedfassade, leicht vor der Wand
    expect(f.drehungY).toBeCloseTo(Math.PI);
  });
  it("Deckenband nur ab dem zweiten Geschoss", () => {
    expect(h.geschosse[0].band).toHaveLength(0);
    expect(h.geschosse[1].band).toHaveLength(1);
  });
  it("Attika, Dachaufbau ueber Technik, Grundplatte", () => {
    expect(h.attika).toHaveLength(4);
    expect(h.aufbau).toEqual({ mitte: [5, 6.5 + 0.75, 7.5], groesse: [4, 1.5, 4] });
    expect(h.platte).toEqual({ mitte: [15, -0.15, 7.5], groesse: [38, 0.3, 23] });
    expect(h.bereich).toEqual({ xMin: 0, xMax: 30, zMin: 0, zMax: 15, yMin: 0, yMax: 6.5 });
  });
  it("leere Welt: nur Grundplatte", () => {
    const l = huelle(LEER);
    expect(l.waende).toEqual([]);
    expect(l.geschosse).toEqual([]);
    expect(l.attika).toEqual([]);
    expect(l.aufbau).toBeNull();
    expect(l.platte.groesse).toEqual([18, 0.3, 18]);
  });
});
```

- [ ] **Step 2: Test laufen lassen, muss fehlschlagen**

Run: `cd app/web && npx vitest run src/szene2/huelle.test.ts`
Expected: FAIL, Modul `./huelle` nicht gefunden.

- [ ] **Step 3: Implementieren**

`app/web/src/szene2/huelle.ts`:

```ts
import type { Rechteck, Welt } from "../typen";

export type V3 = [number, number, number];

/** Gestaltungsmasse in m [A]; Abstimmung in der Korrekturrunde. */
export const MASSE = {
  raster: 1.5, fensterBreite: 1.2, bruestung: 0.9, sturz: 0.5, minFassade: 2, randFenster: 1,
  wand: 0.3, band: 0.25, bandUeberstand: 0.1, attika: 0.4, platteHoehe: 0.3, platteRand: 4,
  aufbauHoehe: 1.5, aufbauMax: 4, fensterAbstand: 0.02,
} as const;

export interface Quader { mitte: V3; groesse: V3 }
export interface Wand { von: [number, number]; bis: [number, number]; normale: [number, number]; laenge: number }
export interface Fenster { mitte: V3; breite: number; hoehe: number; drehungY: number }
export interface GeschossHuelle { geschossId: string; code: string; yUnten: number; hoehe: number; fenster: Fenster[]; band: Quader[] }
export interface Bereich { xMin: number; xMax: number; zMin: number; zMax: number; yMin: number; yMax: number }
export interface Huelle {
  grundriss: Rechteck[]; waende: Wand[]; geschosse: GeschossHuelle[]; attika: Quader[]; aufbau: Quader | null; platte: Quader; bereich: Bereich;
}

export function imRechteck(r: Rechteck, x: number, z: number): boolean {
  return x >= r.x && x <= r.x + r.breite && z >= r.z && z <= r.z + r.tiefe;
}

/** Vier Aussenwaende im Uhrzeigersinn (Sicht von oben): Sued, Ost, Nord, West. Mehrere Rechtecke: innere Waende entstehen doppelt [A]. */
export function waendeVon(r: Rechteck): Wand[] {
  const { x, z, breite: b, tiefe: t } = r;
  return [
    { von: [x, z], bis: [x + b, z], normale: [0, -1], laenge: b },
    { von: [x + b, z], bis: [x + b, z + t], normale: [1, 0], laenge: t },
    { von: [x + b, z + t], bis: [x, z + t], normale: [0, 1], laenge: b },
    { von: [x, z + t], bis: [x, z], normale: [-1, 0], laenge: t },
  ];
}

/** Abstaende der Fenstermitten vom Wandanfang. */
export function fensterMitten(laenge: number): number[] {
  if (laenge < MASSE.minFassade) return [];
  const n = Math.floor((laenge - MASSE.randFenster) / MASSE.raster);
  const start = (laenge - n * MASSE.raster) / 2 + MASSE.raster / 2;
  return Array.from({ length: n }, (_, i) => start + i * MASSE.raster);
}

/** Wandkoerper innen an der Aussenlinie, von yUnten bis yUnten + hoehe. */
export function wandQuader(w: Wand, yUnten: number, hoehe: number): Quader {
  const mx = (w.von[0] + w.bis[0]) / 2 - (w.normale[0] * MASSE.wand) / 2;
  const mz = (w.von[1] + w.bis[1]) / 2 - (w.normale[1] * MASSE.wand) / 2;
  const entlangX = w.normale[0] === 0;
  return {
    mitte: [mx, yUnten + hoehe / 2, mz],
    groesse: entlangX ? [w.laenge, hoehe, MASSE.wand] : [MASSE.wand, hoehe, w.laenge],
  };
}

function bereichVon(welt: Welt): Bereich {
  const xs = welt.grundriss.flatMap((r) => [r.x, r.x + r.breite]);
  const zs = welt.grundriss.flatMap((r) => [r.z, r.z + r.tiefe]);
  const ys = welt.geschosse.flatMap((g) => [g.yUnten, g.yUnten + g.hoehe]);
  return {
    xMin: xs.length ? Math.min(...xs) : 0, xMax: xs.length ? Math.max(...xs) : 10,
    zMin: zs.length ? Math.min(...zs) : 0, zMax: zs.length ? Math.max(...zs) : 10,
    yMin: ys.length ? Math.min(...ys) : 0, yMax: ys.length ? Math.max(...ys) : 0,
  };
}

export function huelle(welt: Welt): Huelle {
  const bereich = bereichVon(welt);
  const hatGeschosse = welt.geschosse.length > 0;
  const waende = hatGeschosse ? welt.grundriss.flatMap(waendeVon) : [];
  const sortiert = [...welt.geschosse].sort((a, b) => a.yUnten - b.yUnten);

  const geschosse: GeschossHuelle[] = sortiert.map((g, index) => {
    const technik = welt.einheiten.filter((e) => e.geschossId === g.id && e.art === "technik").map((e) => e.rechteck);
    const hoehe = g.hoehe - MASSE.bruestung - MASSE.sturz;
    const fenster: Fenster[] = hoehe <= 0 ? [] : waende.flatMap((w) => fensterMitten(w.laenge).flatMap((d) => {
      const px = w.von[0] + ((w.bis[0] - w.von[0]) * d) / w.laenge;
      const pz = w.von[1] + ((w.bis[1] - w.von[1]) * d) / w.laenge;
      const innenX = px - w.normale[0] * 0.5, innenZ = pz - w.normale[1] * 0.5;
      if (technik.some((r) => imRechteck(r, innenX, innenZ))) return [];
      return [{
        mitte: [px + w.normale[0] * MASSE.fensterAbstand, g.yUnten + MASSE.bruestung + hoehe / 2, pz + w.normale[1] * MASSE.fensterAbstand] as V3,
        breite: MASSE.fensterBreite, hoehe, drehungY: Math.atan2(w.normale[0], w.normale[1]),
      }];
    }));
    const band: Quader[] = index === 0 ? [] : welt.grundriss.map((r) => ({
      mitte: [r.x + r.breite / 2, g.yUnten, r.z + r.tiefe / 2] as V3,
      groesse: [r.breite + 2 * MASSE.bandUeberstand, MASSE.band, r.tiefe + 2 * MASSE.bandUeberstand] as V3,
    }));
    return { geschossId: g.id, code: g.code, yUnten: g.yUnten, hoehe: g.hoehe, fenster, band };
  });

  const attika: Quader[] = waende.map((w) => {
    const q = wandQuader(w, bereich.yMax, MASSE.attika);
    return q;
  });

  const technikEinheit = hatGeschosse ? welt.einheiten.find((e) => e.art === "technik") : undefined;
  let aufbau: Quader | null = null;
  if (technikEinheit) {
    const r = technikEinheit.rechteck;
    const s = Math.min(MASSE.aufbauMax, Math.min(r.breite, r.tiefe) * 0.5);
    aufbau = { mitte: [r.x + r.breite / 2, bereich.yMax + MASSE.aufbauHoehe / 2, r.z + r.tiefe / 2], groesse: [s, MASSE.aufbauHoehe, s] };
  }

  const platte: Quader = {
    mitte: [(bereich.xMin + bereich.xMax) / 2, bereich.yMin - MASSE.platteHoehe / 2, (bereich.zMin + bereich.zMax) / 2],
    groesse: [bereich.xMax - bereich.xMin + 2 * MASSE.platteRand, MASSE.platteHoehe, bereich.zMax - bereich.zMin + 2 * MASSE.platteRand],
  };

  return { grundriss: hatGeschosse ? welt.grundriss : [], waende, geschosse, attika, aufbau, platte, bereich };
}
```

Pruefrechnung fuer den Test: Platte 30 + 8 = 38, 15 + 8 = 23, Mitte y = 0 − 0.15. Leere Welt: Bereich 0..10 → 10 + 8 = 18. Aufbau: Technik 10 x 15 → min(4, 5) = 4.

- [ ] **Step 4: Test laufen lassen, muss bestehen**

Run: `cd app/web && npx vitest run src/szene2/huelle.test.ts`
Expected: PASS (9 Tests). Falls `toEqual` an Gleitkomma scheitert (z. B. `29.85`), die Erwartung mit `toBeCloseTo` je Komponente pruefen statt die Implementierung zu verbiegen.

- [ ] **Step 5: Commit**

```bash
git add app/web/src/szene2/huelle.ts app/web/src/szene2/huelle.test.ts
git commit -m "Entwurf: Huelle aus der Welt ableiten (Waende, Fenster, Attika, Grundplatte)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Leitungen und Flaechenheizungs-Muster

**Files:**
- Create: `app/web/src/szene2/leitungen.ts`
- Test: `app/web/src/szene2/leitungen.test.ts`

**Interfaces:**
- Consumes: `Welt`, `KatalogEintrag`, `Rechteck` aus `../typen`; `V3` aus `./huelle`.
- Produces:
  - `BODEN = 0.05`, `VERSATZ = 0.15`
  - `interface Leitung { art: "haupt" | "verteil"; von: string; nach: string; punkte: V3[]; geschossIds: string[] }` (`von` = Symbol-Schluessel; `nach` = Verteiler-Schluessel bei "haupt", Einheit-ID bei "verteil")
  - `geschossBeiY(welt: Welt, y: number): string | null`
  - `leitungen(welt: Welt, katalog: KatalogEintrag[]): Leitung[]`
  - `schlange(r: Rechteck, y: number, abstand?: number, rand?: number): V3[]`

- [ ] **Step 1: Failing test schreiben**

`app/web/src/szene2/leitungen.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { BODEN, VERSATZ, geschossBeiY, leitungen, schlange } from "./leitungen";
import type { KatalogEintrag, Welt, WeltSymbol } from "../typen";
import type { V3 } from "./huelle";

const KATALOG: KatalogEintrag[] = [
  { id: "heizung.waermepumpe", name: "Waermepumpe", bereich: "zentrale" },
  { id: "heizung.speicher", name: "Speicher", bereich: "zentrale" },
  { id: "heizung.verteiler", name: "Heizungsverteiler", bereich: "verteilung" },
  { id: "heizung.heizkoerper", name: "Heizkoerper", bereich: "einheit" },
];
const sym = (schluessel: string, katalogId: string, x: number, y: number, z: number, versorgt: string[] = []): WeltSymbol => ({
  schluessel, katalogId, hersteller: null, typ: null, bauteilIds: [schluessel], mengeSumme: 1, mengeUnbekannt: false,
  status: "bestaetigt", position: { x, y, z }, versorgt,
});
const WELT: Welt = {
  regelwerkVersion: 1, hash: "x",
  grundriss: [{ x: 0, z: 0, breite: 30, tiefe: 15 }],
  geschosse: [{ id: "g0", code: "EG", yUnten: 0, hoehe: 3 }, { id: "g1", code: "OG1", yUnten: 3, hoehe: 3.5 }],
  einheiten: [
    { id: "e1", geschossId: "g0", bezeichnung: "Technik", art: "technik", rechteck: { x: 0, z: 0, breite: 10, tiefe: 15 }, quelle: "schematisch" },
    { id: "e2", geschossId: "g0", bezeichnung: "Restaurant", art: "gastro", rechteck: { x: 10, z: 0, breite: 20, tiefe: 15 }, quelle: "schematisch" },
    { id: "e3", geschossId: "g1", bezeichnung: "Buero", art: "buero", rechteck: { x: 0, z: 0, breite: 30, tiefe: 15 }, quelle: "schematisch" },
  ],
  symbole: [
    sym("s0", "heizung.speicher", 2, 0, 2),
    sym("s1", "heizung.waermepumpe", 5, 0, 7.5),
    sym("s3", "heizung.verteiler", 8, 0, 3, ["e2", "e3"]),
    sym("s4", "heizung.heizkoerper", 15, 3, 2),
  ],
  hinweise: [],
};

const achsparallel = (p: V3[]) => p.slice(1).every((q, i) => q.filter((v, k) => Math.abs(v - p[i][k]) > 1e-9).length === 1);

describe("geschossBeiY", () => {
  it("ordnet nach yUnten zu", () => {
    expect(geschossBeiY(WELT, 0)).toBe("g0");
    expect(geschossBeiY(WELT, 2.9)).toBe("g0");
    expect(geschossBeiY(WELT, 3)).toBe("g1");
    expect(geschossBeiY({ ...WELT, geschosse: [] }, 0)).toBeNull();
  });
});

describe("leitungen", () => {
  const l = leitungen(WELT, KATALOG);
  const haupt = l.filter((x) => x.art === "haupt");
  const verteil = l.filter((x) => x.art === "verteil");
  it("eine Hauptleitung ab dem Erzeuger, zwei Verteilleitungen", () => {
    expect(haupt).toHaveLength(1);
    expect(verteil).toHaveLength(2);
    expect(haupt[0].von).toBe("s1"); // Waermepumpe, nicht Speicher
    expect(haupt[0].nach).toBe("s3");
    expect(haupt[0].punkte[0]).toEqual([5, BODEN, 7.5]);
    expect(haupt[0].punkte.at(-1)).toEqual([8, BODEN, 3]);
  });
  it("Verteilleitungen enden in der Einheitsmitte auf deren Boden", () => {
    expect(verteil.map((x) => x.nach)).toEqual(["e2", "e3"]);
    expect(verteil[0].punkte.at(-1)).toEqual([20, BODEN, 7.5]);
    expect(verteil[1].punkte.at(-1)).toEqual([15, 3 + BODEN, 7.5]);
    expect(verteil[1].geschossIds).toEqual(["g0", "g1"]);
  });
  it("nur achsparallele Segmente", () => {
    for (const x of l) expect(achsparallel(x.punkte)).toBe(true);
  });
  it("parallele Laeufe mit Versatz", () => {
    const zLauf = (p: V3[]) => p.find((q, i) => i > 0 && Math.abs(q[0] - p[i - 1][0]) > 1e-9)![2];
    expect(zLauf(verteil[1].punkte) - zLauf(verteil[0].punkte)).toBeCloseTo(VERSATZ);
  });
  it("ohne Zentrale keine Hauptleitung, ohne versorgt keine Verteilleitung", () => {
    const ohne = { ...WELT, symbole: WELT.symbole.filter((s) => s.schluessel !== "s0" && s.schluessel !== "s1") };
    expect(leitungen(ohne, KATALOG).every((x) => x.art === "verteil")).toBe(true);
    const leer = { ...WELT, symbole: WELT.symbole.map((s) => ({ ...s, versorgt: [] })) };
    expect(leitungen(leer, KATALOG).filter((x) => x.art === "verteil")).toHaveLength(0);
  });
  it("unbekannte Einheit wird uebersprungen", () => {
    const w = { ...WELT, symbole: WELT.symbole.map((s) => (s.schluessel === "s3" ? { ...s, versorgt: ["fehlt"] } : s)) };
    expect(leitungen(w, KATALOG).filter((x) => x.art === "verteil")).toHaveLength(0);
  });
});

describe("schlange", () => {
  it("maeandert innerhalb des eingerueckten Rechtecks", () => {
    const p = schlange({ x: 0, z: 0, breite: 4, tiefe: 3 }, 1, 0.6, 0.5);
    expect(p[0]).toEqual([0.5, 1, 0.5]);
    expect(p[1]).toEqual([3.5, 1, 0.5]);
    expect(p[2][0]).toBe(3.5);
    expect(p.every(([x, , z]) => x >= 0.5 && x <= 3.5 && z >= 0.5 && z <= 2.5 + 1e-9)).toBe(true);
    expect(achsparallel(p)).toBe(true);
  });
  it("zu kleines Rechteck ergibt keine Punkte", () => {
    expect(schlange({ x: 0, z: 0, breite: 0.8, tiefe: 3 }, 0)).toEqual([]);
  });
});
```

- [ ] **Step 2: Test laufen lassen, muss fehlschlagen**

Run: `cd app/web && npx vitest run src/szene2/leitungen.test.ts`
Expected: FAIL, Modul `./leitungen` nicht gefunden.

- [ ] **Step 3: Implementieren**

`app/web/src/szene2/leitungen.ts`:

```ts
import type { KatalogEintrag, Rechteck, Welt, WeltSymbol } from "../typen";
import type { V3 } from "./huelle";

/** Leitungen liegen knapp ueber dem Boden; parallele Laeufe erhalten Versatz. Verlauf schematisch. */
export const BODEN = 0.05;
export const VERSATZ = 0.15;
const ERZEUGER = new Set(["heizung.waermepumpe", "heizung.gaskessel", "heizung.oelkessel", "heizung.fernwaerme_uebergabe"]);

export interface Leitung { art: "haupt" | "verteil"; von: string; nach: string; punkte: V3[]; geschossIds: string[] }

export function geschossBeiY(welt: Welt, y: number): string | null {
  const passend = [...welt.geschosse].sort((a, b) => a.yUnten - b.yUnten).filter((g) => g.yUnten <= y + 1e-6);
  return passend.length ? passend[passend.length - 1].id : (welt.geschosse.length ? [...welt.geschosse].sort((a, b) => a.yUnten - b.yUnten)[0].id : null);
}

const gleich = (a: V3, b: V3) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);

/** Rechtwinklig: Stich um d in z, senkrecht, entlang x, entlang z. */
function route(start: V3, ziel: V3, d: number): V3[] {
  const roh: V3[] = [
    start,
    [start[0], start[1], start[2] + d],
    [start[0], ziel[1], start[2] + d],
    [ziel[0], ziel[1], start[2] + d],
    ziel,
  ];
  return roh.filter((p, i) => i === 0 || !gleich(p, roh[i - 1]));
}

const eindeutig = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => x !== null))];
const nachSchluessel = (a: WeltSymbol, b: WeltSymbol) => (a.schluessel < b.schluessel ? -1 : a.schluessel > b.schluessel ? 1 : 0);

export function leitungen(welt: Welt, katalog: KatalogEintrag[]): Leitung[] {
  const bereich = new Map(katalog.map((k) => [k.id, k.bereich]));
  const symbole = [...welt.symbole].sort(nachSchluessel);
  const zentralen = symbole.filter((s) => bereich.get(s.katalogId) === "zentrale");
  const zentrale = zentralen.find((s) => ERZEUGER.has(s.katalogId)) ?? zentralen[0];
  const verteiler = symbole.filter((s) => bereich.get(s.katalogId) === "verteilung");
  const yUnten = new Map(welt.geschosse.map((g) => [g.id, g.yUnten]));
  const punkt = (s: WeltSymbol): V3 => [s.position.x, s.position.y + BODEN, s.position.z];
  const ergebnis: Leitung[] = [];

  if (zentrale) verteiler.forEach((v, k) => {
    ergebnis.push({
      art: "haupt", von: zentrale.schluessel, nach: v.schluessel,
      punkte: route(punkt(zentrale), punkt(v), k * VERSATZ),
      geschossIds: eindeutig([geschossBeiY(welt, zentrale.position.y), geschossBeiY(welt, v.position.y)]),
    });
  });

  for (const v of verteiler) {
    v.versorgt.forEach((einheitId, k) => {
      const e = welt.einheiten.find((x) => x.id === einheitId);
      const y = e ? yUnten.get(e.geschossId) : undefined;
      if (!e || y === undefined) return;
      const r = e.rechteck;
      ergebnis.push({
        art: "verteil", von: v.schluessel, nach: e.id,
        punkte: route(punkt(v), [r.x + r.breite / 2, y + BODEN, r.z + r.tiefe / 2], k * VERSATZ),
        geschossIds: eindeutig([geschossBeiY(welt, v.position.y), e.geschossId]),
      });
    });
  }
  return ergebnis;
}

/** Maeander fuer FBH/TABS: Bahnen entlang x im Abstand `abstand`, eingerueckt um `rand`. */
export function schlange(r: Rechteck, y: number, abstand = 0.6, rand = 0.5): V3[] {
  const x0 = r.x + rand, x1 = r.x + r.breite - rand, z0 = r.z + rand, z1 = r.z + r.tiefe - rand;
  if (x1 <= x0 || z1 < z0) return [];
  const punkte: V3[] = [];
  for (let i = 0, z = z0; z <= z1 + 1e-9; i++, z = z0 + i * abstand) {
    if (i % 2 === 0) punkte.push([x0, y, z], [x1, y, z]);
    else punkte.push([x1, y, z], [x0, y, z]);
  }
  return punkte;
}
```

Hinweis zu `achsparallel` im Test: zwischen zwei Bahnen der Schlange aendert sich nur z (gleiches x am Wendepunkt), also achsparallel.

- [ ] **Step 4: Test laufen lassen, muss bestehen**

Run: `cd app/web && npx vitest run src/szene2/leitungen.test.ts`
Expected: PASS (9 Tests).

- [ ] **Step 5: Commit**

```bash
git add app/web/src/szene2/leitungen.ts app/web/src/szene2/leitungen.test.ts
git commit -m "Entwurf: schematische Versorgungsleitungen und FBH-Muster ableiten

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Plastische Uebersicht als Seite "Entwurf"

Sichtbares Ergebnis: Knopf "Entwurf" in der Ansicht oeffnet eine Vollbild-3D-Seite mit plastischem Gebaeude (Waende, Fenster, Baender, Attika, Dachaufbau, Grundplatte), weichen Schatten, Ambient Occlusion und der Gebaeudekarte links mit Schalter "reduziert".

**Files:**
- Create: `app/web/src/szene2/materialien.ts`
- Create: `app/web/src/szene2/schrift.tsx`
- Create: `app/web/src/szene2/Welt3D.tsx`
- Create: `app/web/src/karten/GebaeudeKarte.tsx`
- Create: `app/web/src/seiten/Entwurf.tsx`
- Modify: `app/web/src/App.tsx` (ganze Datei unten)
- Modify: `app/web/src/stil.css` (Anhang unten)

**Interfaces:**
- Consumes: `huelle`, `wandQuader`, `MASSE`, `Huelle`, `Quader`, `Fenster`, `V3` (Task 2); `geschossBeiY` (Task 3); `HELL`, `FOKUS`, `mische`, `mischeFarbe` (Task 1); `FASSADE`, `GEWERK` (Task 1); `uebersicht` aus `../panel/daten` (bestehend).
- Produces:
  - `erzeugeMaterialien(): Materialien`, `entsorgeMaterialien(m: Materialien): void`, `type Materialien` mit Feldern `wand, umgebung, platte, band, fenster, dach, boden[], geraet, geraetVorschlag, geraetAuswahl, leitung, leitungAktiv, leitungBlass, flaeche, trennwand`
  - `Schild({ text, position, groesse })` (Sprite), `BodenSchrift({ text, position, breite })` (flach)
  - `Welt3D(props: Welt3DProps)` mit `interface Welt3DProps { welt: Welt; katalog: KatalogEintrag[]; fokusId: string | null; auswahl: string | null; onAuswahl: (s: string | null) => void; reduziert: boolean; karteRef: RefObject<HTMLDivElement | null> }`
  - `Welt3D` rendert `children`-freien Inhalt; Task 5 fuegt `<FokusInhalt ... />` an der markierten Stelle ein.
  - `GebaeudeKarte({ name, welt, beschreibung, reduziert, onReduziert })`
  - `Entwurf({ gebaeudeId, name, onAbgelaufen })`

- [ ] **Step 1: Materialien anlegen**

`app/web/src/szene2/materialien.ts`:

```ts
import * as THREE from "three";
import { FASSADE, GEWERK } from "./farben";

const std = (farbe: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color: farbe, roughness: 0.85, metalness: 0, ...extra });

/** Gemeinsame Materialien; Stimmung aendert umgebung/platte/leitung zur Laufzeit. */
export function erzeugeMaterialien() {
  const rot = GEWERK.heizung;
  return {
    wand: std(FASSADE.wand),
    umgebung: std(FASSADE.wand),
    platte: std(FASSADE.platte, { roughness: 1 }),
    band: std(FASSADE.band, { roughness: 0.6 }),
    dach: std(FASSADE.platte, { roughness: 0.9 }),
    fenster: std(FASSADE.fenster, { roughness: 0.15, metalness: 0.35, envMapIntensity: 1.2 }),
    boden: FASSADE.boden.map((f) => std(f)),
    trennwand: std(FASSADE.wand, { roughness: 0.7 }),
    geraet: std(rot.geraet, { roughness: 0.55, metalness: 0.2 }),
    geraetVorschlag: std(rot.geraet, { transparent: true, opacity: 0.45, depthWrite: false }),
    geraetAuswahl: std(rot.geraet, { emissive: rot.leitung, emissiveIntensity: 0.7, roughness: 0.4 }),
    leitung: std(rot.leitung, { emissive: rot.leitung, emissiveIntensity: 0, roughness: 0.35 }),
    leitungAktiv: std(rot.leitung, { emissive: rot.leitung, emissiveIntensity: 1, roughness: 0.3 }),
    leitungBlass: std(rot.leitung, { transparent: true, opacity: 0.25, depthWrite: false }),
    flaeche: new THREE.LineBasicMaterial({ color: rot.leitung, transparent: true, opacity: 0.45 }),
  };
}
export type Materialien = ReturnType<typeof erzeugeMaterialien>;

export function entsorgeMaterialien(m: Materialien): void {
  for (const wert of Object.values(m)) for (const x of Array.isArray(wert) ? wert : [wert]) x.dispose();
}
```

- [ ] **Step 2: Schrift anlegen**

`app/web/src/szene2/schrift.tsx`:

```tsx
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { V3 } from "./huelle";

function textur(text: string, farbe: string) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 96;
  const g = c.getContext("2d")!;
  g.font = "600 44px system-ui, sans-serif"; g.fillStyle = farbe; g.textBaseline = "middle";
  g.fillText(text, 8, 48);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Beschriftung, die immer zur Kamera zeigt. groesse = Hoehe in m. */
export function Schild({ text, position, groesse }: { text: string; position: V3; groesse: number }) {
  const t = useMemo(() => textur(text, "#334155"), [text]);
  useEffect(() => () => t.dispose(), [t]);
  return (
    <sprite position={position} scale={[groesse * (512 / 96), groesse, 1]}>
      <spriteMaterial map={t} transparent depthTest={false} />
    </sprite>
  );
}

/** Flache Schrift auf dem Boden; breite = Breite in m. */
export function BodenSchrift({ text, position, breite }: { text: string; position: V3; breite: number }) {
  const t = useMemo(() => textur(text, "#475569"), [text]);
  useEffect(() => () => t.dispose(), [t]);
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[breite, breite * (96 / 512)]} />
      <meshBasicMaterial map={t} transparent depthWrite={false} />
    </mesh>
  );
}
```

- [ ] **Step 3: Welt3D anlegen**

`app/web/src/szene2/Welt3D.tsx`:

```tsx
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import type { KatalogEintrag, Welt } from "../typen";
import { FASSADE } from "./farben";
import { MASSE, huelle as huelleVon, wandQuader, type Bereich, type Fenster, type Huelle, type Quader, type V3 } from "./huelle";
import { geschossBeiY } from "./leitungen";
import { entsorgeMaterialien, erzeugeMaterialien, type Materialien } from "./materialien";
import { Schild } from "./schrift";
import { FOKUS, HELL, mische, mischeFarbe, type Stimmung } from "./stimmung";

export interface Welt3DProps {
  welt: Welt; katalog: KatalogEintrag[]; fokusId: string | null; auswahl: string | null;
  onAuswahl: (s: string | null) => void; reduziert: boolean; karteRef: RefObject<HTMLDivElement | null>;
}

const EBENE = new THREE.PlaneGeometry(1, 1);

/** Prototyp nach Spec 2026-11-12: plastische Uebersicht, Fokusmodus je Geschoss. Zeichnen nur bei Aenderung. */
export function Welt3D(props: Welt3DProps) {
  const { welt, fokusId, onAuswahl, reduziert, auswahl, karteRef } = props;
  const h = useMemo(() => huelleVon(welt), [welt]);
  const mat = useMemo(() => erzeugeMaterialien(), []);
  useEffect(() => () => entsorgeMaterialien(mat), [mat]);
  const fokus = welt.geschosse.find((g) => g.id === fokusId) ?? null;
  const zielY = fokus ? fokus.yUnten + 1 : (h.bereich.yMin + h.bereich.yMax) / 2;
  const symbol = auswahl ? welt.symbole.find((s) => s.schluessel === auswahl) : undefined;
  const ankerPunkt: V3 | null = symbol ? [symbol.position.x, symbol.position.y + 1, symbol.position.z] : null;
  return (
    <Canvas className="szene" orthographic shadows="soft" frameloop="demand" dpr={[1, 1.75]}
      gl={{ antialias: true }} onPointerMissed={() => onAuswahl(null)}>
      <Licht bereich={h.bereich} reduziert={reduziert} ziel={fokus ? 1 : 0} mat={mat} />
      <Umgebung />
      <Kamera bereich={h.bereich} zielY={zielY} />
      <Gebaeude h={h} fokus={fokus} mat={mat} />
      {!fokus && <GeschossSchilder welt={welt} h={h} />}
      {/* FOKUS-INHALT (Task 5) */}
      <Anker punkt={ankerPunkt} ziel={karteRef} />
      <Nachbearbeitung reduziert={reduziert} />
    </Canvas>
  );
}

function Quaderz({ q, m, schatten = true }: { q: Quader; m: THREE.Material; schatten?: boolean }) {
  return (
    <mesh position={q.mitte} material={m} castShadow={schatten} receiveShadow>
      <boxGeometry args={q.groesse} />
    </mesh>
  );
}

function Gebaeude({ h, fokus, mat }: { h: Huelle; fokus: { yUnten: number } | null; mat: Materialien }) {
  const gleich = (a: number, b: number) => Math.abs(a - b) < 1e-6;
  const sichtbar = h.geschosse.filter((g) => !fokus || g.yUnten <= fokus.yUnten + 1e-6);
  const fenster = sichtbar.filter((g) => !fokus || g.yUnten < fokus.yUnten - 1e-6).flatMap((g) => g.fenster);
  const yMax = h.bereich.yMax;
  return (
    <>
      <Quaderz q={h.platte} m={mat.platte} schatten={false} />
      {sichtbar.map((g) => {
        const geschnitten = !!fokus && gleich(g.yUnten, fokus.yUnten);
        const hoehe = geschnitten ? MASSE.bruestung : g.hoehe;
        const m = geschnitten ? mat.wand : mat.umgebung;
        return (
          <group key={g.geschossId}>
            {h.grundriss.map((r, i) => (
              <Quaderz key={`d${i}`} m={m} q={{ mitte: [r.x + r.breite / 2, g.yUnten - 0.1, r.z + r.tiefe / 2], groesse: [r.breite, 0.2, r.tiefe] }} />
            ))}
            {h.waende.map((w, i) => <Quaderz key={`w${i}`} m={m} q={wandQuader(w, g.yUnten, hoehe)} />)}
            {!fokus && g.band.map((q, i) => <Quaderz key={`b${i}`} m={mat.band} q={q} />)}
          </group>
        );
      })}
      <FensterInstanzen key={fenster.length} fenster={fenster} m={mat.fenster} />
      {!fokus && h.geschosse.length > 0 && (
        <>
          {h.grundriss.map((r, i) => (
            <Quaderz key={`dach${i}`} m={mat.dach} q={{ mitte: [r.x + r.breite / 2, yMax - 0.1, r.z + r.tiefe / 2], groesse: [r.breite, 0.2, r.tiefe] }} />
          ))}
          {h.attika.map((q, i) => <Quaderz key={`a${i}`} m={mat.umgebung} q={q} />)}
          {h.aufbau && <Quaderz m={mat.umgebung} q={h.aufbau} />}
        </>
      )}
    </>
  );
}

function FensterInstanzen({ fenster, m }: { fenster: Fenster[]; m: THREE.Material }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const { invalidate } = useThree();
  useLayoutEffect(() => {
    const im = ref.current;
    if (!im) return;
    const o = new THREE.Object3D();
    fenster.forEach((f, i) => {
      o.position.set(...f.mitte); o.rotation.set(0, f.drehungY, 0); o.scale.set(f.breite, f.hoehe, 1);
      o.updateMatrix(); im.setMatrixAt(i, o.matrix);
    });
    im.count = fenster.length;
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    invalidate();
  }, [fenster, invalidate]);
  return <instancedMesh ref={ref} args={[EBENE, m, Math.max(fenster.length, 1)]} receiveShadow />;
}

function GeschossSchilder({ welt, h }: { welt: Welt; h: Huelle }) {
  return (
    <>
      {h.geschosse.map((g) => {
        const n = welt.symbole.filter((s) => geschossBeiY(welt, s.position.y) === g.geschossId).length;
        return (
          <Schild key={g.geschossId} text={`${g.code} · ${n} ${n === 1 ? "Bauteil" : "Bauteile"}`} groesse={0.8}
            position={[h.bereich.xMax + 3.5, g.yUnten + g.hoehe / 2, (h.bereich.zMin + h.bereich.zMax) / 2]} />
        );
      })}
    </>
  );
}

const radiusVon = (b: Bereich) => Math.max(Math.hypot((b.xMax - b.xMin) / 2, (b.yMax - b.yMin) / 2, (b.zMax - b.zMin) / 2), 5);

/** Sonne mit weichem Schatten, Umgebungslicht, Stimmungs-Ueberblendung (ca. 400 ms). */
function Licht({ bereich, reduziert, ziel, mat }: { bereich: Bereich; reduziert: boolean; ziel: 0 | 1; mat: Materialien }) {
  const { scene, invalidate } = useThree();
  const r = radiusVon(bereich);
  const cx = (bereich.xMin + bereich.xMax) / 2, cz = (bereich.zMin + bereich.zMax) / 2;
  const sonne = useMemo(() => {
    const l = new THREE.DirectionalLight("#ffffff", HELL.sonne);
    l.shadow.mapSize.set(2048, 2048);
    l.shadow.radius = 6;
    l.shadow.bias = -0.0004;
    return l;
  }, []);
  const umgebung = useMemo(() => new THREE.AmbientLight("#ffffff", HELL.umgebung), []);
  const hintergrund = useMemo(() => new THREE.Color(), []);
  useLayoutEffect(() => {
    sonne.position.set(cx - r * 0.8, bereich.yMax + r * 1.6, cz + r * 1.1);
    sonne.target.position.set(cx, bereich.yMin, cz);
    const k = sonne.shadow.camera;
    k.left = -r * 1.6; k.right = r * 1.6; k.top = r * 1.6; k.bottom = -r * 1.6; k.near = 0.5; k.far = r * 6;
    k.updateProjectionMatrix();
    sonne.castShadow = !reduziert;
    invalidate();
  }, [sonne, cx, cz, r, bereich.yMax, bereich.yMin, reduziert, invalidate]);

  const t = useRef<number>(ziel);
  const anwenden = (s: Stimmung) => {
    scene.background = hintergrund.set(s.hintergrund);
    umgebung.intensity = s.umgebung;
    sonne.intensity = s.sonne;
    mat.umgebung.color.set(s.gebaeude);
    mat.dach.color.set(mischeFarbe(FASSADE.platte, s.hintergrund, s.abblenden));
    mat.platte.color.set(mischeFarbe(FASSADE.platte, s.hintergrund, s.abblenden));
    mat.leitung.emissiveIntensity = s.leuchten;
    mat.leitungAktiv.emissiveIntensity = s.leuchten + 1;
  };
  useLayoutEffect(() => { anwenden(mische(HELL, FOKUS, t.current)); invalidate(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { invalidate(); }, [ziel, invalidate]);
  useFrame((_, dt) => {
    if (t.current === ziel) return;
    const schritt = Math.min(dt, 1 / 30) / 0.4;
    t.current = ziel > t.current ? Math.min(ziel, t.current + schritt) : Math.max(ziel, t.current - schritt);
    anwenden(mische(HELL, FOKUS, t.current));
    invalidate();
  });
  return (
    <>
      <primitive object={sonne} />
      <primitive object={sonne.target} />
      <primitive object={umgebung} />
    </>
  );
}

/** Weiche Umgebungsbeleuchtung ohne externe Datei (RoomEnvironment). */
function Umgebung() {
  const { gl, scene, invalidate } = useThree();
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.5;
    pm.dispose();
    invalidate();
    return () => { scene.environment = null; env.dispose(); };
  }, [gl, scene, invalidate]);
  return null;
}

/** Isometrische Orthokamera, Orbit; Ziel-Hoehe faehrt sanft zum gewaehlten Geschoss. */
function Kamera({ bereich, zielY }: { bereich: Bereich; zielY: number }) {
  const { camera, gl, size, invalidate } = useThree();
  const steuerung = useRef<OrbitControls | null>(null);
  const ziel = useRef(zielY);
  ziel.current = zielY;
  useEffect(() => {
    const r = radiusVon(bereich);
    const cx = (bereich.xMin + bereich.xMax) / 2, cz = (bereich.zMin + bereich.zMax) / 2, cy = ziel.current;
    const k = camera as THREE.OrthographicCamera;
    k.position.set(cx + r * 2, cy + r * 1.7, cz + r * 2);
    k.near = 0.1; k.far = r * 20;
    k.zoom = Math.min(size.width, size.height) / (r * 2.2);
    k.lookAt(cx, cy, cz);
    k.updateProjectionMatrix();
    const s = new OrbitControls(k, gl.domElement);
    s.target.set(cx, cy, cz);
    s.maxPolarAngle = Math.PI / 2 - 0.05;
    s.minZoom = k.zoom / 4; s.maxZoom = k.zoom * 8;
    s.update();
    const neu = () => invalidate();
    s.addEventListener("change", neu);
    steuerung.current = s;
    invalidate();
    return () => { s.removeEventListener("change", neu); s.dispose(); steuerung.current = null; };
  }, [bereich, camera, gl, size.width, size.height, invalidate]);
  useEffect(() => { invalidate(); }, [zielY, invalidate]);
  useFrame(() => {
    const s = steuerung.current;
    if (!s) return;
    const dy = ziel.current - s.target.y;
    if (Math.abs(dy) < 0.01) return;
    const schritt = dy * 0.18;
    s.target.y += schritt; camera.position.y += schritt;
    s.update();
    invalidate();
  });
  return null;
}

/** Schiebt die HTML-Bauteilkarte an den projizierten 3D-Punkt. */
function Anker({ punkt, ziel }: { punkt: V3 | null; ziel: RefObject<HTMLDivElement | null> }) {
  const { camera, size, invalidate } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => { invalidate(); }, [punkt, invalidate]);
  useFrame(() => {
    const el = ziel.current;
    if (!el) return;
    if (!punkt) { el.style.visibility = "hidden"; return; }
    v.set(...punkt).project(camera);
    const x = ((v.x + 1) / 2) * size.width, y = ((1 - v.y) / 2) * size.height;
    const links = Math.min(Math.max(x + 18, 8), size.width - el.offsetWidth - 8);
    const oben = Math.min(Math.max(y - el.offsetHeight / 2, 8), size.height - el.offsetHeight - 8);
    el.style.transform = `translate(${Math.round(links)}px, ${Math.round(oben)}px)`;
    el.style.visibility = "visible";
  });
  return null;
}

/** Ambient Occlusion (GTAO) und Ausgabe; "reduziert" rendert direkt. Prioritaet 1 uebernimmt das Rendern. */
function Nachbearbeitung({ reduziert }: { reduziert: boolean }) {
  const { gl, scene, camera, size } = useThree();
  const composer = useMemo(() => {
    const c = new EffectComposer(gl);
    c.addPass(new RenderPass(scene, camera));
    const ao = new GTAOPass(scene, camera, size.width, size.height);
    ao.blendIntensity = 0.9;
    c.addPass(ao);
    c.addPass(new OutputPass());
    return c;
  }, [gl, scene, camera]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    composer.setPixelRatio(gl.getPixelRatio());
    composer.setSize(size.width, size.height);
  }, [composer, gl, size.width, size.height]);
  useEffect(() => () => composer.dispose(), [composer]);
  useFrame(() => {
    if (reduziert) gl.render(scene, camera);
    else composer.render();
  }, 1);
  return null;
}
```

Hinweis: Projekt hat kein ESLint; die `eslint-disable`-Kommentare sind harmlos und koennen entfallen.

- [ ] **Step 4: Gebaeudekarte anlegen**

`app/web/src/karten/GebaeudeKarte.tsx`:

```tsx
import { uebersicht } from "../panel/daten";
import type { Beschreibung, Welt } from "../typen";

interface Props { name: string; welt: Welt; beschreibung: Beschreibung; reduziert: boolean; onReduziert: (r: boolean) => void }

export function GebaeudeKarte({ name, welt, beschreibung, reduziert, onReduziert }: Props) {
  const u = uebersicht(welt, beschreibung);
  return (
    <section className="glas gebaeudekarte" aria-label="Gebaeude">
      <p className="ueberzeile">Gebaeude</p>
      <h2>{name}</h2>
      {u.geschosse === 0 ? <p>Noch keine Huelle erfasst</p> : (
        <div className="kennzahlen">
          <div><b>{u.geschosse}</b>Geschosse</div>
          <div><b>{u.einheiten}</b>Einheiten</div>
          <div><b>{u.symbole}</b>Bauteile</div>
        </div>
      )}
      {u.hinweise.length > 0 && (
        <>
          <h3>Hinweise</h3>
          <ul>{u.hinweise.map((h, i) => <li key={i}>{h}</li>)}</ul>
        </>
      )}
      <label className="schalter">
        <input type="checkbox" checked={reduziert} onChange={(e) => onReduziert(e.target.checked)} />
        Reduzierte Darstellung
      </label>
    </section>
  );
}
```

- [ ] **Step 5: Seite Entwurf anlegen (Stand Task 4)**

`app/web/src/seiten/Entwurf.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";
import { ApiFehler, holeJson } from "../api";
import { Welt3D } from "../szene2/Welt3D";
import { GebaeudeKarte } from "../karten/GebaeudeKarte";
import type { Beschreibung, Katalog, Welt } from "../typen";

interface Daten { welt: Welt; beschreibung: Beschreibung; katalog: Katalog }

function webglVorhanden(): boolean {
  try { return !!document.createElement("canvas").getContext("webgl2"); } catch { return false; }
}

interface Props { gebaeudeId: string; name: string; onAbgelaufen?: () => void; onZurAnsicht: () => void }

export function Entwurf({ gebaeudeId, name, onAbgelaufen, onZurAnsicht }: Props) {
  const [daten, setDaten] = useState<Daten | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [fokusId, setFokusId] = useState<string | null>(null);
  const [auswahl, setAuswahl] = useState<string | null>(null);
  const [reduziert, setReduziert] = useState(false);
  const karteRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    setDaten(null); setFehler(null); setFokusId(null); setAuswahl(null);
    Promise.all([
      holeJson<Welt>(`/api/szene/gebaeude/${gebaeudeId}/welt`),
      holeJson<Beschreibung>(`/api/struktur/gebaeude/${gebaeudeId}/beschreibung`),
      holeJson<Katalog>("/api/katalog/v1"),
    ]).then(([welt, beschreibung, katalog]) => setDaten({ welt, beschreibung, katalog }), (e: Error) => {
      if (e instanceof ApiFehler && e.status === 401 && onAbgelaufen) onAbgelaufen();
      else setFehler(e.message);
    });
  }, [gebaeudeId, onAbgelaufen]);
  if (!webglVorhanden()) {
    return <p className="fehler" role="alert">3D-Darstellung nicht verfuegbar (WebGL fehlt). <button className="link" onClick={onZurAnsicht}>Bisherige Ansicht</button></p>;
  }
  if (fehler) return <p className="fehler" role="alert">{fehler}</p>;
  if (!daten) return <p className="status">Laden …</p>;
  return (
    <main className="entwurf">
      <Welt3D welt={daten.welt} katalog={daten.katalog.eintraege} fokusId={fokusId} auswahl={auswahl}
        onAuswahl={setAuswahl} reduziert={reduziert} karteRef={karteRef} />
      <GebaeudeKarte name={name} welt={daten.welt} beschreibung={daten.beschreibung} reduziert={reduziert} onReduziert={setReduziert} />
    </main>
  );
}
```

(`setFokusId` wird in Task 5 genutzt; TypeScript meldet ungenutzte Variablen hier nicht, da `noUnusedLocals` nicht aktiv ist.)

- [ ] **Step 6: App.tsx erweitern (ganze Datei ersetzen)**

```tsx
import { useCallback, useEffect, useState } from "react";
import { holeJson, sendeJson } from "./api";
import { Login } from "./seiten/Login";
import { Liste } from "./seiten/Liste";
import { Ansicht } from "./seiten/Ansicht";
import { Entwurf } from "./seiten/Entwurf";

type Zustand =
  | { art: "laden" } | { art: "login" } | { art: "liste" }
  | { art: "ansicht"; gebaeudeId: string; name: string }
  | { art: "entwurf"; gebaeudeId: string; name: string };

export function App() {
  const [zustand, setZustand] = useState<Zustand>({ art: "laden" });
  useEffect(() => {
    holeJson("/api/ich").then(() => setZustand({ art: "liste" }), () => setZustand({ art: "login" }));
  }, []);
  const abgelaufen = useCallback(() => setZustand({ art: "login" }), []);
  const abmelden = async () => {
    try { await sendeJson("/api/auth/sign-out", {}); } finally { setZustand({ art: "login" }); }
  };
  if (zustand.art === "laden") return <p className="status">Laden …</p>;
  if (zustand.art === "login") return <Login onAngemeldet={() => setZustand({ art: "liste" })} />;
  const gebaeude = zustand.art === "ansicht" || zustand.art === "entwurf" ? zustand : null;
  return (
    <div className="rahmen">
      <header className="kopf">
        <strong>Planora</strong>
        {gebaeude && <><button className="link" onClick={() => setZustand({ art: "liste" })}>← Gebaeude</button><span>{gebaeude.name}</span></>}
        {zustand.art === "ansicht" && <button className="link" onClick={() => setZustand({ ...zustand, art: "entwurf" })}>Entwurf</button>}
        {zustand.art === "entwurf" && <button className="link" onClick={() => setZustand({ ...zustand, art: "ansicht" })}>Bisherige Ansicht</button>}
        <span className="abstand" />
        <button className="link" onClick={abmelden}>Abmelden</button>
      </header>
      {zustand.art === "liste" && <Liste onWahl={(g) => setZustand({ art: "ansicht", gebaeudeId: g.id, name: g.name })} onAbgelaufen={abgelaufen} />}
      {zustand.art === "ansicht" && <Ansicht gebaeudeId={zustand.gebaeudeId} onAbgelaufen={abgelaufen} />}
      {zustand.art === "entwurf" && (
        <Entwurf gebaeudeId={zustand.gebaeudeId} name={zustand.name} onAbgelaufen={abgelaufen}
          onZurAnsicht={() => setZustand({ ...zustand, art: "ansicht" })} />
      )}
    </div>
  );
}
```

- [ ] **Step 7: Stile anhaengen**

An `app/web/src/stil.css` anhaengen:

```css
/* Entwurf (E40): Vollbild-3D mit schwebenden Glas-Karten */
.entwurf { position: relative; min-height: 0; overflow: hidden; }
.entwurf .szene { position: absolute; inset: 0; }
.glas { background: rgba(255, 255, 255, 0.84); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); border: 1px solid rgba(255, 255, 255, 0.7); border-radius: 14px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.14); padding: 0.9rem 1.1rem; }
.gebaeudekarte { position: absolute; top: 1rem; left: 1rem; width: 290px; max-height: calc(100% - 7rem); overflow: auto; }
.gebaeudekarte h2 { margin: 0 0 0.7rem; font-size: 1.15rem; }
.gebaeudekarte h3 { margin: 0.9rem 0 0.3rem; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; }
.gebaeudekarte ul { margin: 0; padding-left: 1.1rem; font-size: 0.9rem; }
.ueberzeile { margin: 0; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; }
.kennzahlen { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; font-size: 0.78rem; color: #64748b; }
.kennzahlen b { display: block; font-size: 1.5rem; color: var(--text); font-weight: 650; }
.schalter { display: flex; align-items: center; gap: 0.5rem; margin-top: 1rem; font-size: 0.85rem; color: #475569; }
.schalter input { width: auto; }
```

- [ ] **Step 8: Tests, Typen, Build**

Run: `cd app/web && npm test && npm run build`
Expected: alle Tests PASS (bestehende 19 + neue), Typpruefung und Build ohne Fehler.

- [ ] **Step 9: Im Browser pruefen**

Run (eigenes Terminal, laeuft weiter): `cd app && npm run entwicklung`
Die Konsole zeigt URL und Login (`admin@planora.invalid` / generiertes Passwort). Anmelden, "Beispielgebaeude" waehlen, "Entwurf" klicken.
Expected: weisser Baukoerper mit zwei Geschossen, Fensterbaendern (keine Fenster vor der Technik im EG, Westseite EG ohne Fenster), Deckenband, Attika, Dachaufbau, Schatten auf der Grundplatte, AO in Ecken; Gebaeudekarte links. "Reduzierte Darstellung" schaltet Schatten und AO ab. Browser-Konsole: keine CSP-Verletzungen.
Bei Fehlern im Renderer (z. B. GTAO schwarz oder Schatten fehlen): Ursache benennen, `superpowers:systematic-debugging` nutzen; nach drei Fehlversuchen stoppen und melden.

- [ ] **Step 10: Commit**

```bash
git add app/web/src/szene2/materialien.ts app/web/src/szene2/schrift.tsx app/web/src/szene2/Welt3D.tsx app/web/src/karten/GebaeudeKarte.tsx app/web/src/seiten/Entwurf.tsx app/web/src/App.tsx app/web/src/stil.css
git commit -m "Entwurf: plastische Gebaeudeuebersicht mit Licht, Schatten, AO und Gebaeudekarte

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Fokusmodus, Bauteile, Leitungen, Karten

Sichtbares Ergebnis: Geschossleiste unten; Klick auf "EG" blendet OG1 aus, schneidet Waende auf Bruestungshoehe, dunkelt die Umgebung auf Schieferblau ab und zeigt Raeume, Bauteile (grau-rot), leuchtend rote Leitungen und FBH-Muster. Klick auf ein Bauteil zeigt die Bauteilkarte daneben; dessen Leitungen werden hervorgehoben, die uebrigen abgeblasst. Legende unten rechts.

**Files:**
- Create: `app/web/src/szene2/bauteile.tsx`
- Create: `app/web/src/szene2/Fokus.tsx`
- Create: `app/web/src/karten/GeschossLeiste.tsx`
- Create: `app/web/src/karten/Legende.tsx`
- Create: `app/web/src/karten/BauteilKarte.tsx`
- Modify: `app/web/src/szene2/Welt3D.tsx` (Import + eine Zeile)
- Modify: `app/web/src/seiten/Entwurf.tsx` (ganze Datei unten)
- Modify: `app/web/src/stil.css` (Anhang)

**Interfaces:**
- Consumes: `Materialien` (Task 4), `leitungen`, `schlange`, `geschossBeiY`, `BODEN`, `Leitung` (Task 3), `imRechteck`, `V3` (Task 2), `ROHR` (Task 1), `BodenSchrift` (Task 4), `panelDaten` aus `../panel/daten` (bestehend).
- Produces:
  - `BauteilForm({ katalogId, m }: { katalogId: string; m: THREE.Material })`
  - `FokusInhalt({ welt, katalog, fokusId, auswahl, onAuswahl, mat })`
  - `GeschossLeiste({ geschosse, fokusId, onFokus })`
  - `Legende()`
  - `BauteilKarte({ karteRef, welt, beschreibung, katalog, auswahl, onSchliessen })`

- [ ] **Step 1: Bauteilformen anlegen**

`app/web/src/szene2/bauteile.tsx`:

```tsx
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/** Geteilte Geometrien; Formen stehen mit der Unterkante auf y = 0. Masse in m [A]. */
const G = {
  wpKoerper: new RoundedBoxGeometry(1.0, 1.2, 0.6, 3, 0.08),
  gitter: new THREE.CylinderGeometry(0.34, 0.34, 0.03, 32),
  kessel: new THREE.CylinderGeometry(0.4, 0.4, 1.6, 32),
  speicher: new THREE.CylinderGeometry(0.45, 0.45, 1.8, 32),
  fernwaerme: new RoundedBoxGeometry(1.0, 0.8, 0.3, 2, 0.04),
  pumpe: new THREE.CylinderGeometry(0.15, 0.15, 0.3, 24),
  balken: new THREE.BoxGeometry(1.2, 0.15, 0.15),
  stutzen: new THREE.CylinderGeometry(0.04, 0.04, 0.3, 12),
  hkPlatte: new THREE.BoxGeometry(1.0, 0.6, 0.06),
  hkRippe: new THREE.BoxGeometry(0.04, 0.6, 0.12),
  scheibe: new THREE.CylinderGeometry(0.35, 0.35, 0.06, 24),
  kasten: new RoundedBoxGeometry(0.6, 0.6, 0.6, 2, 0.05),
};
const GITTER_MAT = new THREE.MeshStandardMaterial({ color: "#3f2a28", roughness: 0.8 });

export function BauteilForm({ katalogId, m }: { katalogId: string; m: THREE.Material }) {
  switch (katalogId) {
    case "heizung.waermepumpe":
      return (
        <group>
          <mesh geometry={G.wpKoerper} material={m} position={[0, 0.6, 0]} castShadow />
          <mesh geometry={G.gitter} material={GITTER_MAT} position={[0, 0.7, 0.31]} rotation={[Math.PI / 2, 0, 0]} />
        </group>
      );
    case "heizung.gaskessel":
    case "heizung.oelkessel":
      return <mesh geometry={G.kessel} material={m} position={[0, 0.8, 0]} castShadow />;
    case "heizung.speicher":
      return <mesh geometry={G.speicher} material={m} position={[0, 0.9, 0]} castShadow />;
    case "heizung.fernwaerme_uebergabe":
      return <mesh geometry={G.fernwaerme} material={m} position={[0, 1.0, 0]} castShadow />;
    case "heizung.umwaelzpumpe":
      return <mesh geometry={G.pumpe} material={m} position={[0, 0.3, 0]} rotation={[0, 0, Math.PI / 2]} castShadow />;
    case "heizung.verteiler":
      return (
        <group>
          <mesh geometry={G.balken} material={m} position={[0, 0.8, 0]} castShadow />
          {[-0.45, -0.15, 0.15, 0.45].map((x) => <mesh key={x} geometry={G.stutzen} material={m} position={[x, 0.6, 0]} />)}
        </group>
      );
    case "heizung.heizkoerper":
      return (
        <group position={[0, 0.5, 0]}>
          <mesh geometry={G.hkPlatte} material={m} castShadow />
          {[-0.4, -0.24, -0.08, 0.08, 0.24, 0.4].map((x) => <mesh key={x} geometry={G.hkRippe} material={m} position={[x, 0, 0]} />)}
        </group>
      );
    case "heizung.fbh_kreis":
    case "heizung.tabs_feld":
      return <mesh geometry={G.scheibe} material={m} position={[0, 0.03, 0]} />;
    default:
      return <mesh geometry={G.kasten} material={m} position={[0, 0.3, 0]} castShadow />;
  }
}
```

- [ ] **Step 2: Fokus-Inhalt anlegen**

`app/web/src/szene2/Fokus.tsx`:

```tsx
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { KatalogEintrag, Welt } from "../typen";
import { BauteilForm } from "./bauteile";
import { ROHR } from "./farben";
import { imRechteck, type V3 } from "./huelle";
import { BODEN, geschossBeiY, leitungen, schlange, type Leitung } from "./leitungen";
import type { Materialien } from "./materialien";
import { BodenSchrift } from "./schrift";

interface Props {
  welt: Welt; katalog: KatalogEintrag[]; fokusId: string; auswahl: string | null;
  onAuswahl: (s: string | null) => void; mat: Materialien;
}
const FLAECHE = new Set(["heizung.fbh_kreis", "heizung.tabs_feld"]);
const TRENNWAND = 1, TRENNDICKE = 0.1;

export function FokusInhalt({ welt, katalog, fokusId, auswahl, onAuswahl, mat }: Props) {
  const g = welt.geschosse.find((x) => x.id === fokusId);
  const alle = useMemo(() => leitungen(welt, katalog), [welt, katalog]);
  if (!g) return null;
  const einheiten = welt.einheiten.filter((e) => e.geschossId === fokusId);
  const symbole = welt.symbole.filter((s) => geschossBeiY(welt, s.position.y) === fokusId);
  const sichtbar = alle.filter((l) => l.geschossIds.includes(fokusId));
  const betrifft = (l: Leitung) => !!auswahl && (l.von === auswahl || l.nach === auswahl);
  return (
    <group>
      {einheiten.map((e, i) => {
        const r = e.rechteck, y = g.yUnten;
        const wand = (mitte: V3, groesse: V3, k: string) => (
          <mesh key={k} position={mitte} material={mat.trennwand} castShadow receiveShadow><boxGeometry args={groesse} /></mesh>
        );
        return (
          <group key={e.id}>
            <mesh position={[r.x + r.breite / 2, y + 0.01, r.z + r.tiefe / 2]} rotation={[-Math.PI / 2, 0, 0]} material={mat.boden[i % mat.boden.length]} receiveShadow>
              <planeGeometry args={[r.breite, r.tiefe]} />
            </mesh>
            {wand([r.x + r.breite / 2, y + TRENNWAND / 2, r.z], [r.breite, TRENNWAND, TRENNDICKE], "s")}
            {wand([r.x + r.breite / 2, y + TRENNWAND / 2, r.z + r.tiefe], [r.breite, TRENNWAND, TRENNDICKE], "n")}
            {wand([r.x, y + TRENNWAND / 2, r.z + r.tiefe / 2], [TRENNDICKE, TRENNWAND, r.tiefe], "w")}
            {wand([r.x + r.breite, y + TRENNWAND / 2, r.z + r.tiefe / 2], [TRENNDICKE, TRENNWAND, r.tiefe], "o")}
            <BodenSchrift text={e.bezeichnung} position={[r.x + r.breite / 2, y + 0.03, r.z + r.tiefe - 1.2]} breite={Math.min(6, r.breite * 0.8)} />
          </group>
        );
      })}
      {symbole.filter((s) => FLAECHE.has(s.katalogId)).map((s) => {
        const e = einheiten.find((x) => imRechteck(x.rechteck, s.position.x, s.position.z));
        return e ? <Linienzug key={`f${s.schluessel}`} punkte={schlange(e.rechteck, g.yUnten + 0.02)} m={mat.flaeche} /> : null;
      })}
      {sichtbar.map((l, i) => (
        <Rohr key={`l${i}`} punkte={l.punkte} radius={l.art === "haupt" ? ROHR.haupt : ROHR.verteil}
          m={!auswahl ? mat.leitung : betrifft(l) ? mat.leitungAktiv : mat.leitungBlass} />
      ))}
      {symbole.map((s) => (
        <Bauteil key={s.schluessel} schluessel={s.schluessel} position={[s.position.x, s.position.y + BODEN, s.position.z]} katalogId={s.katalogId}
          m={s.schluessel === auswahl ? mat.geraetAuswahl : s.status === "vorgeschlagen" ? mat.geraetVorschlag : mat.geraet} onAuswahl={onAuswahl} />
      ))}
    </group>
  );
}

function Bauteil({ schluessel, position, katalogId, m, onAuswahl }: {
  schluessel: string; position: V3; katalogId: string; m: THREE.Material; onAuswahl: (s: string) => void;
}) {
  const { gl } = useThree();
  return (
    <group position={position}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onAuswahl(schluessel); }}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); gl.domElement.style.cursor = "pointer"; }}
      onPointerOut={() => { gl.domElement.style.cursor = ""; }}>
      <BauteilForm katalogId={katalogId} m={m} />
    </group>
  );
}

function Rohr({ punkte, radius, m }: { punkte: V3[]; radius: number; m: THREE.Material }) {
  const geo = useMemo(() => {
    const pfad = new THREE.CurvePath<THREE.Vector3>();
    for (let i = 1; i < punkte.length; i++) pfad.add(new THREE.LineCurve3(new THREE.Vector3(...punkte[i - 1]), new THREE.Vector3(...punkte[i])));
    return new THREE.TubeGeometry(pfad, Math.max(8, (punkte.length - 1) * 8), radius, 10, false);
  }, [punkte, radius]);
  useEffect(() => () => geo.dispose(), [geo]);
  if (punkte.length < 2) return null;
  return <mesh geometry={geo} material={m} />;
}

function Linienzug({ punkte, m }: { punkte: V3[]; m: THREE.Material }) {
  const linie = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints(punkte.map((p) => new THREE.Vector3(...p)));
    return new THREE.Line(geo, m);
  }, [punkte, m]);
  useEffect(() => () => linie.geometry.dispose(), [linie]);
  return <primitive object={linie} />;
}
```

Hinweis: `Rohr` mit weniger als 2 Punkten wuerde `TubeGeometry` mit leerem Pfad bauen; `leitungen()` liefert immer mindestens Start und Ziel. Falls Start = Ziel (Verteiler steht in Einheitsmitte), ergibt `route` einen Punkt → `useMemo` muss das abfangen: im `useMemo` bei `punkte.length < 2` `new THREE.BufferGeometry()` zurueckgeben. Setze das so um:

```tsx
  const geo = useMemo(() => {
    if (punkte.length < 2) return new THREE.BufferGeometry();
    const pfad = new THREE.CurvePath<THREE.Vector3>();
    for (let i = 1; i < punkte.length; i++) pfad.add(new THREE.LineCurve3(new THREE.Vector3(...punkte[i - 1]), new THREE.Vector3(...punkte[i])));
    return new THREE.TubeGeometry(pfad, Math.max(8, (punkte.length - 1) * 8), radius, 10, false);
  }, [punkte, radius]);
```

- [ ] **Step 3: FokusInhalt in Welt3D einhaengen**

In `app/web/src/szene2/Welt3D.tsx`:
- Import ergaenzen: `import { FokusInhalt } from "./Fokus";`
- In `Welt3D` die Destrukturierung erweitern: `const { welt, katalog, fokusId, onAuswahl, reduziert, auswahl, karteRef } = props;`
- Die Zeile `{/* FOKUS-INHALT (Task 5) */}` ersetzen durch:

```tsx
      {fokus && <FokusInhalt welt={welt} katalog={katalog} fokusId={fokus.id} auswahl={auswahl} onAuswahl={onAuswahl} mat={mat} />}
```

- [ ] **Step 4: Karten anlegen**

`app/web/src/karten/GeschossLeiste.tsx`:

```tsx
interface Props { geschosse: { id: string; code: string; yUnten: number }[]; fokusId: string | null; onFokus: (id: string | null) => void }

export function GeschossLeiste({ geschosse, fokusId, onFokus }: Props) {
  if (geschosse.length === 0) return null;
  const sortiert = [...geschosse].sort((a, b) => a.yUnten - b.yUnten);
  return (
    <nav className="glas geschossleiste" aria-label="Geschosse">
      <button aria-pressed={fokusId === null} onClick={() => onFokus(null)}>Alle</button>
      {sortiert.map((g) => <button key={g.id} aria-pressed={fokusId === g.id} onClick={() => onFokus(g.id)}>{g.code}</button>)}
    </nav>
  );
}
```

`app/web/src/karten/Legende.tsx`:

```tsx
export function Legende() {
  return (
    <aside className="glas legende" aria-label="Legende">
      <p className="ueberzeile">Heizung</p>
      <div><span className="strich haupt" />Hauptleitung</div>
      <div><span className="strich verteil" />Verteilung</div>
      <div><span className="punkt" />Geraet / Apparat</div>
      <p className="leise">Schematischer Verlauf, keine Leitungsplanung.</p>
    </aside>
  );
}
```

`app/web/src/karten/BauteilKarte.tsx`:

```tsx
import type { RefObject } from "react";
import { panelDaten } from "../panel/daten";
import type { Beschreibung, KatalogEintrag, Welt } from "../typen";

interface Props {
  karteRef: RefObject<HTMLDivElement | null>; welt: Welt; beschreibung: Beschreibung; katalog: KatalogEintrag[];
  auswahl: string | null; onSchliessen: () => void;
}

/** Position setzt Welt3D (Anker) per transform; hier nur Inhalt. */
export function BauteilKarte({ karteRef, welt, beschreibung, katalog, auswahl, onSchliessen }: Props) {
  const d = auswahl ? panelDaten(welt, beschreibung, katalog, auswahl) : null;
  return (
    <div ref={karteRef} className="glas bauteilkarte" role="dialog" aria-label="Bauteil" hidden={!d}>
      {d && (
        <>
          <button className="schliessen" aria-label="Schliessen" onClick={onSchliessen}>×</button>
          <p className="ueberzeile">{d.standort}</p>
          <h2>{d.titel}</h2>
          {d.herstellerTyp && <p>{d.herstellerTyp}</p>}
          <p><span className={d.status === "vorgeschlagen" ? "marke vorschlag" : "marke"}>{d.status === "vorgeschlagen" ? "vorgeschlagen" : "bestaetigt"}</span> Menge: {d.menge}</p>
          {d.versorgt.length > 0 && <><h3>Versorgt</h3><ul>{d.versorgt.map((v) => <li key={v}>{v}</li>)}</ul></>}
          <p className="leise">Position schematisch</p>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Entwurf.tsx ersetzen (Endstand)**

```tsx
import { useEffect, useRef, useState } from "react";
import { ApiFehler, holeJson } from "../api";
import { Welt3D } from "../szene2/Welt3D";
import { GebaeudeKarte } from "../karten/GebaeudeKarte";
import { GeschossLeiste } from "../karten/GeschossLeiste";
import { Legende } from "../karten/Legende";
import { BauteilKarte } from "../karten/BauteilKarte";
import type { Beschreibung, Katalog, Welt } from "../typen";

interface Daten { welt: Welt; beschreibung: Beschreibung; katalog: Katalog }

function webglVorhanden(): boolean {
  try { return !!document.createElement("canvas").getContext("webgl2"); } catch { return false; }
}

interface Props { gebaeudeId: string; name: string; onAbgelaufen?: () => void; onZurAnsicht: () => void }

export function Entwurf({ gebaeudeId, name, onAbgelaufen, onZurAnsicht }: Props) {
  const [daten, setDaten] = useState<Daten | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [fokusId, setFokusId] = useState<string | null>(null);
  const [auswahl, setAuswahl] = useState<string | null>(null);
  const [reduziert, setReduziert] = useState(false);
  const karteRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    setDaten(null); setFehler(null); setFokusId(null); setAuswahl(null);
    Promise.all([
      holeJson<Welt>(`/api/szene/gebaeude/${gebaeudeId}/welt`),
      holeJson<Beschreibung>(`/api/struktur/gebaeude/${gebaeudeId}/beschreibung`),
      holeJson<Katalog>("/api/katalog/v1"),
    ]).then(([welt, beschreibung, katalog]) => setDaten({ welt, beschreibung, katalog }), (e: Error) => {
      if (e instanceof ApiFehler && e.status === 401 && onAbgelaufen) onAbgelaufen();
      else setFehler(e.message);
    });
  }, [gebaeudeId, onAbgelaufen]);
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setAuswahl((a) => { if (a === null) setFokusId(null); return null; });
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, []);
  const fokussiere = (id: string | null) => { setAuswahl(null); setFokusId(id); };
  if (!webglVorhanden()) {
    return <p className="fehler" role="alert">3D-Darstellung nicht verfuegbar (WebGL fehlt). <button className="link" onClick={onZurAnsicht}>Bisherige Ansicht</button></p>;
  }
  if (fehler) return <p className="fehler" role="alert">{fehler}</p>;
  if (!daten) return <p className="status">Laden …</p>;
  return (
    <main className={fokusId ? "entwurf fokus" : "entwurf"}>
      <Welt3D welt={daten.welt} katalog={daten.katalog.eintraege} fokusId={fokusId} auswahl={auswahl}
        onAuswahl={setAuswahl} reduziert={reduziert} karteRef={karteRef} />
      <GebaeudeKarte name={name} welt={daten.welt} beschreibung={daten.beschreibung} reduziert={reduziert} onReduziert={setReduziert} />
      <GeschossLeiste geschosse={daten.welt.geschosse} fokusId={fokusId} onFokus={fokussiere} />
      {fokusId && <Legende />}
      <BauteilKarte karteRef={karteRef} welt={daten.welt} beschreibung={daten.beschreibung} katalog={daten.katalog.eintraege}
        auswahl={auswahl} onSchliessen={() => setAuswahl(null)} />
    </main>
  );
}
```

- [ ] **Step 6: Stile anhaengen**

An `app/web/src/stil.css` anhaengen:

```css
.geschossleiste { position: absolute; bottom: 1.2rem; left: 50%; transform: translateX(-50%); display: flex; gap: 0.3rem; padding: 0.35rem; border-radius: 999px; }
.geschossleiste button { border: none; background: transparent; border-radius: 999px; padding: 0.4rem 1rem; color: #334155; font-weight: 550; }
.geschossleiste button[aria-pressed="true"] { background: #1e293b; color: #fff; }
.legende { position: absolute; bottom: 1.2rem; right: 1rem; width: 230px; font-size: 0.82rem; display: grid; gap: 0.35rem; }
.legende .leise { margin-top: 0.4rem; font-size: 0.75rem; }
.strich { display: inline-block; width: 28px; margin-right: 0.6rem; vertical-align: middle; border-radius: 3px; background: #ff3b30; }
.strich.haupt { height: 6px; }
.strich.verteil { height: 3px; }
.punkt { display: inline-block; width: 12px; height: 12px; margin: 0 1.1rem 0 0.4rem; vertical-align: middle; border-radius: 3px; background: #8a5450; }
.bauteilkarte { position: absolute; left: 0; top: 0; width: 270px; visibility: hidden; }
.bauteilkarte[hidden] { display: none; }
.bauteilkarte h2 { margin: 0.1rem 0 0.4rem; font-size: 1.1rem; }
.bauteilkarte h3 { margin: 0.8rem 0 0.3rem; font-size: 0.75rem; text-transform: uppercase; color: #64748b; }
.bauteilkarte ul { margin: 0; padding-left: 1.1rem; }
.bauteilkarte p { margin: 0.2rem 0; }
.bauteilkarte .schliessen { position: absolute; top: 0.4rem; right: 0.5rem; border: none; background: none; font-size: 1.2rem; padding: 0.1rem 0.4rem; color: #64748b; }
```

- [ ] **Step 7: Tests, Typen, Build**

Run: `cd app/web && npm test && npm run build`
Expected: alle Tests PASS, Typpruefung und Build ohne Fehler.

- [ ] **Step 8: Im Browser pruefen**

`npm run entwicklung` (in `app/`) laeuft; Seite neu laden, Entwurf oeffnen.
Expected:
1. "EG": OG1 verschwindet, Waende EG auf Bruestungshoehe, Hintergrund blendet in ca. 0.4 s auf Schieferblau, Kamera faehrt auf EG. Raeume Buero A, Restaurant, Technik mit Bodenschrift.
2. In Technik: Waermepumpe, Speicher, Verteiler (grau-rot). Hauptleitung (dick) Waermepumpe → Verteiler, Verteilleitungen (duenn) zum Restaurant und senkrecht nach oben (Richtung Buero C). FBH-Muster im Restaurant. Heizkoerper in Buero A.
3. Klick Verteiler: Karte daneben mit "Versorgt: Restaurant (EG), Buero C (OG1)"; Verteiler-Leitungen leuchten staerker, andere blass. Klick ins Leere/Esc schliesst; zweites Esc → "Alle".
4. "OG1": EG bleibt als Sockel (abgeblendet), OG1 geschnitten mit Buero C/D und FBH-Mustern, Verteilleitung kommt von unten an.
5. "Alle": zurueck zur hellen Uebersicht. Keine CSP-Verletzungen in der Konsole.

- [ ] **Step 9: Commit**

```bash
git add app/web/src/szene2/bauteile.tsx app/web/src/szene2/Fokus.tsx app/web/src/szene2/Welt3D.tsx app/web/src/karten app/web/src/seiten/Entwurf.tsx app/web/src/stil.css
git commit -m "Entwurf: Fokusmodus je Geschoss mit Bauteilen, Leitungen und schwebenden Karten

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Sichtpruefung, Feinabstimmung, Screenshots, Doku

**Files:**
- Modify (nur Konstanten, falls noetig): `app/web/src/szene2/farben.ts`, `stimmung.ts`, `huelle.ts` (`MASSE`), `Welt3D.tsx` (Licht-/AO-Werte)
- Create: `docs/abnahme/2026-11-12-entwurf/README.md` und Screenshots (Ordnerdatum = Tag der Umsetzung)
- Modify: `docs/superpowers/plans/2026-11-11-fortsetzung.md` (Eintrag oben), `CLAUDE.md` Abschnitt 0b (Stand), `docs/arbeitsjournal.md`

- [ ] **Step 1: Vergleich mit den Referenzen**

Screenshots der fuenf Zustaende aufnehmen (Playwright oder Claude in Chrome, Fenster 1440 x 900): `uebersicht.png`, `fokus-eg.png`, `fokus-og1.png`, `verteiler.png`, `reduziert.png`. Neben `docs/design/referenzen/02-gebaeude.png` und `03-technik.png` legen und pruefen: Wirkt die Uebersicht plastisch (Schatten, AO, Fensterbaender)? Ist der Fokus abgeblendet, aber nicht dunkel? Leuchten die Leitungen klar rot?

- [ ] **Step 2: Feinabstimmung (max. 3 Runden)**

Nur Konstanten aendern (Farben, `HELL`/`FOKUS`, `MASSE`, Lichtposition/-staerke, `ao.blendIntensity`, `scene.environmentIntensity`). Nach jeder Aenderung `npm test` (Tests der reinen Funktionen koennen sich bei `MASSE`-Aenderung aendern; dann Testerwartungen bewusst anpassen und im Commit nennen). Nach drei Runden ohne deutliche Verbesserung stoppen und dem PO den Stand zeigen.

- [ ] **Step 3: Leistung grob pruefen**

In der Browser-Konsole waehrend Orbit-Drehung: `performance`-Panel oder `requestAnimationFrame`-Zaehler ca. 5 s. Ergebnis (fps, Geraet) im Abnahme-README notieren, als [A] wenn nicht auf Zielgeraet gemessen.

- [ ] **Step 4: Gesamtpruefung**

Run: `cd app/web && npm test && npm run build` und `cd app && npm test && npm run pruefe:typen`
Expected: alles gruen. Zahlen im README festhalten.

- [ ] **Step 5: Abnahme-README schreiben**

`docs/abnahme/2026-11-12-entwurf/README.md` mit: Liste der Screenshots (Links), Pruefstand (Testzahlen), CSP-Ergebnis, fps-Messung, offene Punkte fuer die Korrekturrunde: weisser Auswahl-Umriss [?], Annahme Zentrale→Verteiler [A], Dachaufbau [A], alle Masse/Farben [A]. Ausdruecklich: "Keine visuelle Endabnahme bis PO-Korrekturrunde."

- [ ] **Step 6: Stand nachfuehren**

Fortsetzungsplan, CLAUDE.md 0b und Arbeitsjournal kurz aktualisieren (Skill `claude-setup:stand` oder Agent `claude-setup:stand-halter`): Entwurf umgesetzt, Korrekturrunde mit PO steht aus.

- [ ] **Step 7: Commit**

```bash
git add docs/abnahme app/web/src CLAUDE.md docs/arbeitsjournal.md docs/superpowers/plans/2026-11-11-fortsetzung.md
git commit -m "Entwurf: Sichtpruefung, Feinabstimmung und Screenshots fuer die PO-Korrekturrunde

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
