# Leitungsrouter – Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alle Heizungsleitungen (Haupt- und Gruppenstraenge) werden fuer jede Geraeteanordnung ohne Beruehrung, Schleife, Rueckwaertslauf oder Durchdringung von Geraeten gefuehrt; ein Pruefer weist das an 2000 Zufallswelten nach.

**Architecture:** Neues Modul `app/web/src/szene3/router/`. Ein Raster (Zelle = halbe Spur, 0.09 m) je Leitungsebene haelt Belegung durch Geraete, Waende und verlegte Rohre. Die Trasse in der Zentrale wird als bevorzugte Spur je Leitung umgesetzt: `trasse.ts` teilt Spuren nach Left-Edge (nur verschachtelte/disjunkte Intervalle) zu, die A*-Wegsuche bevorzugt die eigene Spur (Kostenfaktor 0.4) und weicht Hindernissen aus. Der Router ersetzt die Wegberechnung in `kantenNetz` und `strangBaum`; Adapter, Gruppenstock, Ausschneiden und die Ausgabe `Rohrstueck[]` bleiben. Der Pruefer bewertet das fertige `Rohrstueck[]` unabhaengig vom Router.

**Tech Stack:** TypeScript, React, three.js, Vitest 5.1 (`npm.cmd test` in `app/web`), keine neuen Abhaengigkeiten.

**Spec:** `docs/superpowers/specs/2026-11-13-leitungsrouter-design.md` (PO-freigegeben 13.11.2026, inkl. Annahme "Rohr ueber Geraet bei >= 0.15 m Luft").

## Global Constraints

- Sprache de-CH, kein Eszett in Code-Kommentaren/Doku; **UI-Texte mit echten Umlauten** ("Leitungsführung unsauber").
- Ein Rohr je Verbindung, endgueltig; keine Platzreserve fuer Vorlauf/Ruecklauf.
- Router verschiebt keine Geraete; `welt.symbole[*].position` wird nie veraendert.
- Ausgabe bleibt `Rohrstueck[]` aus `szene3/netz.ts`; `durchgaenge`, `Technik3.tsx`, Gruppenhervorhebung unveraendert lauffaehig.
- Deterministisch: gleiche Welt -> identische Punkte (keine `Math.random`, keine Map-Iteration ueber ungeordnete Eingaben ohne Sortierung).
- Zahlen sind Startwerte [A]: Zelle 0.09 m, Fuge 0.04 m, max. 6 Boegen, Luft ueber Geraet 0.15 m, Geraetezuschlag 0.05 m, Bogen 2 m, Ebenenwechsel 3 m, Wandzelle 2 m, Spurfaktor 0.4, Ausweichebene 0.25 m unter Leitungsebene, Trasse 0.3 m ab Wand.
- Windows: `npm.cmd` statt `npm`; Befehle aus `app/web` fuer Webtests. PO-Server 3000/54500 nicht stoppen.
- Kein Push/Merge ohne PO-Auftrag. Commits enden mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Pruefstand vor Beginn: Web 251/251 gruen; nach jedem Task alle Webtests gruen (ausser Tests, die der Task ausdruecklich ersetzt).

## Dateistruktur

| Datei | Verantwortung |
|---|---|
| `router/typen.ts` | Gemeinsame Typen `Koerper`, `PruefLeitung`, `Befund`, Konstanten `GRENZEN`, `ROUTER` |
| `router/geometrie.ts` | Segmentabstand, Segment-Quader-Schnitt, Achsen, Boegen zaehlen |
| `router/pruefer.ts` | `pruefen()`, `alsPrueflinien()` |
| `router/koerper.ts` | `geraeteKoerper(welt, katalog)` |
| `router/testKatalog.ts` | Katalog fuer Tests (nur Tests importieren) |
| `router/zufallsWelt.ts` | Reproduzierbare Zufallswelten (nur Tests importieren) |
| `router/topologie.ts` | `alsBaum()` – verwirft Kanten, die Zyklen/Doppelvorgaenger erzeugen |
| `router/raster.ts` | `Gitter`, `gitterFuer()`, `Belegung` |
| `router/astern.ts` | `suchen()` – A* mit Bogen-, Spur-, Ebenen- und Wandkosten |
| `router/trasse.ts` | `trassenLage()`, `spurenZuteilen()`, `spurWert()` |
| `router/router.ts` | `LeitungsRouter` – `weg`, `wegZumNetz`, `strang`, `belegen`, `vorbelegen`, `spurenFestlegen` |
| `router/hinweise.ts` | `leitungsHinweise()` fuer die Hinweiskarte |
| `szene3/netz.ts` | `kantenNetz` mit Router, `rohrnetzMitBefunden` |
| `szene3/gruppenNetz.ts` | `gruppenRohrnetz` mit Router; `strangBaum`, `lWeg`, `konflikte` entfernt (Task 9) |
| `seiten/Twin.tsx` | Hinweisliste um `leitungsHinweise` ergaenzt |

Alle Pfade unten relativ zu `app/web/src/`, sofern nicht anders angegeben.

---

### Task 1: Pruefer, Testwelten und Ist-Messung

**Files:**
- Create: `szene3/router/typen.ts`, `szene3/router/geometrie.ts`, `szene3/router/pruefer.ts`, `szene3/router/koerper.ts`, `szene3/router/testKatalog.ts`, `szene3/router/zufallsWelt.ts`
- Test: `szene3/router/pruefer.test.ts`, `szene3/router/messung.test.ts`

**Interfaces:**
- Produces:
  - `interface Koerper { schluessel: string; min: V3; max: V3 }`
  - `interface PruefLeitung { id: string; netz: string; punkte: V3[]; radius: number; enden: string[] }`
  - `type Regel = "abstand" | "durch_geraet" | "selbst" | "rueckwaerts" | "schraeg" | "boegen" | "kreuzung" | "zyklus" | "kein_weg"`
  - `interface Befund { regel: Regel; leitungen: string[]; ort: V3; hart: boolean }`
  - `GRENZEN`, `ROUTER` (Konstanten)
  - `pruefen(leitungen: PruefLeitung[], koerper: Koerper[]): Befund[]`
  - `alsPrueflinien(stuecke: Rohrstueck[]): PruefLeitung[]`
  - `geraeteKoerper(welt: Welt, katalog: KatalogEintrag[]): Koerper[]`
  - `zufallsWelt(seed: number): Welt`, `TEST_KATALOG: KatalogEintrag[]`
  - `segAbstand(p1,q1,p2,q2): { d: number; a: V3; b: V3 }`, `boegen(punkte: V3[]): number`

- [ ] **Step 1: Typen und Konstanten anlegen** – `szene3/router/typen.ts`

```ts
import type { V3 } from "../../szene2/huelle";
export type { V3 };

/** Achsparalleler Geraetekoerper in Weltkoordinaten. */
export interface Koerper { schluessel: string; min: V3; max: V3 }
/** Leitung fuer den Pruefer. `netz`: zusammenhaengendes Rohrsystem (T-Abzweige im selben Netz erlaubt). */
export interface PruefLeitung { id: string; netz: string; punkte: V3[]; radius: number; enden: string[] }
export type Regel = "abstand" | "durch_geraet" | "selbst" | "rueckwaerts" | "schraeg" | "boegen" | "kreuzung" | "zyklus" | "kein_weg";
/** `hart`: muss in jeder Welt 0 sein. `kreuzung` (Grundriss-Ueberkreuzung auf verschiedenen Hoehen) ist weich. */
export interface Befund { regel: Regel; leitungen: string[]; ort: V3; hart: boolean }

/** Pruefgrenzen [A] (Spec 5.5). */
export const GRENZEN = { fuge: 0.04, maxBoegen: 6, luftUeberGeraet: 0.15, geraetZuschlag: 0.05, geraetNahbereich: 0.15 } as const;
/** Routerwerte [A] (Spec 5.3/5.4). Zelle = halbe Spur (SPUR 0.18). */
export const ROUTER = { zelle: 0.09, bogen: 2, ebenenwechsel: 3, wand: 2, spurFaktor: 0.4, ausweich: 0.25, trasseWand: 0.3, aussenRand: 0.15, runden: 3 } as const;
```

- [ ] **Step 2: Geometrie-Helfer** – `szene3/router/geometrie.ts`

```ts
import type { V3 } from "./typen";

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const clamp = (x: number) => Math.min(1, Math.max(0, x));
export const EPS = 1e-6;

/** Kuerzester Abstand zweier Strecken (Ericson, Real-Time Collision Detection 5.1.9). */
export function segAbstand(p1: V3, q1: V3, p2: V3, q2: V3): { d: number; a: V3; b: V3 } {
  const d1 = sub(q1, p1), d2 = sub(q2, p2), r = sub(p1, p2);
  const a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r);
  let s = 0, t = 0;
  if (a <= 1e-12 && e <= 1e-12) { s = 0; t = 0; }
  else if (a <= 1e-12) { s = 0; t = clamp(f / e); }
  else {
    const c = dot(d1, r);
    if (e <= 1e-12) { t = 0; s = clamp(-c / a); }
    else {
      const b = dot(d1, d2), den = a * e - b * b;
      s = den > 1e-12 ? clamp((b * f - c * e) / den) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = clamp(-c / a); } else if (t > 1) { t = 1; s = clamp((b - c) / a); }
    }
  }
  const pa = add(p1, mul(d1, s)), pb = add(p2, mul(d2, t));
  return { d: Math.hypot(...sub(pa, pb)), a: pa, b: pb };
}

/** Achsen, in denen sich zwei Punkte unterscheiden. */
export const achsen = (a: V3, b: V3) => [0, 1, 2].filter((i) => Math.abs(a[i] - b[i]) > EPS);

/** Schneidet die Strecke den (offenen) Quader? Slab-Test. */
export function schneidetQuader(p: V3, q: V3, min: V3, max: V3): boolean {
  let t0 = 0, t1 = 1;
  for (let i = 0; i < 3; i++) {
    const d = q[i] - p[i];
    if (Math.abs(d) < 1e-12) { if (p[i] <= min[i] + EPS || p[i] >= max[i] - EPS) return false; continue; }
    let a = (min[i] - p[i]) / d, b = (max[i] - p[i]) / d;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    if (t0 >= t1 - 1e-9) return false;
  }
  return true;
}

/** Anzahl Richtungswechsel einer Polylinie (Nullstuecke ignoriert). */
export function boegen(punkte: V3[]): number {
  const richtungen: string[] = [];
  for (let i = 1; i < punkte.length; i++) {
    const d = sub(punkte[i], punkte[i - 1]), l = Math.hypot(...d);
    if (l < EPS) continue;
    const r = d.map((x) => Math.round((x / l) * 1000)).join(",");
    if (richtungen.at(-1) !== r) richtungen.push(r);
  }
  return Math.max(0, richtungen.length - 1);
}

/** Schneiden sich die Grundriss-Projektionen zweier waagrechter, zueinander senkrechter Strecken im Inneren? */
export function kreuztImGrundriss(a: V3, b: V3, c: V3, d: V3): boolean {
  const ka = Math.abs(a[0] - b[0]) > EPS ? 0 : 2, kc = Math.abs(c[0] - d[0]) > EPS ? 0 : 2;
  if (ka === kc) return false;
  const qa = ka === 0 ? 2 : 0;
  const x = c[ka], z = a[qa];
  return x > Math.min(a[ka], b[ka]) + EPS && x < Math.max(a[ka], b[ka]) - EPS
    && z > Math.min(c[qa], d[qa]) + EPS && z < Math.max(c[qa], d[qa]) - EPS;
}
```

