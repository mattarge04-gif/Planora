# Lebensdauer und Ampel – Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Der FM sieht je Gebaeude Ampel, Ersatzjahr und Kosten jedes Heizungsbauteils in Anlagenkarte, Twin-Modus "Erneuerung" und Seite "Erneuerungsplan", und kann alles als CSV exportieren.

**Architecture:** Neues Backend-Verzeichnis `app/src/lebensdauer/` (Modul `lebensdauer`, existiert im Manifest als Option): reine Rechnung mit Stichtag, Speicher fuer Migration 016, Routen unter `/api/lebensdauer/`. Web: reine Ansichtsfunktionen in `app/web/src/lebensdauer/`, darauf Anlagenkarte, Twin-Modus und eine neue Seite. Keine neue Abhaengigkeit.

**Tech Stack:** Fastify 5, pg, ajv (strikt), vitest; React 19, three/@react-three/fiber, lucide-react.

**Spec:** `docs/superpowers/specs/2026-11-19-lebensdauer-ampel-design.md` (E43 in `docs/architektur/00-kontext.md`).

## Global Constraints

- Sprache de-CH, kein Eszett; UI-Texte mit echten Umlauten, Code/Kommentare ohne (wie bestehender Code).
- **Keine Standardpreise** (PO 19.11.). Preis nur aus Handeingabe (`kunde`); Quelle `dokument` vorgesehen, hier nie gesetzt.
- Lebensdauer-Standard heisst in der UI "Planora-Richtwert".
- Fehlende Preise ueberall sichtbar ("Preis fehlt", "ohne Preis: n"); Summen dann als unvollstaendig markiert.
- 400-Fehler im bestehenden Format `{ fehler: [{ pfad, code, meldung }] }` (Server-ErrorHandler bzw. `FachFehler`).
- Rechte: Lesen `fach.lesen`, Schreiben `fach.aendern`; 404 ohne Leserecht, 403 ohne Schreibrecht (wie `zugriff()` in `src/welt/routen.ts`).
- Kein Push, kein Merge nach `main` (nur auf PO-Auftrag). Branch `m2c-interview`.
- Windows: Befehle aus `app/` bzw. `app/web/`, `npm.cmd` in PowerShell.
- Gestaltung (Tasks 8–10) ueber Skill `planora-design`, Stufe mittel.

## Abweichungen von der Spec (bewusst, beim Umsetzen in die Spec nachtragen)

1. `lebensdauer_typ` haelt **nur Kundenwerte** (keine Kopie des Standards beim ersten Zugriff). Fehlt eine Zeile, gilt der Standard aus `standard.ts`. Grund: GET laeuft read-only im Snapshot; Ergebnis fuer die Rangfolge identisch. Spalte `quelle_lebensdauer` entfaellt (Zeile mit `l_mittel` = Quelle `typ`).
2. Risiko Spec Abschnitt 5 (Assistent ueberschreibt Baujahr): geloest, indem `PUT /api/lebensdauer/...` bei geaendertem Baujahr `gebaeude.stand` erhoeht. Ein Assistent mit altem Stand bekommt dann 409 statt still zu ueberschreiben.

## Dateiuebersicht

| Datei | Verantwortung |
|---|---|
| `app/src/db/migrationen/016_lebensdauer.sql` | 3 Tabellen, Rechte |
| `app/src/lebensdauer/standard.ts` | Lebensdauer-Richtwerte je Katalog-ID, Konstanten |
| `app/src/lebensdauer/rechnung.ts` | reine Rechnung (Stichtag als Eingabe) |
| `app/src/lebensdauer/speicher.ts` | Laden/Schreiben DB |
| `app/src/lebensdauer/schema.ts` | ajv-Schema PUT |
| `app/src/lebensdauer/csv.ts` | CSV-Aufbau (rein) |
| `app/src/lebensdauer/routen.ts` | GET/PUT/CSV |
| `app/src/server.ts` | Registrierung |
| `app/entwicklung/start.ts` | Modul im Entwicklungsstart einschalten |
| `app/web/src/lebensdauer/typen.ts` | Antworttypen |
| `app/web/src/lebensdauer/ansicht.ts` | reine Ansichtsfunktionen (Farben, Legende, Karte, Balken, Eingabe) |
| `app/web/src/karten/TwinLebensdauer.tsx` | Block in der Anlagenkarte |
| `app/web/src/karten/TwinErneuerung.tsx` | Legende Twin-Modus |
| `app/web/src/seiten/Erneuerungsplan.tsx` (+ `.css`) | neue Seite |
| `app/web/src/szene3/Anlagen3.tsx`, `Technik3.tsx`, `Szene3.tsx` | Ampel-Faerbung (optionale Prop) |
| `app/web/src/seiten/Twin.tsx`, `karten/TwinSzenenTasten.tsx`, `ui/Kopfzeile.tsx`, `App.tsx` | Einbau |

---

### Task 1: Migration 016

**Files:**
- Create: `app/src/db/migrationen/016_lebensdauer.sql`
- Test: `app/test/lebensdauer-migration.test.ts`

**Interfaces:**
- Produces: Tabellen `gebaeude_erneuerung(gebaeude_id, liegenschaft_id, heizung_baujahr)`, `bauteil_akte(bauteil_id, liegenschaft_id, zustand, lebensdauer_jahre, stueckpreis, quelle_preis, notiz)`, `lebensdauer_typ(liegenschaft_id, katalog_id, l_mittel, stueckpreis, quelle_preis, gelb_jahre)`.

- [ ] **Step 1: Failing test schreiben**

```ts
// app/test/lebensdauer-migration.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { frischeDb } from "./hilfe.js";

let db: Awaited<ReturnType<typeof frischeDb>>;
let L1: string, L2: string, G1: string, GS1: string, B1: string;
const q = (sql: string, p: unknown[] = []) => db.pool.query(sql, p);

beforeAll(async () => {
  db = await frischeDb();
  L1 = (await q("insert into liegenschaft(name) values ('L1') returning id")).rows[0].id;
  L2 = (await q("insert into liegenschaft(name) values ('L2') returning id")).rows[0].id;
  G1 = (await q("insert into gebaeude(liegenschaft_id, name, grundform, breite_m, tiefe_m, regelwerk_version) values ($1,'G','quader',30,15,1) returning id", [L1])).rows[0].id;
  GS1 = (await q("insert into geschoss(liegenschaft_id, gebaeude_id, code, reihenfolge, hoehe_m) values ($1,$2,'EG',0,3.2) returning id", [L1, G1])).rows[0].id;
  B1 = (await q("insert into bauteil(liegenschaft_id, gebaeude_id, katalog_id, geschoss_id, status, reihenfolge) values ($1,$2,'heizung.verteiler',$3,'bestaetigt',0) returning id", [L1, G1, GS1])).rows[0].id;
});
afterAll(async () => { await db.ende(); });

describe("Migration 016", () => {
  it("planora_app darf die neuen Tabellen lesen und schreiben", async () => {
    for (const t of ["gebaeude_erneuerung", "bauteil_akte", "lebensdauer_typ"])
      expect((await q("select has_table_privilege('planora_app', $1, 'select,insert,update,delete') ok", [t])).rows[0].ok).toBe(true);
  });
  it("Akte prueft Zustand, Werte und Liegenschaft", async () => {
    const sql = "insert into bauteil_akte(bauteil_id, liegenschaft_id, zustand, lebensdauer_jahre, stueckpreis) values ($1,$2,$3,$4,$5)";
    await expect(q(sql, [B1, L1, "super", null, null])).rejects.toThrow(/check/);
    await expect(q(sql, [B1, L1, null, 0, null])).rejects.toThrow(/check/);
    await expect(q(sql, [B1, L1, null, null, -1])).rejects.toThrow(/check/);
    await expect(q(sql, [B1, L2, null, null, null])).rejects.toThrow(/foreign key/);
    await expect(q(sql, [B1, L1, "schlecht", 25, 1200.5])).resolves.toBeDefined();
  });
  it("Preisquelle nur kunde/dokument und nur mit Preis", async () => {
    await expect(q("update bauteil_akte set quelle_preis='planora' where bauteil_id=$1", [B1])).rejects.toThrow(/check/);
    await expect(q("update bauteil_akte set stueckpreis=null, quelle_preis='kunde' where bauteil_id=$1", [B1])).rejects.toThrow(/check/);
  });
  it("Typwerte je Liegenschaft und Katalog-ID eindeutig", async () => {
    const sql = "insert into lebensdauer_typ(liegenschaft_id, katalog_id, l_mittel) values ($1,'heizung.verteiler',$2)";
    await q(sql, [L1, 28]);
    await expect(q(sql, [L1, 30])).rejects.toThrow(/duplicate key/);
    await expect(q(sql, [L2, 30])).resolves.toBeDefined();
  });
  it("Baujahr-Standard 1800-2100", async () => {
    await expect(q("insert into gebaeude_erneuerung(gebaeude_id, liegenschaft_id, heizung_baujahr) values ($1,$2,1700)", [G1, L1])).rejects.toThrow(/check/);
    await q("insert into gebaeude_erneuerung(gebaeude_id, liegenschaft_id, heizung_baujahr) values ($1,$2,2008)", [G1, L1]);
  });
  it("Loeschen von Bauteil bzw. Gebaeude raeumt Akte und Erneuerung ab", async () => {
    await q("delete from bauteil where id=$1", [B1]);
    expect((await q("select count(*)::int n from bauteil_akte")).rows[0].n).toBe(0);
    await q("delete from gebaeude where id=$1", [G1]);
    expect((await q("select count(*)::int n from gebaeude_erneuerung")).rows[0].n).toBe(0);
  });
});
```

- [ ] **Step 2: Test laufen lassen, muss scheitern**

Run (aus `app/`): `npx vitest run test/lebensdauer-migration.test.ts`
Expected: FAIL, `relation "bauteil_akte" does not exist`.

- [ ] **Step 3: Migration schreiben**

```sql
-- app/src/db/migrationen/016_lebensdauer.sql
-- Lebensdauer/Ampel (Spec 2026-11-19, E43). Standard-Lebensdauer liegt im Code (src/lebensdauer/standard.ts);
-- hier stehen nur Kundenwerte. Keine Standardpreise (PO 19.11.).
create table gebaeude_erneuerung(
  gebaeude_id uuid primary key,
  liegenschaft_id uuid not null,
  heizung_baujahr int check (heizung_baujahr between 1800 and 2100),
  foreign key (gebaeude_id, liegenschaft_id) references gebaeude(id, liegenschaft_id) on delete cascade
);
create table bauteil_akte(
  bauteil_id uuid primary key,
  liegenschaft_id uuid not null,
  zustand text check (zustand in ('gut','mittel','schlecht','kritisch')),
  lebensdauer_jahre int check (lebensdauer_jahre between 1 and 150),
  stueckpreis numeric(12,2) check (stueckpreis >= 0),
  quelle_preis text check (quelle_preis in ('kunde','dokument')),
  notiz text check (length(notiz) <= 2000),
  check ((stueckpreis is null) = (quelle_preis is null)),
  foreign key (bauteil_id, liegenschaft_id) references bauteil(id, liegenschaft_id) on delete cascade
);
create table lebensdauer_typ(
  liegenschaft_id uuid not null references liegenschaft(id) on delete cascade,
  katalog_id text not null check (length(katalog_id) <= 100),
  l_mittel int check (l_mittel between 1 and 150),
  stueckpreis numeric(12,2) check (stueckpreis >= 0),
  quelle_preis text check (quelle_preis in ('kunde','dokument')),
  gelb_jahre int check (gelb_jahre between 0 and 20),
  check ((stueckpreis is null) = (quelle_preis is null)),
  primary key (liegenschaft_id, katalog_id)
);
grant select, insert, update, delete on gebaeude_erneuerung, bauteil_akte, lebensdauer_typ to planora_app;
```

Hinweis: der Test "Preisquelle ... nur mit Preis" setzt im ersten Update `quelle_preis='planora'` bei vorhandenem Preis -> scheitert am `in`-Check; im zweiten `stueckpreis=null` mit Quelle -> scheitert am Paar-Check.

- [ ] **Step 4: Test laufen lassen**

Run: `npx vitest run test/lebensdauer-migration.test.ts test/migrator.test.ts test/update.test.ts`
Expected: PASS. Falls `migrator.test.ts`/`update.test.ts` eine feste letzte Migration erwarten: sie leiten sie ab (Stand 11.11.), sonst Erwartung auf 016 anpassen.

- [ ] **Step 5: Commit**

```bash
git add app/src/db/migrationen/016_lebensdauer.sql app/test/lebensdauer-migration.test.ts
git commit -m "Lebensdauer: Migration 016 (Akte, Typwerte, Baujahr-Standard)"
```

---

### Task 2: Standard und Rechnung (rein)

**Files:**
- Create: `app/src/lebensdauer/standard.ts`, `app/src/lebensdauer/rechnung.ts`
- Test: `app/test/lebensdauer-rechnung.test.ts`

