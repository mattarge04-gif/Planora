# Stufe 1 – Interview-Assistent, Gruppen, Raumkomposition: Umsetzungsplan

**Aktueller Stand 12.11.2026:** Phase V1–V5 bis `c5a335e` umgesetzt und im [Abschlussbericht](2026-11-12-stufe1-abschluss.md) geprüft. Die ursprünglichen Schritt-Checkboxen unten dokumentieren den Ablauf und sind kein aktueller Fortschrittszähler. Tracks A/B/C und Phase I bleiben offen.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein gefuehrter Web-Assistent beschreibt ein Gebaeude; Generator v2 komponiert daraus Raeume und Gebaeude nach Inhalt; Leitungen werden je Heizgruppe sauber gefuehrt.

**Architecture:** Erst ein gemeinsamer Vertrag (Phase V: Typen, Migration, Katalog/Regelwerk v2, Speicher, Endpunkte, Muster-Fixtures) auf `m2c-interview`. Danach drei parallele Worktrees: A Generator v2 (Server), B Assistent (Web), C Leitungen (3D). Zum Schluss Integration (Phase I).

**Tech Stack:** Node/TypeScript, Fastify + ajv, PostgreSQL (embedded fuer Tests), Vitest, React + react-three-fiber/drei, Three.js, Playwright-GPU-Werkzeug `werkzeug/design/`.

**Spec:** `docs/superpowers/specs/2026-11-12-stufe1-interview-design.md` (vor jedem Task lesen; bei Widerspruch gilt die Spec).

## Global Constraints

- Sprache de-CH, kein Eszett; UI-Texte mit echten Umlauten; Code-Bezeichner wie im Bestand (deutsch, ohne Umlaute).
- Regelwerk-v1-Welten bleiben bitgleich (bestehende Tests `app/test/welt-generator.test.ts` unveraendert gruen; v1-Hash unveraendert). Neue Welt-Felder nur bei v2 ausgeben.
- Normalisierte Tabellen sind die Wahrheit; Beschreibung ist Ein-/Ausgabeformat. ID-Regeln M2a: ohne `id` = neu, fehlend = loeschen.
- Jede `/api`-Route gehoert einem Modul; Schreibende Requests brauchen Header `x-planora-request: 1` (siehe `app/web/src/api.ts`).
- Katalog/Regelwerk sind TS-Module (Docker-Build kopiert nur .ts).
- Visuelle Arbeit nur ueber Skill `planora-design`; GPU-Screenshots nur mit `werkzeug/design/` (Port 3100), nie SwiftShader als Beleg. PO-Server 3000/54500 nicht anfassen.
- Pruefbefehle: Backend `cd app && npm test` und `cd app && npx tsc --noEmit -p .`; Web `cd app/web && npx vitest run` und `cd app/web && npx tsc -b`; Build `npm --prefix app/web run build`.
- Commit-Nachrichten enden mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Kein Push ohne PO-Auftrag.

## Dateihoheit

| Bereich | Phase V | A Generator | B Assistent | C Leitungen |
|---|---|---|---|---|
| `app/src/welt/typen.ts`, `schema.ts`, `app/web/src/typen.ts` | ✔ | nur lesen | nur lesen | nur lesen |
| `app/src/db/migrationen/014_gruppen.sql` | ✔ | – | – | – |
| `app/src/welt/katalog.v2.ts`, `regelwerk.v2.ts`, `regelwerk.ts` | ✔ | Werte-Feinschliff | – | – |
| `app/src/welt/speicher.ts`, `pruefung.ts`, `routen.ts`, `entwurf.ts` | ✔ | – | – | – |
| `app/src/welt/generator.ts`, `generator.v2.ts`, `raum/**` | Stub | ✔ | – | – |
| `app/src/welt/muster.ts`, `beispiel.ts` | ✔ | – | – | – |
| `app/web/src/assistent/**`, `seiten/Assistent*.tsx`, `seiten/Liste.tsx`, `api.ts`, `main.tsx`/Routing | – | – | ✔ | – |
| `app/web/src/szene3/**`, `karten/**`, `seiten/Twin.tsx`, `public/modelle/**` | – | – | – | ✔ |
| `app/web/src/fixtures/**` | ✔ (erzeugt) | regeneriert in I | lesen | lesen |

---

# Phase V – Vertrag (sequenziell auf `m2c-interview`)

### Task V1: Typen und Schema

**Files:**
- Modify: `app/src/welt/typen.ts`, `app/src/welt/schema.ts`, `app/web/src/typen.ts`
- Test: `app/test/welt-schema.test.ts` (neu)

**Interfaces – Produces (exakt so verwenden):**