- [ ] **Step 3: Failing Tests fuer den Pruefer schreiben** – `szene3/router/pruefer.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { boegen, segAbstand } from "./geometrie";
import { pruefen } from "./pruefer";
import type { Koerper, PruefLeitung, V3 } from "./typen";

const L = (id: string, netz: string, punkte: V3[], radius = 0.045, enden: string[] = []): PruefLeitung => ({ id, netz, punkte, radius, enden });
const regeln = (b: ReturnType<typeof pruefen>) => b.map((x) => x.regel).sort();

describe("geometrie", () => {
  it("Segmentabstand paralleler Strecken", () => {
    expect(segAbstand([0, 0, 0], [1, 0, 0], [0, 0, 0.3], [1, 0, 0.3]).d).toBeCloseTo(0.3);
  });
  it("Boegen zaehlen", () => {
    expect(boegen([[0, 0, 0], [1, 0, 0], [2, 0, 0]])).toBe(0);
    expect(boegen([[0, 0, 0], [1, 0, 0], [1, 0, 1], [2, 0, 1]])).toBe(2);
  });
});

describe("pruefen", () => {
  it("saubere parallele Leitungen: keine Befunde", () => {
    expect(pruefen([L("a", "n1", [[0, 2.8, 0], [5, 2.8, 0]]), L("b", "n2", [[0, 2.8, 0.18], [5, 2.8, 0.18]])], [])).toEqual([]);
  });
  it("zu nahe fremde Leitungen: abstand", () => {
    expect(regeln(pruefen([L("a", "n1", [[0, 2.8, 0], [5, 2.8, 0]]), L("b", "n2", [[0, 2.8, 0.1], [5, 2.8, 0.1]])], []))).toEqual(["abstand"]);
  });
  it("schraeges Segment", () => {
    expect(regeln(pruefen([L("a", "n1", [[0, 0, 0], [1, 0, 1]])], []))).toEqual(["schraeg"]);
  });
  it("180-Grad-Wende", () => {
    expect(regeln(pruefen([L("a", "n1", [[0, 0, 0], [2, 0, 0], [1, 0, 0]])], []))).toContain("rueckwaerts");
  });
  it("mehr als 6 Boegen", () => {
    const zick: V3[] = [[0, 0, 0], [1, 0, 0], [1, 0, 1], [2, 0, 1], [2, 0, 0], [3, 0, 0], [3, 0, 1], [4, 0, 1], [4, 0, 0]];
    expect(regeln(pruefen([L("a", "n1", zick)], []))).toEqual(["boegen"]);
  });
  it("Rohr durch fremdes Geraet, eigenes Endgeraet erlaubt", () => {
    const k: Koerper[] = [{ schluessel: "S", min: [1, 0, -0.5], max: [2, 1.8, 0.5] }];
    expect(regeln(pruefen([L("a", "n1", [[0, 1, 0], [3, 1, 0]])], k))).toEqual(["durch_geraet"]);
    expect(pruefen([L("a", "n1", [[0, 1, 0], [3, 1, 0]], 0.045, ["S"])], k)).toEqual([]);
  });
  it("Rohr ueber Geraet mit genug Luft ist erlaubt", () => {
    const k: Koerper[] = [{ schluessel: "S", min: [1, 0, -0.5], max: [2, 1.8, 0.5] }];
    expect(pruefen([L("a", "n1", [[0, 2.8, 0], [3, 2.8, 0]])], k)).toEqual([]);
  });
  it("T-Abzweig im selben Netz erlaubt, Kreuzung ohne Abzweig nicht", () => {
    const strang = L("a", "n1", [[0, 2.8, 0], [4, 2.8, 0]]);
    expect(pruefen([strang, L("b", "n1", [[2, 2.8, 0], [2, 2.8, 2]])], [])).toEqual([]);
    expect(regeln(pruefen([strang, L("b", "n1", [[2, 2.8, -1], [2, 2.8, 1]])], []))).toEqual(["abstand"]);
  });
  it("fremde Leitung auf anderer Hoehe im Grundriss gekreuzt: weiche kreuzung", () => {
    const b = pruefen([L("a", "n1", [[0, 2.8, 0], [4, 2.8, 0]]), L("b", "n2", [[2, 2.55, -1], [2, 2.55, 1]])], []);
    expect(b.map((x) => [x.regel, x.hart])).toEqual([["kreuzung", false]]);
  });
  it("doppelt gefuehrte Strecke im selben Netz: abstand", () => {
    expect(regeln(pruefen([L("a", "n1", [[0, 2.8, 0], [4, 2.8, 0]]), L("b", "n1", [[1, 2.8, 0], [3, 2.8, 0]])], []))).toEqual(["abstand"]);
  });
});
```

Hinweis zum Boegen-Test: Die Liste `zick` hat 7 Richtungswechsel (Grenze 6).

- [ ] **Step 4: Test laufen lassen, muss fehlschlagen**

Run (in `app/web`): `npm.cmd test -- src/szene3/router/pruefer.test.ts`
Expected: FAIL, "Failed to resolve import ./pruefer".

- [ ] **Step 5: Pruefer implementieren** – `szene3/router/pruefer.ts`

```ts
import type { Rohrstueck } from "../netz";
import { achsen, boegen, EPS, kreuztImGrundriss, schneidetQuader, segAbstand } from "./geometrie";
import { GRENZEN, type Befund, type Koerper, type PruefLeitung, type V3 } from "./typen";

const schluessel = (p: V3) => p.map((x) => x.toFixed(4)).join(":");

/** Rohrstuecke -> Pruefleitungen. Hauptleitungen bilden ein Netz `haupt`, Verteilleitungen ihr Gruppennetz. */
export function alsPrueflinien(stuecke: Rohrstueck[]): PruefLeitung[] {
  return stuecke.map((r, i) => ({
    id: `${i}:${r.daten.von}>${r.daten.nach}`,
    netz: r.daten.art === "haupt" ? "haupt" : r.daten.gruppeId ?? `ersatz:${r.daten.von}>${r.daten.nach}`,
    punkte: r.punkte, radius: Math.max(r.radius, r.startRadius, r.endRadius), enden: [r.daten.von, r.daten.nach],
  }));
}

function imNahbereich(p: V3, l: PruefLeitung, m: PruefLeitung, koerper: Koerper[]): boolean {
  const n = GRENZEN.geraetNahbereich;
  return koerper.some((k) => (l.enden.includes(k.schluessel) || m.enden.includes(k.schluessel))
    && p.every((x, i) => x >= k.min[i] - n && x <= k.max[i] + n));
}

export function pruefen(leitungen: PruefLeitung[], koerper: Koerper[]): Befund[] {
  const befunde: Befund[] = [];
  const hart = (regel: Befund["regel"], ids: string[], ort: V3) => befunde.push({ regel, leitungen: ids, ort, hart: true });
  for (const l of leitungen) {
    const p = l.punkte;
    for (let i = 1; i < p.length; i++) if (achsen(p[i - 1], p[i]).length > 1) hart("schraeg", [l.id], p[i - 1]);
    for (let i = 2; i < p.length; i++) {
      const u = achsen(p[i - 2], p[i - 1]), v = achsen(p[i - 1], p[i]);
      if (u.length === 1 && v.length === 1 && u[0] === v[0]
        && Math.sign(p[i - 1][u[0]] - p[i - 2][u[0]]) !== Math.sign(p[i][u[0]] - p[i - 1][u[0]])) hart("rueckwaerts", [l.id], p[i - 1]);
    }
    if (boegen(p) > GRENZEN.maxBoegen) hart("boegen", [l.id], p[0]);
    for (let i = 1; i < p.length; i++) for (let j = i + 2; j < p.length; j++) {
      if (segAbstand(p[i - 1], p[i], p[j - 1], p[j]).d < l.radius - EPS) hart("selbst", [l.id], p[i]);
    }
    for (const k of koerper) {
      if (l.enden.includes(k.schluessel)) continue;
      const r = l.radius, min: V3 = [k.min[0] - r, k.min[1] - r, k.min[2] - r];
      const max: V3 = [k.max[0] + r, k.max[1] + r + GRENZEN.luftUeberGeraet, k.max[2] + r];
      for (let i = 1; i < p.length; i++) if (schneidetQuader(p[i - 1], p[i], min, max)) { hart("durch_geraet", [l.id, k.schluessel], p[i]); break; }
    }
  }
  for (let x = 0; x < leitungen.length; x++) for (let y = x + 1; y < leitungen.length; y++) {
    const l = leitungen[x], m = leitungen[y];
    const gemeinsam = new Set(l.punkte.map(schluessel).filter((s) => m.punkte.some((q) => schluessel(q) === s)));
    const grenze = l.radius + m.radius + GRENZEN.fuge;
    for (let i = 1; i < l.punkte.length; i++) for (let j = 1; j < m.punkte.length; j++) {
      const a = l.punkte[i - 1], b = l.punkte[i], c = m.punkte[j - 1], d = m.punkte[j];
      const r = segAbstand(a, b, c, d);
      if (l.netz === m.netz) {
        // Im selben Netz: Beruehrung nur als T-Abzweig (Endpunkt der einen Strecke auf der anderen) oder an gemeinsamen Punkten.
        if (r.d >= grenze - EPS) continue;
        const nahGemeinsam = [...gemeinsam].some((s) => { const q = s.split(":").map(Number) as V3; return Math.hypot(q[0] - r.a[0], q[1] - r.a[1], q[2] - r.a[2]) < grenze; });
        const tAbzweig = [a, b].some((e) => segAbstand(e, e, c, d).d < EPS) || [c, d].some((e) => segAbstand(e, e, a, b).d < EPS);
        const kollinear = achsen(a, b).length === 1 && achsen(c, d).length === 1 && achsen(a, b)[0] === achsen(c, d)[0] && r.d < EPS;
        const ueberlappung = kollinear ? Math.min(Math.max(a[achsen(a, b)[0]], b[achsen(a, b)[0]]), Math.max(c[achsen(a, b)[0]], d[achsen(a, b)[0]]))
          - Math.max(Math.min(a[achsen(a, b)[0]], b[achsen(a, b)[0]]), Math.min(c[achsen(a, b)[0]], d[achsen(a, b)[0]])) : 0;
        if (ueberlappung > 0.01 || (!tAbzweig && !nahGemeinsam)) hart("abstand", [l.id, m.id], r.a);
        continue;
      }
      if (r.d < grenze - EPS) {
        if (!imNahbereich(r.a, l, m, koerper)) hart("abstand", [l.id, m.id], r.a);
      } else if (Math.abs(a[1] - b[1]) < EPS && Math.abs(c[1] - d[1]) < EPS && Math.abs(a[1] - c[1]) < 0.5 && kreuztImGrundriss(a, b, c, d)) {
        befunde.push({ regel: "kreuzung", leitungen: [l.id, m.id], ort: r.a, hart: false });
      }
    }
  }
  return befunde;
}
```

- [ ] **Step 6: Pruefer-Tests laufen lassen**

Run: `npm.cmd test -- src/szene3/router/pruefer.test.ts`
Expected: PASS (11 Tests). Faellt einer, Pruefer korrigieren, nicht den Test.

- [ ] **Step 7: Geraetekoerper, Testkatalog, Zufallswelt** – drei Dateien

`szene3/router/koerper.ts`:
```ts
import type { KatalogEintrag, Welt } from "../../typen";
import { modellVon, type AnzeigeSymbol } from "../technik";
import { GRENZEN, type Koerper } from "./typen";

/** Abgaben (Heizkoerper, FBH, TABS) und Teile in der Leitung sind Leitungsenden, keine Hindernisse. */
const KEIN_HINDERNIS = new Set(["heizung.heizkoerper", "heizung.fbh_kreis", "heizung.tabs_feld"]);

/** Geraetekoerper: Ursprung Mitte Unterkante (wie GLB), Masse aus Modell/Katalog, plus Zuschlag [A]. */
export function geraeteKoerper(welt: Welt, katalog: KatalogEintrag[]): Koerper[] {
  const z = GRENZEN.geraetZuschlag;
  return [...welt.symbole].sort((a, b) => (a.schluessel < b.schluessel ? -1 : 1))
    .filter((s) => !KEIN_HINDERNIS.has(s.katalogId) && !(s as AnzeigeSymbol).inline)
    .map((s) => {
      const [b, h, t] = modellVon(s, katalog).masse, p = s.position;
      return { schluessel: s.schluessel, min: [p.x - b / 2 - z, p.y, p.z - t / 2 - z], max: [p.x + b / 2 + z, p.y + h, p.z + t / 2 + z] };
    });
}
```

`szene3/router/testKatalog.ts` (Kopie des Katalogs aus `gruppenNetz.test.ts`):
```ts
import type { KatalogEintrag } from "../../typen";
export const TEST_KATALOG: KatalogEintrag[] = [
  { id: "heizung.waermepumpe", name: "Wärmepumpe", bereich: "zentrale" },
  { id: "heizung.speicher", name: "Speicher", bereich: "zentrale" },
  { id: "heizung.umwaelzpumpe", name: "Umwälzpumpe", bereich: "zubehoer" },
  { id: "heizung.verteiler", name: "Verteiler", bereich: "verteilung" },
  { id: "heizung.heizkoerper", name: "Heizkörper", bereich: "einheit" },
  { id: "heizung.fbh_kreis", name: "FBH-Kreis", bereich: "einheit" },
  { id: "heizung.ventil_3weg", name: "3-Weg-Ventil", bereich: "zubehoer" },
  { id: "heizung.ventil_2weg", name: "Durchgangsventil", bereich: "zubehoer" },
  { id: "heizung.wmz", name: "Wärmezähler", bereich: "zubehoer" },
];
```