**Interfaces:**
- Produces:
```ts
// standard.ts
export const GELB_JAHRE = 3;
export const ZUSTAND_ABZUG: Record<"gut"|"mittel"|"schlecht", number>; // 0/2/5, kritisch = sofort
export const STANDARD_LEBENSDAUER: Record<string, number>;             // Katalog-ID -> L mittel
export const lebensdauerBereich: (mittel: number) => { min: number; max: number };
// rechnung.ts
export type Zustand = "gut" | "mittel" | "schlecht" | "kritisch";
export type Ampel = "gruen" | "gelb" | "rot" | "grau";
export interface RechenBauteil { id: string; katalogId: string; menge: number | null; baujahr: number | null;
  akte: { zustand: Zustand | null; lebensdauerJahre: number | null; stueckpreis: number | null; quellePreis: "kunde" | "dokument" | null } | null }
export interface RechenTyp { katalogId: string; lMittel: number | null; stueckpreis: number | null; quellePreis: "kunde" | "dokument" | null; gelbJahre: number | null }
export interface BauteilErgebnis { id: string; ampel: Ampel; baujahr: number | null; ersatzjahr: number | null; restjahre: number | null;
  lebensdauer: number; stueckpreis: number | null; kosten: number | null; mengeAngenommen: boolean;
  quellen: { baujahr: "bauteil" | "gebaeude" | null; lebensdauer: "bauteil" | "typ" | "planora"; preis: "bauteil" | "typ" | null; preisHerkunft: "kunde" | "dokument" | null } }
export interface JahresSumme { jahr: number; betrag: number; ohnePreis: number; anzahl: number }
export interface Ergebnis { stichtag: number; bauteile: BauteilErgebnis[]; jahre: JahresSumme[];
  summe5: { betrag: number; ohnePreis: number }; zaehler: Record<Ampel, number> }
export function rechne(e: { stichtag: number; heizungBaujahr: number | null; bauteile: RechenBauteil[]; typen: RechenTyp[] }): Ergebnis;
```

- [ ] **Step 1: Failing tests schreiben**

```ts
// app/test/lebensdauer-rechnung.test.ts
import { describe, it, expect } from "vitest";
import { rechne, type RechenBauteil } from "../src/lebensdauer/rechnung.js";
import { STANDARD_LEBENSDAUER, lebensdauerBereich } from "../src/lebensdauer/standard.js";
import { KATALOG_V2 } from "../src/welt/katalog.v2.js";

const bt = (p: Partial<RechenBauteil> & { id: string }): RechenBauteil =>
  ({ katalogId: "heizung.umwaelzpumpe", menge: 1, baujahr: null, akte: null, ...p });
const akte = (a: Partial<NonNullable<RechenBauteil["akte"]>>) => ({ zustand: null, lebensdauerJahre: null, stueckpreis: null, quellePreis: null, ...a });

describe("Standard", () => {
  it("jede Katalog-ID v2 hat eine Lebensdauer, keine Preise", () => {
    for (const e of KATALOG_V2.eintraege) expect(STANDARD_LEBENSDAUER[e.id], e.id).toBeGreaterThan(0);
  });
  it("Bereich 0.75/1.25 gerundet", () => expect(lebensdauerBereich(20)).toEqual({ min: 15, max: 25 }));
});

describe("rechne", () => {
  const S = 2026;
  it("ohne Baujahr grau, keine Kosten im Plan", () => {
    const r = rechne({ stichtag: S, heizungBaujahr: null, bauteile: [bt({ id: "a" })], typen: [] });
    expect(r.bauteile[0]).toMatchObject({ ampel: "grau", ersatzjahr: null, kosten: null, quellen: { baujahr: null } });
    expect(r.zaehler.grau).toBe(1);
    expect(r.jahre.every((j) => j.anzahl === 0)).toBe(true);
  });
  it("Rangfolge Baujahr Bauteil > Gebaeude, Lebensdauer Bauteil > Typ > Standard", () => {
    const r = rechne({ stichtag: S, heizungBaujahr: 2010, typen: [{ katalogId: "heizung.umwaelzpumpe", lMittel: 15, stueckpreis: null, quellePreis: null, gelbJahre: null }], bauteile: [
      bt({ id: "std" , katalogId: "heizung.verteiler" }),
      bt({ id: "typ" }),
      bt({ id: "eig", baujahr: 2020, akte: akte({ lebensdauerJahre: 4 }) }),
    ] });
    const [std, typ, eig] = r.bauteile;
    expect(std).toMatchObject({ baujahr: 2010, ersatzjahr: 2040, quellen: { baujahr: "gebaeude", lebensdauer: "planora" } });
    expect(typ).toMatchObject({ ersatzjahr: 2025, quellen: { lebensdauer: "typ" } });
    expect(eig).toMatchObject({ baujahr: 2020, ersatzjahr: 2024, quellen: { baujahr: "bauteil", lebensdauer: "bauteil" } });
  });
  it("Ampel: rot <= Stichtag, gelb <= Stichtag+3, sonst gruen; Schwelle je Typ", () => {
    const r = rechne({ stichtag: S, heizungBaujahr: null, typen: [{ katalogId: "heizung.wmz", lMittel: null, stueckpreis: null, quellePreis: null, gelbJahre: 0 }], bauteile: [
      bt({ id: "rot", baujahr: 2014 }),   // 2014+12 = 2026
      bt({ id: "gelb", baujahr: 2017 }),  // 2029
      bt({ id: "gruen", baujahr: 2018 }), // 2030
      bt({ id: "wmz", katalogId: "heizung.wmz", baujahr: 2017 }), // 2027, Schwelle 0 -> gruen
    ] });
    expect(r.bauteile.map((b) => b.ampel)).toEqual(["rot", "gelb", "gruen", "gruen"]);
  });
  it("Zustand zieht ab: mittel -2, schlecht -5, kritisch = Stichtag", () => {
    const r = rechne({ stichtag: S, heizungBaujahr: 2020, typen: [], bauteile: [
      bt({ id: "m", akte: akte({ zustand: "mittel" }) }), bt({ id: "s", akte: akte({ zustand: "schlecht" }) }),
      bt({ id: "k", akte: akte({ zustand: "kritisch" }) }), bt({ id: "g", akte: akte({ zustand: "gut" }) }),
    ] });
    expect(r.bauteile.map((b) => b.ersatzjahr)).toEqual([2030, 2027, 2026, 2032]);
    expect(r.bauteile[2].ampel).toBe("rot");
  });
  it("Kosten Menge x Preis, Preis Bauteil > Typ, ohne Preis null und gezaehlt", () => {
    const r = rechne({ stichtag: S, heizungBaujahr: 2016, typen: [{ katalogId: "heizung.umwaelzpumpe", lMittel: null, stueckpreis: 900, quellePreis: "kunde", gelbJahre: null }], bauteile: [
      bt({ id: "typ", menge: 3 }),
      bt({ id: "eig", menge: 2, akte: akte({ stueckpreis: 1000, quellePreis: "kunde" }) }),
      bt({ id: "los", katalogId: "heizung.wmz", menge: 4 }),
      bt({ id: "unbek", menge: null }),
    ] });
    const [typ, eig, los, unbek] = r.bauteile;
    expect(typ).toMatchObject({ kosten: 2700, quellen: { preis: "typ", preisHerkunft: "kunde" } });
    expect(eig).toMatchObject({ kosten: 2000, quellen: { preis: "bauteil" } });
    expect(los).toMatchObject({ kosten: null, stueckpreis: null, quellen: { preis: null } });
    expect(unbek).toMatchObject({ kosten: 900, mengeAngenommen: true });
  });
  it("Jahressummen: 10 Jahre ab Stichtag, Ueberfaelliges im Stichtagsjahr, Summe 5 J.", () => {
    const r = rechne({ stichtag: S, heizungBaujahr: null, typen: [{ katalogId: "heizung.umwaelzpumpe", lMittel: null, stueckpreis: 100, quellePreis: "kunde", gelbJahre: null }], bauteile: [
      bt({ id: "alt", baujahr: 1990 }),          // 2002 -> 2026
      bt({ id: "j2", baujahr: 2016 }),           // 2028
      bt({ id: "j6", baujahr: 2020 }),           // 2032 (ausserhalb 5 J.)
      bt({ id: "fern", baujahr: 2025 }),         // 2037 (ausserhalb 10 J.)
      bt({ id: "los", katalogId: "heizung.wmz", baujahr: 2017 }), // 2027, ohne Preis
    ] });
    expect(r.jahre.map((j) => j.jahr)).toEqual([2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035]);
    expect(r.jahre[0]).toEqual({ jahr: 2026, betrag: 100, ohnePreis: 0, anzahl: 1 });
    expect(r.jahre[1]).toEqual({ jahr: 2027, betrag: 0, ohnePreis: 1, anzahl: 1 });
    expect(r.jahre[2].betrag).toBe(100);
    expect(r.jahre[6].betrag).toBe(100);
    expect(r.summe5).toEqual({ betrag: 200, ohnePreis: 1 });
    expect(r.jahre.reduce((s, j) => s + j.anzahl, 0)).toBe(4);
  });
});
```

- [ ] **Step 2: Laufen lassen, muss scheitern**

Run: `npx vitest run test/lebensdauer-rechnung.test.ts`
Expected: FAIL, Modul `../src/lebensdauer/rechnung.js` nicht gefunden.

- [ ] **Step 3: Implementieren**

```ts
// app/src/lebensdauer/standard.ts
/** Planora-Richtwerte Lebensdauer in Jahren (Spec 2026-11-19 Abschnitt 3) [A, fachlich nicht freigegeben].
 *  Keine Standardpreise (PO 19.11.). Neue Katalog-IDs brauchen hier einen Eintrag (Test prueft das). */
export const STANDARD_LEBENSDAUER: Record<string, number> = {
  "heizung.waermepumpe": 20, "heizung.gaskessel": 20, "heizung.oelkessel": 20,
  "heizung.fernwaerme_uebergabe": 30, "heizung.speicher": 25, "heizung.umwaelzpumpe": 12,
  "heizung.verteiler": 30, "heizung.wmz": 10, "heizung.heizkoerper": 40,
  "heizung.fbh_kreis": 50, "heizung.tabs_feld": 50, "heizung.ventil_3weg": 20, "heizung.ventil_2weg": 20,
};
export const ERSATZ_LEBENSDAUER = 20; // unbekannte Katalog-ID [A]
export const GELB_JAHRE = 3;          // [A]
export const ZUSTAND_ABZUG = { gut: 0, mittel: 2, schlecht: 5 } as const; // kritisch = sofort [A]
export const lebensdauerBereich = (mittel: number) => ({ min: Math.round(mittel * 0.75), max: Math.round(mittel * 1.25) });
```

```ts
// app/src/lebensdauer/rechnung.ts
import { ERSATZ_LEBENSDAUER, GELB_JAHRE, STANDARD_LEBENSDAUER, ZUSTAND_ABZUG } from "./standard.js";

export type Zustand = "gut" | "mittel" | "schlecht" | "kritisch";
export type Ampel = "gruen" | "gelb" | "rot" | "grau";
export type PreisHerkunft = "kunde" | "dokument";
export interface RechenBauteil { id: string; katalogId: string; menge: number | null; baujahr: number | null;
  akte: { zustand: Zustand | null; lebensdauerJahre: number | null; stueckpreis: number | null; quellePreis: PreisHerkunft | null } | null }
export interface RechenTyp { katalogId: string; lMittel: number | null; stueckpreis: number | null; quellePreis: PreisHerkunft | null; gelbJahre: number | null }
export interface BauteilErgebnis { id: string; ampel: Ampel; baujahr: number | null; ersatzjahr: number | null; restjahre: number | null;
  lebensdauer: number; stueckpreis: number | null; kosten: number | null; mengeAngenommen: boolean;
  quellen: { baujahr: "bauteil" | "gebaeude" | null; lebensdauer: "bauteil" | "typ" | "planora"; preis: "bauteil" | "typ" | null; preisHerkunft: PreisHerkunft | null } }
export interface JahresSumme { jahr: number; betrag: number; ohnePreis: number; anzahl: number }
export interface Ergebnis { stichtag: number; bauteile: BauteilErgebnis[]; jahre: JahresSumme[];
  summe5: { betrag: number; ohnePreis: number }; zaehler: Record<Ampel, number> }

const JAHRE = 10;
const rund = (x: number) => Math.round(x * 100) / 100;

/** Reine Rechnung (Spec Abschnitt 4). Keine Uhr, keine DB: der Stichtag kommt vom Aufrufer. */
export function rechne(e: { stichtag: number; heizungBaujahr: number | null; bauteile: RechenBauteil[]; typen: RechenTyp[] }): Ergebnis {
  const typ = new Map(e.typen.map((t) => [t.katalogId, t]));
  const jahre: JahresSumme[] = Array.from({ length: JAHRE }, (_, i) => ({ jahr: e.stichtag + i, betrag: 0, ohnePreis: 0, anzahl: 0 }));
  const zaehler: Record<Ampel, number> = { gruen: 0, gelb: 0, rot: 0, grau: 0 };
  const bauteile = e.bauteile.map((b): BauteilErgebnis => {
    const t = typ.get(b.katalogId), a = b.akte;
    const baujahr = b.baujahr ?? e.heizungBaujahr;
    const qBaujahr = b.baujahr !== null ? "bauteil" : e.heizungBaujahr !== null ? "gebaeude" : null;
    const lebensdauer = a?.lebensdauerJahre ?? t?.lMittel ?? STANDARD_LEBENSDAUER[b.katalogId] ?? ERSATZ_LEBENSDAUER;
    const qLebensdauer = a?.lebensdauerJahre != null ? "bauteil" : t?.lMittel != null ? "typ" : "planora";
    const preisAkte = a?.stueckpreis ?? null;
    const stueckpreis = preisAkte ?? t?.stueckpreis ?? null;
    const qPreis = preisAkte !== null ? "bauteil" : stueckpreis !== null ? "typ" : null;
    const preisHerkunft = qPreis === "bauteil" ? a!.quellePreis : qPreis === "typ" ? t!.quellePreis : null;
    const mengeAngenommen = b.menge === null;
    const kosten = stueckpreis === null ? null : rund((b.menge ?? 1) * stueckpreis);
    let ersatzjahr: number | null = null, ampel: Ampel = "grau";
    if (baujahr !== null) {
      ersatzjahr = a?.zustand === "kritisch" ? e.stichtag : baujahr + lebensdauer - (a?.zustand ? ZUSTAND_ABZUG[a.zustand] : 0);
      const gelb = t?.gelbJahre ?? GELB_JAHRE;
      ampel = ersatzjahr <= e.stichtag ? "rot" : ersatzjahr <= e.stichtag + gelb ? "gelb" : "gruen";
      const j = jahre[Math.max(ersatzjahr, e.stichtag) - e.stichtag];
      if (j) { j.anzahl++; if (kosten === null) j.ohnePreis++; else j.betrag = rund(j.betrag + kosten); }
    }
    zaehler[ampel]++;
    return { id: b.id, ampel, baujahr, ersatzjahr, restjahre: ersatzjahr === null ? null : Math.max(0, ersatzjahr - e.stichtag),
      lebensdauer, stueckpreis, kosten, mengeAngenommen,
      quellen: { baujahr: qBaujahr, lebensdauer: qLebensdauer, preis: qPreis, preisHerkunft } };
  });
  const fuenf = jahre.slice(0, 5);
  return { stichtag: e.stichtag, bauteile, jahre, zaehler,
    summe5: { betrag: rund(fuenf.reduce((s, j) => s + j.betrag, 0)), ohnePreis: fuenf.reduce((s, j) => s + j.ohnePreis, 0) } };
}
```