```ts
// app/src/welt/typen.ts (Ergaenzungen)
export type Grundform = "quader" | "quadrat" | "l_form" | "u_form";
export type GruppenArt = "ungeregelt" | "beimisch" | "drossel" | "einspritz" | "umlenk";
export const GRUPPEN_ARTEN: readonly GruppenArt[] = ["ungeregelt", "beimisch", "drossel", "einspritz", "umlenk"];
/** Bestehendes Bauteil per ID oder im selben Request neues per Index in `bauteile`. Genau eines setzen. */
export interface BauteilVerweis { bauteilId?: string; bauteilIndex?: number }
export interface GruppeVerweis { gruppeId?: string; gruppeIndex?: number }
export type Ort = { gruppe: GruppeVerweis } | { vorBauteil: BauteilVerweis };
export interface GruppeEingabe {
  id?: string; verteiler: BauteilVerweis; nummer: number; art: GruppenArt; bezeichnung: string; verbraucher: BauteilVerweis[];
}
// Huelle: breiteM/tiefeM werden optional (Pflicht nur bei Regelwerk v1, prueft pruefeHuelle)
export interface Huelle { name: string; grundform: Grundform; breiteM?: number; tiefeM?: number; geschosse: { id?: string; code: string; hoeheM?: number }[] }
export interface HuelleGespeichert { /* wie bisher */ breiteM: number | null; tiefeM: number | null; /* … */ }
// BauteilEingabe: neu `ort?: Ort | null`
// Beschreibung: neu `gruppen?: GruppeEingabe[]` (fehlt = [] = alle Gruppen loeschen)

export type WeltOrt = { gruppe: string } | { vorBauteil: string };          // Gruppen-ID bzw. Symbolschluessel
export interface WeltGruppe {
  id: string; verteiler: string; nummer: number; art: GruppenArt; bezeichnung: string;
  verbraucher: string[]; zubehoer: string[];                               // Symbolschluessel
}
// WeltSymbol: neu `ort?: WeltOrt` (nur v2)
// Welt: neu `gruppen?: WeltGruppe[]; steigzone?: { x: number; z: number } | null` (nur v2)
```

`app/web/src/typen.ts` spiegelt `GruppenArt`, `WeltOrt`, `WeltGruppe`, die optionalen Welt-Felder, `KatalogEintrag.masse?: [number, number, number]` und `bereich` inkl. `"zubehoer"`; zusaetzlich die Eingabetypen fuer den Assistenten (`Huelle`, `EinheitEingabe`, `BauteilEingabe`, `GruppeEingabe`, `Beschreibung` vollstaendig wie Backend).

Schema-Aenderungen (`schema.ts`): `grundform` enum + `"quadrat"`; `breiteM`/`tiefeM` nicht mehr in `required`; `BESCHREIBUNG_SCHEMA.properties.gruppen` (maxItems 500; `verteiler`/`verbraucher[]` als `BAUTEIL_VERWEIS = { type:"object", additionalProperties:false, minProperties:1, maxProperties:1, properties:{ bauteilId: UUID, bauteilIndex: INDEX } }`; `nummer` integer 1–99; `art` enum GRUPPEN_ARTEN; `bezeichnung` string 1–200); Bauteil `ort`: `{ type:["object","null"], oneOf:[{required:["gruppe"]},{required:["vorBauteil"]}], additionalProperties:false, properties:{ gruppe: {object, minProperties 1, maxProperties 1, properties {gruppeId: UUID, gruppeIndex: INDEX}}, vorBauteil: BAUTEIL_VERWEIS } }`. Neu `ENTWURF_SCHEMA = { type:"object", additionalProperties:false, required:["stand","daten"], properties:{ stand:{type:"integer",minimum:0}, daten:{type:"object"} } }`.

- [ ] **Step 1:** Test `welt-schema.test.ts` schreiben: kompiliert `BESCHREIBUNG_SCHEMA`/`HUELLE_SCHEMA` mit ajv (strict, wie `app/src/server.ts` konfiguriert) und prueft: (a) Beschreibung mit `gruppen:[{verteiler:{bauteilIndex:0},nummer:1,art:"beimisch",bezeichnung:"HK Restaurant",verbraucher:[{bauteilIndex:1}]}]` gueltig; (b) `art:"x"` ungueltig; (c) `ort:{gruppe:{gruppeIndex:0}}` gueltig, `ort:{gruppe:{gruppeIndex:0},vorBauteil:{bauteilIndex:0}}` ungueltig; (d) Huelle ohne `breiteM` gueltig, `grundform:"quadrat"` gueltig.
- [ ] **Step 2:** `cd app && npx vitest run test/welt-schema.test.ts` → FAIL.
- [ ] **Step 3:** Typen und Schema wie oben umsetzen; Web-Typen nachziehen.
- [ ] **Step 4:** Test gruen; `npm test` gruen (v1-Tests unveraendert); beide Typpruefungen gruen (Aufrufer von `breiteM` mit `?? `-Fallback nur dort, wo v1 garantiert ist).
- [ ] **Step 5:** Commit `Vertrag: Typen und Schema fuer Gruppen und Ort`.

### Task V2: Migration, Katalog v2, Regelwerk v2

**Files:**
- Create: `app/src/db/migrationen/014_gruppen.sql`, `app/src/welt/katalog.v2.ts`, `app/src/welt/regelwerk.v2.ts`
- Modify: `app/src/welt/regelwerk.ts` (Typen, `regelwerkFuer`), `app/src/welt/routen.ts` (`GET /api/katalog/v2`)
- Test: `app/test/welt-migration.test.ts` (ergaenzen), `app/test/welt-regelwerk.test.ts` (ergaenzen)

**Migration (vollstaendig):**