`szene3/router/zufallsWelt.ts`:
```ts
import type { Welt, WeltGruppe, WeltSymbol } from "../../typen";
import { verteilerLaenge } from "../technik";

/** mulberry32: reproduzierbarer Zufall aus einem Startwert. */
export function zufall(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const sym = (schluessel: string, id: string, x: number, y: number, z: number): WeltSymbol => ({
  schluessel, katalogId: `heizung.${id}`, position: { x, y, z }, versorgt: [], bauteilIds: [`b-${schluessel}`],
  mengeSumme: 1, mengeUnbekannt: false, hersteller: null, typ: null, status: "bestaetigt",
});

/**
 * Zufallswelt fuer Router-Tests: 20 x 12 m, 1–4 Geschosse, Zentrale 6 x 5 m im EG mit WP, Speicher, Verteiler an
 * zufaelligen, ueberlappungsfreien Orten; 1–6 Gruppen mit je 1–3 Heizkoerpern in zufaelligen Einheiten.
 */
export function zufallsWelt(seed: number): Welt {
  const r = zufall(seed), wahl = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const nGeschosse = 1 + Math.floor(r() * 4), nGruppen = 1 + Math.floor(r() * 6);
  const geschosse = Array.from({ length: nGeschosse }, (_, i) => ({ id: `g${i}`, code: i ? `OG${i}` : "EG", yUnten: i * 3.2, hoehe: 3.2 }));
  const einheiten: Welt["einheiten"] = [];
  for (const g of geschosse) {
    const teile = g.id === "g0"
      ? [{ id: "technik", x: 0, z: 0, b: 6, t: 5 }, { id: "g0-flur", x: 0, z: 5, b: 6, t: 7 }, { id: "g0-a", x: 6, z: 0, b: 7, t: 12 }, { id: "g0-b", x: 13, z: 0, b: 7, t: 12 }]
      : [{ id: `${g.id}-a`, x: 0, z: 0, b: 7, t: 12 }, { id: `${g.id}-b`, x: 7, z: 0, b: 7, t: 12 }, { id: `${g.id}-c`, x: 14, z: 0, b: 6, t: 12 }];
    for (const e of teile) einheiten.push({ id: e.id, geschossId: g.id, bezeichnung: e.id, art: e.id === "technik" ? "technik" : "buero",
      rechteck: { x: e.x, z: e.z, breite: e.b, tiefe: e.t }, quelle: "schematisch" });
  }
  // Zentrale-Geraete per Verwerfungsstichprobe, 0.3 m Wandabstand, 0.4 m untereinander [A].
  const geraete: { key: string; id: string; b: number; t: number }[] = [
    { key: "WP", id: "waermepumpe", b: 1, t: 0.6 }, { key: "SP", id: "speicher", b: 0.9, t: 0.9 }, { key: "V", id: "verteiler", b: verteilerLaenge(nGruppen), t: 0.3 }];
  const gesetzt: { x: number; z: number; b: number; t: number }[] = [];
  const symbole: WeltSymbol[] = [];
  for (const g of geraete) {
    for (let versuch = 0; versuch < 500; versuch++) {
      const x = 0.3 + g.b / 2 + r() * (6 - 0.6 - g.b), z = 0.3 + g.t / 2 + r() * (5 - 0.6 - g.t);
      if (gesetzt.some((o) => Math.abs(o.x - x) < (o.b + g.b) / 2 + 0.4 && Math.abs(o.z - z) < (o.t + g.t) / 2 + 0.4)) continue;
      gesetzt.push({ x, z, b: g.b, t: g.t }); symbole.push(sym(g.key, g.id, x, 0, z)); break;
    }
  }
  const raeume = einheiten.filter((e) => e.id !== "technik");
  const gruppen: WeltGruppe[] = [];
  let hk = 0;
  for (let i = 1; i <= nGruppen; i++) {
    const verbraucher: string[] = [];
    for (let k = 0, n = 1 + Math.floor(r() * 3); k < n; k++) {
      const e = wahl(raeume), g = geschosse.find((x) => x.id === e.geschossId)!;
      const key = `HK${++hk}`;
      symbole.push(sym(key, "heizkoerper", e.rechteck.x + 0.8 + r() * (e.rechteck.breite - 1.6), g.yUnten, e.rechteck.z + 0.2));
      verbraucher.push(key);
    }
    gruppen.push({ id: `gr${i}`, verteiler: "V", nummer: i, art: "ungeregelt", bezeichnung: `Gruppe ${i}`, verbraucher, zubehoer: [] });
  }
  return { regelwerkVersion: 2, hash: `zufall-${seed}`, grundriss: [{ x: 0, z: 0, breite: 20, tiefe: 12 }], hinweise: [],
    geschosse, einheiten, symbole, gruppen, steigzone: { x: 5.5, z: 4.5 } };
}
```

- [ ] **Step 8: Ist-Messung als Test** – `szene3/router/messung.test.ts`

```ts
import { describe, expect, it } from "vitest";
import type { Welt } from "../../typen";
import { rohrnetz } from "../netz";
import { geraeteKoerper } from "./koerper";
import { alsPrueflinien, pruefen } from "./pruefer";
import { TEST_KATALOG } from "./testKatalog";
import { zufallsWelt } from "./zufallsWelt";

const dateien = import.meta.glob<Welt>("../../fixtures/muster-*.json", { eager: true, import: "default" });

/** Misst Befunde je Regel; aendert nichts. Ab Task 8 durch harte Zusicherungen ersetzt. */
describe("Ist-Messung Leitungsfuehrung", () => {
  it("zaehlt Befunde in Mustern und 200 Zufallswelten", () => {
    const zaehler: Record<string, number> = {};
    const welten = [...Object.values(dateien).map((w) => structuredClone(w)), ...Array.from({ length: 200 }, (_, i) => zufallsWelt(i + 1))];
    for (const w of welten) {
      for (const b of pruefen(alsPrueflinien(rohrnetz(w, TEST_KATALOG, {})), geraeteKoerper(w, TEST_KATALOG))) zaehler[b.regel] = (zaehler[b.regel] ?? 0) + 1;
    }
    console.table(zaehler);
    expect(welten.length).toBe(Object.keys(dateien).length + 200);
  });
});
```

- [ ] **Step 9: Messung laufen lassen und Werte notieren**

Run: `npm.cmd test -- src/szene3/router/messung.test.ts`
Expected: PASS; Tabelle zeigt Befunde > 0 (vor allem `abstand`/`kreuzung` aus Hauptleitungen). Werte in `docs/superpowers/plans/2026-11-13-leitungsrouter.md` unter "Messwerte" (Ende dieser Datei) eintragen.

- [ ] **Step 10: Alle Webtests und Typpruefung**

Run: `npm.cmd test` und `npx.cmd tsc --noEmit -p .` (in `app/web`)
Expected: alle gruen.

- [ ] **Step 11: Commit**

```bash
git add app/web/src/szene3/router docs/superpowers/plans/2026-11-13-leitungsrouter.md
git commit -m "Leitungsrouter T1: Pruefer, Zufallswelten, Ist-Messung

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Topologie als Baum

**Files:**
- Create: `szene3/router/topologie.ts`
- Test: `szene3/router/topologie.test.ts`

**Interfaces:**
- Produces: `interface Kante { von: string; nach: string; art: "haupt" | "verteil"; gruppeId?: string }`, `alsBaum(kanten: Kante[]): { kanten: Kante[]; verworfen: Kante[] }`

- [ ] **Step 1: Failing Test**

```ts
import { describe, expect, it } from "vitest";
import { alsBaum, type Kante } from "./topologie";

const k = (von: string, nach: string): Kante => ({ von, nach, art: "haupt" });