- [ ] **Step 4: Laufen lassen**

Run: `npx vitest run test/lebensdauer-rechnung.test.ts`
Expected: PASS (8 Tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/lebensdauer/standard.ts app/src/lebensdauer/rechnung.ts app/test/lebensdauer-rechnung.test.ts
git commit -m "Lebensdauer: Richtwerte und reine Rechnung mit Stichtag"
```

---

### Task 3: Speicher (Laden und Schreiben)

**Files:**
- Create: `app/src/lebensdauer/speicher.ts`
- Test: `app/test/lebensdauer-speicher.test.ts`

**Interfaces:**
- Consumes: `rechne`, Typen aus Task 2; `FachFehler` aus `src/welt/speicher.ts`; `ladeBeschreibung`, `schreibeBeschreibung` (nur im Test).
- Produces:
```ts
export interface LebensdauerBauteil { id: string; katalogId: string; menge: number | null; baujahr: number | null;
  hersteller: string | null; typ: string | null; ort: string; // "EG · Büro A" bzw. "EG"
  akte: { zustand: Zustand | null; lebensdauerJahre: number | null; stueckpreis: number | null; quellePreis: PreisHerkunft | null; notiz: string | null } | null }
export interface LebensdauerStand { gebaeudeId: string; stand: number; heizungBaujahr: number | null;
  typen: (RechenTyp & { standard: number; bereich: { min: number; max: number } })[]; // je im Gebaeude vorkommende Katalog-ID
  bauteile: LebensdauerBauteil[]; ergebnis: Ergebnis }
export interface LebensdauerEingabe { stand: number; heizungBaujahr?: number | null;
  bauteile?: { id: string; baujahr?: number | null; zustand?: Zustand | null; lebensdauerJahre?: number | null; stueckpreis?: number | null; notiz?: string | null }[];
  typen?: { katalogId: string; lMittel?: number | null; stueckpreis?: number | null; gelbJahre?: number | null }[] }
export async function ladeLebensdauer(c: pg.ClientBase, gebaeudeId: string, stichtag: number): Promise<LebensdauerStand | null>;
export async function schreibeLebensdauer(c: pg.ClientBase, gebaeudeId: string, e: LebensdauerEingabe): Promise<{ bauteile: number; typen: number; baujahrGeaendert: boolean }>;
```
- Regeln `schreibeLebensdauer`: sperrt `gebaeude ... for update`; `e.stand !== gebaeude.stand` -> `FachFehler([{pfad:"stand", code:"stand_veraltet", ...}], 409)`; fremde Bauteil-ID -> `FachFehler([{pfad:"bauteile/<i>/id", code:"bauteil_unbekannt", ...}], 400)`; Feld weggelassen = unveraendert, `null` = loeschen; gesetzter Preis -> `quelle_preis='kunde'`; aendert sich ein `baujahr` (Bauteil oder Standard): `update gebaeude set stand=stand+1`. Zeilen in `bauteil_akte`/`lebensdauer_typ`, die danach nur `null` enthalten, werden geloescht.

- [ ] **Step 1: Failing tests schreiben**

```ts
// app/test/lebensdauer-speicher.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { frischeDb } from "./hilfe.js";
import { ladeLebensdauer, schreibeLebensdauer } from "../src/lebensdauer/speicher.js";
import { ladeBeschreibung, schreibeBeschreibung, legeGebaeudeAn } from "../src/welt/speicher.js";
import { REGELWERK_V1 } from "../src/welt/regelwerk.v1.js";
import { regelwerkFuer } from "../src/welt/regelwerk.wahl.js";
import { KATALOG_V1 } from "../src/welt/katalog.v1.js";

let db: Awaited<ReturnType<typeof frischeDb>>;
let L: string, G: string, ids: string[];
const S = 2026;

beforeAll(async () => {
  db = await frischeDb();
  L = (await db.pool.query("insert into liegenschaft(name) values ('L') returning id")).rows[0].id;
  const c = await db.pool.connect();
  try {
    G = await legeGebaeudeAn(c, L, { name: "H", grundform: "quader", breiteM: 30, tiefeM: 15, geschosse: [{ code: "EG" }] } as any, REGELWERK_V1);
    const leer = (await ladeBeschreibung(c, G))!;
    await schreibeBeschreibung(c, G, { ...leer, heizungStandard: { hk: "ja", fbh: "nein", tabs: "nein" },
      einheiten: [{ geschossId: leer.geschosse[0].id, bezeichnung: "Technik", art: "technik", flaecheM2: null }],
      bauteile: [
        { katalogId: "heizung.verteiler", standort: { einheitIndex: 0 }, menge: 1, status: "bestaetigt", versorgt: [] },
        { katalogId: "heizung.heizkoerper", standort: { einheitIndex: 0 }, menge: 10, status: "bestaetigt", versorgt: [] },
      ] } as any, regelwerkFuer(1), KATALOG_V1);
    ids = (await ladeBeschreibung(c, G))!.bauteile.map((b) => b.id!);
  } finally { c.release(); }
});
afterAll(async () => { await db.ende(); });

const mit = <T>(f: (c: any) => Promise<T>) => db.pool.connect().then(async (c) => { try { return await f(c); } finally { c.release(); } });

describe("Lebensdauer-Speicher", () => {
  it("laedt ohne Kundenwerte: grau, Typen mit Standard", async () => {
    const s = (await mit((c) => ladeLebensdauer(c, G, S)))!;
    expect(s.heizungBaujahr).toBeNull();
    expect(s.ergebnis.zaehler.grau).toBe(2);
    expect(s.typen.map((t) => t.katalogId).sort()).toEqual(["heizung.heizkoerper", "heizung.verteiler"]);
    expect(s.typen.find((t) => t.katalogId === "heizung.verteiler")).toMatchObject({ lMittel: null, standard: 30, stueckpreis: null });
    expect(s.bauteile[0].ort).toBe("EG · Technik");
  });
  it("unbekanntes Gebaeude -> null", async () => {
    expect(await mit((c) => ladeLebensdauer(c, "00000000-0000-4000-8000-000000000999", S))).toBeNull();
  });
  it("schreibt Standard, Akte, Typ; Baujahr erhoeht den Stand", async () => {
    const vor = (await mit((c) => ladeLebensdauer(c, G, S)))!;
    const r = await mit((c) => schreibeLebensdauer(c, G, { stand: vor.stand, heizungBaujahr: 2008,
      bauteile: [{ id: ids[0], zustand: "schlecht", stueckpreis: 2500, notiz: "undicht" }],
      typen: [{ katalogId: "heizung.heizkoerper", stueckpreis: 800 }] }));
    expect(r).toEqual({ bauteile: 1, typen: 1, baujahrGeaendert: true });
    const s = (await mit((c) => ladeLebensdauer(c, G, S)))!;
    expect(s.stand).toBe(vor.stand + 1);
    expect(s.bauteile[0].akte).toMatchObject({ zustand: "schlecht", stueckpreis: 2500, quellePreis: "kunde", notiz: "undicht" });
    expect(s.ergebnis.bauteile[0]).toMatchObject({ ersatzjahr: 2033, kosten: 2500 });      // 2008+30-5
    expect(s.ergebnis.bauteile[1]).toMatchObject({ ersatzjahr: 2048, kosten: 8000, quellen: { preis: "typ" } });
  });
  it("ohne Baujahraenderung bleibt der Stand; null loescht", async () => {
    const vor = (await mit((c) => ladeLebensdauer(c, G, S)))!;
    await mit((c) => schreibeLebensdauer(c, G, { stand: vor.stand, bauteile: [{ id: ids[0], zustand: null, stueckpreis: null, notiz: null }] }));
    const s = (await mit((c) => ladeLebensdauer(c, G, S)))!;
    expect(s.stand).toBe(vor.stand);
    expect(s.bauteile[0].akte).toBeNull();
    expect((await db.pool.query("select count(*)::int n from bauteil_akte")).rows[0].n).toBe(0);
  });
  it("veralteter Stand -> 409, fremde Bauteil-ID -> 400", async () => {
    const vor = (await mit((c) => ladeLebensdauer(c, G, S)))!;
    await expect(mit((c) => schreibeLebensdauer(c, G, { stand: vor.stand - 1 }))).rejects.toMatchObject({ status: 409 });
    await expect(mit((c) => schreibeLebensdauer(c, G, { stand: vor.stand, bauteile: [{ id: "00000000-0000-4000-8000-000000000999", zustand: "gut" }] })))
      .rejects.toMatchObject({ status: 400 });
  });
  it("Akte ueberlebt erneutes Uebernehmen der Beschreibung mit gleichen IDs", async () => {
    const vor = (await mit((c) => ladeLebensdauer(c, G, S)))!;
    await mit((c) => schreibeLebensdauer(c, G, { stand: vor.stand, bauteile: [{ id: ids[1], zustand: "mittel" }] }));
    await mit(async (c) => { const b = (await ladeBeschreibung(c, G))!; await schreibeBeschreibung(c, G, b, regelwerkFuer(1), KATALOG_V1); });
    const s = (await mit((c) => ladeLebensdauer(c, G, S)))!;
    expect(s.bauteile.find((b) => b.id === ids[1])!.akte?.zustand).toBe("mittel");
  });
});
```

Hinweis an den Umsetzer: Signaturen von `legeGebaeudeAn`/`schreibeBeschreibung` in `src/welt/speicher.ts` pruefen (Stand 19.11.: `legeGebaeudeAn(c, lid, huelle, rw)`, `schreibeBeschreibung(c, id, b, rw, katalog)`); bei Abweichung den Test anpassen, nicht den Welt-Speicher.

- [ ] **Step 2: Laufen lassen, muss scheitern**

Run: `npx vitest run test/lebensdauer-speicher.test.ts`
Expected: FAIL, Modul `speicher.js` fehlt.

- [ ] **Step 3: Implementieren**

```ts
// app/src/lebensdauer/speicher.ts
import type pg from "pg";
import { FachFehler } from "../welt/speicher.js";
import { rechne, type Ergebnis, type PreisHerkunft, type RechenTyp, type Zustand } from "./rechnung.js";
import { ERSATZ_LEBENSDAUER, STANDARD_LEBENSDAUER, lebensdauerBereich } from "./standard.js";

export interface LebensdauerBauteil { id: string; katalogId: string; menge: number | null; baujahr: number | null;
  hersteller: string | null; typ: string | null; ort: string;
  akte: { zustand: Zustand | null; lebensdauerJahre: number | null; stueckpreis: number | null; quellePreis: PreisHerkunft | null; notiz: string | null } | null }
export interface LebensdauerStand { gebaeudeId: string; stand: number; heizungBaujahr: number | null;
  typen: (RechenTyp & { standard: number; bereich: { min: number; max: number } })[];
  bauteile: LebensdauerBauteil[]; ergebnis: Ergebnis }
export interface LebensdauerEingabe { stand: number; heizungBaujahr?: number | null;
  bauteile?: { id: string; baujahr?: number | null; zustand?: Zustand | null; lebensdauerJahre?: number | null; stueckpreis?: number | null; notiz?: string | null }[];
  typen?: { katalogId: string; lMittel?: number | null; stueckpreis?: number | null; gelbJahre?: number | null }[] }

const zahl = (v: string | number | null) => (v === null ? null : Number(v));

export async function ladeLebensdauer(c: pg.ClientBase, gebaeudeId: string, stichtag: number): Promise<LebensdauerStand | null> {
  const g = (await c.query("select liegenschaft_id, stand from gebaeude where id=$1", [gebaeudeId])).rows[0];
  if (!g) return null;
  const heizungBaujahr = (await c.query("select heizung_baujahr from gebaeude_erneuerung where gebaeude_id=$1", [gebaeudeId])).rows[0]?.heizung_baujahr ?? null;
  const zeilen = (await c.query(
    `select b.id, b.katalog_id, b.menge, b.baujahr, b.hersteller, b.typ,
            coalesce(gs.code, ge.code) geschoss, e.bezeichnung einheit,
            a.bauteil_id akte, a.zustand, a.lebensdauer_jahre, a.stueckpreis, a.quelle_preis, a.notiz
       from bauteil b
       left join einheit e on e.id = b.einheit_id
       left join geschoss ge on ge.id = e.geschoss_id
       left join geschoss gs on gs.id = b.geschoss_id
       left join bauteil_akte a on a.bauteil_id = b.id
      where b.gebaeude_id=$1 order by b.reihenfolge`, [gebaeudeId])).rows;
  const typZeilen = new Map((await c.query("select katalog_id, l_mittel, stueckpreis, quelle_preis, gelb_jahre from lebensdauer_typ where liegenschaft_id=$1", [g.liegenschaft_id]))
    .rows.map((r) => [r.katalog_id as string, r]));
  const bauteile: LebensdauerBauteil[] = zeilen.map((r) => ({
    id: r.id, katalogId: r.katalog_id, menge: r.menge, baujahr: r.baujahr, hersteller: r.hersteller, typ: r.typ,
    ort: r.einheit ? `${r.geschoss} · ${r.einheit}` : r.geschoss,
    akte: r.akte ? { zustand: r.zustand, lebensdauerJahre: r.lebensdauer_jahre, stueckpreis: zahl(r.stueckpreis), quellePreis: r.quelle_preis, notiz: r.notiz } : null,
  }));
  const typen = [...new Set(bauteile.map((b) => b.katalogId))].map((katalogId) => {
    const t = typZeilen.get(katalogId), standard = STANDARD_LEBENSDAUER[katalogId] ?? ERSATZ_LEBENSDAUER;
    return { katalogId, lMittel: t?.l_mittel ?? null, stueckpreis: zahl(t?.stueckpreis ?? null), quellePreis: t?.quelle_preis ?? null,
      gelbJahre: t?.gelb_jahre ?? null, standard, bereich: lebensdauerBereich(standard) };
  });
  const ergebnis = rechne({ stichtag, heizungBaujahr, typen, bauteile: bauteile.map((b) => ({ id: b.id, katalogId: b.katalogId, menge: b.menge, baujahr: b.baujahr, akte: b.akte })) });
  return { gebaeudeId, stand: g.stand, heizungBaujahr, typen, bauteile, ergebnis };
}

/** Feld weggelassen = unveraendert, null = loeschen. Baujahr-Aenderung erhoeht gebaeude.stand (Assistent mit altem Stand -> 409). */
export async function schreibeLebensdauer(c: pg.ClientBase, gebaeudeId: string, e: LebensdauerEingabe) {
  const g = (await c.query("select liegenschaft_id, stand from gebaeude where id=$1 for update", [gebaeudeId])).rows[0];
  if (!g) throw new FachFehler([{ pfad: "gebaeude", code: "nicht_gefunden", meldung: "Gebaeude nicht gefunden" }], 404);
  if (e.stand !== g.stand) throw new FachFehler([{ pfad: "stand", code: "stand_veraltet", meldung: "Daten wurden inzwischen geaendert; bitte neu laden" }], 409);
  const L = g.liegenschaft_id as string;
  let baujahrGeaendert = false;
  if (e.heizungBaujahr !== undefined) {
    const alt = (await c.query("select heizung_baujahr from gebaeude_erneuerung where gebaeude_id=$1", [gebaeudeId])).rows[0]?.heizung_baujahr ?? null;
    if (alt !== e.heizungBaujahr) baujahrGeaendert = true;
    await c.query(`insert into gebaeude_erneuerung(gebaeude_id, liegenschaft_id, heizung_baujahr) values ($1,$2,$3)
      on conflict (gebaeude_id) do update set heizung_baujahr=excluded.heizung_baujahr`, [gebaeudeId, L, e.heizungBaujahr]);
  }
  const eigene = new Map((await c.query("select id, baujahr from bauteil where gebaeude_id=$1", [gebaeudeId])).rows.map((r) => [r.id as string, r.baujahr as number | null]));
  for (const [i, b] of (e.bauteile ?? []).entries()) {
    const id = b.id.toLowerCase();
    if (!eigene.has(id)) throw new FachFehler([{ pfad: `bauteile/${i}/id`, code: "bauteil_unbekannt", meldung: "Bauteil gehoert nicht zu diesem Gebaeude" }], 400);
    if (b.baujahr !== undefined && b.baujahr !== eigene.get(id)) {
      baujahrGeaendert = true;
      await c.query("update bauteil set baujahr=$2 where id=$1", [id, b.baujahr]);
    }
    const alt = (await c.query("select zustand, lebensdauer_jahre, stueckpreis, notiz from bauteil_akte where bauteil_id=$1", [id])).rows[0] ?? {};
    const neu = {
      zustand: b.zustand !== undefined ? b.zustand : alt.zustand ?? null,
      lebensdauer: b.lebensdauerJahre !== undefined ? b.lebensdauerJahre : alt.lebensdauer_jahre ?? null,
      preis: b.stueckpreis !== undefined ? b.stueckpreis : zahl(alt.stueckpreis ?? null),
      notiz: b.notiz !== undefined ? b.notiz : alt.notiz ?? null,
    };
    if (Object.values(neu).every((v) => v === null)) await c.query("delete from bauteil_akte where bauteil_id=$1", [id]);
    else await c.query(`insert into bauteil_akte(bauteil_id, liegenschaft_id, zustand, lebensdauer_jahre, stueckpreis, quelle_preis, notiz)
      values ($1,$2,$3,$4,$5,$6,$7) on conflict (bauteil_id) do update set zustand=excluded.zustand, lebensdauer_jahre=excluded.lebensdauer_jahre,
      stueckpreis=excluded.stueckpreis, quelle_preis=excluded.quelle_preis, notiz=excluded.notiz`,
      [id, L, neu.zustand, neu.lebensdauer, neu.preis, neu.preis === null ? null : "kunde", neu.notiz]);
  }
  for (const t of e.typen ?? []) {
    const alt = (await c.query("select l_mittel, stueckpreis, gelb_jahre from lebensdauer_typ where liegenschaft_id=$1 and katalog_id=$2", [L, t.katalogId])).rows[0] ?? {};
    const neu = { l: t.lMittel !== undefined ? t.lMittel : alt.l_mittel ?? null, preis: t.stueckpreis !== undefined ? t.stueckpreis : zahl(alt.stueckpreis ?? null),
      gelb: t.gelbJahre !== undefined ? t.gelbJahre : alt.gelb_jahre ?? null };
    if (Object.values(neu).every((v) => v === null)) await c.query("delete from lebensdauer_typ where liegenschaft_id=$1 and katalog_id=$2", [L, t.katalogId]);
    else await c.query(`insert into lebensdauer_typ(liegenschaft_id, katalog_id, l_mittel, stueckpreis, quelle_preis, gelb_jahre) values ($1,$2,$3,$4,$5,$6)
      on conflict (liegenschaft_id, katalog_id) do update set l_mittel=excluded.l_mittel, stueckpreis=excluded.stueckpreis, quelle_preis=excluded.quelle_preis, gelb_jahre=excluded.gelb_jahre`,
      [L, t.katalogId, neu.l, neu.preis, neu.preis === null ? null : "kunde", neu.gelb]);
  }
  if (baujahrGeaendert) await c.query("update gebaeude set stand=stand+1 where id=$1", [gebaeudeId]);
  return { bauteile: e.bauteile?.length ?? 0, typen: e.typen?.length ?? 0, baujahrGeaendert };
}
```

Pruefen: `FachFehler`-Konstruktor in `src/welt/speicher.ts` (Stand 19.11.: `new FachFehler(fehler[], status)` mit `.status`, `.fehler`). Wenn `status` 404 nicht erlaubt ist, im Typ ergaenzen.

- [ ] **Step 4: Laufen lassen**

Run: `npx vitest run test/lebensdauer-speicher.test.ts test/welt-speicher.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/lebensdauer/speicher.ts app/test/lebensdauer-speicher.test.ts
git commit -m "Lebensdauer: Speicher laden/schreiben, Baujahr erhoeht Gebaeudestand"
```

---

### Task 4: Routen GET/PUT, Registrierung, Entwicklungsstart

**Files:**
- Create: `app/src/lebensdauer/schema.ts`, `app/src/lebensdauer/routen.ts`
- Modify: `app/src/server.ts` (nach `registriereWeltRouten`, Zeile ~93), `app/entwicklung/start.ts` (nach dem Anlegen der Konten, vor `baueServer`)
- Test: `app/test/lebensdauer-api.test.ts`

**Interfaces:**
- Consumes: `ladeLebensdauer`, `schreibeLebensdauer`, `LebensdauerEingabe` (Task 3); `pruefe` aus `src/rechte/rechte.ts`; `auditEreignis`; `schalteEin` aus `src/module/schalter.ts`.
- Produces: `registriereLebensdauerRouten(app: FastifyInstance, pool: pg.Pool, stichtag?: () => number)`; `GET /api/lebensdauer/gebaeude/:id` -> `LebensdauerStand`; `PUT` gleicher Pfad -> `LebensdauerStand` (neu geladen); `zugriffLebensdauer` intern. Task 5 haengt die CSV-Route in dieselbe Funktion.

- [ ] **Step 1: Failing test schreiben**

Aufbau wie `test/welt-api.test.ts` (Konten, `anfrage`, `cookieVon` kopieren). Zusaetzlich nach `baueServer`: `await schalteEin(db.pool, "lebensdauer", 2, randomUUID());`.

```ts
// app/test/lebensdauer-api.test.ts  (Kopf wie welt-api.test.ts Zeilen 1-34, plus:)
import { schalteEin } from "../src/module/schalter.js";
// ... beforeAll: db, app, L1, L2, kBetr, kBearb, kLeser, kFremd wie welt-api.test.ts
//     await schalteEin(db.pool, "lebensdauer", 2, randomUUID());
//     G per POST /api/struktur/liegenschaften/:L1/gebaeude (kBetr) und PUT .../beschreibung (kBearb) mit erstbefuellung()
const url = () => `/api/lebensdauer/gebaeude/${G}`;
const JAHR = new Date().getFullYear();

describe("Lebensdauer-API", () => {
  it("Leser liest, Fremde 404, Betreiber 404", async () => {
    const r = await anfrage("GET", url(), kLeser);
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ gebaeudeId: G, ergebnis: { stichtag: JAHR } });
    expect((await anfrage("GET", url(), kFremd)).statusCode).toBe(404);
    expect((await anfrage("GET", url(), kBetr)).statusCode).toBe(404);
  });
  it("Leser darf nicht schreiben (403), Bearbeiter schon; Audit", async () => {
    const s = (await anfrage("GET", url(), kBearb)).json();
    expect((await anfrage("PUT", url(), kLeser, { stand: s.stand, heizungBaujahr: 2008 })).statusCode).toBe(403);
    const put = await anfrage("PUT", url(), kBearb, { stand: s.stand, heizungBaujahr: JAHR - 35 });
    expect(put.statusCode).toBe(200);
    expect(put.json().ergebnis.zaehler.rot).toBeGreaterThan(0);
    expect((await db.pool.query("select count(*)::int n from audit_eintrag where art='lebensdauer.geaendert'")).rows[0].n).toBe(1);
  });
  it("ungueltige Werte -> 400 im einheitlichen Format", async () => {
    const s = (await anfrage("GET", url(), kBearb)).json();
    for (const body of [{ stand: s.stand, heizungBaujahr: 1700 }, { stand: s.stand, bauteile: [{ id: s.bauteile[0].id, zustand: "super" }] },
      { stand: s.stand, typen: [{ katalogId: "heizung.verteiler", stueckpreis: -5 }] }, { stand: s.stand, unbekannt: 1 }]) {
      const r = await anfrage("PUT", url(), kBearb, body);
      expect(r.statusCode, JSON.stringify(body)).toBe(400);
      expect(r.json().fehler[0]).toMatchObject({ pfad: expect.any(String), code: expect.any(String) });
    }
  });
  it("veralteter Stand -> 409; Assistent mit altem Stand nach Baujahr-Aenderung -> 409", async () => {
    const b = (await anfrage("GET", `/api/struktur/gebaeude/${G}/beschreibung`, kBearb)).json();
    const s = (await anfrage("GET", url(), kBearb)).json();
    expect((await anfrage("PUT", url(), kBearb, { stand: s.stand - 1 })).statusCode).toBe(409);
    await anfrage("PUT", url(), kBearb, { stand: s.stand, bauteile: [{ id: s.bauteile[0].id, baujahr: 2015 }] });
    expect((await anfrage("PUT", `/api/struktur/gebaeude/${G}/beschreibung`, kBearb, b)).statusCode).toBe(409);
  });
  it("Modul aus -> 404", async () => {
    // eigener Server ohne schalteEin waere teuer; stattdessen Modul abschalten und wieder ein
    const { schalteAus } = await import("../src/module/schalter.js");
    await schalteAus(db.pool, "lebensdauer", randomUUID());
    expect((await anfrage("GET", url(), kBearb)).statusCode).toBe(404);
    await schalteEin(db.pool, "lebensdauer", 2, randomUUID());
  });
});
```

- [ ] **Step 2: Laufen lassen, muss scheitern**

Run: `npx vitest run test/lebensdauer-api.test.ts`
Expected: FAIL, GET liefert 404 (Route fehlt; der Guard laesst `/api/lebensdauer/` durch, dann Platzhalter/404).

- [ ] **Step 3: Schema und Routen schreiben**

```ts
// app/src/lebensdauer/schema.ts
const JAHR = { type: ["integer", "null"], minimum: 1800, maximum: 2100 };
const PREIS = { type: ["number", "null"], minimum: 0, maximum: 9999999999 };
const JAHRE = { type: ["integer", "null"], minimum: 1, maximum: 150 };
const UUID = { type: "string", format: "uuid" };
export const LEBENSDAUER_SCHEMA = {
  type: "object", additionalProperties: false, required: ["stand"],
  properties: {
    stand: { type: "integer", minimum: 0 },
    heizungBaujahr: JAHR,
    bauteile: { type: "array", maxItems: 5000, items: { type: "object", additionalProperties: false, required: ["id"], properties: {
      id: UUID, baujahr: JAHR, zustand: { type: ["string", "null"], enum: ["gut", "mittel", "schlecht", "kritisch", null] },
      lebensdauerJahre: JAHRE, stueckpreis: PREIS, notiz: { type: ["string", "null"], maxLength: 2000 } } } },
    typen: { type: "array", maxItems: 200, items: { type: "object", additionalProperties: false, required: ["katalogId"], properties: {
      katalogId: { type: "string", maxLength: 100, pattern: "^[a-z0-9_.]+$" }, lMittel: JAHRE, stueckpreis: PREIS,
      gelbJahre: { type: ["integer", "null"], minimum: 0, maximum: 20 } } } },
  },
} as const;
```

Pruefen: `format: "uuid"` muss im globalen ajv aktiv sein; sonst `UUID` aus `src/welt/schema.ts` exportieren und importieren (dort Zeile ~21 verwendet).

```ts
// app/src/lebensdauer/routen.ts
import type { FastifyInstance, FastifyReply } from "fastify";
import type pg from "pg";
import { pruefe } from "../rechte/rechte.js";
import { auditEreignis } from "../audit/audit.js";
import { FachFehler } from "../welt/speicher.js";
import { ID_PARAMS } from "../welt/schema.js";
import { LEBENSDAUER_SCHEMA } from "./schema.js";
import { ladeLebensdauer, schreibeLebensdauer, type LebensdauerEingabe } from "./speicher.js";

