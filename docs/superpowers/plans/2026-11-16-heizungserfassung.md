# Heizungserfassung vereinfachen – Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Der Assistent erfasst ein Bürohaus mit Regelgeschossen, vorgeschlagenen Gruppen und automatischen FBH-Verteilern in höchstens 40 statt 165 Klicks.

**Architecture:** Regelgeschoss-Vorlagen leben im Assistent-Zustand (Einheiten bleiben ausgerollt) und werden beim Übernehmen in derselben Transaktion wie die Beschreibung in der neuen Tabelle `geschoss_vorlage` gespeichert. Gruppen und FBH-Verteiler leitet ein `ableiten`-Schritt nach jeder Aktion aus reinen Funktionen ab; was der Kunde anfasst, wird eingefroren und bestätigt. Beschreibungsformat, Generator, Router und Twin bleiben unverändert (ausser Anzeigenamen).

**Tech Stack:** TypeScript, React 19 (useReducer), Vitest 5, Fastify, PostgreSQL (eingebettet in Tests), ajv strikt.

**Spec:** `docs/superpowers/specs/2026-11-16-heizungserfassung-design.md`

## Global Constraints

- Sprache de-CH, kein Eszett. UI-Texte mit echten Umlauten (ä, ö, ü), Code-Kommentare im Backend ohne Umlaute wie im Bestand.
- Beschreibungsformat (`BESCHREIBUNG_SCHEMA`), Generator, Welt-Schnittstelle, Router und Twin-Logik bleiben unverändert. Einzige Twin-Änderung: Anzeigenamen (Task 8).
- Begriff "FBH-Verteiler" statt "Unterverteiler"/"Heizungsverteiler" in allen sichtbaren Texten; "Wärmezähler" mit Umlaut.
- Status: Angefasstes/Erfasstes = `bestaetigt`, unberührte Automatik = `vorgeschlagen` (H6). Prüfregel `bestaetigt_bei_unbekannt` im Backend bleibt: `bestaetigt` für Abgaben nur, wenn die Heizart in der Einheit wirksam `ja` ist.
- Keine Browser-Dialoge (`window.confirm`, `alert`); Rückfragen inline.
- Gestaltung der Schritte 2, 3, 5 über Skill `planora-design`, Stufe **mittel** (Designer-Agent `ui-ux-designer` setzt um, danach `visual-critic` 1 Runde).
- Windows: Befehle aus `app/` bzw. `app/web/`, `npm.cmd` statt `npm` in PowerShell. Bash: `npm` geht.
- Kein Merge nach `main`, kein Push ohne PO-Auftrag. Branch `m2c-interview`.
- Pruefstand vor Beginn: Backend 569/569, Web 384/384. Nach jedem Task: betroffene Suite gruen, `npm run pruefe:typen` (web) bzw. `npx tsc --noEmit` (app) gruen.

## Entscheide, die dieser Plan festlegt [A]

Offene Punkte der Spec, hier festgelegt (im Arbeitsjournal vermerken, PO sieht sie bei der Sichtung):

1. **Lesen der Vorlagen:** eigene Route `GET /api/struktur/gebaeude/:id/vorlagen` (404 ohne Eintrag), Zugriff wie Beschreibung (`fach.lesen`). Schreiben nur über `PUT .../beschreibung` mit optionalem Feld `vorlagen`.
2. **Platz statt Bezeichnungsmuster:** Ein Platz speichert `art`, `ausnahme`, `mengen`; die Bezeichnung wird immer per `nummerieren` erzeugt. Kein `bezeichnungsmuster`.
3. **Nummerierung:** `"<Kurzname> <Geschoss>.<lfd 2-stellig>"`, EG = `0`, OGn = `n`, UGn = `Un`, sonst Code. Beispiele `Büro 3.01`, `Gastro 0.01`, `Technik U1.01`. Kern heisst `Kern`.
4. **Abgaben aus dem Standard:** Abgabe-Status folgt immer der wirksamen Heizart: `ja` → `bestaetigt`, `unbekannt` → `vorgeschlagen` (auch bei unbekannter Menge).
5. **Automatik nur bei neuen/leeren Gebäuden:** `automatik = true` für neue Gebäude und geladene ohne Gruppen und ohne Verteiler. Bestehende Gebäude mit Technik und alte Entwürfe: `automatik = false`, Verhalten wie heute.
6. **Hersteller/Typ-Standard:** nicht gespeichert; beim Laden aus der häufigsten Angabe je Heizart abgeleitet. Standard ändern übernimmt alle Abgaben, die dem alten Standard entsprachen.
7. **Gruppen-Vorschlag:** einmalig beim ersten Betreten von Schritt 5 (wenn keine Gruppen existieren). Regel-Gruppen ordnen ihre Verbraucher bei jeder Änderung neu zu, bis der Kunde einzelne Verbraucher umhängt (`angefasst`).
8. **Ausnahme je Geschoss:** neue Aktion `geschossAusnahme` (z. B. FBH in OG4/OG5), sonst bräuchte das Review-Gebäude 8 Einzelklicks.
9. **Zustand Version 2:** Schrittfolge 1–7; Entwürfe Version 1 werden beim Laden migriert (Schritt 6→5, 7→6, 8→7, `automatik=false`).

## Dateiübersicht

| Datei | Verantwortung | Task |
|---|---|---|
| `app/src/db/migrationen/015_geschoss_vorlage.sql` | Tabelle `geschoss_vorlage` | 1 |
| `app/src/welt/vorlage.ts` (neu) | Vorlagen lesen/schreiben, Verweise auflösen | 1 |
| `app/src/welt/speicher.ts` | `schreibeBeschreibung` liefert `einheitIds` | 1 |
| `app/src/welt/beispiel.ts` | Aufrufer an neue Rückgabe anpassen | 1 |
| `app/src/welt/schema.ts` | `VORLAGEN_SCHEMA`, `UEBERNAHME_SCHEMA` | 2 |
| `app/src/welt/routen.ts` | GET `/vorlagen`, PUT `/beschreibung` mit `vorlagen` | 2 |
| `app/test/welt-vorlage.test.ts` (neu) | Migration, Speicher | 1 |
| `app/test/welt-api.test.ts` | Route | 2 |
| `app/web/src/assistent/zustand.ts` | Typen v2, Nummerierung, Vorlagen, Standardgerät, FBH, Gruppen, `ableiten` | 3–6 |
| `app/web/src/assistent/vorlagen.ts` (neu) | Vorlagen ⇄ API-Format | 7 |
| `app/web/src/assistent/sitzung.ts` | Entwurf-Migration v1→v2, API `ladeVorlagen`, `uebernehmen` mit Vorlagen | 3, 7 |
| `app/web/src/assistent/beschreibung.ts` | `ausBeschreibung` v2-Felder | 3, 5 |
| `app/web/src/assistent/hinweise.ts` | Klartext-Hinweise, Zusammenfassung | 8 |
| `app/web/src/assistent/bestueckung.ts` | Namen FBH-Verteiler | 8 |
| `app/web/src/dashboard/daten.ts`, `app/web/src/seiten/Twin.tsx` | Anzeigenamen Twin | 8 |
| `app/web/src/assistent/schritte/*` | Schritte 2, 3, 4, 5, Umbenennung, Schritt 6 entfällt | 3, 9–11 |
| `app/web/src/seiten/Assistent.tsx`, `Assistent.css` | Schrittzahl, Laden/Übernehmen Vorlagen, neue Klassen | 3, 7, 9–11 |
| Tests `app/web/src/assistent/*.test.ts` | | 3–8 |

---

### Task 1: Migration 015 und Vorlagen-Speicher (Backend)

**Files:**
- Create: `app/src/db/migrationen/015_geschoss_vorlage.sql`
- Create: `app/src/welt/vorlage.ts`
- Modify: `app/src/welt/speicher.ts:153-251` (Rückgabe von `schreibeBeschreibung`)
- Modify: `app/src/welt/beispiel.ts:40,57`, `app/src/welt/routen.ts:119-120` (Aufrufer)
- Test: `app/test/welt-vorlage.test.ts`

**Interfaces:**
- Produces:
  - `export const VORLAGE_FELDER = ["art", "bezeichnung", "ausnahme", "mengen"] as const; export type VorlageFeld = (typeof VORLAGE_FELDER)[number];`
  - `export interface PlatzDaten { schluessel: string; art: string; ausnahme: Partial<Heizung>; mengen: Partial<Record<HeizArt, number>> }`
  - `export interface VorlageDaten { schluessel: string; name: string; plaetze: PlatzDaten[]; geschosse: string[]; ausgelassen: { geschoss: string; platz: string }[] }` (Geschoss = Geschoss-ID)
  - `export interface VorlagenEingabe { version: 1; vorlagen: VorlageDaten[]; zuordnung: { einheit: EinheitVerweis; vorlage: string; platz: string; abweichend: VorlageFeld[] }[] }`
  - `export interface VorlagenGespeichert { version: 1; vorlagen: VorlageDaten[]; zuordnung: Record<string, { vorlage: string; platz: string; abweichend: VorlageFeld[] }> }`
  - `ladeVorlagen(c: pg.ClientBase, gebaeudeId: string): Promise<VorlagenGespeichert | null>`
  - `schreibeVorlagen(c: pg.ClientBase, gebaeudeId: string, eingabe: VorlagenEingabe | undefined, einheitIds: string[]): Promise<number>` (Anzahl gespeicherter Vorlagen; 0 = gelöscht)
  - `schreibeBeschreibung(...)` liefert neu `Promise<{ zaehler: Zaehler; einheitIds: string[] }>`

- [ ] **Step 1: Failing test schreiben**

`app/test/welt-vorlage.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { frischeDb } from "./hilfe.js";
import { ladeVorlagen, schreibeVorlagen, type VorlagenEingabe } from "../src/welt/vorlage.js";

let db: Awaited<ReturnType<typeof frischeDb>>;
let L: string, G: string, EG: string, OG1: string, E1: string, E2: string;
const q = (sql: string, p: unknown[] = []) => db.pool.query(sql, p);
const tx = async <T>(f: (c: any) => Promise<T>) => {
  const c = await db.pool.connect();
  try { await c.query("begin"); const r = await f(c); await c.query("commit"); return r; }
  catch (e) { await c.query("rollback"); throw e; } finally { c.release(); }
};

beforeAll(async () => {
  db = await frischeDb();
  L = (await q("insert into liegenschaft(name) values ('L') returning id")).rows[0].id;
  G = (await q("insert into gebaeude(liegenschaft_id, name, grundform, regelwerk_version) values ($1,'G','quader',2) returning id", [L])).rows[0].id;
  EG = (await q("insert into geschoss(liegenschaft_id, gebaeude_id, code, reihenfolge, hoehe_m) values ($1,$2,'EG',0,3) returning id", [L, G])).rows[0].id;
  OG1 = (await q("insert into geschoss(liegenschaft_id, gebaeude_id, code, reihenfolge, hoehe_m) values ($1,$2,'OG1',1,3) returning id", [L, G])).rows[0].id;
  E1 = (await q("insert into einheit(liegenschaft_id, geschoss_id, bezeichnung, art, reihenfolge) values ($1,$2,'Büro 1.01','buero',0) returning id", [L, OG1])).rows[0].id;
  E2 = (await q("insert into einheit(liegenschaft_id, geschoss_id, bezeichnung, art, reihenfolge) values ($1,$2,'Büro 1.02','buero',1) returning id", [L, OG1])).rows[0].id;
});
afterAll(async () => { await db.ende(); });

const eingabe = (zuordnung: VorlagenEingabe["zuordnung"], geschosse: string[] = []): VorlagenEingabe => ({
  version: 1,
  vorlagen: [{ schluessel: "v1", name: "Regel-OG", geschosse: geschosse.length ? geschosse : [OG1], ausgelassen: [],
    plaetze: [{ schluessel: "p1", art: "buero", ausnahme: {}, mengen: { hk: 4 } }, { schluessel: "p2", art: "buero", ausnahme: { fbh: "ja" }, mengen: {} }] }],
  zuordnung,
});

describe("Migration 015", () => {
  it("planora_app darf geschoss_vorlage lesen und schreiben", async () => {
    expect((await q("select has_table_privilege('planora_app', 'geschoss_vorlage', 'select,insert,update,delete') ok")).rows[0].ok).toBe(true);
  });
  it("fremde Liegenschaft scheitert am Fremdschluessel", async () => {
    const L2 = (await q("insert into liegenschaft(name) values ('L2') returning id")).rows[0].id;
    await expect(q("insert into geschoss_vorlage(gebaeude_id, liegenschaft_id, daten) values ($1,$2,'{}')", [G, L2])).rejects.toThrow(/foreign key/);
  });
  it("Loeschen des Gebaeudes loescht die Vorlage", async () => {
    const g = (await q("insert into gebaeude(liegenschaft_id, name, grundform, regelwerk_version) values ($1,'Weg','quader',2) returning id", [L])).rows[0].id;
    await q("insert into geschoss_vorlage(gebaeude_id, liegenschaft_id, daten) values ($1,$2,'{}')", [g, L]);
    await q("delete from gebaeude where id=$1", [g]);
    expect((await q("select count(*)::int n from geschoss_vorlage where gebaeude_id=$1", [g])).rows[0].n).toBe(0);
  });
});

describe("Vorlagen speichern", () => {
  it("loest Index-Verweise ueber einheitIds auf und speichert je Einheit-ID", async () => {
    const n = await tx((c) => schreibeVorlagen(c, G, eingabe([
      { einheit: { einheitIndex: 0 }, vorlage: "v1", platz: "p1", abweichend: [] },
      { einheit: { einheitId: E2 }, vorlage: "v1", platz: "p2", abweichend: ["bezeichnung"] },
    ]), [E1, E2]));
    expect(n).toBe(1);
    const v = await tx((c) => ladeVorlagen(c, G));
    expect(v!.version).toBe(1);
    expect(v!.vorlagen[0].geschosse).toEqual([OG1]);
    expect(v!.zuordnung).toEqual({ [E1]: { vorlage: "v1", platz: "p1", abweichend: [] }, [E2]: { vorlage: "v1", platz: "p2", abweichend: ["bezeichnung"] } });
  });
  it("verwirft unbekannte Einheiten, Geschosse und Plaetze still", async () => {
    await tx((c) => schreibeVorlagen(c, G, eingabe([
      { einheit: { einheitIndex: 7 }, vorlage: "v1", platz: "p1", abweichend: [] },
      { einheit: { einheitId: "00000000-0000-4000-8000-000000000999" }, vorlage: "v1", platz: "p1", abweichend: [] },
      { einheit: { einheitId: E1 }, vorlage: "vX", platz: "p1", abweichend: [] },
    ], [OG1, "00000000-0000-4000-8000-000000000998"]), [E1, E2]));
    const v = await tx((c) => ladeVorlagen(c, G));
    expect(v!.zuordnung).toEqual({});
    expect(v!.vorlagen[0].geschosse).toEqual([OG1]);
  });
  it("ohne Eingabe wird der Eintrag geloescht", async () => {
    expect(await tx((c) => schreibeVorlagen(c, G, undefined, [E1, E2]))).toBe(0);
    expect(await tx((c) => ladeVorlagen(c, G))).toBeNull();
  });
  it("leere Vorlagenliste loescht ebenfalls", async () => {
    await tx((c) => schreibeVorlagen(c, G, eingabe([]), [E1]));
    expect(await tx((c) => schreibeVorlagen(c, G, { version: 1, vorlagen: [], zuordnung: [] }, [E1]))).toBe(0);
    expect(await tx((c) => ladeVorlagen(c, G))).toBeNull();
  });
});
```

- [ ] **Step 2: Test laufen lassen, muss scheitern**

Run (aus `app/`): `npx vitest run test/welt-vorlage.test.ts`
Expected: FAIL, `Cannot find module '../src/welt/vorlage.js'` bzw. Tabelle `geschoss_vorlage` fehlt.

- [ ] **Step 3: Migration schreiben**

`app/src/db/migrationen/015_geschoss_vorlage.sql`:

```sql
-- Regelgeschoss-Vorlagen des Assistenten (Spec Heizungserfassung 4.1).
-- Hilfsdaten fuer die Erfassung; die Beschreibung (Einheiten, Bauteile, Gruppen) bleibt die Wahrheit.
create table geschoss_vorlage(
  gebaeude_id uuid primary key,
  liegenschaft_id uuid not null,
  daten jsonb not null check (pg_column_size(daten) <= 1048576),
  geaendert_am timestamptz not null default now(),
  foreign key (gebaeude_id, liegenschaft_id) references gebaeude(id, liegenschaft_id) on delete cascade
);
grant select, insert, update, delete on geschoss_vorlage to planora_app;
```

- [ ] **Step 4: `vorlage.ts` schreiben**

`app/src/welt/vorlage.ts`:

```ts
import type pg from "pg";
import type { EinheitVerweis, HeizArt, Heizung } from "./typen.js";

export const VORLAGE_FELDER = ["art", "bezeichnung", "ausnahme", "mengen"] as const;
export type VorlageFeld = (typeof VORLAGE_FELDER)[number];

export interface PlatzDaten { schluessel: string; art: string; ausnahme: Partial<Heizung>; mengen: Partial<Record<HeizArt, number>> }
/** `geschosse` und `ausgelassen[].geschoss` sind Geschoss-IDs. */
export interface VorlageDaten { schluessel: string; name: string; plaetze: PlatzDaten[]; geschosse: string[]; ausgelassen: { geschoss: string; platz: string }[] }
export interface VorlagenEingabe {
  version: 1; vorlagen: VorlageDaten[];
  zuordnung: { einheit: EinheitVerweis; vorlage: string; platz: string; abweichend: VorlageFeld[] }[];
}
export interface VorlagenGespeichert {
  version: 1; vorlagen: VorlageDaten[];
  zuordnung: Record<string, { vorlage: string; platz: string; abweichend: VorlageFeld[] }>;
}

export async function ladeVorlagen(c: pg.ClientBase, gebaeudeId: string): Promise<VorlagenGespeichert | null> {
  const r = (await c.query("select daten from geschoss_vorlage where gebaeude_id=$1", [gebaeudeId])).rows[0];
  return r ? r.daten : null;
}

/**
 * Schreibt die Vorlagen in der Transaktion des Aufrufers (nach schreibeBeschreibung).
 * Index-Verweise zeigen auf Positionen der eben geschriebenen Beschreibung (`einheitIds`).
 * Unbekannte Einheiten, Geschosse, Vorlagen und Plaetze werden still verworfen: Uebernehmen scheitert nie an Vorlagen.
 * Ohne Eingabe oder ohne Vorlagen wird ein bestehender Eintrag geloescht.
 */
export async function schreibeVorlagen(c: pg.ClientBase, gebaeudeId: string, eingabe: VorlagenEingabe | undefined, einheitIds: string[]): Promise<number> {
  if (!eingabe || eingabe.vorlagen.length === 0) {
    await c.query("delete from geschoss_vorlage where gebaeude_id=$1", [gebaeudeId]);
    return 0;
  }
  const g = (await c.query("select liegenschaft_id from gebaeude where id=$1", [gebaeudeId])).rows[0];
  if (!g) throw new Error("Gebaeude unbekannt");
  const geschosse = new Set<string>((await c.query("select id from geschoss where gebaeude_id=$1", [gebaeudeId])).rows.map((r) => r.id));
  const einheiten = new Set(einheitIds);
  const vorlagen = eingabe.vorlagen.map((v) => {
    const plaetze = new Set(v.plaetze.map((p) => p.schluessel));
    return { ...v, geschosse: v.geschosse.filter((x) => geschosse.has(x)),
      ausgelassen: v.ausgelassen.filter((x) => geschosse.has(x.geschoss) && plaetze.has(x.platz)) };
  });
  const platzVon = new Map(vorlagen.map((v) => [v.schluessel, new Set(v.plaetze.map((p) => p.schluessel))]));
  const zuordnung: VorlagenGespeichert["zuordnung"] = {};
  for (const z of eingabe.zuordnung) {
    const id = z.einheit.einheitId ?? (z.einheit.einheitIndex !== undefined ? einheitIds[z.einheit.einheitIndex] : undefined);
    if (!id || !einheiten.has(id) || !platzVon.get(z.vorlage)?.has(z.platz)) continue;
    zuordnung[id] = { vorlage: z.vorlage, platz: z.platz, abweichend: [...z.abweichend] };
  }
  const daten: VorlagenGespeichert = { version: 1, vorlagen, zuordnung };
  await c.query(
    `insert into geschoss_vorlage(gebaeude_id, liegenschaft_id, daten) values ($1,$2,$3)
     on conflict (gebaeude_id) do update set daten=excluded.daten, geaendert_am=now()`,
    [gebaeudeId, g.liegenschaft_id, JSON.stringify(daten)]);
  return vorlagen.length;
}
```

- [ ] **Step 5: `schreibeBeschreibung` liefert `einheitIds`**

In `app/src/welt/speicher.ts` Signatur und Rückgabe ändern:

```ts
export async function schreibeBeschreibung(c: pg.ClientBase, gebaeudeId: string, b: Beschreibung, rw: Regelwerk, katalog: Katalog): Promise<{ zaehler: Zaehler; einheitIds: string[] }> {
```
und am Ende statt `return z;`:
```ts
  return { zaehler: z, einheitIds };
```
Aufrufer anpassen:
- `app/src/welt/routen.ts:119-120`:
```ts
          const { zaehler } = await schreibeBeschreibung(c, req.params.id, kanonischeBeschreibung(req.body), regelwerkFuer(version), version === 1 ? KATALOG_V1 : KATALOG_V2);
          await auditEreignis(c, k.auditId, "gebaeude.beschreibung", { gebaeudeId: req.params.id, ...zaehler });
```
- `app/src/welt/beispiel.ts:40,57`: Rückgabe wird nicht verwendet → keine Änderung nötig, nur prüfen mit `grep -n "schreibeBeschreibung" src/welt/beispiel.ts`.
- `app/test/welt-speicher.test.ts:18`: `schreibe` gibt jetzt `{ zaehler, einheitIds }` zurück. Alle Stellen, die das Ergebnis als Zaehler lesen, anpassen: `grep -n "await schreibe(" test/welt-speicher.test.ts` und dort `(await schreibe(...)).zaehler` verwenden, wo Zaehlerfelder (`einheiten`, `bauteile`, `gruppen`) abgefragt werden.

- [ ] **Step 6: Tests laufen lassen**

Run: `npx vitest run test/welt-vorlage.test.ts test/welt-speicher.test.ts test/welt-migration.test.ts test/migrator.test.ts`
Expected: PASS.

- [ ] **Step 7: Typprüfung und volle Suite**

Run: `npx tsc --noEmit && npm test`
Expected: tsc ohne Fehler; Backend 576/576 (569 + 7 neue), Docker-Tests übersprungen.

- [ ] **Step 8: Commit**

```bash
git add app/src/db/migrationen/015_geschoss_vorlage.sql app/src/welt/vorlage.ts app/src/welt/speicher.ts app/src/welt/routen.ts app/test/welt-vorlage.test.ts app/test/welt-speicher.test.ts
git commit -m "Backend: Tabelle geschoss_vorlage und Vorlagen-Speicher (Migration 015)"
```

---

### Task 2: Routen für Vorlagen (Backend)

**Files:**
- Modify: `app/src/welt/schema.ts` (nach `ENTWURF_SCHEMA`)
- Modify: `app/src/welt/routen.ts:112-124` (PUT Beschreibung), neue GET-Route
- Test: `app/test/welt-api.test.ts` (neuer `describe`-Block am Ende)

**Interfaces:**
- Consumes: `ladeVorlagen`, `schreibeVorlagen`, `VorlagenEingabe`, `VORLAGE_FELDER` aus Task 1; `schreibeBeschreibung` → `{ zaehler, einheitIds }`.
- Produces:
  - `GET /api/struktur/gebaeude/:id/vorlagen` → 200 `VorlagenGespeichert` | 404 `{ fehler: "keine Vorlagen" }` | 404 ohne Leserecht.
  - `PUT /api/struktur/gebaeude/:id/beschreibung` Body = Beschreibung + optional `vorlagen: VorlagenEingabe`. Antwort unverändert (Beschreibung).
  - `export const VORLAGEN_SCHEMA`, `export const UEBERNAHME_SCHEMA` in `schema.ts`.