```sql
alter table gebaeude drop constraint if exists gebaeude_grundform_check;
alter table gebaeude add constraint gebaeude_grundform_check check (grundform in ('quader','quadrat','l_form','u_form'));
alter table gebaeude alter column breite_m drop not null, alter column tiefe_m drop not null;
alter table gebaeude add constraint gebaeude_masse_v1 check (regelwerk_version <> 1 or (breite_m is not null and tiefe_m is not null));

create table gruppe(
  id uuid primary key default gen_random_uuid(),
  liegenschaft_id uuid not null,
  gebaeude_id uuid not null,
  verteiler_bauteil_id uuid not null,
  nummer int not null check (nummer between 1 and 99),
  bezeichnung text not null check (length(bezeichnung) between 1 and 200),
  art text not null check (art in ('ungeregelt','beimisch','drossel','einspritz','umlenk')),
  reihenfolge int not null,
  unique (id, liegenschaft_id),
  unique (verteiler_bauteil_id, nummer),
  foreign key (gebaeude_id, liegenschaft_id) references gebaeude(id, liegenschaft_id) on delete cascade,
  foreign key (verteiler_bauteil_id, liegenschaft_id) references bauteil(id, liegenschaft_id) on delete cascade
);
create index gruppe_gebaeude on gruppe(gebaeude_id);
create table gruppe_verbraucher(
  gruppe_id uuid not null,
  bauteil_id uuid not null unique,
  liegenschaft_id uuid not null,
  primary key (gruppe_id, bauteil_id),
  foreign key (gruppe_id, liegenschaft_id) references gruppe(id, liegenschaft_id) on delete cascade,
  foreign key (bauteil_id, liegenschaft_id) references bauteil(id, liegenschaft_id) on delete cascade
);
alter table bauteil add column gruppe_id uuid, add column vor_bauteil_id uuid,
  add constraint bauteil_ort_exklusiv check (num_nonnulls(gruppe_id, vor_bauteil_id) <= 1),
  add constraint bauteil_gruppe_fk foreign key (gruppe_id, liegenschaft_id) references gruppe(id, liegenschaft_id) on delete set null (gruppe_id),
  add constraint bauteil_vor_fk foreign key (vor_bauteil_id, liegenschaft_id) references bauteil(id, liegenschaft_id) on delete set null (vor_bauteil_id);
create table entwurf(
  gebaeude_id uuid primary key,
  liegenschaft_id uuid not null,
  stand int not null default 0,
  daten jsonb not null check (pg_column_size(daten) <= 1048576),
  geaendert_am timestamptz not null default now(),
  foreign key (gebaeude_id, liegenschaft_id) references gebaeude(id, liegenschaft_id) on delete cascade
);
grant select, insert, update, delete on gruppe, gruppe_verbraucher, entwurf to planora_app;
```

Vor dem Schreiben pruefen: tatsaechlicher Name der bestehenden Check-Constraint auf `grundform` (`\d gebaeude` in der Test-DB bzw. `pg_constraint`) und ob `on delete set null (spalte)` von der eingesetzten PG-Version unterstuetzt wird (PG ≥ 15); sonst Trigger-freie Alternative: `on delete set null` ohne Spaltenliste ist hier falsch (wuerde `liegenschaft_id` nullen) → dann FK ohne Aktion und Bereinigung in `schreibeBeschreibung`.

**Katalog v2** (`katalog.v2.ts`): alle v1-Eintraege plus `masse` (aus `app/web/src/szene3/technik.ts` `MASSE` uebernehmen; `heizung.tabs_feld` = `[0.6,0.8,0.15]`) und drei neue:

```ts
{ id: "heizung.ventil_3weg", name: "3-Weg-Ventil", bereich: "zubehoer", heizArt: null, mengeMax: 50, masse: [0.2, 0.25, 0.2] },
{ id: "heizung.ventil_2weg", name: "Durchgangsventil", bereich: "zubehoer", heizArt: null, mengeMax: 50, masse: [0.15, 0.25, 0.15] },
{ id: "heizung.wmz", name: "Waermezaehler", bereich: "zubehoer", heizArt: null, mengeMax: 50, masse: [0.25, 0.2, 0.15] },
```

`heizung.umwaelzpumpe` wechselt in v2 auf `bereich: "zubehoer"`. `KatalogEintrag` erhaelt `masse?: [number, number, number]` und `bereich` + `"zubehoer"`.

**Regelwerk v2** (`regelwerk.v2.ts`), Typ in `regelwerk.ts`:

```ts
export interface RaumMatrix { modulM: number; gangModule: number; seitenMax: number; minGebaeude: [number, number];
  abgabe: { eins: [number, number]; zwei: [number, number]; dreiVier: [number, number]; jeZweiWeitere: number };
  technik: { minLaenge: number; tiefe: number }; kern: [number, number]; leer: [number, number] }
export interface RegelwerkV2 extends Regelwerk { version: 2; raum: RaumMatrix;
  bestueckung: Record<GruppenArt, { katalogId: string; menge: number }[]> }
export function regelwerkFuer(version: number): Regelwerk  // 1 → REGELWERK_V1, 2 → REGELWERK_V2, sonst throw
```

Werte: `modulM 3, gangModule 1, seitenMax 1.6, minGebaeude [4,5], abgabe { eins [2,2], zwei [3,2], dreiVier [3,3], jeZweiWeitere 1 }, technik { minLaenge 2, tiefe 2 }, kern [2,2], leer [2,2]`. Bestueckung gemaess Spec 4.3 (`umwaelzpumpe`, `ventil_3weg`, `ventil_2weg`). `erlaubt` wie v1, plus Zubehoer-IDs ueberall dort, wo der Verteiler bzw. ein Geraet erlaubt ist (Technik, `_geschoss`, Einheiten mit Unterverteiler). `masse`/`einheitArten` bleiben fuer Pruefung erhalten.