export function registriereLebensdauerRouten(app: FastifyInstance, pool: pg.Pool, stichtag = () => new Date().getFullYear()) {
  const mitClient = async <T>(f: (c: pg.PoolClient) => Promise<T>) => { const c = await pool.connect(); try { return await f(c); } finally { c.release(); } };
  const inTx = <T>(art: string, f: (c: pg.PoolClient) => Promise<T>) => mitClient(async (c) => {
    await c.query(art);
    try { const r = await f(c); await c.query("commit"); return r; } catch (e) { await c.query("rollback"); throw e; }
  });
  async function zugriff(c: pg.ClientBase, benutzerId: string, gebaeudeId: string, schreiben: boolean): Promise<200 | 403 | 404> {
    const r = (await c.query("select liegenschaft_id from gebaeude where id=$1", [gebaeudeId])).rows[0];
    if (!r || !(await pruefe(c, benutzerId, "fach.lesen", r.liegenschaft_id))) return 404;
    if (schreiben && !(await pruefe(c, benutzerId, "fach.aendern", r.liegenschaft_id))) return 403;
    return 200;
  }
  const verweigert = (reply: FastifyReply, code: 403 | 404) => reply.code(code).send({ fehler: code === 404 ? "nicht gefunden" : "keine Berechtigung" });

  app.get<{ Params: { id: string } }>("/api/lebensdauer/gebaeude/:id", { schema: { params: ID_PARAMS } }, async (req, reply) =>
    inTx("begin isolation level repeatable read read only", async (c) => {
      const z = await zugriff(c, req.kontext!.benutzerId, req.params.id, false);
      if (z !== 200) return verweigert(reply, z);
      return ladeLebensdauer(c, req.params.id, stichtag());
    }));

  app.put<{ Params: { id: string }; Body: LebensdauerEingabe }>("/api/lebensdauer/gebaeude/:id",
    { schema: { params: ID_PARAMS, body: LEBENSDAUER_SCHEMA } }, async (req, reply) => {
      const k = req.kontext!;
      const z = await mitClient((c) => zugriff(c, k.benutzerId, req.params.id, true));
      if (z !== 200) return verweigert(reply, z);
      try {
        return await inTx("begin", async (c) => {
          const n = await schreibeLebensdauer(c, req.params.id, req.body);
          await auditEreignis(c, k.auditId, "lebensdauer.geaendert", { gebaeudeId: req.params.id, ...n });
          return ladeLebensdauer(c, req.params.id, stichtag());
        });
      } catch (e) {
        if (e instanceof FachFehler) return reply.code(e.status).send({ fehler: e.fehler });
        throw e;
      }
    });
}
```

`app/src/server.ts` nach Zeile `registriereWeltRouten(app, o.pool);`:

```ts
  registriereLebensdauerRouten(app, o.pool); // M7 Demo-Schnitt: /api/lebensdauer/… (Modul-Guard schaltet)
