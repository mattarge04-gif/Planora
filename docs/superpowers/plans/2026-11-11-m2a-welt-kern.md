# M2a Welt-Kern Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gebaeudebeschreibung (Huelle, Einheiten, Heizung mit Standard/Ausnahmen, Bauteile, Versorgung) speichern, mit stabilen IDs abgleichen und daraus deterministisch eine schematische 3D-Welt berechnen – per HTTP-API, ohne UI.

**Architecture:** Neues Verzeichnis `app/src/welt/` mit reinen Funktionen (Regelwerk, Pruefung, Generator) und einer DB-Schicht (Speicher). Normalisierte Tabellen sind die Wahrheit; die Beschreibung ist das Ein-/Ausgabeformat. Routen haengen unter den bestehenden Kern-Modulen `struktur` und `szene`.

**Tech Stack:** TypeScript (NodeNext, strict), Fastify 5 (Route-Schema = ajv), pg, Postgres-Migrationen als SQL, Vitest mit embedded-postgres.

**Spec:** `docs/superpowers/specs/2026-11-11-m2a-welt-kern-design.md`

## Global Constraints

- Sprache in Code-Kommentaren, Bezeichnern und Texten: Deutsch (de-CH), kein Eszett, immer `ss`, Umlaute als ae/oe/ue.
- Keine neuen npm-Abhaengigkeiten.
- Alle Befehle laufen im Verzeichnis `app/`. Einzeltest: `npx vitest run test/<datei>.test.ts`. Gesamt: `npm test`. Typen: `npm run pruefe:typen`.
- Jede `/api`-Route muss einem Modul aus `src/module/manifest.ts` gehoeren, sonst wirft der Server beim Start. Darum: `/api/struktur/...` und `/api/szene/...` (beide Kern-Module, immer aktiv).
- Mutierende Requests brauchen Header `origin` (erlaubter Origin) und `x-planora-request: 1` (`src/auth/sitzung.ts:28`).
- Katalog und Regelwerk sind **TypeScript-Module**, keine JSON-Dateien: Der Docker-Build (`app/Dockerfile`) kopiert ausser Migrationen nur kompiliertes `.ts`.
- Katalog-IDs nie umbenennen: `heizung.waermepumpe`, `heizung.gaskessel`, `heizung.oelkessel`, `heizung.fernwaerme_uebergabe`, `heizung.speicher`, `heizung.umwaelzpumpe`, `heizung.verteiler`, `heizung.heizkoerper`, `heizung.fbh_kreis`, `heizung.tabs_feld`.
- Generator: keine Zeit, kein Zufall, Sortierung nie nach UUID; Zahlen auf mm gerundet.
- Commits enden mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Branch: `m2a-welt-kern`.

## Dateistruktur

| Datei | Verantwortung |
|---|---|
| `app/src/welt/typen.ts` | Alle Datentypen (Beschreibung, Huelle, Welt, Fehler) |
| `app/src/welt/regelwerk.ts` | Typen Katalog/Regelwerk, `geschossRang`, `STANDORT_GESCHOSS` |
| `app/src/welt/katalog.v1.ts` | Katalog v1 (Daten) |
| `app/src/welt/regelwerk.v1.ts` | Welt-Regelwerk v1 (Daten) |
| `app/src/welt/heizung.ts` | Wirksame Heizung (Standard + Ausnahme), Verteiler-Hinweise |
| `app/src/welt/pruefung.ts` | Fachliche Pruefung einer Beschreibung (rein) |
| `app/src/welt/generator.ts` | `weltErzeugen` (rein) |
| `app/src/db/migrationen/013_gebaeude.sql` | Tabellen, Constraints, Grants |
| `app/src/welt/speicher.ts` | Huelle anlegen/aendern/laden, Beschreibung laden/abgleichen |
| `app/src/welt/schema.ts` | JSON-Schemas fuer Fastify |
| `app/src/welt/routen.ts` | HTTP-Routen |
| `app/src/welt/beispiel.ts`, `beispiel-cli.ts` | Beispieldaten erster Schnitt |
| `app/src/rechte/rechte.ts` | neues Recht `huelle.verwalten` |
| `app/src/server.ts` | Routen registrieren |
| `app/test/hilfe-welt.ts` | Feste Test-Fixtures |

---

### Task 1: Typen, Katalog v1, Regelwerk v1

**Files:**
- Create: `app/src/welt/typen.ts`, `app/src/welt/regelwerk.ts`, `app/src/welt/katalog.v1.ts`, `app/src/welt/regelwerk.v1.ts`, `app/test/hilfe-welt.ts`
- Test: `app/test/welt-regelwerk.test.ts`

**Interfaces:**
- Produces: alle Typen aus `typen.ts`; `KatalogEintrag`, `Katalog`, `Regelwerk`, `geschossRang(code: string): number | null`, `STANDORT_GESCHOSS = "_geschoss"` aus `regelwerk.ts`; `KATALOG_V1: Katalog`; `REGELWERK_V1: Regelwerk`; Fixtures `G(n)`, `huelleFixture(form?)`, `beschreibungFixture()`.

- [ ] **Step 1: Typen anlegen** – `app/src/welt/typen.ts`

```ts
export type Dreiwertig = "ja" | "nein" | "unbekannt";
export type HeizArt = "hk" | "fbh" | "tabs";
export const HEIZ_ARTEN: readonly HeizArt[] = ["hk", "fbh", "tabs"];
export type Heizung = Record<HeizArt, Dreiwertig>;
export type Grundform = "quader" | "l_form" | "u_form";
export type BauteilStatus = "vorgeschlagen" | "bestaetigt";
export interface Rechteck { x: number; z: number; breite: number; tiefe: number }
export interface Punkt { x: number; z: number }
export interface Fehler { pfad: string; code: string; meldung: string }
export interface Hinweis { code: string; bezug: string }

export interface Huelle {
  name: string; grundform: Grundform; breiteM: number; tiefeM: number;
  geschosse: { id?: string; code: string; hoeheM?: number }[];
}
export interface HuelleGespeichert {
  gebaeudeId: string; liegenschaftId: string; name: string; grundform: Grundform; breiteM: number; tiefeM: number;
  regelwerkVersion: number; stand: number;
  geschosse: { id: string; code: string; hoeheM: number }[]; // sortiert nach Rang (UG3 … DACH)
}

/** Verweis auf eine Einheit: bestehende per ID, im selben Request neue per Index in `einheiten`. Genau eines setzen. */
export interface EinheitVerweis { einheitId?: string; einheitIndex?: number }
export interface Standort extends EinheitVerweis { geschossId?: string }
export interface EinheitEingabe {
  id?: string; geschossId: string; bezeichnung: string; art: string; flaecheM2: number | null;
  layoutManuell?: Rechteck | null;
  heizungAusnahme?: Partial<Heizung>; // nur Abweichungen vom Gebaeudestandard
  heizungWirksam?: Heizung;           // nur in Antworten; beim Schreiben ignoriert
}
export interface BauteilEingabe {
  id?: string; katalogId: string; standort: Standort; menge: number | null; status: BauteilStatus;
  hersteller?: string | null; typ?: string | null; baujahr?: number | null;
  positionManuell?: Punkt | null; versorgt: EinheitVerweis[];
}
export interface Beschreibung {
  gebaeudeId: string; stand: number;
  geschosse?: { id: string; code: string }[]; // nur lesend
  heizungStandard: Heizung;
  einheiten: EinheitEingabe[]; bauteile: BauteilEingabe[];
  hinweise?: Hinweis[];                        // nur lesend
}

export interface WeltSymbol {
  schluessel: string; katalogId: string; hersteller: string | null; typ: string | null;
  bauteilIds: string[]; mengeSumme: number; mengeUnbekannt: boolean; status: BauteilStatus;
  position: { x: number; y: number; z: number }; versorgt: string[];
}
export interface Welt {
  regelwerkVersion: number; hash: string; grundriss: Rechteck[];
  geschosse: { id: string; code: string; yUnten: number; hoehe: number }[];
  einheiten: { id: string; geschossId: string; bezeichnung: string; art: string; rechteck: Rechteck; quelle: "schematisch" | "manuell" }[];
  symbole: WeltSymbol[]; hinweise: Hinweis[];
}
```

- [ ] **Step 2: Regelwerk-Typen und Geschoss-Rang** – `app/src/welt/regelwerk.ts`

```ts
import type { HeizArt } from "./typen.js";

/** Pseudo-Art fuer Bauteile, die direkt am Geschoss stehen (ohne Einheit). */
export const STANDORT_GESCHOSS = "_geschoss";
export interface KatalogEintrag { id: string; name: string; bereich: "zentrale" | "verteilung" | "einheit"; heizArt: HeizArt | null; mengeMax: number }
export interface Katalog { version: number; eintraege: KatalogEintrag[] }
export interface Regelwerk {
  version: number;
  schenkelAnteil: number; // L/U: Riegeltiefe = Anteil × Tiefe, Schenkelbreite = Anteil × Breite
  masse: { min: number; max: number; defaultBreite: number; defaultTiefe: number };
  geschoss: { hoeheMin: number; hoeheMax: number; hoeheDefault: number };
  einheitArten: Record<string, { name: string; defaultFlaecheM2: number }>;
  erlaubt: Record<string, string[]>; // Einheit-Art bzw. STANDORT_GESCHOSS → erlaubte Katalog-IDs
}

/** Rang fuer Stapelreihenfolge: UG3=-3 … UG1=-1, EG=0, OG1..OG40, DG=41, DACH=42; sonst null. */
export function geschossRang(code: string): number | null {
  if (code === "EG") return 0;
  if (code === "DG") return 41;
  if (code === "DACH") return 42;
  const ug = /^UG([1-3])$/.exec(code);
  if (ug) return -Number(ug[1]);
  const og = /^OG([1-9]|[1-3][0-9]|40)$/.exec(code);
  if (og) return Number(og[1]);
  return null;
}
```

- [ ] **Step 3: Katalog v1** – `app/src/welt/katalog.v1.ts`

```ts
import type { Katalog } from "./regelwerk.js";

/** Katalog v1, Demo nur Heizung (PO 2026-11-11). IDs nie umbenennen (ADR 0011). Mengen [A]. */
export const KATALOG_V1: Katalog = {
  version: 1,
  eintraege: [
    { id: "heizung.waermepumpe", name: "Waermepumpe", bereich: "zentrale", heizArt: null, mengeMax: 10 },
    { id: "heizung.gaskessel", name: "Gaskessel", bereich: "zentrale", heizArt: null, mengeMax: 10 },
    { id: "heizung.oelkessel", name: "Oelkessel", bereich: "zentrale", heizArt: null, mengeMax: 10 },
    { id: "heizung.fernwaerme_uebergabe", name: "Fernwaerme-Uebergabe", bereich: "zentrale", heizArt: null, mengeMax: 10 },
    { id: "heizung.speicher", name: "Speicher", bereich: "zentrale", heizArt: null, mengeMax: 10 },
    { id: "heizung.umwaelzpumpe", name: "Umwaelzpumpe", bereich: "zentrale", heizArt: null, mengeMax: 50 },
    { id: "heizung.verteiler", name: "Heizungsverteiler", bereich: "verteilung", heizArt: null, mengeMax: 20 },
    { id: "heizung.heizkoerper", name: "Heizkoerper", bereich: "einheit", heizArt: "hk", mengeMax: 500 },
    { id: "heizung.fbh_kreis", name: "FBH-Kreis", bereich: "einheit", heizArt: "fbh", mengeMax: 200 },
    { id: "heizung.tabs_feld", name: "TABS-Feld", bereich: "einheit", heizArt: "tabs", mengeMax: 200 },
  ],
};
```

- [ ] **Step 4: Regelwerk v1** – `app/src/welt/regelwerk.v1.ts`

```ts
import { STANDORT_GESCHOSS, type Regelwerk } from "./regelwerk.js";

const ZENTRALE = ["heizung.waermepumpe", "heizung.gaskessel", "heizung.oelkessel", "heizung.fernwaerme_uebergabe", "heizung.speicher", "heizung.umwaelzpumpe"];
const VERTEILER = "heizung.verteiler";
const HK = "heizung.heizkoerper";
const FLAECHE = ["heizung.fbh_kreis", "heizung.tabs_feld"];
const RAUM = [VERTEILER, HK, ...FLAECHE];

/** Welt-Regelwerk v1. Alle Werte [A] bis PO-Freigabe (Spec §3). */
export const REGELWERK_V1: Regelwerk = {
  version: 1,
  schenkelAnteil: 0.4,
  masse: { min: 5, max: 200, defaultBreite: 30, defaultTiefe: 15 },
  geschoss: { hoeheMin: 2.4, hoeheMax: 6.0, hoeheDefault: 3.2 },
  einheitArten: {
    buero: { name: "Buero", defaultFlaecheM2: 120 },
    wohnung: { name: "Wohnung", defaultFlaecheM2: 90 },
    gastro: { name: "Gastro", defaultFlaecheM2: 150 },
    technik: { name: "Technik", defaultFlaecheM2: 30 },
    kern: { name: "Kern (Treppenhaus/Lift)", defaultFlaecheM2: 25 },
    allgemein: { name: "Allgemein", defaultFlaecheM2: 40 },
  },
  erlaubt: {
    buero: RAUM, wohnung: RAUM, gastro: RAUM, allgemein: RAUM,
    technik: [...ZENTRALE, VERTEILER, HK],
    kern: [HK],
    [STANDORT_GESCHOSS]: [...ZENTRALE, VERTEILER],
  },
};
```

- [ ] **Step 5: Test-Fixtures** – `app/test/hilfe-welt.ts`

```ts
import type { Beschreibung, Grundform, HuelleGespeichert } from "../src/welt/typen.js";

/** Feste, gueltige UUIDs fuer reproduzierbare Tests. */
export const G = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

/** Geschosse absichtlich unsortiert (UG1 zuletzt), Generator muss nach Rang sortieren. */
export function huelleFixture(grundform: Grundform = "quader"): HuelleGespeichert {
  return {
    gebaeudeId: G(1), liegenschaftId: G(2), name: "Test", grundform, breiteM: 30, tiefeM: 15, regelwerkVersion: 1, stand: 0,
    geschosse: [{ id: G(10), code: "EG", hoeheM: 3 }, { id: G(11), code: "OG1", hoeheM: 3.5 }, { id: G(9), code: "UG1", hoeheM: 2.5 }],
  };
}

/** A (Buero, EG), B (Technik, EG), C (Buero, OG1); 100 HK Zehnder + 1 HK Prolux in A; Verteiler in B versorgt C und A. */
export function beschreibungFixture(): Beschreibung {
  return {
    gebaeudeId: G(1), stand: 0, heizungStandard: { hk: "ja", fbh: "nein", tabs: "nein" },
    einheiten: [
      { id: G(20), geschossId: G(10), bezeichnung: "A", art: "buero", flaecheM2: null },
      { id: G(21), geschossId: G(10), bezeichnung: "B", art: "technik", flaecheM2: null },
      { id: G(22), geschossId: G(11), bezeichnung: "C", art: "buero", flaecheM2: null },
    ],
    bauteile: [
      { id: G(30), katalogId: "heizung.heizkoerper", standort: { einheitId: G(20) }, menge: 100, status: "bestaetigt", hersteller: "Zehnder", versorgt: [] },
      { id: G(31), katalogId: "heizung.heizkoerper", standort: { einheitId: G(20) }, menge: 1, status: "bestaetigt", hersteller: "Prolux", versorgt: [] },
      { id: G(32), katalogId: "heizung.verteiler", standort: { einheitId: G(21) }, menge: 1, status: "bestaetigt", versorgt: [{ einheitId: G(22) }, { einheitId: G(20) }] },
    ],
  };
}
```