Neue Gebaeude (`legeGebaeudeAn`) bekommen Regelwerk v2, wenn `breiteM`/`tiefeM` fehlen; sonst v1 (Rueckwaertskompatibilitaet bestehender Aufrufer/Tests). `pruefeHuelle` prueft Masse nur bei v1.

- [ ] **Step 1:** Tests: Migration laeuft auf leerer DB und auf DB mit M2a-Beispiel; `bauteil_ort_exklusiv` verhindert beide Spalten; `unique(bauteil_id)` in `gruppe_verbraucher`; v1-Gebaeude ohne Masse wird abgelehnt. Regelwerk: `regelwerkFuer(2).bestueckung.beimisch` = Pumpe + 3-Weg; jede Katalog-ID in `erlaubt` existiert in Katalog v2; jeder Katalog-v2-Eintrag hat `masse`.
- [ ] **Step 2:** Tests rot.
- [ ] **Step 3:** Umsetzen; `GET /api/katalog/v2` liefert `{ version: 2, eintraege }` (gleiche Rechte wie v1).
- [ ] **Step 4:** `npm test`, Typpruefung gruen.
- [ ] **Step 5:** Commit `Vertrag: Migration 014, Katalog und Regelwerk v2`.

### Task V3: Speicher und Pruefung fuer Gruppen und Ort

**Files:**
- Modify: `app/src/welt/speicher.ts` (`ladeBeschreibung`, `schreibeBeschreibung`, `ladeHuelle`, `legeGebaeudeAn`), `app/src/welt/pruefung.ts`
- Test: `app/test/welt-speicher.test.ts`, `app/test/welt-pruefung.test.ts` (ergaenzen)

Regeln (neue Fehlercodes, 422):
- `gruppe_verteiler_ungueltig`: `verteiler` verweist nicht auf ein Bauteil mit `heizung.verteiler`.
- `gruppe_nummer_doppelt`: gleiche `nummer` am gleichen Verteiler.
- `verbraucher_doppelt`: Bauteil in mehr als einer Gruppe (auch innerhalb einer Gruppe doppelt).
- `verweis_ungueltig`: Bauteil-/Gruppenverweis existiert nicht (ID nicht im Bestand bzw. Index ausserhalb).
- `ort_selbstbezug`: `vorBauteil` zeigt auf sich selbst.
- `id_unbekannt`/`id_doppelt` fuer Gruppen analog Einheiten.

Schreiben (Reihenfolge in `schreibeBeschreibung`, alles in der Aufrufer-Transaktion): (1) `gruppe_verbraucher` des Gebaeudes loeschen, `bauteil.gruppe_id/vor_bauteil_id` des Gebaeudes auf null, entfallende Gruppen loeschen; (2) bisherige Schritte Einheiten/Bauteile; (3) Gruppen upsert (Reihenfolge = Index), IDs sammeln; (4) Verbraucher einfuegen; (5) `bauteil.gruppe_id`/`vor_bauteil_id` aus `ort` setzen; (6) `delete from entwurf where gebaeude_id=$1`; (7) Stand +1. `Zaehler` erhaelt `gruppen`.

Laden: `ladeBeschreibung` liefert `gruppen` (Verteiler/Verbraucher als `{bauteilId}`, sortiert nach `reihenfolge`) und `ort` je Bauteil (`{gruppe:{gruppeId}}` bzw. `{vorBauteil:{bauteilId}}`, sonst weglassen). `ladeHuelle` liefert `breiteM/tiefeM` evtl. `null`.

- [ ] **Step 1:** Tests: Rundlauf (schreiben → laden → gleich, inkl. Index-Verweise auf neue Bauteile und Gruppen); Loeschen einer Gruppe durch Weglassen; Loeschen eines Verbrauchers entfernt Zuordnung; jeder neue Fehlercode mit einem Minimalfall; Entwurf wird beim Schreiben geloescht.
- [ ] **Step 2:** rot. **Step 3:** umsetzen. **Step 4:** `npm test` gruen, Typpruefung gruen.
- [ ] **Step 5:** Commit `Vertrag: Gruppen und Ort speichern, laden, pruefen`.

### Task V4: Endpunkte Entwurf und Vorschau, Generator-Stub v2

**Files:**
- Create: `app/src/welt/entwurf.ts`, `app/src/welt/generator.v2.ts`
- Modify: `app/src/welt/routen.ts`, `app/src/welt/generator.ts` (Weiche)
- Test: `app/test/welt-api.test.ts` (ergaenzen), `app/test/welt-generator-v2.test.ts` (neu)

Endpunkte (Rechte wie `PUT …/beschreibung`: `fach.lesen` fuer GET, `fach.aendern` fuer Schreiben; 404 ohne Leserecht):
- `GET /api/struktur/gebaeude/:id/entwurf` → `{ stand, daten }` oder 404 `{fehler:"kein Entwurf"}`.
- `PUT /api/struktur/gebaeude/:id/entwurf` Body `ENTWURF_SCHEMA` → `{ stand }` (neu: stand 1; sonst nur wenn Body-`stand` == gespeichert, sonst 409 `stand_veraltet`). Upsert.
- `DELETE /api/struktur/gebaeude/:id/entwurf` → 204.
- `POST /api/szene/gebaeude/:id/vorschau` Body `BESCHREIBUNG_SCHEMA` → `Welt`. Prueft wie Schreiben (gleiche `pruefeBeschreibung` gegen DB-Bestand, ohne `stand`-Vergleich), schreibt nichts. Fuer neue Elemente ohne `id` vergibt sie deterministische Platzhalter `neu-e-<index>`, `neu-b-<index>`, `neu-g-<index>`.