- [ ] **Step 1: Failing test schreiben**

Am Ende von `app/test/welt-api.test.ts` anfügen (nutzt `anfrage`, `kBetr`, `kBearb`, `kLeser`, `kFremd`, `L1` aus dem Dateikopf; `kFremd` hat keinen Zugriff auf `L1`):

```ts
describe("Vorlagen (Regelgeschoss)", () => {
  let V: string;
  const urlB = () => `/api/struktur/gebaeude/${V}/beschreibung`;
  const urlVo = () => `/api/struktur/gebaeude/${V}/vorlagen`;
  const vorlagen = (og1: string) => ({
    version: 1,
    vorlagen: [{ schluessel: "v1", name: "Regel-OG", geschosse: [og1], ausgelassen: [],
      plaetze: [{ schluessel: "p1", art: "buero", ausnahme: {}, mengen: { hk: 3 } }] }],
    zuordnung: [{ einheit: { einheitIndex: 1 }, vorlage: "v1", platz: "p1", abweichend: [] }],
  });
  const body = (leer: any) => {
    const [eg, og1] = leer.geschosse;
    return { ...leer, heizungStandard: { hk: "ja", fbh: "nein", tabs: "nein" },
      einheiten: [
        { geschossId: eg.id, bezeichnung: "Technik", art: "technik", flaecheM2: null },
        { geschossId: og1.id, bezeichnung: "Büro 1.01", art: "buero", flaecheM2: null },
      ], bauteile: [] };
  };

  it("Uebernehmen mit Vorlagen speichert sie mit echten Einheit-IDs; Lesen wie Beschreibung", async () => {
    const r = await anfrage("POST", `/api/struktur/liegenschaften/${L1}/gebaeude`, kBetr, { name: "Regelhaus", grundform: "quader", geschosse: [{ code: "EG" }, { code: "OG1" }] });
    V = r.json().id;
    expect((await anfrage("GET", urlVo(), kBearb)).statusCode).toBe(404);
    const leer = (await anfrage("GET", urlB(), kBearb)).json();
    const og1 = leer.geschosse[1].id;
    const p = await anfrage("PUT", urlB(), kBearb, { ...body(leer), vorlagen: vorlagen(og1) });
    expect(p.statusCode).toBe(200);
    const bueroId = p.json().einheiten.find((e: any) => e.art === "buero").id;
    const g = await anfrage("GET", urlVo(), kLeser);
    expect(g.statusCode).toBe(200);
    expect(g.json().zuordnung).toEqual({ [bueroId]: { vorlage: "v1", platz: "p1", abweichend: [] } });
    expect((await anfrage("GET", urlVo(), kFremd)).statusCode).toBe(404);
  });
  it("Uebernehmen ohne Vorlagen loescht den Eintrag", async () => {
    const b = (await anfrage("GET", urlB(), kBearb)).json();
    expect((await anfrage("PUT", urlB(), kBearb, b)).statusCode).toBe(200);
    expect((await anfrage("GET", urlVo(), kBearb)).statusCode).toBe(404);
  });
  it("Fehler in der Beschreibung schreibt auch keine Vorlagen (eine Transaktion)", async () => {
    const b = (await anfrage("GET", urlB(), kBearb)).json();
    const kaputt = { ...b, stand: b.stand + 5, vorlagen: vorlagen(b.geschosse[1].id) };
    expect((await anfrage("PUT", urlB(), kBearb, kaputt)).statusCode).toBe(409);
    expect((await anfrage("GET", urlVo(), kBearb)).statusCode).toBe(404);
  });
  it("Schema: unbekanntes Feld und falsches Abweichungsfeld werden abgelehnt", async () => {
    const b = (await anfrage("GET", urlB(), kBearb)).json();
    const v = vorlagen(b.geschosse[1].id);
    expect((await anfrage("PUT", urlB(), kBearb, { ...b, vorlagen: { ...v, extra: 1 } })).statusCode).toBe(400);
    expect((await anfrage("PUT", urlB(), kBearb, { ...b, vorlagen: { ...v, zuordnung: [{ ...v.zuordnung[0], abweichend: ["farbe"] }] } })).statusCode).toBe(400);
  });
  it("Vorschau akzeptiert kein Feld vorlagen (Beschreibungsschema unveraendert)", async () => {
    const b = (await anfrage("GET", urlB(), kBearb)).json();
    expect((await anfrage("POST", `/api/szene/gebaeude/${V}/vorschau`, kBearb, { ...b, vorlagen: vorlagen(b.geschosse[1].id) })).statusCode).toBe(400);
  });
});
```

Hinweis: Wenn im Dateikopf `kFremd` anders heisst, den Namen des Kontos ohne Zugriff auf `L1` verwenden (`grep -n "konto(" test/welt-api.test.ts`).

- [ ] **Step 2: Test laufen lassen, muss scheitern**

Run: `npx vitest run test/welt-api.test.ts -t "Vorlagen"`
Expected: FAIL (GET `/vorlagen` liefert 404 der Route-Tabelle für alle Fälle, PUT mit `vorlagen` liefert 400).

- [ ] **Step 3: Schema ergänzen**

In `app/src/welt/schema.ts` nach `ENTWURF_SCHEMA`:

```ts
const SCHLUESSEL = { type: "string", minLength: 1, maxLength: 64 };
const HEIZ_MENGEN = { type: "object", additionalProperties: false,
  properties: { hk: { type: "integer", minimum: 0, maximum: 10000 }, fbh: { type: "integer", minimum: 0, maximum: 10000 }, tabs: { type: "integer", minimum: 0, maximum: 10000 } } };
export const VORLAGEN_SCHEMA = {
  type: "object", additionalProperties: false, required: ["version", "vorlagen", "zuordnung"],
  properties: {
    version: { const: 1 },
    vorlagen: { type: "array", maxItems: 50, items: {
      type: "object", additionalProperties: false, required: ["schluessel", "name", "plaetze", "geschosse", "ausgelassen"],
      properties: {
        schluessel: SCHLUESSEL, name: { type: "string", maxLength: 200 },
        plaetze: { type: "array", maxItems: 200, items: {
          type: "object", additionalProperties: false, required: ["schluessel", "art", "ausnahme", "mengen"],
          properties: { schluessel: SCHLUESSEL, art: { type: "string", maxLength: 50 },
            ausnahme: { type: "object", additionalProperties: false, properties: HEIZ }, mengen: HEIZ_MENGEN } } },
        geschosse: { type: "array", maxItems: 100, items: UUID },
        ausgelassen: { type: "array", maxItems: 2000, items: {
          type: "object", additionalProperties: false, required: ["geschoss", "platz"], properties: { geschoss: UUID, platz: SCHLUESSEL } } },
      } } },
    zuordnung: { type: "array", maxItems: 2000, items: {
      type: "object", additionalProperties: false, required: ["einheit", "vorlage", "platz", "abweichend"],
      properties: {
        einheit: { type: "object", additionalProperties: false, minProperties: 1, maxProperties: 1,
          properties: { einheitId: UUID, einheitIndex: { type: "integer", minimum: 0 } } },
        vorlage: SCHLUESSEL, platz: SCHLUESSEL,
        abweichend: { type: "array", maxItems: 4, uniqueItems: true, items: { enum: ["art", "bezeichnung", "ausnahme", "mengen"] } },
      } } },
  },
};
/** PUT Beschreibung: Beschreibung plus optionale Vorlagen des Assistenten. Vorschau nutzt weiter BESCHREIBUNG_SCHEMA. */
export const UEBERNAHME_SCHEMA = { ...BESCHREIBUNG_SCHEMA, properties: { ...BESCHREIBUNG_SCHEMA.properties, vorlagen: VORLAGEN_SCHEMA } };
```

`HEIZ` und `UUID` sind in `schema.ts` bereits definiert (`grep -n "^const HEIZ\|^const UUID" src/welt/schema.ts`); falls `UUID` anders heisst, den vorhandenen Namen verwenden.

- [ ] **Step 4: Routen anpassen**

In `app/src/welt/routen.ts`:

Imports ergänzen:
```ts
import { ladeVorlagen, schreibeVorlagen, type VorlagenEingabe } from "./vorlage.js";
import { BESCHREIBUNG_SCHEMA, ENTWURF_SCHEMA, HUELLE_SCHEMA, ID_PARAMS, LID_PARAMS, UEBERNAHME_SCHEMA } from "./schema.js";
```

Hilfsfunktion nach `kanonischeBeschreibung`:
```ts
function kanonischeVorlagen(v: VorlagenEingabe): VorlagenEingabe {
  return {
    ...v,
    vorlagen: v.vorlagen.map((x) => ({ ...x, geschosse: x.geschosse.map((g) => klein(g)!), ausgelassen: x.ausgelassen.map((a) => ({ ...a, geschoss: klein(a.geschoss)! })) })),
    zuordnung: v.zuordnung.map((z) => ({ ...z, einheit: z.einheit.einheitId !== undefined ? { einheitId: klein(z.einheit.einheitId) } : z.einheit })),
  };
}
```

PUT Beschreibung ersetzen:
```ts
  app.put<{ Params: { id: string }; Body: Beschreibung & { vorlagen?: VorlagenEingabe } }>("/api/struktur/gebaeude/:id/beschreibung",
    { schema: { params: ID_PARAMS, body: UEBERNAHME_SCHEMA } }, async (req, reply) => {
      const k = req.kontext!;
      const z = await mitClient((c) => zugriff(c, k.benutzerId, req.params.id, true));
      if (z !== 200) return verweigert(reply, z);
      const { vorlagen, ...beschreibung } = req.body;
      try {
        return await inTransaktion(async (c) => {
          const huelle = await ladeHuelle(c, req.params.id);
          const version = huelle?.regelwerkVersion ?? 1;
          const { zaehler, einheitIds } = await schreibeBeschreibung(c, req.params.id, kanonischeBeschreibung(beschreibung), regelwerkFuer(version), version === 1 ? KATALOG_V1 : KATALOG_V2);
          const anzahl = await schreibeVorlagen(c, req.params.id, vorlagen && kanonischeVorlagen(vorlagen), einheitIds);
          await auditEreignis(c, k.auditId, "gebaeude.beschreibung", { gebaeudeId: req.params.id, ...zaehler, vorlagen: anzahl });
          return ladeBeschreibung(c, req.params.id);
        });
      } catch (e) { return fachAntwort(reply, e); }
    });

  app.get<{ Params: { id: string } }>("/api/struktur/gebaeude/:id/vorlagen", { schema: { params: ID_PARAMS } }, async (req, reply) => {
    return inSnapshot(async (c) => {
      const z = await zugriff(c, req.kontext!.benutzerId, req.params.id, false);
      if (z !== 200) return verweigert(reply, z);
      return (await ladeVorlagen(c, req.params.id)) ?? reply.code(404).send({ fehler: "keine Vorlagen" });
    });
  });
```

Prüfen, ob Audit-Tests die Payload exakt vergleichen: `grep -n "gebaeude.beschreibung" test/*.ts`. Falls ja, Erwartung um `vorlagen: 0` ergänzen.

- [ ] **Step 5: Tests laufen lassen**

Run: `npx vitest run test/welt-api.test.ts test/welt-schema.test.ts`
Expected: PASS.

- [ ] **Step 6: Typprüfung und volle Suite**

Run: `npx tsc --noEmit && npm test`
Expected: Backend 581/581.

- [ ] **Step 7: Commit**

```bash
git add app/src/welt/schema.ts app/src/welt/routen.ts app/test/welt-api.test.ts
git commit -m "Backend: Vorlagen lesen und mit der Beschreibung uebernehmen (eine Transaktion)"
```

---

### Task 3: Zustand Version 2 – Schrittfolge, Typen, Nummerierung, Status

**Files:**
- Modify: `app/web/src/assistent/zustand.ts` (Typen, `SCHRITTE`, `EINHEIT_ARTEN`, `leererZustand`, `einheitNeu`, neue Aktion `einheitAnzahl`, `abgabenAbgleichen`, `abgabeWeissNicht`, `hauptverteiler`, Aufteilung `reduziere`/`reduziereKern`)
- Modify: `app/web/src/assistent/beschreibung.ts:60-66` (`ausBeschreibung` v2-Felder)
- Modify: `app/web/src/assistent/sitzung.ts:43-48` (`entwurfLesen` mit Migration)
- Modify: `app/web/src/assistent/hinweise.ts:41,44` (Schrittnummern)
- Modify: `app/web/src/assistent/schritte/index.tsx` (Abbildung 7 Schritte, vorläufig)
- Modify: `app/web/src/assistent/schritte/Schritt8Pruefen.tsx:21-22` (Schrittnummern)
- Modify: `app/web/src/seiten/Assistent.tsx:259,308,314` (`< 8` → `< SCHRITTE.length`)
- Test: `app/web/src/assistent/zustand.test.ts`, `schritte.test.ts`, `sitzung.test.ts`, weitere bestehende Tests anpassen

**Interfaces:**
- Produces (in `zustand.ts`):
  - `export type SchrittNr = 1 | 2 | 3 | 4 | 5 | 6 | 7;`
  - `export type VorlageFeld = "art" | "bezeichnung" | "ausnahme" | "mengen";`
  - `export interface ZPlatz { schluessel: string; art: string; ausnahme: Partial<Heizung>; mengen: Partial<Record<HeizArt, number>> }`
  - `export interface ZVorlage { schluessel: string; name: string; plaetze: ZPlatz[]; geschosse: string[]; ausgelassen: { geschoss: string; platz: string }[] }` (Geschoss = Code)
  - `ZEinheit` + `vorlage?: { schluessel: string; platz: string }; abweichend?: VorlageFeld[]`
  - `ZBauteil` + `auto?: boolean` (automatisch erzeugt, unberührt) + `fbh?: boolean` (vom Assistenten angelegter FBH-Verteiler)
  - `export interface ZGruppenRegel { heizart: HeizArt; geschosse?: string[]; einheit?: string }`; `ZGruppe` + `regel?: ZGruppenRegel; angefasst?: boolean`
  - `AssistentZustand.version: 2` + `vorlagen: ZVorlage[]; standardGeraet: Partial<Record<HeizArt, { hersteller: string | null; typ: string | null }>>; automatik: boolean; gruppenVorgeschlagen: boolean; fbhWmz: boolean; fbhVerteilerAus: string[]`
  - `geschossKurz(code: string): string`, `nummerieren(geschoss: string, art: string, lfd: number): string`, `naechsteLfd(einheiten: readonly ZEinheit[], geschoss: string): number`
  - Aktion `{ typ: "einheitAnzahl"; geschoss: string; art: string; anzahl: number }` (zählt nur Einheiten ohne Vorlage)
  - `reduziereKern(z, a)` (intern, ohne Ableitungen) und `reduziere(z, a)` (öffentlich)
- Produces (in `sitzung.ts`): `export function zustandMigrieren(daten: unknown): AssistentZustand | null`
- `naechsteNummer` entfällt (ersetzt durch `naechsteLfd`).

- [ ] **Step 1: Failing tests schreiben**

In `app/web/src/assistent/zustand.test.ts` anfügen:

```ts
import { geschossKurz, naechsteLfd, nummerieren, SCHRITTE } from "./zustand";

describe("Version 2 – Schritte und Nummerierung", () => {
  it("sieben Schritte mit neuen Titeln", () => {
    expect(SCHRITTE.map((s) => s.titel)).toEqual(["Gebäude", "Geschosse & Einheiten", "Heizung", "Zentrale", "Gruppen & FBH-Verteiler", "Weitere Teile", "Prüfen"]);
  });
  it("Geschoss-Kurzform und Bezeichnung", () => {
    expect(["EG", "OG3", "OG12", "UG1", "DG"].map(geschossKurz)).toEqual(["0", "3", "12", "U1", "DG"]);
    expect(nummerieren("OG3", "buero", 1)).toBe("Büro 3.01");
    expect(nummerieren("EG", "gastro", 2)).toBe("Gastro 0.02");
    expect(nummerieren("UG1", "kern", 12)).toBe("Kern U1.12");
  });
  it("nächste laufende Nummer je Geschoss", () => {
    const e = (geschoss: string, bezeichnung: string) => ({ schluessel: bezeichnung, geschoss, bezeichnung, art: "buero", flaecheM2: null, ausnahme: {} });
    expect(naechsteLfd([], "OG1")).toBe(1);
    expect(naechsteLfd([e("OG1", "Büro 1.01"), e("OG1", "Kern 1.03"), e("OG2", "Büro 2.07")], "OG1")).toBe(4);
    expect(naechsteLfd([e("OG1", "Empfang")], "OG1")).toBe(2);
  });
  it("neue Einheiten werden je Geschoss nummeriert", () => {
    const z = neuesGebaeude({ typ: "einheitNeu", geschoss: "EG", art: "buero", anzahl: 2 }, { typ: "einheitNeu", geschoss: "EG", art: "kern" });
    expect(z.einheiten.map((e) => e.bezeichnung)).toEqual(["Büro 0.01", "Büro 0.02", "Kern 0.03"]);
  });
  it("einheitAnzahl erhöht und verringert je Nutzung", () => {
    let z = neuesGebaeude({ typ: "einheitAnzahl", geschoss: "EG", art: "buero", anzahl: 3 });
    expect(z.einheiten).toHaveLength(3);
    z = reduziere(z, { typ: "einheitAnzahl", geschoss: "EG", art: "buero", anzahl: 1 });
    expect(z.einheiten.map((e) => e.bezeichnung)).toEqual(["Büro 0.01"]);
  });
  it("Abgabe-Status folgt der wirksamen Heizart (H6)", () => {
    let z = neuesGebaeude({ typ: "einheitNeu", geschoss: "EG", art: "buero" });
    const hk = () => z.bauteile.find((t) => t.katalogId === K.hk)!;
    expect(hk().status).toBe("bestaetigt");
    z = reduziere(z, { typ: "abgabeWeissNicht", schluessel: hk().schluessel });
    expect(hk().status).toBe("bestaetigt");
    z = reduziere(z, { typ: "standard", art: "hk", wert: "unbekannt" });
    expect(hk().status).toBe("vorgeschlagen");
    z = reduziere(z, { typ: "standard", art: "hk", wert: "ja" });
    expect(hk().status).toBe("bestaetigt");
  });
});
```

Benötigt `neuesGebaeude` und `K` – beides prüfen: `sed -n 1,20p web/src/assistent/zustand.test.ts`. Falls `neuesGebaeude` fehlt, oben in der Datei ergänzen:

```ts
function neuesGebaeude(...aktionen: Aktion[]): AssistentZustand {
  let z = reduziere(leererZustand("l"), { typ: "geschosse", ug: 1, og: 1 });
  z = reduziere(z, { typ: "gebaeudeAngelegt", id: "00000000-0000-4000-8000-000000000900", stand: 0,
    geschosse: z.gebaeude.geschosse.map((g, i) => ({ id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`, code: g.code })) });
  for (const a of aktionen) z = reduziere(z, a);
  return z;
}
```

In `app/web/src/assistent/sitzung.test.ts` anfügen:

```ts
import { zustandMigrieren } from "./sitzung";

describe("Entwurf Version 1 → 2", () => {
  it("verschiebt Schritte und setzt Automatik aus", () => {
    const alt = { version: 1, schritt: 8, gebaeude: { id: ID }, einheiten: [], bauteile: [], gruppen: [] };
    const z = zustandMigrieren(alt)!;
    expect(z.version).toBe(2);
    expect(z.schritt).toBe(7);
    expect(z.automatik).toBe(false);
    expect(z.vorlagen).toEqual([]);
    expect(zustandMigrieren({ ...alt, schritt: 6 })!.schritt).toBe(5);
    expect(zustandMigrieren({ ...alt, schritt: 7 })!.schritt).toBe(6);
  });
  it("lehnt unbekannte Versionen ab", () => {
    expect(zustandMigrieren({ version: 9 })).toBeNull();
    expect(zustandMigrieren(null)).toBeNull();
  });
});
```

(`ID` ist im Kopf von `sitzung.test.ts` definiert; sonst `grep -n "const ID" web/src/assistent/sitzung.test.ts`.)

- [ ] **Step 2: Tests laufen lassen, müssen scheitern**

Run (aus `app/web/`): `npx vitest run src/assistent/zustand.test.ts src/assistent/sitzung.test.ts`
Expected: FAIL (Exporte fehlen).

- [ ] **Step 3: Typen und Konstanten in `zustand.ts`**

Kopf ersetzen (Zeilen 9–49):

```ts
export type SchrittNr = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const SCHRITTE: readonly { nr: SchrittNr; titel: string; kurz: string }[] = [
  { nr: 1, titel: "Gebäude", kurz: "Name, Form und Geschosse" },
  { nr: 2, titel: "Geschosse & Einheiten", kurz: "Regelgeschosse und Nutzungen" },
  { nr: 3, titel: "Heizung", kurz: "Standard, Hersteller und Ausnahmen" },
  { nr: 4, titel: "Zentrale", kurz: "Erzeuger, Speicher und Raum" },
  { nr: 5, titel: "Gruppen & FBH-Verteiler", kurz: "Heizgruppen und Verteiler" },
  { nr: 6, titel: "Weitere Teile", kurz: "Teile an anderem Ort" },
  { nr: 7, titel: "Prüfen", kurz: "Zusammenfassung und Übernahme" },
];
export const LETZTER_SCHRITT: SchrittNr = 7;

export type VorlageFeld = "art" | "bezeichnung" | "ausnahme" | "mengen";
export interface ZPlatz { schluessel: string; art: string; ausnahme: Partial<Heizung>; mengen: Partial<Record<HeizArt, number>> }
/** Regelgeschoss: Plätze werden in jedem zugewiesenen Geschoss (Code) als Einheit ausgerollt. */
export interface ZVorlage { schluessel: string; name: string; plaetze: ZPlatz[]; geschosse: string[]; ausgelassen: { geschoss: string; platz: string }[] }