- [ ] **Step 6: Test schreiben** – `app/test/welt-regelwerk.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { KATALOG_V1 } from "../src/welt/katalog.v1.js";
import { REGELWERK_V1 } from "../src/welt/regelwerk.v1.js";
import { geschossRang, STANDORT_GESCHOSS } from "../src/welt/regelwerk.js";

describe("Katalog v1", () => {
  it("10 eindeutige IDs im Format gruppe.typ", () => {
    const ids = KATALOG_V1.eintraege.map((e) => e.id);
    expect(ids).toHaveLength(10);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z]+\.[a-z_]+$/);
  });
  it("Heizart nur bei HK, FBH-Kreis und TABS-Feld", () => {
    expect(Object.fromEntries(KATALOG_V1.eintraege.filter((e) => e.heizArt).map((e) => [e.id, e.heizArt])))
      .toEqual({ "heizung.heizkoerper": "hk", "heizung.fbh_kreis": "fbh", "heizung.tabs_feld": "tabs" });
  });
});

describe("Regelwerk v1", () => {
  it("Erlaubt-Matrix nennt nur Katalog-IDs und bekannte Arten", () => {
    const ids = new Set(KATALOG_V1.eintraege.map((e) => e.id));
    for (const [art, liste] of Object.entries(REGELWERK_V1.erlaubt)) {
      expect(art === STANDORT_GESCHOSS || Object.hasOwn(REGELWERK_V1.einheitArten, art)).toBe(true);
      for (const id of liste) expect(ids.has(id)).toBe(true);
    }
  });
  it("Default-Flaechen gemaess Spec §3", () => {
    expect(Object.fromEntries(Object.entries(REGELWERK_V1.einheitArten).map(([k, v]) => [k, v.defaultFlaecheM2])))
      .toEqual({ buero: 120, wohnung: 90, gastro: 150, technik: 30, kern: 25, allgemein: 40 });
  });
  it("Zentrale nur in Technik und am Geschoss", () => {
    for (const [art, liste] of Object.entries(REGELWERK_V1.erlaubt))
      expect(liste.includes("heizung.waermepumpe")).toBe(art === "technik" || art === STANDORT_GESCHOSS);
  });
});

describe("geschossRang", () => {
  it("ordnet gueltige Codes", () => {
    expect(["UG3", "UG1", "EG", "OG1", "OG40", "DG", "DACH"].map(geschossRang)).toEqual([-3, -1, 0, 1, 40, 41, 42]);
  });
  it("lehnt Unbekanntes ab", () => {
    for (const c of ["UG4", "OG0", "OG41", "OG01", "og1", "1OG", ""]) expect(geschossRang(c)).toBeNull();
  });
});
```

- [ ] **Step 7: Test laufen lassen**

Run: `npx vitest run test/welt-regelwerk.test.ts`
Expected: PASS (6 Tests). Schlaegt ein Test fehl, Daten in Step 3/4 gegen Spec §3 pruefen.

- [ ] **Step 8: Commit**

```bash
git add app/src/welt app/test/hilfe-welt.ts app/test/welt-regelwerk.test.ts
git commit -m "M2a: Typen, Katalog v1 und Welt-Regelwerk v1

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Generator

**Files:**
- Create: `app/src/welt/generator.ts`
- Test: `app/test/welt-generator.test.ts`

**Interfaces:**
- Consumes: Typen aus `typen.ts`, `geschossRang`, `Regelwerk`, `REGELWERK_V1`, Fixtures.
- Produces: `weltErzeugen(h: HuelleGespeichert, b: Beschreibung, rw: Regelwerk): Welt`. Voraussetzung: alle Einheiten/Bauteile haben `id`, alle Verweise sind `einheitId`/`geschossId` (so wie `ladeBeschreibung` sie liefert); sonst `Error`.

- [ ] **Step 1: Failing Test schreiben** – `app/test/welt-generator.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { weltErzeugen } from "../src/welt/generator.js";
import { REGELWERK_V1 } from "../src/welt/regelwerk.v1.js";
import { G, huelleFixture, beschreibungFixture } from "./hilfe-welt.js";

const welt = (b = beschreibungFixture(), h = huelleFixture()) => weltErzeugen(h, b, REGELWERK_V1);