Hinweis Web-Client: `app/web/src/api.ts` kennt nur GET/POST; B ergaenzt PUT/DELETE (Dateihoheit B).

Generator-Weiche: `weltErzeugen(h, b, rw)` ruft bei `rw.version === 2` `weltErzeugenV2(h, b, rw as RegelwerkV2)`. **Stub-Umfang V4:** v2 nutzt intern die v1-Layoutlogik mit Massen 30 × 15 (falls `h.breiteM` null), erweitert den Symbolschluessel um den Ort (`JSON.stringify([standortId, katalogId, hersteller, typ, ortSchluessel])`), gibt `gruppen` (Symbolschluessel aufgeloest; Zubehoer-Symbole mit `ort.gruppe` in `zubehoer`) und `steigzone` (Mitte erster Einheit `art==="kern"`, sonst Mitte der Einheit mit dem ersten Erzeuger, sonst null) aus und setzt `regelwerkVersion: 2`. A ersetzt die Layoutlogik.

- [ ] **Step 1:** Tests: Entwurf CRUD inkl. 409 und 403/404; Vorschau liefert Welt mit `gruppen` und schreibt nichts (Stand unveraendert); Generator-v2-Stub: zwei Pumpen gleicher Art in zwei Gruppen derselben Einheit ergeben zwei Symbole; `welt.gruppen[0].verbraucher` enthaelt die HK-Symbolschluessel; v1-Hash des Beispiels unveraendert.
- [ ] **Step 2:** rot. **Step 3:** umsetzen. **Step 4:** gruen.
- [ ] **Step 5:** Commit `Vertrag: Entwurf, Vorschau, Generator-Stub v2`.

### Task V5: Mustergebaeude und Fixtures

**Files:**
- Create: `app/src/welt/muster.ts`, `app/werkzeug/muster-welt.ts` (Skript), `app/web/src/fixtures/muster-*.json`
- Modify: `app/src/welt/beispiel.ts` (Muster in Entwicklungsdaten), `app/package.json` (Skript `muster:welt`), `app/entwicklung/start.ts` nur falls noetig
- Test: `app/test/welt-muster.test.ts` (neu)

`muster.ts` exportiert:

```ts
export interface Muster { schluessel: string; name: string; huelle: Huelle; beschreibung: (geschossIds: string[]) => Omit<Beschreibung, "gebaeudeId" | "stand"> }
export const MUSTER: Muster[]  // genau 6, Reihenfolge = Spec §8
```

1. `m1-ein-raum`: quader, [EG], Buero mit 1 HK-Symbol plus Technik-Einheit mit WP + Verteiler; 1 Gruppe ungeregelt (kleinstmoegliches Gebaeude).
2. `m2-beispiel`: heutiges Beispielgebaeude (siehe `beispiel.ts`) mit 2 Gruppen: G1 "HK Buero" ungeregelt → beide HK-Symbole Buero A; G2 "FBH" beimisch → FBH Restaurant, FBH Buero C, FBH Buero D.
3. `m3-zubehoer`: G1 ungeregelt **ohne** Zubehoer (Bestueckung leer, explizit) + G2 mit 3 × `ventil_2weg`/`ventil_3weg` gemischt und 2 Pumpen.
4. `m4-pumpe-vor-wp`: Pumpe mit `ort:{vorBauteil: WP}`.
5. `m5-fbh-ueber-geschosse`: Unterverteiler OG1 (Verbraucher von G1, Gruppe im EG) mit WMZ (`ort:{gruppe}` an G1) und FBH-Kreisen ueber `versorgt`.
6. `m6-l-u-viele-gruppen`: `l_form`, [UG1, EG, OG1], 6 Gruppen, alle Arten; zusaetzlich Variante `m6u` mit `u_form` (gleicher Inhalt).

Entwicklungsdaten: `beispielAnlegen` legt zusaetzlich alle Muster als Gebaeude "Muster 1 …" in einer zweiten Liegenschaft "Muster Stufe 1" an (v2). `npm run muster:welt` erzeugt mit `weltErzeugen` fuer jedes Muster `app/web/src/fixtures/muster-<schluessel>.json` (Geschoss-IDs deterministisch `00000000-0000-4000-8000-0000000000NN`).

- [ ] **Step 1:** Test: jedes Muster besteht `pruefeBeschreibung` gegen einen aus ihm gebildeten Bestand; `weltErzeugen` laeuft ohne Fehler; Fixtures entsprechen der aktuellen Generatorausgabe (Test liest JSON und vergleicht Hash).
- [ ] **Step 2–4:** rot → umsetzen → gruen; `npm run entwicklung` startet mit Mustern (manuell kurz pruefen auf eigener Instanz 3100: `PLANORA_PORT=3100 PLANORA_PG_PORT=54600`).
- [ ] **Step 5:** Commit `Vertrag: sechs Mustergebaeude und Welt-Fixtures`.

**Abschluss Phase V:** alle Pruefbefehle gruen; danach drei Worktrees von `m2c-interview` abzweigen: `m2c-a-generator`, `m2c-b-assistent`, `m2c-c-leitungen` (`superpowers:using-git-worktrees`).

---