export interface ZGeschoss { id?: string; code: string }
export interface ZEinheit {
  schluessel: string; id?: string; geschoss: string; // Geschoss-Code
  bezeichnung: string; art: string; flaecheM2: number | null; layoutManuell?: Rechteck | null;
  ausnahme: Partial<Heizung>;
  /** Herkunft aus einem Regelgeschoss und die Felder, die der Kunde hier abweichend gesetzt hat. */
  vorlage?: { schluessel: string; platz: string }; abweichend?: VorlageFeld[];
}
export type ZStandort = { einheit: string } | { geschoss: string };
export type ZOrt = { gruppe: string } | { vorBauteil: string } | null;
export interface ZBauteil {
  schluessel: string; id?: string; katalogId: string; standort: ZStandort;
  menge: number | null; status: BauteilStatus; hersteller: string | null; typ: string | null; baujahr: number | null;
  positionManuell: Punkt | null; versorgt: string[]; ort: ZOrt;
  /** Automatisch erzeugt und vom Kunden nicht angefasst (H6: bleibt «vorgeschlagen»). */
  auto?: boolean;
  /** Vom Assistenten angelegter FBH-Verteiler (nie Hauptverteiler). */
  fbh?: boolean;
}
export interface ZGruppenRegel { heizart: HeizArt; geschosse?: string[]; einheit?: string }
export interface ZGruppe {
  schluessel: string; id?: string; verteiler: string; nummer: number; art: GruppenArt; bezeichnung: string; verbraucher: string[];
  /** Vorgeschlagene Gruppe: Verbraucher werden nach Regel zugeordnet, bis der Kunde einzelne umhängt (`angefasst`). */
  regel?: ZGruppenRegel; angefasst?: boolean;
}
export interface AssistentZustand {
  version: 2;
  schritt: SchrittNr;
  /** Schritt 1 nur mit Recht `huelle.verwalten` und solange das Gebäude noch nicht angelegt ist. */
  huelleBearbeitbar: boolean;
  gebaeude: { id: string | null; liegenschaftId: string | null; name: string; grundform: Grundform; stand: number; geschosse: ZGeschoss[] };
  heizungStandard: Heizung;
  /** Hersteller/Typ je Heizart am Gebäudestandard (H5); nicht gespeichert, beim Laden abgeleitet. */
  standardGeraet: Partial<Record<HeizArt, { hersteller: string | null; typ: string | null }>>;
  einheiten: ZEinheit[];
  bauteile: ZBauteil[];
  gruppen: ZGruppe[];
  vorlagen: ZVorlage[];
  zentraleRaum: string | null;
  /** FBH-Verteiler und Gruppen automatisch ableiten (neue oder leere Gebäude). */
  automatik: boolean;
  gruppenVorgeschlagen: boolean;
  /** Wärmezähler an allen FBH-Verteilern (Vorgabe für neue). */
  fbhWmz: boolean;
  /** Einheiten, in denen der Kunde den automatischen FBH-Verteiler abgewählt hat. */
  fbhVerteilerAus: string[];
  zaehler: number;
}
```

`EINHEIT_ARTEN` um `kurz` erweitern:

```ts
export const EINHEIT_ARTEN: readonly { art: string; name: string; mehrzahl: string; kurz: string }[] = [
  { art: "buero", name: "Büro", mehrzahl: "Büros", kurz: "Büro" },
  { art: "wohnung", name: "Wohnung", mehrzahl: "Wohnungen", kurz: "Wohnung" },
  { art: "gastro", name: "Gastro", mehrzahl: "Gastro", kurz: "Gastro" },
  { art: "allgemein", name: "Allgemein", mehrzahl: "Allgemein", kurz: "Allgemein" },
  { art: "technik", name: "Technik", mehrzahl: "Technik", kurz: "Technik" },
  { art: "kern", name: "Kern (Treppenhaus/Lift)", mehrzahl: "Kerne", kurz: "Kern" },
];
```

`naechsteNummer` (Zeilen 141–145) ersetzen durch:

```ts
/** Kurzform des Geschosses für Bezeichnungen: EG → 0, OG3 → 3, UG1 → U1, sonst der Code. */
export function geschossKurz(code: string): string {
  if (code === "EG") return "0";
  const og = /^OG(\d+)$/.exec(code);
  if (og) return og[1];
  const ug = /^UG(\d+)$/.exec(code);
  return ug ? `U${ug[1]}` : code;
}
/** Bezeichnung nach Geschoss und laufender Nummer, z. B. «Büro 3.01» (Entscheid 3). */
export function nummerieren(geschoss: string, art: string, lfd: number): string {
  const basis = EINHEIT_ARTEN.find((a) => a.art === art)?.kurz ?? art;
  return `${basis} ${geschossKurz(geschoss)}.${String(lfd).padStart(2, "0")}`;
}
/** Nächste laufende Nummer im Geschoss: grösste vergebene plus 1, sonst Anzahl Einheiten plus 1. */
export function naechsteLfd(einheiten: readonly ZEinheit[], geschoss: string): number {
  const kurz = geschossKurz(geschoss).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(` ${kurz}\\.(\\d{2,})$`);
  const imGeschoss = einheiten.filter((e) => e.geschoss === geschoss);
  const max = imGeschoss.reduce((m, e) => { const r = re.exec(e.bezeichnung); return r ? Math.max(m, Number(r[1])) : m; }, 0);
  return max > 0 ? max + 1 : imGeschoss.length + 1;
}
```

`leererZustand` ersetzen:

```ts
export function leererZustand(liegenschaftId: string | null = null): AssistentZustand {
  return {
    version: 2, schritt: 1, huelleBearbeitbar: true,
    gebaeude: { id: null, liegenschaftId, name: "", grundform: "quader", stand: 0, geschosse: geschossCodes(0, 1).map((code) => ({ code })) },
    heizungStandard: { hk: "ja", fbh: "nein", tabs: "nein" }, standardGeraet: {},
    einheiten: [], bauteile: [], gruppen: [], vorlagen: [], zentraleRaum: null,
    automatik: true, gruppenVorgeschlagen: false, fbhWmz: false, fbhVerteilerAus: [], zaehler: 0,
  };
}
```

- [ ] **Step 4: `hauptverteiler`, `abgabenAbgleichen`, Reducer**

`hauptverteiler` (Zeile 110–115): Filter um `!t.fbh` ergänzen:
```ts
  const frei = verteilerListe(z).filter((t) => !t.fbh && !gruppeVonVerbraucher(z, t.schluessel));