describe("weltErzeugen", () => {
  it("ist deterministisch: gleiche Eingabe, gleicher Hash", () => {
    const a = welt(), b = welt();
    expect(a).toEqual(b);
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.regelwerkVersion).toBe(1);
  });
  it("Aenderung der Eingabe aendert den Hash", () => {
    const b = beschreibungFixture(); b.einheiten[0].flaecheM2 = 200;
    expect(welt(b).hash).not.toBe(welt().hash);
  });
  it("stapelt Geschosse nach Rang: UG unter 0, EG auf 0", () => {
    expect(welt().geschosse).toEqual([
      { id: G(9), code: "UG1", yUnten: -2.5, hoehe: 2.5 },
      { id: G(10), code: "EG", yUnten: 0, hoehe: 3 },
      { id: G(11), code: "OG1", yUnten: 3, hoehe: 3.5 },
    ]);
  });
  it("Grundformen quader, l_form, u_form", () => {
    expect(welt().grundriss).toEqual([{ x: 0, z: 0, breite: 30, tiefe: 15 }]);
    expect(welt(undefined, huelleFixture("l_form")).grundriss).toEqual([{ x: 0, z: 0, breite: 30, tiefe: 6 }, { x: 0, z: 6, breite: 12, tiefe: 9 }]);
    expect(welt(undefined, huelleFixture("u_form")).grundriss).toEqual([
      { x: 0, z: 0, breite: 30, tiefe: 6 }, { x: 0, z: 6, breite: 12, tiefe: 9 }, { x: 18, z: 6, breite: 12, tiefe: 9 }]);
  });
  it("Einheiten als Streifen, Breite nach Default-Flaeche der Art", () => {
    const e = welt().einheiten;
    expect(e.map((x) => [x.id, x.rechteck, x.quelle])).toEqual([
      [G(20), { x: 0, z: 0, breite: 24, tiefe: 15 }, "schematisch"],  // Buero 120
      [G(21), { x: 24, z: 0, breite: 6, tiefe: 15 }, "schematisch"],  // Technik 30
      [G(22), { x: 0, z: 0, breite: 30, tiefe: 15 }, "schematisch"],  // allein auf OG1
    ]);
  });
  it("ein Symbol je Typgruppe, unabhaengig von der Menge; zwei Hersteller = zwei Symbole", () => {
    const hk = welt().symbole.filter((s) => s.katalogId === "heizung.heizkoerper");
    expect(hk.map((s) => [s.hersteller, s.mengeSumme, s.bauteilIds])).toEqual([["Zehnder", 100, [G(30)]], ["Prolux", 1, [G(31)]]]);
    expect(hk.map((s) => s.position)).toEqual([{ x: 6, y: 0, z: 7.5 }, { x: 18, y: 0, z: 7.5 }]);
  });
  it("Zeilen derselben Gruppe werden zusammengefasst; vorgeschlagen gewinnt", () => {
    const b = beschreibungFixture();
    b.bauteile.push({ id: G(33), katalogId: "heizung.heizkoerper", standort: { einheitId: G(20) }, menge: 2, status: "vorgeschlagen", hersteller: "Zehnder", versorgt: [] });
    const s = welt(b).symbole.find((x) => x.hersteller === "Zehnder")!;
    expect([s.bauteilIds, s.mengeSumme, s.status]).toEqual([[G(30), G(33)], 102, "vorgeschlagen"]);
  });
  it("Menge unbekannt wird markiert, nicht als Null gezaehlt", () => {
    const b = beschreibungFixture(); b.bauteile[1].menge = null;
    const s = welt(b).symbole.find((x) => x.hersteller === "Prolux")!;
    expect([s.mengeSumme, s.mengeUnbekannt]).toEqual([0, true]);
  });
  it("Standort und Versorgung getrennt: Verteiler im EG versorgt Einheiten auf EG und OG1 (sortiert)", () => {
    const v = welt().symbole.find((s) => s.katalogId === "heizung.verteiler")!;
    expect(v.position.y).toBe(0);
    expect(v.versorgt).toEqual([G(20), G(22)]);
  });
  it("manuelles Layout bleibt, Ueberlappung wird als Hinweis gemeldet", () => {
    const b = beschreibungFixture();
    b.einheiten[2].layoutManuell = { x: 0, z: 0, breite: 10, tiefe: 15 };
    b.einheiten.push({ id: G(23), geschossId: G(11), bezeichnung: "D", art: "buero", flaecheM2: null });
    const w = welt(b);
    expect(w.einheiten.find((e) => e.id === G(22))).toMatchObject({ rechteck: { x: 0, z: 0, breite: 10, tiefe: 15 }, quelle: "manuell" });
    expect(w.hinweise).toEqual([{ code: "ueberlappung", bezug: G(23) }]);
  });
  it("manuelle Bauteilposition hat Vorrang", () => {
    const b = beschreibungFixture(); b.bauteile[0].positionManuell = { x: 1, z: 2 };
    expect(welt(b).symbole[0].position).toEqual({ x: 1, y: 0, z: 2 });
  });
  it("Bauteil direkt am Geschoss steht in der Gebaeudemitte", () => {
    const b = beschreibungFixture();
    b.bauteile.push({ id: G(34), katalogId: "heizung.waermepumpe", standort: { geschossId: G(9) }, menge: 1, status: "bestaetigt", versorgt: [] });
    expect(welt(b).symbole.find((s) => s.katalogId === "heizung.waermepumpe")!.position).toEqual({ x: 15, y: -2.5, z: 7.5 });
  });
  it("verlangt gespeicherte IDs", () => {
    const b = beschreibungFixture(); delete b.einheiten[0].id;
    expect(() => welt(b)).toThrow(/IDs/);
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag pruefen**

Run: `npx vitest run test/welt-generator.test.ts`
Expected: FAIL – `Cannot find module '../src/welt/generator.js'`.

- [ ] **Step 3: Generator implementieren** – `app/src/welt/generator.ts`

```ts
import { createHash } from "node:crypto";
import { geschossRang, type Regelwerk } from "./regelwerk.js";
import type { BauteilEingabe, Beschreibung, EinheitEingabe, Grundform, Hinweis, HuelleGespeichert, Punkt, Rechteck, Welt, WeltSymbol } from "./typen.js";

const mm = (v: number) => Math.round(v * 1000) / 1000;
const rundeRechteck = (r: Rechteck): Rechteck => ({ x: mm(r.x), z: mm(r.z), breite: mm(r.breite), tiefe: mm(r.tiefe) });
function pflichtId(x: { id?: string }): string {
  if (!x.id) throw new Error("Generator braucht gespeicherte IDs");
  return x.id;
}
function verweisId(v: { einheitId?: string }): string {
  if (!v.einheitId) throw new Error("Generator braucht gespeicherte IDs in Verweisen");
  return v.einheitId;
}

/** Teilrechtecke der Grundform; x entlang Breite, z entlang Tiefe. */
export function grundriss(form: Grundform, breite: number, tiefe: number, anteil: number): Rechteck[] {
  if (form === "quader") return [{ x: 0, z: 0, breite, tiefe }];
  const riegel = { x: 0, z: 0, breite, tiefe: anteil * tiefe };
  const sb = anteil * breite, st = (1 - anteil) * tiefe;
  const links = { x: 0, z: anteil * tiefe, breite: sb, tiefe: st };
  if (form === "l_form") return [riegel, links];
  return [riegel, links, { x: breite - sb, z: anteil * tiefe, breite: sb, tiefe: st }];
}

/** Teilt ein Rechteck entlang seiner Laengsachse proportional zu den Gewichten. */
export function streifen(r: Rechteck, gewichte: number[]): Rechteck[] {
  const summe = gewichte.reduce((s, g) => s + g, 0);
  const entlangX = r.breite >= r.tiefe;
  const laenge = entlangX ? r.breite : r.tiefe;
  let pos = 0;
  return gewichte.map((g) => {
    const l = (laenge * g) / summe;
    const t = entlangX ? { x: r.x + pos, z: r.z, breite: l, tiefe: r.tiefe } : { x: r.x, z: r.z + pos, breite: r.breite, tiefe: l };
    pos += l;
    return t;
  });
}

/** Verteilt Elemente der Reihe nach auf Teilrechtecke; jedes Teil nimmt Gewicht im Verhaeltnis seiner Flaeche auf. */
export function verteile<T>(teile: Rechteck[], elemente: T[], gewicht: (e: T) => number): T[][] {
  const flaechen = teile.map((r) => r.breite * r.tiefe);
  const total = flaechen.reduce((s, f) => s + f, 0);
  const w = elemente.reduce((s, e) => s + gewicht(e), 0);
  const gruppen: T[][] = teile.map(() => []);
  let i = 0, acc = 0;
  for (const e of elemente) {
    if (i < teile.length - 1 && gruppen[i].length > 0 && acc >= (flaechen[i] / total) * w - 1e-9) { i++; acc = 0; }
    gruppen[i].push(e);
    acc += gewicht(e);
  }
  return gruppen;
}

/** n Punkte als Zellmitten eines moeglichst quadratischen Rasters. */
export function raster(r: Rechteck, n: number): Punkt[] {
  const spalten = Math.ceil(Math.sqrt(n)), zeilen = Math.ceil(n / spalten);
  return Array.from({ length: n }, (_, k) => ({
    x: r.x + (r.breite * ((k % spalten) + 0.5)) / spalten,
    z: r.z + (r.tiefe * (Math.floor(k / spalten) + 0.5)) / zeilen,
  }));
}

const ueberlappt = (a: Rechteck, b: Rechteck) =>
  Math.min(a.x + a.breite, b.x + b.breite) - Math.max(a.x, b.x) > 1e-6 &&
  Math.min(a.z + a.tiefe, b.z + b.tiefe) - Math.max(a.z, b.z) > 1e-6;

/** JSON mit sortierten Schluesseln, Grundlage des Hashes. */
export function kanonisch(v: unknown): string {
  if (Array.isArray(v)) return "[" + v.map(kanonisch).join(",") + "]";
  if (v !== null && typeof v === "object")
    return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + kanonisch((v as Record<string, unknown>)[k])).join(",") + "}";
  return JSON.stringify(v);
}

type Gruppe = { schluessel: string; geschossId: string; katalogId: string; hersteller: string | null; typ: string | null; zeilen: BauteilEingabe[] };

export function weltErzeugen(h: HuelleGespeichert, b: Beschreibung, rw: Regelwerk): Welt {
  const teile = grundriss(h.grundform, h.breiteM, h.tiefeM, rw.schenkelAnteil);
  const ganz: Rechteck = { x: 0, z: 0, breite: h.breiteM, tiefe: h.tiefeM };
  const rang = (code: string) => {
    const r = geschossRang(code);
    if (r === null) throw new Error(`Geschoss-Code ${code} ungueltig`);
    return r;
  };

  // Geschosse stapeln: EG-Boden auf y = 0, UG darunter
  const geschosse = [...h.geschosse].sort((a, c) => rang(a.code) - rang(c.code));
  const yUnten = new Map<string, number>();
  let oben = 0;
  for (const g of geschosse.filter((g) => rang(g.code) >= 0)) { yUnten.set(g.id, oben); oben += g.hoeheM; }
  let unten = 0;
  for (const g of geschosse.filter((g) => rang(g.code) < 0).reverse()) { unten -= g.hoeheM; yUnten.set(g.id, unten); }

  // Einheiten: manuelle behalten ihr Rechteck, die uebrigen als Streifen ueber die Teilrechtecke
  const hinweise: Hinweis[] = [];
  const rechtecke = new Map<string, Rechteck>();
  const gewicht = (e: EinheitEingabe) => e.flaecheM2 ?? rw.einheitArten[e.art].defaultFlaecheM2;
  for (const g of geschosse) {
    const eigene = b.einheiten.filter((e) => e.geschossId === g.id);
    const auto = eigene.filter((e) => !e.layoutManuell);
    const manuell = eigene.filter((e) => e.layoutManuell);
    verteile(teile, auto, gewicht).forEach((gruppe, i) => {
      if (gruppe.length === 0) return;
      streifen(teile[i], gruppe.map(gewicht)).forEach((r, k) => rechtecke.set(pflichtId(gruppe[k]), r));
    });
    for (const e of manuell) rechtecke.set(pflichtId(e), e.layoutManuell!);
    for (const e of auto)
      if (manuell.some((m) => ueberlappt(rechtecke.get(pflichtId(e))!, m.layoutManuell!))) hinweise.push({ code: "ueberlappung", bezug: pflichtId(e) });
  }

  // Bauteile: ein Symbol je Standort + Katalog-ID + Hersteller + Typ
  const einheitGeschoss = new Map(b.einheiten.map((e) => [pflichtId(e), e.geschossId]));
  const einheitRang = new Map(b.einheiten.map((e, i) => [pflichtId(e), i]));
  const gruppen = new Map<string, Gruppe>();
  const jeStandort = new Map<string, Gruppe[]>();
  for (const t of b.bauteile) {
    const standortId = t.standort.einheitId ?? t.standort.geschossId;
    if (!standortId) throw new Error("Generator braucht gespeicherte IDs im Standort");
    const geschossId = t.standort.einheitId ? einheitGeschoss.get(t.standort.einheitId)! : standortId;
    const hersteller = t.hersteller ?? null, typ = t.typ ?? null;
    const schluessel = [standortId, t.katalogId, hersteller ?? "", typ ?? ""].join("|");
    let gr = gruppen.get(schluessel);
    if (!gr) {
      gr = { schluessel, geschossId, katalogId: t.katalogId, hersteller, typ, zeilen: [] };
      gruppen.set(schluessel, gr);
      jeStandort.set(standortId, [...(jeStandort.get(standortId) ?? []), gr]);
    }
    gr.zeilen.push(t);
  }
  const symbole: WeltSymbol[] = [];
  for (const [standortId, liste] of jeStandort) {
    const punkte = raster(rechtecke.get(standortId) ?? ganz, liste.length);
    liste.forEach((gr, k) => {
      const manuelle = gr.zeilen.flatMap((z) => (z.positionManuell ? [z.positionManuell] : []));
      if (manuelle.some((p) => p.x !== manuelle[0].x || p.z !== manuelle[0].z)) hinweise.push({ code: "position_widerspruch", bezug: gr.schluessel });
      const p = manuelle[0] ?? punkte[k];
      const versorgt = [...new Set(gr.zeilen.flatMap((z) => z.versorgt.map(verweisId)))].sort((a, c) => einheitRang.get(a)! - einheitRang.get(c)!);
      symbole.push({
        schluessel: gr.schluessel, katalogId: gr.katalogId, hersteller: gr.hersteller, typ: gr.typ,
        bauteilIds: gr.zeilen.map(pflichtId),
        mengeSumme: gr.zeilen.reduce((s, z) => s + (z.menge ?? 0), 0),
        mengeUnbekannt: gr.zeilen.some((z) => z.menge === null),
        status: gr.zeilen.some((z) => z.status === "vorgeschlagen") ? "vorgeschlagen" : "bestaetigt",
        position: { x: mm(p.x), y: mm(yUnten.get(gr.geschossId)!), z: mm(p.z) },
        versorgt,
      });
    });
  }

  const ohneHash = {
    regelwerkVersion: rw.version,
    grundriss: teile.map(rundeRechteck),
    geschosse: geschosse.map((g) => ({ id: g.id, code: g.code, yUnten: mm(yUnten.get(g.id)!), hoehe: mm(g.hoeheM) })),
    einheiten: b.einheiten.map((e) => ({
      id: pflichtId(e), geschossId: e.geschossId, bezeichnung: e.bezeichnung, art: e.art,
      rechteck: rundeRechteck(rechtecke.get(pflichtId(e))!),
      quelle: (e.layoutManuell ? "manuell" : "schematisch") as "manuell" | "schematisch",
    })),
    symbole,
    hinweise,
  };
  return { ...ohneHash, hash: createHash("sha256").update(kanonisch(ohneHash)).digest("hex") };
}
```

- [ ] **Step 4: Test laufen lassen**

Run: `npx vitest run test/welt-generator.test.ts`
Expected: PASS (13 Tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/welt/generator.ts app/test/welt-generator.test.ts
git commit -m "M2a: deterministischer Weltgenerator mit Symbolen je Typgruppe

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Heizung und fachliche Pruefung

**Files:**
- Create: `app/src/welt/heizung.ts`, `app/src/welt/pruefung.ts`
- Test: `app/test/welt-pruefung.test.ts`

**Interfaces:**
- Consumes: Typen, `Katalog`, `Regelwerk`, `STANDORT_GESCHOSS`, `KATALOG_V1`, `REGELWERK_V1`, Fixtures.
- Produces:
  - `wirksameHeizung(standard: Heizung, ausnahme?: Partial<Heizung>): Heizung`
  - `verteilerHinweise(b: Beschreibung): Hinweis[]` (Code `verteiler_vorschlag`, bezug = Einheit-ID)
  - `interface Bestand { geschossIds: Set<string>; einheitIds: Set<string>; bauteilIds: Set<string>; einheitenManuell: Set<string>; bauteileManuell: Set<string> }`
  - `pruefeBeschreibung(b: Beschreibung, bestand: Bestand, rw: Regelwerk, katalog: Katalog): Fehler[]` – Reihenfolge: zuerst alle Einheiten, dann alle Bauteile, zuletzt `loeschen_blockiert`.

- [ ] **Step 1: Failing Test schreiben** – `app/test/welt-pruefung.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { pruefeBeschreibung, type Bestand } from "../src/welt/pruefung.js";
import { verteilerHinweise, wirksameHeizung } from "../src/welt/heizung.js";
import { KATALOG_V1 } from "../src/welt/katalog.v1.js";
import { REGELWERK_V1 } from "../src/welt/regelwerk.v1.js";
import type { Beschreibung } from "../src/welt/typen.js";
import { G, beschreibungFixture } from "./hilfe-welt.js";

const bestand = (): Bestand => ({
  geschossIds: new Set([G(9), G(10), G(11)]), einheitIds: new Set([G(20), G(21), G(22)]),
  bauteilIds: new Set([G(30), G(31), G(32)]), einheitenManuell: new Set(), bauteileManuell: new Set(),
});
const codes = (b: Beschreibung, best = bestand()) => pruefeBeschreibung(b, best, REGELWERK_V1, KATALOG_V1).map((f) => f.code);

describe("wirksameHeizung", () => {
  it("Ausnahme vor Standard", () => {
    expect(wirksameHeizung({ hk: "ja", fbh: "nein", tabs: "unbekannt" }, { fbh: "ja" })).toEqual({ hk: "ja", fbh: "ja", tabs: "unbekannt" });
    expect(wirksameHeizung({ hk: "ja", fbh: "nein", tabs: "nein" })).toEqual({ hk: "ja", fbh: "nein", tabs: "nein" });
  });
});

describe("verteilerHinweise", () => {
  it("FBH ohne versorgenden Verteiler ergibt Vorschlag, versorgte nicht", () => {
    const b = beschreibungFixture();
    b.einheiten[2].heizungAusnahme = { fbh: "ja" };
    expect(verteilerHinweise(b)).toEqual([]);
    b.bauteile[2].versorgt = [{ einheitId: G(20) }];
    expect(verteilerHinweise(b)).toEqual([{ code: "verteiler_vorschlag", bezug: G(22) }]);
  });
});

describe("pruefeBeschreibung", () => {
  it("gueltige Beschreibung ohne Fehler", () => expect(codes(beschreibungFixture())).toEqual([]));
  it("unbekannte Art, unbekannte Katalog-ID, nicht erlaubter Standort", () => {
    const b = beschreibungFixture();
    b.einheiten[0].art = "kino";
    b.bauteile[1].katalogId = "heizung.kamin";
    b.bauteile[2].katalogId = "heizung.waermepumpe"; // Zentrale ...
    b.bauteile[2].standort = { einheitId: G(22) };   // ... in Buero C: nicht erlaubt
    expect(codes(b)).toEqual(["art_unbekannt", "katalog_unbekannt", "katalog_nicht_erlaubt"]);
  });
  it("Mengen ausserhalb Katalogbereich oder nicht ganzzahlig; null ist erlaubt", () => {
    const b = beschreibungFixture();
    b.bauteile[0].menge = 501; b.bauteile[1].menge = 2.5; b.bauteile[2].menge = null;
    expect(codes(b)).toEqual(["menge_ungueltig", "menge_ungueltig"]);
  });
  it("fremde und doppelte IDs", () => {
    const b = beschreibungFixture();
    b.einheiten.push({ id: G(99), geschossId: G(10), bezeichnung: "X", art: "buero", flaecheM2: null });
    b.bauteile.push({ ...b.bauteile[0] });
    expect(codes(b)).toEqual(["id_unbekannt", "id_doppelt"]);
  });
  it("Standort fehlt, doppelt oder zeigt ins Leere", () => {
    const b = beschreibungFixture();
    b.bauteile[0].standort = {};
    b.bauteile[1].standort = { einheitId: G(20), geschossId: G(10) };
    b.bauteile[2].standort = { einheitIndex: 7 };
    expect(codes(b)).toEqual(["standort_fehlt", "standort_doppelt", "verweis_ungueltig"]);
  });
  it("Geschoss ausserhalb des Gebaeudes", () => {
    const b = beschreibungFixture(); b.einheiten[0].geschossId = G(98);
    expect(codes(b)).toEqual(["verweis_ungueltig"]);
  });
  it("Versorgung einer entfernten Einheit", () => {
    const b = beschreibungFixture(); b.einheiten.splice(2, 1);
    expect(codes(b)).toEqual(["verweis_ungueltig"]);
  });
  it("bestaetigt nur, wenn die wirksame Heizungsart ja ist", () => {
    const b = beschreibungFixture();
    b.bauteile.push({ katalogId: "heizung.fbh_kreis", standort: { einheitId: G(20) }, menge: 2, status: "bestaetigt", versorgt: [] });
    expect(codes(b)).toEqual(["bestaetigt_bei_unbekannt"]);
    b.einheiten[0].heizungAusnahme = { fbh: "ja" };
    expect(codes(b)).toEqual([]);
    b.einheiten[0].heizungAusnahme = { fbh: "unbekannt" };
    b.bauteile[3].status = "vorgeschlagen";
    expect(codes(b)).toEqual([]);
  });
  it("Loeschen mit manuellem Layout ist blockiert", () => {
    const b = beschreibungFixture();
    b.einheiten.splice(2, 1);
    b.bauteile[2].versorgt = [{ einheitId: G(20) }];
    const best = bestand(); best.einheitenManuell.add(G(22));
    expect(codes(b, best)).toEqual(["loeschen_blockiert"]);
  });
  it("neue Einheit ohne ID ist per Index referenzierbar", () => {
    const b = beschreibungFixture();
    b.einheiten.push({ geschossId: G(11), bezeichnung: "Neu", art: "buero", flaecheM2: null });
    b.bauteile.push({ katalogId: "heizung.heizkoerper", standort: { einheitIndex: 3 }, menge: 4, status: "bestaetigt", versorgt: [] });
    b.bauteile[2].versorgt.push({ einheitIndex: 3 });
    expect(codes(b)).toEqual([]);
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag pruefen**

Run: `npx vitest run test/welt-pruefung.test.ts`
Expected: FAIL – Modul `pruefung.js` bzw. `heizung.js` fehlt.

- [ ] **Step 3: `heizung.ts` implementieren**

```ts
import type { Beschreibung, Heizung, Hinweis } from "./typen.js";

/** Wirksamer Wert je Art: Ausnahme der Einheit, sonst Standard des Gebaeudes. */
export function wirksameHeizung(standard: Heizung, ausnahme?: Partial<Heizung>): Heizung {
  return { hk: ausnahme?.hk ?? standard.hk, fbh: ausnahme?.fbh ?? standard.fbh, tabs: ausnahme?.tabs ?? standard.tabs };
}

/** Einheiten mit wirksamer FBH, die kein Verteiler versorgt: Vorschlag, keine Behauptung (ADR 0032 Punkt 5). */
export function verteilerHinweise(b: Beschreibung): Hinweis[] {
  const versorgt = new Set<string>();
  for (const t of b.bauteile) if (t.katalogId === "heizung.verteiler") for (const v of t.versorgt) if (v.einheitId) versorgt.add(v.einheitId);
  const hinweise: Hinweis[] = [];
  for (const e of b.einheiten)
    if (e.id && wirksameHeizung(b.heizungStandard, e.heizungAusnahme).fbh === "ja" && !versorgt.has(e.id))
      hinweise.push({ code: "verteiler_vorschlag", bezug: e.id });
  return hinweise;
}
```

- [ ] **Step 4: `pruefung.ts` implementieren**

```ts
import { STANDORT_GESCHOSS, type Katalog, type Regelwerk } from "./regelwerk.js";
import { wirksameHeizung } from "./heizung.js";
import type { Beschreibung, EinheitEingabe, EinheitVerweis, Fehler } from "./typen.js";

/** IDs, die heute zu diesem Gebaeude gehoeren (aus der DB). */
export interface Bestand {
  geschossIds: Set<string>; einheitIds: Set<string>; bauteilIds: Set<string>;
  einheitenManuell: Set<string>; bauteileManuell: Set<string>;
}

export function pruefeBeschreibung(b: Beschreibung, bestand: Bestand, rw: Regelwerk, katalog: Katalog): Fehler[] {
  const fehler: Fehler[] = [];
  const melde = (pfad: string, code: string, meldung: string) => fehler.push({ pfad, code, meldung });
  const eintraege = new Map(katalog.eintraege.map((e) => [e.id, e]));

  const einheitIds = new Set<string>();
  b.einheiten.forEach((e, i) => {
    const p = `einheiten[${i}]`;
    if (e.id !== undefined) {
      if (!bestand.einheitIds.has(e.id)) melde(`${p}.id`, "id_unbekannt", "Einheit gehoert nicht zu diesem Gebaeude");
      else if (einheitIds.has(e.id)) melde(`${p}.id`, "id_doppelt", "Einheit mehrfach angegeben");
      einheitIds.add(e.id);
    }
    if (!bestand.geschossIds.has(e.geschossId)) melde(`${p}.geschossId`, "verweis_ungueltig", "Geschoss gehoert nicht zu diesem Gebaeude");
    if (!Object.hasOwn(rw.einheitArten, e.art)) melde(`${p}.art`, "art_unbekannt", `Einheit-Art ${e.art} ist im Regelwerk nicht vorgesehen`);
  });

  const einheitZu = (v: EinheitVerweis): EinheitEingabe | undefined => {
    if (v.einheitId !== undefined)
      return bestand.einheitIds.has(v.einheitId) ? b.einheiten.find((e) => e.id === v.einheitId) : undefined;
    if (v.einheitIndex !== undefined && Number.isInteger(v.einheitIndex) && v.einheitIndex >= 0 && v.einheitIndex < b.einheiten.length)
      return b.einheiten[v.einheitIndex];
    return undefined;
  };

  const bauteilIds = new Set<string>();
  b.bauteile.forEach((t, j) => {
    const p = `bauteile[${j}]`;
    if (t.id !== undefined) {
      if (!bestand.bauteilIds.has(t.id)) melde(`${p}.id`, "id_unbekannt", "Bauteil gehoert nicht zu diesem Gebaeude");
      else if (bauteilIds.has(t.id)) melde(`${p}.id`, "id_doppelt", "Bauteil mehrfach angegeben");
      bauteilIds.add(t.id);
    }
    const k = eintraege.get(t.katalogId);
    if (!k) melde(`${p}.katalogId`, "katalog_unbekannt", `Katalog-ID ${t.katalogId} unbekannt`);

    const s = t.standort;
    const anzahl = [s.einheitId, s.einheitIndex, s.geschossId].filter((x) => x !== undefined).length;
    let artStandort: string | undefined;
    let einheit: EinheitEingabe | undefined;
    if (anzahl === 0) melde(`${p}.standort`, "standort_fehlt", "Standort fehlt");
    else if (anzahl > 1) melde(`${p}.standort`, "standort_doppelt", "Genau einen Standort angeben");
    else if (s.geschossId !== undefined) {
      if (bestand.geschossIds.has(s.geschossId)) artStandort = STANDORT_GESCHOSS;
      else melde(`${p}.standort`, "verweis_ungueltig", "Geschoss gehoert nicht zu diesem Gebaeude");
    } else {
      einheit = einheitZu(s);
      if (einheit) artStandort = einheit.art;
      else melde(`${p}.standort`, "verweis_ungueltig", "Einheit nicht in dieser Beschreibung");
    }

    if (k && artStandort !== undefined && Object.hasOwn(rw.erlaubt, artStandort) && !rw.erlaubt[artStandort].includes(k.id))
      melde(`${p}.katalogId`, "katalog_nicht_erlaubt", `${k.name} ist an diesem Standort nicht vorgesehen`);
    if (k && t.menge !== null && (!Number.isInteger(t.menge) || t.menge < 0 || t.menge > k.mengeMax))
      melde(`${p}.menge`, "menge_ungueltig", `Ganze Zahl 0–${k.mengeMax} oder unbekannt erwartet`);
    if (k?.heizArt && t.status === "bestaetigt" && einheit && wirksameHeizung(b.heizungStandard, einheit.heizungAusnahme)[k.heizArt] !== "ja")
      melde(`${p}.status`, "bestaetigt_bei_unbekannt", `Bestaetigt nur moeglich, wenn ${k.heizArt.toUpperCase()} in der Einheit vorhanden ist`);
    t.versorgt.forEach((v, m) => {
      if (!einheitZu(v)) melde(`${p}.versorgt[${m}]`, "verweis_ungueltig", "Versorgte Einheit nicht in dieser Beschreibung");
    });
  });

  for (const id of bestand.einheitenManuell) if (!einheitIds.has(id)) melde("einheiten", "loeschen_blockiert", `Einheit ${id} hat ein manuelles Layout`);
  for (const id of bestand.bauteileManuell) if (!bauteilIds.has(id)) melde("bauteile", "loeschen_blockiert", `Bauteil ${id} hat eine manuelle Position`);
  return fehler;
}
```

- [ ] **Step 5: Test laufen lassen**

Run: `npx vitest run test/welt-pruefung.test.ts`
Expected: PASS (12 Tests).

- [ ] **Step 6: Commit**

```bash
git add app/src/welt/heizung.ts app/src/welt/pruefung.ts app/test/welt-pruefung.test.ts
git commit -m "M2a: Heizungsstandard mit Ausnahmen und fachliche Pruefung

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Migration `013_gebaeude.sql`

**Files:**
- Create: `app/src/db/migrationen/013_gebaeude.sql`
- Test: `app/test/welt-migration.test.ts`

**Interfaces:**
- Consumes: `frischeDb()` aus `test/hilfe.ts` (legt DB an und migriert).
- Produces: Tabellen `gebaeude`, `geschoss`, `einheit`, `gebaeude_heizung_standard`, `einheit_heizung`, `bauteil` (mit `gebaeude_id`), `versorgung`. Spalten wie Spec §4; zusaetzlich `bauteil.gebaeude_id` fuer direkte Abfragen.

- [ ] **Step 1: Failing Test schreiben** – `app/test/welt-migration.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { frischeDb } from "./hilfe.js";

let db: Awaited<ReturnType<typeof frischeDb>>;
let L1: string, L2: string, G1: string, GS1: string;
const q = (sql: string, p: unknown[] = []) => db.pool.query(sql, p);

beforeAll(async () => {
  db = await frischeDb();
  L1 = (await q("insert into liegenschaft(name) values ('L1') returning id")).rows[0].id;
  L2 = (await q("insert into liegenschaft(name) values ('L2') returning id")).rows[0].id;
  G1 = (await q("insert into gebaeude(liegenschaft_id, name, grundform, breite_m, tiefe_m, regelwerk_version) values ($1,'G','quader',30,15,1) returning id", [L1])).rows[0].id;
  GS1 = (await q("insert into geschoss(liegenschaft_id, gebaeude_id, code, reihenfolge, hoehe_m) values ($1,$2,'EG',0,3.2) returning id", [L1, G1])).rows[0].id;
});
afterAll(async () => { await db.ende(); });

describe("Migration 013", () => {
  it("Einheit mit fremder Liegenschaft scheitert am zusammengesetzten Fremdschluessel", async () => {
    await expect(q("insert into einheit(liegenschaft_id, geschoss_id, bezeichnung, art, reihenfolge) values ($1,$2,'X','buero',0)", [L2, GS1]))
      .rejects.toThrow(/foreign key/);
  });
  it("Bauteil braucht genau einen Standort", async () => {
    const sql = "insert into bauteil(liegenschaft_id, gebaeude_id, katalog_id, einheit_id, geschoss_id, status, reihenfolge) values ($1,$2,'heizung.verteiler',null,$3,'bestaetigt',0)";
    await expect(q(sql.replace(",$3,", ",null,"), [L1, G1])).rejects.toThrow(/check/);
    await expect(q(sql, [L1, G1, GS1])).resolves.toBeDefined();
  });
  it("negative Menge, unbekannter Status und ungueltiges Baujahr scheitern", async () => {
    const sql = "insert into bauteil(liegenschaft_id, gebaeude_id, katalog_id, geschoss_id, status, menge, baujahr, reihenfolge) values ($1,$2,'heizung.verteiler',$3,$4,$5,$6,0)";
    await expect(q(sql, [L1, G1, GS1, "bestaetigt", -1, null])).rejects.toThrow(/check/);
    await expect(q(sql, [L1, G1, GS1, "vielleicht", 1, null])).rejects.toThrow(/check/);
    await expect(q(sql, [L1, G1, GS1, "bestaetigt", 1, 1700])).rejects.toThrow(/check/);
  });
  it("Heizungswerte nur ja/nein/unbekannt", async () => {
    await expect(q("insert into gebaeude_heizung_standard(gebaeude_id, liegenschaft_id, art, vorhanden) values ($1,$2,'hk','vielleicht')", [G1, L1])).rejects.toThrow(/check/);
  });
  it("planora_app darf alle neuen Tabellen lesen und schreiben", async () => {
    for (const t of ["gebaeude", "geschoss", "einheit", "gebaeude_heizung_standard", "einheit_heizung", "bauteil", "versorgung"])
      expect((await q("select has_table_privilege('planora_app', $1, 'select,insert,update,delete') ok", [t])).rows[0].ok).toBe(true);
  });
  it("Loeschen des Gebaeudes raeumt alles ab", async () => {
    const g = (await q("insert into gebaeude(liegenschaft_id, name, grundform, breite_m, tiefe_m, regelwerk_version) values ($1,'Weg','quader',20,10,1) returning id", [L1])).rows[0].id;
    const gs = (await q("insert into geschoss(liegenschaft_id, gebaeude_id, code, reihenfolge, hoehe_m) values ($1,$2,'EG',0,3) returning id", [L1, g])).rows[0].id;
    const e = (await q("insert into einheit(liegenschaft_id, geschoss_id, bezeichnung, art, reihenfolge) values ($1,$2,'E','buero',0) returning id", [L1, gs])).rows[0].id;
    await q("insert into einheit_heizung(einheit_id, liegenschaft_id, art, vorhanden) values ($1,$2,'fbh','ja')", [e, L1]);
    const t = (await q("insert into bauteil(liegenschaft_id, gebaeude_id, katalog_id, einheit_id, status, reihenfolge) values ($1,$2,'heizung.verteiler',$3,'bestaetigt',0) returning id", [L1, g, e])).rows[0].id;
    await q("insert into versorgung(bauteil_id, einheit_id, liegenschaft_id) values ($1,$2,$3)", [t, e, L1]);
    await q("delete from gebaeude where id=$1", [g]);
    const anzahl = async (sql: string, p: unknown[]) => (await q(`select count(*)::int n from ${sql}`, p)).rows[0].n;
    expect(await anzahl("geschoss where gebaeude_id=$1", [g])).toBe(0);
    expect(await anzahl("einheit where id=$1", [e])).toBe(0);
    expect(await anzahl("einheit_heizung where einheit_id=$1", [e])).toBe(0);
    expect(await anzahl("bauteil where id=$1", [t])).toBe(0);
    expect(await anzahl("versorgung where bauteil_id=$1", [t])).toBe(0);
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag pruefen**

Run: `npx vitest run test/welt-migration.test.ts`
Expected: FAIL – `relation "gebaeude" does not exist`.

- [ ] **Step 3: Migration schreiben** – `app/src/db/migrationen/013_gebaeude.sql`

```sql
-- M2a Welt-Kern (Spec docs/superpowers/specs/2026-11-11-m2a-welt-kern-design.md §4).
-- Jede Tabelle fuehrt liegenschaft_id; zusammengesetzte Fremdschluessel verhindern Verweise in fremde Liegenschaften.
create table gebaeude(
  id uuid primary key default gen_random_uuid(),
  liegenschaft_id uuid not null references liegenschaft(id) on delete cascade,
  name text not null check (length(name) between 1 and 200),
  grundform text not null check (grundform in ('quader','l_form','u_form')),
  breite_m double precision not null check (breite_m between 5 and 200),
  tiefe_m double precision not null check (tiefe_m between 5 and 200),
  regelwerk_version int not null,
  stand int not null default 0,
  unique (id, liegenschaft_id)
);
create table geschoss(
  id uuid primary key default gen_random_uuid(),
  liegenschaft_id uuid not null,
  gebaeude_id uuid not null,
  code text not null,
  reihenfolge int not null,
  hoehe_m double precision not null check (hoehe_m between 2.4 and 6.0),
  unique (gebaeude_id, code),
  unique (id, liegenschaft_id),
  foreign key (gebaeude_id, liegenschaft_id) references gebaeude(id, liegenschaft_id) on delete cascade
);
create table einheit(
  id uuid primary key default gen_random_uuid(),
  liegenschaft_id uuid not null,
  geschoss_id uuid not null,
  bezeichnung text not null check (length(bezeichnung) between 1 and 200),
  art text not null,
  flaeche_m2 double precision check (flaeche_m2 > 0),
  reihenfolge int not null,
  layout_manuell jsonb,
  unique (id, liegenschaft_id),
  foreign key (geschoss_id, liegenschaft_id) references geschoss(id, liegenschaft_id) on delete cascade
);
create index einheit_geschoss on einheit(geschoss_id);
create table gebaeude_heizung_standard(
  gebaeude_id uuid not null,
  liegenschaft_id uuid not null,
  art text not null check (art in ('hk','fbh','tabs')),
  vorhanden text not null check (vorhanden in ('ja','nein','unbekannt')),
  primary key (gebaeude_id, art),
  foreign key (gebaeude_id, liegenschaft_id) references gebaeude(id, liegenschaft_id) on delete cascade
);
-- Nur Ausnahmen vom Gebaeudestandard
create table einheit_heizung(
  einheit_id uuid not null,
  liegenschaft_id uuid not null,
  art text not null check (art in ('hk','fbh','tabs')),
  vorhanden text not null check (vorhanden in ('ja','nein','unbekannt')),
  primary key (einheit_id, art),
  foreign key (einheit_id, liegenschaft_id) references einheit(id, liegenschaft_id) on delete cascade
);
create table bauteil(
  id uuid primary key default gen_random_uuid(),
  liegenschaft_id uuid not null,
  gebaeude_id uuid not null,
  katalog_id text not null,
  einheit_id uuid,
  geschoss_id uuid,
  menge int check (menge >= 0),
  status text not null check (status in ('vorgeschlagen','bestaetigt')),
  hersteller text check (length(hersteller) <= 200),
  typ text check (length(typ) <= 200),
  baujahr int check (baujahr between 1800 and 2100),
  reihenfolge int not null,
  position_manuell jsonb,
  check (num_nonnulls(einheit_id, geschoss_id) = 1),
  unique (id, liegenschaft_id),
  foreign key (gebaeude_id, liegenschaft_id) references gebaeude(id, liegenschaft_id) on delete cascade,
  foreign key (einheit_id, liegenschaft_id) references einheit(id, liegenschaft_id),
  foreign key (geschoss_id, liegenschaft_id) references geschoss(id, liegenschaft_id)
);
create index bauteil_gebaeude on bauteil(gebaeude_id);
create table versorgung(
  bauteil_id uuid not null,
  einheit_id uuid not null,
  liegenschaft_id uuid not null,
  primary key (bauteil_id, einheit_id),
  foreign key (bauteil_id, liegenschaft_id) references bauteil(id, liegenschaft_id) on delete cascade,
  foreign key (einheit_id, liegenschaft_id) references einheit(id, liegenschaft_id) on delete cascade
);
grant select, insert, update, delete on gebaeude, geschoss, einheit, gebaeude_heizung_standard, einheit_heizung, bauteil, versorgung to planora_app;
```

- [ ] **Step 4: Test laufen lassen**

Run: `npx vitest run test/welt-migration.test.ts`
Expected: PASS (6 Tests). Falls "Loeschen des Gebaeudes" am Fremdschluessel `bauteil → einheit` scheitert (Kaskaden-Reihenfolge), die beiden Fremdschluessel `bauteil(einheit_id…)` und `bauteil(geschoss_id…)` um `on delete cascade` ergaenzen; das Blockieren beim Abgleich geschieht ohnehin im Code.

- [ ] **Step 5: Migrations-Gesamttests laufen lassen**

Run: `npx vitest run test/migrator.test.ts test/backup-migration.test.ts`
Expected: PASS. Falls ein Test eine feste Anzahl Migrationen erwartet, Zahl dort um 1 erhoehen und im Commit erwaehnen.

- [ ] **Step 6: Commit**

```bash
git add app/src/db/migrationen/013_gebaeude.sql app/test/welt-migration.test.ts
git commit -m "M2a: Migration 013 Gebaeude, Geschosse, Einheiten, Heizung, Bauteile, Versorgung

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Speicher (Huelle und Abgleich)

**Files:**
- Create: `app/src/welt/speicher.ts`
- Test: `app/test/welt-speicher.test.ts`

**Interfaces:**
- Consumes: `pruefeBeschreibung`, `Bestand`, `wirksameHeizung`, `verteilerHinweise`, `geschossRang`, Typen, Migration 013.
- Produces:
  - `class FachFehler extends Error { fehler: Fehler[]; status: 409 | 422 }`
  - `pruefeHuelle(h: Huelle, rw: Regelwerk): Fehler[]`
  - `legeGebaeudeAn(c: pg.ClientBase, liegenschaftId: string, h: Huelle, rw: Regelwerk): Promise<string>`
  - `aendereHuelle(c: pg.ClientBase, gebaeudeId: string, h: Huelle, rw: Regelwerk): Promise<void>`
  - `ladeHuelle(c: pg.ClientBase, gebaeudeId: string): Promise<HuelleGespeichert | null>`
  - `ladeBeschreibung(c: pg.ClientBase, gebaeudeId: string): Promise<Beschreibung | null>`
  - `type Zaehler = Record<"einheiten" | "bauteile", { angelegt: number; aktualisiert: number; geloescht: number }>`
  - `schreibeBeschreibung(c: pg.ClientBase, gebaeudeId: string, b: Beschreibung, rw: Regelwerk, katalog: Katalog): Promise<Zaehler>`
  - Alle Funktionen laufen in der Transaktion des Aufrufers.

- [ ] **Step 1: Failing Test schreiben** – `app/test/welt-speicher.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type pg from "pg";
import { frischeDb } from "./hilfe.js";
import { FachFehler, aendereHuelle, ladeBeschreibung, ladeHuelle, legeGebaeudeAn, pruefeHuelle, schreibeBeschreibung } from "../src/welt/speicher.js";
import { REGELWERK_V1 } from "../src/welt/regelwerk.v1.js";
import { KATALOG_V1 } from "../src/welt/katalog.v1.js";
import type { Beschreibung, Huelle, HuelleGespeichert } from "../src/welt/typen.js";

let db: Awaited<ReturnType<typeof frischeDb>>; let L1: string;
const HUELLE: Huelle = { name: "Test", grundform: "quader", breiteM: 30, tiefeM: 15, geschosse: [{ code: "EG" }, { code: "OG1" }] };

async function tx<T>(f: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await db.pool.connect();
  try { await c.query("begin"); const r = await f(c); await c.query("commit"); return r; }
  catch (e) { await c.query("rollback"); throw e; } finally { c.release(); }
}
const schreibe = (g: string, b: Beschreibung) => tx((c) => schreibeBeschreibung(c, g, b, REGELWERK_V1, KATALOG_V1));
const lade = async (g: string) => (await tx((c) => ladeBeschreibung(c, g)))!;
async function neuesGebaeude() {
  const g = await tx((c) => legeGebaeudeAn(c, L1, HUELLE, REGELWERK_V1));
  return { g, h: (await tx((c) => ladeHuelle(c, g)))! };
}
function basis(h: HuelleGespeichert): Beschreibung {
  const [eg, og1] = h.geschosse;
  return {
    gebaeudeId: h.gebaeudeId, stand: h.stand, heizungStandard: { hk: "ja", fbh: "nein", tabs: "nein" },
    einheiten: [
      { geschossId: eg.id, bezeichnung: "Restaurant", art: "gastro", flaecheM2: 150, heizungAusnahme: { hk: "nein", fbh: "ja" } },
      { geschossId: eg.id, bezeichnung: "Technik", art: "technik", flaecheM2: null },
      { geschossId: og1.id, bezeichnung: "Buero C", art: "buero", flaecheM2: null },
    ],
    bauteile: [
      { katalogId: "heizung.verteiler", standort: { einheitIndex: 1 }, menge: 1, status: "bestaetigt", versorgt: [{ einheitIndex: 2 }, { einheitIndex: 0 }] },
      { katalogId: "heizung.fbh_kreis", standort: { einheitIndex: 0 }, menge: 6, status: "bestaetigt", versorgt: [] },
    ],
  };
}
const fehlerVon = (p: Promise<unknown>) => p.then(() => { throw new Error("FachFehler erwartet"); }, (e) => e as FachFehler);

beforeAll(async () => {
  db = await frischeDb();
  L1 = (await db.pool.query("insert into liegenschaft(name) values ('L1') returning id")).rows[0].id;
});
afterAll(async () => { await db.ende(); });

describe("Huelle", () => {
  it("pruefeHuelle meldet Masse, Codes, Doppel und Hoehen", () => {
    expect(pruefeHuelle({ ...HUELLE, breiteM: 4, geschosse: [{ code: "XX" }, { code: "EG" }, { code: "EG", hoeheM: 7 }] }, REGELWERK_V1).map((f) => f.code))
      .toEqual(["mass_ungueltig", "geschoss_code_ungueltig", "geschoss_doppelt", "hoehe_ungueltig"]);
    expect(pruefeHuelle({ ...HUELLE, geschosse: [] }, REGELWERK_V1).map((f) => f.code)).toEqual(["geschoss_fehlt"]);
  });
  it("legeGebaeudeAn speichert Geschosse nach Rang mit Default-Hoehe", async () => {
    const g = await tx((c) => legeGebaeudeAn(c, L1, { ...HUELLE, geschosse: [{ code: "OG1" }, { code: "UG1", hoeheM: 2.6 }, { code: "EG" }] }, REGELWERK_V1));
    const h = (await tx((c) => ladeHuelle(c, g)))!;
    expect(h.geschosse.map((x) => [x.code, x.hoeheM])).toEqual([["UG1", 2.6], ["EG", 3.2], ["OG1", 3.2]]);
    expect([h.stand, h.regelwerkVersion, h.liegenschaftId]).toEqual([0, 1, L1]);
  });
  it("aendereHuelle: belegtes Geschoss nicht loeschbar; neues Geschoss und Code-Tausch moeglich", async () => {
    const { g, h } = await neuesGebaeude();
    await schreibe(g, basis(h));
    const [eg, og1] = h.geschosse;
    const e = await fehlerVon(tx((c) => aendereHuelle(c, g, { ...HUELLE, geschosse: [{ id: eg.id, code: "EG" }] }, REGELWERK_V1)));
    expect([e.status, e.fehler.map((f) => f.code)]).toEqual([422, ["geschoss_belegt"]]);
    await tx((c) => aendereHuelle(c, g, { ...HUELLE, geschosse: [{ id: eg.id, code: "EG" }, { id: og1.id, code: "OG2" }, { code: "OG1" }] }, REGELWERK_V1));
    const neu = (await tx((c) => ladeHuelle(c, g)))!;
    expect(neu.geschosse.map((x) => x.code)).toEqual(["EG", "OG1", "OG2"]);
    expect(neu.geschosse[2].id).toBe(og1.id);
    expect(neu.stand).toBe(2);
  });
});

describe("Beschreibung", () => {
  it("schreibt und liest: IDs, Standard, Ausnahme, Versorgung sortiert, keine Hinweise", async () => {
    const { g, h } = await neuesGebaeude();
    const z = await schreibe(g, basis(h));
    expect(z).toEqual({ einheiten: { angelegt: 3, aktualisiert: 0, geloescht: 0 }, bauteile: { angelegt: 2, aktualisiert: 0, geloescht: 0 } });
    const b = await lade(g);
    expect(b.stand).toBe(1);
    expect(b.einheiten.map((e) => e.bezeichnung)).toEqual(["Restaurant", "Technik", "Buero C"]);
    expect(b.einheiten[0].heizungWirksam).toEqual({ hk: "nein", fbh: "ja", tabs: "nein" });
    expect(b.einheiten[2].heizungWirksam).toEqual({ hk: "ja", fbh: "nein", tabs: "nein" });
    expect(b.bauteile[0].standort).toEqual({ einheitId: b.einheiten[1].id });
    expect(b.bauteile[0].versorgt).toEqual([{ einheitId: b.einheiten[0].id }, { einheitId: b.einheiten[2].id }]);
    expect(b.hinweise).toEqual([]);
  });
  it("unveraendert zurueckschreiben behaelt alle IDs", async () => {
    const { g, h } = await neuesGebaeude();
    await schreibe(g, basis(h));
    const b1 = await lade(g);
    const z = await schreibe(g, b1);
    const b2 = await lade(g);
    expect(z.einheiten).toEqual({ angelegt: 0, aktualisiert: 3, geloescht: 0 });
    expect(b2.einheiten.map((e) => e.id)).toEqual(b1.einheiten.map((e) => e.id));
    expect(b2.bauteile.map((t) => t.id)).toEqual(b1.bauteile.map((t) => t.id));
    expect(b2.stand).toBe(b1.stand + 1);
  });
  it("neue Einheit erbt Standard; Standardaenderung wirkt nicht auf Ausnahmen", async () => {
    const { g, h } = await neuesGebaeude();
    await schreibe(g, basis(h));
    const b = await lade(g);
    b.einheiten.push({ geschossId: h.geschosse[1].id, bezeichnung: "Neu", art: "buero", flaecheM2: null });
    b.heizungStandard = { hk: "nein", fbh: "unbekannt", tabs: "nein" };
    await schreibe(g, b);
    const n = await lade(g);
    expect(n.einheiten[3].heizungWirksam).toEqual({ hk: "nein", fbh: "unbekannt", tabs: "nein" });
    expect(n.einheiten[0].heizungWirksam).toEqual({ hk: "nein", fbh: "ja", tabs: "nein" });
  });
  it("Kopie ohne ID ergibt eigenes Exemplar", async () => {
    const { g, h } = await neuesGebaeude();
    await schreibe(g, basis(h));
    const b = await lade(g);
    const { id: _weg, ...kopie } = b.einheiten[2];
    b.einheiten.push({ ...kopie, bezeichnung: "Buero C Kopie" });
    await schreibe(g, b);
    const n = await lade(g);
    expect(n.einheiten).toHaveLength(4);
    expect(n.einheiten[3].id).not.toBe(n.einheiten[2].id);
    expect(n.einheiten[2].id).toBe(b.einheiten[2].id);
  });
  it("Loeschen entfernt Einheit und Bauteil", async () => {
    const { g, h } = await neuesGebaeude();
    await schreibe(g, basis(h));
    const b = await lade(g);
    b.bauteile.splice(1, 1);                       // FBH-Kreis im Restaurant
    b.bauteile[0].versorgt = [{ einheitId: b.einheiten[2].id! }];
    b.einheiten.splice(0, 1);                      // Restaurant
    const z = await schreibe(g, b);
    expect([z.einheiten.geloescht, z.bauteile.geloescht]).toEqual([1, 1]);
    expect((await lade(g)).einheiten.map((e) => e.bezeichnung)).toEqual(["Technik", "Buero C"]);
  });
  it("manuelle Position bleibt erhalten; Loeschen ist dann blockiert", async () => {
    const { g, h } = await neuesGebaeude();
    await schreibe(g, basis(h));
    const b = await lade(g);
    b.bauteile[1].positionManuell = { x: 2, z: 3 };
    await schreibe(g, b);
    const b2 = await lade(g);
    expect(b2.bauteile[1].positionManuell).toEqual({ x: 2, z: 3 });
    b2.bauteile.splice(1, 1);
    const e = await fehlerVon(schreibe(g, b2));
    expect([e.status, e.fehler.map((f) => f.code)]).toEqual([422, ["loeschen_blockiert"]]);
  });
  it("veralteter Stand ergibt 409 und aendert nichts", async () => {
    const { g, h } = await neuesGebaeude();
    await schreibe(g, basis(h));
    const e = await fehlerVon(schreibe(g, basis(h)));
    expect([e.status, e.fehler[0].code]).toEqual([409, "stand_veraltet"]);
    expect((await lade(g)).einheiten).toHaveLength(3);
  });
  it("fachlicher Fehler ergibt 422 mit Pfad", async () => {
    const { g, h } = await neuesGebaeude();
    const b = basis(h); b.bauteile[1].katalogId = "heizung.kamin";
    const e = await fehlerVon(schreibe(g, b));
    expect(e.fehler).toEqual([{ pfad: "bauteile[1].katalogId", code: "katalog_unbekannt", meldung: "Katalog-ID heizung.kamin unbekannt" }]);
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag pruefen**

Run: `npx vitest run test/welt-speicher.test.ts`
Expected: FAIL – Modul `speicher.js` fehlt.

- [ ] **Step 3: Speicher implementieren** – `app/src/welt/speicher.ts`

```ts
import type pg from "pg";
import { geschossRang, type Katalog, type Regelwerk } from "./regelwerk.js";
import { pruefeBeschreibung, type Bestand } from "./pruefung.js";
import { verteilerHinweise, wirksameHeizung } from "./heizung.js";
import { HEIZ_ARTEN, type BauteilEingabe, type Beschreibung, type EinheitEingabe, type Fehler, type HeizArt, type Heizung, type Huelle, type HuelleGespeichert } from "./typen.js";

export class FachFehler extends Error {
  readonly fehler: Fehler[];
  readonly status: 409 | 422;
  constructor(fehler: Fehler[], status: 409 | 422 = 422) {
    super(fehler.map((f) => f.code).join(", "));
    this.fehler = fehler;
    this.status = status;
  }
}

export function pruefeHuelle(h: Huelle, rw: Regelwerk): Fehler[] {
  const f: Fehler[] = [];
  for (const [pfad, v] of [["breiteM", h.breiteM], ["tiefeM", h.tiefeM]] as const)
    if (v < rw.masse.min || v > rw.masse.max) f.push({ pfad, code: "mass_ungueltig", meldung: `${rw.masse.min}–${rw.masse.max} m erwartet` });
  if (h.geschosse.length === 0) f.push({ pfad: "geschosse", code: "geschoss_fehlt", meldung: "Mindestens ein Geschoss angeben" });
  const codes = new Set<string>();
  h.geschosse.forEach((g, i) => {
    if (geschossRang(g.code) === null) f.push({ pfad: `geschosse[${i}].code`, code: "geschoss_code_ungueltig", meldung: `Code ${g.code} ungueltig (UG3..UG1, EG, OG1..OG40, DG, DACH)` });
    else if (codes.has(g.code)) f.push({ pfad: `geschosse[${i}].code`, code: "geschoss_doppelt", meldung: `Code ${g.code} mehrfach` });
    codes.add(g.code);
    const hoehe = g.hoeheM ?? rw.geschoss.hoeheDefault;
    if (hoehe < rw.geschoss.hoeheMin || hoehe > rw.geschoss.hoeheMax)
      f.push({ pfad: `geschosse[${i}].hoeheM`, code: "hoehe_ungueltig", meldung: `${rw.geschoss.hoeheMin}–${rw.geschoss.hoeheMax} m erwartet` });
  });
  return f;
}

export async function legeGebaeudeAn(c: pg.ClientBase, liegenschaftId: string, h: Huelle, rw: Regelwerk): Promise<string> {
  const f = pruefeHuelle(h, rw);
  if (f.length) throw new FachFehler(f);
  const id: string = (await c.query(
    "insert into gebaeude(liegenschaft_id, name, grundform, breite_m, tiefe_m, regelwerk_version) values ($1,$2,$3,$4,$5,$6) returning id",
    [liegenschaftId, h.name, h.grundform, h.breiteM, h.tiefeM, rw.version])).rows[0].id;
  for (const g of h.geschosse)
    await c.query("insert into geschoss(liegenschaft_id, gebaeude_id, code, reihenfolge, hoehe_m) values ($1,$2,$3,$4,$5)",
      [liegenschaftId, id, g.code, geschossRang(g.code), g.hoeheM ?? rw.geschoss.hoeheDefault]);
  return id;
}

export async function aendereHuelle(c: pg.ClientBase, gebaeudeId: string, h: Huelle, rw: Regelwerk): Promise<void> {
  const f = pruefeHuelle(h, rw);
  const g = (await c.query("select liegenschaft_id from gebaeude where id=$1 for update", [gebaeudeId])).rows[0];
  if (!g) throw new Error("Gebaeude unbekannt");
  const bestehend: string[] = (await c.query("select id from geschoss where gebaeude_id=$1", [gebaeudeId])).rows.map((r) => r.id);
  h.geschosse.forEach((x, i) => {
    if (x.id && !bestehend.includes(x.id)) f.push({ pfad: `geschosse[${i}].id`, code: "id_unbekannt", meldung: "Geschoss gehoert nicht zu diesem Gebaeude" });
  });
  const behalten = new Set(h.geschosse.flatMap((x) => (x.id ? [x.id] : [])));
  const weg = bestehend.filter((id) => !behalten.has(id));
  for (const id of weg) {
    const belegt = (await c.query("select exists(select 1 from einheit where geschoss_id=$1) or exists(select 1 from bauteil where geschoss_id=$1) b", [id])).rows[0].b;
    if (belegt) f.push({ pfad: "geschosse", code: "geschoss_belegt", meldung: `Geschoss ${id} hat Einheiten oder Bauteile` });
  }
  if (f.length) throw new FachFehler(f);
  await c.query("update gebaeude set name=$2, grundform=$3, breite_m=$4, tiefe_m=$5, stand=stand+1 where id=$1",
    [gebaeudeId, h.name, h.grundform, h.breiteM, h.tiefeM]);
  for (const id of weg) await c.query("delete from geschoss where id=$1", [id]);
  // Zwischencodes, damit ein Tausch von Codes unique(gebaeude_id, code) nicht verletzt
  for (const x of h.geschosse) if (x.id) await c.query("update geschoss set code = 'tmp-' || id where id=$1", [x.id]);
  for (const x of h.geschosse) {
    const werte = [x.code, geschossRang(x.code), x.hoeheM ?? rw.geschoss.hoeheDefault];
    if (x.id) await c.query("update geschoss set code=$2, reihenfolge=$3, hoehe_m=$4 where id=$1", [x.id, ...werte]);
    else await c.query("insert into geschoss(liegenschaft_id, gebaeude_id, code, reihenfolge, hoehe_m) values ($1,$2,$3,$4,$5)", [g.liegenschaft_id, gebaeudeId, ...werte]);
  }
}

export async function ladeHuelle(c: pg.ClientBase, gebaeudeId: string): Promise<HuelleGespeichert | null> {
  const g = (await c.query("select id, liegenschaft_id, name, grundform, breite_m, tiefe_m, regelwerk_version, stand from gebaeude where id=$1", [gebaeudeId])).rows[0];
  if (!g) return null;
  const gs = (await c.query("select id, code, hoehe_m from geschoss where gebaeude_id=$1 order by reihenfolge", [gebaeudeId])).rows;
  return {
    gebaeudeId: g.id, liegenschaftId: g.liegenschaft_id, name: g.name, grundform: g.grundform, breiteM: g.breite_m, tiefeM: g.tiefe_m,
    regelwerkVersion: g.regelwerk_version, stand: g.stand,
    geschosse: gs.map((r) => ({ id: r.id, code: r.code, hoeheM: r.hoehe_m })),
  };
}

export async function ladeBeschreibung(c: pg.ClientBase, gebaeudeId: string): Promise<Beschreibung | null> {
  const h = await ladeHuelle(c, gebaeudeId);
  if (!h) return null;
  const heizungStandard: Heizung = { hk: "unbekannt", fbh: "unbekannt", tabs: "unbekannt" };
  for (const r of (await c.query("select art, vorhanden from gebaeude_heizung_standard where gebaeude_id=$1", [gebaeudeId])).rows)
    heizungStandard[r.art as HeizArt] = r.vorhanden;
  const es = (await c.query(
    `select e.id, e.geschoss_id, e.bezeichnung, e.art, e.flaeche_m2, e.layout_manuell
       from einheit e join geschoss g on g.id = e.geschoss_id where g.gebaeude_id=$1 order by e.reihenfolge`, [gebaeudeId])).rows;
  const ausnahmen = (await c.query(
    `select h.einheit_id, h.art, h.vorhanden from einheit_heizung h
       join einheit e on e.id = h.einheit_id join geschoss g on g.id = e.geschoss_id where g.gebaeude_id=$1`, [gebaeudeId])).rows;
  const einheiten: EinheitEingabe[] = es.map((r) => {
    const ausnahme: Partial<Heizung> = {};
    for (const a of ausnahmen) if (a.einheit_id === r.id) ausnahme[a.art as HeizArt] = a.vorhanden;
    return {
      id: r.id, geschossId: r.geschoss_id, bezeichnung: r.bezeichnung, art: r.art, flaecheM2: r.flaeche_m2,
      layoutManuell: r.layout_manuell, heizungAusnahme: ausnahme, heizungWirksam: wirksameHeizung(heizungStandard, ausnahme),
    };
  });
  const ts = (await c.query(
    "select id, katalog_id, einheit_id, geschoss_id, menge, status, hersteller, typ, baujahr, position_manuell from bauteil where gebaeude_id=$1 order by reihenfolge",
    [gebaeudeId])).rows;
  const vs = (await c.query(
    `select v.bauteil_id, v.einheit_id from versorgung v
       join bauteil t on t.id = v.bauteil_id join einheit e on e.id = v.einheit_id where t.gebaeude_id=$1 order by e.reihenfolge`, [gebaeudeId])).rows;
  const bauteile: BauteilEingabe[] = ts.map((r) => ({
    id: r.id, katalogId: r.katalog_id, standort: r.einheit_id ? { einheitId: r.einheit_id } : { geschossId: r.geschoss_id },
    menge: r.menge, status: r.status, hersteller: r.hersteller, typ: r.typ, baujahr: r.baujahr, positionManuell: r.position_manuell,
    versorgt: vs.filter((v) => v.bauteil_id === r.id).map((v) => ({ einheitId: v.einheit_id })),
  }));
  const b: Beschreibung = { gebaeudeId, stand: h.stand, geschosse: h.geschosse.map((g) => ({ id: g.id, code: g.code })), heizungStandard, einheiten, bauteile };
  b.hinweise = verteilerHinweise(b);
  return b;
}

export type Zaehler = Record<"einheiten" | "bauteile", { angelegt: number; aktualisiert: number; geloescht: number }>;

/** Abgleich Beschreibung → Tabellen (Spec §6). Laeuft in der Transaktion des Aufrufers. */
export async function schreibeBeschreibung(c: pg.ClientBase, gebaeudeId: string, b: Beschreibung, rw: Regelwerk, katalog: Katalog): Promise<Zaehler> {
  const g = (await c.query("select liegenschaft_id, stand from gebaeude where id=$1 for update", [gebaeudeId])).rows[0];
  if (!g) throw new Error("Gebaeude unbekannt");
  if (b.stand !== g.stand) throw new FachFehler([{ pfad: "stand", code: "stand_veraltet", meldung: "Beschreibung wurde inzwischen geaendert; bitte neu laden" }], 409);
  const L: string = g.liegenschaft_id;

  const es = (await c.query("select e.id, e.layout_manuell is not null m from einheit e join geschoss g on g.id=e.geschoss_id where g.gebaeude_id=$1", [gebaeudeId])).rows;
  const ts = (await c.query("select id, position_manuell is not null m from bauteil where gebaeude_id=$1", [gebaeudeId])).rows;
  const bestand: Bestand = {
    geschossIds: new Set((await c.query("select id from geschoss where gebaeude_id=$1", [gebaeudeId])).rows.map((r) => r.id)),
    einheitIds: new Set(es.map((r) => r.id)), bauteilIds: new Set(ts.map((r) => r.id)),
    einheitenManuell: new Set(es.filter((r) => r.m).map((r) => r.id)), bauteileManuell: new Set(ts.filter((r) => r.m).map((r) => r.id)),
  };
  const f = pruefeBeschreibung(b, bestand, rw, katalog);
  if (f.length) throw new FachFehler(f);

  const z: Zaehler = { einheiten: { angelegt: 0, aktualisiert: 0, geloescht: 0 }, bauteile: { angelegt: 0, aktualisiert: 0, geloescht: 0 } };

  // 1. Versorgung komplett neu; entfallende Bauteile loeschen
  await c.query("delete from versorgung where bauteil_id in (select id from bauteil where gebaeude_id=$1)", [gebaeudeId]);
  const bauteilBehalten = b.bauteile.flatMap((t) => (t.id ? [t.id] : []));
  z.bauteile.geloescht = (await c.query("delete from bauteil where gebaeude_id=$1 and not (id = any($2::uuid[]))", [gebaeudeId, bauteilBehalten])).rowCount ?? 0;

  // 2. Heizungsstandard
  await c.query("delete from gebaeude_heizung_standard where gebaeude_id=$1", [gebaeudeId]);
  for (const art of HEIZ_ARTEN)
    await c.query("insert into gebaeude_heizung_standard(gebaeude_id, liegenschaft_id, art, vorhanden) values ($1,$2,$3,$4)", [gebaeudeId, L, art, b.heizungStandard[art]]);

  // 3. Einheiten aktualisieren/anlegen, Ausnahmen neu
  const einheitIds: string[] = [];
  for (const [i, e] of b.einheiten.entries()) {
    const werte = [e.geschossId, e.bezeichnung, e.art, e.flaecheM2, i, e.layoutManuell ? JSON.stringify(e.layoutManuell) : null];
    if (e.id) {
      await c.query("update einheit set geschoss_id=$2, bezeichnung=$3, art=$4, flaeche_m2=$5, reihenfolge=$6, layout_manuell=$7 where id=$1", [e.id, ...werte]);
      einheitIds.push(e.id); z.einheiten.aktualisiert++;
    } else {
      einheitIds.push((await c.query(
        "insert into einheit(liegenschaft_id, geschoss_id, bezeichnung, art, flaeche_m2, reihenfolge, layout_manuell) values ($1,$2,$3,$4,$5,$6,$7) returning id",
        [L, ...werte])).rows[0].id);
      z.einheiten.angelegt++;
    }
  }
  await c.query("delete from einheit_heizung where einheit_id = any($1::uuid[])", [einheitIds]);
  for (const [i, e] of b.einheiten.entries())
    for (const art of HEIZ_ARTEN) {
      const v = e.heizungAusnahme?.[art];
      if (v) await c.query("insert into einheit_heizung(einheit_id, liegenschaft_id, art, vorhanden) values ($1,$2,$3,$4)", [einheitIds[i], L, art, v]);
    }

  // 4. Bauteile aktualisieren/anlegen, Versorgung
  const einheitVon = (v: { einheitId?: string; einheitIndex?: number }) => v.einheitId ?? (v.einheitIndex !== undefined ? einheitIds[v.einheitIndex] : null);
  for (const [j, t] of b.bauteile.entries()) {
    const werte = [t.katalogId, einheitVon(t.standort), t.standort.geschossId ?? null, t.menge, t.status, t.hersteller ?? null, t.typ ?? null,
      t.baujahr ?? null, j, t.positionManuell ? JSON.stringify(t.positionManuell) : null];
    let id: string;
    if (t.id) {
      await c.query(
        "update bauteil set katalog_id=$2, einheit_id=$3, geschoss_id=$4, menge=$5, status=$6, hersteller=$7, typ=$8, baujahr=$9, reihenfolge=$10, position_manuell=$11 where id=$1",
        [t.id, ...werte]);
      id = t.id; z.bauteile.aktualisiert++;
    } else {
      id = (await c.query(
        `insert into bauteil(liegenschaft_id, gebaeude_id, katalog_id, einheit_id, geschoss_id, menge, status, hersteller, typ, baujahr, reihenfolge, position_manuell)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id`, [L, gebaeudeId, ...werte])).rows[0].id;
      z.bauteile.angelegt++;
    }
    for (const v of t.versorgt)
      await c.query("insert into versorgung(bauteil_id, einheit_id, liegenschaft_id) values ($1,$2,$3) on conflict do nothing", [id, einheitVon(v), L]);
  }

  // 5. Entfallende Einheiten erst jetzt loeschen (Bauteile zeigen nicht mehr darauf)
  z.einheiten.geloescht = (await c.query(
    "delete from einheit where geschoss_id in (select id from geschoss where gebaeude_id=$1) and not (id = any($2::uuid[]))",
    [gebaeudeId, einheitIds])).rowCount ?? 0;

  await c.query("update gebaeude set stand=stand+1 where id=$1", [gebaeudeId]);
  return z;
}
```

- [ ] **Step 4: Test laufen lassen**

Run: `npx vitest run test/welt-speicher.test.ts`
Expected: PASS (11 Tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/welt/speicher.ts app/test/welt-speicher.test.ts
git commit -m "M2a: Speicher mit Huellenpflege und Abgleich bei stabilen IDs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Recht, Schemas, Routen, Server

**Files:**
- Create: `app/src/welt/schema.ts`, `app/src/welt/routen.ts`
- Modify: `app/src/rechte/rechte.ts` (Typ `Recht` und `MATRIX`), `app/src/server.ts` (Import + Aufruf vor dem Kommentar `// Platzhalter fuer Fachmodule`), `app/test/rechte.test.ts` (Test "Matrix entspricht Spec §5")
- Test: `app/test/welt-api.test.ts`

**Interfaces:**
- Consumes: alles aus Task 1–5, `pruefe` aus `rechte.ts`, `auditEreignis` aus `src/audit/audit.ts`, `req.kontext` (`benutzerId`, `auditId`).
- Produces: `registriereWeltRouten(app: FastifyInstance, pool: pg.Pool): void` und diese Routen:

| Methode | Pfad | Recht |
|---|---|---|
| POST | `/api/struktur/liegenschaften/:lid/gebaeude` | `huelle.verwalten` → 201 `{ id }` |
| GET | `/api/struktur/gebaeude/:id/huelle` | `huelle.verwalten` |
| PUT | `/api/struktur/gebaeude/:id/huelle` | `huelle.verwalten` |
| GET | `/api/struktur/gebaeude/:id/beschreibung` | `fach.lesen` in Liegenschaft, sonst 404 |
| PUT | `/api/struktur/gebaeude/:id/beschreibung` | `fach.aendern` (ohne Leserecht 404, nur Leserecht 403) |
| GET | `/api/szene/gebaeude/:id/welt` | `fach.lesen` in Liegenschaft, sonst 404 |

- [ ] **Step 1: Rechte-Test anpassen (failing)** – in `app/test/rechte.test.ts` im Test "Matrix entspricht Spec §5" das erwartete Objekt um `"huelle.verwalten": ["betreiber"]` ergaenzen und davor einen Test einfuegen:

```ts
  it("Huelle verwalten nur Betreiber, ohne Liegenschafts-Scope", async () => {
    expect(await pruefe(c, betreiber, "huelle.verwalten")).toBe(true);
    expect(await pruefe(c, admin, "huelle.verwalten")).toBe(false);
    expect(await pruefe(c, bearb, "huelle.verwalten", L1)).toBe(false);
  });
```

Run: `npx vitest run test/rechte.test.ts`
Expected: FAIL (Typfehler bzw. `false` statt `true`).

- [ ] **Step 2: Recht ergaenzen** – in `app/src/rechte/rechte.ts`:

```ts
export type Recht = "module.schalten"|"benutzer.verwalten"|"fach.lesen"|"fach.aendern"|"dokument.loeschen"|"audit.lesen"|"huelle.verwalten";
export const MATRIX: Record<Recht, Rolle[]> = {
  "module.schalten": ["betreiber"], "benutzer.verwalten": ["admin"], "fach.lesen": ["admin", "bearbeiter", "leser"],
  "fach.aendern": ["admin", "bearbeiter"], "dokument.loeschen": ["admin"], "audit.lesen": ["admin", "betreiber"],
  "huelle.verwalten": ["betreiber"], // Planora bereitet die Huelle vor (ADR 0032), ohne Zugriff auf Fachdaten
};
```

Run: `npx vitest run test/rechte.test.ts`
Expected: PASS.

- [ ] **Step 3: Failing API-Test schreiben** – `app/test/welt-api.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { frischeDb } from "./hilfe.js";
import { baueServer } from "../src/server.js";
import { erzeugeSetupToken, loeseSetupTokenEin } from "../src/auth/setup.js";

const ORIGIN = "http://localhost:3997";
const pw = randomBytes(12).toString("base64url");
const HUELLE = { name: "Haus", grundform: "quader", breiteM: 30, tiefeM: 15, geschosse: [{ code: "EG" }, { code: "OG1" }] };
let db: Awaited<ReturnType<typeof frischeDb>>; let app: FastifyInstance;
let L1: string, L2: string, kBetr: string, kBearb: string, kLeser: string, kFremd: string;
let G: string;

const anfrage = (method: "GET" | "POST" | "PUT", url: string, cookie: string, body?: unknown) => app.inject({
  method, url,
  headers: { cookie, origin: ORIGIN, "x-planora-request": "1", ...(body !== undefined ? { "content-type": "application/json" } : {}) },
  payload: body !== undefined ? JSON.stringify(body) : undefined,
});
const cookieVon = (r: any) => ([] as string[]).concat(r.headers["set-cookie"] ?? []).map((c) => c.split(";")[0]).join("; ");
async function konto(email: string, rolle: string, scopes: string[]) {
  const { benutzerId } = await loeseSetupTokenEin(db.pool, await erzeugeSetupToken(db.pool), email, email, pw);
  await db.pool.query("update rolle_zuordnung set rolle=$2 where benutzer_id=$1", [benutzerId, rolle]);
  for (const l of scopes) await db.pool.query("insert into rolle_liegenschaft(benutzer_id, liegenschaft_id) values ($1,$2)", [benutzerId, l]);
  const r = await app.inject({ method: "POST", url: "/api/auth/sign-in/email", headers: { "content-type": "application/json", origin: ORIGIN }, payload: JSON.stringify({ email, password: pw }) });
  expect(r.statusCode).toBe(200);
  return cookieVon(r);
}
const urlB = () => `/api/struktur/gebaeude/${G}/beschreibung`;
const urlW = () => `/api/szene/gebaeude/${G}/welt`;

function erstbefuellung(leer: any) {
  const [eg, og1] = leer.geschosse;
  return {
    ...leer, heizungStandard: { hk: "ja", fbh: "nein", tabs: "nein" },
    einheiten: [
      { geschossId: eg.id, bezeichnung: "Buero A", art: "buero", flaecheM2: null },
      { geschossId: eg.id, bezeichnung: "Technik", art: "technik", flaecheM2: 30 },
      { geschossId: og1.id, bezeichnung: "Buero C", art: "buero", flaecheM2: null, heizungAusnahme: { fbh: "ja" } },
    ],
    bauteile: [
      { katalogId: "heizung.heizkoerper", standort: { einheitIndex: 0 }, menge: 12, status: "bestaetigt", hersteller: "Zehnder", versorgt: [] },
      { katalogId: "heizung.heizkoerper", standort: { einheitIndex: 0 }, menge: 3, status: "bestaetigt", hersteller: "Prolux", versorgt: [] },
      { katalogId: "heizung.verteiler", standort: { einheitIndex: 1 }, menge: 1, status: "bestaetigt", versorgt: [{ einheitIndex: 2 }] },
    ],
  };
}

beforeAll(async () => {
  db = await frischeDb();
  app = await baueServer({ pool: db.pool, stufe: 2, baseURL: ORIGIN, secret: randomBytes(32).toString("hex"), ablageWurzel: mkdtempSync(join(tmpdir(), "ablage-")) });
  L1 = (await db.pool.query("insert into liegenschaft(name) values ('L1') returning id")).rows[0].id;
  L2 = (await db.pool.query("insert into liegenschaft(name) values ('L2') returning id")).rows[0].id;
  kBetr = await konto("betrieb@planora.invalid", "betreiber", []);
  kBearb = await konto("bearb@planora.invalid", "bearbeiter", [L1]);
  kLeser = await konto("leser@planora.invalid", "leser", [L1]);
  kFremd = await konto("fremd@planora.invalid", "leser", [L2]);
});
afterAll(async () => { await app.close(); await db.ende(); });

describe("Welt-API", () => {
  it("Betreiber legt Huelle an; andere Rollen nicht; Betreiber sieht keine Fachdaten", async () => {
    expect((await anfrage("POST", `/api/struktur/liegenschaften/${L1}/gebaeude`, kBearb, HUELLE)).statusCode).toBe(403);
    expect((await anfrage("POST", `/api/struktur/liegenschaften/${randomUUID()}/gebaeude`, kBetr, HUELLE)).statusCode).toBe(404);
    expect((await anfrage("POST", `/api/struktur/liegenschaften/${L1}/gebaeude`, kBetr, { ...HUELLE, breiteM: 2 })).statusCode).toBe(422);
    const r = await anfrage("POST", `/api/struktur/liegenschaften/${L1}/gebaeude`, kBetr, HUELLE);
    expect(r.statusCode).toBe(201);
    G = r.json().id;
    expect((await anfrage("GET", `/api/struktur/gebaeude/${G}/huelle`, kBetr)).json().geschosse.map((g: any) => g.code)).toEqual(["EG", "OG1"]);
    expect((await anfrage("GET", urlB(), kBetr)).statusCode).toBe(404);
  });
  it("Bearbeiter schreibt; unveraendert zurueck ergibt gleiche IDs und gleichen Welt-Hash", async () => {
    const leer = (await anfrage("GET", urlB(), kBearb)).json();
    const put = await anfrage("PUT", urlB(), kBearb, erstbefuellung(leer));
    expect(put.statusCode).toBe(200);
    const b1 = put.json();
    const w1 = (await anfrage("GET", urlW(), kBearb)).json();
    const b2 = (await anfrage("PUT", urlB(), kBearb, b1)).json();
    expect(b2.einheiten.map((e: any) => e.id)).toEqual(b1.einheiten.map((e: any) => e.id));
    expect(b2.bauteile.map((t: any) => t.id)).toEqual(b1.bauteile.map((t: any) => t.id));
    const w2 = (await anfrage("GET", urlW(), kBearb)).json();
    expect(w2.hash).toBe(w1.hash);
    expect(w1.symbole.filter((s: any) => s.katalogId === "heizung.heizkoerper")).toHaveLength(2);
    const audit = await db.pool.query("select count(*)::int n from audit_eintrag where art='gebaeude.beschreibung'");
    expect(audit.rows[0].n).toBe(2);
  });
  it("Leser liest, schreibt aber nicht; fremde Liegenschaft sieht nichts", async () => {
    const b = (await anfrage("GET", urlB(), kLeser)).json();
    expect((await anfrage("GET", urlW(), kLeser)).statusCode).toBe(200);
    expect((await anfrage("PUT", urlB(), kLeser, b)).statusCode).toBe(403);
    expect((await anfrage("GET", urlB(), kFremd)).statusCode).toBe(404);
    expect((await anfrage("GET", urlW(), kFremd)).statusCode).toBe(404);
  });
  it("veralteter Stand → 409", async () => {
    const b = (await anfrage("GET", urlB(), kBearb)).json();
    expect((await anfrage("PUT", urlB(), kBearb, { ...b, stand: b.stand - 1 })).statusCode).toBe(409);
  });
  it("fachliche Fehler → 422 mit Codes; Strukturfehler → 400", async () => {
    const b = (await anfrage("GET", urlB(), kBearb)).json();
    const fbhInA = { katalogId: "heizung.fbh_kreis", standort: { einheitId: b.einheiten[0].id }, menge: 2, status: "bestaetigt", versorgt: [] };
    const r = await anfrage("PUT", urlB(), kBearb, { ...b, bauteile: [...b.bauteile, fbhInA] });
    expect(r.statusCode).toBe(422);
    expect(r.json().fehler.map((f: any) => f.code)).toEqual(["bestaetigt_bei_unbekannt"]);
    const fremd = await anfrage("POST", `/api/struktur/liegenschaften/${L2}/gebaeude`, kBetr, HUELLE);
    const fremdesGeschoss = (await anfrage("GET", `/api/struktur/gebaeude/${fremd.json().id}/huelle`, kBetr)).json().geschosse[0].id;
    const r2 = await anfrage("PUT", urlB(), kBearb, { ...b, einheiten: [...b.einheiten, { geschossId: fremdesGeschoss, bezeichnung: "X", art: "buero", flaecheM2: null }] });
    expect(r2.json().fehler.map((f: any) => f.code)).toEqual(["verweis_ungueltig"]);
    const r3 = await anfrage("PUT", urlB(), kBearb, { ...b, einheiten: [{ ...b.einheiten[0], id: randomUUID() }, ...b.einheiten.slice(1)] });
    expect(r3.json().fehler.map((f: any) => f.code)).toContain("id_unbekannt");
    expect((await anfrage("PUT", urlB(), kBearb, { ...b, bauteile: [{ ...b.bauteile[0], status: "kaputt" }] })).statusCode).toBe(400);
    expect((await anfrage("GET", "/api/struktur/gebaeude/keine-uuid/beschreibung", kBearb)).statusCode).toBe(400);
  });
  it("Kopie mit manuellem Layout; Loeschen dann blockiert", async () => {
    const b = (await anfrage("GET", urlB(), kBearb)).json();
    const { id: _weg, ...kopie } = b.einheiten[2];
    const neu = (await anfrage("PUT", urlB(), kBearb, { ...b, einheiten: [...b.einheiten, { ...kopie, bezeichnung: "Kopie", layoutManuell: { x: 0, z: 0, breite: 5, tiefe: 5 } }] })).json();
    expect(neu.einheiten).toHaveLength(4);
    expect(neu.einheiten[3].id).not.toBe(neu.einheiten[2].id);
    const w = (await anfrage("GET", urlW(), kBearb)).json();
    expect(w.einheiten.find((e: any) => e.id === neu.einheiten[3].id).quelle).toBe("manuell");
    const r = await anfrage("PUT", urlB(), kBearb, { ...neu, einheiten: neu.einheiten.slice(0, 3) });
    expect(r.statusCode).toBe(422);
    expect(r.json().fehler.map((f: any) => f.code)).toEqual(["loeschen_blockiert"]);
  });
});
```

Run: `npx vitest run test/welt-api.test.ts`
Expected: FAIL – Routen liefern 501 (Platzhalter) bzw. Modul `routen.js` fehlt.

- [ ] **Step 4: Schemas** – `app/src/welt/schema.ts`

```ts
// JSON-Schemas fuer Fastify (ajv). Strukturfehler → 400; fachliche Regeln prueft pruefung.ts (→ 422).
const UUID = { type: "string", pattern: "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$" };
const DREI = { type: "string", enum: ["ja", "nein", "unbekannt"] };
const HEIZ = { hk: DREI, fbh: DREI, tabs: DREI };
const INDEX = { type: "integer", minimum: 0 };
const RECHTECK = {
  type: ["object", "null"], additionalProperties: false, required: ["x", "z", "breite", "tiefe"],
  properties: { x: { type: "number" }, z: { type: "number" }, breite: { type: "number", exclusiveMinimum: 0 }, tiefe: { type: "number", exclusiveMinimum: 0 } },
};
const VERWEIS = { type: "object", additionalProperties: false, minProperties: 1, maxProperties: 1, properties: { einheitId: UUID, einheitIndex: INDEX } };
const TEXT = { type: ["string", "null"], maxLength: 200 };

export const ID_PARAMS = { type: "object", required: ["id"], properties: { id: UUID } };
export const LID_PARAMS = { type: "object", required: ["lid"], properties: { lid: UUID } };

export const HUELLE_SCHEMA = {
  type: "object", additionalProperties: false, required: ["name", "grundform", "breiteM", "tiefeM", "geschosse"],
  properties: {
    name: { type: "string", minLength: 1, maxLength: 200 },
    grundform: { type: "string", enum: ["quader", "l_form", "u_form"] },
    breiteM: { type: "number" }, tiefeM: { type: "number" },
    geschosse: { type: "array", maxItems: 50, items: {
      type: "object", additionalProperties: false, required: ["code"],
      properties: { id: UUID, code: { type: "string", maxLength: 10 }, hoeheM: { type: "number" } } } },
  },
};

export const BESCHREIBUNG_SCHEMA = {
  type: "object", additionalProperties: false, required: ["stand", "heizungStandard", "einheiten", "bauteile"],
  properties: {
    gebaeudeId: { type: "string" }, stand: { type: "integer", minimum: 0 },
    geschosse: { type: "array" }, hinweise: { type: "array" },
    heizungStandard: { type: "object", additionalProperties: false, required: ["hk", "fbh", "tabs"], properties: HEIZ },
    einheiten: { type: "array", maxItems: 2000, items: {
      type: "object", additionalProperties: false, required: ["geschossId", "bezeichnung", "art", "flaecheM2"],
      properties: {
        id: UUID, geschossId: UUID, bezeichnung: { type: "string", minLength: 1, maxLength: 200 }, art: { type: "string", maxLength: 50 },
        flaecheM2: { type: ["number", "null"], exclusiveMinimum: 0 }, layoutManuell: RECHTECK,
        heizungAusnahme: { type: "object", additionalProperties: false, properties: HEIZ },
        heizungWirksam: { type: "object" },
      } } },
    bauteile: { type: "array", maxItems: 10000, items: {
      type: "object", additionalProperties: false, required: ["katalogId", "standort", "menge", "status", "versorgt"],
      properties: {
        id: UUID, katalogId: { type: "string", maxLength: 100 },
        standort: { type: "object", additionalProperties: false, properties: { einheitId: UUID, einheitIndex: INDEX, geschossId: UUID } },
        menge: { type: ["number", "null"] }, // Ganzzahl und Bereich prueft pruefung.ts (422 menge_ungueltig)
        status: { type: "string", enum: ["vorgeschlagen", "bestaetigt"] },
        hersteller: TEXT, typ: TEXT, baujahr: { type: ["integer", "null"], minimum: 1800, maximum: 2100 },
        positionManuell: { type: ["object", "null"], additionalProperties: false, required: ["x", "z"], properties: { x: { type: "number" }, z: { type: "number" } } },
        versorgt: { type: "array", maxItems: 2000, items: VERWEIS },
      } } },
  },
};
```

- [ ] **Step 5: Routen** – `app/src/welt/routen.ts`

```ts
import type { FastifyInstance, FastifyReply } from "fastify";
import type pg from "pg";
import { pruefe } from "../rechte/rechte.js";
import { auditEreignis } from "../audit/audit.js";
import { REGELWERK_V1 } from "./regelwerk.v1.js";
import { KATALOG_V1 } from "./katalog.v1.js";
import { weltErzeugen } from "./generator.js";
import { FachFehler, aendereHuelle, ladeBeschreibung, ladeHuelle, legeGebaeudeAn, schreibeBeschreibung } from "./speicher.js";
import { BESCHREIBUNG_SCHEMA, HUELLE_SCHEMA, ID_PARAMS, LID_PARAMS } from "./schema.js";
import type { Beschreibung, Huelle } from "./typen.js";

export function registriereWeltRouten(app: FastifyInstance, pool: pg.Pool) {
  async function mitClient<T>(f: (c: pg.PoolClient) => Promise<T>): Promise<T> {
    const c = await pool.connect();
    try { return await f(c); } finally { c.release(); }
  }
  const inTransaktion = <T>(f: (c: pg.PoolClient) => Promise<T>) => mitClient(async (c) => {
    await c.query("begin");
    try { const r = await f(c); await c.query("commit"); return r; } catch (e) { await c.query("rollback"); throw e; }
  });
  /** 404 ohne Leserecht (keine Existenz-Auskunft), 403 mit Leserecht aber ohne Schreibrecht. */
  async function zugriff(c: pg.ClientBase, benutzerId: string, gebaeudeId: string, schreiben: boolean): Promise<200 | 403 | 404> {
    const r = (await c.query("select liegenschaft_id from gebaeude where id=$1", [gebaeudeId])).rows[0];
    if (!r || !(await pruefe(c, benutzerId, "fach.lesen", r.liegenschaft_id))) return 404;
    if (schreiben && !(await pruefe(c, benutzerId, "fach.aendern", r.liegenschaft_id))) return 403;
    return 200;
  }
  const verweigert = (reply: FastifyReply, code: 403 | 404) => reply.code(code).send({ fehler: code === 404 ? "nicht gefunden" : "keine Berechtigung" });
  const fachAntwort = (reply: FastifyReply, e: unknown) => {
    if (e instanceof FachFehler) return reply.code(e.status).send({ fehler: e.fehler });
    throw e;
  };
  const darfHuelle = (benutzerId: string) => mitClient((c) => pruefe(c, benutzerId, "huelle.verwalten"));

  app.post<{ Params: { lid: string }; Body: Huelle }>("/api/struktur/liegenschaften/:lid/gebaeude",
    { schema: { params: LID_PARAMS, body: HUELLE_SCHEMA } }, async (req, reply) => {
      const k = req.kontext!;
      if (!(await darfHuelle(k.benutzerId))) return verweigert(reply, 403);
      try {
        return await inTransaktion(async (c) => {
          if (!(await c.query("select 1 from liegenschaft where id=$1", [req.params.lid])).rowCount) return verweigert(reply, 404);
          const id = await legeGebaeudeAn(c, req.params.lid, req.body, REGELWERK_V1);
          await auditEreignis(c, k.auditId, "gebaeude.angelegt", { gebaeudeId: id, geschosse: req.body.geschosse.length });
          return reply.code(201).send({ id });
        });
      } catch (e) { return fachAntwort(reply, e); }
    });

  app.get<{ Params: { id: string } }>("/api/struktur/gebaeude/:id/huelle", { schema: { params: ID_PARAMS } }, async (req, reply) => {
    if (!(await darfHuelle(req.kontext!.benutzerId))) return verweigert(reply, 403);
    const h = await mitClient((c) => ladeHuelle(c, req.params.id));
    return h ?? verweigert(reply, 404);
  });

  app.put<{ Params: { id: string }; Body: Huelle }>("/api/struktur/gebaeude/:id/huelle",
    { schema: { params: ID_PARAMS, body: HUELLE_SCHEMA } }, async (req, reply) => {
      const k = req.kontext!;
      if (!(await darfHuelle(k.benutzerId))) return verweigert(reply, 403);
      try {
        return await inTransaktion(async (c) => {
          if (!(await ladeHuelle(c, req.params.id))) return verweigert(reply, 404);
          await aendereHuelle(c, req.params.id, req.body, REGELWERK_V1);
          await auditEreignis(c, k.auditId, "gebaeude.huelle", { gebaeudeId: req.params.id, geschosse: req.body.geschosse.length });
          return ladeHuelle(c, req.params.id);
        });
      } catch (e) { return fachAntwort(reply, e); }
    });

  app.get<{ Params: { id: string } }>("/api/struktur/gebaeude/:id/beschreibung", { schema: { params: ID_PARAMS } }, async (req, reply) => {
    return mitClient(async (c) => {
      const z = await zugriff(c, req.kontext!.benutzerId, req.params.id, false);
      if (z !== 200) return verweigert(reply, z);
      return ladeBeschreibung(c, req.params.id);
    });
  });

  app.put<{ Params: { id: string }; Body: Beschreibung }>("/api/struktur/gebaeude/:id/beschreibung",
    { schema: { params: ID_PARAMS, body: BESCHREIBUNG_SCHEMA } }, async (req, reply) => {
      const k = req.kontext!;
      const z = await mitClient((c) => zugriff(c, k.benutzerId, req.params.id, true));
      if (z !== 200) return verweigert(reply, z);
      try {
        return await inTransaktion(async (c) => {
          const zaehler = await schreibeBeschreibung(c, req.params.id, req.body, REGELWERK_V1, KATALOG_V1);
          await auditEreignis(c, k.auditId, "gebaeude.beschreibung", { gebaeudeId: req.params.id, ...zaehler });
          return ladeBeschreibung(c, req.params.id);
        });
      } catch (e) { return fachAntwort(reply, e); }
    });

  app.get<{ Params: { id: string } }>("/api/szene/gebaeude/:id/welt", { schema: { params: ID_PARAMS } }, async (req, reply) => {
    return mitClient(async (c) => {
      const z = await zugriff(c, req.kontext!.benutzerId, req.params.id, false);
      if (z !== 200) return verweigert(reply, z);
      const h = (await ladeHuelle(c, req.params.id))!;
      const b = (await ladeBeschreibung(c, req.params.id))!;
      return weltErzeugen(h, b, REGELWERK_V1); // nur Regelwerk v1 vorhanden; Verhalten bei v2 offen (Spec §11)
    });
  });
}
```

- [ ] **Step 6: Server verdrahten** – in `app/src/server.ts`:

Import oben ergaenzen:
```ts
import { registriereWeltRouten } from "./welt/routen.js";
```
Direkt vor der Zeile `// Platzhalter fuer Fachmodule bis M2–M8: erreichbar nur, wenn Guard und Sitzung sie durchlassen` einfuegen:
```ts
  registriereWeltRouten(app, o.pool); // M2a: /api/struktur/… (Huelle, Beschreibung), /api/szene/…/welt
```

- [ ] **Step 7: Tests laufen lassen**

Run: `npx vitest run test/welt-api.test.ts test/server.test.ts test/rechte.test.ts test/module-guard.test.ts`
Expected: PASS. Wenn `module-guard.test.ts` eine Liste aller registrierten Routen prueft und an den neuen Routen scheitert: Liste dort um die sechs Routen ergaenzen (sie gehoeren zu `struktur` bzw. `szene`). Wenn eine 400-Antwort wegen `format`/`pattern` ausbleibt, mit `app.inject` den Fehlertext lesen und das Schema korrigieren – nicht den Test abschwaechen.

- [ ] **Step 8: Commit**

```bash
git add app/src/welt/schema.ts app/src/welt/routen.ts app/src/rechte/rechte.ts app/src/server.ts app/test/rechte.test.ts app/test/welt-api.test.ts
git commit -m "M2a: HTTP-API fuer Huelle, Beschreibung und Welt mit Recht huelle.verwalten

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Beispieldaten, Gesamtpruefung, Doku-Nachtraege

**Files:**
- Create: `app/src/welt/beispiel.ts`, `app/src/welt/beispiel-cli.ts`
- Modify: `app/package.json` (Script), `docs/superpowers/specs/2026-11-11-m2a-welt-kern-design.md` (§3, §4, §8), `docs/architektur/adr/0011-bauteil-katalog.md` (Nachtrag oben)
- Test: `app/test/welt-beispiel.test.ts`

**Interfaces:**
- Consumes: `legeGebaeudeAn`, `ladeHuelle`, `ladeBeschreibung`, `schreibeBeschreibung`, `weltErzeugen`, `REGELWERK_V1`, `KATALOG_V1`.
- Produces: `beispielAnlegen(pool: pg.Pool): Promise<{ liegenschaftId: string; gebaeudeId: string }>`; npm-Script `welt:beispiel`.

- [ ] **Step 1: Failing Test schreiben** – `app/test/welt-beispiel.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { frischeDb } from "./hilfe.js";
import { beispielAnlegen } from "../src/welt/beispiel.js";
import { ladeBeschreibung, ladeHuelle } from "../src/welt/speicher.js";
import { weltErzeugen } from "../src/welt/generator.js";
import { REGELWERK_V1 } from "../src/welt/regelwerk.v1.js";

let db: Awaited<ReturnType<typeof frischeDb>>;
beforeAll(async () => { db = await frischeDb(); });
afterAll(async () => { await db.ende(); });

describe("Beispieldaten erster Schnitt (ADR 0032)", () => {
  it("zwei Geschosse, gemischte Heizung, gemeinsamer Verteiler, Vorschlag fuer Buero D", async () => {
    const { gebaeudeId } = await beispielAnlegen(db.pool);
    const c = await db.pool.connect();
    try {
      const h = (await ladeHuelle(c, gebaeudeId))!;
      const b = (await ladeBeschreibung(c, gebaeudeId))!;
      expect(b.einheiten.map((e) => e.bezeichnung)).toEqual(["Buero A", "Restaurant", "Technik", "Buero C", "Buero D"]);
      expect(b.einheiten[1].heizungWirksam).toEqual({ hk: "nein", fbh: "ja", tabs: "nein" });
      expect(b.einheiten[3].heizungWirksam).toEqual({ hk: "ja", fbh: "ja", tabs: "nein" });
      expect(b.hinweise).toEqual([{ code: "verteiler_vorschlag", bezug: b.einheiten[4].id }]);
      const w = weltErzeugen(h, b, REGELWERK_V1);
      expect(w.geschosse.map((g) => g.code)).toEqual(["EG", "OG1"]);
      expect(w.symbole.filter((s) => s.katalogId === "heizung.heizkoerper").map((s) => s.hersteller)).toEqual(["Zehnder", "Prolux"]);
      const v = w.symbole.find((s) => s.katalogId === "heizung.verteiler")!;
      expect(v.versorgt).toEqual([b.einheiten[1].id, b.einheiten[3].id]);
      expect(w.symbole.filter((s) => s.mengeUnbekannt)).toHaveLength(1);
      expect(weltErzeugen(h, b, REGELWERK_V1).hash).toBe(w.hash);
    } finally { c.release(); }
  });
});
```

Run: `npx vitest run test/welt-beispiel.test.ts`
Expected: FAIL – Modul `beispiel.js` fehlt.

- [ ] **Step 2: Beispiel implementieren** – `app/src/welt/beispiel.ts`

```ts
import type pg from "pg";
import { REGELWERK_V1 } from "./regelwerk.v1.js";
import { KATALOG_V1 } from "./katalog.v1.js";
import { ladeHuelle, legeGebaeudeAn, schreibeBeschreibung } from "./speicher.js";
import type { Beschreibung } from "./typen.js";

/** Erster durchgehender Schnitt nach ADR 0032 / Spec §9. Nur fuer Entwicklung und Tests. */
export async function beispielAnlegen(pool: pg.Pool): Promise<{ liegenschaftId: string; gebaeudeId: string }> {
  const c = await pool.connect();
  try {
    await c.query("begin");
    const liegenschaftId: string = (await c.query("insert into liegenschaft(name) values ('Beispielliegenschaft M2a') returning id")).rows[0].id;
    const gebaeudeId = await legeGebaeudeAn(c, liegenschaftId,
      { name: "Beispielgebaeude", grundform: "quader", breiteM: 30, tiefeM: 15, geschosse: [{ code: "EG" }, { code: "OG1" }] }, REGELWERK_V1);
    const h = (await ladeHuelle(c, gebaeudeId))!;
    const [eg, og1] = h.geschosse;
    const b: Beschreibung = {
      gebaeudeId, stand: h.stand, heizungStandard: { hk: "ja", fbh: "nein", tabs: "nein" },
      einheiten: [
        { geschossId: eg.id, bezeichnung: "Buero A", art: "buero", flaecheM2: null },
        { geschossId: eg.id, bezeichnung: "Restaurant", art: "gastro", flaecheM2: 150, heizungAusnahme: { hk: "nein", fbh: "ja" } },
        { geschossId: eg.id, bezeichnung: "Technik", art: "technik", flaecheM2: 30 },
        { geschossId: og1.id, bezeichnung: "Buero C", art: "buero", flaecheM2: null, heizungAusnahme: { fbh: "ja" } },
        { geschossId: og1.id, bezeichnung: "Buero D", art: "buero", flaecheM2: null, heizungAusnahme: { fbh: "ja" } },
      ],
      bauteile: [
        { katalogId: "heizung.waermepumpe", standort: { einheitIndex: 2 }, menge: 1, status: "bestaetigt", versorgt: [] },
        { katalogId: "heizung.speicher", standort: { einheitIndex: 2 }, menge: 1, status: "bestaetigt", versorgt: [] },
        { katalogId: "heizung.heizkoerper", standort: { einheitIndex: 0 }, menge: 12, status: "bestaetigt", hersteller: "Zehnder", versorgt: [] },
        { katalogId: "heizung.heizkoerper", standort: { einheitIndex: 0 }, menge: 3, status: "bestaetigt", hersteller: "Prolux", versorgt: [] },
        { katalogId: "heizung.fbh_kreis", standort: { einheitIndex: 1 }, menge: 6, status: "bestaetigt", versorgt: [] },
        { katalogId: "heizung.fbh_kreis", standort: { einheitIndex: 3 }, menge: 4, status: "bestaetigt", versorgt: [] },
        { katalogId: "heizung.fbh_kreis", standort: { einheitIndex: 4 }, menge: null, status: "bestaetigt", versorgt: [] },
        { katalogId: "heizung.verteiler", standort: { einheitIndex: 2 }, menge: 1, status: "bestaetigt", versorgt: [{ einheitIndex: 1 }, { einheitIndex: 3 }] },
      ],
    };
    await schreibeBeschreibung(c, gebaeudeId, b, REGELWERK_V1, KATALOG_V1);
    await c.query("commit");
    return { liegenschaftId, gebaeudeId };
  } catch (e) { await c.query("rollback"); throw e; } finally { c.release(); }
}
```

- [ ] **Step 3: CLI und Script** – `app/src/welt/beispiel-cli.ts`

```ts
import pg from "pg";
import { beispielAnlegen } from "./beispiel.js";

// Nur Entwicklung: legt die Beispielliegenschaft in der Datenbank aus PLANORA_DB_URL an.
const url = process.env.PLANORA_DB_URL;
if (!url) { console.error("PLANORA_DB_URL fehlt (nur fuer Entwicklung)"); process.exit(1); }
const pool = new pg.Pool({ connectionString: url });
beispielAnlegen(pool)
  .then((r) => console.log(JSON.stringify(r)), (e: Error) => { console.error(e.message); process.exitCode = 1; })
  .finally(() => pool.end());
```

In `app/package.json` unter `scripts` ergaenzen: `"welt:beispiel": "tsx src/welt/beispiel-cli.ts"`.

- [ ] **Step 4: Test laufen lassen**

Run: `npx vitest run test/welt-beispiel.test.ts`
Expected: PASS.

- [ ] **Step 5: Gesamtpruefung**

Run: `npm test`
Expected: alle bisherigen Tests (314 ok / 37 Docker uebersprungen laut CLAUDE.md) plus die neuen gruen; keine Fehlschlaege.

Run: `npm run pruefe:typen`
Expected: keine Ausgabe, Exit 0.

- [ ] **Step 6: Doku-Nachtraege**

In `docs/superpowers/specs/2026-11-11-m2a-welt-kern-design.md`:
- §3, ersten Absatz ersetzen durch: "Beide als versionierte **TypeScript-Module** im Repo (`app/src/welt/katalog.v1.ts`, `app/src/welt/regelwerk.v1.ts`). Grund: Der Docker-Build kopiert ausser Migrationen nur kompiliertes TypeScript; JSON-Dateien fehlten im Image."
- §4, Zeile `bauteil`: nach `liegenschaft_id` die Spalte `gebaeude_id` ergaenzen (fuer direkte Abfragen je Gebaeude).
- §8, Tabelle ersetzen durch die Routen-Tabelle aus Task 6 dieses Plans und den Satz "Modulname `welt` [A]" ersetzen durch: "Routen gehoeren den bestehenden Kern-Modulen `struktur` (Huelle, Beschreibung) und `szene` (Welt); jede `/api`-Route muss einem Modul gehoeren (`src/module/manifest.ts`)."
- §11, Zeile "[A] Modulname `welt` …" streichen.

In `docs/architektur/adr/0011-bauteil-katalog.md` direkt unter dem Titel einfuegen:

```markdown
> **Nachtrag 2026-11-11, M2a:** Katalog v1 (10 Heizungs-IDs) liegt als TypeScript-Modul `app/src/welt/katalog.v1.ts` vor, nicht als Tabelle `katalog_*`. Die DB speichert `katalog_id` als Text, die Pruefung erfolgt im Code. Tabellen folgen mit M7 (Lebensdauer). Spec: `docs/superpowers/specs/2026-11-11-m2a-welt-kern-design.md` §3.
```

- [ ] **Step 7: Commit**

```bash
git add app/src/welt/beispiel.ts app/src/welt/beispiel-cli.ts app/package.json app/test/welt-beispiel.test.ts docs/superpowers/specs/2026-11-11-m2a-welt-kern-design.md docs/architektur/adr/0011-bauteil-katalog.md
git commit -m "M2a: Beispieldaten erster Schnitt, Doku-Nachtraege zu Routen und Katalog

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Abdeckung Spec → Tasks

| Spec | Task |
|---|---|
| §2 Grundentscheide (Tabellen, IDs, Dreiwertigkeit, Status) | 3, 4, 5 |
| §3 Katalog, Regelwerk, Erlaubt-Matrix, Mengen | 1, 3 |
| §4 Datenmodell, Liegenschaftsgrenze, Standard + Ausnahmen | 4, 5 |
| §5 Beschreibungsschema | 1, 6 |
| §6 Abgleich, Fehlercodes, Audit, FBH-Vorschlag | 3, 5, 6 |
| §7 Generator, Symbole je Typgruppe, Hash | 2 |
| §8 API und Rechte | 6 |
| §9 Beispieldaten | 7 |
| §10 Tests je Abnahmepunkt ADR 0032 | 2, 3, 5, 6, 7 |