# Track A – Generator v2 und Raumkomposition (Worktree `m2c-a-generator`)

Alle Funktionen rein und deterministisch; Masseinheit im Code: Module (ganzzahlig), Umrechnung in Meter erst am Ende (`× modulM`, auf mm gerundet wie `mm()` in `generator.ts`).

**Files:**
- Create: `app/src/welt/raum/matrix.ts`, `raum/reihen.ts`, `raum/form.ts`, `raum/einrichtung.ts`, `raum/steigzone.ts`
- Modify: `app/src/welt/generator.v2.ts`, `app/src/welt/speicher.ts` (nur: abgeleitete Masse nach dem Schreiben in `gebaeude.breite_m/tiefe_m` speichern – mit V3-Autor abstimmen; Dateihoheit liegt nach Phase V bei A)
- Test: `app/test/welt-raum-*.test.ts`, `app/test/welt-generator-v2.test.ts`, `app/test/welt-muster.test.ts`

### Task A1: Raumgroesse aus Matrix
- **Produces:** `raumModule(art: string, symbole: number, geraete: number, rw: RegelwerkV2): { laenge: number; tiefe: number }` – Abgaberaum nach Symbolanzahl (1→[2,2], 2→[3,2], 3–4→[3,3], dann +1 Laenge je 2 weitere), Technik `[max(minLaenge, geraete), tiefe]`, Kern fix, 0 Symbole → `leer`. Gruppenzubehoer zaehlt nicht.
- Tests: Tabelle aller Faelle (1,2,3,4,5,6,7 Symbole; Technik 1/3/6 Geraete; Kern; leer).

### Task A2: Reihenverteilung
- **Produces:** `verteileReihen(raeume: { id: string; laenge: number }[]): [string[], string[]]` – groesste zuerst (Gleichstand: Eingabereihenfolge), jeweils in die kuerzere Reihe (Gleichstand: Reihe 0).
- Tests: ausgeglichen bei [3,3,2,2]; deterministisch; ein Raum → Reihe 0.

### Task A3: Form und Fluegelpfad
- **Produces:** `formPfad(form: Grundform, laengeModule: number, tiefeModule: number): Fluegel[]` mit `Fluegel = { x0: number; z0: number; laenge: number; richtung: "x" | "z" }` (Module). Rechteck/Quadrat: ein Fluegel; L: zwei (Ecke geteilt), U: drei. Gebaeudetiefe = 2 × Raumtiefe-max + `gangModule`. Quadrat: Laenge = max(Laenge, Tiefe).
- **Produces:** `grundrissAusFluegeln(f: Fluegel[], rw): Rechteck[]` (Meter) – ersetzt `grundriss()` fuer v2.
- Tests: Rechteck 8 Module → ein Rechteck 24 × 15 m (bei Raumtiefe 2: 2+1+2=5 Module); L verteilt Reihenlaenge auf zwei Fluegel; U auf drei; Mindestgebaeude 4 × 5.

### Task A4: Layout je Geschoss, Strecken, Seitenverhaeltnis
- **Produces:** `layoutGeschoss(raeume, fluegel, gesamtLaenge, rw): Map<einheitId, Rechteck>` – Reihen entlang des Pfads, gleichmaessig gestreckt auf `gesamtLaenge` (Gebaeudelaenge = laengste Reihe ueber alle Geschosse), Seitenverhaeltnis ≤ `seitenMax` (sonst Raum auf zwei Pfadabschnitte bzw. Nachbar aufteilen gemaess Spec 5.2), `layoutManuell` hat Vorrang (Ueberlappungshinweis wie v1).
- Tests: Geschoss mit weniger Inhalt fuellt volle Laenge; kein Raum > 1:1.6; Raeume ueberlappen nicht; Gang frei.

### Task A5: Einrichtung im Raum
- **Produces:** `einrichten(einheit: Rechteck, gangSeite: "+z"|"-z"|"+x"|"-x", fassadenSeite, symbole: SymbolEntwurf[], katalog, steigzone): Map<schluessel, {x:number; z:number}>` – Zentrale: Reihe an der gangabgewandten Wand, Flussreihenfolge Erzeuger → Speicher → (vorBauteil-Teile neben Bezug) → Verteiler; Vorderkanten buendig (Masse aus Katalog v2), Abstand 0.5 m, zweite Reihe bei Ueberlauf; Verteiler an Wand zur Steigzone. HK an Fassadenwand auf `(2k−1)/2n`. Unterverteiler an Gangwand Richtung Steigzone. Zubehoer mit `ort.gruppe`: Position = Verteiler (wird in 3D am Stock gezeichnet). Uebrige: Raster mit 0.6 m Wandabstand.
- Tests: Reihenfolge und Buendigkeit Zentrale (m2), HK an Fassade (zwei HK bei ¼ und ¾), Pumpe vor WP liegt zwischen Speicher und WP bzw. direkt neben WP (m4), alle Positionen innerhalb des Raums.

### Task A6: Steigzone, Gruppen, Hinweise, Masse
- **Produces:** `steigzone(welt-teil): {x,z}` gemaess Spec 5.4; Hinweise `ohne_gruppe`, `gruppe_leer`; nach `schreibeBeschreibung` bei v2 abgeleitete Breite/Tiefe in `gebaeude` speichern, `ladeHuelle` liefert sie.
- Tests: Muster 1–6 ergeben gueltige Welten; Steigzone im Kern (m6) bzw. Ecke Zentrale (m2); v1-Tests unveraendert gruen.
- Abschluss A: `npm run muster:welt` regeneriert Fixtures; Commit je Task; Bericht an Hauptagent mit Pfaden.