describe("alsBaum", () => {
  it("Kette bleibt vollstaendig", () => {
    expect(alsBaum([k("WP", "SP"), k("SP", "V")]).kanten).toHaveLength(2);
  });
  it("Zyklus wird verworfen", () => {
    const r = alsBaum([k("WP", "SP"), k("SP", "V"), k("V", "WP")]);
    expect(r.kanten).toHaveLength(2);
    expect(r.verworfen).toEqual([k("V", "WP")]);
  });
  it("zweiter Vorgaenger wird verworfen", () => {
    expect(alsBaum([k("A", "V"), k("B", "V")]).verworfen).toEqual([k("B", "V")]);
  });
  it("Selbstkante wird verworfen", () => {
    expect(alsBaum([k("A", "A")]).verworfen).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Test laufen lassen, muss fehlschlagen**

Run: `npm.cmd test -- src/szene3/router/topologie.test.ts` – Expected: FAIL (Import fehlt).

- [ ] **Step 3: Implementieren** – `szene3/router/topologie.ts`

```ts
export interface Kante { von: string; nach: string; art: "haupt" | "verteil"; gruppeId?: string }

/** Nimmt Kanten in gegebener Reihenfolge an, solange jeder Knoten hoechstens einen Vorgaenger hat und kein Zyklus entsteht. */
export function alsBaum(kanten: Kante[]): { kanten: Kante[]; verworfen: Kante[] } {
  const vorgaenger = new Map<string, string>();
  const ok: Kante[] = [], verworfen: Kante[] = [];
  const erreicht = (start: string, ziel: string) => {
    for (let k: string | undefined = start, n = 0; k !== undefined && n <= vorgaenger.size; k = vorgaenger.get(k), n++) if (k === ziel) return true;
    return false;
  };
  for (const k of kanten) {
    if (k.von === k.nach || vorgaenger.has(k.nach) || erreicht(k.von, k.nach)) { verworfen.push(k); continue; }
    vorgaenger.set(k.nach, k.von); ok.push(k);
  }
  return { kanten: ok, verworfen };
}
```

- [ ] **Step 4: Test laufen lassen** – Expected: PASS (4).
- [ ] **Step 5: Commit** – `git add app/web/src/szene3/router/topologie*.ts`, Nachricht `Leitungsrouter T2: Topologie als Baum` + Co-Authored-By-Zeile.

---

### Task 3: Raster und Belegung

**Files:**
- Create: `szene3/router/raster.ts`
- Test: `szene3/router/raster.test.ts`

**Interfaces:**
- Consumes: `Koerper`, `GRENZEN`, `ROUTER` (Task 1); `innenwaende(welt, geschossId, y, hoehe)` aus `szene3/geometrie.ts` (liefert `Quader { mitte: V3; groesse: V3 }`); `deckenLauf(g)` aus `szene3/technik.ts`.
- Produces:
  - `interface Gitter { x0: number; z0: number; nx: number; nz: number; innen: Uint8Array }`
  - `gitterFuer(welt: Welt): Gitter`, `zelleVon(g: Gitter, x: number, z: number): [number, number]`, `mitteVon(g: Gitter, i: number, k: number): [number, number]`
  - `ebenenFuer(welt: Welt): Map<string, number[]>` – je Geschoss `[Leitungsebene, Ausweichebene]`
  - `class Belegung` mit `belegen(punkte: V3[], netz: string)`, `geraete(koerper: Koerper[])`, `waende(welt: Welt)`, `frei(y, i, k, netz): boolean`, `eigen(y, i, k, netz): boolean`, `zusatz(y, i, k): number`, `readonly gitter`, `readonly ebenen: number[]`

- [ ] **Step 1: Failing Test**

```ts
import { describe, expect, it } from "vitest";
import type { Welt } from "../../typen";
import { Belegung, ebenenFuer, gitterFuer, mitteVon, zelleVon } from "./raster";

const welt: Welt = { regelwerkVersion: 2, hash: "r", grundriss: [{ x: 0, z: 0, breite: 3, tiefe: 2 }], hinweise: [], symbole: [],
  geschosse: [{ id: "eg", code: "EG", yUnten: 0, hoehe: 3.2 }],
  einheiten: [{ id: "a", geschossId: "eg", bezeichnung: "a", art: "x", rechteck: { x: 0, z: 0, breite: 1.5, tiefe: 2 }, quelle: "schematisch" },
    { id: "b", geschossId: "eg", bezeichnung: "b", art: "x", rechteck: { x: 1.5, z: 0, breite: 1.5, tiefe: 2 }, quelle: "schematisch" }] };

describe("raster", () => {
  it("Zellen und Mitten sind invers", () => {
    const g = gitterFuer(welt);
    const [i, k] = zelleVon(g, 1.0, 0.5);
    const [x, z] = mitteVon(g, i, k);
    expect(Math.abs(x - 1.0)).toBeLessThanOrEqual(0.045 + 1e-9);
    expect(Math.abs(z - 0.5)).toBeLessThanOrEqual(0.045 + 1e-9);
  });
  it("Randzellen naeher als 0.15 m an der Aussenwand sind gesperrt", () => {
    const g = gitterFuer(welt), [i, k] = zelleVon(g, 0.05, 1);
    expect(g.innen[k * g.nx + i]).toBe(0);
  });
  it("Ebenen: Leitungsebene 2.8 und Ausweichebene 2.55", () => {
    expect(ebenenFuer(welt).get("eg")).toEqual([2.8, 2.55]);
  });
  it("verlegtes Rohr sperrt Achse und Nachbarzellen fuer fremde Netze", () => {
    const b = new Belegung(welt);
    b.belegen([[0.5, 2.8, 1], [2.5, 2.8, 1]], "n1");
    const g = b.gitter, [i, k] = zelleVon(g, 1.5, 1);
    expect(b.frei(2.8, i, k, "n2")).toBe(false);
    expect(b.frei(2.8, i, k + 1, "n2")).toBe(false);
    expect(b.frei(2.8, i, k + 2, "n2")).toBe(true);
    expect(b.frei(2.8, i, k, "n1")).toBe(true);
    expect(b.eigen(2.8, i, k, "n1")).toBe(true);
    expect(b.frei(2.55, i, k, "n2")).toBe(true);
  });
  it("Steigrohr sperrt beide Ebenen", () => {
    const b = new Belegung(welt), [i, k] = zelleVon(b.gitter, 1, 1);
    b.belegen([[1, 0.5, 1], [1, 2.8, 1]], "n1");
    expect(b.frei(2.8, i, k, "n2")).toBe(false);
    expect(b.frei(2.55, i, k, "n2")).toBe(false);
  });
  it("Innenwand kostet Zuschlag", () => {
    const b = new Belegung(welt); b.waende(welt);
    const [i, k] = zelleVon(b.gitter, 1.5, 1);
    expect(b.zusatz(2.8, i, k)).toBeGreaterThan(0);
  });
  it("hohes Geraet sperrt, niedriges nicht", () => {
    const b = new Belegung(welt);
    b.geraete([{ schluessel: "hoch", min: [0.5, 0, 0.5], max: [1, 2.7, 1] }, { schluessel: "tief", min: [2, 0, 0.5], max: [2.5, 1.2, 1] }]);
    const [i1, k1] = zelleVon(b.gitter, 0.75, 0.75), [i2, k2] = zelleVon(b.gitter, 2.25, 0.75);
    expect(b.frei(2.8, i1, k1, "n")).toBe(false);
    expect(b.frei(2.8, i2, k2, "n")).toBe(true);
  });
});
```

- [ ] **Step 2: Test laufen lassen, muss fehlschlagen** – `npm.cmd test -- src/szene3/router/raster.test.ts`
- [ ] **Step 3: Implementieren** – `szene3/router/raster.ts`

```ts
import type { Welt } from "../../typen";
import { innenwaende } from "../geometrie";
import { deckenLauf, ROHR } from "../technik";
import { GRENZEN, ROUTER, type Koerper, type V3 } from "./typen";

export interface Gitter { x0: number; z0: number; nx: number; nz: number; innen: Uint8Array }
const Z = ROUTER.zelle;

export function gitterFuer(welt: Welt): Gitter {
  const r = welt.grundriss;
  const x0 = Math.min(...r.map((q) => q.x)), z0 = Math.min(...r.map((q) => q.z));
  const nx = Math.ceil((Math.max(...r.map((q) => q.x + q.breite)) - x0) / Z), nz = Math.ceil((Math.max(...r.map((q) => q.z + q.tiefe)) - z0) / Z);
  const innen = new Uint8Array(nx * nz), m = ROUTER.aussenRand;
  for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
    const x = x0 + (i + 0.5) * Z, z = z0 + (k + 0.5) * Z;
    if (r.some((q) => x >= q.x + m && x <= q.x + q.breite - m && z >= q.z + m && z <= q.z + q.tiefe - m)) innen[k * nx + i] = 1;
  }
  return { x0, z0, nx, nz, innen };
}
export const zelleVon = (g: Gitter, x: number, z: number): [number, number] =>
  [Math.min(g.nx - 1, Math.max(0, Math.floor((x - g.x0) / Z))), Math.min(g.nz - 1, Math.max(0, Math.floor((z - g.z0) / Z)))];
export const mitteVon = (g: Gitter, i: number, k: number): [number, number] => [g.x0 + (i + 0.5) * Z, g.z0 + (k + 0.5) * Z];

/** Je Geschoss: [Leitungsebene unter der Decke, Ausweichebene 0.25 m tiefer]. */
export function ebenenFuer(welt: Welt): Map<string, number[]> {
  return new Map(welt.geschosse.map((g) => { const y = deckenLauf(g); return [g.id, [y, +(y - ROUTER.ausweich).toFixed(4)]]; }));
}
const ek = (y: number) => Math.round(y * 1000);

export class Belegung {
  readonly gitter: Gitter;
  readonly ebenen: number[];
  private achse = new Map<string, string>();
  private sperre = new Map<string, Set<string>>();
  private kosten = new Map<string, number>();
  constructor(welt: Welt) {
    this.gitter = gitterFuer(welt);
    this.ebenen = [...ebenenFuer(welt).values()].flat().sort((a, b) => a - b);
  }
  private key(y: number, i: number, k: number) { return `${ek(y)}:${i}:${k}`; }
  private sperren(y: number, i: number, k: number, netz: string) {
    for (let di = -1; di <= 1; di++) for (let dk = -1; dk <= 1; dk++) {
      const ii = i + di, kk = k + dk;
      if (ii < 0 || kk < 0 || ii >= this.gitter.nx || kk >= this.gitter.nz) continue;
      const key = this.key(y, ii, kk), s = this.sperre.get(key) ?? new Set<string>();
      s.add(netz); this.sperre.set(key, s);
    }
    this.achse.set(this.key(y, i, k), netz);
  }
  /** Traegt ein Rohr ein: waagrecht auf seiner Ebene, senkrecht auf allen Ebenen im Hoehenbereich. */
  belegen(punkte: V3[], netz: string) {
    for (let n = 1; n < punkte.length; n++) {
      const a = punkte[n - 1], b = punkte[n];
      if (Math.abs(a[1] - b[1]) > 1e-6 && Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[2] - b[2]) < 1e-6) {
        const [i, k] = zelleVon(this.gitter, a[0], a[2]);
        const lo = Math.min(a[1], b[1]) - ROHR.haupt, hi = Math.max(a[1], b[1]) + ROHR.haupt;
        for (const y of this.ebenen) if (y >= lo && y <= hi) this.sperren(y, i, k, netz);
        continue;
      }
      if (Math.abs(a[1] - b[1]) > 1e-6) continue;
      const y = this.ebenen.find((e) => Math.abs(e - a[1]) < 0.01);
      if (y === undefined) continue;
      const [i0, k0] = zelleVon(this.gitter, a[0], a[2]), [i1, k1] = zelleVon(this.gitter, b[0], b[2]);
      const schritte = Math.max(Math.abs(i1 - i0), Math.abs(k1 - k0));
      for (let s = 0; s <= schritte; s++) {
        const t = schritte ? s / schritte : 0;
        this.sperren(y, Math.round(i0 + (i1 - i0) * t), Math.round(k0 + (k1 - k0) * t), netz);
      }
    }
  }
  /** Geraete sperren eine Ebene nur, wenn darueber weniger als 0.15 m Luft bleibt (Spec 9, PO-bestaetigt). */
  geraete(koerper: Koerper[]) {
    for (const k of koerper) for (const y of this.ebenen) {
      if (y - ROHR.haupt >= k.max[1] + GRENZEN.luftUeberGeraet || y + ROHR.haupt <= k.min[1]) continue;
      const [i0, k0] = zelleVon(this.gitter, k.min[0], k.min[2]), [i1, k1] = zelleVon(this.gitter, k.max[0], k.max[2]);
      for (let i = i0; i <= i1; i++) for (let kk = k0; kk <= k1; kk++) {
        const key = this.key(y, i, kk), s = this.sperre.get(key) ?? new Set<string>();
        s.add(`geraet:${k.schluessel}`); this.sperre.set(key, s);
      }
    }
  }
  /** Innenwaende: passierbar mit Zuschlag je Zelle [A]. */
  waende(welt: Welt) {
    for (const g of welt.geschosse) {
      const ys = this.ebenen.filter((y) => y >= g.yUnten && y < g.yUnten + g.hoehe);
      for (const w of innenwaende(welt, g.id, g.yUnten, g.hoehe)) {
        const [i0, k0] = zelleVon(this.gitter, w.mitte[0] - w.groesse[0] / 2, w.mitte[2] - w.groesse[2] / 2);
        const [i1, k1] = zelleVon(this.gitter, w.mitte[0] + w.groesse[0] / 2, w.mitte[2] + w.groesse[2] / 2);
        for (const y of ys) for (let i = i0; i <= i1; i++) for (let k = k0; k <= k1; k++) this.kosten.set(this.key(y, i, k), ROUTER.wand);
      }
    }
  }
  frei(y: number, i: number, k: number, netz: string): boolean {
    if (i < 0 || k < 0 || i >= this.gitter.nx || k >= this.gitter.nz || !this.gitter.innen[k * this.gitter.nx + i]) return false;
    const s = this.sperre.get(this.key(y, i, k));
    return !s || [...s].every((n) => n === netz);
  }
  eigen(y: number, i: number, k: number, netz: string): boolean { return this.achse.get(this.key(y, i, k)) === netz; }
  zusatz(y: number, i: number, k: number): number { return this.kosten.get(this.key(y, i, k)) ?? 0; }
}
```

Hinweis: Haben die Innenwaende im Test keine Dicke in x (`groesse[0]` klein), deckt `zelleVon` trotzdem mindestens eine Zelle ab. Schlaegt der Wandtest fehl, `innenwaende` im Test ausgeben und Zellbereich pruefen.

- [ ] **Step 4: Test laufen lassen** – Expected: PASS (7).
- [ ] **Step 5: Commit** – `Leitungsrouter T3: Raster und Belegung`.

---

### Task 4: A*-Wegsuche

**Files:**
- Create: `szene3/router/astern.ts`
- Test: `szene3/router/astern.test.ts`

**Interfaces:**
- Consumes: `Belegung`, `zelleVon`, `mitteVon` (Task 3), `ROUTER` (Task 1).
- Produces:
  - `interface Zelle { y: number; i: number; k: number }`
  - `interface Vorzug { achse: 0 | 2; wert: number }` (Spurlinie: Zellen mit Koordinate quer zur Achse = `wert` sind guenstiger)
  - `suchen(b: Belegung, start: Zelle, ziel: Zelle | null, istZiel: (z: Zelle) => boolean, netz: string, ebenen: number[], vorzug?: Vorzug): Zelle[] | null`

- [ ] **Step 1: Failing Test**

```ts
import { describe, expect, it } from "vitest";
import type { Welt } from "../../typen";
import { suchen, type Zelle } from "./astern";
import { Belegung, zelleVon } from "./raster";

const welt: Welt = { regelwerkVersion: 2, hash: "a", grundriss: [{ x: 0, z: 0, breite: 6, tiefe: 4 }], hinweise: [], symbole: [], einheiten: [],
  geschosse: [{ id: "eg", code: "EG", yUnten: 0, hoehe: 3.2 }] };
const zelle = (b: Belegung, x: number, z: number, y = 2.8): Zelle => { const [i, k] = zelleVon(b.gitter, x, z); return { y, i, k }; };
const ziel = (z: Zelle) => (c: Zelle) => c.y === z.y && c.i === z.i && c.k === z.k;
const boegen = (w: Zelle[]) => { let n = 0; for (let j = 2; j < w.length; j++) { const d1 = [w[j - 1].i - w[j - 2].i, w[j - 1].k - w[j - 2].k], d2 = [w[j].i - w[j - 1].i, w[j].k - w[j - 1].k]; if (d1[0] !== d2[0] || d1[1] !== d2[1]) n++; } return n; };

describe("suchen", () => {
  it("freier Raum: Weg mit hoechstens einem Bogen", () => {
    const b = new Belegung(welt), s = zelle(b, 1, 1), z = zelle(b, 5, 3);
    const w = suchen(b, s, z, ziel(z), "n", [2.8, 2.55])!;
    expect(w[0]).toEqual(s); expect(w.at(-1)).toEqual(z);
    expect(boegen(w)).toBeLessThanOrEqual(1);
  });
  it("weicht fremdem Rohr ueber die Ausweichebene oder seitlich aus, nie hindurch", () => {
    const b = new Belegung(welt);
    b.belegen([[3, 2.8, 0.2], [3, 2.8, 3.8]], "fremd");
    const s = zelle(b, 1, 2), z = zelle(b, 5, 2);
    const w = suchen(b, s, z, ziel(z), "n", [2.8, 2.55])!;
    expect(w).not.toBeNull();
    for (const c of w) expect(b.frei(c.y, c.i, c.k, "n") || (c.i === s.i && c.k === s.k) || (c.i === z.i && c.k === z.k)).toBe(true);
  });
  it("bevorzugt die eigene Spur", () => {
    const b = new Belegung(welt), s = zelle(b, 1, 1), z = zelle(b, 5, 1);
    const w = suchen(b, s, z, ziel(z), "n", [2.8, 2.55], { achse: 0, wert: 2.5 })!;
    expect(w.some((c) => Math.abs(b.gitter.z0 + (c.k + 0.5) * 0.09 - 2.5) < 0.05)).toBe(true);
  });
  it("Mehrfachziel: endet auf eigenem Netz", () => {
    const b = new Belegung(welt);
    b.belegen([[0.5, 2.8, 3], [5.5, 2.8, 3]], "n");
    const s = zelle(b, 2, 0.5);
    const w = suchen(b, s, null, (c) => b.eigen(c.y, c.i, c.k, "n"), "n", [2.8, 2.55])!;
    expect(b.eigen(w.at(-1)!.y, w.at(-1)!.i, w.at(-1)!.k, "n")).toBe(true);
  });
  it("vollstaendig blockiert: null", () => {
    const b = new Belegung(welt);
    for (const y of [2.8, 2.55]) b.belegen([[3, y, 0.1], [3, y, 3.9]], "wand");
    b.belegen([[3, 0, 0.1], [3, 2.8, 0.1]], "wand");
    const s = zelle(b, 1, 2), z = zelle(b, 5, 2);
    expect(suchen(b, s, z, ziel(z), "n", [2.8, 2.55])).toBeNull();
  });
});
```

Hinweis zum letzten Test: Eine Linie je Ebene sperrt den Durchgang auf beiden Ebenen; wenn Randzellen (`innen` = 0) die Luecke an den Enden schliessen, ist der Test deterministisch. Falls nicht, die Linie von z=0.05 bis z=3.95 ziehen.

- [ ] **Step 2: Test laufen lassen, muss fehlschlagen.**
- [ ] **Step 3: Implementieren** – `szene3/router/astern.ts`

```ts
import { mitteVon, type Belegung } from "./raster";
import { ROUTER } from "./typen";

export interface Zelle { y: number; i: number; k: number }
export interface Vorzug { achse: 0 | 2; wert: number }

const DI = [1, -1, 0, 0], DK = [0, 0, 1, -1];

/** Binaerer Min-Heap mit stabiler Reihenfolge (Kosten, dann Einfuegezaehler) fuer Determinismus. */
class Heap {
  private d: { f: number; n: number; s: number }[] = [];
  private zaehler = 0;
  get leer() { return this.d.length === 0; }
  push(f: number, s: number) {
    const e = { f, n: this.zaehler++, s }; this.d.push(e);
    let i = this.d.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (this.kleiner(this.d[p], e)) break; this.d[i] = this.d[p]; i = p; }
    this.d[i] = e;
  }
  pop(): number {
    const top = this.d[0], last = this.d.pop()!;
    if (this.d.length) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        const cand = (j: number) => j < this.d.length && this.kleiner(this.d[j], m === i ? last : this.d[m]);
        if (cand(l)) m = l; if (cand(r)) m = r;
        if (m === i) break;
        this.d[i] = this.d[m]; i = m;
      }
      this.d[i] = last;
    }
    return top.s;
  }
  private kleiner(a: { f: number; n: number }, b: { f: number; n: number }) { return a.f < b.f || (a.f === b.f && a.n < b.n); }
}

/**
 * A* auf dem Raster. Zustand: Ebene, Zelle, Richtung (0..3, 4 = keine). Kosten in Metern:
 * Schritt Zelle × (Spurfaktor auf eigener Spur), Bogen, Ebenenwechsel (nicht in Start-/Zielzelle), Wandzuschlag.
 * Start- und Zielzelle gelten immer als frei (Anschluesse liegen oft am Rand eines Geraetes).
 */
export function suchen(b: Belegung, start: Zelle, ziel: Zelle | null, istZiel: (z: Zelle) => boolean, netz: string, ebenen: number[], vorzug?: Vorzug): Zelle[] | null {
  const { nx, nz } = b.gitter, ne = ebenen.length, Z = ROUTER.zelle;
  const e0 = ebenen.findIndex((y) => Math.abs(y - start.y) < 0.01);
  if (e0 < 0) return null;
  const id = (e: number, i: number, k: number, r: number) => (((e * nz + k) * nx + i) * 5 + r);
  const n = ne * nz * nx * 5;
  const g = new Float64Array(n).fill(Infinity), von = new Int32Array(n).fill(-1);
  const h = (i: number, k: number) => (ziel ? (Math.abs(i - ziel.i) + Math.abs(k - ziel.k)) * Z : 0);
  const istStartOderZiel = (i: number, k: number) => (i === start.i && k === start.k) || (!!ziel && i === ziel.i && k === ziel.k);
  const frei = (e: number, i: number, k: number) => istStartOderZiel(i, k) || b.frei(ebenen[e], i, k, netz);
  const aufSpur = (i: number, k: number) => {
    if (!vorzug) return false;
    const [x, z] = mitteVon(b.gitter, i, k);
    return Math.abs((vorzug.achse === 0 ? z : x) - vorzug.wert) < Z / 2 + 1e-9;
  };
  const heap = new Heap();
  const s0 = id(e0, start.i, start.k, 4);
  g[s0] = 0; heap.push(h(start.i, start.k), s0);
  while (!heap.leer) {
    const s = heap.pop();
    const r = s % 5, rest = (s - r) / 5, i = rest % nx, rest2 = (rest - i) / nx, k = rest2 % nz, e = (rest2 - k) / nz;
    const zelle = { y: ebenen[e], i, k };
    if (s !== s0 && istZiel(zelle) && e === e0) {
      const weg: Zelle[] = [];
      for (let t = s; t >= 0; t = von[t]) { const rr = t % 5, a = (t - rr) / 5, ii = a % nx, a2 = (a - ii) / nx, kk = a2 % nz; weg.push({ y: ebenen[(a2 - kk) / nz], i: ii, k: kk }); }
      return weg.reverse().filter((c, j, w) => j === 0 || c.y !== w[j - 1].y || c.i !== w[j - 1].i || c.k !== w[j - 1].k);
    }
    const gs = g[s];
    for (let d = 0; d < 4; d++) {
      const ii = i + DI[d], kk = k + DK[d];
      if (ii < 0 || kk < 0 || ii >= nx || kk >= nz || !frei(e, ii, kk)) continue;
      if (r !== 4 && DI[d] === -DI[r] && DK[d] === -DK[r]) continue;
      const kosten = Z * (aufSpur(ii, kk) ? ROUTER.spurFaktor : 1) + (r !== 4 && r !== d ? ROUTER.bogen : 0) + b.zusatz(ebenen[e], ii, kk);
      const t = id(e, ii, kk, d);
      if (gs + kosten < g[t]) { g[t] = gs + kosten; von[t] = s; heap.push(g[t] + h(ii, kk), t); }
    }
    if (r !== 4 && !istStartOderZiel(i, k)) for (let e2 = 0; e2 < ne; e2++) {
      if (e2 === e || !frei(e2, i, k)) continue;
      const t = id(e2, i, k, r);
      if (gs + ROUTER.ebenenwechsel < g[t]) { g[t] = gs + ROUTER.ebenenwechsel; von[t] = s; heap.push(g[t] + h(i, k), t); }
    }
  }
  return null;
}
```

Hinweis: Ziel muss auf der Startebene `e0` liegen (`e === e0`); damit kehrt jeder Ausweich-Abschnitt auf die Leitungsebene zurueck.

- [ ] **Step 4: Test laufen lassen** – Expected: PASS (5). Laufzeit des Tests notieren.
- [ ] **Step 5: Commit** – `Leitungsrouter T4: A*-Wegsuche`.

---

### Task 5: Trasse und Spurvergabe (Left-Edge)

**Files:**
- Create: `szene3/router/trasse.ts`
- Test: `szene3/router/trasse.test.ts`

**Interfaces:**
- Consumes: `ROUTER`, `SPUR` aus `szene3/gruppenNetz.ts`, `Rechteck` aus `typen.ts`.
- Produces:
  - `interface Lage { achse: 0 | 2; wand: number; innen: 1 | -1 }`
  - `interface Auftrag { netz: string; von: number; bis: number }`
  - `trassenLage(raum: Rechteck, punkte: V3[]): Lage`
  - `spurenZuteilen(auftraege: Auftrag[]): Map<string, number>` (fehlende Netze = verschraenkt, ohne Spur)
  - `spurWert(lage: Lage, index: number): number`

- [ ] **Step 1: Failing Test**

```ts
import { describe, expect, it } from "vitest";
import { spurenZuteilen, spurWert, trassenLage } from "./trasse";

describe("trasse", () => {
  it("Trasse entlang der Laengsseite, an der naeheren Wand", () => {
    const l = trassenLage({ x: 0, z: 0, breite: 6, tiefe: 4 }, [[1, 2.8, 0.8], [5, 2.8, 1.2]]);
    expect(l).toEqual({ achse: 0, wand: 0, innen: 1 });
    expect(spurWert(l, 0)).toBeCloseTo(0.3);
    expect(spurWert(l, 2)).toBeCloseTo(0.66);
  });
  it("verschachtelt: aeusseres Intervall wandnah, inneres weiter innen", () => {
    const s = spurenZuteilen([{ netz: "innen", von: 2, bis: 3 }, { netz: "aussen", von: 1, bis: 5 }]);
    expect(s.get("aussen")).toBe(0);
    expect(s.get("innen")).toBe(1);
  });
  it("disjunkte Intervalle teilen eine Spur", () => {
    const s = spurenZuteilen([{ netz: "a", von: 0, bis: 1 }, { netz: "b", von: 2, bis: 3 }]);
    expect(s.get("a")).toBe(0); expect(s.get("b")).toBe(0);
  });
  it("verschraenkte Intervalle: das kuerzere erhaelt keine Spur", () => {
    const s = spurenZuteilen([{ netz: "lang", von: 0, bis: 4 }, { netz: "kurz", von: 3, bis: 5 }]);
    expect(s.get("lang")).toBe(0); expect(s.has("kurz")).toBe(false);
  });
  it("deterministisch bei gleicher Laenge", () => {
    const a = spurenZuteilen([{ netz: "b", von: 0, bis: 2 }, { netz: "a", von: 0, bis: 2 }]);
    expect([...a.entries()]).toEqual([["a", 0], ["b", 1]]);
  });
});
```

- [ ] **Step 2: Test laufen lassen, muss fehlschlagen.**
- [ ] **Step 3: Implementieren** – `szene3/router/trasse.ts`

```ts
import type { Rechteck } from "../../typen";
import { SPUR } from "../gruppenNetz";
import { ROUTER, type V3 } from "./typen";

export interface Lage { achse: 0 | 2; wand: number; innen: 1 | -1 }
export interface Auftrag { netz: string; von: number; bis: number }
const EPS = 1e-6;
const vergleich = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Trasse laeuft entlang der laengeren Raumseite an der Wand mit der kleinsten Abstandssumme zu den Anschluessen [A]. */
export function trassenLage(raum: Rechteck, punkte: V3[]): Lage {
  const achse: 0 | 2 = raum.breite >= raum.tiefe ? 0 : 2, q = achse === 0 ? 2 : 0;
  const w1 = achse === 0 ? raum.z : raum.x, w2 = achse === 0 ? raum.z + raum.tiefe : raum.x + raum.breite;
  const summe = (w: number) => punkte.reduce((s, p) => s + Math.abs(p[q] - w), 0);
  return summe(w2) < summe(w1) - EPS ? { achse, wand: w2, innen: -1 } : { achse, wand: w1, innen: 1 };
}
export const spurWert = (l: Lage, index: number) => +(l.wand + l.innen * (ROUTER.trasseWand + index * SPUR)).toFixed(6);

/**
 * Left-Edge fuer einseitige Anschluesse: Intervalle nach Laenge absteigend; umfassende Intervalle liegen wandnah,
 * enthaltene eine Spur weiter innen, disjunkte teilen sich eine Spur. Verschraenkte erhalten keine Spur (Rueckfall A*).
 */
export function spurenZuteilen(auftraege: Auftrag[]): Map<string, number> {
  const iv = auftraege.map((a) => ({ netz: a.netz, lo: Math.min(a.von, a.bis), hi: Math.max(a.von, a.bis) }))
    .sort((a, b) => (b.hi - b.lo) - (a.hi - a.lo) || vergleich(a.netz, b.netz));
  const gesetzt: { netz: string; lo: number; hi: number; spur: number }[] = [];
  for (const a of iv) {
    const enthalten = (x: { lo: number; hi: number }, y: { lo: number; hi: number }) => x.lo >= y.lo - EPS && x.hi <= y.hi + EPS;
    const verschraenkt = gesetzt.some((g) => Math.min(a.hi, g.hi) - Math.max(a.lo, g.lo) > EPS && !enthalten(a, g) && !enthalten(g, a));
    if (verschraenkt) continue;
    const umfassend = gesetzt.filter((g) => enthalten(a, g) && Math.min(a.hi, g.hi) - Math.max(a.lo, g.lo) > EPS);
    gesetzt.push({ ...a, spur: umfassend.length ? Math.max(...umfassend.map((g) => g.spur)) + 1 : 0 });
  }
  return new Map(gesetzt.sort((a, b) => vergleich(a.netz, b.netz)).map((g) => [g.netz, g.spur]));
}
```

Hinweis: Gleich lange, identische Intervalle gelten als gegenseitig enthalten; das zweite erhaelt Spur +1 (Test "deterministisch").

- [ ] **Step 4: Test laufen lassen** – Expected: PASS (5).
- [ ] **Step 5: Commit** – `Leitungsrouter T5: Trasse und Spurvergabe`.

---

### Task 6: LeitungsRouter

**Files:**
- Create: `szene3/router/router.ts`
- Test: `szene3/router/router.test.ts`

**Interfaces:**
- Consumes: Tasks 1–5; `bereinigen`, `SPUR`, `StrangZiel`, `StrangBaum` aus `szene3/gruppenNetz.ts`; `geschossBeiY` aus `szene2/leitungen.ts`.
- Produces: `class LeitungsRouter`
  - `constructor(welt: Welt, katalog: KatalogEintrag[])`
  - `readonly befunde: Befund[]`
  - `vorbelegen(punkte: V3[], netz: string): void`
  - `spurenFestlegen(auftraege: { netz: string; a: V3; b: V3 }[]): void` – nur fuer Zentrale-Geschoss
  - `weg(a: V3, b: V3, netz: string): V3[]` – immer ein Weg; bei Misserfolg L-Weg + Befund `kein_weg`
  - `wegZumNetz(u: V3, netz: string): V3[] | null` – vom eigenen Netz (Anfang) nach `u` (Ende)
  - `strang(start: V3, ziele: StrangZiel[], spur: number, steigzone: { x: number; z: number } | null, netz: string): StrangBaum`
  - `belegen(punkte: V3[], netz: string): void`

- [ ] **Step 1: Failing Test**

```ts
import { describe, expect, it } from "vitest";
import type { Welt } from "../../typen";
import { LeitungsRouter } from "./router";
import { pruefen } from "./pruefer";
import { TEST_KATALOG } from "./testKatalog";
import type { V3 } from "./typen";

const welt: Welt = { regelwerkVersion: 2, hash: "r", grundriss: [{ x: 0, z: 0, breite: 10, tiefe: 6 }], hinweise: [], symbole: [], einheiten: [],
  geschosse: [{ id: "eg", code: "EG", yUnten: 0, hoehe: 3.2 }, { id: "og", code: "OG1", yUnten: 3.2, hoehe: 3.2 }], steigzone: { x: 1, z: 1 } };
const L = (id: string, netz: string, punkte: V3[]) => ({ id, netz, punkte, radius: 0.045, enden: [] });

describe("LeitungsRouter", () => {
  it("weg beginnt und endet exakt auf den Anschlusspunkten, achsparallel", () => {
    const r = new LeitungsRouter(welt, TEST_KATALOG);
    const w = r.weg([1.03, 2.8, 2.02], [8.01, 2.8, 4.97], "n");
    expect(w[0]).toEqual([1.03, 2.8, 2.02]); expect(w.at(-1)).toEqual([8.01, 2.8, 4.97]);
    expect(pruefen([L("a", "n", w)], [])).toEqual([]);
  });
  it("zweite Leitung kreuzt die erste nicht und haelt Abstand", () => {
    const r = new LeitungsRouter(welt, TEST_KATALOG);
    const a = r.weg([2, 2.8, 1], [2, 2.8, 5], "a"); r.belegen(a, "a");
    const b = r.weg([1, 2.8, 3], [3, 2.8, 3], "b"); r.belegen(b, "b");
    expect(pruefen([L("a", "a", a), L("b", "b", b)], []).filter((x) => x.hart)).toEqual([]);
  });
  it("strang ueber zwei Geschosse: Steigleitung in der Steigzone, T-Abzweig im OG", () => {
    const r = new LeitungsRouter(welt, TEST_KATALOG);
    const baum = r.strang([2, 2.8, 2], [{ schluessel: "hk1", punkt: [8, 6, 5] }, { schluessel: "hk2", punkt: [5, 6, 1] }], 0, { x: 1, z: 1 }, "g1");
    const linien = baum.segmente.map((s, i) => L(`s${i}`, "g1", s));
    expect(pruefen(linien, []).filter((x) => x.hart)).toEqual([]);
    expect(baum.segmente.flat().some((p) => Math.abs(p[0] - 1) < 1e-6 && Math.abs(p[2] - 1) < 1e-6 && p[1] > 5)).toBe(true);
    expect(baum.abzweige.map((a) => a.schluessel).sort()).toEqual(["hk1", "hk2"]);
  });
  it("blockierter Weg erzeugt Befund kein_weg und trotzdem eine Polylinie", () => {
    const r = new LeitungsRouter(welt, TEST_KATALOG);
    for (const y of [2.8, 2.55]) r.vorbelegen([[5, y, 0.05], [5, y, 5.95]], "sperre");
    r.vorbelegen([[5, 0, 0.05], [5, 2.8, 0.05]], "sperre");
    const w = r.weg([2, 2.8, 3], [8, 2.8, 3], "n");
    expect(w.length).toBeGreaterThanOrEqual(2);
    expect(r.befunde.map((b) => b.regel)).toContain("kein_weg");
  });
});
```

- [ ] **Step 2: Test laufen lassen, muss fehlschlagen.**
- [ ] **Step 3: Implementieren** – `szene3/router/router.ts`

```ts
import { geschossBeiY } from "../../szene2/leitungen";
import type { KatalogEintrag, Welt } from "../../typen";
import { bereinigen, type StrangBaum, type StrangZiel, SPUR } from "../gruppenNetz";
import { suchen, type Vorzug, type Zelle } from "./astern";
import { geraeteKoerper } from "./koerper";
import { Belegung, ebenenFuer, mitteVon, zelleVon } from "./raster";
import { spurenZuteilen, spurWert, trassenLage, type Lage } from "./trasse";
import type { Befund, V3 } from "./typen";

const EPS = 1e-6;
const ERZEUGER = new Set(["heizung.waermepumpe", "heizung.gaskessel", "heizung.oelkessel", "heizung.fernwaerme_uebergabe"]);

export class LeitungsRouter {
  readonly befunde: Befund[] = [];
  private b: Belegung;
  private ebenen: Map<string, number[]>;
  private eigene = new Map<string, V3[][]>();
  private spur = new Map<string, Vorzug>();
  private zentrale: { geschossId: string; lage: Lage | null } | null = null;

  constructor(private welt: Welt, katalog: KatalogEintrag[]) {
    this.b = new Belegung(welt);
    this.ebenen = ebenenFuer(welt);
    this.b.geraete(geraeteKoerper(welt, katalog));
    this.b.waende(welt);
    const erzeuger = [...welt.symbole].filter((s) => ERZEUGER.has(s.katalogId)).sort((a, b) => a.position.y - b.position.y || (a.schluessel < b.schluessel ? -1 : 1))[0];
    if (erzeuger) {
      const g = geschossBeiY(welt, erzeuger.position.y)!;
      const raum = welt.einheiten.find((e) => e.geschossId === g && erzeuger.position.x >= e.rechteck.x && erzeuger.position.x <= e.rechteck.x + e.rechteck.breite
        && erzeuger.position.z >= e.rechteck.z && erzeuger.position.z <= e.rechteck.z + e.rechteck.tiefe);
      this.zentrale = { geschossId: g, lage: raum ? trassenLage(raum.rechteck, welt.symbole.filter((s) => geschossBeiY(welt, s.position.y) === g).map((s) => [s.position.x, 0, s.position.z] as V3)) : null };
    }
  }

  private ebenenBei(y: number): number[] {
    return this.ebenen.get(geschossBeiY(this.welt, y) ?? "") ?? [y];
  }

  vorbelegen(punkte: V3[], netz: string) { this.b.belegen(punkte, netz); }
  belegen(punkte: V3[], netz: string) {
    this.b.belegen(punkte, netz);
    const l = this.eigene.get(netz) ?? []; l.push(punkte); this.eigene.set(netz, l);
  }

  /** Spuren der Trasse fuer Leitungen auf dem Zentrale-Geschoss (Spec 5.3). */
  spurenFestlegen(auftraege: { netz: string; a: V3; b: V3 }[]) {
    const z = this.zentrale;
    if (!z?.lage) return;
    const lage = z.lage, k = lage.achse;
    const relevant = auftraege.filter((x) => geschossBeiY(this.welt, x.a[1] - 1) === z.geschossId);
    const s = spurenZuteilen(relevant.map((x) => ({ netz: x.netz, von: x.a[k], bis: x.b[k] })));
    for (const [netz, index] of s) this.spur.set(netz, { achse: k, wert: spurWert(lage, index) });
  }

  /** Zellpfad -> Eckpunkte, Enden exakt auf a/b eingerastet (Versatz hoechstens eine halbe Zelle). */
  private alsPunkte(zellen: Zelle[], a: V3, b: V3 | null): V3[] {
    const roh = zellen.map((c) => { const [x, z] = mitteVon(this.b.gitter, c.i, c.k); return [x, c.y, z] as V3; });
    const p = bereinigen(roh);
    const rasten = (punkte: V3[], anker: V3) => {
      if (punkte.length < 2) return [anker, ...punkte];
      const [c0, c1] = punkte;
      const k = Math.abs(c0[0] - c1[0]) > EPS ? 0 : Math.abs(c0[2] - c1[2]) > EPS ? 2 : -1;
      if (k < 0) return [anker, ...punkte];
      const q = k === 0 ? 2 : 0;
      c0[q] = anker[q]; c1[q] = anker[q];
      return [anker, ...punkte];
    };
    let w = rasten(p, a);
    if (b) w = rasten([...w].reverse(), b).reverse();
    return bereinigen(w);
  }

  weg(a: V3, b: V3, netz: string): V3[] {
    const ebenen = this.ebenenBei(a[1]);
    const [ia, ka] = zelleVon(this.b.gitter, a[0], a[2]), [ib, kb] = zelleVon(this.b.gitter, b[0], b[2]);
    const start = { y: ebenen.find((y) => Math.abs(y - a[1]) < 0.01) ?? a[1], i: ia, k: ka }, ziel = { y: start.y, i: ib, k: kb };
    if (ia === ib && ka === kb) return bereinigen([a, [b[0], a[1], a[2]], b]);
    const z = suchen(this.b, start, ziel, (c) => c.i === ib && c.k === kb && c.y === start.y, netz, ebenen, this.spur.get(netz));
    if (z) return this.alsPunkte(z, a, b);
    this.befunde.push({ regel: "kein_weg", leitungen: [netz], ort: a, hart: true });
    return bereinigen([a, [a[0], a[1], b[2]], [b[0], a[1], b[2]], b]);
  }

  /** Weg vom naechsten Punkt des eigenen Netzes zu u (T-Abzweig). null, wenn das Netz auf dieser Ebene fehlt oder kein Weg besteht. */
  wegZumNetz(u: V3, netz: string): V3[] | null {
    const ebenen = this.ebenenBei(u[1]);
    const y = ebenen.find((e) => Math.abs(e - u[1]) < 0.01);
    const eigene = (this.eigene.get(netz) ?? []).filter((s) => s.some((p) => Math.abs(p[1] - u[1]) < 0.01));
    if (y === undefined || !eigene.length) return null;
    const [i, k] = zelleVon(this.b.gitter, u[0], u[2]);
    const z = suchen(this.b, { y, i, k }, null, (c) => c.y === y && this.b.eigen(c.y, c.i, c.k, netz), netz, ebenen, this.spur.get(netz));
    if (!z) return null;
    const ende = z.at(-1)!, [ex, ez] = mitteVon(this.b.gitter, ende.i, ende.k);
    // Auf die tatsaechliche Rohrachse projizieren.
    let best: V3 = [ex, y, ez], d = Infinity;
    for (const s of eigene) for (let n = 1; n < s.length; n++) {
      const a = s[n - 1], b = s[n];
      if (Math.abs(a[1] - y) > 0.01 || Math.abs(b[1] - y) > 0.01) {
        if (Math.abs(a[0] - b[0]) < EPS && Math.abs(a[2] - b[2]) < EPS && y >= Math.min(a[1], b[1]) - EPS && y <= Math.max(a[1], b[1]) + EPS) {
          const e = Math.hypot(a[0] - ex, a[2] - ez); if (e < d) { d = e; best = [a[0], y, a[2]]; }
        }
        continue;
      }
      const ax: 0 | 2 = Math.abs(a[0] - b[0]) > EPS ? 0 : 2, p: V3 = [a[0], y, a[2]];
      p[ax] = Math.min(Math.max(ax === 0 ? ex : ez, Math.min(a[ax], b[ax])), Math.max(a[ax], b[ax]));
      const e = Math.hypot(p[0] - ex, p[2] - ez); if (e < d) { d = e; best = p; }
    }
    return this.alsPunkte(z, u, best).reverse();
  }

  /** Gruppenstrang (Ersatz fuer strangBaum): entferntestes Ziel zuerst, weitere als T-Abzweig; Geschosswechsel in der Steigzone. */
  strang(start: V3, ziele: StrangZiel[], spur: number, steigzone: { x: number; z: number } | null, netz: string): StrangBaum {
    const o = spur * SPUR;
    const steig: [number, number] = steigzone ? [steigzone.x + o, steigzone.z + o] : [start[0], start[2]];
    const gleich = (a: number, b: number) => Math.abs(a - b) < 1e-3;
    const kosten = (u: V3) => gleich(u[1], start[1]) ? Math.abs(u[0] - start[0]) + Math.abs(u[2] - start[2])
      : Math.abs(start[0] - steig[0]) + Math.abs(start[2] - steig[1]) + Math.abs(u[1] - start[1]) + Math.abs(u[0] - steig[0]) + Math.abs(u[2] - steig[1]);
    const sortiert = [...ziele].sort((a, b) => kosten(b.punkt) - kosten(a.punkt) || (a.schluessel < b.schluessel ? -1 : 1));
    const segmente: V3[][] = [], abzweige: StrangBaum["abzweige"] = [];
    const steigSegmente = () => segmente.flatMap((s) => s.slice(1).map((q, n) => [s[n], q] as [V3, V3]))
      .filter(([a, b]) => Math.abs(a[0] - b[0]) < EPS && Math.abs(a[2] - b[2]) < EPS && Math.abs(a[1] - b[1]) > EPS && gleich(a[0], steig[0]) && gleich(a[2], steig[1]));
    for (const { schluessel, punkt: u } of sortiert) {
      let punkte: V3[] | null = null;
      if (segmente.some((s) => s.some((p) => gleich(p[1], u[1])))) punkte = this.wegZumNetz(u, netz);
      if (!punkte) {
        if (gleich(u[1], start[1])) punkte = this.weg(start, u, netz);
        else {
          const kopf: V3 = [steig[0], u[1], steig[1]];
          const st = steigSegmente();
          let anfang: V3[];
          if (st.some(([a, b]) => u[1] >= Math.min(a[1], b[1]) - EPS && u[1] <= Math.max(a[1], b[1]) + EPS)) anfang = [kopf];
          else if (st.length) {
            const e = st.flat().reduce((m, q) => (Math.abs(q[1] - u[1]) < Math.abs(m[1] - u[1]) ? q : m));
            anfang = [e, kopf];
          } else {
            const fuss: V3 = [steig[0], start[1], steig[1]];
            const vorlauf = segmente.some((s) => s.some((p) => gleich(p[1], start[1]))) ? this.wegZumNetz(fuss, netz) ?? this.weg(start, fuss, netz) : this.weg(start, fuss, netz);
            anfang = [...vorlauf, kopf];
          }
          this.belegen(bereinigen(anfang), netz);
          const rest = this.weg(kopf, u, netz);
          punkte = bereinigen([...anfang, ...rest.slice(1)]);
        }
      }
      this.belegen(punkte, netz);
      if (punkte.length >= 2) segmente.push(punkte);
      abzweige.push({ schluessel, punkte });
    }
    return { segmente, abzweige };
  }
}
```

Hinweise:
- `spurenFestlegen` filtert mit `geschossBeiY(a[1] - 1)`, weil die Leitungsebene 0.4 m unter der Geschossoberkante liegt und `geschossBeiY` die Unterkante sucht; `-1` landet sicher im eigenen Geschoss.
- `alsPunkte` veraendert `c0`/`c1` in einer frischen Kopie (`bereinigen` erzeugt neue Arrays nur fuer neue Punkte, die Elemente stammen aus `roh` und sind lokal) – kein Seiteneffekt nach aussen.

- [ ] **Step 4: Test laufen lassen** – Expected: PASS (4). Bei Fehlschlag im Strang-Test zuerst die Befunde ausgeben (`console.log(pruefen(...))`), Ursache benennen, dann korrigieren.
- [ ] **Step 5: Alle Webtests** – `npm.cmd test`, Expected: gruen.
- [ ] **Step 6: Commit** – `Leitungsrouter T6: Router mit Weg, T-Abzweig und Strang`.

---

### Task 7: Router in Haupt- und Gruppennetz einbauen

**Files:**
- Modify: `szene3/netz.ts` (`rohrnetz`, `kantenNetz`; neu `rohrnetzMitBefunden`)
- Modify: `szene3/gruppenNetz.ts` (`gruppenRohrnetz`: Router statt `kantenNetz`-Routing und `strangBaum`)
- Test: `szene3/router/einbau.test.ts`

**Interfaces:**
- Consumes: `LeitungsRouter` (Task 6), `alsBaum` (Task 2), `pruefen`, `alsPrueflinien`, `geraeteKoerper` (Task 1).
- Produces:
  - `rohrnetzMitBefunden(welt: Welt, katalog: KatalogEintrag[], anschluesse: Record<string, V3>): { stuecke: Rohrstueck[]; befunde: Befund[] }`
  - `rohrnetz(...)` unveraendert in der Signatur, liefert `rohrnetzMitBefunden(...).stuecke`
  - `kantenNetz(welt, katalog, anschluesse, kanten, router?: LeitungsRouter)`
  - `gruppenRohrnetz(welt, katalog, anschluesse, router?: LeitungsRouter, vorrang?: string[])`

- [ ] **Step 1: Failing Test** – `szene3/router/einbau.test.ts`

```ts
import { describe, expect, it } from "vitest";
import type { Welt } from "../../typen";
import { rohrnetzMitBefunden } from "../netz";
import { TEST_KATALOG } from "./testKatalog";

const dateien = import.meta.glob<Welt>("../../fixtures/muster-*.json", { eager: true, import: "default" });

describe("Router im Rohrnetz", () => {
  for (const [pfad, w] of Object.entries(dateien)) {
    it(`${pfad.split("/").at(-1)}: keine harten Befunde, keine Grundriss-Kreuzung`, () => {
      const { befunde } = rohrnetzMitBefunden(structuredClone(w), TEST_KATALOG, {});
      expect(befunde.map((b) => `${b.regel}:${b.leitungen.join("|")}`)).toEqual([]);
    });
  }
  it("deterministisch", () => {
    const w = Object.values(dateien)[0];
    expect(JSON.stringify(rohrnetzMitBefunden(structuredClone(w), TEST_KATALOG, {}).stuecke))
      .toBe(JSON.stringify(rohrnetzMitBefunden(structuredClone(w), TEST_KATALOG, {}).stuecke));
  });
});
```

- [ ] **Step 2: Test laufen lassen, muss fehlschlagen** – Expected: FAIL, `rohrnetzMitBefunden` nicht exportiert.

- [ ] **Step 3: `kantenNetz` umbauen** – in `szene3/netz.ts` die Funktion ersetzen. Adapter-Logik bleibt wortgleich; neu sind zwei Durchgaenge (erst alle Adapter berechnen und vorbelegen, dann Wege) und der Router-Aufruf:

```ts
export function kantenNetz(welt: Welt, katalog: KatalogEintrag[], anschluesse: Record<string, V3>, kanten: Verbindung[], router?: LeitungsRouter): Rohrstueck[] {
  const stuecke: Rohrstueck[] = [];
  const adapterSchluessel = new Set<string>();
  const naechsterAbgang = new Map<string, number>();
  const netzVon = (v: Verbindung) => (v.art === "haupt" ? "haupt" : ersatzGruppeId(v.von, v.nach));
  // Durchgang 1: Adapter je Verbindung (Reihenfolge wie bisher, damit Verteilerabgaenge gleich nummeriert bleiben).
  const vorbereitet = kanten.map((v) => {
    const radius = ROHR[v.art];
    const adapter: Rohrstueck[] = [];
    const lage = (key: string): number | undefined => {
      const s = welt.symbole.find((s) => s.schluessel === key);
      if (s) return s.position.z;
      const e = welt.einheiten.find((e) => e.id === key);
      return e ? e.rechteck.z + e.rechteck.tiefe / 2 : undefined;
    };
    const endpunkt = (key: string, ausgang = false): V3 | null => {
      const s = welt.symbole.find((s) => s.schluessel === key);
      if (!s) {
        const e = welt.einheiten.find((e) => e.id === key), g = welt.geschosse.find((g) => g.id === e?.geschossId);
        return e && g ? [e.rechteck.x + e.rechteck.breite / 2, deckenLauf(g), e.rechteck.z + e.rechteck.tiefe / 2] : null;
      }
      let lokal = anschlussLokal(s, anschluesse, katalog);
      if (ausgang && v.art === "verteil" && s.katalogId === "heizung.verteiler") {
        const index = naechsterAbgang.get(key) ?? 0;
        lokal = verteilerAbgang(index); naechsterAbgang.set(key, index + 1);
      }
      const g = welt.geschosse.find((g) => g.id === geschossBeiY(welt, s.position.y));
      const laufY = g ? deckenLauf(g) - s.position.y : ROHR.durchgangHoehe;
      const f = anschlussFuehrung([], { symbol: s, lokal: lokal as V3 }, radius, einheitVon(welt, s)?.rechteck, laufY, lage(key === v.von ? v.nach : v.von));
      const stutzen = s.katalogId === "heizung.verteiler" ? ausgang ? 0.02 : 0.035 : s.katalogId === "heizung.waermepumpe" ? 0.026 : ROHR.anschluss;
      adapter.push({ punkte: f.adapter, radius: f.adapterRadius, startRadius: stutzen, endRadius: radius, boden: s.position.y,
        daten: { ...v, bauteilIds: s.bauteilIds }, frei: false });
      return f.adapter.at(-1)!;
    };
    const a = endpunkt(v.von, true), b = endpunkt(v.nach);
    return { v, radius, adapter, a, b };
  });
  if (router) for (const x of vorbereitet) for (const r of x.adapter) router.vorbelegen(r.punkte, netzVon(x.v));
  router?.spurenFestlegen(vorbereitet.filter((x) => x.a && x.b).map((x) => ({ netz: netzVon(x.v), a: x.a!, b: x.b! })));
  // Durchgang 2: Wege.
  for (const { v, radius, adapter, a, b } of vorbereitet) {
    if (!a || !b) continue;
    let punkte: V3[];
    if (router && Math.abs(a[1] - b[1]) < 0.01) {
      punkte = router.weg(a, b, netzVon(v));
      router.belegen(punkte, netzVon(v));
    } else {
      // Bisherige Schablone: nur noch ohne Router oder bei Endpunkten auf verschiedenen Hoehen (v1-Sonderfall).
      const richtung = (p: V3) => {
        const abgang = adapter.find((r) => r.punkte.at(-1) === p);
        return abgang ? Math.sign(p[2] - abgang.punkte[abgang.punkte.length - 2][2]) || 1 : 1;
      };
      const sa = richtung(a), sb = richtung(b);
      const zugewandt = sa !== sb && (b[2] - a[2]) * sa > 0.3;
      const z = zugewandt ? (a[2] + b[2]) / 2 : sa > 0 ? Math.max(a[2], b[2]) + 0.4 : Math.min(a[2], b[2]) - 0.4;
      punkte = [a, [a[0], a[1], z], [a[0], b[1], z], [b[0], b[1], z], b];
      if (sa !== sb && !zugewandt) {
        const x = Math.min(a[0], b[0]) - 0.8, az = a[2] + sa * 0.4, bz = b[2] + sb * 0.4;
        punkte = [a, [a[0], a[1], az], [x, a[1], az], [x, b[1], az], [x, b[1], bz], [b[0], b[1], bz], b];
      }
    }
    const neueAdapter = adapter.filter((r) => {
      const key = JSON.stringify([r.punkte, r.radius, r.endRadius]);
      if (adapterSchluessel.has(key)) return false;
      adapterSchluessel.add(key); return true;
    });
    stuecke.push(...neueAdapter, { punkte, radius, startRadius: radius, endRadius: radius, boden: Math.min(...adapter.map((r) => r.boden)),
      daten: { ...v, bauteilIds: [...new Set(adapter.flatMap((a) => a.daten.bauteilIds))] }, frei: !welt.symbole.some((s) => s.schluessel === v.nach) });
  }
  return stuecke;
}
```

Fuer verschieden hohe Endpunkte (Haupt- oder Ersatzleitung ueber Geschosse): statt Schablone `router.strang(a, [{ schluessel: v.nach, punkt: b }], 0, welt.steigzone ?? null, netzVon(v))` verwenden und die Segmente zu einer Polylinie verbinden (`bereinigen(baum.segmente.flat())`), sofern `router` gesetzt ist. Den `else`-Zweig nur ohne Router behalten.

Imports in `netz.ts` ergaenzen:
```ts
import { ersatzGruppeId, gruppenRohrnetz } from "./gruppenNetz";
import { LeitungsRouter } from "./router/router";
import { alsBaum } from "./router/topologie";
import { geraeteKoerper } from "./router/koerper";
import { alsPrueflinien, pruefen } from "./router/pruefer";
import type { Befund } from "./router/typen";
```
(`ersatzGruppeId` existiert bereits in `gruppenNetz.ts`. Zirkulaere Imports netz <-> gruppenNetz bestehen schon heute; `router.ts` importiert nur Werte aus `gruppenNetz.ts`, die zur Aufrufzeit definiert sind.)

- [ ] **Step 4: `rohrnetzMitBefunden` und `rohrnetz`** – in `szene3/netz.ts` ersetzen:

```ts
/** v1: alle Verbindungen einzeln; v2: Hauptleitungen und Gruppenstraenge. Beide ueber den LeitungsRouter (Spec 2026-11-13). */
export function rohrnetzMitBefunden(welt: Welt, katalog: KatalogEintrag[], anschluesse: Record<string, V3>): { stuecke: Rohrstueck[]; befunde: Befund[] } {
  let vorrang: string[] = [], stuecke: Rohrstueck[] = [], routerBefunde: Befund[] = [];
  for (let runde = 0; runde < 3; runde++) {
    const router = new LeitungsRouter(welt, katalog);
    if (welt.gruppen) stuecke = gruppenRohrnetz(welt, katalog, anschluesse, router, vorrang);
    else {
      const baum = alsBaum(verbindungen(welt, katalog));
      for (const k of baum.verworfen) router.befunde.push({ regel: "zyklus", leitungen: [`${k.von}>${k.nach}`], ort: [0, 0, 0], hart: true });
      stuecke = kantenNetz(welt, katalog, anschluesse, baum.kanten as Verbindung[], router).map((r) =>
        r.daten.art === "verteil" ? { ...r, daten: { ...r.daten, gruppeId: ersatzGruppeId(r.daten.von, r.daten.nach) } } : r);
    }
    routerBefunde = router.befunde;
    const fehl = router.befunde.filter((b) => b.regel === "kein_weg").flatMap((b) => b.leitungen);
    if (!fehl.length) break;
    // Ausreissen und neu verlegen: gescheiterte Netze zuerst (Spec 5.4), hoechstens 3 Runden.
    vorrang = [...new Set([...fehl, ...vorrang])];
  }
  const befunde = [...routerBefunde, ...pruefen(alsPrueflinien(stuecke), geraeteKoerper(welt, katalog))];
  return { stuecke, befunde };
}
export function rohrnetz(welt: Welt, katalog: KatalogEintrag[], anschluesse: Record<string, V3>): Rohrstueck[] {
  return rohrnetzMitBefunden(welt, katalog, anschluesse).stuecke;
}
```

Hinweis: `geraeteKoerper` erhaelt hier die Eingabewelt; Teile in der Leitung (`inline`) werden erst in `anzeigeWelt` gesetzt. Damit Zubehoer im Gruppenstock nicht als Hindernis zaehlt, in `rohrnetzMitBefunden` fuer v2 `geraeteKoerper(anzeigeWelt(welt, katalog, anschluesse), katalog)` verwenden (`anzeigeWelt` aus `gruppenNetz.ts` importieren). Dasselbe gilt im `LeitungsRouter`-Konstruktor: `gruppenRohrnetz` uebergibt bereits die Anzeigewelt (Step 5).

- [ ] **Step 5: `gruppenRohrnetz` umbauen** – in `szene3/gruppenNetz.ts`:

1. Signatur: `export function gruppenRohrnetz(weltEingabe: Welt, katalog: KatalogEintrag[], anschluesse: Record<string, V3>, router?: LeitungsRouter, vorrang: string[] = []): Rohrstueck[]`
2. Direkt nach `const welt = anzeigeWelt(...)`: `const r = router ?? new LeitungsRouter(welt, katalog);` – Achtung: der in `rohrnetzMitBefunden` erzeugte Router kennt die Eingabewelt. Deshalb dort fuer v2 den Router mit `anzeigeWelt(welt, katalog, anschluesse)` konstruieren:
   ```ts
   const router = new LeitungsRouter(welt.gruppen ? anzeigeWelt(welt, katalog, anschluesse) : welt, katalog);
   ```
3. Haupt-Topologie absichern: `const haupt = alsBaum([...straenge.flatMap((s) => s.verbraucher.map((v) => ({ von: s.verteiler, nach: v, art: "verteil" as const }))), ...verbindungen(welt, katalog).filter((v) => v.art === "haupt")]).kanten.filter((k) => k.art === "haupt") as Verbindung[];` – Gruppenkanten zuerst, damit ein Unterverteiler mit Gruppe nie zusaetzlich eine Hauptleitung erhaelt (ersetzt den bisherigen `unterverteiler`-Filter). Verworfene Hauptkanten als `zyklus`-Befund in `r.befunde` eintragen.
4. `let stuecke = kantenNetz(welt, katalog, anschluesse, haupt, r);`
5. Nach Durchgang 1 (`vorbereitet`): alle festen Teile vorbelegen und Spuren festlegen:
   ```ts
   for (const x of vorbereitet) for (const p of fest(x)) r.vorbelegen(p, x.st.gruppeId);
   r.spurenFestlegen(vorbereitet.map((x) => {
     const ziel = x.ziele.find((z) => Math.abs(z.punkt[1] - x.start[1]) < 1e-3)?.punkt
       ?? (welt.steigzone ? [welt.steigzone.x, x.start[1], welt.steigzone.z] as V3 : x.start);
     return { netz: x.st.gruppeId, a: x.start, b: ziel };
   }));
   ```
6. Reihenfolge: `const reihe = [...vorbereitet].sort((a, b) => Number(!vorrang.includes(a.st.gruppeId)) - Number(!vorrang.includes(b.st.gruppeId)));` und die Schleife "Durchgang 2" ueber `reihe` statt `vorbereitet`.
7. In Durchgang 2 `const hindernisse = ...` und `strangBaum(...)` ersetzen durch:
   ```ts
   const baum = r.strang(start, ziele, spur.get(st.gruppeId) ?? 0, welt.steigzone ?? null, st.gruppeId);
   ```
   `verlegt` und `hindernisse` entfallen.
8. Imports: `import { LeitungsRouter } from "./router/router"; import { alsBaum } from "./router/topologie";` und `type Verbindung` aus `./netz`.

- [ ] **Step 6: Einbau-Test laufen lassen**

Run: `npm.cmd test -- src/szene3/router/einbau.test.ts`
Expected: PASS fuer alle 7 Muster + Determinismus. Bei Befunden: Befundliste lesen, Ursache einer Regel zuordnen, Router korrigieren (nicht den Pruefer lockern). Nach drei erfolglosen Korrekturen an derselben Regel: stoppen und die vermutlich falsche Annahme (z. B. Zellgroesse, Nahbereich am Geraet) dem PO nennen.

- [ ] **Step 7: Bestehende Tests nachziehen**

Run: `npm.cmd test`
Erwartete Faelle: Tests in `netz.test.ts`/`gruppenNetz.test.ts`, die exakte Punktfolgen der alten Schablone pruefen, schlagen fehl. Je Test entscheiden: Prueft er eine Eigenschaft (Anschluss am Stutzen, Gruppe vorhanden, Huelsen an Waenden) -> behalten, Erwartung auf neue Fuehrung anpassen. Prueft er die alte Schablonenform (konkrete Zwischenpunkte) -> durch eine Eigenschaftspruefung ersetzen: `pruefen(alsPrueflinien(stuecke), geraeteKoerper(...)).filter((b) => b.hart)` ist leer. Jeden ersetzten Test im Commit-Text nennen.

- [ ] **Step 8: Typpruefung, Webbuild, Fixture-Stabilitaet**

Run (in `app/web`): `npx.cmd tsc --noEmit -p .` und `npm.cmd run build`; in `app/`: `npm.cmd run muster:welt` und `git status` – Expected: alles gruen, keine Fixture-Aenderung (Router aendert nur Web-Darstellung).

- [ ] **Step 9: Commit** – `Leitungsrouter T7: Haupt- und Gruppennetz ueber Router`.

---

### Task 8: Zufallstests, Laufzeit und Hinweis in der Oberflaeche

**Files:**
- Modify: `szene3/router/messung.test.ts` -> umbenennen in `szene3/router/zufall.test.ts` mit harten Zusicherungen
- Create: `szene3/router/hinweise.ts`, Test `szene3/router/hinweise.test.ts`
- Modify: `seiten/Twin.tsx:164`

**Interfaces:**
- Consumes: `rohrnetzMitBefunden` (Task 7), `HinweisZeile` aus `dashboard/daten.ts`, `geschossBeiY`.
- Produces: `leitungsHinweise(welt: Welt, katalog: KatalogEintrag[]): HinweisZeile[]`

- [ ] **Step 1: Zufallstest schreiben** – `git mv app/web/src/szene3/router/messung.test.ts app/web/src/szene3/router/zufall.test.ts`, Inhalt:

```ts
import { describe, expect, it } from "vitest";
import { rohrnetzMitBefunden } from "../netz";
import { TEST_KATALOG } from "./testKatalog";
import { zufallsWelt } from "./zufallsWelt";

const ANZAHL = 2000;

describe("Leitungsfuehrung in Zufallswelten", () => {
  it(`${ANZAHL} Welten: keine harten Befunde; Grundriss-Kreuzungen hoechstens 1 %`, () => {
    const hart: string[] = [];
    let mitKreuzung = 0, ms = 0;
    for (let seed = 1; seed <= ANZAHL; seed++) {
      const t = performance.now();
      const { befunde } = rohrnetzMitBefunden(zufallsWelt(seed), TEST_KATALOG, {});
      ms = Math.max(ms, performance.now() - t);
      for (const b of befunde.filter((b) => b.hart)) hart.push(`seed ${seed}: ${b.regel} ${b.leitungen.join("|")}`);
      if (befunde.some((b) => b.regel === "kreuzung")) mitKreuzung++;
    }
    console.log(`max. Laufzeit je Welt ${ms.toFixed(1)} ms, Welten mit Kreuzung ${mitKreuzung}`);
    expect(hart.slice(0, 20)).toEqual([]);
    expect(mitKreuzung / ANZAHL).toBeLessThanOrEqual(0.01);
  }, 600_000);
});
```

- [ ] **Step 2: Laufen lassen**

Run: `npm.cmd test -- src/szene3/router/zufall.test.ts`
Expected: PASS. Bei Fehlschlag: ersten Seed nehmen, `zufallsWelt(seed)` in einem Einzeltest reproduzieren, Ursache im Router beheben, Einzeltest als Regressionstest in `router.test.ts` behalten. Laufzeit-Ausgabe notieren (Spec-Ziel < 50 ms [A]; bei Ueberschreitung Wert dem PO melden, nicht stillschweigend akzeptieren).

- [ ] **Step 3: Failing Test Hinweise** – `szene3/router/hinweise.test.ts`

```ts
import { describe, expect, it } from "vitest";
import type { Welt } from "../../typen";
import { leitungsHinweise } from "./hinweise";
import { TEST_KATALOG } from "./testKatalog";

const dateien = import.meta.glob<Welt>("../../fixtures/muster-*.json", { eager: true, import: "default" });

describe("leitungsHinweise", () => {
  it("saubere Muster: kein Hinweis", () => {
    for (const w of Object.values(dateien)) expect(leitungsHinweise(structuredClone(w), TEST_KATALOG)).toEqual([]);
  });
  it("erzwungener Konflikt: ein Hinweis mit Umlaut-Text und Geschossziel", () => {
    const w = structuredClone(Object.values(dateien)[0]);
    const v = w.symbole.find((s) => s.katalogId === "heizung.verteiler")!;
    const sp = w.symbole.find((s) => s.katalogId === "heizung.speicher");
    if (sp) sp.position = { ...v.position }; // Speicher in den Verteiler geschoben -> Geraetekonflikt
    const h = leitungsHinweise(w, TEST_KATALOG);
    if (sp) {
      expect(h).toHaveLength(1);
      expect(h[0].text).toContain("Leitungsführung unsauber");
      expect(h[0].ziel?.geschossId).toBeTruthy();
    }
  });
});
```

- [ ] **Step 4: Implementieren** – `szene3/router/hinweise.ts`

```ts
import type { HinweisZeile } from "../../dashboard/daten";
import { geschossBeiY } from "../../szene2/leitungen";
import type { KatalogEintrag, Welt } from "../../typen";
import { rohrnetzMitBefunden } from "../netz";

/** Ein Sammelhinweis, wenn die automatische Leitungsfuehrung harte Befunde hat (Spec 5.5). */
export function leitungsHinweise(welt: Welt, katalog: KatalogEintrag[]): HinweisZeile[] {
  const hart = rohrnetzMitBefunden(welt, katalog, {}).befunde.filter((b) => b.hart);
  if (!hart.length) return [];
  const ort = hart[0].ort;
  return [{ id: "leitung_unsauber", code: "leitung_unsauber", bezug: "", status: null,
    text: `Leitungsführung unsauber: ${hart.length} ${hart.length === 1 ? "Konflikt" : "Konflikte"} in der automatischen Führung`,
    ziel: { geschossId: geschossBeiY(welt, ort[1]), position: { x: ort[0], y: ort[1], z: ort[2] }, schluessel: null } }];
}
```

- [ ] **Step 5: Test laufen lassen** – Expected: PASS.
- [ ] **Step 6: Twin anbinden** – `seiten/Twin.tsx`, Zeile 164:

```ts
      hinweise: [...hinweisListe(welt, beschreibung), ...leitungsHinweise(welt, katalog.eintraege)],
```
Import: `import { leitungsHinweise } from "../szene3/router/hinweise";`

- [ ] **Step 7: Alle Webtests, Typpruefung, Build** – gruen.
- [ ] **Step 8: Commit** – `Leitungsrouter T8: Zufallstests, Laufzeit, Hinweis im Twin`.

---

### Task 9: Alte Fuehrung entfernen

**Files:**
- Modify: `szene3/gruppenNetz.ts` (entfernen: `strangBaum`, `lWeg`, `konflikte`, `KONFLIKT_ABSTAND`, Typ `Strangpunkt`/`Achse` falls unbenutzt)
- Modify: `szene3/gruppenNetz.test.ts` (Tests zu `strangBaum`/`konflikte` entfernen oder auf `LeitungsRouter.strang` umstellen)

- [ ] **Step 1: Verwendungen suchen** – `rg -n "strangBaum|konflikte\(|lWeg" app/web/src` – nur Definitionen und alte Tests duerfen uebrig sein.
- [ ] **Step 2: Tests umstellen** – Jeder `strangBaum`-Test, der eine Eigenschaft prueft (Steigleitung in Steigzone, T-Abzweige, Spurversatz), wird mit `new LeitungsRouter(welt, TEST_KATALOG).strang(start, ziele, spur, steigzone, "g")` neu geschrieben; dieselben Erwartungen auf Eigenschaften (nicht auf exakte Zwischenpunkte). Reine Implementierungstests der alten Variantenwahl entfallen.
- [ ] **Step 3: Code entfernen**, `npm.cmd test`, `npx.cmd tsc --noEmit -p .`, `npm.cmd run build` – gruen.
- [ ] **Step 4: Commit** – `Leitungsrouter T9: alte Schablonenfuehrung entfernt` (Liste der entfernten/umgestellten Tests im Text).

---

### Task 10: GPU-Bilder, Kritik, PO-Sichtung

**Files:**
- Create: `docs/abnahme/2026-11-13-leitungsrouter/README.md` und Bilder
- Modify: `docs/superpowers/plans/2026-11-13-stufe1-integration.md` (Offen-Punkt 2 auf erledigt), `CLAUDE.md` Abschnitt 0b

- [ ] **Step 1: Skill `planora-design` laden** und Ablauf fuer Stufe "mittel" befolgen.
- [ ] **Step 2: Eigene Instanz starten** (nicht 3000/54500): in `app/` `$env:PLANORA_PORT=3100; $env:PLANORA_PG_PORT=54600; npm.cmd run entwicklung`. Vorher Port 54800 pruefen (offener Punkt 8 im Integrationsplan).
- [ ] **Step 3: Bilder** mit `werkzeug/design/screenshot.mjs` (Szenarien wie `docs/abnahme/2026-11-12-gruppen/`): je Muster Zentrale + jedes Geschoss, 1280/1440/1920. Vorher/Nachher fuer m3-zentrale nebeneinander im README.
- [ ] **Step 4: `visual-critic`** auf die Bilder ansetzen (Leitungsbild: Parallelitaet, Abstaende, Boegen, Lesbarkeit). P1-Befunde beheben, P2 als Restauflagen notieren.
- [ ] **Step 5: Instanz stoppen**, Doku nachfuehren (Pruefstand, Laufzeit, Kreuzungsquote, Annahmen), Commit `Leitungsrouter T10: GPU-Abnahme und Doku`.
- [ ] **Step 6: PO-Sichtung anfragen** mit Link auf `docs/abnahme/2026-11-13-leitungsrouter/README.md`. Kein Push ohne Auftrag.

---

## Messwerte

(Task 1, Step 9: Ist-Befunde je Regel vor Umbau; Task 8, Step 2: Laufzeit und Kreuzungsquote nach Umbau.)

**Task 1, Step 9 – Ist-Befunde vor Umbau** (7 Muster-Fixtures plus 200 Zufallswelten, Seeds 1–200; Befehl `npm.cmd test -- src/szene3/router/messung.test.ts`):

| Regel | Befunde |
|---|---|
| abstand | 3385 |
| selbst | 423 |
| rueckwaerts | 99 |
| kreuzung (weich) | 27 |
| durch_geraet | 1 |
| schraeg, boegen, zyklus, kein_weg | 0 |

Vor Pruefer-Korrektur (oben): selbst 423 war zu 97 % Fehlalarm durch Nullstuecke (doppelte Punkte). Nach Korrektur (Nullstuecke entfernt, `d < radius` unveraendert):

| Regel | Befunde |
|---|---|
| abstand | 3247 |
| rueckwaerts | 99 |
| kreuzung (weich) | 27 |
| selbst | 7 |
| durch_geraet | 1 |
| schraeg, boegen, zyklus, kein_weg | 0 |

## Selbstpruefung gegen Spec

| Spec | Task |
|---|---|
| 5.1 Topologie als Baum, Zyklus-Befund | T2, T7 Step 4/5 |
| 5.2 Hinderniskarte, Luft ueber Geraet 0.15 m, Waende teuer | T3 |
| 5.3 Trasse, Left-Edge, Steigzone je Spur | T5, T6 (`spurenFestlegen`, `strang`) |
| 5.4 A*, Kosten, Ausreissen max. 3 Runden, `bereinigen` | T4, T6, T7 Step 4 |
| 5.5 Pruefer, 6 Regeln, Hinweis im Panel | T1, T8 |
| 4 Ausgabe `Rohrstueck[]` unveraendert | T7 |
| 6 alte Fuehrung entfernen | T9 |
| 7 Zufallstests 2000, Muster, Determinismus, Laufzeit, GPU | T7, T8, T10 |
| 8 Zwischenstand Zentrale an PO | nach T7 (Bilder m3/m4 Zentrale vorab zeigen) |

Abweichung zur Spec, bewusst: Grundriss-Ueberkreuzung auf verschiedenen Hoehen (Ausweichebene) ist ein **weicher** Befund mit Grenze 1 % der Zufallswelten und 0 in allen Mustern. Grund: Bei festen Geraetepositionen kann eine kreuzungsfreie Fuehrung auf einer einzigen Ebene geometrisch unmoeglich sein (z. B. eingeschlossener Anschluss). Wird dem PO mit dem Zwischenstand gemeldet.