```
plus Import `import { registriereLebensdauerRouten } from "./lebensdauer/routen.js";`. Pruefen, dass kein Platzhalter fuer `/api/lebensdauer/*` die Route verdeckt (Zeilen 94–98); falls doch, den Platzhalter fuer `lebensdauer` entfernen.

`app/entwicklung/start.ts` nach dem Betreiber-Konto:

```ts
  // Demo (E43): Lebensdauer/Ampel im Entwicklungsstart eingeschaltet.
  await schalteEin(pool, "lebensdauer", 2, randomUUID());
```
plus Import `import { schalteEin } from "../src/module/schalter.js";`.

- [ ] **Step 4: Laufen lassen**

Run: `npx vitest run test/lebensdauer-api.test.ts test/module-guard.test.ts test/server.test.ts`
Expected: PASS. Wenn `module-guard.test.ts` `/api/lebensdauer/...` als Platzhalter mit 200 erwartet, Erwartung auf den neuen Pfad anpassen und im Commit erwaehnen.

- [ ] **Step 5: Commit**

```bash
git add app/src/lebensdauer/schema.ts app/src/lebensdauer/routen.ts app/src/server.ts app/entwicklung/start.ts app/test/lebensdauer-api.test.ts
git commit -m "Lebensdauer: API GET/PUT mit Rechten, Audit, Modul im Entwicklungsstart"
```

---

### Task 5: CSV-Export

**Files:**
- Create: `app/src/lebensdauer/csv.ts`
- Modify: `app/src/lebensdauer/routen.ts` (neue Route in `registriereLebensdauerRouten`)
- Test: `app/test/lebensdauer-csv.test.ts`, Ergaenzung in `app/test/lebensdauer-api.test.ts`

**Interfaces:**
- Consumes: `LebensdauerStand` (Task 3).
- Produces: `erneuerungCsv(s: LebensdauerStand, namen: Record<string, string>): string` (mit BOM, `\r\n`); Route `GET /api/lebensdauer/gebaeude/:id/export.csv`.

- [ ] **Step 1: Failing tests**

```ts
// app/test/lebensdauer-csv.test.ts
import { describe, it, expect } from "vitest";
import { erneuerungCsv, zelle } from "../src/lebensdauer/csv.js";
import { rechne } from "../src/lebensdauer/rechnung.js";

describe("CSV", () => {
  it("entschaerft Formeln und quotet Semikolon/Anfuehrungszeichen", () => {
    expect(zelle("=SUMME(A1)")).toBe("'=SUMME(A1)");
    expect(zelle("+41")).toBe("'+41");
    expect(zelle("a;b")).toBe('"a;b"');
    expect(zelle('Typ "X"')).toBe('"Typ ""X"""');
    expect(zelle(null)).toBe("");
    expect(zelle(1200.5)).toBe("1200.5");
  });
  it("BOM, Kopfzeile, eine Zeile je Bauteil, Jahresblock", () => {
    const bauteile = [{ id: "a", katalogId: "heizung.verteiler", menge: 1, baujahr: null, hersteller: "=Hack", typ: null, ort: "EG · Technik",
      akte: { zustand: "schlecht" as const, lebensdauerJahre: null, stueckpreis: 2500, quellePreis: "kunde" as const, notiz: null } }];
    const ergebnis = rechne({ stichtag: 2026, heizungBaujahr: 2008, typen: [], bauteile });
    const csv = erneuerungCsv({ gebaeudeId: "g", stand: 0, heizungBaujahr: 2008, typen: [], bauteile, ergebnis }, { "heizung.verteiler": "Heizungsverteiler" });
    const z = csv.split("\r\n");
    expect(csv.startsWith("﻿")).toBe(true);
    expect(z[0]).toBe("﻿Ort;Bauteil;Hersteller;Typ;Menge;Baujahr;Zustand;Lebensdauer;Ersatzjahr;Ampel;Stückpreis;Kosten;Quelle Preis");
    expect(z[1]).toBe("EG · Technik;Heizungsverteiler;'=Hack;;1;2008;schlecht;30;2033;gruen;2500;2500;kunde");
    expect(z).toContain("Jahr;Betrag;ohne Preis");
    expect(z.filter((l) => /^20\d\d;/.test(l))).toHaveLength(10);
  });
});
```

API-Test ergaenzen:

```ts
  it("CSV-Export: Rechte, Typ, Dateiname", async () => {
    const r = await anfrage("GET", `${url()}/export.csv`, kLeser);
    expect(r.statusCode).toBe(200);
    expect(r.headers["content-type"]).toMatch(/text\/csv; charset=utf-8/);
    expect(r.headers["content-disposition"]).toMatch(/attachment; filename="erneuerungsplan-.*\.csv"/);
    expect(r.body.split("\r\n").length).toBeGreaterThan(3);
    expect((await anfrage("GET", `${url()}/export.csv`, kFremd)).statusCode).toBe(404);
  });
```

- [ ] **Step 2: Laufen lassen, muss scheitern**

Run: `npx vitest run test/lebensdauer-csv.test.ts`
Expected: FAIL, Modul fehlt.

- [ ] **Step 3: Implementieren**

```ts
// app/src/lebensdauer/csv.ts
import type { LebensdauerStand } from "./speicher.js";

/** Eine CSV-Zelle: Formel-Anfaenge entschaerfen (CSV-Injection), Semikolon/Anfuehrungszeichen/Zeilenumbruch quoten. */
export function zelle(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const zeile = (werte: (string | number | null | undefined)[]) => werte.map(zelle).join(";");

/** Semikolon, UTF-8 mit BOM (Excel de-CH oeffnet direkt). Zahlen mit Punkt. */
export function erneuerungCsv(s: LebensdauerStand, namen: Record<string, string>): string {
  const erg = new Map(s.ergebnis.bauteile.map((b) => [b.id, b]));
  const z = [zeile(["Ort", "Bauteil", "Hersteller", "Typ", "Menge", "Baujahr", "Zustand", "Lebensdauer", "Ersatzjahr", "Ampel", "Stückpreis", "Kosten", "Quelle Preis"])];
  const sortiert = [...s.bauteile].sort((a, b) => (erg.get(a.id)!.ersatzjahr ?? 9999) - (erg.get(b.id)!.ersatzjahr ?? 9999));
  for (const b of sortiert) {
    const e = erg.get(b.id)!;
    z.push(zeile([b.ort, namen[b.katalogId] ?? b.katalogId, b.hersteller, b.typ, b.menge ?? "unbekannt", e.baujahr, b.akte?.zustand ?? null,
      e.lebensdauer, e.ersatzjahr, e.ampel, e.stueckpreis, e.kosten, e.quellen.preisHerkunft]));
  }
  z.push("", zeile(["Jahr", "Betrag", "ohne Preis"]));
  for (const j of s.ergebnis.jahre) z.push(zeile([j.jahr, j.betrag, j.ohnePreis]));
  return "﻿" + z.join("\r\n") + "\r\n";
}
```

Route in `registriereLebensdauerRouten` ergaenzen (Namen aus `KATALOG_V2`, Import `import { KATALOG_V2 } from "../welt/katalog.v2.js";`):

```ts
  const NAMEN = Object.fromEntries(KATALOG_V2.eintraege.map((e) => [e.id, e.name]));
  app.get<{ Params: { id: string } }>("/api/lebensdauer/gebaeude/:id/export.csv", { schema: { params: ID_PARAMS } }, async (req, reply) =>
    inTx("begin isolation level repeatable read read only", async (c) => {
      const z = await zugriff(c, req.kontext!.benutzerId, req.params.id, false);
      if (z !== 200) return verweigert(reply, z);
      const s = (await ladeLebensdauer(c, req.params.id, stichtag()))!;
      return reply.type("text/csv; charset=utf-8")
        .header("content-disposition", `attachment; filename="erneuerungsplan-${req.params.id.slice(0, 8)}-${s.ergebnis.stichtag}.csv"`)
        .send(erneuerungCsv(s, NAMEN));
    }));
```

Hinweis: Katalognamen sind ohne Umlaute gespeichert ("Waermepumpe"); fuer die CSV akzeptiert [A]. Die Web-Oberflaeche nutzt ihre eigene Anzeige (`anzeigeName`).

- [ ] **Step 4: Laufen lassen**

Run: `npx vitest run test/lebensdauer-csv.test.ts test/lebensdauer-api.test.ts`
Expected: PASS. Danach gesamt: `npx vitest run` und `npm run pruefe:typen` -> gruen (Backend vorher 585).

- [ ] **Step 5: Commit**

```bash
git add app/src/lebensdauer/csv.ts app/src/lebensdauer/routen.ts app/test/lebensdauer-csv.test.ts app/test/lebensdauer-api.test.ts
git commit -m "Lebensdauer: CSV-Export (Semikolon, BOM, Formelschutz)"
```

---

### Task 6: Web – Typen, API, reine Ansichtsfunktionen

**Files:**
- Create: `app/web/src/lebensdauer/typen.ts`, `app/web/src/lebensdauer/ansicht.ts`
- Test: `app/web/src/lebensdauer/ansicht.test.ts`

**Interfaces:**
- Produces (von Tasks 7–9 verwendet):
```ts
// typen.ts: Spiegel der Backend-Antwort (wie web/src/typen.ts die Welt spiegelt)
export type Ampel = "gruen" | "gelb" | "rot" | "grau"; export type Zustand = "gut" | "mittel" | "schlecht" | "kritisch";
export interface LdBauteil { id; katalogId; menge; baujahr; hersteller; typ; ort; akte: {...} | null }   // exakt wie LebensdauerBauteil
export interface LdErgebnisBauteil { ... }                                                                  // exakt wie BauteilErgebnis
export interface LdStand { gebaeudeId: string; stand: number; heizungBaujahr: number | null; typen: LdTyp[]; bauteile: LdBauteil[];
  ergebnis: { stichtag: number; bauteile: LdErgebnisBauteil[]; jahre: { jahr: number; betrag: number; ohnePreis: number; anzahl: number }[];
    summe5: { betrag: number; ohnePreis: number }; zaehler: Record<Ampel, number> } }
// ansicht.ts
export const AMPEL_FARBE: Record<Ampel, string>;            // aus TOKENS: statusOk, statusWarnung, statusStoerung, grau3
export const AMPEL_TEXT: Record<Ampel, string>;             // "In Ordnung", "Bald ersetzen", "Ersetzen", "Baujahr fehlt"
export const ZUSTAND_TEXT: Record<Zustand, string>;         // "Gut", "Mittel", "Schlecht", "Kritisch"
export function chf(betrag: number): string;                // "CHF 12'500"
export function ampelJeSymbol(stand: LdStand, symbole: { schluessel: string; bauteilIds: string[] }[]): Map<string, Ampel>; // schlechteste Ampel je Symbol
export interface AkteZeile { id: string; ort: string; menge: string; ampel: Ampel; ersatzjahr: string; restjahre: string; kosten: string;
  baujahr: { wert: string; quelle: string }; lebensdauer: { wert: string; quelle: string }; preis: { wert: string; quelle: string; fehlt: boolean } }
export function akteZeilen(stand: LdStand, bauteilIds: string[]): AkteZeile[];
export interface Legende { zaehler: Record<Ampel, number>; summe5: string; ohnePreis: number }
export function legende(stand: LdStand): Legende;
export interface Balken { jahr: number; betrag: number; text: string; ohnePreis: number; anteil: number /* 0..1 vom Maximum */ }
export function balken(stand: LdStand): Balken[];
export interface PlanZeile extends AkteZeile { name: string; ersatzjahrZahl: number | null }
export function planZeilen(stand: LdStand, name: (katalogId: string) => string, jahr: number | null): PlanZeile[]; // jahr = Filter aus Balkenklick
export function eingabeZahl(text: string, min: number, max: number): number | null | "ungueltig"; // "" -> null
```
- Konvention Quellentext: baujahr `bauteil` -> "Eigene Angabe", `gebaeude` -> "Gebäudestandard", null -> "fehlt"; lebensdauer `planora` -> "Planora-Richtwert", `typ` -> "Typwert", `bauteil` -> "Eigene Angabe"; preis `bauteil`/`typ` + Herkunft `kunde` -> "Eigene Angabe"/"Typwert", `dokument` -> "Aus Dokument", null -> "Preis fehlt".
- Regel Ampel je Symbol: rot > gelb > grau > gruen (grau vor gruen, weil fehlendes Baujahr eine Luecke ist) [A].

- [ ] **Step 1: Failing test schreiben**

```ts
// app/web/src/lebensdauer/ansicht.test.ts
import { describe, expect, it } from "vitest";
import { akteZeilen, ampelJeSymbol, balken, chf, eingabeZahl, legende, planZeilen } from "./ansicht";
import type { LdStand } from "./typen";

const stand: LdStand = {
  gebaeudeId: "g", stand: 3, heizungBaujahr: 2008, typen: [],
  bauteile: [
    { id: "a", katalogId: "heizung.verteiler", menge: 1, baujahr: null, hersteller: null, typ: null, ort: "EG · Technik", akte: null },
    { id: "b", katalogId: "heizung.heizkoerper", menge: 10, baujahr: 2020, hersteller: "Zehnder", typ: null, ort: "OG1 · Büro", akte: { zustand: null, lebensdauerJahre: null, stueckpreis: 800, quellePreis: "kunde", notiz: null } },
    { id: "c", katalogId: "heizung.heizkoerper", menge: 2, baujahr: null, hersteller: null, typ: null, ort: "OG1 · Büro", akte: null },
  ],
  ergebnis: { stichtag: 2026, zaehler: { gruen: 1, gelb: 0, rot: 1, grau: 1 }, summe5: { betrag: 12500, ohnePreis: 1 },
    jahre: Array.from({ length: 10 }, (_, i) => ({ jahr: 2026 + i, betrag: i === 0 ? 12500 : i === 4 ? 25000 : 0, ohnePreis: i === 0 ? 1 : 0, anzahl: i === 0 ? 2 : i === 4 ? 1 : 0 })),
    bauteile: [
      { id: "a", ampel: "rot", baujahr: 2008, ersatzjahr: 2026, restjahre: 0, lebensdauer: 30, stueckpreis: null, kosten: null, mengeAngenommen: false,
        quellen: { baujahr: "gebaeude", lebensdauer: "planora", preis: null, preisHerkunft: null } },
      { id: "b", ampel: "gruen", baujahr: 2020, ersatzjahr: 2060, restjahre: 34, lebensdauer: 40, stueckpreis: 800, kosten: 8000, mengeAngenommen: false,
        quellen: { baujahr: "bauteil", lebensdauer: "planora", preis: "bauteil", preisHerkunft: "kunde" } },
      { id: "c", ampel: "grau", baujahr: null, ersatzjahr: null, restjahre: null, lebensdauer: 40, stueckpreis: null, kosten: null, mengeAngenommen: false,
        quellen: { baujahr: null, lebensdauer: "planora", preis: null, preisHerkunft: null } },
    ] },
};

describe("Ansicht Lebensdauer", () => {
  it("chf mit Apostroph", () => { expect(chf(12500)).toBe("CHF 12'500"); expect(chf(0)).toBe("CHF 0"); });
  it("schlechteste Ampel je Symbol, grau vor gruen", () => {
    const m = ampelJeSymbol(stand, [{ schluessel: "s1", bauteilIds: ["a"] }, { schluessel: "s2", bauteilIds: ["b", "c"] }, { schluessel: "s3", bauteilIds: ["x"] }]);
    expect(m.get("s1")).toBe("rot"); expect(m.get("s2")).toBe("grau"); expect(m.has("s3")).toBe(false);
  });
  it("Akte-Zeilen mit Quellen und fehlendem Preis", () => {
    const [a, b] = akteZeilen(stand, ["a", "b"]);
    expect(a).toMatchObject({ ampel: "rot", ersatzjahr: "2026", kosten: "–", baujahr: { wert: "2008", quelle: "Gebäudestandard" },
      lebensdauer: { wert: "30 Jahre", quelle: "Planora-Richtwert" }, preis: { fehlt: true, quelle: "Preis fehlt" } });
    expect(b).toMatchObject({ kosten: "CHF 8'000", preis: { wert: "CHF 800", quelle: "Eigene Angabe", fehlt: false }, baujahr: { quelle: "Eigene Angabe" } });
  });
  it("Legende mit Zaehlern und unvollstaendiger Summe", () => {
    expect(legende(stand)).toEqual({ zaehler: { gruen: 1, gelb: 0, rot: 1, grau: 1 }, summe5: "CHF 12'500", ohnePreis: 1 });
  });
  it("10 Balken, Anteil relativ zum Maximum", () => {
    const b = balken(stand);
    expect(b).toHaveLength(10);
    expect(b[0]).toMatchObject({ jahr: 2026, anteil: 0.5, ohnePreis: 1, text: "CHF 12'500" });
    expect(b[4].anteil).toBe(1);
    expect(b[1]).toMatchObject({ anteil: 0, text: "–" });
  });
  it("Planliste nach Ersatzjahr, ohne Baujahr zuletzt, Jahresfilter mit Ueberfaelligen im Stichtagsjahr", () => {
    const n = (k: string) => k;
    expect(planZeilen(stand, n, null).map((z) => z.id)).toEqual(["a", "b", "c"]);
    expect(planZeilen(stand, n, 2026).map((z) => z.id)).toEqual(["a"]);
    expect(planZeilen(stand, n, 2027)).toEqual([]);
  });
  it("Zahleneingabe", () => {
    expect(eingabeZahl("", 1, 150)).toBeNull();
    expect(eingabeZahl("25", 1, 150)).toBe(25);
    expect(eingabeZahl("1'200.50", 0, 1e10)).toBe(1200.5);
    expect(eingabeZahl("0", 1, 150)).toBe("ungueltig");
    expect(eingabeZahl("abc", 1, 150)).toBe("ungueltig");
  });
});
```

- [ ] **Step 2: Laufen lassen, muss scheitern**

Run (aus `app/web/`): `npx vitest run src/lebensdauer/ansicht.test.ts`
Expected: FAIL, Modul fehlt.

- [ ] **Step 3: Implementieren**

`typen.ts`: Typen aus Backend `speicher.ts`/`rechnung.ts` 1:1 abschreiben (Namen `LdBauteil`, `LdErgebnisBauteil`, `LdTyp` = `RechenTyp & { standard; bereich }`, `LdStand`).

```ts
// app/web/src/lebensdauer/ansicht.ts
import { TOKENS } from "../design/tokens";
import type { Ampel, LdErgebnisBauteil, LdStand, Zustand } from "./typen";

export const AMPEL_FARBE: Record<Ampel, string> = { gruen: TOKENS.farbe.statusOk, gelb: TOKENS.farbe.statusWarnung, rot: TOKENS.farbe.statusStoerung, grau: TOKENS.farbe.grau3 };
export const AMPEL_TEXT: Record<Ampel, string> = { gruen: "In Ordnung", gelb: "Bald ersetzen", rot: "Ersetzen", grau: "Baujahr fehlt" };
export const ZUSTAND_TEXT: Record<Zustand, string> = { gut: "Gut", mittel: "Mittel", schlecht: "Schlecht", kritisch: "Kritisch" };
const RANG: Record<Ampel, number> = { rot: 3, gelb: 2, grau: 1, gruen: 0 };

export const chf = (b: number) => `CHF ${Math.round(b).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'")}`;

export function ampelJeSymbol(stand: LdStand, symbole: { schluessel: string; bauteilIds: string[] }[]): Map<string, Ampel> {
  const je = new Map(stand.ergebnis.bauteile.map((b) => [b.id, b.ampel]));
  const m = new Map<string, Ampel>();
  for (const s of symbole) {
    const a = s.bauteilIds.map((id) => je.get(id)).filter((x): x is Ampel => !!x);
    if (a.length) m.set(s.schluessel, a.reduce((x, y) => (RANG[y] > RANG[x] ? y : x)));
  }
  return m;
}

const Q_BAUJAHR = { bauteil: "Eigene Angabe", gebaeude: "Gebäudestandard" } as const;
const Q_LD = { bauteil: "Eigene Angabe", typ: "Typwert", planora: "Planora-Richtwert" } as const;
function preisQuelle(e: LdErgebnisBauteil) {
  if (e.quellen.preis === null) return "Preis fehlt";
  if (e.quellen.preisHerkunft === "dokument") return "Aus Dokument";
  return e.quellen.preis === "bauteil" ? "Eigene Angabe" : "Typwert";
}

export interface AkteZeile { id: string; ort: string; menge: string; ampel: Ampel; ersatzjahr: string; restjahre: string; kosten: string;
  baujahr: { wert: string; quelle: string }; lebensdauer: { wert: string; quelle: string }; preis: { wert: string; quelle: string; fehlt: boolean } }
export function akteZeilen(stand: LdStand, bauteilIds: string[]): AkteZeile[] {
  const erg = new Map(stand.ergebnis.bauteile.map((b) => [b.id, b]));
  return bauteilIds.flatMap((id) => {
    const b = stand.bauteile.find((x) => x.id === id), e = erg.get(id);
    if (!b || !e) return [];
    return [{ id, ort: b.ort, menge: b.menge === null ? "unbekannt (1 angenommen)" : String(b.menge), ampel: e.ampel,
      ersatzjahr: e.ersatzjahr === null ? "–" : String(e.ersatzjahr),
      restjahre: e.restjahre === null ? "–" : e.restjahre === 0 ? "fällig" : `${e.restjahre} Jahre`,
      kosten: e.kosten === null ? "–" : chf(e.kosten),
      baujahr: { wert: e.baujahr === null ? "–" : String(e.baujahr), quelle: e.quellen.baujahr ? Q_BAUJAHR[e.quellen.baujahr] : "fehlt" },
      lebensdauer: { wert: `${e.lebensdauer} Jahre`, quelle: Q_LD[e.quellen.lebensdauer] },
      preis: { wert: e.stueckpreis === null ? "–" : chf(e.stueckpreis), quelle: preisQuelle(e), fehlt: e.stueckpreis === null } }];
  });
}

export interface Legende { zaehler: Record<Ampel, number>; summe5: string; ohnePreis: number }
export const legende = (s: LdStand): Legende => ({ zaehler: s.ergebnis.zaehler, summe5: chf(s.ergebnis.summe5.betrag), ohnePreis: s.ergebnis.summe5.ohnePreis });

export interface Balken { jahr: number; betrag: number; text: string; ohnePreis: number; anteil: number }
export function balken(s: LdStand): Balken[] {
  const max = Math.max(0, ...s.ergebnis.jahre.map((j) => j.betrag));
  return s.ergebnis.jahre.map((j) => ({ jahr: j.jahr, betrag: j.betrag, ohnePreis: j.ohnePreis,
    text: j.betrag > 0 ? chf(j.betrag) : "–", anteil: max > 0 ? j.betrag / max : 0 }));
}

export interface PlanZeile extends AkteZeile { name: string; ersatzjahrZahl: number | null }
export function planZeilen(s: LdStand, name: (katalogId: string) => string, jahr: number | null): PlanZeile[] {
  const erg = new Map(s.ergebnis.bauteile.map((b) => [b.id, b]));
  const zeilen = akteZeilen(s, s.bauteile.map((b) => b.id)).map((z) => ({ ...z,
    name: name(s.bauteile.find((b) => b.id === z.id)!.katalogId), ersatzjahrZahl: erg.get(z.id)!.ersatzjahr }));
  const faellig = (z: PlanZeile) => z.ersatzjahrZahl === null ? null : Math.max(z.ersatzjahrZahl, s.ergebnis.stichtag);
  return zeilen.filter((z) => jahr === null || faellig(z) === jahr)
    .sort((a, b) => (a.ersatzjahrZahl ?? Infinity) - (b.ersatzjahrZahl ?? Infinity));
}

export function eingabeZahl(text: string, min: number, max: number): number | null | "ungueltig" {
  const t = text.trim().replace(/['’\s]/g, "");
  if (t === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return "ungueltig";
  const n = Number(t);
  return n < min || n > max ? "ungueltig" : n;
}
```

- [ ] **Step 4: Laufen lassen**

Run: `npx vitest run src/lebensdauer/ansicht.test.ts`
Expected: PASS (7 Tests).

- [ ] **Step 5: Commit**

```bash
git add app/web/src/lebensdauer
git commit -m "Web Lebensdauer: Typen und reine Ansichtsfunktionen"
```

---

### Task 7: Anlagenkarte – Block "Lebensdauer" mit Bearbeiten

**Files:**
- Create: `app/web/src/karten/TwinLebensdauer.tsx`, `app/web/src/lebensdauer/bearbeiten.ts`
- Modify: `app/web/src/karten/TwinObjekt.tsx` (Block zwischen "Versorgt" und "Dokumente"), `app/web/src/seiten/Twin.tsx` (Laden, Weitergabe)
- Test: `app/web/src/lebensdauer/bearbeiten.test.ts`

**Interfaces:**
- Consumes: `akteZeilen`, `AMPEL_FARBE`, `AMPEL_TEXT`, `ZUSTAND_TEXT`, `eingabeZahl` (Task 6); `holeJson`, `ersetzeJson` aus `../api`.
- Produces:
```ts
// bearbeiten.ts
export interface Formular { baujahr: string; zustand: "" | Zustand; lebensdauer: string; preis: string; notiz: string }
export function formularAus(stand: LdStand, id: string): Formular;
export function koerperAus(stand: LdStand, id: string, f: Formular): { body: { stand: number; bauteile: [Record<string, unknown>] } } | { fehler: Partial<Record<keyof Formular, string>> };
// nur geaenderte Felder kommen in den Body; leere Eingabe = null
// TwinLebensdauer.tsx
export function TwinLebensdauer(p: { stand: LdStand; bauteilIds: string[]; darfAendern: boolean; onGespeichert: (s: LdStand) => void }): JSX.Element;
```
- Twin.tsx: zusaetzlicher State `lebensdauer: LdStand | null`; Laden `holeJson<LdStand>(\`/api/lebensdauer/gebaeude/${gebaeudeId}\`)` parallel zum bestehenden `Promise.all`, aber **getrennt**: 404 -> `null` (Modul aus), ohne den Twin zu blockieren. `darfAendern` aus `/api/ich` (Feld pruefen; falls nicht vorhanden: Bearbeiten zeigen und 403 als Meldung "Keine Berechtigung" anzeigen [A]).

- [ ] **Step 1: Failing test**

```ts
// app/web/src/lebensdauer/bearbeiten.test.ts
import { describe, expect, it } from "vitest";
import { formularAus, koerperAus } from "./bearbeiten";
import type { LdStand } from "./typen";

const stand = { gebaeudeId: "g", stand: 4, heizungBaujahr: 2008, typen: [], ergebnis: { stichtag: 2026, bauteile: [], jahre: [], summe5: { betrag: 0, ohnePreis: 0 }, zaehler: { gruen: 0, gelb: 0, rot: 0, grau: 0 } },
  bauteile: [{ id: "a", katalogId: "heizung.verteiler", menge: 1, baujahr: null, hersteller: null, typ: null, ort: "EG",
    akte: { zustand: "mittel", lebensdauerJahre: null, stueckpreis: 2500, quellePreis: "kunde", notiz: null } }] } as LdStand;

describe("Bearbeiten", () => {
  it("Formular aus Stand", () => {
    expect(formularAus(stand, "a")).toEqual({ baujahr: "", zustand: "mittel", lebensdauer: "", preis: "2500", notiz: "" });
  });
  it("nur Geaendertes in den Body, leer = null", () => {
    const r = koerperAus(stand, "a", { baujahr: "2012", zustand: "mittel", lebensdauer: "", preis: "", notiz: "" });
    expect(r).toEqual({ body: { stand: 4, bauteile: [{ id: "a", baujahr: 2012, stueckpreis: null }] } });
  });
  it("Fehler je Feld", () => {
    expect(koerperAus(stand, "a", { baujahr: "1700", zustand: "", lebensdauer: "0", preis: "x", notiz: "" }))
      .toEqual({ fehler: { baujahr: "Jahr zwischen 1800 und 2100", lebensdauer: "1 bis 150 Jahre", preis: "Betrag in CHF, z. B. 1200 oder 1'200.50" } });
  });
});
```

- [ ] **Step 2: Laufen lassen, muss scheitern** – `npx vitest run src/lebensdauer/bearbeiten.test.ts` -> FAIL.

- [ ] **Step 3: Implementieren**

```ts
// app/web/src/lebensdauer/bearbeiten.ts
import { eingabeZahl } from "./ansicht";
import type { LdStand, Zustand } from "./typen";

export interface Formular { baujahr: string; zustand: "" | Zustand; lebensdauer: string; preis: string; notiz: string }
const text = (n: number | null | undefined) => (n == null ? "" : String(n));

export function formularAus(s: LdStand, id: string): Formular {
  const b = s.bauteile.find((x) => x.id === id)!;
  return { baujahr: text(b.baujahr), zustand: b.akte?.zustand ?? "", lebensdauer: text(b.akte?.lebensdauerJahre), preis: text(b.akte?.stueckpreis), notiz: b.akte?.notiz ?? "" };
}

export function koerperAus(s: LdStand, id: string, f: Formular) {
  const alt = formularAus(s, id), fehler: Partial<Record<keyof Formular, string>> = {};
  const baujahr = eingabeZahl(f.baujahr, 1800, 2100), lebensdauer = eingabeZahl(f.lebensdauer, 1, 150), preis = eingabeZahl(f.preis, 0, 9999999999);
  if (baujahr === "ungueltig" || (typeof baujahr === "number" && !Number.isInteger(baujahr))) fehler.baujahr = "Jahr zwischen 1800 und 2100";
  if (lebensdauer === "ungueltig" || (typeof lebensdauer === "number" && !Number.isInteger(lebensdauer))) fehler.lebensdauer = "1 bis 150 Jahre";
  if (preis === "ungueltig") fehler.preis = "Betrag in CHF, z. B. 1200 oder 1'200.50";
  if (f.notiz.length > 2000) fehler.notiz = "Höchstens 2000 Zeichen";
  if (Object.keys(fehler).length) return { fehler };
  const b: Record<string, unknown> = { id };
  if (f.baujahr !== alt.baujahr) b.baujahr = baujahr;
  if (f.zustand !== alt.zustand) b.zustand = f.zustand || null;
  if (f.lebensdauer !== alt.lebensdauer) b.lebensdauerJahre = lebensdauer;
  if (f.preis !== alt.preis) b.stueckpreis = preis;
  if (f.notiz !== alt.notiz) b.notiz = f.notiz.trim() || null;
  return { body: { stand: s.stand, bauteile: [b] as [Record<string, unknown>] } };
}
```

`TwinLebensdauer.tsx` (Funktionsumfang; Gestaltung in Task 10):
- Kopf "Lebensdauer" mit Ampelpunkt (`AMPEL_FARBE`) und `AMPEL_TEXT` der schlechtesten Zeile.
- Je Bauteil-Datensatz (`akteZeilen(stand, bauteilIds)`) eine Zeile: Ort, Menge, Ersatzjahr, Restjahre, Kosten; darunter Baujahr / Lebensdauer / Stückpreis je mit kleiner Quellenangabe. `preis.fehlt` -> Text "Preis fehlt" in `--tw-warnung`.
- Knopf "Bearbeiten" (nur `darfAendern`) oeffnet je Zeile ein Formular: Baujahr (leer = Gebäudestandard), Zustand (Auswahl mit "Unbekannt"), Lebensdauer (Platzhalter = Richtwert), Stückpreis CHF, Notiz. Speichern: `koerperAus` -> `ersetzeJson<LdStand>(url, body)` -> `onGespeichert`. Fehler je Feld unter dem Feld (`aria-describedby`). 409 -> Meldung "Daten wurden inzwischen geändert. Neu laden." mit Knopf, der neu laedt.
- Esc im Formular bricht ab, ohne die Karte zu schliessen (`e.stopPropagation()`).

`TwinObjekt.tsx`: neue optionale Props `lebensdauer?: LdStand | null; darfAendern?: boolean; onLebensdauer?: (s: LdStand) => void`; Block nur wenn `lebensdauer` gesetzt:
```tsx
      {lebensdauer && <TwinLebensdauer stand={lebensdauer} bauteilIds={karte.bauteilIds} darfAendern={!!darfAendern} onGespeichert={onLebensdauer!} />}
```

Twin.tsx: State und Laden ergaenzen:
```tsx
  const [lebensdauer, setLebensdauer] = useState<LdStand | null>(null);
  useEffect(() => {
    let aktiv = true; setLebensdauer(null);
    holeJson<LdStand>(`/api/lebensdauer/gebaeude/${gebaeudeId}`).then((s) => { if (aktiv) setLebensdauer(s); }, (e: Error) => {
      if (aktiv && e instanceof ApiFehler && e.status === 401) onAbgelaufen(); // 404 = Modul aus: still ohne Lebensdauer
    });
    return () => { aktiv = false; };
  }, [gebaeudeId, onAbgelaufen]);
```
und an `<TwinObjekt ... lebensdauer={lebensdauer} darfAendern={...} onLebensdauer={setLebensdauer} />`.

- [ ] **Step 4: Laufen lassen** – `npx vitest run` und `npm run pruefe:typen` in `app/web/` -> PASS (Web vorher 457).

- [ ] **Step 5: Kurz im Browser pruefen** – `bash werkzeug/design/instanz.sh start --muster` (aus Repo-Wurzel), `http://localhost:3100/entwicklung/anmelden`, Gebaeude oeffnen, Anlage waehlen, Baujahr und Preis setzen, Karte zeigt neues Ersatzjahr/Kosten. Danach `instanz.sh stop`.

- [ ] **Step 6: Commit**

```bash
git add app/web/src/lebensdauer/bearbeiten.ts app/web/src/lebensdauer/bearbeiten.test.ts app/web/src/karten/TwinLebensdauer.tsx app/web/src/karten/TwinObjekt.tsx app/web/src/seiten/Twin.tsx
git commit -m "Web Lebensdauer: Anlagenkarte mit Ampel, Quellen und Bearbeiten"
```

---

### Task 8: Twin-Modus "Erneuerung" (Taste E)

**Files:**
- Create: `app/web/src/karten/TwinErneuerung.tsx`
- Modify: `app/web/src/szene3/Szene3.tsx` (Prop `ampel?: ReadonlyMap<string, string>` durchreichen), `app/web/src/szene3/Technik3.tsx` (an `Anlagen3` weitergeben), `app/web/src/szene3/Anlagen3.tsx` (Faerbung), `app/web/src/karten/TwinSzenenTasten.tsx` (Taste E), `app/web/src/seiten/Twin.tsx`
- Test: `app/web/src/szene3/ampelFaerbung.test.ts`

**Interfaces:**
- Consumes: `ampelJeSymbol`, `legende`, `AMPEL_FARBE`, `AMPEL_TEXT` (Task 6).
- Produces: `ampelFarben(stand: LdStand, symbole: WeltSymbol[]): Map<string, string>` in `app/web/src/szene3/ampelFaerbung.ts` (Schluessel -> Hex); Szene3-Prop `ampel`; `TwinSzenenTasten`-Props `erneuerung: boolean; onErneuerung?: (an: boolean) => void` (ohne `onErneuerung` keine Taste E, z. B. Modul aus).
- Darstellung (funktional, Feinschliff Task 10): Ist `ampel` gesetzt, bekommt jede Anlage mit Eintrag eine Huelle wie die bestehende Hervorhebung (`scale 1.04`, `BackSide`), aber in der Ampelfarbe und dauerhaft; Anlagen ohne Eintrag bleiben unveraendert. Bei `Modellinstanzen` ueber eine zweite `instancedMesh` mit `setColorAt` je Instanz; bei `ErsatzAnlage` als zweite `RoundedBox`. Leitungen im Modus E mit bestehendem Dimm-Mechanismus abschwaechen, falls einfach erreichbar; sonst unveraendert lassen und in Task 10 entscheiden.

- [ ] **Step 1: Failing test**

```ts
// app/web/src/szene3/ampelFaerbung.test.ts
import { describe, expect, it } from "vitest";
import { ampelFarben } from "./ampelFaerbung";
import { AMPEL_FARBE } from "../lebensdauer/ansicht";

describe("ampelFarben", () => {
  it("Farbe je Symbol aus schlechtester Ampel", () => {
    const stand: any = { ergebnis: { bauteile: [{ id: "a", ampel: "rot" }, { id: "b", ampel: "gruen" }] } };
    const m = ampelFarben(stand, [{ schluessel: "s1", bauteilIds: ["a", "b"] }, { schluessel: "s2", bauteilIds: ["b"] }] as any);
    expect(m.get("s1")).toBe(AMPEL_FARBE.rot);
    expect(m.get("s2")).toBe(AMPEL_FARBE.gruen);
  });
});
```

- [ ] **Step 2: FAIL pruefen** – `npx vitest run src/szene3/ampelFaerbung.test.ts`.

- [ ] **Step 3: Implementieren**

```ts
// app/web/src/szene3/ampelFaerbung.ts
import { AMPEL_FARBE, ampelJeSymbol } from "../lebensdauer/ansicht";
import type { LdStand } from "../lebensdauer/typen";
import type { WeltSymbol } from "../typen";

export function ampelFarben(stand: LdStand, symbole: Pick<WeltSymbol, "schluessel" | "bauteilIds">[]): Map<string, string> {
  return new Map([...ampelJeSymbol(stand, symbole)].map(([k, a]) => [k, AMPEL_FARBE[a]]));
}
```

Anlagen3: Prop `ampel?: ReadonlyMap<string, string>`; in `ErsatzAnlage`:
```tsx
      {ampel?.get(s.schluessel) && <RoundedBox args={masse} position={[0, masse[1] / 2, 0]} scale={1.06} radius={radius} smoothness={3} raycast={() => {}}>
        <meshBasicMaterial color={ampel.get(s.schluessel)} side={THREE.BackSide} />
      </RoundedBox>}
```
in `Modellinstanzen` eine zweite Instanzliste `gefaerbt = instanzen.filter((i) => ampel?.has(i.s.schluessel))`, Matrix wie `matrix(i, true)` mit Faktor 1.06, `mesh.setColorAt(k, new THREE.Color(ampel.get(...)))`, `instanceColor.needsUpdate = true`; Material `MeshBasicMaterial({ side: BackSide })` (weiss, Farbe kommt aus `instanceColor`). Aufraeumen wie beim bestehenden `rand`.

TwinSzenenTasten: `EIGENE_KUERZEL` um `E` erweitern; im Handler `else if ((e.key === "e" || e.key === "E") && s.onErneuerung) s.onErneuerung(!s.erneuerung);`; Leiste `<span><kbd>E</kbd> Erneuerung</span>` nur mit `onErneuerung`.

TwinErneuerung.tsx: kleine Legendenkarte (im Modus E sichtbar, in `tw-rechts` ueber der Anlagenkarte): vier Zeilen Punkt + `AMPEL_TEXT` + Anzahl; darunter "Nächste 5 Jahre: CHF …" und, wenn `ohnePreis > 0`, "ohne Preis: n". Link "Erneuerungsplan öffnen" (`onPlan`, Task 9).

Twin.tsx: State `erneuerung`, `ampel = useMemo(() => erneuerung && lebensdauer && welt ? ampelFarben(lebensdauer, welt.symbole) : undefined, ...)`; an `Szene3 ampel={ampel}`; Ansage "Erneuerungsansicht an/aus"; Kopfzeile-Pill "Erneuerung" (aria-pressed) nur mit `lebensdauer`.

- [ ] **Step 4: Tests + Typen** – `npx vitest run`, `npm run pruefe:typen`, `npm run build` in `app/web/` -> gruen.

- [ ] **Step 5: Browser kurz** – wie Task 7 Step 5: E druecken, Anlagen eingefaerbt, Legende stimmt mit Karte ueberein.

- [ ] **Step 6: Commit**

```bash
git add app/web/src/szene3 app/web/src/karten/TwinErneuerung.tsx app/web/src/karten/TwinSzenenTasten.tsx app/web/src/seiten/Twin.tsx app/web/src/ui/Kopfzeile.tsx
git commit -m "Web Lebensdauer: Twin-Modus Erneuerung (Taste E, Ampelfarben, Legende)"
```

---

### Task 9: Seite "Erneuerungsplan"

**Files:**
- Create: `app/web/src/seiten/Erneuerungsplan.tsx`, `app/web/src/seiten/Erneuerungsplan.css`
- Modify: `app/web/src/App.tsx` (Zustand `{ art: "plan"; gebaeudeId; name }`), `app/web/src/seiten/Twin.tsx` (`onPlan`), `app/web/src/ui/Kopfzeile.tsx` (Eintrag "Erneuerungsplan")
- Test: `app/web/src/lebensdauer/typwerte.test.ts`

**Interfaces:**
- Consumes: `balken`, `planZeilen`, `chf`, `AMPEL_*`, `eingabeZahl` (Task 6); `anzeigeName` aus `../dashboard` fuer Bauteilnamen mit Umlauten (Signatur pruefen; sonst Katalogname).
- Produces: `typKoerper(stand: LdStand, aenderungen: Record<string, { lMittel: string; preis: string }>): { body } | { fehler }` in `app/web/src/lebensdauer/typwerte.ts`; Komponente `Erneuerungsplan({ gebaeudeId, name, onTwin, onAbgelaufen })`.

- [ ] **Step 1: Failing test**

```ts
// app/web/src/lebensdauer/typwerte.test.ts
import { describe, expect, it } from "vitest";
import { typKoerper, baujahrKoerper } from "./typwerte";

const stand: any = { stand: 2, heizungBaujahr: null, typen: [{ katalogId: "heizung.verteiler", lMittel: null, stueckpreis: 2500, quellePreis: "kunde", gelbJahre: null, standard: 30, bereich: { min: 23, max: 38 } }] };

describe("Typwerte", () => {
  it("nur Geaendertes, leer = null", () => {
    expect(typKoerper(stand, { "heizung.verteiler": { lMittel: "28", preis: "" } }))
      .toEqual({ body: { stand: 2, typen: [{ katalogId: "heizung.verteiler", lMittel: 28, stueckpreis: null }] } });
  });
  it("Fehler je Katalog-ID", () => {
    expect(typKoerper(stand, { "heizung.verteiler": { lMittel: "0", preis: "" } })).toEqual({ fehler: { "heizung.verteiler": "Lebensdauer 1 bis 150 Jahre" } });
  });
  it("Baujahr-Standard", () => {
    expect(baujahrKoerper(stand, "2008")).toEqual({ body: { stand: 2, heizungBaujahr: 2008 } });
    expect(baujahrKoerper(stand, "")).toEqual({ body: { stand: 2, heizungBaujahr: null } });
    expect(baujahrKoerper(stand, "20")).toEqual({ fehler: "Jahr zwischen 1800 und 2100" });
  });
});
```

- [ ] **Step 2: FAIL pruefen.**

- [ ] **Step 3: Implementieren**

```ts
// app/web/src/lebensdauer/typwerte.ts
import { eingabeZahl } from "./ansicht";
import type { LdStand } from "./typen";

const t = (n: number | null) => (n === null ? "" : String(n));
export function typKoerper(s: LdStand, aenderungen: Record<string, { lMittel: string; preis: string }>) {
  const typen: Record<string, unknown>[] = [], fehler: Record<string, string> = {};
  for (const [katalogId, f] of Object.entries(aenderungen)) {
    const alt = s.typen.find((x) => x.katalogId === katalogId);
    const l = eingabeZahl(f.lMittel, 1, 150), p = eingabeZahl(f.preis, 0, 9999999999);
    if (l === "ungueltig" || (typeof l === "number" && !Number.isInteger(l))) { fehler[katalogId] = "Lebensdauer 1 bis 150 Jahre"; continue; }
    if (p === "ungueltig") { fehler[katalogId] = "Preis in CHF, z. B. 1200"; continue; }
    const z: Record<string, unknown> = { katalogId };
    if (f.lMittel !== t(alt?.lMittel ?? null)) z.lMittel = l;
    if (f.preis !== t(alt?.stueckpreis ?? null)) z.stueckpreis = p;
    if (Object.keys(z).length > 1) typen.push(z);
  }
  return Object.keys(fehler).length ? { fehler } : { body: { stand: s.stand, typen } };
}
export function baujahrKoerper(s: LdStand, text: string) {
  const j = eingabeZahl(text, 1800, 2100);
  if (j === "ungueltig" || (typeof j === "number" && !Number.isInteger(j))) return { fehler: "Jahr zwischen 1800 und 2100" };
  return { body: { stand: s.stand, heizungBaujahr: j } };
}
```

`Erneuerungsplan.tsx` (Funktionsumfang; Gestaltung Task 10, Tokens wie `Twin.tsx`):
1. Kopf: Gebäudename, Zurück "Zum Digital Twin" (`onTwin`), Knopf "CSV exportieren" = `<a href={\`/api/lebensdauer/gebaeude/${id}/export.csv\`} download>` (gleiche Herkunft, Cookie reicht fuer GET).
2. Feld "Baujahr Heizung (Gebäudestandard)" mit Speichern (`baujahrKoerper` -> `ersetzeJson`), Hinweis "Gilt für alle Bauteile ohne eigenes Baujahr".
3. Kennzahlen: Anzahl je Ampel, "Nächste 5 Jahre: CHF …", bei `ohnePreis` "n Bauteile ohne Preis – Summe unvollständig".
4. 10 Jahresbalken (`balken()`): Hoehe = `anteil`, Beschriftung Jahr + `text`; Jahr mit `ohnePreis > 0` mit Markierung "+ n ohne Preis". Balken sind `<button aria-pressed>`; Klick setzt den Jahresfilter, erneuter Klick hebt ihn auf.
5. Liste (`planZeilen(stand, name, filter)`): Ampel, Bauteil, Ort, Menge, Baujahr, Ersatzjahr, Kosten ("Preis fehlt" sichtbar). Klick auf Zeile: zum Twin mit gewaehlter Anlage ist **nicht** Teil dieses Plans (Liste).
6. Aufklappbereich "Typwerte (Lebensdauer und Preis je Bauteiltyp)": je Katalog-ID im Gebaeude Lebensdauer (Platzhalter "Richtwert 30 Jahre (23–38)") und Stückpreis; Speichern mit `typKoerper`.
7. 409 -> Meldung "Daten wurden inzwischen geändert" + Neu laden; 404 -> "Lebensdauer ist für diese Instanz nicht eingeschaltet".

App.tsx: neuer Zustand `{ art: "plan"; gebaeudeId: string; name: string }`, lazy geladen wie `Twin`; Twin erhaelt `onPlan={() => setZustand({ art: "plan", gebaeudeId, name })}`, Plan erhaelt `onTwin={() => setZustand({ art: "twin", ... })}`. Adresse bleibt "/" (wie Twin).

- [ ] **Step 4: Tests + Typen + Build** in `app/web/` -> gruen.

- [ ] **Step 5: Commit**

```bash
git add app/web/src/lebensdauer/typwerte.ts app/web/src/lebensdauer/typwerte.test.ts app/web/src/seiten/Erneuerungsplan.tsx app/web/src/seiten/Erneuerungsplan.css app/web/src/App.tsx app/web/src/seiten/Twin.tsx app/web/src/ui/Kopfzeile.tsx
git commit -m "Web Lebensdauer: Seite Erneuerungsplan mit Balken, Liste, Typwerten, CSV"
```

---

### Task 10: Gestaltung (planora-design, Stufe mittel)

**Files:** nach Vorgabe des Skills; voraussichtlich `TwinLebensdauer.tsx`, `TwinErneuerung.tsx`, `Erneuerungsplan.css`, `Twin.css`, `Anlagen3.tsx`, `design/tokens.ts` (nur neue Tokens, keine bestehenden aendern).

- [ ] **Step 1:** Skill `planora-design` laden, Aufgabe als "mittel" einstufen; `docs/design/prinzipien.md` und Lessons Learned lesen.
- [ ] **Step 2:** `ui-ux-designer` fuer Anlagenkarte-Block, Legende, Erneuerungsplan; `3d-designer` fuer Ampel-Huelle im Twin (Lesbarkeit der Farben auf hellem Grund, Leitungen dimmen ja/nein).
- [ ] **Step 3:** GPU-Bilder mit `werkzeug/design/` (neues Szenario `werkzeug/design/szenarien/lebensdauer.json`: Muster-Buerohaus, Baujahr 2008, 2 Abweichungen, 1 Zustand "schlecht", Preise fuer 2 Typen + 1 Bauteil): Twin normal, Twin Modus E (Uebersicht und Geschoss), Anlagenkarte offen und im Bearbeiten, Erneuerungsplan (mit und ohne Jahresfilter), 1280/1440/1920.
- [ ] **Step 4:** `visual-critic` bis Urteil "bereit"; P1/P2 beheben. Ablage `docs/abnahme/2026-11-xx-lebensdauer/` (Datum der Umsetzung).
- [ ] **Step 5:** Web-Tests, Typen, Build gruen; Commit(s) "Gestaltung Lebensdauer: ..." je Runde.

---

### Task 11: Browser-Abnahme, Doku, Stand

**Files:**
- Create: `docs/abnahme/2026-11-xx-lebensdauer/README.md`
- Modify: `docs/superpowers/specs/2026-11-19-lebensdauer-ampel-design.md` (Abweichungen 1–2 nachtragen), `CLAUDE.md` Abschnitt 0b, `docs/arbeitsjournal.md`

- [ ] **Step 1: Abnahme im Browser** (`instanz.sh start --muster`, Port 3100):
  1. Erneuerungsplan: Baujahr-Standard 2008 setzen.
  2. Zwei Bauteile mit eigenem Baujahr (z. B. Waermepumpe 2019, ein Heizkoerper-Datensatz 2000).
  3. Einen Verteiler auf Zustand "schlecht".
  4. Preise: Typ Heizkoerper CHF 800, Typ Waermepumpe CHF 35'000, ein Verteiler CHF 2'500; Rest ohne Preis.
  5. Vergleichen: Anlagenkarte (Ersatzjahr/Kosten), Twin-Legende (Anzahl, 5-J.-Summe, ohne Preis), Jahresbalken/Liste, CSV in Excel (Summen je Jahr). Alle vier muessen identisch sein; Abweichung = Fehler, nicht Abnahme.
  6. Assistent mit altem Stand: Assistent oeffnen, im zweiten Tab Baujahr aendern, im Assistenten uebernehmen -> Meldung (409), kein stilles Ueberschreiben.
  7. Rolle Leser: alles sichtbar, keine Bearbeiten-Knoepfe.
- [ ] **Step 2:** README mit Ergebnis, Bildern, Zahlenvergleich, Klickzahl fuer "Baujahr + 2 Preise setzen", offenen Punkten [?].
- [ ] **Step 3:** Gesamtpruefung: `app/`: `npx vitest run`, `npm run pruefe:typen`; `app/web/`: `npx vitest run`, `npm run build`. Zahlen in README und CLAUDE.md eintragen.
- [ ] **Step 4:** Spec-Nachtrag (Abweichungen), CLAUDE.md 0b neuer Block "Lebensdauer/Ampel umgesetzt", Journal-Eintrag. Commit:

```bash
git add docs CLAUDE.md
git commit -m "Lebensdauer/Ampel: Abnahme, Spec-Nachtrag, Stand"
```

- [ ] **Step 5:** Naechstes Teilprojekt fuer PO benennen: Brainstorming "Preis aus Dokument" (E43, Zuschnitt zwei Teile).