---

# Track B – Interview-Assistent (Worktree `m2c-b-assistent`)

Vor visueller Arbeit Skill `planora-design` (Stufe mittel) lesen; ui-ux-designer-Regeln gelten. Zustand und Uebersetzung in die Beschreibung sind reine Funktionen und zuerst testgetrieben gebaut.

**Files:**
- Create: `app/web/src/assistent/zustand.ts` (Typ `AssistentZustand`, Reducer), `assistent/beschreibung.ts` (Zustand ↔ Beschreibung), `assistent/bestueckung.ts`, `assistent/schritte/*.tsx` (8 Schritte), `seiten/Assistent.tsx`, `seiten/Assistent.css`
- Modify: `app/web/src/api.ts` (PUT/DELETE), Routing (`app/web/src/main.tsx` bzw. Router-Datei), `seiten/Liste.tsx` ("Neues Gebäude", "Bearbeiten")
- Test: `assistent/*.test.ts`

### Task B1: Zustand und Abbildung
- **Produces:** `AssistentZustand` (Gebaeude, Einheiten je Geschoss, Abgaben-Standard/Ausnahmen + optionale Hersteller/Typ/Menge, Zentrale, Gruppen mit Art/Bestueckung/WMZ/Verbraucher, Unterverteiler, weitere Teile), `zuBeschreibung(z, bestand?): Beschreibung` und `ausBeschreibung(b, katalog): AssistentZustand`.
- **Produces:** `bestueckungVorschlag(art: GruppenArt, katalog): {katalogId, menge}[]` (Spiegel der Spec-Tabelle 4.3; Quelle: `GET /api/katalog/v2` + feste Tabelle im Web, Test prueft Gleichheit mit Spec).
- Tests: Rundlauf `ausBeschreibung(zuBeschreibung(z))` = z fuer Muster m2/m3/m5 (Fixtures aus `app/web/src/fixtures`, Beschreibung aus `app/src/welt/muster.ts` als JSON-Kopie in Fixtures, falls benoetigt); "weiss nicht" → `status: "vorgeschlagen"`, `menge: null`; vorgeschlagene Bestueckung → `vorgeschlagen`, geaenderte → `bestaetigt`; Gruppen-Zubehoer bekommt `ort:{gruppe:{gruppeIndex}}` und Standort des Verteilers.

### Task B2: Seite, Navigation, Entwurf, Vorschau
- Route `/gebaeude/neu` (Schritt 1 erzeugt Gebaeude per `POST /api/struktur/liegenschaften/:lid/gebaeude` ohne Masse) und `/gebaeude/:id/assistent`.
- Autosave: nach jedem Schrittwechsel und 1.5 s nach letzter Eingabe `PUT …/entwurf`; beim Laden zuerst Entwurf, sonst `ausBeschreibung(GET …/beschreibung)`.
- Vorschau: debounced `POST /api/szene/gebaeude/:id/vorschau` mit `zuBeschreibung(z)`; Anzeige mit bestehender `Szene3` (nur lesend, reduzierte Steuerung).
- Uebernehmen: `PUT …/beschreibung`; Erfolg → Twin-Seite.
- Tests: Reducer-Navigation (vor/zurueck, Schritt 1 lesend ohne `huelle.verwalten`), Autosave-Debounce mit Fake-Timern, 409 beim Entwurf zeigt Meldung und laedt neu.

### Task B3: Schritte 1–4 (Gebaeude, Einheiten, Abgaben, Zentrale)
- Formkacheln mit Mini-Grundriss (Rechteck, Quadrat, L, U); Geschosse ueber Anzahl UG/OG → Codes automatisch; Einheiten-Listen je Geschoss mit "+3 Büros"; Abgaben-Standard + Ausnahmen; Zentrale (Erzeuger-Auswahl, Speicher ja/nein, Raum).
- Tests (Testing Library falls vorhanden, sonst Komponentenlogik als reine Funktionen): Codes UG1/EG/OG1..; "+3 Büros" erzeugt drei Einheiten "Büro 1–3"; Zentrale-Raum muss Technik-Einheit sein (sonst Hinweis).

### Task B4: Schritte 5–8 (Gruppen, Unterverteiler, weitere Teile, Pruefen)
- Gruppen: Anzahl → Liste; je Gruppe Bezeichnung, Art (5 Karten mit Kurzbeschreibung), Bestueckung (+/− je Teiltyp, Vorschlag markiert), WMZ ja/nein, Verbraucher-Checkliste nach Geschoss/Einheit/Abgabe (bereits zugeteilte mit Gruppenname markiert, Umhaengen moeglich).
- Unterverteiler: Vorschlag je Einheit mit FBH; WMZ ja/nein.
- Weitere Teile: Typ + "vor Bauteil" (Auswahlliste der Geraete).
- Pruefen: Zusammenfassung, Hinweise aus Vorschau-Welt (`ohne_gruppe`, `gruppe_leer`, …), Uebernehmen.
- Tests: Verbraucher kann nur in einer Gruppe sein (Umhaengen entfernt aus alter); Aenderung der Art ersetzt nur vorgeschlagene Bestueckung, bestaetigte bleibt.