```

`abgabenAbgleichen` (Zeilen 232–248) ersetzen:

```ts
/** Abgaben einer Einheit an die wirksame Heizung anpassen. Status folgt der Heizart: ja → bestätigt, unbekannt → vorgeschlagen (Entscheid 4). */
function abgabenAbgleichen(z: AssistentZustand, einheit: string, arten: readonly HeizArt[] = HEIZ_ARTEN): AssistentZustand {
  const e = z.einheiten.find((x) => x.schluessel === einheit);
  if (!e) return z;
  const w = wirksam(z, e);
  const erlaubt = ERLAUBT[e.art] ?? [];
  let neu = z;
  for (const art of arten) {
    const kat = ABGABE_VON[art];
    const vorhanden = abgabenVon(neu, einheit).filter((t) => t.katalogId === kat);
    if (w[art] === "nein" || !erlaubt.includes(kat)) { neu = entferneBauteile(neu, vorhanden.map((t) => t.schluessel)); continue; }
    const status: BauteilStatus = w[art] === "ja" ? "bestaetigt" : "vorgeschlagen";
    for (const t of vorhanden) if (t.status !== status) neu = ersetzeBauteil(neu, t.schluessel, (x) => ({ ...x, status }));
    if (w[art] === "ja" && vorhanden.length === 0 && e.art !== "technik") {
      const g = neu.standardGeraet[art];
      [neu] = neuesBauteil(neu, { katalogId: kat, standort: { einheit }, menge: null, status, hersteller: g?.hersteller ?? null, typ: g?.typ ?? null });
    }
  }
  return neu;
}
```

`export function reduziere(` umbenennen in `function reduziereKern(` und alle internen rekursiven Aufrufe `reduziere(` innerhalb `zustand.ts` (in `mitZentraleRaum`, `geschosse`, `technikraumNeu`) auf `reduziereKern(` umstellen: `grep -n "reduziere(" web/src/assistent/zustand.ts`. Danach neu anfügen:

```ts
/** Öffentlicher Reducer: Kernaktion, danach Ableitungen (Task 4 und 6 ergänzen Markierung und Ableitung). */
export function reduziere(z: AssistentZustand, a: Aktion): AssistentZustand {
  return reduziereKern(z, a);
}
```

Im Kern:
- `case "weiter"`: `z.schritt < 8` → `z.schritt < LETZTER_SCHRITT`.
- `case "einheitNeu"`: Bezeichnung `a.bezeichnung ?? nummerieren(a.geschoss, a.art, naechsteLfd(z2.einheiten, a.geschoss))`; Variable `name` entfällt.
- `case "abgabeWeissNicht"` ersetzen:
```ts
    case "abgabeWeissNicht": return ersetzeBauteil(z, a.schluessel, (t) => {
      const e = einheitVon(z, t);
      const art = HEIZ_ARTEN.find((x) => ABGABE_VON[x] === t.katalogId);
      const sicher = !e || !art || wirksam(z, e)[art] === "ja";
      return { ...t, menge: null, status: sicher ? "bestaetigt" : "vorgeschlagen" };
    });
```
- Aktion in den `Aktion`-Typ aufnehmen: `| { typ: "einheitAnzahl"; geschoss: string; art: string; anzahl: number }` und Fall ergänzen:
```ts
    case "einheitAnzahl": {
      const vorhanden = z.einheiten.filter((e) => e.geschoss === a.geschoss && e.art === a.art && !e.vorlage);
      const soll = Math.max(0, Math.min(50, Math.floor(a.anzahl)));
      if (soll > vorhanden.length) return reduziereKern(z, { typ: "einheitNeu", geschoss: a.geschoss, art: a.art, anzahl: soll - vorhanden.length });
      let neu = z;
      for (const e of vorhanden.slice(soll)) neu = reduziereKern(neu, { typ: "einheitLoeschen", schluessel: e.schluessel });
      return neu;
    }
```
- `case "unterverteiler"` (an): neues Bauteil mit `fbh: true` anlegen: `{ katalogId: K.verteiler, standort: { einheit: a.einheit }, menge: 1, status: "bestaetigt", versorgt: [a.einheit], fbh: true }`.

- [ ] **Step 5: `ausBeschreibung` und Entwurf-Migration**

`app/web/src/assistent/beschreibung.ts`, Rückgabe von `ausBeschreibung` (Zeilen 60–66):

```ts
  const automatik = zGruppen.length === 0 && !bauteile.some((t) => t.katalogId === K.verteiler);
  return {
    version: 2, schritt: 1, huelleBearbeitbar: false,
    gebaeude: { id: b.gebaeudeId ?? null, liegenschaftId: kopf.liegenschaftId ?? null, name: kopf.name ?? "", grundform: kopf.grundform ?? "quader",
      stand: b.stand, geschosse: geschosse.map((g) => ({ id: g.id, code: g.code })) },
    heizungStandard: { ...b.heizungStandard }, standardGeraet: {},
    einheiten, bauteile, gruppen: zGruppen, vorlagen: [], zentraleRaum,
    automatik, gruppenVorgeschlagen: !automatik, fbhWmz: false, fbhVerteilerAus: [], zaehler: 0,
  };
```

`app/web/src/assistent/sitzung.ts`: `entwurfLesen` ersetzen:

```ts
const SCHRITT_V1: Record<number, AssistentZustand["schritt"]> = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 5, 7: 6, 8: 7 };

/** Entwurfsinhalt auf Version 2 bringen (Entscheid 9). Unbekannte Inhalte → null. */
export function zustandMigrieren(daten: unknown): AssistentZustand | null {
  if (!daten || typeof daten !== "object") return null;
  const z = daten as Partial<AssistentZustand> & { version?: number; schritt?: number };
  if (z.version === 2) return z as AssistentZustand;
  if (z.version !== 1) return null;
  return {
    ...(z as unknown as AssistentZustand), version: 2, schritt: SCHRITT_V1[z.schritt ?? 1] ?? 1,
    standardGeraet: {}, vorlagen: [], automatik: false, gruppenVorgeschlagen: true, fbhWmz: false, fbhVerteilerAus: [],
  };
}

/** Entwurfsinhalt prüfen: nur Zustände dieses Gebäudes übernehmen (Version 1 wird migriert). */
export function entwurfLesen(daten: unknown, gebaeudeId: string): AssistentZustand | null {
  const z = zustandMigrieren(daten);
  if (!z || !z.gebaeude || z.gebaeude.id !== gebaeudeId || !Array.isArray(z.einheiten) || !Array.isArray(z.bauteile)) return null;
  return { ...z, vorlagen: z.vorlagen ?? [], huelleBearbeitbar: false };
}
```

- [ ] **Step 6: Schrittnummern in Oberfläche und Hinweisen**

`app/web/src/assistent/schritte/index.tsx`: Abbildung vorläufig (Task 11 ersetzt sie):

```tsx
import { Schritt6Unterverteiler } from "./Schritt6Unterverteiler";
function Schritt5Vorlaeufig(p: SchrittInhaltProps) { return <><Schritt5Gruppen {...p} /><Schritt6Unterverteiler {...p} /></>; }
export const SCHRITT_INHALT: Record<SchrittNr, ComponentType<SchrittInhaltProps>> = {
  1: Schritt1Gebaeude, 2: Schritt2Einheiten, 3: Schritt3Abgaben, 4: Schritt4Zentrale, 5: Schritt5Vorlaeufig, 6: Schritt7Teile, 7: Schritt8Pruefen,
};
```

`hinweise.ts`: in den Hinweisen `schritt: 6` → `schritt: 5` (UV ohne Gruppe, `gruppe_leer`): Zeile 41 `schritt: 5`, Zeile 44 `schritt: 5`.

`Schritt8Pruefen.tsx`: `["Unterverteiler", ..., 6]` → `["FBH-Verteiler", String(unterverteiler(z).length), 5]`, `["Weitere Teile", ..., 7]` → `6`.

`Assistent.tsx`: Import `LETZTER_SCHRITT` ergänzen; `z.schritt < 8` (Zeilen 259, 308) → `z.schritt < LETZTER_SCHRITT`.

- [ ] **Step 7: Bestehende Tests anpassen und laufen lassen**

Run: `npx vitest run src/assistent`
Erwartete Anpassungen (nur Erwartungswerte, keine Logik):
- Bezeichnungen `Büro 1`, `Büro 2`, … → `Büro 0.01` usw. (je Geschoss, EG = 0, OG1 = 1). Test «+3 Büros» in `schritte.test.ts` → `["Büro 0.01","Büro 0.02","Büro 0.03"]` bzw. Geschoss des Tests.
- `version: 1` in Zustands-Fixtures → `version: 2`; `leererZustand`-Vergleiche um neue Felder.
- Abgaben aus Standard `ja` haben `status: "bestaetigt"` statt `"vorgeschlagen"`.
- Schritt-Erwartungen `8` → `7` usw.
Expected: alle PASS.

- [ ] **Step 8: Typprüfung, ganze Web-Suite, Build**

Run: `npm run pruefe:typen && npx vitest run && npm run build`
Expected: grün; Web ≥ 391 Tests.

- [ ] **Step 9: Commit**

```bash
git add app/web/src
git commit -m "Assistent: Zustand v2 mit sieben Schritten, Nummerierung je Geschoss, Status nach Heizart"
```

---

### Task 4: Regelgeschoss-Vorlagen im Zustand

**Files:**
- Modify: `app/web/src/assistent/zustand.ts` (Aktionen, `vorlageAnwenden`, `abweichungMarkieren`, Abfragen)
- Create: `app/web/src/assistent/vorlagen.test.ts`

**Interfaces:**
- Consumes: Typen aus Task 3, `reduziereKern`, `nummerieren`, `abgabenAbgleichen`.
- Produces (Aktionen im `Aktion`-Typ):
  - `{ typ: "vorlageNeu"; name?: string; ausGeschoss?: string }`
  - `{ typ: "vorlageName"; vorlage: string; name: string }`
  - `{ typ: "platzAnzahl"; vorlage: string; art: string; anzahl: number }`
  - `{ typ: "platzAusnahme"; vorlage: string; platz: string; art: HeizArt; wert: Dreiwertig | null }`
  - `{ typ: "platzMenge"; vorlage: string; platz: string; art: HeizArt; menge: number | null }`
  - `{ typ: "vorlageZuweisen"; vorlage: string; geschoss: string; an: boolean }`
  - `{ typ: "vorlageLoeschen"; vorlage: string }`
  - `{ typ: "einheitZuruecksetzen"; einheit: string }`
  - `{ typ: "geschossZuruecksetzen"; geschoss: string }`
  - `{ typ: "geschossAusnahme"; geschoss: string; art: HeizArt; wert: Dreiwertig | null }`
- Produces (Abfragen): `vorlageVonGeschoss(z, code): ZVorlage | undefined`, `abweichungen(z, vorlage: string): number`, `platzWirksam(z, p: ZPlatz): Heizung`

- [ ] **Step 1: Failing tests schreiben**

`app/web/src/assistent/vorlagen.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { K } from "./bestueckung";
import { abweichungen, leererZustand, reduziere, vorlageVonGeschoss, type Aktion, type AssistentZustand } from "./zustand";

function haus(...aktionen: Aktion[]): AssistentZustand {
  let z = reduziere(leererZustand("l"), { typ: "geschosse", ug: 1, og: 5 });
  z = reduziere(z, { typ: "gebaeudeAngelegt", id: "00000000-0000-4000-8000-000000000900", stand: 0,
    geschosse: z.gebaeude.geschosse.map((g, i) => ({ id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`, code: g.code })) });
  for (const a of aktionen) z = reduziere(z, a);
  return z;
}
const v1 = (z: AssistentZustand) => z.vorlagen[0].schluessel;
const im = (z: AssistentZustand, code: string) => z.einheiten.filter((e) => e.geschoss === code);
/** Regelgeschoss mit 4 Büros, OG1–OG5 zugewiesen. */
function regelhaus(): AssistentZustand {
  let z = haus({ typ: "vorlageNeu", name: "Regel-OG" });
  z = reduziere(z, { typ: "platzAnzahl", vorlage: v1(z), art: "buero", anzahl: 4 });
  for (const g of ["OG1", "OG2", "OG3", "OG4", "OG5"]) z = reduziere(z, { typ: "vorlageZuweisen", vorlage: v1(z), geschoss: g, an: true });
  return z;
}

describe("Regelgeschoss", () => {
  it("rollt Plätze in allen zugewiesenen Geschossen aus und nummeriert", () => {
    const z = regelhaus();
    expect(z.einheiten).toHaveLength(20);
    expect(im(z, "OG3").map((e) => e.bezeichnung)).toEqual(["Büro 3.01", "Büro 3.02", "Büro 3.03", "Büro 3.04"]);
    expect(im(z, "OG3").every((e) => e.vorlage?.schluessel === v1(z))).toBe(true);
    expect(vorlageVonGeschoss(z, "OG3")?.name).toBe("Regel-OG");
    expect(z.bauteile.filter((t) => t.katalogId === K.hk)).toHaveLength(20);
  });
  it("Vorlage ändern wirkt in allen Geschossen", () => {
    let z = regelhaus();
    z = reduziere(z, { typ: "platzAnzahl", vorlage: v1(z), art: "kern", anzahl: 1 });
    expect(im(z, "OG5").map((e) => e.bezeichnung)).toContain("Kern 5.05");
    const p = z.vorlagen[0].plaetze[0].schluessel;
    z = reduziere(z, { typ: "platzMenge", vorlage: v1(z), platz: p, art: "hk", menge: 6 });
    const hkVon = (code: string) => z.bauteile.find((t) => t.katalogId === K.hk && "einheit" in t.standort && t.standort.einheit === im(z, code)[0].schluessel)!;
    expect(hkVon("OG1").menge).toBe(6);
    expect(hkVon("OG5").menge).toBe(6);
  });
  it("direkte Änderung markiert Abweichung; Vorlage überschreibt sie nicht; Zurücksetzen hebt sie auf", () => {
    let z = regelhaus();
    const e = im(z, "OG2")[0];
    z = reduziere(z, { typ: "einheitAendern", schluessel: e.schluessel, bezeichnung: "Empfang" });
    expect(z.einheiten.find((x) => x.schluessel === e.schluessel)!.abweichend).toEqual(["bezeichnung"]);
    z = reduziere(z, { typ: "platzAnzahl", vorlage: v1(z), art: "kern", anzahl: 1 });
    expect(z.einheiten.find((x) => x.schluessel === e.schluessel)!.bezeichnung).toBe("Empfang");
    expect(abweichungen(z, v1(z))).toBe(1);
    z = reduziere(z, { typ: "einheitZuruecksetzen", einheit: e.schluessel });
    expect(z.einheiten.find((x) => x.schluessel === e.schluessel)!.bezeichnung).toBe("Büro 2.01");
    expect(abweichungen(z, v1(z))).toBe(0);
  });
  it("Einheit in einem Geschoss löschen bleibt gelöscht (OG5 mit 3 Büros)", () => {
    let z = regelhaus();
    z = reduziere(z, { typ: "einheitLoeschen", schluessel: im(z, "OG5")[3].schluessel });
    z = reduziere(z, { typ: "platzMenge", vorlage: v1(z), platz: z.vorlagen[0].plaetze[0].schluessel, art: "hk", menge: 2 });
    expect(im(z, "OG5")).toHaveLength(3);
    expect(abweichungen(z, v1(z))).toBe(1);
    z = reduziere(z, { typ: "geschossZuruecksetzen", geschoss: "OG5" });
    expect(im(z, "OG5")).toHaveLength(4);
  });
  it("Ausnahme am Platz gilt für alle Geschosse; Ausnahme je Geschoss nur dort", () => {
    let z = regelhaus();
    z = reduziere(z, { typ: "geschossAusnahme", geschoss: "OG4", art: "fbh", wert: "ja" });
    expect(im(z, "OG4").every((e) => e.ausnahme.fbh === "ja" && e.abweichend?.includes("ausnahme"))).toBe(true);
    expect(im(z, "OG3").every((e) => e.ausnahme.fbh === undefined)).toBe(true);
    z = reduziere(z, { typ: "platzAusnahme", vorlage: v1(z), platz: z.vorlagen[0].plaetze[0].schluessel, art: "tabs", wert: "ja" });
    expect(im(z, "OG1")[0].ausnahme.tabs).toBe("ja");
    expect(im(z, "OG4")[0].ausnahme.tabs).toBeUndefined();
  });
  it("Vorlage aus bestehendem Geschoss übernimmt dessen Einheiten (IDs bleiben)", () => {
    let z = haus({ typ: "einheitAnzahl", geschoss: "OG1", art: "buero", anzahl: 2 });
    const vorher = im(z, "OG1").map((e) => e.schluessel);
    z = reduziere(z, { typ: "vorlageNeu", ausGeschoss: "OG1" });
    z = reduziere(z, { typ: "vorlageZuweisen", vorlage: v1(z), geschoss: "OG2", an: true });
    expect(im(z, "OG1").map((e) => e.schluessel)).toEqual(vorher);
    expect(im(z, "OG2").map((e) => e.bezeichnung)).toEqual(["Büro 2.01", "Büro 2.02"]);
  });
  it("Zuweisen nutzt freie Einheiten gleicher Art; überzählige bleiben eigenständig", () => {
    let z = haus({ typ: "einheitAnzahl", geschoss: "OG2", art: "buero", anzahl: 5 }, { typ: "vorlageNeu" });
    z = reduziere(z, { typ: "platzAnzahl", vorlage: v1(z), art: "buero", anzahl: 4 });
    z = reduziere(z, { typ: "vorlageZuweisen", vorlage: v1(z), geschoss: "OG2", an: true });
    expect(im(z, "OG2")).toHaveLength(5);
    expect(im(z, "OG2").filter((e) => e.vorlage)).toHaveLength(4);
  });
  it("Geschoss lösen und Vorlage löschen lassen Einheiten stehen", () => {
    let z = regelhaus();
    z = reduziere(z, { typ: "vorlageZuweisen", vorlage: v1(z), geschoss: "OG1", an: false });
    expect(im(z, "OG1")).toHaveLength(4);
    expect(im(z, "OG1").some((e) => e.vorlage)).toBe(false);
    z = reduziere(z, { typ: "vorlageLoeschen", vorlage: v1(z) });
    expect(z.vorlagen).toEqual([]);
    expect(z.einheiten).toHaveLength(20);
    expect(z.einheiten.some((e) => e.vorlage)).toBe(false);
  });
  it("ein Geschoss gehört höchstens einer Vorlage", () => {
    let z = regelhaus();
    z = reduziere(z, { typ: "vorlageNeu", name: "Attika" });
    const v2 = z.vorlagen[1].schluessel;
    z = reduziere(z, { typ: "platzAnzahl", vorlage: v2, art: "wohnung", anzahl: 1 });
    z = reduziere(z, { typ: "vorlageZuweisen", vorlage: v2, geschoss: "OG5", an: true });
    expect(z.vorlagen[0].geschosse).not.toContain("OG5");
    expect(vorlageVonGeschoss(z, "OG5")?.name).toBe("Attika");
  });
});
```

- [ ] **Step 2: Tests laufen lassen, müssen scheitern**

Run: `npx vitest run src/assistent/vorlagen.test.ts`
Expected: FAIL (Aktionen unbekannt).

- [ ] **Step 3: Aktionen in den Typ aufnehmen**

Im `Aktion`-Typ in `zustand.ts` die zehn Aktionen aus dem Interfaces-Block ergänzen.

- [ ] **Step 4: Hilfen und `vorlageAnwenden` schreiben**

Vor `reduziereKern` einfügen:

```ts
// --- Regelgeschoss ---
export const vorlageVonGeschoss = (z: AssistentZustand, code: string) => z.vorlagen.find((v) => v.geschosse.includes(code));
const vorlageVon = (z: AssistentZustand, s: string) => z.vorlagen.find((v) => v.schluessel === s);
const vorlageSetzen = (z: AssistentZustand, s: string, f: (v: ZVorlage) => ZVorlage): AssistentZustand =>
  ({ ...z, vorlagen: z.vorlagen.map((v) => (v.schluessel === s ? f(v) : v)) });
const einheitSetzen = (z: AssistentZustand, s: string, f: (e: ZEinheit) => ZEinheit): AssistentZustand =>
  ({ ...z, einheiten: z.einheiten.map((e) => (e.schluessel === s ? f(e) : e)) });
function ohneVorlage(e: ZEinheit): ZEinheit {
  const { vorlage: _v, abweichend: _a, ...rest } = e;
  return rest;
}
const gleicheAusnahme = (x: Partial<Heizung>, y: Partial<Heizung>) => HEIZ_ARTEN.every((a) => x[a] === y[a]);
export const platzWirksam = (z: AssistentZustand, p: ZPlatz): Heizung => ({ ...z.heizungStandard, ...p.ausnahme });

/** Einheiten mit Abweichung plus ausgelassene Plätze einer Vorlage. */
export function abweichungen(z: AssistentZustand, vorlage: string): number {
  const v = vorlageVon(z, vorlage);
  if (!v) return 0;
  return z.einheiten.filter((e) => e.vorlage?.schluessel === vorlage && (e.abweichend?.length ?? 0) > 0).length + v.ausgelassen.length;
}

function mengenVon(z: AssistentZustand, einheit: string): Partial<Record<HeizArt, number>> {
  const r: Partial<Record<HeizArt, number>> = {};
  for (const art of HEIZ_ARTEN) {
    const t = abgabenVon(z, einheit).find((x) => x.katalogId === ABGABE_VON[art]);
    if (t && t.menge !== null) r[art] = t.menge;
  }
  return r;
}

/**
 * Vorlage in allen zugewiesenen Geschossen durchsetzen: fehlende Plätze anlegen (freie Einheit gleicher Art bevorzugt),
 * Einheiten entfallener Plätze löschen (mit Abweichung: lösen), Felder ohne Abweichung übernehmen.
 */
function vorlageAnwenden(z: AssistentZustand, vs: string): AssistentZustand {
  const v = vorlageVon(z, vs);
  if (!v) return z;
  let neu = z;
  const verknuepfe = (s: string, platz: string) => { neu = einheitSetzen(neu, s, (e) => ({ ...e, vorlage: { schluessel: vs, platz }, abweichend: [] })); };
  for (const code of v.geschosse) {
    v.plaetze.forEach((p, i) => {
      if (v.ausgelassen.some((x) => x.geschoss === code && x.platz === p.schluessel)) return;
      if (neu.einheiten.some((e) => e.geschoss === code && e.vorlage?.schluessel === vs && e.vorlage.platz === p.schluessel)) return;
      const frei = neu.einheiten.find((e) => e.geschoss === code && !e.vorlage && e.art === p.art);
      if (frei) { verknuepfe(frei.schluessel, p.schluessel); return; }
      neu = reduziereKern(neu, { typ: "einheitNeu", geschoss: code, art: p.art, bezeichnung: nummerieren(code, p.art, i + 1) });
      verknuepfe(neu.einheiten[neu.einheiten.length - 1].schluessel, p.schluessel);
    });
  }
  const plaetze = new Set(v.plaetze.map((p) => p.schluessel));
  for (const e of neu.einheiten.filter((x) => x.vorlage?.schluessel === vs && !plaetze.has(x.vorlage.platz)))
    neu = e.abweichend?.length ? einheitSetzen(neu, e.schluessel, ohneVorlage) : reduziereKern(neu, { typ: "einheitLoeschen", schluessel: e.schluessel });
  v.plaetze.forEach((p, i) => {
    for (const e of neu.einheiten.filter((x) => x.vorlage?.schluessel === vs && x.vorlage.platz === p.schluessel)) {
      const ab = new Set(e.abweichend ?? []);
      if (!ab.has("art") && e.art !== p.art) neu = reduziereKern(neu, { typ: "einheitAendern", schluessel: e.schluessel, art: p.art });
      if (!ab.has("bezeichnung")) {
        const b = nummerieren(e.geschoss, p.art, i + 1);
        neu = einheitSetzen(neu, e.schluessel, (x) => (x.bezeichnung === b ? x : { ...x, bezeichnung: b }));
      }
      if (!ab.has("ausnahme") && !gleicheAusnahme(e.ausnahme, p.ausnahme)) {
        neu = einheitSetzen(neu, e.schluessel, (x) => ({ ...x, ausnahme: { ...p.ausnahme } }));
        neu = abgabenAbgleichen(neu, e.schluessel);
      }
      if (!ab.has("mengen")) for (const art of HEIZ_ARTEN) {
        const t = abgabenVon(neu, e.schluessel).find((x) => x.katalogId === ABGABE_VON[art]);
        const m = p.mengen[art] ?? null;
        if (!t || t.menge === m) continue;
        neu = m === null ? reduziereKern(neu, { typ: "abgabeWeissNicht", schluessel: t.schluessel }) : reduziereKern(neu, { typ: "abgabeAendern", schluessel: t.schluessel, menge: m });
      }
    }
  });
  return neu;
}

/** Ausnahme normalisieren: gleich wie Standard oder null → keine Ausnahme. */
function ausnahmeSetzen(aus: Partial<Heizung>, art: HeizArt, wert: Dreiwertig | null, standard: Heizung): Partial<Heizung> {
  const r = { ...aus };
  if (wert === null || wert === standard[art]) delete r[art]; else r[art] = wert;
  return r;
}

/** Direkte Änderungen an Einheiten eines Regelgeschosses als Abweichung merken (vor der Kernaktion). */
function abweichungMarkieren(z: AssistentZustand, a: Aktion): AssistentZustand {
  const markiere = (zz: AssistentZustand, einheit: string | undefined, feld: VorlageFeld) => {
    const e = einheit ? zz.einheiten.find((x) => x.schluessel === einheit) : undefined;
    if (!e?.vorlage || e.abweichend?.includes(feld)) return zz;
    return einheitSetzen(zz, e.schluessel, (x) => ({ ...x, abweichend: [...(x.abweichend ?? []), feld] }));
  };
  const einheitDes = (bauteil: string) => { const t = z.bauteile.find((x) => x.schluessel === bauteil); return t ? einheitVon(z, t)?.schluessel : undefined; };
  switch (a.typ) {
    case "einheitAendern": {
      let n = z;
      if (a.bezeichnung !== undefined) n = markiere(n, a.schluessel, "bezeichnung");
      if (a.art !== undefined) n = markiere(n, a.schluessel, "art");
      return n;
    }
    case "ausnahme": return markiere(z, a.einheit, "ausnahme");
    case "geschossAusnahme": return z.einheiten.filter((e) => e.geschoss === a.geschoss).reduce((n, e) => markiere(n, e.schluessel, "ausnahme"), z);
    case "abgabeAendern": return a.menge === undefined ? z : markiere(z, einheitDes(a.schluessel), "mengen");
    case "abgabeWeissNicht": return markiere(z, einheitDes(a.schluessel), "mengen");
    case "einheitLoeschen": {
      const e = z.einheiten.find((x) => x.schluessel === a.schluessel);
      if (!e?.vorlage) return z;
      const { schluessel, platz } = e.vorlage;
      return vorlageSetzen(z, schluessel, (v) => ({ ...v, ausgelassen: [...v.ausgelassen, { geschoss: e.geschoss, platz }] }));
    }
    default: return z;
  }
}
```

- [ ] **Step 5: Fälle im Kern ergänzen**

In `reduziereKern` vor der schliessenden Klammer des `switch`:

```ts
    case "vorlageNeu": {
      let [vs, neu] = neuerSchluessel(z);
      const name = a.name ?? (z.vorlagen.length ? `Regelgeschoss ${z.vorlagen.length + 1}` : "Regelgeschoss");
      const quelle = a.ausGeschoss ? z.einheiten.filter((e) => e.geschoss === a.ausGeschoss && !e.vorlage) : [];
      const plaetze: ZPlatz[] = [];
      const links: { einheit: string; platz: string; abweichend: VorlageFeld[] }[] = [];
      quelle.forEach((e, i) => {
        let ps: string;
        [ps, neu] = neuerSchluessel(neu);
        plaetze.push({ schluessel: ps, art: e.art, ausnahme: { ...e.ausnahme }, mengen: mengenVon(neu, e.schluessel) });
        links.push({ einheit: e.schluessel, platz: ps, abweichend: e.bezeichnung === nummerieren(e.geschoss, e.art, i + 1) ? [] : ["bezeichnung"] });
      });
      let r: AssistentZustand = neu;
      if (a.ausGeschoss) for (const v of r.vorlagen.filter((x) => x.geschosse.includes(a.ausGeschoss!)))
        r = reduziereKern(r, { typ: "vorlageZuweisen", vorlage: v.schluessel, geschoss: a.ausGeschoss, an: false });
      r = { ...r, vorlagen: [...r.vorlagen, { schluessel: vs, name, plaetze, geschosse: a.ausGeschoss ? [a.ausGeschoss] : [], ausgelassen: [] }] };
      for (const l of links) r = einheitSetzen(r, l.einheit, (e) => ({ ...e, vorlage: { schluessel: vs, platz: l.platz }, abweichend: l.abweichend }));
      return r;
    }
    case "vorlageName": return vorlageSetzen(z, a.vorlage, (v) => ({ ...v, name: a.name }));
    case "platzAnzahl": {
      const v = vorlageVon(z, a.vorlage);
      if (!v) return z;
      const soll = Math.max(0, Math.min(50, Math.floor(a.anzahl)));
      const gleiche = v.plaetze.filter((p) => p.art === a.art);
      let neu = z;
      let plaetze = v.plaetze;
      if (soll > gleiche.length) for (let i = gleiche.length; i < soll; i++) {
        const [ps, z2] = neuerSchluessel(neu);
        neu = z2;
        plaetze = [...plaetze, { schluessel: ps, art: a.art, ausnahme: {}, mengen: {} }];
      } else {
        const weg = new Set(gleiche.slice(soll).map((p) => p.schluessel));
        plaetze = plaetze.filter((p) => !weg.has(p.schluessel));
      }
      neu = vorlageSetzen(neu, a.vorlage, (x) => ({ ...x, plaetze, ausgelassen: x.ausgelassen.filter((o) => plaetze.some((p) => p.schluessel === o.platz)) }));
      return vorlageAnwenden(neu, a.vorlage);
    }
    case "platzAusnahme":
      return vorlageAnwenden(vorlageSetzen(z, a.vorlage, (v) => ({ ...v, plaetze: v.plaetze.map((p) =>
        (p.schluessel === a.platz ? { ...p, ausnahme: ausnahmeSetzen(p.ausnahme, a.art, a.wert, z.heizungStandard) } : p)) })), a.vorlage);
    case "platzMenge":
      return vorlageAnwenden(vorlageSetzen(z, a.vorlage, (v) => ({ ...v, plaetze: v.plaetze.map((p) => {
        if (p.schluessel !== a.platz) return p;
        const mengen = { ...p.mengen };
        if (a.menge === null) delete mengen[a.art]; else mengen[a.art] = Math.max(0, Math.round(a.menge));
        return { ...p, mengen };
      }) })), a.vorlage);
    case "vorlageZuweisen": {
      if (a.an) {
        let neu = z;
        for (const andere of z.vorlagen.filter((v) => v.schluessel !== a.vorlage && v.geschosse.includes(a.geschoss)))
          neu = reduziereKern(neu, { typ: "vorlageZuweisen", vorlage: andere.schluessel, geschoss: a.geschoss, an: false });
        neu = vorlageSetzen(neu, a.vorlage, (v) => (v.geschosse.includes(a.geschoss) ? v : { ...v, geschosse: [...v.geschosse, a.geschoss] }));
        return vorlageAnwenden(neu, a.vorlage);
      }
      const neu = vorlageSetzen(z, a.vorlage, (v) => ({ ...v, geschosse: v.geschosse.filter((g) => g !== a.geschoss), ausgelassen: v.ausgelassen.filter((o) => o.geschoss !== a.geschoss) }));
      return { ...neu, einheiten: neu.einheiten.map((e) => (e.geschoss === a.geschoss && e.vorlage?.schluessel === a.vorlage ? ohneVorlage(e) : e)) };
    }
    case "vorlageLoeschen":
      return { ...z, vorlagen: z.vorlagen.filter((v) => v.schluessel !== a.vorlage),
        einheiten: z.einheiten.map((e) => (e.vorlage?.schluessel === a.vorlage ? ohneVorlage(e) : e)) };
    case "einheitZuruecksetzen": {
      const e = z.einheiten.find((x) => x.schluessel === a.einheit);
      if (!e?.vorlage) return z;
      return vorlageAnwenden(einheitSetzen(z, e.schluessel, (x) => ({ ...x, abweichend: [] })), e.vorlage.schluessel);
    }
    case "geschossZuruecksetzen": {
      const v = vorlageVonGeschoss(z, a.geschoss);
      if (!v) return z;
      let neu = vorlageSetzen(z, v.schluessel, (x) => ({ ...x, ausgelassen: x.ausgelassen.filter((o) => o.geschoss !== a.geschoss) }));
      neu = { ...neu, einheiten: neu.einheiten.map((e) => (e.geschoss === a.geschoss && e.vorlage ? { ...e, abweichend: [] } : e)) };
      return vorlageAnwenden(neu, v.schluessel);
    }
    case "geschossAusnahme": {
      let neu = z;
      for (const e of z.einheiten.filter((x) => x.geschoss === a.geschoss))
        neu = reduziereKern(neu, { typ: "ausnahme", einheit: e.schluessel, art: a.art, wert: a.wert });
      return neu;
    }
```

`case "geschosse"`: nach dem Entfernen der Einheiten zusätzlich Vorlagen bereinigen:
```ts
      neu = { ...neu, vorlagen: neu.vorlagen.map((v) => ({ ...v, geschosse: v.geschosse.filter((g) => codes.has(g)), ausgelassen: v.ausgelassen.filter((o) => codes.has(o.geschoss)) })) };
```

Öffentlichen Reducer ersetzen:
```ts
export function reduziere(z: AssistentZustand, a: Aktion): AssistentZustand {
  if (a.typ === "laden") return a.zustand;
  return reduziereKern(abweichungMarkieren(z, a), a);
}
```

- [ ] **Step 6: Tests laufen lassen**

Run: `npx vitest run src/assistent`
Expected: PASS (neue und bestehende).

- [ ] **Step 7: Typprüfung**

Run: `npm run pruefe:typen`
Expected: ohne Fehler.

- [ ] **Step 8: Commit**

```bash
git add app/web/src/assistent/zustand.ts app/web/src/assistent/vorlagen.test.ts
git commit -m "Assistent: Regelgeschoss-Vorlagen mit Abweichungen, Ausnahme je Geschoss"
```

---

### Task 5: Hersteller/Typ am Gebäudestandard (H5)

**Files:**
- Modify: `app/web/src/assistent/zustand.ts` (Aktion `standardGeraet`, `abgabeNeu`, Hilfe `haeufigstesGeraet`)
- Modify: `app/web/src/assistent/beschreibung.ts` (`standardGeraet` beim Laden ableiten)
- Test: `app/web/src/assistent/zustand.test.ts`, `app/web/src/assistent/beschreibung.test.ts`

**Interfaces:**
- Produces: Aktion `{ typ: "standardGeraet"; art: HeizArt; hersteller?: string | null; geraetTyp?: string | null }`; `export function haeufigstesGeraet(bauteile: readonly ZBauteil[], katalogId: string): { hersteller: string | null; typ: string | null } | undefined`

- [ ] **Step 1: Failing tests schreiben**

In `zustand.test.ts`:

```ts
describe("Hersteller und Typ am Standard (H5)", () => {
  it("setzt alle Abgaben mit altem Standard, Ausnahmen bleiben, neue erben", () => {
    let z = neuesGebaeude({ typ: "einheitAnzahl", geschoss: "EG", art: "buero", anzahl: 3 });
    const hk = () => z.bauteile.filter((t) => t.katalogId === K.hk);
    z = reduziere(z, { typ: "abgabeAendern", schluessel: hk()[2].schluessel, hersteller: "Prolux" });
    z = reduziere(z, { typ: "standardGeraet", art: "hk", hersteller: "Zehnder" });
    z = reduziere(z, { typ: "standardGeraet", art: "hk", geraetTyp: "Charleston" });
    expect(hk().map((t) => [t.hersteller, t.typ])).toEqual([["Zehnder", "Charleston"], ["Zehnder", "Charleston"], ["Prolux", null]]);
    z = reduziere(z, { typ: "einheitNeu", geschoss: "EG", art: "buero" });
    expect(hk()[3].hersteller).toBe("Zehnder");
    z = reduziere(z, { typ: "standardGeraet", art: "hk", hersteller: "" });
    expect(hk()[0].hersteller).toBeNull();
  });
});
```

In `beschreibung.test.ts`:

```ts
import { haeufigstesGeraet } from "./zustand";
it("Standardgerät beim Laden = häufigste Angabe je Heizart", () => {
  const t = (hersteller: string | null, typ: string | null = null) => ({ katalogId: K.hk, hersteller, typ } as any);
  expect(haeufigstesGeraet([t("A"), t("B"), t("B"), t(null)], K.hk)).toEqual({ hersteller: "B", typ: null });
  expect(haeufigstesGeraet([t(null)], K.hk)).toBeUndefined();
});
```

(Falls `K` in `beschreibung.test.ts` fehlt: `import { K } from "./bestueckung";`.)

- [ ] **Step 2: Tests laufen lassen, müssen scheitern**

Run: `npx vitest run src/assistent/zustand.test.ts src/assistent/beschreibung.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementieren**

In `zustand.ts` (bei den Abfragen):

```ts
/** Häufigste Hersteller/Typ-Angabe einer Katalog-ID (Zeilen, nicht Stück); bei Gleichstand die zuerst gefundene. */
export function haeufigstesGeraet(bauteile: readonly ZBauteil[], katalogId: string): { hersteller: string | null; typ: string | null } | undefined {
  const zaehler = new Map<string, { hersteller: string | null; typ: string | null; n: number }>();
  for (const t of bauteile) {
    if (t.katalogId !== katalogId || (!t.hersteller && !t.typ)) continue;
    const k = JSON.stringify([t.hersteller, t.typ]);
    const x = zaehler.get(k);
    if (x) x.n++; else zaehler.set(k, { hersteller: t.hersteller, typ: t.typ, n: 1 });
  }
  let best: { hersteller: string | null; typ: string | null; n: number } | undefined;
  for (const x of zaehler.values()) if (!best || x.n > best.n) best = x;
  return best && { hersteller: best.hersteller, typ: best.typ };
}
```

Aktion in den Typ aufnehmen und im Kern:

```ts
    case "standardGeraet": {
      const alt = z.standardGeraet[a.art] ?? { hersteller: null, typ: null };
      const neuG = { hersteller: a.hersteller !== undefined ? (a.hersteller || null) : alt.hersteller, typ: a.geraetTyp !== undefined ? (a.geraetTyp || null) : alt.typ };
      const kat = ABGABE_VON[a.art];
      return { ...z, standardGeraet: { ...z.standardGeraet, [a.art]: neuG },
        bauteile: z.bauteile.map((t) => (t.katalogId === kat && t.hersteller === alt.hersteller && t.typ === alt.typ ? { ...t, hersteller: neuG.hersteller, typ: neuG.typ } : t)) };
    }
```

`case "abgabeNeu"`: Hersteller/Typ aus dem Standard übernehmen:
```ts
      const art = HEIZ_ARTEN.find((x) => ABGABE_VON[x] === a.katalogId);
      const g = art ? z.standardGeraet[art] : undefined;
      return neuesBauteil(z, { katalogId: a.katalogId, standort: { einheit: a.einheit }, menge: null, status: "vorgeschlagen", hersteller: g?.hersteller ?? null, typ: g?.typ ?? null })[0];
```

In `beschreibung.ts` (`ausBeschreibung`) statt `standardGeraet: {}`:
```ts
    standardGeraet: Object.fromEntries(HEIZ_ARTEN.flatMap((art) => { const g = haeufigstesGeraet(bauteile, ABGABE_VON[art]); return g ? [[art, g]] : []; })),
```
mit Import `import { ABGABE_VON, HEIZ_ARTEN, haeufigstesGeraet, type AssistentZustand, ... } from "./zustand";`.

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run src/assistent && npm run pruefe:typen`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/web/src/assistent
git commit -m "Assistent: Hersteller und Typ einmal am Gebaeudestandard"
```

---

### Task 6: FBH-Verteiler automatisch, Gruppen vorschlagen, `ableiten`

**Files:**
- Modify: `app/web/src/assistent/zustand.ts`
- Modify: `app/web/src/assistent/gruppen.test.ts` (bestehende Erwartungen prüfen)
- Create: `app/web/src/assistent/ableiten.test.ts`

**Interfaces:**
- Consumes: Typen aus Task 3, `reduziereKern`, `abweichungMarkieren` (Task 4).
- Produces:
  - `export const GRUPPEN_ART_VON: Readonly<Record<HeizArt, GruppenArt>>` = `{ hk: "ungeregelt", fbh: "beimisch", tabs: "einspritz" }`
  - `export function verbraucherDerArt(z: AssistentZustand, art: HeizArt): ZBauteil[]`
  - `export function fbhVerteilerAbleiten(z: AssistentZustand): AssistentZustand`
  - `export function gruppenVorschlagen(z: AssistentZustand): AssistentZustand`
  - `export function gruppenVerbraucherNachfuehren(z: AssistentZustand): AssistentZustand`
  - `export function fbhSpeisung(z: AssistentZustand): { gruppe: ZGruppe | null; anzahl: number }[]` (FBH-Verteiler je speisender Gruppe)
  - Aktionen: `{ typ: "gruppenVorschlagen" }`, `{ typ: "gruppeTeilen"; gruppe: string; geschosse: string[] }`, `{ typ: "sondergruppe"; einheit: string; heizart: HeizArt }`, `{ typ: "gruppeEntfernen"; gruppe: string }`, `{ typ: "gruppeFuerArt"; heizart: HeizArt }`, `{ typ: "fbhWmzAlle"; an: boolean }`

- [ ] **Step 1: Failing tests schreiben**

`app/web/src/assistent/ableiten.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { K } from "./bestueckung";
import { leererZustand, reduziere, unterverteiler, type Aktion, type AssistentZustand } from "./zustand";

function haus(...aktionen: Aktion[]): AssistentZustand {
  let z = reduziere(leererZustand("l"), { typ: "geschosse", ug: 1, og: 2 });
  z = reduziere(z, { typ: "gebaeudeAngelegt", id: "00000000-0000-4000-8000-000000000900", stand: 0,
    geschosse: z.gebaeude.geschosse.map((g, i) => ({ id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`, code: g.code })) });
  for (const a of aktionen) z = reduziere(z, a);
  return z;
}
/** UG1 Technik, EG Gastro, OG1/OG2 je 2 Büros; FBH in OG2 und Gastro; WP gewählt. */
const basis = (): AssistentZustand => haus(
  { typ: "einheitAnzahl", geschoss: "UG1", art: "technik", anzahl: 1 },
  { typ: "einheitAnzahl", geschoss: "EG", art: "gastro", anzahl: 1 },
  { typ: "einheitAnzahl", geschoss: "OG1", art: "buero", anzahl: 2 },
  { typ: "einheitAnzahl", geschoss: "OG2", art: "buero", anzahl: 2 },
  { typ: "geschossAusnahme", geschoss: "OG2", art: "fbh", wert: "ja" },
  { typ: "geschossAusnahme", geschoss: "EG", art: "fbh", wert: "ja" },
  { typ: "erzeuger", katalogId: K.waermepumpe },
);
const zu5 = (z: AssistentZustand) => reduziere(z, { typ: "schritt", nr: 5 });

describe("FBH-Verteiler automatisch (H4)", () => {
  it("je Einheit mit FBH ein vorgeschlagener FBH-Verteiler", () => {
    const z = basis();
    const uv = unterverteiler(z);
    expect(uv).toHaveLength(3);
    expect(uv.every((t) => t.auto && t.fbh && t.status === "vorgeschlagen")).toBe(true);
  });
  it("FBH weg → automatischer Verteiler weg; abgewählt bleibt abgewählt", () => {
    let z = basis();
    z = reduziere(z, { typ: "geschossAusnahme", geschoss: "EG", art: "fbh", wert: null });
    expect(unterverteiler(z)).toHaveLength(2);
    const e = z.einheiten.find((x) => x.geschoss === "OG2")!;
    z = reduziere(z, { typ: "unterverteiler", einheit: e.schluessel, an: false });
    z = reduziere(z, { typ: "standard", art: "tabs", wert: "nein" });
    expect(unterverteiler(z)).toHaveLength(1);
  });
  it("Wärmezähler an allen, auch an später entstehenden", () => {
    let z = reduziere(basis(), { typ: "fbhWmzAlle", an: true });
    const wmzAn = (zz: AssistentZustand) => unterverteiler(zz).every((t) => zz.bauteile.some((w) => w.katalogId === K.wmz && w.ort && "vorBauteil" in w.ort && w.ort.vorBauteil === t.schluessel));
    expect(wmzAn(z)).toBe(true);
    z = reduziere(z, { typ: "geschossAusnahme", geschoss: "OG1", art: "fbh", wert: "ja" });
    expect(unterverteiler(z)).toHaveLength(5);
    expect(wmzAn(z)).toBe(true);
  });
  it("Hauptverteiler ist nie ein FBH-Verteiler", () => {
    const z = zu5(basis());
    const haupt = z.bauteile.find((t) => t.katalogId === K.verteiler && !t.fbh)!;
    expect(z.gruppen.every((g) => g.verteiler === haupt.schluessel)).toBe(true);
  });
});

describe("Gruppen vorschlagen (H3)", () => {
  it("beim ersten Betreten von Schritt 5: je Heizart eine Gruppe, alle Verbraucher zugeordnet", () => {
    const z = zu5(basis());
    expect(z.gruppen.map((g) => [g.bezeichnung, g.art])).toEqual([["Heizkörper", "ungeregelt"], ["Fussbodenheizung", "beimisch"]]);
    const hk = z.gruppen[0], fbh = z.gruppen[1];
    expect(hk.verbraucher).toHaveLength(z.bauteile.filter((t) => t.katalogId === K.hk).length);
    expect(fbh.verbraucher.sort()).toEqual(unterverteiler(z).map((t) => t.schluessel).sort());
    expect(z.gruppenVorgeschlagen).toBe(true);
  });
  it("Regel-Gruppen folgen späteren Änderungen", () => {
    let z = zu5(basis());
    z = reduziere(z, { typ: "einheitAnzahl", geschoss: "OG1", art: "buero", anzahl: 3 });
    expect(z.gruppen[0].verbraucher).toHaveLength(z.bauteile.filter((t) => t.katalogId === K.hk).length);
  });
  it("Teilen nach Geschossen und Sondergruppe je Einheit", () => {
    let z = zu5(basis());
    z = reduziere(z, { typ: "gruppeTeilen", gruppe: z.gruppen[0].schluessel, geschosse: ["OG2"] });
    const og2 = z.gruppen.find((g) => g.regel?.geschosse?.includes("OG2"))!;
    expect(og2.bezeichnung).toBe("Heizkörper OG2");
    const gastro = z.einheiten.find((e) => e.art === "gastro")!;
    z = reduziere(z, { typ: "sondergruppe", einheit: gastro.schluessel, heizart: "fbh" });
    const sonder = z.gruppen.find((g) => g.regel?.einheit === gastro.schluessel)!;
    expect(sonder.verbraucher).toHaveLength(1);
    expect(z.gruppen.find((g) => g.bezeichnung === "Fussbodenheizung")!.verbraucher).toHaveLength(2);
  });
  it("Umhängen einzelner Verbraucher friert die Gruppen ein und bestätigt den FBH-Verteiler", () => {
    let z = zu5(basis());
    const uv = unterverteiler(z)[0];
    z = reduziere(z, { typ: "verbraucher", gruppe: z.gruppen[0].schluessel, bauteil: uv.schluessel, an: true });
    expect(z.gruppen[0].angefasst).toBe(true);
    expect(z.gruppen[1].angefasst).toBe(true);
    const t = z.bauteile.find((x) => x.schluessel === uv.schluessel)!;
    expect([t.auto, t.status]).toEqual([false, "bestaetigt"]);
    z = reduziere(z, { typ: "einheitAnzahl", geschoss: "OG1", art: "buero", anzahl: 3 });
    expect(z.gruppen[0].verbraucher).toContain(uv.schluessel);
  });
  it("Gebäude ohne Automatik bleibt wie bisher", () => {
    let z = basis();
    z = { ...z, automatik: false, gruppenVorgeschlagen: true };
    z = zu5(z);
    expect(z.gruppen).toHaveLength(0);
  });
  it("Zentrale-Raum vorbelegt, wenn genau eine Technik-Einheit existiert", () => {
    const z = haus({ typ: "einheitAnzahl", geschoss: "UG1", art: "technik", anzahl: 1 });
    expect(z.zentraleRaum).toBe(z.einheiten[0].schluessel);
  });
});
```

- [ ] **Step 2: Tests laufen lassen, müssen scheitern**

Run: `npx vitest run src/assistent/ableiten.test.ts`
Expected: FAIL.

- [ ] **Step 3: Funktionen schreiben**

In `zustand.ts` nach `bestueckungSetzen` einfügen:

```ts
// --- Automatik: FBH-Verteiler und Gruppen ---
export const GRUPPEN_ART_VON: Readonly<Record<HeizArt, GruppenArt>> = { hk: "ungeregelt", fbh: "beimisch", tabs: "einspritz" };
const gruppeSetzen = (z: AssistentZustand, s: string, f: (g: ZGruppe) => ZGruppe): AssistentZustand =>
  ({ ...z, gruppen: z.gruppen.map((g) => (g.schluessel === s ? f(g) : g)) });

/** Verbraucher einer Heizart: HK- und TABS-Abgaben; für FBH die FBH-Verteiler und FBH-Kreise in Einheiten ohne Verteiler. */
export function verbraucherDerArt(z: AssistentZustand, art: HeizArt): ZBauteil[] {
  if (art !== "fbh") return z.bauteile.filter((t) => t.katalogId === ABGABE_VON[art] && "einheit" in t.standort);
  const uv = unterverteiler(z);
  const mitUv = new Set(uv.flatMap((t) => t.versorgt));
  return [...uv, ...z.bauteile.filter((t) => t.katalogId === K.fbh && "einheit" in t.standort && !mitUv.has(t.standort.einheit))];
}

/** Je Einheit mit wirksamer FBH ein FBH-Verteiler (H4); unberührte entfallen, wenn die FBH wegfällt. */
export function fbhVerteilerAbleiten(z: AssistentZustand): AssistentZustand {
  if (!z.automatik) return z;
  const soll = new Set(unterverteilerVorschlaege(z).map((e) => e.schluessel).filter((s) => !z.fbhVerteilerAus.includes(s)));
  const einheitDes = (t: ZBauteil) => ("einheit" in t.standort ? t.standort.einheit : "");
  let neu = entferneBauteile(z, unterverteiler(z).filter((t) => t.auto && !soll.has(einheitDes(t))).map((t) => t.schluessel));
  for (const e of soll) {
    if (unterverteiler(neu).some((t) => einheitDes(t) === e)) continue;
    let s: string;
    [neu, s] = neuesBauteil(neu, { katalogId: K.verteiler, standort: { einheit: e }, menge: 1, status: "vorgeschlagen", versorgt: [e], auto: true, fbh: true });
    if (neu.fbhWmz) neu = reduziereKern(neu, { typ: "unterverteilerWmz", verteiler: s, an: true });
  }
  return neu;
}

function gruppeAnlegen(z: AssistentZustand, verteiler: string, regel: ZGruppenRegel, bezeichnung: string): [AssistentZustand, string] {
  const [s, z1] = neuerSchluessel(z);
  const nummer = Math.max(0, ...z1.gruppen.filter((g) => g.verteiler === verteiler).map((g) => g.nummer)) + 1;
  const art = GRUPPEN_ART_VON[regel.heizart];
  const neu: AssistentZustand = { ...z1, gruppen: [...z1.gruppen, { schluessel: s, verteiler, nummer, art, bezeichnung, verbraucher: [], regel }] };
  return [bestueckungSetzen(neu, s, art), s];
}

/** Je Heizart mit Verbrauchern eine Gruppe am Hauptverteiler (H3). */
export function gruppenVorschlagen(z: AssistentZustand): AssistentZustand {
  const arten = HEIZ_ARTEN.filter((a) => verbraucherDerArt(z, a).length > 0);
  if (arten.length === 0) return z;
  let [neu, v] = mitHauptverteiler(z);
  if (!v) return neu;
  for (const art of arten) [neu] = gruppeAnlegen(neu, v, { heizart: art }, HEIZ_NAME[art]);
  return gruppenVerbraucherNachfuehren({ ...neu, gruppenVorgeschlagen: true });
}

/** Regel-Gruppen (nicht angefasst) erhalten ihre Verbraucher: Einheit-Regel vor Geschoss-Regel vor Rest-Gruppe. */
export function gruppenVerbraucherNachfuehren(z: AssistentZustand): AssistentZustand {
  const regelGruppen = z.gruppen.filter((g) => g.regel && !g.angefasst);
  if (regelGruppen.length === 0) return z;
  const fest = new Set(z.gruppen.filter((g) => !(g.regel && !g.angefasst)).flatMap((g) => g.verbraucher));
  const zuteilung = new Map<string, string[]>(regelGruppen.map((g) => [g.schluessel, []]));
  for (const art of HEIZ_ARTEN) for (const t of verbraucherDerArt(z, art)) {
    if (fest.has(t.schluessel)) continue;
    const einheit = einheitVon(z, t)?.schluessel;
    const code = geschossVon(z, t);
    const kand = regelGruppen.filter((g) => g.regel!.heizart === art);
    const g = kand.find((x) => x.regel!.einheit !== undefined && x.regel!.einheit === einheit)
      ?? kand.find((x) => x.regel!.einheit === undefined && code !== undefined && (x.regel!.geschosse?.includes(code) ?? false))
      ?? kand.find((x) => x.regel!.einheit === undefined && x.regel!.geschosse === undefined);
    if (g) zuteilung.get(g.schluessel)!.push(t.schluessel);
  }
  const gruppen = z.gruppen.map((g) => {
    const v = zuteilung.get(g.schluessel);
    return v && (v.length !== g.verbraucher.length || v.some((x, i) => x !== g.verbraucher[i])) ? { ...g, verbraucher: v } : g;
  });
  return versorgungNachfuehren({ ...z, gruppen });
}

/** FBH-Verteiler je speisender Gruppe (für den Satz «9 FBH-Verteiler an Gruppe …»). */
export function fbhSpeisung(z: AssistentZustand): { gruppe: ZGruppe | null; anzahl: number }[] {
  const m = new Map<ZGruppe | null, number>();
  for (const t of unterverteiler(z)) { const g = gruppeVonVerbraucher(z, t.schluessel) ?? null; m.set(g, (m.get(g) ?? 0) + 1); }
  return [...m].map(([gruppe, anzahl]) => ({ gruppe, anzahl }));
}

/** Nach jeder Aktion: Zentrale-Raum vorbelegen, FBH-Verteiler, einmaliger Gruppenvorschlag, Regel-Verbraucher. */
function ableiten(z: AssistentZustand): AssistentZustand {
  let neu = z;
  if (!neu.zentraleRaum) {
    const technik = neu.einheiten.filter((e) => e.art === "technik");
    if (technik.length === 1) neu = { ...neu, zentraleRaum: technik[0].schluessel };
  }
  neu = fbhVerteilerAbleiten(neu);
  if (neu.automatik && !neu.gruppenVorgeschlagen && neu.schritt >= 5 && neu.gruppen.length === 0) neu = gruppenVorschlagen(neu);
  return gruppenVerbraucherNachfuehren(neu);
}
```

- [ ] **Step 4: Aktionen, Markierung, Reducer**

Aktionen aus dem Interfaces-Block in den `Aktion`-Typ aufnehmen. Kernfälle:

```ts
    case "gruppenVorschlagen": return gruppenVorschlagen(z);
    case "gruppeTeilen": {
      const g = z.gruppen.find((x) => x.schluessel === a.gruppe);
      if (!g?.regel || a.geschosse.length === 0) return z;
      const art = g.regel.heizart;
      const codes = [...a.geschosse].sort((x, y) => geschossRang(x) - geschossRang(y));
      let neu: AssistentZustand = { ...z, gruppen: z.gruppen.map((x) => (x.regel?.heizart === art && x.regel.geschosse
        ? { ...x, regel: { ...x.regel, geschosse: x.regel.geschosse.filter((c) => !codes.includes(c)) } } : x)) };
      const titel = `${HEIZ_NAME[art]} ${codes.length > 3 ? `${codes[0]}–${codes[codes.length - 1]}` : codes.join(", ")}`;
      [neu] = gruppeAnlegen(neu, g.verteiler, { heizart: art, geschosse: codes }, titel);
      return neu;
    }
    case "sondergruppe": {
      const e = z.einheiten.find((x) => x.schluessel === a.einheit);
      const [z1, v] = mitHauptverteiler(z);
      if (!e || !v) return z1;
      return gruppeAnlegen(z1, v, { heizart: a.heizart, einheit: a.einheit }, `${HEIZ_NAME[a.heizart]} ${e.bezeichnung}`)[0];
    }
    case "gruppeFuerArt": {
      const [z1, v] = mitHauptverteiler(z);
      return v ? gruppeAnlegen(z1, v, { heizart: a.heizart }, HEIZ_NAME[a.heizart])[0] : z1;
    }
    case "gruppeEntfernen":
      return entferneBauteile({ ...z, gruppen: z.gruppen.filter((g) => g.schluessel !== a.gruppe) }, zubehoerVon(z, a.gruppe).map((t) => t.schluessel));
    case "fbhWmzAlle": {
      let neu: AssistentZustand = { ...z, fbhWmz: a.an };
      for (const t of unterverteiler(neu)) neu = reduziereKern(neu, { typ: "unterverteilerWmz", verteiler: t.schluessel, an: a.an });
      return neu;
    }
```

`case "unterverteiler"` am Anfang: `fbhVerteilerAus` nachführen:
```ts
    case "unterverteiler": {
      const aus = a.an ? z.fbhVerteilerAus.filter((s) => s !== a.einheit) : [...new Set([...z.fbhVerteilerAus, a.einheit])];
      const z0 = { ...z, fbhVerteilerAus: aus };
      const vorhanden = unterverteiler(z0).filter((t) => "einheit" in t.standort && t.standort.einheit === a.einheit);
      if (!a.an) return entferneBauteile(z0, vorhanden.map((t) => t.schluessel));
      if (vorhanden.length) return z0;
      return neuesBauteil(z0, { katalogId: K.verteiler, standort: { einheit: a.einheit }, menge: 1, status: "bestaetigt", versorgt: [a.einheit], fbh: true })[0];
    }
```

In `abweichungMarkieren` (Task 4) zusätzliche Fälle:

```ts
    case "verbraucher": {
      const alt = gruppeVonVerbraucher(z, a.bauteil);
      let n = z;
      for (const s of [a.gruppe, alt?.schluessel]) if (s) n = gruppeSetzen(n, s, (g) => ({ ...g, angefasst: true }));
      return ersetzeBauteil(n, a.bauteil, (t) => (t.auto ? { ...t, auto: false, status: "bestaetigt" } : t));
    }
    case "unterverteilerWmz":
      return ersetzeBauteil(z, a.verteiler, (t) => (t.auto ? { ...t, auto: false, status: "bestaetigt" } : t));
```

Hinweis: `fbhWmzAlle` ruft `unterverteilerWmz` über `reduziereKern` auf, also ohne Markierung – die Verteiler bleiben dabei `auto`.

Öffentlicher Reducer:
```ts
export function reduziere(z: AssistentZustand, a: Aktion): AssistentZustand {
  if (a.typ === "laden") return a.zustand;
  return ableiten(reduziereKern(abweichungMarkieren(z, a), a));
}
```

Schritt-5-Hinweise ohne Gruppe (`hinweise.ts`, Schleife Zeilen 35–39): FBH-Kreise in Einheiten mit Verteiler überspringen, HK/TABS dort nicht mehr:
```ts
    if (t.katalogId === K.fbh && "einheit" in t.standort && uv.has(t.standort.einheit)) continue;
```
statt `if ("einheit" in t.standort && uv.has(t.standort.einheit)) continue;` (Import `K` aus `./bestueckung`).

- [ ] **Step 5: Tests laufen lassen**

Run: `npx vitest run src/assistent`
Expected: neue Tests PASS. Bestehende Tests in `gruppen.test.ts`, `beschreibung.test.ts`, `schritte.test.ts`, die FBH-Einheiten anlegen, sehen jetzt automatische FBH-Verteiler; Erwartungen dort anpassen ODER im Test-Helfer `automatik: false` setzen, wenn der Test das alte manuelle Verhalten prüft. Regel: Tests zu Schritt 6 alt (manuelle Unterverteiler) → `automatik: false`; Tests zu Beschreibung/Gruppen-Grundlagen → Erwartung an neue Anzahl anpassen.

- [ ] **Step 6: Typprüfung, Suite**

Run: `npm run pruefe:typen && npx vitest run`
Expected: grün.

- [ ] **Step 7: Commit**

```bash
git add app/web/src/assistent
git commit -m "Assistent: FBH-Verteiler automatisch, Gruppen je Heizart vorschlagen, teilen und Sondergruppe"
```

---

### Task 7: Vorlagen laden und übernehmen (Web)

**Files:**
- Create: `app/web/src/assistent/vorlagen.ts`
- Modify: `app/web/src/assistent/sitzung.ts` (API, `ladeAssistent`)
- Modify: `app/web/src/seiten/Assistent.tsx:107-112, 223-237` (Meldung, Übernehmen)
- Test: `app/web/src/assistent/vorlagen.test.ts` (Abschnitt anfügen), `app/web/src/assistent/sitzung.test.ts`

**Interfaces:**
- Consumes: `zuBeschreibungMitPositionen(z).positionen.einheiten` (Schlüssel in Beschreibungsreihenfolge), Backend-Format aus Task 1.
- Produces:
  - `export interface VorlagenEingabe` (gleich Backend) und `export interface VorlagenGespeichert` in `vorlagen.ts`
  - `export function vorlagenZurEingabe(z: AssistentZustand, positionen: Positionen): VorlagenEingabe | null`
  - `export function vorlagenEinlesen(z: AssistentZustand, daten: unknown): { zustand: AssistentZustand; abgeloest: boolean }`
  - `AssistentApi.ladeVorlagen(id: string): Promise<unknown | null>`; `AssistentApi.uebernehmen(id: string, b: BeschreibungEingabe, vorlagen: VorlagenEingabe | null): Promise<BeschreibungEingabe>`
  - `Geladen` + `abgeloest: boolean`

- [ ] **Step 1: Failing tests schreiben**

In `vorlagen.test.ts` anfügen:

```ts
import { zuBeschreibungMitPositionen } from "./beschreibung";
import { vorlagenEinlesen, vorlagenZurEingabe } from "./vorlagen";

describe("Vorlagen ⇄ API", () => {
  it("Eingabe: Geschoss-IDs, Einheit per Index (neu) oder ID (gespeichert)", () => {
    let z = regelhaus();
    z = { ...z, einheiten: z.einheiten.map((e, i) => (i === 0 ? { ...e, id: "00000000-0000-4000-8000-000000000777" } : e)) };
    const { positionen } = zuBeschreibungMitPositionen(z);
    const v = vorlagenZurEingabe(z, positionen)!;
    const og1 = z.gebaeude.geschosse.find((g) => g.code === "OG1")!.id;
    expect(v.vorlagen[0].geschosse[0]).toBe(og1);
    expect(v.zuordnung[0].einheit).toEqual({ einheitId: "00000000-0000-4000-8000-000000000777" });
    expect(v.zuordnung[1].einheit).toEqual({ einheitIndex: positionen.einheiten.indexOf(z.einheiten[1].schluessel) });
    expect(v.zuordnung).toHaveLength(20);
  });
  it("ohne Vorlagen null", () => {
    expect(vorlagenZurEingabe(haus(), zuBeschreibungMitPositionen(haus()).positionen)).toBeNull();
  });
  it("Einlesen: gespeicherte IDs → Schlüssel; Veraltetes wird abgelöst", () => {
    let z = regelhaus();
    z = { ...z, einheiten: z.einheiten.map((e, i) => ({ ...e, id: `00000000-0000-4000-8000-${String(500 + i).padStart(12, "0")}`, schluessel: `00000000-0000-4000-8000-${String(500 + i).padStart(12, "0")}` })) };
    const gespeichert = {
      version: 1,
      vorlagen: [{ ...z.vorlagen[0], geschosse: [...z.vorlagen[0].geschosse.map((c) => z.gebaeude.geschosse.find((g) => g.code === c)!.id), "00000000-0000-4000-8000-000000000999"], ausgelassen: [] }],
      zuordnung: { [z.einheiten[0].id!]: { vorlage: z.vorlagen[0].schluessel, platz: z.vorlagen[0].plaetze[0].schluessel, abweichend: ["bezeichnung"] },
        "00000000-0000-4000-8000-000000000888": { vorlage: z.vorlagen[0].schluessel, platz: z.vorlagen[0].plaetze[0].schluessel, abweichend: [] } },
    };
    const ohne = { ...z, vorlagen: [], einheiten: z.einheiten.map(({ vorlage: _v, abweichend: _a, ...e }) => e) };
    const r = vorlagenEinlesen(ohne, gespeichert);
    expect(r.abgeloest).toBe(true);
    expect(r.zustand.vorlagen[0].geschosse).toEqual(["OG1", "OG2", "OG3", "OG4", "OG5"]);
    expect(r.zustand.einheiten[0].vorlage?.schluessel).toBe(z.vorlagen[0].schluessel);
    expect(r.zustand.einheiten[0].abweichend).toEqual(["bezeichnung"]);
  });
  it("Einlesen: unbekannte Version oder Unsinn → unverändert, nicht abgelöst bei null", () => {
    const z = haus();
    expect(vorlagenEinlesen(z, null)).toEqual({ zustand: z, abgeloest: false });
    expect(vorlagenEinlesen(z, { version: 7 }).abgeloest).toBe(true);
  });
});
```

In `sitzung.test.ts` (`fakeApi` um `ladeVorlagen: async () => null` ergänzen):

```ts
it("lädt Vorlagen zur Beschreibung, Fehler beim Laden der Vorlagen sind kein Abbruch", async () => {
  const api = fakeApi({ ladeEntwurf: async () => null, ladeVorlagen: async () => { throw new Error("weg"); } });
  const r = await ladeAssistent(api, ID, {});
  expect(r.abgeloest).toBe(false);
  expect(r.zustand.vorlagen).toEqual([]);
});
```

- [ ] **Step 2: Tests laufen lassen, müssen scheitern**

Run: `npx vitest run src/assistent/vorlagen.test.ts src/assistent/sitzung.test.ts`
Expected: FAIL.

- [ ] **Step 3: `vorlagen.ts` schreiben**

```ts
import type { EinheitVerweis, HeizArt, Heizung } from "../typen";
import type { Positionen } from "./beschreibung";
import type { AssistentZustand, VorlageFeld, ZVorlage } from "./zustand";

/** Spiegel von app/src/welt/vorlage.ts (Geschosse als IDs). */
interface VorlageDaten { schluessel: string; name: string; plaetze: { schluessel: string; art: string; ausnahme: Partial<Heizung>; mengen: Partial<Record<HeizArt, number>> }[]; geschosse: string[]; ausgelassen: { geschoss: string; platz: string }[] }
export interface VorlagenEingabe { version: 1; vorlagen: VorlageDaten[]; zuordnung: { einheit: EinheitVerweis; vorlage: string; platz: string; abweichend: VorlageFeld[] }[] }
export interface VorlagenGespeichert { version: 1; vorlagen: VorlageDaten[]; zuordnung: Record<string, { vorlage: string; platz: string; abweichend: VorlageFeld[] }> }

const FELDER = new Set<VorlageFeld>(["art", "bezeichnung", "ausnahme", "mengen"]);

/** Zustand → Feld `vorlagen` für PUT Beschreibung; null ohne Vorlagen (Backend löscht dann den Eintrag). */
export function vorlagenZurEingabe(z: AssistentZustand, positionen: Positionen): VorlagenEingabe | null {
  if (z.vorlagen.length === 0) return null;
  const id = new Map(z.gebaeude.geschosse.filter((g) => g.id).map((g) => [g.code, g.id!]));
  const zuId = (codes: string[]) => codes.flatMap((c) => (id.has(c) ? [id.get(c)!] : []));
  const zuordnung: VorlagenEingabe["zuordnung"] = [];
  for (const e of z.einheiten) {
    if (!e.vorlage) continue;
    const i = positionen.einheiten.indexOf(e.schluessel);
    if (i < 0) continue;
    zuordnung.push({ einheit: e.id !== undefined ? { einheitId: e.id } : { einheitIndex: i }, vorlage: e.vorlage.schluessel, platz: e.vorlage.platz, abweichend: [...(e.abweichend ?? [])] });
  }
  return {
    version: 1,
    vorlagen: z.vorlagen.map((v) => ({ schluessel: v.schluessel, name: v.name, plaetze: v.plaetze.map((p) => ({ ...p })), geschosse: zuId(v.geschosse),
      ausgelassen: v.ausgelassen.flatMap((o) => (id.has(o.geschoss) ? [{ geschoss: id.get(o.geschoss)!, platz: o.platz }] : [])) })),
    zuordnung,
  };
}

/**
 * Gespeicherte Vorlagen in einen aus der Beschreibung geladenen Zustand einlesen (Einheit-Schlüssel = ID).
 * Fehlende Geschosse, Einheiten, Plätze oder eine fremde Version werden verworfen und als «abgelöst» gemeldet.
 */
export function vorlagenEinlesen(z: AssistentZustand, daten: unknown): { zustand: AssistentZustand; abgeloest: boolean } {
  if (daten === null || daten === undefined) return { zustand: z, abgeloest: false };
  const d = daten as Partial<VorlagenGespeichert>;
  if (d.version !== 1 || !Array.isArray(d.vorlagen) || !d.zuordnung || typeof d.zuordnung !== "object") return { zustand: z, abgeloest: true };
  let abgeloest = false;
  const code = new Map(z.gebaeude.geschosse.filter((g) => g.id).map((g) => [g.id!, g.code]));
  const zuCode = (ids: string[]) => ids.flatMap((i) => { const c = code.get(i); if (!c) abgeloest = true; return c ? [c] : []; });
  const vorlagen: ZVorlage[] = d.vorlagen.map((v) => ({
    schluessel: v.schluessel, name: v.name, plaetze: v.plaetze.map((p) => ({ ...p, ausnahme: { ...p.ausnahme }, mengen: { ...p.mengen } })),
    geschosse: zuCode(v.geschosse),
    ausgelassen: v.ausgelassen.flatMap((o) => { const c = code.get(o.geschoss); return c ? [{ geschoss: c, platz: o.platz }] : []; }),
  }));
  const plaetze = new Map(vorlagen.map((v) => [v.schluessel, new Set(v.plaetze.map((p) => p.schluessel))]));
  const vorhanden = new Set(z.einheiten.map((e) => e.schluessel));
  for (const id of Object.keys(d.zuordnung)) if (!vorhanden.has(id)) abgeloest = true;
  const einheiten = z.einheiten.map((e) => {
    const x = d.zuordnung![e.schluessel];
    if (!x) return e;
    const v = vorlagen.find((y) => y.schluessel === x.vorlage);
    if (!plaetze.get(x.vorlage)?.has(x.platz) || !v?.geschosse.includes(e.geschoss)) { abgeloest = true; return e; }
    return { ...e, vorlage: { schluessel: x.vorlage, platz: x.platz }, abweichend: x.abweichend.filter((f) => FELDER.has(f)) };
  });
  return { zustand: { ...z, vorlagen, einheiten }, abgeloest };
}
```

- [ ] **Step 4: Sitzung und Seite anpassen**

`sitzung.ts`:
- Interface `AssistentApi`: `ladeVorlagen(id: string): Promise<unknown | null>;` und `uebernehmen(id: string, b: BeschreibungEingabe, vorlagen: VorlagenEingabe | null): Promise<BeschreibungEingabe>;`
- `httpApi`:
```ts
  async ladeVorlagen(id) {
    try { return await holeJson<unknown>(`/api/struktur/gebaeude/${id}/vorlagen`); }
    catch (e) { if (e instanceof ApiFehler && e.status === 404) return null; throw e; }
  },
  uebernehmen: (id, b, vorlagen) => ersetzeJson<BeschreibungEingabe>(`/api/struktur/gebaeude/${id}/beschreibung`, vorlagen ? { ...b, vorlagen } : b),
```
- `Geladen`: `export interface Geladen { zustand: AssistentZustand; entwurfStand: number; ausEntwurf: boolean; abgeloest: boolean }`
- `ladeAssistent`:
```ts
  if (entwurf && ausEntwurf) {
    return { zustand: { ...ausEntwurf, gebaeude: { ...ausEntwurf.gebaeude, name: kopf.name || ausEntwurf.gebaeude.name } }, entwurfStand: entwurf.stand, ausEntwurf: true, abgeloest: false };
  }
  const b = await api.ladeBeschreibung(gebaeudeId);
  const v = await api.ladeVorlagen(gebaeudeId).catch(() => null);
  const r = vorlagenEinlesen(ausBeschreibung(b, kopf), v);
  return { zustand: r.zustand, entwurfStand: entwurf?.stand ?? 0, ausEntwurf: false, abgeloest: r.abgeloest };
```
- `konfliktLaden` übernimmt `abgeloest` unverändert (Spread).
- Alle `fakeApi`-Helfer in Tests um `ladeVorlagen` ergänzen: `grep -rn "fakeApi\|AssistentApi = {" web/src`.

`Assistent.tsx`:
- nach `if (g.ausEntwurf) setMeldung(...)`: `else if (g.abgeloest) setMeldung("Ein Teil der Regelgeschoss-Zuordnung passte nicht mehr zum Gebäude und wurde gelöst.");`
- `uebernehmen()`: 
```ts
      const { beschreibung, positionen } = zuBeschreibungMitPositionen(z);
      await api.uebernehmen(id, beschreibung, vorlagenZurEingabe(z, positionen));
```
mit Import `import { vorlagenZurEingabe } from "../assistent/vorlagen";`.

- [ ] **Step 5: Tests, Typprüfung, Build**

Run: `npx vitest run && npm run pruefe:typen && npm run build`
Expected: grün.

- [ ] **Step 6: Commit**

```bash
git add app/web/src
git commit -m "Assistent: Regelgeschosse laden und mit der Beschreibung uebernehmen"
```

---

### Task 8: Prüfen in Klartext und Begriffe

**Files:**
- Modify: `app/web/src/assistent/hinweise.ts` (`pruefHinweise` gebündelt, neue `zusammenfassung`)
- Modify: `app/web/src/assistent/bestueckung.ts:60` (Name Verteiler)
- Modify: `app/web/src/dashboard/daten.ts:4-9,18-20,63` (Namen, `symbolName`)
- Modify: `app/web/src/seiten/Twin.tsx:193`
- Test: `app/web/src/assistent/hinweise.test.ts` (neu), `app/web/src/dashboard/*.test.ts` (Erwartungen)

**Interfaces:**
- Produces:
  - `export function zusammenfassung(z: AssistentZustand, katalog?: readonly KatalogEintrag[] | null): { titel: string; text: string; schritt: SchrittNr }[]`
  - `pruefHinweise` liefert gebündelte Klartext-Hinweise (Codes `menge_offen`, `ohne_gruppe`, `gruppe_fehlt`).
  - `export function symbolName(welt: Welt, s: WeltSymbol, katalog?: KatalogEintrag[]): string` in `dashboard/daten.ts`

- [ ] **Step 1: Failing tests schreiben**

`app/web/src/assistent/hinweise.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { K } from "./bestueckung";
import { pruefHinweise, zusammenfassung } from "./hinweise";
import { leererZustand, reduziere, type Aktion, type AssistentZustand } from "./zustand";
import { zuBeschreibungMitPositionen } from "./beschreibung";

function haus(...aktionen: Aktion[]): AssistentZustand {
  let z = reduziere(leererZustand("l"), { typ: "geschosse", ug: 1, og: 2 });
  z = reduziere(z, { typ: "gebaeudeAngelegt", id: "00000000-0000-4000-8000-000000000900", stand: 0,
    geschosse: z.gebaeude.geschosse.map((g, i) => ({ id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`, code: g.code })) });
  for (const a of aktionen) z = reduziere(z, a);
  return z;
}
const hinweise = (z: AssistentZustand) => pruefHinweise(z, null, zuBeschreibungMitPositionen(z).positionen).map((h) => h.text);

describe("Prüfen in Klartext (H7)", () => {
  it("fehlende Mengen gebündelt", () => {
    const z = haus({ typ: "einheitAnzahl", geschoss: "OG1", art: "buero", anzahl: 3 }, { typ: "einheitAnzahl", geschoss: "UG1", art: "technik", anzahl: 1 }, { typ: "erzeuger", katalogId: K.waermepumpe });
    expect(hinweise(z)).toContain("Für 3 Einheiten fehlt die Anzahl Heizkörper.");
  });
  it("Verbraucher ohne Gruppe gebündelt, eine Zeile je Bauteilart", () => {
    const z = haus({ typ: "einheitAnzahl", geschoss: "OG1", art: "buero", anzahl: 4 }, { typ: "einheitAnzahl", geschoss: "UG1", art: "technik", anzahl: 1 }, { typ: "erzeuger", katalogId: K.waermepumpe });
    expect(hinweise(z)).toContain("4 Heizkörper gehören zu keiner Gruppe.");
  });
  it("Heizart ohne Gruppe", () => {
    let z = haus({ typ: "einheitAnzahl", geschoss: "OG1", art: "buero", anzahl: 1 }, { typ: "einheitAnzahl", geschoss: "UG1", art: "technik", anzahl: 1 }, { typ: "erzeuger", katalogId: K.waermepumpe });
    z = reduziere(z, { typ: "schritt", nr: 5 });
    z = reduziere(z, { typ: "geschossAusnahme", geschoss: "OG1", art: "fbh", wert: "ja" });
    expect(hinweise(z)).toContain("Für Fussbodenheizung gibt es noch keine Gruppe.");
  });
  it("Zusammenfassung in Sätzen", () => {
    let z = haus({ typ: "vorlageNeu", name: "Regel-OG" });
    const v = z.vorlagen[0].schluessel;
    z = reduziere(z, { typ: "platzAnzahl", vorlage: v, art: "buero", anzahl: 4 });
    z = reduziere(z, { typ: "vorlageZuweisen", vorlage: v, geschoss: "OG1", an: true });
    z = reduziere(z, { typ: "vorlageZuweisen", vorlage: v, geschoss: "OG2", an: true });
    const s = zusammenfassung(z);
    expect(s.find((x) => x.titel === "Einheiten")!.text).toBe("8 Einheiten in 2 Geschossen, 2 Geschosse wie «Regel-OG».");
    expect(s.find((x) => x.titel === "Heizung")!.text).toBe("Heizkörper: ja · Fussbodenheizung: nein · TABS: nein");
  });
});
```

- [ ] **Step 2: Tests laufen lassen, müssen scheitern**

Run: `npx vitest run src/assistent/hinweise.test.ts`
Expected: FAIL.

- [ ] **Step 3: `pruefHinweise` bündeln, `zusammenfassung` schreiben**

In `hinweise.ts` die Schleifen für `ohne_gruppe` (Abgaben und UV) ersetzen durch:

```ts
  // Fehlende Mengen je Abgabeart, gebündelt
  for (const art of HEIZ_ARTEN) {
    const einheiten = new Set(z.bauteile.filter((t) => t.katalogId === ABGABE_VON[art] && t.menge === null && "einheit" in t.standort)
      .map((t) => (t.standort as { einheit: string }).einheit));
    if (einheiten.size) h.push({ code: "menge_offen", text: `Für ${einheiten.size === 1 ? "1 Einheit" : `${einheiten.size} Einheiten`} fehlt die Anzahl ${HEIZ_NAME[art]}.`, schritt: 3 });
  }
  // Verbraucher ohne Gruppe, eine Zeile je Bauteilart
  const ohne = new Map<string, ZBauteil[]>();
  for (const art of HEIZ_ARTEN) for (const t of verbraucherDerArt(z, art)) if (!gruppeVonVerbraucher(z, t.schluessel)) {
    const name = t.katalogId === K.verteiler ? "FBH-Verteiler" : teilName(t.katalogId, katalog);
    ohne.set(name, [...(ohne.get(name) ?? []), t]);
  }
  for (const [name, teile] of ohne) h.push({ code: "ohne_gruppe", schritt: 5, schluessel: teile[0].schluessel,
    text: teile.length === 1 ? `${name === "FBH-Verteiler" ? `FBH-Verteiler ${einheitVon(z, teile[0])?.bezeichnung ?? ""}`.trim() : bauteilText(z, teile[0], katalog)} gehört zu keiner Gruppe.`
      : `${teile.length} ${name === "Heizkörper" || name === "FBH-Verteiler" ? name : `× ${name}`} gehören zu keiner Gruppe.` });
  // Heizart mit Verbrauchern, aber ohne (Regel-)Gruppe – nur wenn Gruppen schon existieren
  if (z.gruppen.length) for (const art of HEIZ_ARTEN)
    if (verbraucherDerArt(z, art).length && !z.gruppen.some((g) => g.regel?.heizart === art || g.verbraucher.some((v) => verbraucherDerArt(z, art).some((t) => t.schluessel === v))))
      h.push({ code: "gruppe_fehlt", text: `Für ${HEIZ_NAME[art]} gibt es noch keine Gruppe.`, schritt: 5 });
```

Imports in `hinweise.ts` ergänzen: `ABGABE_VON, HEIZ_ARTEN, HEIZ_NAME, verbraucherDerArt, vorlageVonGeschoss` aus `./zustand`, `K` aus `./bestueckung`. `ueberUnterverteiler` bleibt exportiert (wird in Schritt 5 alt noch genutzt, entfällt in Task 11). Der Satz «4 Heizkörper gehören …» ergibt sich aus dem Zweig `name === "Heizkörper"`.

Die Vorschau-Welt meldet `ohne_gruppe` ebenfalls; das `eigene`-Set filtert diese bereits über `code`.

`zusammenfassung` anfügen:

```ts
const DREI_TEXT = { ja: "ja", nein: "nein", unbekannt: "weiss nicht" } as const;

/** Zeilen für «Prüfen» in Sätzen statt Zählern (H7). */
export function zusammenfassung(z: AssistentZustand, katalog?: readonly KatalogEintrag[] | null): { titel: string; text: string; schritt: SchrittNr }[] {
  const geschosse = new Set(z.einheiten.map((e) => e.geschoss)).size;
  const regel = z.vorlagen.filter((v) => v.geschosse.length).map((v) => `${v.geschosse.length === 1 ? "1 Geschoss" : `${v.geschosse.length} Geschosse`} wie «${v.name}»`);
  const einheiten = `${z.einheiten.length === 1 ? "1 Einheit" : `${z.einheiten.length} Einheiten`} in ${geschosse === 1 ? "1 Geschoss" : `${geschosse} Geschossen`}${regel.length ? `, ${regel.join(", ")}` : ""}.`;
  const heizung = HEIZ_ARTEN.map((a) => `${HEIZ_NAME[a]}: ${DREI_TEXT[z.heizungStandard[a]]}`).join(" · ");
  const ausnahmen = z.einheiten.filter((e) => Object.keys(e.ausnahme).length).length;
  const zentrale = [...erzeuger(z).map((t) => teilName(t.katalogId, katalog)), ...(z.bauteile.some((t) => t.katalogId === K.speicher) ? ["Speicher"] : [])].join(", ") || "noch nichts gewählt";
  const haupt = hauptverteiler(z);
  const gruppen = z.gruppen.filter((g) => g.verteiler === haupt?.schluessel).sort((a, b) => a.nummer - b.nummer)
    .map((g) => `${g.bezeichnung || `Gruppe ${g.nummer}`} (${g.verbraucher.length})`);
  const fbh = unterverteiler(z).length;
  const speisung = fbhSpeisung(z).filter((s) => s.gruppe).map((s) => `«${s.gruppe!.bezeichnung}»`);
  return [
    { titel: "Einheiten", text: einheiten, schritt: 2 },
    { titel: "Heizung", text: heizung + (ausnahmen ? ` · ${ausnahmen} Einheiten mit Ausnahme` : ""), schritt: 3 },
    { titel: "Zentrale", text: zentrale, schritt: 4 },
    { titel: "Gruppen", text: gruppen.length ? gruppen.join(", ") : "noch keine", schritt: 5 },
    { titel: "FBH-Verteiler", text: fbh ? `${fbh}${speisung.length ? `, an ${speisung.join(", ")}` : ""}` : "keine", schritt: 5 },
    { titel: "Weitere Teile", text: String(weitereTeile(z).length), schritt: 6 },
  ];
}
```

Weitere Imports: `erzeuger, fbhSpeisung, hauptverteiler, unterverteiler, weitereTeile` aus `./zustand`.

Hinweis: Der Test erwartet `«Regel-OG»` ohne Ausnahmen-Zusatz bei `Heizung`; bei Bedarf Testtext an die tatsächliche Satzform anpassen, nicht umgekehrt die Logik verbiegen.

- [ ] **Step 4: Begriffe**

`bestueckung.ts:60`: `[K.verteiler]: "Verteiler"` (in Listen steht der Ort dahinter; FBH-Verteiler werden in `hinweise.ts` und Schritt 5 explizit benannt). In `bauteilText` (`hinweise.ts`):
```ts
  const fbh = t.katalogId === K.verteiler && unterverteiler(z).some((x) => x.schluessel === t.schluessel);
  const name = (fbh ? "FBH-Verteiler" : t.katalogId === K.verteiler ? "Hauptverteiler" : teilName(t.katalogId, katalog)) + (t.hersteller ? ` ${t.hersteller}` : "");
```

`dashboard/daten.ts`: `NAMEN` ergänzen um `"heizung.wmz": "Wärmezähler", "heizung.ventil_3weg": "3-Weg-Ventil", "heizung.ventil_2weg": "Durchgangsventil"`; neue Funktion:
```ts
/** Anzeigename eines Symbols: Verteiler, die eine Gruppe speist, heissen «FBH-Verteiler» (H4). */
export function symbolName(welt: Welt, s: WeltSymbol, katalog: KatalogEintrag[] = []): string {
  if (s.katalogId === "heizung.verteiler" && (welt.gruppen ?? []).some((g) => g.verbraucher.includes(s.schluessel))) return "FBH-Verteiler";
  return anzeigeName(s.katalogId, katalog);
}
```
In `anlagenZeile` (Zeile 63) `name: symbolName(welt, s, katalog)`; `dashboard/index.ts` exportiert `symbolName`; `Twin.tsx:193` → `if (s) return symbolName(welt!, s, katalog?.eintraege);` (Import ergänzen).

- [ ] **Step 5: Tests laufen lassen**

Run: `npx vitest run`
Expected: neue PASS; Dashboard-Tests, die `"Heizungsverteiler"` für gespeiste Verteiler erwarten, auf `"FBH-Verteiler"` anpassen (`grep -rn "Heizungsverteiler" web/src --include=*.test.ts`).

- [ ] **Step 6: Typprüfung, Build, Commit**

Run: `npm run pruefe:typen && npm run build`

```bash
git add app/web/src
git commit -m "Assistent: Pruefen in Klartext, Begriff FBH-Verteiler, Waermezaehler mit Umlaut"
```

---

### Gestaltung Tasks 9–11 (gilt für alle drei)

- Vor Task 9 den Skill `planora-design` laden, Einstufung **mittel** vermerken. Umsetzung durch Agent `ui-ux-designer` mit diesem Plan als Auftrag; Datei-Hoheit laut Skill Abschnitt 5.
- Bestehende Bausteine aus `schritte/gemeinsam.tsx` verwenden (`Abschnitt`, `Hinweis`, `Schalter`, `Segment`, `Zaehler`, `ICON`); bestehende Klassen `as-karte`, `as-karte-kopf`, `as-code`, `as-chips`, `as-badge`, `as-badge-leise`, `as-textknopf`, `as-textknopf-rand`, `as-rundknopf`, `as-zeilen`, `as-zeile`, `as-liste-roh`, `as-leer`.
- Neue Klassen nur in `app/web/src/seiten/Assistent.css`, Farben ausschliesslich über die `--tw-*`-Variablen.
- Aufklapp-Bereiche als `<details>`/`<summary>` (Tastatur und Screenreader ohne Zusatzcode).
- Toggle-Chips: `<button type="button" aria-pressed>`.
- Rückfrage beim Löschen einer Vorlage inline (State in der Komponente), kein `window.confirm`.
- Logik bleibt in `zustand.ts`; Komponenten nur `dispatch`.
- Jede Komponente bekommt mindestens einen Test über reine Hilfsfunktionen (wie `schritte.test.ts`), kein DOM-Test-Framework einführen.

Neue CSS-Grundlage (Task 9 legt sie an, Task 10/11 nutzen sie):

```css
/* Regelgeschoss und Geschosswahl */
.as-geschoss-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.as-chip { height: 28px; padding: 0 10px; border-radius: 999px; border: 0; font: inherit; font-size: 12px; font-weight: 600;
  background: var(--tw-flaeche-2); color: var(--tw-text); box-shadow: inset 0 0 0 1px var(--tw-grau-1); cursor: pointer;
  transition: background var(--tw-hover-ms) var(--tw-kurve), box-shadow var(--tw-hover-ms) var(--tw-kurve); }
.as-chip[aria-pressed="true"] { background: var(--tw-eis); color: var(--tw-sekundaer-eis); box-shadow: inset 0 0 0 1px var(--tw-eis-akzent); }
.as-chip:focus-visible { outline: 2px solid var(--tw-link); outline-offset: 2px; }
.as-nutzungen { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px 12px; }
.as-aufklapp > summary { cursor: pointer; font-size: 12px; font-weight: 600; color: var(--tw-link); list-style: none; }
.as-aufklapp > summary::-webkit-details-marker { display: none; }
.as-aufklapp[open] > summary { margin-bottom: 8px; }
.as-satz { margin: 0; font-size: 13px; color: var(--tw-text); }
```

---

### Task 9: Schritt 2 «Geschosse & Einheiten»

**Files:**
- Modify (ersetzen): `app/web/src/assistent/schritte/Schritt2Einheiten.tsx`
- Modify: `app/web/src/seiten/Assistent.css` (CSS-Grundlage oben anfügen)
- Test: `app/web/src/assistent/schritte.test.ts`

**Interfaces:**
- Consumes: Aktionen `vorlageNeu`, `vorlageName`, `platzAnzahl`, `vorlageZuweisen`, `vorlageLoeschen`, `einheitAnzahl`, `einheitAendern`, `einheitLoeschen`, `einheitZuruecksetzen`, `geschossZuruecksetzen`; Abfragen `vorlageVonGeschoss`, `abweichungen`.
- Produces: `export const ZAEHLBAR: readonly string[]` (Reihenfolge der Nutzungszähler), `export const geschosseAbsteigend` (bleibt), `export function anzahlJeArt(einheiten: readonly { art: string }[], art: string): number`. `SCHNELL`/`schnellAktion` entfallen (Tests anpassen).

- [ ] **Step 1: Failing test**

In `schritte.test.ts` den `SCHNELL`-Test ersetzen:

```ts
import { ZAEHLBAR, anzahlJeArt, geschosseAbsteigend } from "./schritte/Schritt2Einheiten";
it("Nutzungszähler: Reihenfolge und Zählung", () => {
  expect(ZAEHLBAR).toEqual(["buero", "wohnung", "gastro", "allgemein", "kern", "technik"]);
  expect(anzahlJeArt([{ art: "buero" }, { art: "kern" }, { art: "buero" }], "buero")).toBe(2);
});
```

Run: `npx vitest run src/assistent/schritte.test.ts` → FAIL.

- [ ] **Step 2: Komponente schreiben**

`Schritt2Einheiten.tsx`:

```tsx
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { EINHEIT_ARTEN, abweichungen, geschossRang, vorlageVonGeschoss, type AssistentZustand, type ZEinheit, type ZVorlage } from "../zustand";
import { Abschnitt, Hinweis, ICON, Zaehler } from "./gemeinsam";
import type { SchrittInhaltProps } from "./index";

export const ZAEHLBAR: readonly string[] = ["buero", "wohnung", "gastro", "allgemein", "kern", "technik"];
const MEHRZAHL = (art: string) => EINHEIT_ARTEN.find((a) => a.art === art)?.mehrzahl ?? art;
export const anzahlJeArt = (liste: readonly { art: string }[], art: string) => liste.filter((x) => x.art === art).length;
/** Geschosse von oben nach unten (wie ein Gebäudeschnitt). */
export const geschosseAbsteigend = (z: AssistentZustand) => [...z.gebaeude.geschosse].sort((a, b) => geschossRang(b.code) - geschossRang(a.code));

function EinheitZeilen({ einheiten, code, dispatch }: { einheiten: ZEinheit[]; code: string } & Pick<SchrittInhaltProps, "dispatch">) {
  return (
    <ul className="as-zeilen as-liste-roh">
      {einheiten.map((e, i) => (
        <li key={e.schluessel} className="as-zeile as-zeile-einheit">
          <input type="text" aria-label={`Bezeichnung Einheit ${i + 1}, ${code}`} value={e.bezeichnung} maxLength={200}
            onChange={(ev) => dispatch({ typ: "einheitAendern", schluessel: e.schluessel, bezeichnung: ev.target.value })} />
          <select aria-label={`Nutzung Einheit ${i + 1}, ${code}`} value={e.art} onChange={(ev) => dispatch({ typ: "einheitAendern", schluessel: e.schluessel, art: ev.target.value })}>
            {EINHEIT_ARTEN.map((a) => <option key={a.art} value={a.art}>{a.name}</option>)}
          </select>
          {(e.abweichend?.length ?? 0) > 0
            ? <button type="button" className="as-rundknopf" aria-label={`${e.bezeichnung} auf Regelgeschoss zurücksetzen`} title="Auf Regelgeschoss zurücksetzen"
                onClick={() => dispatch({ typ: "einheitZuruecksetzen", einheit: e.schluessel })}><RotateCcw {...ICON} /></button>
            : <span aria-hidden="true" />}
          <button type="button" className="as-rundknopf" aria-label={`${e.bezeichnung} entfernen`} onClick={() => dispatch({ typ: "einheitLoeschen", schluessel: e.schluessel })}><Trash2 {...ICON} /></button>
        </li>
      ))}
    </ul>
  );
}

function VorlageKarte({ v, z, dispatch }: { v: ZVorlage } & Pick<SchrittInhaltProps, "z" | "dispatch">) {
  const [loeschen, setLoeschen] = useState(false);
  const ab = abweichungen(z, v.schluessel);
  return (
    <section className="as-karte" aria-label={`Regelgeschoss ${v.name}`}>
      <header className="as-karte-kopf">
        <input type="text" className="as-gruppe-name" aria-label="Name des Regelgeschosses" value={v.name} maxLength={200}
          onChange={(e) => dispatch({ typ: "vorlageName", vorlage: v.schluessel, name: e.target.value })} />
        {!loeschen && <button type="button" className="as-rundknopf" aria-label={`Regelgeschoss ${v.name} löschen`} onClick={() => setLoeschen(true)}><Trash2 {...ICON} /></button>}
      </header>
      {loeschen && <Hinweis art="warnung">
        Regelgeschoss löschen? Die Einheiten bleiben und werden eigenständig.{" "}
        <button type="button" className="as-textknopf" onClick={() => dispatch({ typ: "vorlageLoeschen", vorlage: v.schluessel })}>Löschen</button>{" "}
        <button type="button" className="as-textknopf" onClick={() => setLoeschen(false)}>Abbrechen</button>
      </Hinweis>}
      <div className="as-nutzungen">
        {ZAEHLBAR.map((art) => <Zaehler key={art} label={MEHRZAHL(art)} wert={anzahlJeArt(v.plaetze, art)} min={0} max={50}
          onWert={(n) => dispatch({ typ: "platzAnzahl", vorlage: v.schluessel, art, anzahl: n })} />)}
      </div>
      <div>
        <span className="as-label">Gilt für</span>
        <div className="as-geschoss-chips" role="group" aria-label={`Geschosse für ${v.name}`}>
          {geschosseAbsteigend(z).map((g) => {
            const an = v.geschosse.includes(g.code);
            return <button key={g.code} type="button" className="as-chip" aria-pressed={an}
              onClick={() => dispatch({ typ: "vorlageZuweisen", vorlage: v.schluessel, geschoss: g.code, an: !an })}>{g.code}</button>;
          })}
        </div>
      </div>
      {ab > 0 && <p className="as-leer">{ab === 1 ? "1 Abweichung" : `${ab} Abweichungen`} in einzelnen Geschossen.</p>}
    </section>
  );
}

export function Schritt2Einheiten({ z, dispatch }: SchrittInhaltProps) {
  return <>
    <Hinweis>Gleiche Geschosse einmal als Regelgeschoss erfassen und zuweisen. Danach nur noch die Abweichungen ändern.</Hinweis>
    <Abschnitt titel="Regelgeschosse" aktion={
      <button type="button" className="as-textknopf" onClick={() => dispatch({ typ: "vorlageNeu" })}><Plus size={14} strokeWidth={1.75} aria-hidden />Regelgeschoss</button>}>
      {z.vorlagen.length === 0 && <p className="as-leer">Noch kein Regelgeschoss. Für Bürohäuser mit gleichen Obergeschossen spart es viele Eingaben.</p>}
      {z.vorlagen.map((v) => <VorlageKarte key={v.schluessel} v={v} z={z} dispatch={dispatch} />)}
    </Abschnitt>
    <Abschnitt titel="Geschosse">
      {geschosseAbsteigend(z).map((g) => {
        const einheiten = z.einheiten.filter((e) => e.geschoss === g.code);
        const v = vorlageVonGeschoss(z, g.code);
        const eigene = einheiten.filter((e) => !e.vorlage);
        const abweichend = v && (einheiten.some((e) => (e.abweichend?.length ?? 0) > 0) || v.ausgelassen.some((o) => o.geschoss === g.code));
        return (
          <section key={g.code} className="as-karte" aria-label={`Geschoss ${g.code}`}>
            <header className="as-karte-kopf">
              <span className="as-code">{g.code}</span>
              <span className="as-zahl">{einheiten.length === 1 ? "1 Einheit" : `${einheiten.length} Einheiten`}</span>
              {v && <span className="as-badge">wie {v.name}</span>}
              {abweichend && <span className="as-badge as-badge-leise">Abweichung</span>}
              <span className="as-abschnitt-aktion">
                {abweichend && <button type="button" className="as-textknopf" onClick={() => dispatch({ typ: "geschossZuruecksetzen", geschoss: g.code })}>Zurücksetzen</button>}
                {!v && einheiten.length > 0 && <button type="button" className="as-textknopf" onClick={() => dispatch({ typ: "vorlageNeu", ausGeschoss: g.code })}>Als Regelgeschoss</button>}
              </span>
            </header>
            {v ? (
              <details className="as-aufklapp">
                <summary>Einheiten anzeigen und abweichend ändern</summary>
                <EinheitZeilen einheiten={einheiten} code={g.code} dispatch={dispatch} />
                <div className="as-nutzungen">
                  {ZAEHLBAR.map((art) => <Zaehler key={art} label={`Zusätzlich ${MEHRZAHL(art)}`} wert={anzahlJeArt(eigene, art)} min={0} max={50}
                    onWert={(n) => dispatch({ typ: "einheitAnzahl", geschoss: g.code, art, anzahl: n })} />)}
                </div>
              </details>
            ) : <>
              <div className="as-nutzungen">
                {ZAEHLBAR.map((art) => <Zaehler key={art} label={MEHRZAHL(art)} wert={anzahlJeArt(eigene, art)} min={0} max={50}
                  onWert={(n) => dispatch({ typ: "einheitAnzahl", geschoss: g.code, art, anzahl: n })} />)}
              </div>
              {einheiten.length > 0 && <details className="as-aufklapp" open={einheiten.length <= 3}>
                <summary>Bezeichnungen ändern</summary>
                <EinheitZeilen einheiten={einheiten} code={g.code} dispatch={dispatch} />
              </details>}
            </>}
          </section>
        );
      })}
    </Abschnitt>
  </>;
}
```

Hinweis an den Designer: Sechs Zähler je Geschoss sind visuell schwer; zulässig ist, nur Zähler mit Wert > 0 plus eine Zeile «+ Nutzung» (Auswahl) zu zeigen, solange jede Nutzung mit höchstens 2 Klicks erreichbar bleibt. Die Spalte `as-zeile-einheit` hat jetzt einen Knopf mehr (Zurücksetzen); Rasterspalten in CSS entsprechend erweitern.

- [ ] **Step 3: Tests, Typen, Build**

Run: `npx vitest run && npm run pruefe:typen && npm run build`
Expected: grün.

- [ ] **Step 4: Sichtprüfung lokal**

Run (Bash, aus Repo-Wurzel): `bash werkzeug/design/instanz.sh start`, dann `http://localhost:3100/entwicklung/anmelden` öffnen, neues Testgebäude (UG1, EG, OG1–OG5) anlegen, Regelgeschoss mit 4 Büros auf OG1–OG5 setzen. Erwartet: 20 Büros, OG5 «wie Regelgeschoss», Vorschau zeigt Einheiten. Danach `bash werkzeug/design/instanz.sh stop`.

- [ ] **Step 5: Commit**

```bash
git add app/web/src/assistent/schritte/Schritt2Einheiten.tsx app/web/src/assistent/schritte.test.ts app/web/src/seiten/Assistent.css
git commit -m "Assistent: Schritt Geschosse & Einheiten mit Regelgeschossen und freier Anzahl je Nutzung"
```

---

### Task 10: Schritt 3 «Heizung»

**Files:**
- Create: `app/web/src/assistent/schritte/Schritt3Heizung.tsx` (ersetzt `Schritt3Abgaben.tsx`)
- Delete: `app/web/src/assistent/schritte/Schritt3Abgaben.tsx`
- Modify: `app/web/src/assistent/schritte/index.tsx`
- Test: `app/web/src/assistent/schritte.test.ts`

**Interfaces:**
- Consumes: `standard`, `standardGeraet`, `platzAusnahme`, `platzMenge`, `geschossAusnahme`, `ausnahme`, `abgabeAendern`, `abgabeWeissNicht`, `abgabeNeu`, `bauteilLoeschen`; `platzWirksam`, `wirksam`, `vorlageVonGeschoss`, `nummerieren`.
- Produces: `export function geschossAusnahmeWert(einheiten: readonly ZEinheit[], art: HeizArt): Dreiwertig | "" | "gemischt"`

- [ ] **Step 1: Failing test**

```ts
import { geschossAusnahmeWert } from "./schritte/Schritt3Heizung";
it("Ausnahme je Geschoss: gemeinsamer Wert, leer oder gemischt", () => {
  const e = (fbh?: "ja" | "nein") => ({ ausnahme: fbh ? { fbh } : {} } as any);
  expect(geschossAusnahmeWert([e("ja"), e("ja")], "fbh")).toBe("ja");
  expect(geschossAusnahmeWert([e(), e()], "fbh")).toBe("");
  expect(geschossAusnahmeWert([e("ja"), e()], "fbh")).toBe("gemischt");
});
```

Run → FAIL.

- [ ] **Step 2: Komponente schreiben**

`Schritt3Heizung.tsx`:

```tsx
import { Plus, Trash2 } from "lucide-react";
import type { Dreiwertig, HeizArt } from "../../typen";
import { teilName } from "../bestueckung";
import { ABGABE_VON, ERLAUBT, HEIZ_ARTEN, HEIZ_NAME, abgabenVon, artName, platzWirksam, vorlageVonGeschoss, wirksam, type ZBauteil, type ZEinheit } from "../zustand";
import { Abschnitt, Hinweis, ICON, Segment } from "./gemeinsam";
import type { SchrittInhaltProps } from "./index";
import { geschosseAbsteigend } from "./Schritt2Einheiten";

const DREI: readonly { wert: Dreiwertig; text: string }[] = [{ wert: "ja", text: "Ja" }, { wert: "nein", text: "Nein" }, { wert: "unbekannt", text: "Weiss nicht" }];
const DREI_TEXT: Record<Dreiwertig, string> = { ja: "Ja", nein: "Nein", unbekannt: "Weiss nicht" };
const KURZ = (art: string) => ({ buero: "Büro", wohnung: "Wohnung", gastro: "Gastro", allgemein: "Allgemein", technik: "Technik", kern: "Kern" } as Record<string, string>)[art] ?? art;

export function geschossAusnahmeWert(einheiten: readonly ZEinheit[], art: HeizArt): Dreiwertig | "" | "gemischt" {
  const werte = new Set(einheiten.map((e) => e.ausnahme[art] ?? ""));
  return werte.size === 1 ? ([...werte][0] as Dreiwertig | "") : "gemischt";
}

function AusnahmeWahl({ label, wert, standard, onWert }: { label: string; wert: Dreiwertig | "" | "gemischt"; standard: Dreiwertig; onWert: (w: Dreiwertig | null) => void }) {
  return (
    <label className="as-ausnahme">
      <span>{label}</span>
      <select value={wert} onChange={(e) => e.target.value !== "gemischt" && onWert((e.target.value || null) as Dreiwertig | null)}>
        <option value="">Standard ({DREI_TEXT[standard]})</option>
        {wert === "gemischt" && <option value="gemischt" disabled>Unterschiedlich</option>}
        {DREI.map((d) => <option key={d.wert} value={d.wert}>{d.text}</option>)}
      </select>
    </label>
  );
}

function Menge({ label, wert, onWert }: { label: string; wert: number | null; onWert: (n: number | null) => void }) {
  return (
    <label className="as-ausnahme">
      <span>{label}</span>
      <input type="number" min={0} inputMode="numeric" placeholder="Weiss nicht" value={wert ?? ""}
        onChange={(e) => onWert(e.target.value === "" ? null : Number(e.target.value))} />
    </label>
  );
}

function AbgabeZeile({ t, z, dispatch, katalog }: { t: ZBauteil } & Pick<SchrittInhaltProps, "z" | "dispatch" | "katalog">) {
  const name = teilName(t.katalogId, katalog);
  const art = HEIZ_ARTEN.find((a) => ABGABE_VON[a] === t.katalogId);
  const std = art ? z.standardGeraet[art] : undefined;
  const eigen = (t.hersteller ?? null) !== (std?.hersteller ?? null) || (t.typ ?? null) !== (std?.typ ?? null);
  return (
    <li className="as-zeile as-zeile-abgabe">
      <span className="as-badge as-badge-heizung">{name}</span>
      <Menge label="Anzahl" wert={t.menge} onWert={(n) => n === null ? dispatch({ typ: "abgabeWeissNicht", schluessel: t.schluessel }) : dispatch({ typ: "abgabeAendern", schluessel: t.schluessel, menge: n })} />
      <details className="as-aufklapp" open={eigen}>
        <summary>{eigen ? "Eigener Hersteller" : "Hersteller wie Standard"}</summary>
        <input type="text" aria-label={`${name}: Hersteller`} placeholder="Hersteller" value={t.hersteller ?? ""} maxLength={200}
          onChange={(e) => dispatch({ typ: "abgabeAendern", schluessel: t.schluessel, hersteller: e.target.value })} />
        <input type="text" aria-label={`${name}: Typ`} placeholder="Typ" value={t.typ ?? ""} maxLength={200}
          onChange={(e) => dispatch({ typ: "abgabeAendern", schluessel: t.schluessel, geraetTyp: e.target.value })} />
      </details>
      <button type="button" className="as-rundknopf" aria-label={`${name} entfernen`} onClick={() => dispatch({ typ: "bauteilLoeschen", schluessel: t.schluessel })}><Trash2 {...ICON} /></button>
    </li>
  );
}

export function Schritt3Heizung({ z, dispatch, katalog }: SchrittInhaltProps) {
  return <>
    <Abschnitt titel="Gebäudestandard" zusatz="Gilt für alle Einheiten, ausser bei Ausnahmen.">
      <div className="as-raster-standard">
        {HEIZ_ARTEN.map((art) => {
          const g = z.standardGeraet[art];
          return (
            <div key={art} className="as-standard-zeile">
              <span className="as-label">{HEIZ_NAME[art]}</span>
              <Segment name={`as-standard-${art}`} label={HEIZ_NAME[art]} wert={z.heizungStandard[art]} optionen={DREI} onWert={(wert) => dispatch({ typ: "standard", art, wert })} />
              {z.heizungStandard[art] !== "nein" && <details className="as-aufklapp">
                <summary>{g?.hersteller || g?.typ ? [g.hersteller, g.typ].filter(Boolean).join(" · ") : "Hersteller und Typ (optional)"}</summary>
                <div className="as-reihe">
                  <label className="as-feld"><span className="as-label">Hersteller</span>
                    <input type="text" value={g?.hersteller ?? ""} maxLength={200} onChange={(e) => dispatch({ typ: "standardGeraet", art, hersteller: e.target.value })} /></label>
                  <label className="as-feld"><span className="as-label">Typ</span>
                    <input type="text" value={g?.typ ?? ""} maxLength={200} onChange={(e) => dispatch({ typ: "standardGeraet", art, geraetTyp: e.target.value })} /></label>
                </div>
              </details>}
            </div>
          );
        })}
      </div>
    </Abschnitt>
    {z.einheiten.length === 0 && <Hinweis art="warnung">Noch keine Einheiten erfasst. Lege sie in Schritt 2 an.</Hinweis>}
    {z.vorlagen.filter((v) => v.plaetze.length).map((v) => (
      <Abschnitt key={v.schluessel} titel={v.name} zusatz={v.geschosse.length ? `gilt für ${[...v.geschosse].join(", ")}` : "keinem Geschoss zugewiesen"}>
        <ul className="as-zeilen as-liste-roh">
          {v.plaetze.map((p, i) => {
            const w = platzWirksam(z, p);
            const erlaubt = ERLAUBT[p.art] ?? [];
            return (
              <li key={p.schluessel} className="as-karte">
                <header className="as-karte-kopf"><h3>{KURZ(p.art)} {i + 1}</h3><span className="as-zahl">{artName(p.art)}</span></header>
                <div className="as-ausnahmen">
                  {HEIZ_ARTEN.filter((art) => erlaubt.includes(ABGABE_VON[art])).map((art) => (
                    <AusnahmeWahl key={art} label={HEIZ_NAME[art]} wert={p.ausnahme[art] ?? ""} standard={z.heizungStandard[art]}
                      onWert={(wert) => dispatch({ typ: "platzAusnahme", vorlage: v.schluessel, platz: p.schluessel, art, wert })} />
                  ))}
                  {p.art !== "technik" && HEIZ_ARTEN.filter((art) => w[art] === "ja" && erlaubt.includes(ABGABE_VON[art])).map((art) => (
                    <Menge key={`m-${art}`} label={`Anzahl ${HEIZ_NAME[art]}`} wert={p.mengen[art] ?? null}
                      onWert={(menge) => dispatch({ typ: "platzMenge", vorlage: v.schluessel, platz: p.schluessel, art, menge })} />
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </Abschnitt>
    ))}
    <Abschnitt titel="Geschosse und Einheiten">
      {geschosseAbsteigend(z).map((g) => {
        const einheiten = z.einheiten.filter((e) => e.geschoss === g.code);
        if (einheiten.length === 0) return null;
        const v = vorlageVonGeschoss(z, g.code);
        return (
          <section key={g.code} className="as-karte" aria-label={`Geschoss ${g.code}`}>
            <header className="as-karte-kopf">
              <span className="as-code">{g.code}</span>
              {v && <span className="as-badge">wie {v.name}</span>}
            </header>
            <div className="as-ausnahmen" role="group" aria-label={`Ausnahme für alle Einheiten in ${g.code}`}>
              {HEIZ_ARTEN.map((art) => <AusnahmeWahl key={art} label={`${HEIZ_NAME[art]} im ganzen Geschoss`} wert={geschossAusnahmeWert(einheiten, art)}
                standard={z.heizungStandard[art]} onWert={(wert) => dispatch({ typ: "geschossAusnahme", geschoss: g.code, art, wert })} />)}
            </div>
            <details className="as-aufklapp" open={!v && einheiten.length <= 3}>
              <summary>{einheiten.length === 1 ? "1 Einheit" : `${einheiten.length} Einheiten`} einzeln</summary>
              {einheiten.map((e) => {
                const w = wirksam(z, e);
                const erlaubt = ERLAUBT[e.art] ?? [];
                const abgaben = abgabenVon(z, e.schluessel);
                return (
                  <div key={e.schluessel} className="as-karte" aria-label={e.bezeichnung}>
                    <header className="as-karte-kopf"><h3>{e.bezeichnung}</h3><span className="as-zahl">{artName(e.art)}</span></header>
                    <div className="as-ausnahmen">
                      {HEIZ_ARTEN.filter((art) => erlaubt.includes(ABGABE_VON[art])).map((art) => (
                        <AusnahmeWahl key={art} label={HEIZ_NAME[art]} wert={e.ausnahme[art] ?? ""} standard={z.heizungStandard[art]}
                          onWert={(wert) => dispatch({ typ: "ausnahme", einheit: e.schluessel, art, wert })} />
                      ))}
                    </div>
                    {abgaben.length > 0 && <ul className="as-zeilen as-liste-roh">{abgaben.map((t) => <AbgabeZeile key={t.schluessel} t={t} z={z} dispatch={dispatch} katalog={katalog} />)}</ul>}
                    <div className="as-chips">
                      {HEIZ_ARTEN.filter((art) => w[art] !== "nein" && erlaubt.includes(ABGABE_VON[art])).map((art) => (
                        <button key={art} type="button" className="as-textknopf" onClick={() => dispatch({ typ: "abgabeNeu", einheit: e.schluessel, katalogId: ABGABE_VON[art] })}>
                          <Plus size={14} strokeWidth={1.75} aria-hidden />{teilName(ABGABE_VON[art], katalog)}</button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </details>
          </section>
        );
      })}
    </Abschnitt>
  </>;
}
```

`index.tsx`: Import `Schritt3Heizung` statt `Schritt3Abgaben`, `3: Schritt3Heizung`. Datei `Schritt3Abgaben.tsx` löschen (`git rm`).

- [ ] **Step 3: Tests, Typen, Build, Sichtprüfung**

Run: `npx vitest run && npm run pruefe:typen && npm run build`
Sichtprüfung wie Task 9 Step 4: FBH in OG4 und OG5 per Geschoss-Ausnahme, Gastro per Einheit, Hersteller HK am Standard. Erwartet: FBH-Verteiler entstehen (in Schritt 5 sichtbar), Hersteller steht an allen HK.

- [ ] **Step 4: Commit**

```bash
git add -A app/web/src/assistent/schritte app/web/src/assistent/schritte.test.ts app/web/src/seiten/Assistent.css
git commit -m "Assistent: Schritt Heizung mit Standard-Hersteller, Regelgeschoss und Ausnahme je Geschoss"
```

---

### Task 11: Schritt 4 Kleinkorrektur, Schritt 5 «Gruppen & FBH-Verteiler», Umbenennung

**Files:**
- Modify: `app/web/src/assistent/schritte/Schritt4Zentrale.tsx:52-58` (Optionstext mit Geschoss)
- Modify (ersetzen): `app/web/src/assistent/schritte/Schritt5Gruppen.tsx`
- Create: `app/web/src/assistent/schritte/FbhVerteiler.tsx`
- Delete: `app/web/src/assistent/schritte/Schritt6Unterverteiler.tsx`
- Rename: `Schritt7Teile.tsx` → `Schritt6Teile.tsx` (Komponente `Schritt6Teile`), `Schritt8Pruefen.tsx` → `Schritt7Pruefen.tsx` (Komponente `Schritt7Pruefen`)
- Modify: `app/web/src/assistent/schritte/index.tsx`
- Modify: `app/web/src/assistent/hinweise.ts` (`ueberUnterverteiler` entfernen, falls nicht mehr genutzt)
- Test: `app/web/src/assistent/schritte.test.ts`

**Interfaces:**
- Consumes: `gruppenVorschlagen`, `gruppeTeilen`, `sondergruppe`, `gruppeEntfernen`, `gruppeFuerArt`, `gruppenAnzahl`, `gruppeName`, `gruppeArt`, `bestueckung`, `gruppeWmz`, `verbraucher`, `unterverteiler`, `unterverteilerWmz`, `fbhWmzAlle`; `fbhSpeisung`, `verbraucherDerArt`, `zusammenfassung`.
- Produces: `export function verbraucherSatz(z: AssistentZustand, g: ZGruppe, katalog?: readonly KatalogEintrag[] | null): string` (z. B. «12 Heizkörper in OG1–OG3, EG»)

- [ ] **Step 1: Failing test**

```ts
import { verbraucherSatz } from "./schritte/Schritt5Gruppen";
it("Verbraucher einer Gruppe als Satz", () => {
  let z = angelegt(0, 2, { typ: "einheitAnzahl", geschoss: "OG1", art: "buero", anzahl: 2 }, { typ: "einheitAnzahl", geschoss: "OG2", art: "buero", anzahl: 1 },
    { typ: "einheitAnzahl", geschoss: "EG", art: "technik", anzahl: 1 }, { typ: "erzeuger", katalogId: K.waermepumpe }, { typ: "schritt", nr: 5 });
  expect(verbraucherSatz(z, z.gruppen[0])).toBe("3 Heizkörper in OG2, OG1");
});
```

Run → FAIL.

- [ ] **Step 2: Schritt 4 – Raumliste mit Geschoss**

In `Schritt4Zentrale.tsx` die Option: `<option key={e.schluessel} value={e.schluessel}>{g.code} · {e.bezeichnung} · {artName(e.art)}</option>`.

- [ ] **Step 3: `FbhVerteiler.tsx` schreiben**

```tsx
import { K } from "../bestueckung";
import { einheitVon, fbhSpeisung, gruppeVonVerbraucher, hauptverteiler, unterverteiler, unterverteilerVorschlaege, type ZBauteil } from "../zustand";
import { Abschnitt, Schalter } from "./gemeinsam";
import type { SchrittInhaltProps } from "./index";

const wmzVor = (z: SchrittInhaltProps["z"], t: ZBauteil) =>
  z.bauteile.some((x) => x.katalogId === K.wmz && x.ort && "vorBauteil" in x.ort && x.ort.vorBauteil === t.schluessel);

function Speisung({ t, z, dispatch }: { t: ZBauteil } & Pick<SchrittInhaltProps, "z" | "dispatch">) {
  const h = hauptverteiler(z);
  const gruppen = h ? z.gruppen.filter((g) => g.verteiler === h.schluessel).sort((a, b) => a.nummer - b.nummer) : [];
  const aktuell = gruppeVonVerbraucher(z, t.schluessel);
  const name = einheitVon(z, t)?.bezeichnung ?? "FBH-Verteiler";
  return (
    <label className="as-ausnahme as-speisung">
      <span>Gespeist von</span>
      <select value={aktuell?.schluessel ?? ""} aria-label={`${name}: gespeist von Gruppe`} onChange={(e) => {
        if (e.target.value) dispatch({ typ: "verbraucher", gruppe: e.target.value, bauteil: t.schluessel, an: true });
        else if (aktuell) dispatch({ typ: "verbraucher", gruppe: aktuell.schluessel, bauteil: t.schluessel, an: false });
      }}>
        <option value="">Keine Gruppe</option>
        {gruppen.map((g) => <option key={g.schluessel} value={g.schluessel}>{g.nummer} · {g.bezeichnung || `Gruppe ${g.nummer}`}</option>)}
      </select>
    </label>
  );
}

export function FbhVerteiler({ z, dispatch }: Pick<SchrittInhaltProps, "z" | "dispatch">) {
  const uv = unterverteiler(z);
  const vorschlaege = unterverteilerVorschlaege(z);
  const alleWmz = uv.length > 0 && uv.every((t) => wmzVor(z, t));
  const satz = uv.length === 0 ? "Keine Einheit mit Fussbodenheizung erfasst."
    : `${uv.length} FBH-Verteiler${uv.some((t) => t.auto) ? ", automatisch" : ""} ${fbhSpeisung(z).map((s) => s.gruppe ? `an «${s.gruppe.bezeichnung || `Gruppe ${s.gruppe.nummer}`}»` : `${s.anzahl} ohne Gruppe`).join(", ")}.`;
  const imVorschlag = new Set(vorschlaege.map((e) => e.schluessel));
  const weitere = uv.filter((t) => !("einheit" in t.standort && imVorschlag.has(t.standort.einheit)));
  return (
    <Abschnitt titel="FBH-Verteiler" zusatz="Je Einheit mit Fussbodenheizung, per Leitung an ihrer Gruppe in der Zentrale.">
      <p className="as-satz">{satz}</p>
      {uv.length > 0 && <Schalter label="Wärmezähler an allen FBH-Verteilern" an={alleWmz} onAn={(an) => dispatch({ typ: "fbhWmzAlle", an })} />}
      {(vorschlaege.length > 0 || weitere.length > 0) && <details className="as-aufklapp">
        <summary>Ausnahmen je Einheit</summary>
        {[...vorschlaege.map((e) => ({ e, t: uv.find((x) => "einheit" in x.standort && x.standort.einheit === e.schluessel) })),
          ...weitere.map((t) => ({ e: einheitVon(z, t)!, t }))].map(({ e, t }) => (
          <div key={e.schluessel} className="as-karte as-uv">
            <div className="as-uv-kopf">
              <span className="as-code">{e.geschoss}</span>
              <Schalter label={`FBH-Verteiler in ${e.bezeichnung}`} an={!!t} onAn={(an) => dispatch({ typ: "unterverteiler", einheit: e.schluessel, an })} />
            </div>
            {t && <div className="as-uv-details">
              <Speisung t={t} z={z} dispatch={dispatch} />
              <Schalter label="Wärmezähler" an={wmzVor(z, t)} onAn={(an) => dispatch({ typ: "unterverteilerWmz", verteiler: t.schluessel, an })} />
            </div>}
          </div>
        ))}
      </details>}
    </Abschnitt>
  );
}
```

- [ ] **Step 4: `Schritt5Gruppen.tsx` ersetzen**

```tsx
import { Minus, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { KatalogEintrag } from "../../typen";
import { GRUPPEN_ARTEN, GRUPPEN_ART_TEXT, K, teilName } from "../bestueckung";
import {
  HEIZ_ARTEN, HEIZ_NAME, bestueckungVon, einheitVon, geschossRang, geschossVon, gruppeVonVerbraucher, hauptverteiler, unterverteiler,
  verbraucherDerArt, zubehoerVon, type AssistentZustand, type ZGruppe,
} from "../zustand";
import { Abschnitt, Hinweis, ICON, Schalter } from "./gemeinsam";
import { FbhVerteiler } from "./FbhVerteiler";
import type { SchrittInhaltProps } from "./index";

/** «12 Heizkörper in OG3, OG2» – Verbraucher je Bauteilart, Geschosse von oben. */
export function verbraucherSatz(z: AssistentZustand, g: ZGruppe, katalog?: readonly KatalogEintrag[] | null): string {
  const uv = new Set(unterverteiler(z).map((t) => t.schluessel));
  const teile = g.verbraucher.map((s) => z.bauteile.find((t) => t.schluessel === s)).filter((t) => !!t);
  if (teile.length === 0) return "Keine Verbraucher";
  const arten = new Map<string, number>();
  for (const t of teile) { const n = uv.has(t.schluessel) ? "FBH-Verteiler" : teilName(t.katalogId, katalog); arten.set(n, (arten.get(n) ?? 0) + 1); }
  const codes = [...new Set(teile.map((t) => geschossVon(z, t)).filter((c): c is string => !!c))].sort((a, b) => geschossRang(b) - geschossRang(a));
  return `${[...arten].map(([n, k]) => `${k} ${n}`).join(", ")} in ${codes.join(", ")}`;
}

function GruppenKarte({ g, z, dispatch, katalog }: { g: ZGruppe } & Pick<SchrittInhaltProps, "z" | "dispatch" | "katalog">) {
  const [teilen, setTeilen] = useState<string[] | null>(null);
  const titel = g.bezeichnung || `Gruppe ${g.nummer}`;
  const wmz = zubehoerVon(z, g.schluessel).some((t) => t.katalogId === K.wmz);
  const uv = new Set(unterverteiler(z).map((t) => t.schluessel));
  const teile = g.verbraucher.map((s) => z.bauteile.find((t) => t.schluessel === s)).filter((t) => !!t);
  const codes = [...new Set(teile.map((t) => geschossVon(z, t)).filter((c): c is string => !!c))].sort((a, b) => geschossRang(b) - geschossRang(a));
  const einheiten = [...new Map(teile.map((t) => einheitVon(z, t)).filter((e) => !!e).map((e) => [e.schluessel, e])).values()];
  const kandidaten = g.regel ? verbraucherDerArt(z, g.regel.heizart) : HEIZ_ARTEN.flatMap((a) => verbraucherDerArt(z, a));
  const nachGeschoss = [...new Set(kandidaten.map((t) => geschossVon(z, t) ?? ""))].sort((a, b) => geschossRang(b) - geschossRang(a));
  return (
    <section className="as-karte as-gruppe" aria-label={`Gruppe ${g.nummer}: ${titel}`}>
      <header className="as-karte-kopf">
        <span className="as-code" aria-hidden="true">{g.nummer}</span>
        <input type="text" className="as-gruppe-name" aria-label={`Bezeichnung Gruppe ${g.nummer}`} value={g.bezeichnung} maxLength={200}
          onChange={(e) => dispatch({ typ: "gruppeName", schluessel: g.schluessel, bezeichnung: e.target.value })} />
        {g.regel && !g.angefasst && <span className="as-badge">Vorschlag</span>}
        <button type="button" className="as-rundknopf" aria-label={`Gruppe ${titel} entfernen`} onClick={() => dispatch({ typ: "gruppeEntfernen", gruppe: g.schluessel })}><Trash2 {...ICON} /></button>
      </header>
      <p className="as-satz">{verbraucherSatz(z, g, katalog)}</p>
      <label className="as-feld">
        <span className="as-label">Art</span>
        <select value={g.art} onChange={(e) => dispatch({ typ: "gruppeArt", schluessel: g.schluessel, art: e.target.value as ZGruppe["art"] })}>
          {GRUPPEN_ARTEN.map((a) => <option key={a} value={a}>{GRUPPEN_ART_TEXT[a].name}</option>)}
        </select>
        <span className="as-hilfe">{GRUPPEN_ART_TEXT[g.art].text}</span>
      </label>
      <details className="as-aufklapp">
        <summary>Bestückung: {bestueckungVon(z, g.schluessel).filter((b) => b.menge).map((b) => `${b.menge}× ${teilName(b.katalogId, katalog)}`).join(", ") || "keine"}{wmz ? ", Wärmezähler" : ""}</summary>
        <div className="as-bestueckung" role="group" aria-label={`Bestückung ${titel}`}>
          {bestueckungVon(z, g.schluessel).map((b) => {
            const name = teilName(b.katalogId, katalog);
            return (
              <div key={b.katalogId} className="as-bestueckung-zeile">
                <span className={b.menge ? "" : "as-gedimmt"}>{name}</span>
                {b.vorgeschlagen && <span className="as-badge">Vorschlag</span>}
                <span className="as-bestueckung-zahl">
                  <button type="button" className="as-rundknopf" aria-label={`${name} weniger`} disabled={b.menge === 0}
                    onClick={() => dispatch({ typ: "bestueckung", gruppe: g.schluessel, katalogId: b.katalogId, delta: -1 })}><Minus size={14} strokeWidth={1.75} aria-hidden /></button>
                  <output aria-label={`${name} Anzahl`}>{b.menge}</output>
                  <button type="button" className="as-rundknopf" aria-label={`${name} mehr`}
                    onClick={() => dispatch({ typ: "bestueckung", gruppe: g.schluessel, katalogId: b.katalogId, delta: 1 })}><Plus size={14} strokeWidth={1.75} aria-hidden /></button>
                </span>
              </div>
            );
          })}
          <Schalter label="Wärmezähler in der Gruppe" an={wmz} onAn={(an) => dispatch({ typ: "gruppeWmz", gruppe: g.schluessel, an })} />
        </div>
      </details>
      {g.regel && codes.length > 1 && (teilen === null
        ? <button type="button" className="as-textknopf" onClick={() => setTeilen([])}>Nach Geschossen teilen</button>
        : <div>
          <span className="as-label">Geschosse für die neue Gruppe</span>
          <div className="as-geschoss-chips" role="group" aria-label="Geschosse für die neue Gruppe">
            {codes.map((c) => <button key={c} type="button" className="as-chip" aria-pressed={teilen.includes(c)}
              onClick={() => setTeilen(teilen.includes(c) ? teilen.filter((x) => x !== c) : [...teilen, c])}>{c}</button>)}
          </div>
          <div className="as-chips">
            <button type="button" className="as-knopf as-knopf-klein" disabled={teilen.length === 0 || teilen.length === codes.length}
              onClick={() => { dispatch({ typ: "gruppeTeilen", gruppe: g.schluessel, geschosse: teilen }); setTeilen(null); }}>Neue Gruppe</button>
            <button type="button" className="as-textknopf" onClick={() => setTeilen(null)}>Abbrechen</button>
          </div>
        </div>)}
      {g.regel && einheiten.length > 1 && <label className="as-ausnahme">
        <span>Eigene Gruppe für</span>
        <select value="" onChange={(e) => e.target.value && dispatch({ typ: "sondergruppe", einheit: e.target.value, heizart: g.regel!.heizart })}>
          <option value="">Einheit wählen …</option>
          {einheiten.map((e) => <option key={e.schluessel} value={e.schluessel}>{e.geschoss} · {e.bezeichnung}</option>)}
        </select>
      </label>}
      <details className="as-aufklapp">
        <summary>Einzelne Verbraucher ({g.verbraucher.length})</summary>
        {nachGeschoss.map((code) => (
          <details key={code} className="as-aufklapp as-verbraucher-geschoss">
            <summary>{code}</summary>
            <ul className="as-liste-roh as-verbraucher-liste">
              {kandidaten.filter((t) => (geschossVon(z, t) ?? "") === code).map((t) => {
                const andere = gruppeVonVerbraucher(z, t.schluessel);
                const fremd = andere && andere.schluessel !== g.schluessel ? andere : null;
                return (
                  <li key={t.schluessel}>
                    <label className="as-check as-verbraucher-eintrag">
                      <input type="checkbox" checked={g.verbraucher.includes(t.schluessel)}
                        onChange={(e) => dispatch({ typ: "verbraucher", gruppe: g.schluessel, bauteil: t.schluessel, an: e.target.checked })} />
                      <span className="as-verbraucher-text">
                        <span>{einheitVon(z, t)?.bezeichnung}</span>
                        <span className="as-zahl">{uv.has(t.schluessel) ? "FBH-Verteiler" : teilName(t.katalogId, katalog)}{t.menge !== null ? ` · ${t.menge}` : ""}</span>
                      </span>
                      {fremd && <span className="as-badge as-badge-leise">in «{fremd.bezeichnung || `Gruppe ${fremd.nummer}`}»</span>}
                    </label>
                  </li>
                );
              })}
            </ul>
          </details>
        ))}
      </details>
    </section>
  );
}

export function Schritt5Gruppen({ z, dispatch, katalog }: SchrittInhaltProps) {
  const h = hauptverteiler(z);
  const gruppen = h ? z.gruppen.filter((g) => g.verteiler === h.schluessel).sort((a, b) => a.nummer - b.nummer) : [];
  const ort = h ? einheitVon(z, h)?.bezeichnung : null;
  const ohneGruppe = HEIZ_ARTEN.filter((a) => verbraucherDerArt(z, a).length > 0 && !verbraucherDerArt(z, a).some((t) => gruppeVonVerbraucher(z, t.schluessel)));
  return <>
    <Abschnitt titel="Heizgruppen" zusatz={ort ? `Hauptverteiler in ${ort}` : "Der Hauptverteiler entsteht im Raum der Zentrale."}
      aktion={<button type="button" className="as-textknopf" onClick={() => dispatch({ typ: "gruppenAnzahl", anzahl: gruppen.length + 1 })}>
        <Plus size={14} strokeWidth={1.75} aria-hidden />Gruppe</button>}>
      {gruppen.length === 0 && <div className="as-chips">
        <Hinweis>Noch keine Gruppen. Planora schlägt je Heizart eine Gruppe vor.</Hinweis>
        <button type="button" className="as-knopf as-knopf-klein" onClick={() => dispatch({ typ: "gruppenVorschlagen" })}>Gruppen vorschlagen</button>
      </div>}
      {gruppen.length > 0 && ohneGruppe.map((art) => (
        <Hinweis key={art} art="warnung">Für {HEIZ_NAME[art]} gibt es noch keine Gruppe.{" "}
          <button type="button" className="as-textknopf" onClick={() => dispatch({ typ: "gruppeFuerArt", heizart: art })}>Gruppe anlegen</button></Hinweis>
      ))}
      {gruppen.map((g) => <GruppenKarte key={g.schluessel} g={g} z={z} dispatch={dispatch} katalog={katalog} />)}
    </Abschnitt>
    <FbhVerteiler z={z} dispatch={dispatch} />
  </>;
}
```

- [ ] **Step 5: Umbenennen, Prüfen-Schritt, Index**

```bash
git mv app/web/src/assistent/schritte/Schritt7Teile.tsx app/web/src/assistent/schritte/Schritt6Teile.tsx
git mv app/web/src/assistent/schritte/Schritt8Pruefen.tsx app/web/src/assistent/schritte/Schritt7Pruefen.tsx
git rm app/web/src/assistent/schritte/Schritt6Unterverteiler.tsx
```

In den umbenannten Dateien Komponentennamen anpassen (`Schritt6Teile`, `Schritt7Pruefen`). In `Schritt7Pruefen.tsx` die Zusammenfassung auf `zusammenfassung(z, katalog)` umstellen:

```tsx
  const zeilen = zusammenfassung(z, katalog);
  ...
        {zeilen.map(({ titel, text, schritt }) => (
          <div key={titel} className="as-zusammenfassung-zeile">
            <dt>{titel}</dt><dd>{text}</dd>
            <button type="button" className="as-textknopf" onClick={() => dispatch({ typ: "schritt", nr: schritt })} aria-label={`${titel} bearbeiten (Schritt ${schritt})`}>Ändern</button>
          </div>
        ))}
```
(Zeile «Geschosse» oben behalten: `["Geschosse", z.gebaeude.geschosse.map((g) => g.code).join(", "), 1]` als erste Zeile vor den übrigen.) Nicht mehr benötigte Imports entfernen.

`index.tsx`:
```tsx
import { Schritt3Heizung } from "./Schritt3Heizung";
import { Schritt6Teile } from "./Schritt6Teile";
import { Schritt7Pruefen } from "./Schritt7Pruefen";
export const SCHRITT_INHALT: Record<SchrittNr, ComponentType<SchrittInhaltProps>> = {
  1: Schritt1Gebaeude, 2: Schritt2Einheiten, 3: Schritt3Heizung, 4: Schritt4Zentrale, 5: Schritt5Gruppen, 6: Schritt6Teile, 7: Schritt7Pruefen,
};
```
`Schritt5Vorlaeufig` entfernen. `hinweise.ts`: `ueberUnterverteiler` entfernen, wenn `grep -rn ueberUnterverteiler web/src` keine Nutzung mehr zeigt. Kommentar in `zustand.ts` bei `weitereTeile` auf «Schritt 6, ohne WMZ der FBH-Verteiler» anpassen.

- [ ] **Step 6: Tests, Typen, Build, Sichtprüfung**

Run: `npx vitest run && npm run pruefe:typen && npm run build`
Sichtprüfung wie Task 9 Step 4, Schritt 5: zwei vorgeschlagene Gruppen, «Eigene Gruppe für Gastro», «Wärmezähler an allen». Dann Übernehmen, Twin öffnen: FBH-Verteiler heissen «FBH-Verteiler», Assistent erneut öffnen: Regelgeschoss ist wieder da.

- [ ] **Step 7: Commit**

```bash
git add -A app/web/src
git commit -m "Assistent: Schritt Gruppen & FBH-Verteiler, Unterverteiler-Schritt entfaellt"
```

---

### Task 12: Abnahme – Klickzählung, Bildkritik, FM-Review, Stand

**Files:**
- Create: `docs/abnahme/2026-11-<TT>-heizungserfassung/README.md` (Datum des Durchlaufs)
- Modify: `docs/design/lessons-learned.md` (falls Skill das verlangt; Fundort laut `planora-design` Abschnitt 4)
- Modify: `CLAUDE.md` Abschnitt 0b, `docs/arbeitsjournal.md`

- [ ] **Step 1: Volle Prüfung**

Run (aus `app/`): `npx tsc --noEmit && npm test`; (aus `app/web/`): `npm run pruefe:typen && npx vitest run && npm run build`.
Expected: alles grün; Zahlen notieren (Backend ≈ 581, Web ≈ 384 + neue).

- [ ] **Step 2: Browser-Ablauf mit Klickzählung**

Testinstanz: `bash werkzeug/design/instanz.sh start` (Port 3100), Anmeldung `http://localhost:3100/entwicklung/anmelden`. Ein Agent (Rolle FM-Manager, gleicher Auftrag wie `docs/abnahme/2026-11-16-fm-review/README.md`: Bürohaus UG1+EG+OG1–OG5, 4 Büros je OG, OG5 nur 3 Büros, Gastro EG, Technik UG, WP+Speicher, HK Standard, FBH in OG4/OG5/Gastro, 3 Gruppen) erfasst das Gebäude und zählt jeden Klick und jede Eingabe je Schritt. Bilder je Schritt in den Abnahmeordner.
Expected: ≤ 40 Klicks/Eingaben [A]. Wenn mehr: Tabelle der teuersten Stellen erstellen, nicht nachbessern ohne PO.

- [ ] **Step 3: visual-critic**

Agent `visual-critic` mit echten GPU-Screenshots (`werkzeug/design/`) der Schritte 2, 3, 5 in 1440 und 1280 Breite. Bei «verbessern»: höchstens 2 weitere Runden durch `ui-ux-designer`, danach erneut Step 1.

- [ ] **Step 4: Übernehmen und Wiederöffnen prüfen**

Im gleichen Durchlauf: Übernehmen → Twin zeigt 33 Einheiten, FBH-Verteiler korrekt benannt, Status: FBH-Verteiler gestrichelt/vorgeschlagen, HK bestätigt. Assistent erneut öffnen → Regelgeschoss und Abweichung OG5 sichtbar. `bash werkzeug/design/instanz.sh stop`.

- [ ] **Step 5: Abnahme-README schreiben**

Inhalt: Klickzahl je Schritt vorher (165) / nachher, Bilder, Kritik-Ergebnis, Abweichungen, festgelegte Annahmen 1–9 dieses Plans zur PO-Bestätigung, offene Befunde aus Spec Abschnitt 8 unverändert.

- [ ] **Step 6: Stand festhalten**

Skill `claude-setup:stand` bzw. Agent `stand-halter`: neuer Block in `CLAUDE.md` 0b, Eintrag im Arbeitsjournal.

- [ ] **Step 7: Commit (kein Push)**

```bash
git add docs CLAUDE.md
git commit -m "Abnahme Heizungserfassung: Klickzaehlung, Bildkritik, Stand"
```

---

## Selbstprüfung gegen die Spec

| Spec | Task |
|---|---|
| H1 Regelgeschoss, Abweichungen | 4, 9 |
| H2 dauerhaft gespeichert, gleiche Transaktion | 1, 2, 7 |
| H3 Gruppen je Heizart, teilen, Sondergruppe | 6, 11 |
| H4 FBH-Verteiler automatisch, Begriff | 6, 8, 11 |
| H5 Hersteller/Typ am Standard | 5, 10 |
| H6 angefasst = bestätigt | 3 (Abgaben), 6 (FBH, Gruppen) |
| H7 freie Anzahl, Nummerierung, Sondergruppe, Klartext, Kleinkorrekturen | 3, 8, 9, 11 (Schritt 4), 6 (Zentrale-Raum) |
| §3 sieben Schritte | 3, 11 |
| §4.4 Status | 3, 6 |
| §5 Fehlerfälle (lösen, löschen, veraltet, ohne Vorlage) | 4, 7 |
| §6 Tests, Browser, FM-Review, Gestaltung | alle, 12 |
| §8 ausserhalb | nicht umgesetzt (Liste bleibt) |