### Task B5: Gestaltung und Pruefung
- ui-ux-designer-Runde im Twin-Stil (Tokens `app/web/src/design/tokens.ts`), Tastaturbedienung (Tab-Reihenfolge, Enter/Leertaste, sichtbarer Fokus), echte Umlaute.
- GPU-Szenario `werkzeug/design/szenarien/assistent.json` (alle 8 Schritte, 1440/1920/1280) und visual-critic, Kritik unter `docs/design/kritiken/2026-11-…-assistent-r1.md`.

---

# Track C – Leitungen mit Gruppen (Worktree `m2c-c-leitungen`)

Arbeitet gegen `app/web/src/fixtures/muster-*.json` (Welt v2). Visuelle Arbeit ueber `planora-design` (3d-designer fuer GLB, Stufe mittel).

**Files:**
- Create: `app/web/src/szene3/gruppenNetz.ts` (reine Funktionen), `szene3/gruppenNetz.test.ts`
- Modify: `szene3/netz.ts`, `szene3/technik.ts` (Masse aus Katalog), `szene3/Technik3.tsx`, `szene3/Anlagen3.tsx`, `szene3/Interaktion.tsx`, `karten/TwinObjekt.tsx`, `seiten/Twin.tsx` (Katalog v2 laden), `public/modelle/heizung.ventil_3weg.glb`, `heizung.ventil_2weg.glb`, `heizung.wmz.glb`

### Task C1: Verbindungen aus Gruppen
- **Produces:** `gruppenVerbindungen(welt: Welt, katalog): GruppenStrang[]` mit `GruppenStrang = { gruppeId: string; verteiler: string; abgangIndex: number; verbraucher: string[]; zubehoer: string[] }`. Fallback v1 (`welt.gruppen` fehlt): jede bisherige Verteiler-Verbindung = eigene Gruppe `ungeregelt` (Spec 6.9).
- Tests: m2 → 2 Straenge mit getrennten Abgaengen; kein Verbraucher in zwei Straengen; v1-Fixture ergibt bisherige Verbindungsanzahl.

### Task C2: Strang und T-Abzweige
- **Produces:** `strangBaum(start: V3, ziele: { schluessel: string; punkt: V3 }[], spur: number, steigzone: {x,z} | null, ebenen: Map<geschossId, number>): { segmente: V3[][]; abzweige: { schluessel: string; punkte: V3[] }[] }` – Strang zum entferntesten Ziel, weitere Ziele rechtwinklig an naechsten Strangpunkt; Geschosswechsel nur an der Steigzone; deterministisch (Entfernung, dann Schluessel).
- Tests: alle Segmente achsparallel; jedes Ziel erreicht; Abzweigpunkt liegt auf dem Strang; Steigsegmente nur bei `x,z` der Steigzone (± Spur); zwei Gruppen mit Spuren 0/1 haben ≥ 0.18 m Abstand auf gemeinsamen Abschnitten.

### Task C3: Gruppenstock und Ort "vor Bauteil"
- Verteiler: Abgang je Gruppe (`verteilerAbgang(index)` erweitern auf n Abgaenge, Breite des Balkens waechst), Zubehoer der Gruppe uebereinander auf dem Abgang (Reihenfolge Pumpe, Ventile, WMZ), dann Steigen zur Leitungsebene.
- `ort.vorBauteil`: Teil sitzt auf der Leitung unmittelbar vor dem Bezug (letztes Segment vor dem Anschluss).
- Masse aus `KatalogEintrag.masse` statt `MASSE`-Tabelle (Fallback bisherige Werte, falls Katalog v1).
- Tests: Stockhoehe waechst mit Zubehoeranzahl; Gruppe ohne Zubehoer = reines Rohrstueck; Pumpe vor WP liegt auf Segment Speicher→WP.

### Task C4: Modelle, Hervorhebung, Karte
- 3d-designer: drei GLB im bestehenden Stil (Massstab gemaess Katalog-`masse`), Anschlusspunkt wie bestehende Modelle.
- Hover/Auswahl einer Gruppe hebt Rohr + Zubehoer + Verbraucher hervor (`Interaktion.tsx`); `TwinObjekt` zeigt bei Gruppenauswahl Art, Bestueckung, Verbraucher.
- GPU-Szenario `werkzeug/design/szenarien/twin-gruppen.json` mit Mustern 2–6 (Uebersicht, Technik je Geschoss, Nahaufnahme Zentrale), visual-critic.

---

# Phase I – Integration (Hauptagent auf `m2c-interview`)

### Task I1: Zusammenfuehren
- Reihenfolge: A → C → B mergen (`--no-ff`), Konflikte nach Dateihoheit loesen; `npm run muster:welt`; alle Pruefbefehle gruen.
- Twin: Knopf "Bearbeiten" → `/gebaeude/:id/assistent` (Twin.tsx, nach Merge von C).

### Task I2: Gesamtpruefung und Abnahme
- GPU-Bilder der 6 Muster in 1440/1920/1280 unter `docs/abnahme/2026-11-<tag>-stufe1/`, fps bei Drehung, Konsole ohne CSP-Verletzung.
- visual-critic Gesamtrunde; hoechstens 3 Iterationen.
- `00-kontext.md`: Nachtrag E38/M2a (Masse abgeleitet ab Regelwerk v2); `CLAUDE.md` Stand; `docs/design/lessons-learned.md` nur bei PO-bestaetigten Ergebnissen.
- PO-Sichtung; kein Merge nach `main` ohne PO-Auftrag.
