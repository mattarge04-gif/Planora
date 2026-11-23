# Anlagenakte (schlank) – Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Der FM legt Unterlagen (PDF, Bilder, Office) je Gebaeude ab, jede Datei wird vor der Freigabe auf Viren geprueft, mit 0..n Bauteilen verknuepft und in Planora geoeffnet (PDF.js-Viewer); die Heizungs-Bibliothek erhaelt Datenblatt-Felder, Lebensdauer-Quelle, Icon je Typ und zwei neue Typen mit GLB.

**Architecture:** Die Ablage aus "Preis aus Dokument" (Tabelle `dokument`, Migration 017) wird zum Kernmodul `src/dokumente/` (Routen `/api/dokumente/`); `preisdokument` behaelt nur Vorschlaege, Lesen und Uebernehmen und liest nur noch per Knopf. Uploads landen roh (ein Request, kein Multipart) im Quarantaene-Bereich der sha256-Ablage; ein Hintergrund-Pruefer (max. 2 gleichzeitig) prueft ueber den Port `VirenScanner` (ClamAV `clamd` INSTREAM in Produktion, Fake mit EICAR in Entwicklung/Tests) und uebernimmt saubere Bytes in die Ablage. Datenblatt-Werte liegen in `bauteil_akte.datenblatt` (Routen im Kernmodul `bestand`), Felder kommen aus Katalog v2. Web: Seite "Dokumente" mit Umschalter "Alle Dokumente | Preise prüfen (n)", Viewer-Overlay mit `pdfjs-dist`, Anlagenkarte mit "Unterlagen (n)" und "Datenblatt".

**Tech Stack:** Fastify 5, pg, Vitest, embedded-postgres (Tests), Node `net` (clamd-Protokoll), ClamAV-Container `clamav/clamav:1.5` (Compose), React 19 / Vite 8 (Web), `pdfjs-dist` (neu, exakt gepinnt), lucide-react, Blender 5.1 (GLB, `docs/design/modelle/anlagen.py`).

**Spec:** `docs/superpowers/specs/2026-11-23-anlagenakte-design.md` (PO-Entscheid E46 in `docs/architektur/00-kontext.md`; ADR 0016 mit Nachtrag, ADR 0022, ADR 0027)

## Global Constraints

- Groesse ≤ 100 MB je Datei [A] (`MAX_BYTES = 100 * 1024 * 1024`).
- Erlaubte Typen: PDF; JPG, PNG, HEIC; docx, xlsx, pptx sowie doc, xls, ppt [A]. `art` (`pdf` | `bild` | `office`) und `mime`, erkannt aus Magic Bytes, nie aus der Endung. Sonst 400 mit Grund. Office-Dateien werden nie ausgefuehrt oder geparst.
- `kategorie` (`datenblatt` | `plan` | `offerte` | `foto` | `protokoll` | `sonstiges`), vorbelegt aus der Art [A] (Bild -> foto, sonst sonstiges), vom FM aenderbar.
- `scan_status` (`quarantaene` | `sauber` | `abgelehnt` | `scan_fehler`), `scan_grund` (Signaturname/Fehlertext, ≤ 300), `gescannt_am`. Fehler gilt nie als sauber.
- Rechte: lesen `fach.lesen`, ablegen/verknuepfen/Kategorie/loeschen `fach.aendern`; fremde Gebaeude 404; nicht `sauber` liefert nie Bytes (auch nicht an den Admin [A]).
- Antworten mit `x-content-type-options: nosniff`. PDF und Bild inline im Planora-Viewer; Office und "Herunterladen" als `attachment`.
- PDFs ohne Skriptausfuehrung (ADR 0022), `pdfjs-dist` auf eine Version gepinnt, Worker aus eigener Domain (CSP). Die Web-CSP (`app/src/web.ts`, `WEB_CSP`) bleibt unveraendert; braucht der Viewer eine Lockerung (z. B. `wasm-unsafe-eval`), anhalten und PO fragen.
- Kein automatisches Lesen nach dem Upload; "Preise lesen" nur per Knopf bei sauberen PDFs und KI an.
- Kosten: Alles laeuft lokal und ohne Kosten. Keine echten KI-Aufrufe (kein `OPENAI_API_KEY` in Tests, Abnahme mit KI aus bzw. Fake). ClamAV ist freie Software als eigener Container.
- Twin-Szene: keine Aenderung (Regel 20), kein Dokument-Filter in der Legende [A]. Leser sieht und oeffnet alles, keine Schreibknoepfe.
- Gestaltung ueber Skill `planora-design` (Stufe mittel): ui-ux-designer, 3d-designer, dann visual-critic mit GPU-Screenshots 1440/1280/1920, max. 3 Runden.
- UI-Texte mit echten Umlauten, de-CH, kein Eszett; Code/Kommentare/Bezeichner ohne Umlaute wie im Bestand.
- Windows: `npm.cmd`/`npx.cmd`. Backend in `app/`: `npx.cmd vitest run <datei>`, `npm.cmd run pruefe:typen`. Web in `app/web/`: `npx.cmd vitest run`, `npx.cmd tsc --noEmit -p .`, `npm.cmd run build`. Docker: `npm.cmd run test:docker` in `app/`.
- Kein Push, kein Merge (nur auf PO-Auftrag). Jeder Commit endet mit einer Leerzeile und `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Die EICAR-Testzeichenkette steht nie am Stueck in einer Datei des Repos (Windows Defender meldet sonst die Quelldatei): immer aus zwei Teilen zusammensetzen, nur im Speicher verwenden.

---

## Dateistruktur

| Datei | Verantwortung |
|---|---|
| `app/src/db/migrationen/018_anlagenakte.sql` | `dokument` verallgemeinert, `dokument_bauteil`, `bauteil_akte.datenblatt` |
| `app/src/dokumente/typ.ts` | Magic-Byte-Erkennung, Grenzen, Kategorien (rein) |
| `app/src/dokumente/pdf.ts` | Seitenzahl eines PDF (rein, aus `preisdokument/pdf.ts` verschoben) |
| `app/src/dokumente/schema.ts` | Fastify-Schemas (Query, Bodies) |
| `app/src/dokumente/speicher.ts` | DB-Zugriffe Ablage, Verknuepfung, Loeschen |
| `app/src/dokumente/scanner.ts` | Port `VirenScanner`, Fake-Scanner, EICAR, Konfiguration |
| `app/src/dokumente/clamd.ts` | Produktionsadapter `clamd` INSTREAM per TCP |
| `app/src/dokumente/pruefer.ts` | Hintergrund-Pruefung, Neustart, Bereinigung abgelehnter Dateien |
| `app/src/dokumente/routen.ts` | HTTP-Routen `/api/dokumente/…` |
| `app/src/preisdokument/{routen,speicher,laeufer,pdf}.ts` | nur noch Vorschlaege, Lesen per Knopf, Lese-Sperren |
| `app/src/welt/{regelwerk,katalog.v2,regelwerk.v2,routen}.ts`, `app/src/lebensdauer/{standard,speicher}.ts` | Bibliothek Heizung (Datenblatt, Quelle, Icon, neue Typen) |
| `app/src/bestand/{datenblatt,routen}.ts` | Datenblatt pruefen, `/api/bestand/…` |
| `app/src/server.ts`, `app/src/start/api.ts`, `app/entwicklung/start.ts` | Verdrahtung, Pflicht-Konfiguration Scanner |
| `betrieb/compose.yaml`, `app/src/betrieb/{release,install/install,update/umgebung,update/compose}.ts` | ClamAV fest im Paket |
| `app/test/dokumente-*.test.ts`, `app/test/hilfe-dateien.ts`, `app/test/bestand-datenblatt.test.ts`, `app/test-docker/scan.test.ts` | Tests |
| `app/web/src/dokumente/`, `app/web/src/viewer/`, `app/web/src/bestand/` | Web-Typen, API, reine Funktionen, Viewer |
| `app/web/src/seiten/Dokumente.tsx`, `karten/TwinObjekt.tsx`, `seiten/Twin.tsx`, `App.tsx` | Oberflaeche |
| `docs/design/modelle/anlagen.py`, `app/web/public/modelle/*.glb`, `app/web/src/szene3/technik.ts` | Modelle Ausdehnungsgefaess, Sonstiges |
| `werkzeug/anlagenakte/` | Abnahmedateien erzeugen, EICAR-Testablage ueber die API |

---

### Task 1: Migration 018, Kernmodul `dokumente`, Routen verschieben, kein automatisches Lesen

**Files:**
- Create: `app/src/db/migrationen/018_anlagenakte.sql`, `app/src/dokumente/typ.ts`, `app/src/dokumente/pdf.ts`, `app/src/dokumente/schema.ts`, `app/src/dokumente/speicher.ts`, `app/src/dokumente/routen.ts`, `app/test/hilfe-dateien.ts`, `app/test/dokumente-migration.test.ts`, `app/test/dokumente-api.test.ts`
- Modify: `app/src/preisdokument/routen.ts` (Upload/Datei/Loeschen entfernen), `app/src/preisdokument/speicher.ts` (Re-Export, Filter `art='pdf'`), `app/src/preisdokument/pdf.ts` (nutzt `zaehleSeiten`), `app/src/server.ts`, `app/test/preisdokument-api.test.ts`, `app/web/src/preisdokument/api.ts`, `app/web/src/karten/preisQuelle.test.ts`

**Interfaces:**
- Produces:
```ts
// typ.ts (Task 2 erweitert erkenneTyp)
export const MAX_BYTES: number; export type Art = "pdf" | "bild" | "office";
export const KATEGORIEN: readonly ["datenblatt","plan","offerte","foto","protokoll","sonstiges"]; export type Kategorie
export type TypGrund = "leer" | "zu_gross" | "typ_unbekannt" | "makro"; export interface Typ { art: Art; mime: string }
export function erkenneTyp(d: Buffer): { ok: true; typ: Typ } | { ok: false; grund: TypGrund }
export function startKategorie(art: Art): Kategorie
// pdf.ts
export function zaehleSeiten(daten: Buffer): number
// speicher.ts
export type ScanStatus = "quarantaene" | "sauber" | "abgelehnt" | "scan_fehler"
export type AuslesenStatus = "neu" | "liest" | "fertig" | "fehler" | "abgebrochen" | "aus"
export interface AblageZeile { id; dateiname; art: Art; mime; kategorie: Kategorie; groesse: number; seiten: number | null; hochgeladenAm: string;
  scanStatus: ScanStatus; scanGrund: string | null; gescanntAm: string | null; bauteilIds: string[] }
export interface AblageBauteil { id; katalogId; geschoss; ort; hersteller: string | null; typ: string | null }
export function ladeAblage(c, gebaeudeId, nurId?: string | null): Promise<AblageZeile[]>
export function ladeAblageBauteile(c, gebaeudeId): Promise<AblageBauteil[]>
export function legeDokumentAn(c, a): Promise<{ id: string; neu: boolean }>   // nur Tests/Skripte
export function gibReferenzFrei(c, schluessel, objekt): Promise<void>
export function loescheDokument(c, dokumentId): Promise<{ schluessel: string; scanStatus: ScanStatus } | null>
// routen.ts
export function bereinigeDateiname(name: string): string
export function registriereDokumentRouten(app: FastifyInstance, pool: pg.Pool): void   // Task 3 ergaenzt Optionen
```
- Routen: `POST /api/dokumente/gebaeude/:id` (Body `application/octet-stream`, Header `x-dateiname` URI-kodiert) -> `201 AblageZeile`, `200 AblageZeile` bei gleichem sha256 im Gebaeude, `400 { fehler: TypGrund }`; `GET /api/dokumente/gebaeude/:id` -> `{ dokumente: AblageZeile[]; bauteile: AblageBauteil[]; darfAendern: boolean }`; `GET /api/dokumente/:id/datei[?download=1]`; `DELETE /api/dokumente/:id` -> `204`.

Hinweis [A]: Die Spec verlangt fuer neue Dokumente den Startwert `auslesen_status='aus'` und kein automatisches Lesen. Weil die Upload-Route das Modul `preisdokument` verlaesst (Kern darf nicht von Option abhaengen), entfaellt das automatische Lesen bereits hier; Lesen geht ab jetzt ueber `POST /api/preisdokument/dokumente/:id/neu-lesen`. Bis Task 3 setzt der Upload `scan_status='sauber'` direkt (Uebergang, nur innerhalb dieses Plans); Task 3 stellt auf Quarantaene um.

- [ ] **Step 1: Test-Helfer** `app/test/hilfe-dateien.ts` (Task 2 erweitert ihn):
```ts
// Testdateien als Buffer (nie auf Platte). Inhalt per `zusatz` eindeutig machen: gleicher sha256 im Gebaeude = Duplikat.
const NL = String.fromCharCode(10);
export const pdf = (seiten = 1, zusatz = "") => Buffer.from(["%PDF-1.7",
  ...Array.from({ length: seiten }, (_, i) => `${i + 3} 0 obj << /Type /Page /Parent 2 0 R >> endobj`),
  `2 0 obj << /Type /Pages /Count ${seiten} >> endobj`, zusatz + "%%EOF"].join(NL));
```

- [ ] **Step 2: Failing test** `app/test/dokumente-migration.test.ts` (Altbestand: nur 001–017 anwenden, Zeile einfuegen, dann alle Migrationen):
```ts
import { describe, it, expect, beforeAll, afterAll, inject } from "vitest";
import pg from "pg";
import { randomBytes, randomUUID } from "node:crypto";
import { copyFileSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { migriere } from "../src/db/migrator.js";

const MIG = fileURLToPath(new URL("../src/db/migrationen", import.meta.url));
let pool: pg.Pool;
let L: string, G: string, GS: string, B: string, ALT: string;
const q = (sql: string, p: unknown[] = []) => pool.query(sql, p);
const neu = (p: Record<string, unknown> = {}) => q(
  `insert into dokument(gebaeude_id, liegenschaft_id, dateiname, schluessel, sha256, groesse, seiten, hochgeladen_von${Object.keys(p).map((k) => ", " + k).join("")})
   values ($1,$2,'n.pdf','k',$3,10,1,$4${Object.keys(p).map((_, i) => `,$${i + 5}`).join("")}) returning *`, [G, L, randomUUID(), randomUUID(), ...Object.values(p)]);

beforeAll(async () => {
  const basis = inject("pg");
  const name = "t_" + randomBytes(6).toString("hex");
  const admin = new pg.Client({ ...basis, database: "postgres" });
  await admin.connect(); await admin.query(`create database ${name}`); await admin.end();
  const cfg = { ...basis, database: name };
  const bis017 = mkdtempSync(join(tmpdir(), "mig017-"));
  for (const f of readdirSync(MIG).filter((f) => f.endsWith(".sql") && f < "018")) copyFileSync(join(MIG, f), join(bis017, f));
  await migriere(cfg, bis017);
  pool = new pg.Pool(cfg);
  L = (await q("insert into liegenschaft(name) values ('L') returning id")).rows[0].id;
  G = (await q("insert into gebaeude(liegenschaft_id, name, grundform, breite_m, tiefe_m, regelwerk_version) values ($1,'G','quader',30,15,1) returning id", [L])).rows[0].id;
  GS = (await q("insert into geschoss(liegenschaft_id, gebaeude_id, code, reihenfolge, hoehe_m) values ($1,$2,'EG',0,3.2) returning id", [L, G])).rows[0].id;
  B = (await q("insert into bauteil(liegenschaft_id, gebaeude_id, katalog_id, geschoss_id, status, reihenfolge) values ($1,$2,'heizung.verteiler',$3,'bestaetigt',0) returning id", [L, G, GS])).rows[0].id;
  ALT = randomUUID();
  await q(`insert into dokument(id, gebaeude_id, liegenschaft_id, dateiname, schluessel, sha256, groesse, seiten, hochgeladen_von, auslesen_status)
    values ($1,$2,$3,'alt.pdf','k','alt',10,2,$4,'fertig')`, [ALT, G, L, randomUUID()]);
  await migriere(cfg);
});
afterAll(async () => { await pool.end(); });

describe("Migration 018", () => {
  it("Altbestand: pdf, offerte, sauber, Lesestatus bleibt", async () => {
    expect((await q("select art, mime, kategorie, scan_status, auslesen_status from dokument where id=$1", [ALT])).rows[0])
      .toEqual({ art: "pdf", mime: "application/pdf", kategorie: "offerte", scan_status: "sauber", auslesen_status: "fertig" });
  });
  it("neue Zeile: sichere Startwerte", async () => {
    const r = (await neu()).rows[0];
    expect([r.kategorie, r.scan_status, r.auslesen_status]).toEqual(["sonstiges", "quarantaene", "aus"]);
  });
  it("Seiten nullable und ohne 100er-Grenze; Groesse max. 100 MB; Lesen nur bei PDF", async () => {
    await expect(neu({ seiten: null, art: "bild", mime: "image/png" })).resolves.toBeDefined();
    await expect(neu({ seiten: 250 })).resolves.toBeDefined();
    await expect(neu({ seiten: 0 })).rejects.toThrow(/check/);
    await expect(neu({ groesse: 100 * 1024 * 1024 + 1 })).rejects.toThrow(/check/);
    await expect(neu({ art: "office", mime: "application/msword", auslesen_status: "neu" })).rejects.toThrow(/check/);
    await expect(neu({ scan_status: "virus" })).rejects.toThrow(/check/);
    await expect(neu({ scan_grund: "x".repeat(301) })).rejects.toThrow(/check/);
  });
  it("dokument_bauteil: eindeutig, faellt mit Bauteil und Dokument weg", async () => {
    const d = (await neu()).rows[0].id;
    await q("insert into dokument_bauteil(dokument_id, bauteil_id) values ($1,$2)", [d, B]);
    await expect(q("insert into dokument_bauteil(dokument_id, bauteil_id) values ($1,$2)", [d, B])).rejects.toThrow(/duplicate key/);
    await q("delete from dokument where id=$1", [d]);
    expect((await q("select 1 from dokument_bauteil where dokument_id=$1", [d])).rowCount).toBe(0);
    const d2 = (await neu()).rows[0].id;
    const B2 = (await q("insert into bauteil(liegenschaft_id, gebaeude_id, katalog_id, geschoss_id, status, reihenfolge) values ($1,$2,'heizung.verteiler',$3,'bestaetigt',1) returning id", [L, G, GS])).rows[0].id;
    await q("insert into dokument_bauteil(dokument_id, bauteil_id) values ($1,$2)", [d2, B2]);
    await q("delete from bauteil where id=$1", [B2]);
    expect((await q("select 1 from dokument_bauteil where dokument_id=$1", [d2])).rowCount).toBe(0);
  });
  it("bauteil_akte.datenblatt ist ein Objekt", async () => {
    await expect(q("insert into bauteil_akte(bauteil_id, liegenschaft_id, datenblatt) values ($1,$2,'[1]')", [B, L])).rejects.toThrow(/check/);
    await expect(q("insert into bauteil_akte(bauteil_id, liegenschaft_id, datenblatt) values ($1,$2,'{\"dn\":25}')", [B, L])).resolves.toBeDefined();
  });
  it("planora_app darf dokument_bauteil lesen, schreiben, loeschen", async () => {
    expect((await q("select has_table_privilege('planora_app', 'dokument_bauteil', 'select,insert,delete') ok")).rows[0].ok).toBe(true);
  });
});
```

- [ ] **Step 3: Run** `npx.cmd vitest run test/dokumente-migration.test.ts` — Expected: FAIL (Spalte `art` fehlt).

- [ ] **Step 4: Migration** `app/src/db/migrationen/018_anlagenakte.sql`:
```sql
-- Anlagenakte schlank (Spec 2026-11-23, E46): allgemeine Ablage, Virenpruefung, Verknuepfung mit Bauteilen, Datenblatt.
-- Altbestand aus 017 (nur Testdaten, vor dem Scan abgelegt): pdf / offerte / sauber [A]. Danach sichere Startwerte.
alter table dokument
  add column art text not null default 'pdf' check (art in ('pdf','bild','office')),
  add column mime text not null default 'application/pdf' check (length(mime) between 3 and 100),
  add column kategorie text not null default 'offerte' check (kategorie in ('datenblatt','plan','offerte','foto','protokoll','sonstiges')),
  add column scan_status text not null default 'sauber' check (scan_status in ('quarantaene','sauber','abgelehnt','scan_fehler')),
  add column scan_grund text check (length(scan_grund) <= 300),
  add column gescannt_am timestamptz;
alter table dokument
  alter column kategorie set default 'sonstiges',
  alter column scan_status set default 'quarantaene',
  alter column auslesen_status set default 'aus';
-- Die 100-Seiten-Grenze gilt nur beim Lesen (preisdokument), nicht fuer die Ablage.
alter table dokument
  alter column seiten drop not null,
  drop constraint dokument_seiten_check,
  add constraint dokument_seiten_check check (seiten is null or seiten >= 1),
  add constraint dokument_groesse_max check (groesse <= 104857600),
  add constraint dokument_auslesen_nur_pdf check (art = 'pdf' or auslesen_status = 'aus');
create index dokument_scan_offen on dokument(scan_status) where scan_status <> 'sauber';
create table dokument_bauteil(
  dokument_id uuid not null references dokument(id) on delete cascade,
  bauteil_id uuid not null references bauteil(id) on delete cascade,
  primary key (dokument_id, bauteil_id)
);
create index dokument_bauteil_bauteil on dokument_bauteil(bauteil_id);
-- Datenblatt-Werte je Bauteil; Schluessel prueft die App gegen Katalog v2 (src/bestand/datenblatt.ts).
alter table bauteil_akte add column datenblatt jsonb check (datenblatt is null or jsonb_typeof(datenblatt) = 'object');
grant select, insert, delete on dokument_bauteil to planora_app;
```
Hinweis: Der Name `dokument_seiten_check` ist der von PostgreSQL vergebene Standardname aus 017; vorher mit `select conname from pg_constraint where conrelid='dokument'::regclass` bestaetigen.

- [ ] **Step 5: Run** Migrationstest — Expected: PASS. Danach `npx.cmd vitest run test/preisdokument-migration.test.ts test/lebensdauer-migration.test.ts` — Expected: PASS.

- [ ] **Step 6: `app/src/dokumente/typ.ts`** (vorlaeufig nur PDF; Task 2 erweitert):
```ts
/** Grenzen und Typen der Ablage (Spec Anlagenakte 2026-11-23 Abschnitt 3/4.2). Typ nur aus Magic Bytes, nie aus Endung. */
export const MAX_BYTES = 100 * 1024 * 1024; // [A]
export type Art = "pdf" | "bild" | "office";
export const KATEGORIEN = ["datenblatt", "plan", "offerte", "foto", "protokoll", "sonstiges"] as const;
export type Kategorie = (typeof KATEGORIEN)[number];
export type TypGrund = "leer" | "zu_gross" | "typ_unbekannt" | "makro";
export interface Typ { art: Art; mime: string }

export function erkenneTyp(d: Buffer): { ok: true; typ: Typ } | { ok: false; grund: TypGrund } {
  if (!d.length) return { ok: false, grund: "leer" };
  if (d.length > MAX_BYTES) return { ok: false, grund: "zu_gross" };
  if (d.subarray(0, 5).toString("latin1") === "%PDF-") return { ok: true, typ: { art: "pdf", mime: "application/pdf" } };
  return { ok: false, grund: "typ_unbekannt" };
}

/** Vorbelegung [A]: Bild -> foto, sonst sonstiges. */
export const startKategorie = (art: Art): Kategorie => (art === "bild" ? "foto" : "sonstiges");
```

- [ ] **Step 7: `app/src/dokumente/pdf.ts`** – Inhalt von `app/src/preisdokument/pdf.ts` verschieben: Konstanten `MAX_ENTPACKT_JE_STREAM`, `MAX_ENTPACKT_TOTAL`, Regex `COUNT_NACH_TYPE`/`COUNT_VOR_TYPE`, `hoechsterCount`, `entpackteStreams` unveraendert uebernehmen (mit `import { inflateSync } from "node:zlib";`), dazu:
```ts
/**
 * Seitenzahl [A]: hoechster /Count eines /Pages-Knotens im Klartext und in entpackten Streams,
 * sonst Anzahl /Type /Page; mindestens 1. Erwartet ein PDF (Signatur vorher pruefen).
 */
export function zaehleSeiten(daten: Buffer): number {
  const text = daten.toString("latin1");
  let count = hoechsterCount(text);
  let einzelseiten = (text.match(/\/Type\s*\/Page(?!s)\b/g) ?? []).length;
  if (/\/ObjStm\b/.test(text) || count === 0) {
    for (const s of entpackteStreams(daten, text)) {
      count = Math.max(count, hoechsterCount(s));
      einzelseiten += (s.match(/\/Type\s*\/Page(?!s)\b/g) ?? []).length;
    }
  }
  return Math.max(1, count || einzelseiten);
}
```
`app/src/preisdokument/pdf.ts` wird zu:
```ts
import { zaehleSeiten } from "../dokumente/pdf.js";
export { MAX_ENTPACKT_JE_STREAM, MAX_ENTPACKT_TOTAL } from "../dokumente/pdf.js";
/** Grenzen der Lese-API (nur beim Lesen, nicht fuer die Ablage). */
export const MAX_BYTES = 32 * 1024 * 1024;
export const MAX_SEITEN = 100;
export function pruefePdf(daten: Buffer): { ok: true; seiten: number } | { ok: false; grund: "kein_pdf" | "zu_gross" | "zu_viele_seiten" } {
  if (daten.subarray(0, 5).toString("latin1") !== "%PDF-") return { ok: false, grund: "kein_pdf" };
  if (daten.length > MAX_BYTES) return { ok: false, grund: "zu_gross" };
  const seiten = zaehleSeiten(daten);
  if (seiten > MAX_SEITEN) return { ok: false, grund: "zu_viele_seiten" };
  return { ok: true, seiten };
}
```
Run `npx.cmd vitest run test/preisdokument-pdf.test.ts` — Expected: PASS (unveraendertes Verhalten).

- [ ] **Step 8: `app/src/dokumente/schema.ts`**
```ts
export const DATEI_QUERY = { type: "object", additionalProperties: false, properties: { download: { type: "string", enum: ["1"] } } } as const;
```

- [ ] **Step 9: `app/src/dokumente/speicher.ts`**
```ts
import type pg from "pg";
import type { Art, Kategorie } from "./typ.js";
type Q = Pick<pg.ClientBase, "query">;

export type ScanStatus = "quarantaene" | "sauber" | "abgelehnt" | "scan_fehler";
export type AuslesenStatus = "neu" | "liest" | "fertig" | "fehler" | "abgebrochen" | "aus";
export interface AblageZeile { id: string; dateiname: string; art: Art; mime: string; kategorie: Kategorie; groesse: number; seiten: number | null;
  hochgeladenAm: string; scanStatus: ScanStatus; scanGrund: string | null; gescanntAm: string | null; bauteilIds: string[] }
export interface AblageBauteil { id: string; katalogId: string; geschoss: string; ort: string; hersteller: string | null; typ: string | null }

/** Ablage eines Gebaeudes, neueste zuerst; mit nurId genau ein Dokument. */
export async function ladeAblage(c: Q, gebaeudeId: string, nurId: string | null = null): Promise<AblageZeile[]> {
  const r = await c.query(
    `select d.id, d.dateiname, d.art, d.mime, d.kategorie, d.groesse, d.seiten, d.hochgeladen_am, d.scan_status, d.scan_grund, d.gescannt_am,
            coalesce(array_agg(v.bauteil_id::text order by v.bauteil_id) filter (where v.bauteil_id is not null), '{}') bauteil_ids
       from dokument d left join dokument_bauteil v on v.dokument_id = d.id
      where d.gebaeude_id = $1 and ($2::uuid is null or d.id = $2::uuid)
      group by d.id order by d.hochgeladen_am desc, d.id`, [gebaeudeId, nurId]);
  return r.rows.map((x) => ({ id: x.id, dateiname: x.dateiname, art: x.art, mime: x.mime, kategorie: x.kategorie, groesse: Number(x.groesse),
    seiten: x.seiten, hochgeladenAm: x.hochgeladen_am.toISOString(), scanStatus: x.scan_status, scanGrund: x.scan_grund,
    gescanntAm: x.gescannt_am ? x.gescannt_am.toISOString() : null, bauteilIds: x.bauteil_ids }));
}

/** Bauteile fuer die Verknuepfung (Filter Typ, Geschoss, Name im Web). */
export async function ladeAblageBauteile(c: Q, gebaeudeId: string): Promise<AblageBauteil[]> {
  const rows = (await c.query(
    `select b.id, b.katalog_id, b.hersteller, b.typ, coalesce(gs.code, ge.code) geschoss, e.bezeichnung einheit
       from bauteil b left join einheit e on e.id=b.einheit_id left join geschoss ge on ge.id=e.geschoss_id left join geschoss gs on gs.id=b.geschoss_id
      where b.gebaeude_id=$1 order by b.reihenfolge`, [gebaeudeId])).rows;
  return rows.map((r) => ({ id: r.id, katalogId: r.katalog_id, geschoss: r.geschoss, ort: r.einheit ? `${r.geschoss} · ${r.einheit}` : r.geschoss,
    hersteller: r.hersteller, typ: r.typ }));
}

/** Nur fuer Tests und Skripte; die Routen setzen alle Felder selbst. */
export async function legeDokumentAn(c: Q, a: { gebaeudeId: string; liegenschaftId: string; dateiname: string; schluessel: string; sha256: string; groesse: number;
  seiten: number | null; von: string; status: AuslesenStatus; art?: Art; mime?: string; kategorie?: Kategorie; scanStatus?: ScanStatus }) {
  const r = await c.query(
    `insert into dokument(gebaeude_id, liegenschaft_id, dateiname, schluessel, sha256, groesse, seiten, hochgeladen_von, auslesen_status, art, mime, kategorie, scan_status)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) on conflict (gebaeude_id, sha256) do nothing returning id`,
    [a.gebaeudeId, a.liegenschaftId, a.dateiname, a.schluessel, a.sha256, a.groesse, a.seiten, a.von, a.status,
      a.art ?? "pdf", a.mime ?? "application/pdf", a.kategorie ?? "offerte", a.scanStatus ?? "sauber"]);
  if (r.rows[0]) return { id: r.rows[0].id as string, neu: true };
  const alt = await c.query("select id from dokument where gebaeude_id=$1 and sha256=$2", [a.gebaeudeId, a.sha256]);
  return { id: alt.rows[0].id as string, neu: false };
}

/** Gibt die Referenz frei; ohne weitere Referenz kommt der Schluessel ins Loesch-Journal (GC raeumt auf). */
export async function gibReferenzFrei(c: Q, schluessel: string, objekt: string) {
  await c.query("delete from datei_referenz where schluessel=$1 and objekt=$2", [schluessel, objekt]);
  const rest = await c.query("select 1 from datei_referenz where schluessel=$1", [schluessel]);
  if (!rest.rowCount) await c.query("select journal_eintrag('datei.loeschen', $1)", [schluessel]);
}

/**
 * Loescht das Dokument (Verknuepfungen und Vorschlaege per cascade; uebernommene Preise behalten Quelle "dokument"
 * mit preis_vorschlag_id null = "Dokument (gelöscht)"). Nur saubere Dokumente haben eine Ablage-Referenz.
 * Die Quarantaene-Kopie raeumt der Aufrufer (Task 3).
 */
export async function loescheDokument(c: Q, dokumentId: string): Promise<{ schluessel: string; scanStatus: ScanStatus } | null> {
  const r = (await c.query("delete from dokument where id=$1 returning schluessel, scan_status", [dokumentId])).rows[0];
  if (!r) return null;
  if (r.scan_status === "sauber") await gibReferenzFrei(c, r.schluessel, `dokument:${dokumentId}`);
  return { schluessel: r.schluessel, scanStatus: r.scan_status };
}
```

- [ ] **Step 10: `app/src/preisdokument/speicher.ts`** – die Funktionen `legeDokumentAn`, `gibReferenzFrei`, `loescheDokument` entfernen und ersetzen durch
```ts
export { legeDokumentAn, gibReferenzFrei, loescheDokument } from "../dokumente/speicher.js";
```
In `ladeDokumente` die Abfrage auf PDFs beschraenken: `… from dokument where gebaeude_id=$1 and art='pdf' order by hochgeladen_am, id`.

- [ ] **Step 11: Failing API-Test** `app/test/dokumente-api.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { frischeDb } from "./hilfe.js";
import { pdf } from "./hilfe-dateien.js";
import { baueServer } from "../src/server.js";
import { erzeugeSetupToken, loeseSetupTokenEin } from "../src/auth/setup.js";

const ORIGIN = "http://localhost:3995";
const pw = randomBytes(12).toString("base64url");
const SECRET = randomBytes(32).toString("hex");
const HUELLE = { name: "Haus", grundform: "quader", breiteM: 30, tiefeM: 15, geschosse: [{ code: "EG" }, { code: "OG1" }] };
let db: Awaited<ReturnType<typeof frischeDb>>; let app: FastifyInstance;
let L1: string, L2: string, kBetr: string, kBearb: string, kLeser: string, kFremd: string, kAdmin: string;
let G: string, B1: string, B2: string;

const anfrage = (method: "GET" | "POST" | "PUT" | "DELETE", url: string, cookie: string, body?: unknown) => app.inject({
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
const ablegen = (cookie: string, daten: Buffer, name = "Datenblatt.pdf", query = "", gid = () => G) => app.inject({
  method: "POST", url: `/api/dokumente/gebaeude/${gid()}${query}`,
  headers: { cookie, origin: ORIGIN, "x-planora-request": "1", "content-type": "application/octet-stream", "x-dateiname": encodeURIComponent(name) },
  payload: daten,
});
const liste = (cookie = kBearb) => anfrage("GET", `/api/dokumente/gebaeude/${G}`, cookie);
/** Wartet, bis die Virenpruefung fertig ist (ab Task 3 asynchron). */
async function warteScan(id: string) {
  for (let i = 0; i < 600; i++) {
    const d = (await liste()).json().dokumente.find((x: any) => x.id === id);
    if (d && d.scanStatus !== "quarantaene") return d;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("Scan nicht fertig: " + id);
}

beforeAll(async () => {
  vi.stubEnv("OPENAI_API_KEY", "");
  db = await frischeDb();
  app = await baueServer({ pool: db.pool, stufe: 4, baseURL: ORIGIN, secret: SECRET, ablageWurzel: mkdtempSync(join(tmpdir(), "ablage-")) });
  L1 = (await db.pool.query("insert into liegenschaft(name) values ('L1') returning id")).rows[0].id;
  L2 = (await db.pool.query("insert into liegenschaft(name) values ('L2') returning id")).rows[0].id;
  kBetr = await konto("betrieb@planora.invalid", "betreiber", []);
  kBearb = await konto("bearb@planora.invalid", "bearbeiter", [L1]);
  kLeser = await konto("leser@planora.invalid", "leser", [L1]);
  kFremd = await konto("fremd@planora.invalid", "leser", [L2]);
  kAdmin = await konto("admin2@planora.invalid", "admin", []);
  G = (await anfrage("POST", `/api/struktur/liegenschaften/${L1}/gebaeude`, kBetr, HUELLE)).json().id;
  const leer = (await anfrage("GET", `/api/struktur/gebaeude/${G}/beschreibung`, kBearb)).json();
  const [eg] = leer.geschosse;
  const put = await anfrage("PUT", `/api/struktur/gebaeude/${G}/beschreibung`, kBearb, { ...leer, heizungStandard: { hk: "ja", fbh: "nein", tabs: "nein" },
    einheiten: [{ geschossId: eg.id, bezeichnung: "Buero A", art: "buero", flaecheM2: null }, { geschossId: eg.id, bezeichnung: "Buero B", art: "buero", flaecheM2: null }],
    bauteile: [{ katalogId: "heizung.heizkoerper", standort: { einheitIndex: 0 }, menge: 4, status: "bestaetigt", versorgt: [] },
      { katalogId: "heizung.heizkoerper", standort: { einheitIndex: 1 }, menge: 2, status: "bestaetigt", versorgt: [] }] });
  expect(put.statusCode).toBe(200);
  [B1, B2] = (await db.pool.query("select id from bauteil where gebaeude_id=$1 and katalog_id='heizung.heizkoerper' order by reihenfolge", [G])).rows.map((r) => r.id);
});
afterAll(async () => { vi.unstubAllEnvs(); await app.close(); await db.ende(); });

describe("Dokumente-API: Ablegen", () => {
  it("PDF ablegen -> 201 mit Art, Kategorie, Seiten; Duplikat 200; sauber nach Pruefung", async () => {
    const daten = pdf(2, "% a");
    const r = await ablegen(kBearb, daten);
    expect(r.statusCode).toBe(201);
    expect(r.json()).toMatchObject({ dateiname: "Datenblatt.pdf", art: "pdf", mime: "application/pdf", kategorie: "sonstiges", seiten: 2, groesse: daten.length, bauteilIds: [] });
    const r2 = await ablegen(kBearb, daten, "anders.pdf");
    expect([r2.statusCode, r2.json().id, r2.json().dateiname]).toEqual([200, r.json().id, "Datenblatt.pdf"]);
    expect((await warteScan(r.json().id)).scanStatus).toBe("sauber");
    expect((await db.pool.query("select auslesen_status from dokument where id=$1", [r.json().id])).rows[0].auslesen_status).toBe("aus");
  });
  it("JSON oder leer -> 400", async () => {
    const j = await anfrage("POST", `/api/dokumente/gebaeude/${G}`, kBearb, { a: 1 });
    expect([j.statusCode, j.json()]).toEqual([400, { fehler: "typ_unbekannt" }]);
    const leer = await app.inject({ method: "POST", url: `/api/dokumente/gebaeude/${G}`, headers: { cookie: kBearb, origin: ORIGIN, "x-planora-request": "1" } });
    expect([leer.statusCode, leer.json()]).toEqual([400, { fehler: "leer" }]);
    expect((await ablegen(kBearb, Buffer.from("GIF89a"))).json()).toEqual({ fehler: "typ_unbekannt" });
  });
  it("Dateiname ohne Steuer- und Bidi-Zeichen", async () => {
    const zeichen = [0x01, 0x1f, 0x7f, 0x200e, 0x200f, 0x202a, 0x202e, 0x2066, 0x2069].map((c) => String.fromCharCode(c)).join("");
    const r = await ablegen(kBearb, pdf(1, "% bidi"), `Rechnung${zeichen}fdp.pdf`);
    expect([r.statusCode, r.json().dateiname]).toEqual([201, "Rechnungfdp.pdf"]);
  });
  it("Leser liest inkl. Bauteile, darf nicht ablegen; Fremd 404", async () => {
    const r = await liste(kLeser);
    expect(r.statusCode).toBe(200);
    expect(r.json().darfAendern).toBe(false);
    expect(r.json().bauteile.map((b: any) => b.id)).toEqual(expect.arrayContaining([B1, B2]));
    expect(r.json().bauteile[0]).toMatchObject({ katalogId: "heizung.heizkoerper", geschoss: "EG", ort: "EG · Buero A" });
    expect((await ablegen(kLeser, pdf(1, "% leser"))).statusCode).toBe(403);
    expect((await liste(kFremd)).statusCode).toBe(404);
    expect((await ablegen(kFremd, pdf(1, "% fremd"))).statusCode).toBe(404);
  });
});

describe("Dokumente-API: Oeffnen, Herunterladen, Loeschen", () => {
  it("PDF inline mit nosniff, download=1 als attachment, Fremd 404", async () => {
    const daten = pdf(1, "% oeffnen");
    const id = (await ablegen(kBearb, daten)).json().id;
    await warteScan(id);
    const r = await anfrage("GET", `/api/dokumente/${id}/datei`, kLeser);
    expect(r.statusCode).toBe(200);
    expect(r.headers["content-type"]).toContain("application/pdf");
    expect(String(r.headers["content-disposition"])).toMatch(/^inline/);
    expect(r.headers["x-content-type-options"]).toBe("nosniff");
    expect(Buffer.compare(r.rawPayload, daten)).toBe(0);
    expect(String((await anfrage("GET", `/api/dokumente/${id}/datei?download=1`, kLeser)).headers["content-disposition"])).toMatch(/^attachment/);
    expect((await anfrage("GET", `/api/dokumente/${id}/datei?download=ja`, kLeser)).statusCode).toBe(400);
    expect((await anfrage("GET", `/api/dokumente/${id}/datei`, kFremd)).statusCode).toBe(404);
  });
  it("Loeschen: Leser 403, Bearbeiter 204, Referenz weg, Journal", async () => {
    const id = (await ablegen(kBearb, pdf(1, "% loeschen"))).json().id;
    await warteScan(id);
    const schluessel = (await db.pool.query("select schluessel from dokument where id=$1", [id])).rows[0].schluessel;
    expect((await anfrage("DELETE", `/api/dokumente/${id}`, kLeser)).statusCode).toBe(403);
    expect((await anfrage("DELETE", `/api/dokumente/${id}`, kBearb)).statusCode).toBe(204);
    expect((await liste()).json().dokumente.some((d: any) => d.id === id)).toBe(false);
    expect((await db.pool.query("select 1 from datei_referenz where objekt=$1", [`dokument:${id}`])).rowCount).toBe(0);
    expect((await db.pool.query("select 1 from loesch_journal where art='datei.loeschen' and ziel=$1", [schluessel])).rowCount).toBeGreaterThan(0);
    expect((await anfrage("DELETE", `/api/dokumente/${id}`, kBearb)).statusCode).toBe(404);
  });
});
```

- [ ] **Step 12: Run** `npx.cmd vitest run test/dokumente-api.test.ts` — Expected: FAIL (Route fehlt, 501 vom Platzhalter).

- [ ] **Step 13: `app/src/dokumente/routen.ts`**
```ts
import type { FastifyInstance, FastifyReply } from "fastify";
import type pg from "pg";
import { createHash, randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { speichereUndReferenziere } from "../ablage/ablage.js";
import { ID_PARAMS } from "../welt/schema.js";
import { auditEreignis } from "../audit/audit.js";
import { pruefe } from "../rechte/rechte.js";
import { MAX_BYTES, erkenneTyp, startKategorie } from "./typ.js";
import { zaehleSeiten } from "./pdf.js";
import { DATEI_QUERY } from "./schema.js";
import { gibReferenzFrei, ladeAblage, ladeAblageBauteile, loescheDokument } from "./speicher.js";

/** Entfernt Steuer- und Bidi-Zeichen (Anzeige-Taeuschung, z. B. U+202E) und begrenzt auf 255 Zeichen. */
export function bereinigeDateiname(name: string): string {
  return name.replace(/[\u0000-\u001F\u007F\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "").trim().slice(0, 255);
}

export function registriereDokumentRouten(app: FastifyInstance, pool: pg.Pool) {
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
  /** Zugriff ueber das Gebaeude des Dokuments; gebaeudeId ist leer, wenn das Dokument fehlt. */
  async function zugriffDokument(c: pg.ClientBase, benutzerId: string, dokumentId: string, schreiben: boolean): Promise<{ code: 200 | 403 | 404; gebaeudeId: string }> {
    const r = (await c.query("select gebaeude_id from dokument where id=$1", [dokumentId])).rows[0];
    if (!r) return { code: 404, gebaeudeId: "" };
    return { code: await zugriff(c, benutzerId, r.gebaeude_id, schreiben), gebaeudeId: r.gebaeude_id as string };
  }
  const verweigert = (reply: FastifyReply, code: 403 | 404) => reply.code(code).send({ fehler: code === 404 ? "nicht gefunden" : "keine Berechtigung" });
  const zeile = async (gebaeudeId: string, id: string) => (await mitClient((c) => ladeAblage(c, gebaeudeId, id)))[0];
  const bestehendes = async (gebaeudeId: string, sha: string) => {
    const r = (await pool.query("select id from dokument where gebaeude_id=$1 and sha256=$2", [gebaeudeId, sha])).rows[0];
    return r ? zeile(gebaeudeId, r.id) : null;
  };

  app.register(async (scope) => {
    // Rohe Bytes in einem Request (ADR 0016 Nachtrag, kein Multipart). Typ kommt aus den Magic Bytes, nie aus Content-Type oder Endung.
    scope.addContentTypeParser("application/octet-stream", { parseAs: "buffer", bodyLimit: MAX_BYTES + 1024 }, (_req, body, done) => done(null, body));

    scope.post<{ Params: { id: string } }>("/api/dokumente/gebaeude/:id", { schema: { params: ID_PARAMS } }, async (req, reply) => {
      const k = req.kontext!;
      const z = await mitClient((c) => zugriff(c, k.benutzerId, req.params.id, true));
      if (z !== 200) return verweigert(reply, z);
      const g = (await pool.query("select liegenschaft_id from gebaeude where id=$1", [req.params.id])).rows[0];
      if (!g) return verweigert(reply, 404); // zwischen Zugriffspruefung und Einfuegen geloescht
      const daten = req.body;
      if (!Buffer.isBuffer(daten)) return reply.code(400).send({ fehler: daten === undefined || daten === null ? "leer" : "typ_unbekannt" });
      const t = erkenneTyp(daten);
      if (!t.ok) return reply.code(400).send({ fehler: t.grund });
      let name = "Dokument";
      try { name = bereinigeDateiname(decodeURIComponent(String(req.headers["x-dateiname"] ?? ""))) || name; } catch { /* Standardname */ }
      const sha = createHash("sha256").update(daten).digest("hex");
      const vorhanden = await bestehendes(req.params.id, sha);
      if (vorhanden) return reply.code(200).send(vorhanden);
      const id = randomUUID();
      const objekt = `dokument:${id}`;
      const seiten = t.typ.art === "pdf" ? zaehleSeiten(daten) : null;
      const kategorie = startKategorie(t.typ.art);
      // Uebergang bis Task 3: direkt in die Ablage, scan_status 'sauber'. Task 3 ersetzt diesen Block durch die Quarantaene.
      const d = await speichereUndReferenziere(pool, app.ablage, Readable.from(daten), objekt);
      try {
        await inTx("begin", async (c) => {
          await c.query(`insert into dokument(id, gebaeude_id, liegenschaft_id, dateiname, schluessel, sha256, groesse, seiten, hochgeladen_von, auslesen_status, art, mime, kategorie, scan_status, gescannt_am)
            values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'aus',$10,$11,$12,'sauber',now())`,
            [id, req.params.id, g.liegenschaft_id, name, d.schluessel, d.sha256, d.groesse, seiten, k.benutzerId, t.typ.art, t.typ.mime, kategorie]);
          await auditEreignis(c, k.auditId, "dokument.abgelegt", { gebaeudeId: req.params.id, dokumentId: id, groesse: d.groesse, art: t.typ.art });
        });
      } catch (e) {
        await mitClient((c) => gibReferenzFrei(c, d.schluessel, objekt)).catch(() => {});
        const dup = await bestehendes(req.params.id, sha);
        if (dup) return reply.code(200).send(dup);
        throw e;
      }
      return reply.code(201).send(await zeile(req.params.id, id));
    });

    scope.get<{ Params: { id: string } }>("/api/dokumente/gebaeude/:id", { schema: { params: ID_PARAMS } }, async (req, reply) =>
      inTx("begin isolation level repeatable read read only", async (c) => {
        const z = await zugriff(c, req.kontext!.benutzerId, req.params.id, false);
        if (z !== 200) return verweigert(reply, z);
        return { dokumente: await ladeAblage(c, req.params.id), bauteile: await ladeAblageBauteile(c, req.params.id),
          darfAendern: (await zugriff(c, req.kontext!.benutzerId, req.params.id, true)) === 200 };
      }));

    scope.get<{ Params: { id: string }; Querystring: { download?: "1" } }>("/api/dokumente/:id/datei",
      { schema: { params: ID_PARAMS, querystring: DATEI_QUERY } }, async (req, reply) => {
        const z = await mitClient((c) => zugriffDokument(c, req.kontext!.benutzerId, req.params.id, false));
        if (z.code !== 200) return verweigert(reply, z.code as 403 | 404);
        const r = (await pool.query("select dateiname, schluessel, art, mime, scan_status from dokument where id=$1", [req.params.id])).rows[0];
        if (!r) return verweigert(reply, 404);
        // Spec 4.7: nicht sauber liefert nie Bytes, auch nicht an den Admin.
        if (r.scan_status !== "sauber") return reply.code(409).send({ fehler: "nicht_sauber" });
        const anhang = req.query.download === "1" || r.art === "office";
        return reply.type(r.mime)
          .header("x-content-type-options", "nosniff")
          .header("cache-control", "private, no-store")
          .header("content-disposition", `${anhang ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(r.dateiname)}`)
          .send(app.ablage.lese(r.schluessel));
      });

    scope.delete<{ Params: { id: string } }>("/api/dokumente/:id", { schema: { params: ID_PARAMS } }, async (req, reply) => {
      const k = req.kontext!;
      const z = await mitClient((c) => zugriffDokument(c, k.benutzerId, req.params.id, true));
      if (z.code !== 200) return verweigert(reply, z.code as 403 | 404);
      await inTx("begin", async (c) => {
        await loescheDokument(c, req.params.id);
        await auditEreignis(c, k.auditId, "dokument.geloescht", { gebaeudeId: z.gebaeudeId, dokumentId: req.params.id });
      });
      return reply.code(204).send();
    });
  });
}
```

- [ ] **Step 14: `app/src/server.ts`** – `import { registriereDokumentRouten } from "./dokumente/routen.js";` und vor `registriereLebensdauerRouten(app, o.pool);` einfuegen:
```ts
  registriereDokumentRouten(app, o.pool); // Anlagenakte (E46): /api/dokumente/… (Kernmodul, immer aktiv)
```

- [ ] **Step 15: `app/src/preisdokument/routen.ts` entschlacken** – entfernen: `bereinigeDateiname`, `scope.addContentTypeParser(…)`, die Routen `POST /api/preisdokument/gebaeude/:id/dokumente`, `GET /api/preisdokument/dokumente/:id/datei`, `DELETE /api/preisdokument/dokumente/:id`, die nicht mehr genutzten Imports (`createHash`, `randomUUID`, `Readable`, `speichereUndReferenziere`, `pruefePdf`, `MAX_BYTES`, `loescheDokument`, `gibReferenzFrei`). `neu-lesen`, Uebersicht, Uebernehmen/Verwerfen/Alle-sicheren bleiben unveraendert. Danach `grep -rn "bereinigeDateiname" app/src app/test` – Treffer nur in `src/dokumente/routen.ts`.

- [ ] **Step 16: `app/test/preisdokument-api.test.ts` anpassen** (Verhalten der verschobenen Routen prueft jetzt `dokumente-api.test.ts`):
  - Helfer `hochladen` auf die neue Route:
```ts
const hochladen = (cookie: string, gid: string, daten: Buffer, name = "Offerte Pumpen.pdf") => app.inject({
  method: "POST", url: `/api/dokumente/gebaeude/${gid}`,
  headers: { cookie, origin: ORIGIN, "x-planora-request": "1", "content-type": "application/octet-stream", "x-dateiname": encodeURIComponent(name) },
  payload: daten,
});
```
  - Tests "Upload, Duplikat, Nicht-PDF", "Body ohne application/pdf …", "Gebaeude zwischen Zugriffspruefung …", "Dateiname ohne Steuer- und Bidi-Zeichen", "Datei oeffnen inline", "Loeschen: 204 …" entfernen. Im Test "Leser liest, darf nicht hochladen; Fremd 404" vor den Erwartungen `await hochladen(kBearb, G, pdf(1, "% basis"));` ergaenzen und die beiden Upload-Erwartungen (Leser 403, Fremd 404) entfernen.
  - Test "Upload liest im Hintergrund …" ersetzen durch:
```ts
  it("Ablegen liest nicht automatisch; Preise lesen per neu-lesen; Vorschlag mit bauteilIds", async () => {
    const r = await app2.inject({ method: "POST", url: `/api/dokumente/gebaeude/${G}`,
      headers: { cookie: kBearb, origin: ORIGIN, "x-planora-request": "1", "content-type": "application/octet-stream", "x-dateiname": "a.pdf" }, payload: pdf(1, "% lesen") });
    expect(r.statusCode).toBe(201);
    const id = r.json().id;
    expect((await gib(app2, "GET", liste(), kBearb)).json().dokumente.find((x: any) => x.id === id).status).toBe("aus");
    expect((await gib(app2, "POST", `/api/preisdokument/dokumente/${id}/neu-lesen`, kBearb)).statusCode).toBe(202);
    const d = await warteStatus(id, "fertig");
    expect(d.vorschlaege).toHaveLength(1);
    expect(d.vorschlaege[0].bauteilIds).toEqual([B]);
    expect((await gib(app2, "GET", liste(), kBearb)).json()).toMatchObject({ auslesen: "an", budget: { limitUsd: 20 } });
    expect((await gib(app2, "POST", `/api/preisdokument/dokumente/${id}/neu-lesen`, kBearb)).statusCode).toBe(202);
    expect((await warteStatus(id, "fertig")).vorschlaege).toHaveLength(1);
    expect((await gib(app2, "POST", `/api/preisdokument/dokumente/${id}/neu-lesen`, kLeser)).statusCode).toBe(403);
    expect((await gib(app2, "POST", `/api/preisdokument/dokumente/${id}/neu-lesen`, kFremd)).statusCode).toBe(404);
  });
```
  - `const pdf = …` lokal entfernen und `import { pdf } from "./hilfe-dateien.js";` verwenden.

- [ ] **Step 17: Web-Pfade** `app/web/src/preisdokument/api.ts`:
```ts
/** Datei roh ablegen (Modul dokumente, kein Multipart); gleiche Schutz-Header wie die uebrigen Schreibaufrufe. */
export async function ladeHoch(gebaeudeId: string, datei: File): Promise<{ id: string; dateiname: string }> {
  const r = await fetch(`/api/dokumente/gebaeude/${gebaeudeId}`, {
    method: "POST", credentials: "same-origin",
    headers: { "content-type": "application/octet-stream", "x-dateiname": encodeURIComponent(datei.name), "x-planora-request": "1" },
    body: datei,
  });
  if (!r.ok) {
    let j: unknown = null;
    try { j = await r.json(); } catch { /* kein JSON */ }
    throw new ApiFehler(r.status, fehlerMeldungen(j), fehlerCodes(j));
  }
  return (await r.json()) as { id: string; dateiname: string };
}
export const loescheDokument = (id: string) => loescheJson<void>(`/api/dokumente/${id}`);
export const dateiUrl = (id: string, seite?: number) => `/api/dokumente/${id}/datei${seite ? `#page=${seite}` : ""}`;
```
In `app/web/src/karten/preisQuelle.test.ts` die erwarteten `href` auf `/api/dokumente/d1/datei#page=2` bzw. `/api/dokumente/d2/datei#page=3` aendern. `DokumentZeile` als Rueckgabetyp von `ladeHoch` wird in `seiten/Dokumente.tsx` nur fuer `id`/`dateiname` genutzt (Typpruefung bestaetigt).

- [ ] **Step 18: Run** in `app/`: `npx.cmd vitest run test/dokumente-api.test.ts test/dokumente-migration.test.ts test/preisdokument-api.test.ts test/preisdokument-laeufer.test.ts test/preisdokument-kodierung.test.ts test/preisdokument-uebernehmen.test.ts test/preisdokument-pdf.test.ts test/module-guard.test.ts test/server.test.ts` und `npm.cmd run pruefe:typen`; in `app/web/`: `npx.cmd vitest run` und `npx.cmd tsc --noEmit -p .` — Expected: PASS.

- [ ] **Step 19: Commit**
```bash
git add app/src/db/migrationen/018_anlagenakte.sql app/src/dokumente app/src/preisdokument app/src/server.ts app/test/hilfe-dateien.ts app/test/dokumente-*.test.ts app/test/preisdokument-api.test.ts app/web/src/preisdokument/api.ts app/web/src/karten/preisQuelle.test.ts
git commit -m "Anlagenakte T1: Migration 018, Kernmodul dokumente, Ablage-Routen verschoben, kein automatisches Lesen" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Dateityp aus Magic Bytes, 100 MB, Kategorie beim Ablegen

**Files:**
- Modify: `app/src/dokumente/typ.ts`, `app/src/dokumente/schema.ts`, `app/src/dokumente/routen.ts`, `app/test/hilfe-dateien.ts`, `app/test/dokumente-api.test.ts`
- Create: `app/test/dokumente-typ.test.ts`

**Interfaces:**
- Consumes: `erkenneTyp`, `startKategorie`, `KATEGORIEN` (Task 1).
- Produces: `erkenneTyp` fuer alle erlaubten Typen; `zipNamen(d: Buffer): string[] | null`; `ABLEGEN_QUERY` (Query `kategorie`); Upload-Query `?kategorie=<Kategorie>`.

Hinweis [A]: Makro-Dateien (OOXML mit `vbaProject.bin`, OLE2 mit `_VBA_PROJECT`) werden mit Grund `makro` abgelehnt; die Spec nennt nur docx/xlsx/pptx/doc/xls/ppt, Makros sind keine dieser Formen. OLE2-Dateien ohne Word-/Excel-/PowerPoint-Stream (z. B. `.msi`) sind `typ_unbekannt`. Das Lesen der ZIP-Namen aus dem zentralen Verzeichnis ist kein Parsen des Inhalts (nichts wird entpackt). Die PDF-Signatur muss bei Byte 0 stehen [A] wie bisher.

- [ ] **Step 1: Test-Helfer erweitern** (`app/test/hilfe-dateien.ts` anhaengen):
```ts
/** Minimales ZIP (nur gespeicherte Eintraege, CRC 0) mit den angegebenen Namen; reicht fuer die Typerkennung. */
export function zip(namen: string[]): Buffer {
  const lokal: Buffer[] = [], zentral: Buffer[] = [];
  let offset = 0;
  for (const n of namen) {
    const name = Buffer.from(n, "utf8"), inhalt = Buffer.from("x");
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt32LE(inhalt.length, 18); h.writeUInt32LE(inhalt.length, 22); h.writeUInt16LE(name.length, 26);
    const z = Buffer.alloc(46); z.writeUInt32LE(0x02014b50, 0); z.writeUInt16LE(20, 4); z.writeUInt16LE(20, 6); z.writeUInt32LE(inhalt.length, 20); z.writeUInt32LE(inhalt.length, 24); z.writeUInt16LE(name.length, 28); z.writeUInt32LE(offset, 42);
    lokal.push(h, name, inhalt); zentral.push(z, name);
    offset += 30 + name.length + inhalt.length;
  }
  const cd = Buffer.concat(zentral);
  const e = Buffer.alloc(22); e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(namen.length, 8); e.writeUInt16LE(namen.length, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(offset, 16);
  return Buffer.concat([...lokal, cd, e]);
}
export const docx = (zusatz = "") => zip(["[Content_Types].xml", "_rels/.rels", "word/document.xml", ...(zusatz ? [zusatz] : [])]);
export const xlsx = (zusatz = "") => zip(["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", ...(zusatz ? [zusatz] : [])]);
export const pptx = () => zip(["[Content_Types].xml", "ppt/presentation.xml"]);
const OLE2 = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
/** OLE2-Huelle mit Stream-Namen im Verzeichnis (UTF-16LE wie im echten Format). */
export const ole = (...streams: string[]) => Buffer.concat([OLE2, Buffer.alloc(504), ...streams.map((s) => Buffer.from(s, "utf16le"))]);
export const png = (zusatz = "") => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("IHDR" + zusatz)]);
export const jpg = () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("JFIF")]);
export const heic = (marke = "heic") => Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftyp" + marke + "0000mif1heic")]);
export const exe = () => Buffer.concat([Buffer.from("MZ"), Buffer.alloc(64)]);
```

- [ ] **Step 2: Failing test** `app/test/dokumente-typ.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { erkenneTyp, startKategorie, MAX_BYTES, zipNamen } from "../src/dokumente/typ.js";
import { pdf, docx, xlsx, pptx, ole, png, jpg, heic, exe, zip } from "./hilfe-dateien.js";

const typ = (d: Buffer) => { const r = erkenneTyp(d); return r.ok ? [r.typ.art, r.typ.mime] : r.grund; };
describe("erkenneTyp", () => {
  it("PDF, Bilder", () => {
    expect(typ(pdf())).toEqual(["pdf", "application/pdf"]);
    expect(typ(jpg())).toEqual(["bild", "image/jpeg"]);
    expect(typ(png())).toEqual(["bild", "image/png"]);
    expect(typ(heic())).toEqual(["bild", "image/heic"]);
    expect(typ(heic("mif1"))).toEqual(["bild", "image/heic"]);
    expect(typ(heic("avif"))).toBe("typ_unbekannt");
  });
  it("Office neu und alt", () => {
    expect(typ(docx())).toEqual(["office", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);
    expect(typ(xlsx())).toEqual(["office", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]);
    expect(typ(pptx())).toEqual(["office", "application/vnd.openxmlformats-officedocument.presentationml.presentation"]);
    expect(typ(ole("Root Entry", "WordDocument"))).toEqual(["office", "application/msword"]);
    expect(typ(ole("Root Entry", "Workbook"))).toEqual(["office", "application/vnd.ms-excel"]);
    expect(typ(ole("Root Entry", "PowerPoint Document"))).toEqual(["office", "application/vnd.ms-powerpoint"]);
  });
  it("Makros, fremde Container, EXE, Text", () => {
    expect(typ(docx("word/vbaProject.bin"))).toBe("makro");
    expect(typ(ole("Root Entry", "Workbook", "_VBA_PROJECT"))).toBe("makro");
    expect(typ(ole("Root Entry", "SummaryInformation"))).toBe("typ_unbekannt"); // z. B. MSI
    expect(typ(zip(["a.txt"]))).toBe("typ_unbekannt");
    expect(typ(zip(["[Content_Types].xml", "andere/x.xml"]))).toBe("typ_unbekannt");
    expect(typ(exe())).toBe("typ_unbekannt");
    expect(typ(Buffer.from("<svg onload=alert(1)>"))).toBe("typ_unbekannt");
  });
  it("leer und ueber 100 MB", () => {
    expect(typ(Buffer.alloc(0))).toBe("leer");
    expect(typ(Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(MAX_BYTES)]))).toBe("zu_gross");
    expect(MAX_BYTES).toBe(104857600);
  });
  it("zipNamen: defektes Verzeichnis -> null", () => {
    expect(zipNamen(Buffer.from("PK\u0003\u0004kaputt"))).toBeNull();
    expect(zipNamen(docx())).toContain("word/document.xml");
  });
  it("startKategorie", () => {
    expect([startKategorie("bild"), startKategorie("pdf"), startKategorie("office")]).toEqual(["foto", "sonstiges", "sonstiges"]);
  });
});
```

- [ ] **Step 3: Run** `npx.cmd vitest run test/dokumente-typ.test.ts` — Expected: FAIL (`zipNamen` fehlt, Bilder/Office `typ_unbekannt`).

- [ ] **Step 4: `erkenneTyp` vollstaendig** – in `app/src/dokumente/typ.ts` `erkenneTyp` ersetzen und ergaenzen:
```ts
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const OLE2 = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const HEIC_MARKEN = new Set(["heic", "heix", "heim", "heis", "hevc", "hevx", "mif1", "msf1"]); // [A] ohne avif
const MAX_ZIP_EINTRAEGE = 20_000;
const MIME = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  doc: "application/msword", xls: "application/vnd.ms-excel", ppt: "application/vnd.ms-powerpoint",
} as const;
const u16 = (s: string) => Buffer.from(s, "utf16le");
type Erkannt = { ok: true; typ: Typ } | { ok: false; grund: TypGrund };
const ja = (art: Art, mime: string): Erkannt => ({ ok: true, typ: { art, mime } });
const nein = (grund: TypGrund): Erkannt => ({ ok: false, grund });

/** Namen aus dem zentralen Verzeichnis einer ZIP-Datei (nur Kopfdaten, nichts wird entpackt); null, wenn kein gueltiges ZIP. */
export function zipNamen(d: Buffer): string[] | null {
  if (d.length < 22) return null;
  const min = Math.max(0, d.length - 22 - 0xffff);
  for (let i = d.length - 22; i >= min; i--) {
    if (d.readUInt32LE(i) !== 0x06054b50) continue;
    const anzahl = d.readUInt16LE(i + 10), groesse = d.readUInt32LE(i + 12), start = d.readUInt32LE(i + 16);
    if (start + groesse > i) return null;
    const namen: string[] = [];
    let p = start;
    for (let n = 0; n < anzahl && n < MAX_ZIP_EINTRAEGE; n++) {
      if (p + 46 > i || d.readUInt32LE(p) !== 0x02014b50) return null;
      const nl = d.readUInt16LE(p + 28), xl = d.readUInt16LE(p + 30), kl = d.readUInt16LE(p + 32);
      namen.push(d.subarray(p + 46, p + 46 + nl).toString("utf8"));
      p += 46 + nl + xl + kl;
    }
    return namen;
  }
  return null;
}

function ooxml(d: Buffer): Erkannt {
  const namen = zipNamen(d);
  if (!namen || !namen.includes("[Content_Types].xml")) return nein("typ_unbekannt");
  if (namen.some((n) => /(^|\/)vbaProject\.bin$/i.test(n))) return nein("makro");
  const hat = (p: string) => namen.some((n) => n.startsWith(p));
  if (hat("word/")) return ja("office", MIME.docx);
  if (hat("xl/")) return ja("office", MIME.xlsx);
  if (hat("ppt/")) return ja("office", MIME.pptx);
  return nein("typ_unbekannt");
}

function ole2(d: Buffer): Erkannt {
  if (d.includes(u16("_VBA_PROJECT"))) return nein("makro");
  if (d.includes(u16("WordDocument"))) return ja("office", MIME.doc);
  if (d.includes(u16("Workbook")) || d.includes(u16("Book"))) return ja("office", MIME.xls);
  if (d.includes(u16("PowerPoint Document"))) return ja("office", MIME.ppt);
  return nein("typ_unbekannt");
}

export function erkenneTyp(d: Buffer): Erkannt {
  if (!d.length) return nein("leer");
  if (d.length > MAX_BYTES) return nein("zu_gross");
  if (d.subarray(0, 5).toString("latin1") === "%PDF-") return ja("pdf", "application/pdf");
  if (d.length >= 3 && d[0] === 0xff && d[1] === 0xd8 && d[2] === 0xff) return ja("bild", "image/jpeg");
  if (d.subarray(0, 8).equals(PNG)) return ja("bild", "image/png");
  if (d.length >= 12 && d.toString("latin1", 4, 8) === "ftyp" && HEIC_MARKEN.has(d.toString("latin1", 8, 12))) return ja("bild", "image/heic");
  if (d.length >= 4 && d.readUInt32LE(0) === 0x04034b50) return ooxml(d);
  if (d.subarray(0, 8).equals(OLE2)) return ole2(d);
  return nein("typ_unbekannt");
}
```

- [ ] **Step 5: Run** — Expected: PASS.

- [ ] **Step 6: Kategorie beim Ablegen** – `app/src/dokumente/schema.ts` ergaenzen:
```ts
import { KATEGORIEN } from "./typ.js";
export const ABLEGEN_QUERY = { type: "object", additionalProperties: false, properties: {
  kategorie: { type: "string", enum: [...KATEGORIEN] },
} } as const;
```
In `routen.ts` die Upload-Route auf `scope.post<{ Params: { id: string }; Querystring: { kategorie?: Kategorie } }>(…, { schema: { params: ID_PARAMS, querystring: ABLEGEN_QUERY } }, …)` umstellen und `const kategorie = req.query.kategorie ?? startKategorie(t.typ.art);` (Import `type Kategorie` aus `./typ.js`).

- [ ] **Step 7: Failing API-Tests** in `app/test/dokumente-api.test.ts` (Import `xlsx, png, exe, docx` aus `./hilfe-dateien.js`):
```ts
describe("Dokumente-API: Typen", () => {
  it("Excel -> office, attachment auch ohne download", async () => {
    const r = await ablegen(kBearb, xlsx(), "Kosten.xlsx");
    expect(r.statusCode).toBe(201);
    expect(r.json()).toMatchObject({ art: "office", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", kategorie: "sonstiges", seiten: null });
    await warteScan(r.json().id);
    const f = await anfrage("GET", `/api/dokumente/${r.json().id}/datei`, kLeser);
    expect(String(f.headers["content-disposition"])).toMatch(/^attachment/);
    expect(f.headers["x-content-type-options"]).toBe("nosniff");
  });
  it("falsche Endung: PNG als .pdf -> bild/foto, inline image/png", async () => {
    const r = await ablegen(kBearb, png("a"), "foto.pdf");
    expect(r.json()).toMatchObject({ dateiname: "foto.pdf", art: "bild", mime: "image/png", kategorie: "foto" });
    await warteScan(r.json().id);
    const f = await anfrage("GET", `/api/dokumente/${r.json().id}/datei`, kLeser);
    expect([f.headers["content-type"], String(f.headers["content-disposition"]).startsWith("inline")]).toEqual(["image/png", true]);
  });
  it("EXE als .pdf und Makro-Datei -> 400", async () => {
    expect((await ablegen(kBearb, exe(), "rechnung.pdf")).json()).toEqual({ fehler: "typ_unbekannt" });
    expect((await ablegen(kBearb, docx("word/vbaProject.bin"), "brief.docx")).json()).toEqual({ fehler: "makro" });
  });
  it("Kategorie beim Ablegen; ungueltige Kategorie 400", async () => {
    expect((await ablegen(kBearb, pdf(1, "% offerte"), "o.pdf", "?kategorie=offerte")).json().kategorie).toBe("offerte");
    expect((await ablegen(kBearb, pdf(1, "% x"), "o.pdf", "?kategorie=rechnung")).statusCode).toBe(400);
  });
});
```

- [ ] **Step 8: Run** `npx.cmd vitest run test/dokumente-api.test.ts test/dokumente-typ.test.ts` und `npm.cmd run pruefe:typen` — Expected: PASS.

- [ ] **Step 9: Commit**
```bash
git add app/src/dokumente app/test/hilfe-dateien.ts app/test/dokumente-typ.test.ts app/test/dokumente-api.test.ts
git commit -m "Anlagenakte T2: Dateityp aus Magic Bytes, Office als Anhang, Kategorie beim Ablegen" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Quarantaene, Scanner-Port, clamd-Adapter, Pruefer

**Files:**
- Create: `app/src/dokumente/scanner.ts`, `app/src/dokumente/clamd.ts`, `app/src/dokumente/pruefer.ts`, `app/test/dokumente-scanner.test.ts`, `app/test/dokumente-pruefer.test.ts`
- Modify: `app/src/dokumente/routen.ts`, `app/src/server.ts`, `app/src/start/api.ts`, `app/entwicklung/start.ts`, `app/test/dokumente-api.test.ts`, `app/test/preisdokument-api.test.ts`

**Interfaces:**
- Consumes: `legeDokumentAn`, `gibReferenzFrei`, `loescheDokument`, `ladeAblage` (Task 1); `Ablage`, `dateiAblage`, `speichereUndReferenziere` (`src/ablage/ablage.ts`).
- Produces:
```ts
// scanner.ts
export type ScanErgebnis = { ergebnis: "sauber" } | { ergebnis: "befund"; signatur: string };
export interface VirenScanner { pruefe(daten: Buffer): Promise<ScanErgebnis> }   // wirft bei Ausfall
export const EICAR: string;
export function fakeScanner(o?: { ausfall?: () => boolean; verzoegerungMs?: number }): VirenScanner & { aufrufe: number }
export function scannerKonfig(env: NodeJS.ProcessEnv): { host: string; port: number } | null
// clamd.ts
export interface ClamdOptionen { host: string; port: number; timeoutMs?: number; versuche?: number; pauseMs?: number }
export function deuteAntwort(antwort: string): ScanErgebnis
export function clamdScanner(o: ClamdOptionen): VirenScanner & { ping(): Promise<boolean> }
// pruefer.ts
export const SCAN_FEHLER_TEXT = "Virenprüfung nicht erreichbar.";
export interface Pruefer { starte(id: string): void; warteLeer(): Promise<void>; reiheNeuEin(): Promise<number> }
export function erzeugePruefer(pool: pg.Pool, ablage: Ablage, quarantaene: Ablage, scanner: VirenScanner, o?: { gleichzeitig?: number }): Pruefer
export function bereinigeSignatur(s: string): string
export function raeumeQuarantaeneKopie(pool: Pick<pg.Pool, "query">, quarantaene: Ablage, schluessel: string): Promise<void>
export function raeumeAbgelehnteAuf(pool: pg.Pool, quarantaene: Ablage, tage?: number): Promise<number>
// routen.ts
export function registriereDokumentRouten(app: FastifyInstance, pool: pg.Pool, o: { pruefer: Pruefer; quarantaene: Ablage }): void
// server.ts
ServerOptionen.virenScanner?: VirenScanner   // Tests injizieren; sonst clamd aus PLANORA_CLAMD_HOST, ohne Konfiguration Fake
```
- Route neu: `POST /api/dokumente/:id/erneut-pruefen` -> `202 AblageZeile` (nur `scan_fehler`, sonst `409 { fehler: "nicht_scan_fehler" }`).

Hinweis [A]: Quarantaene = eigene `dateiAblage` unter `<ablageWurzel>/quarantaene` (gleicher sha256-Mechanismus, kein GC-Lock, keine `datei`-Zeile, nicht im Backup). Der Schluessel ist in beiden Bereichen identisch; `scan_status` sagt, wo die Bytes liegen. Saubere Bytes kommen per `speichereUndReferenziere` in die Ablage, die Quarantaene-Kopie wird geloescht, sobald kein anderes ungeprueftes Dokument (gleicher Inhalt, anderes Gebaeude) sie braucht. Abgelehnte Dateien: nach 7 Tagen [A] loescht die Bereinigung Zeile und Quarantaene-Kopie (Spur bleibt im Audit `dokument.abgelehnt`); sie laeuft beim Start und alle 24 h im api-Prozess. Mehrere Server auf derselben DB brauchen dieselbe `ablageWurzel` (Produktion: ein api-Dienst; Tests mit mehreren Servern teilen die Wurzel). Der clamd-Adapter wiederholt Verbindungsfehler 3-mal (2 s, 4 s) [A], damit Uploads direkt nach dem Containerstart nicht sofort `scan_fehler` werden. Fehlertexte von clamd landen nur im Log, in der DB steht der feste Text `SCAN_FEHLER_TEXT`.

- [ ] **Step 1: Failing test** `app/test/dokumente-scanner.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { createServer, type AddressInfo } from "node:net";
import { EICAR, fakeScanner, scannerKonfig } from "../src/dokumente/scanner.js";
import { clamdScanner, deuteAntwort } from "../src/dokumente/clamd.js";
import { pdf } from "./hilfe-dateien.js";

/** Minimaler clamd (zPING, zINSTREAM) fuer Protokolltests. */
function fakeClamd(antwort: (daten: Buffer) => string) {
  const server = createServer((s) => {
    let puffer = Buffer.alloc(0);
    s.on("data", (d) => {
      puffer = Buffer.concat([puffer, d]);
      if (puffer.subarray(0, 6).toString("latin1") === "zPING\0") { s.end("PONG\0"); return; }
      const kopf = "zINSTREAM\0";
      if (puffer.length < kopf.length || puffer.subarray(0, kopf.length).toString("latin1") !== kopf) return;
      let p = kopf.length; const teile: Buffer[] = [];
      while (p + 4 <= puffer.length) {
        const n = puffer.readUInt32BE(p);
        if (n === 0) { s.end(antwort(Buffer.concat(teile)) + "\0"); return; }
        if (p + 4 + n > puffer.length) return;
        teile.push(puffer.subarray(p + 4, p + 4 + n)); p += 4 + n;
      }
    });
  });
  return new Promise<{ port: number; schliesse: () => Promise<void> }>((ok) => server.listen(0, "127.0.0.1", () =>
    ok({ port: (server.address() as AddressInfo).port, schliesse: () => new Promise<void>((r) => server.close(() => r())) })));
}

describe("Fake-Scanner", () => {
  it("sauber, EICAR in einer PDF-Huelle, Ausfall", async () => {
    let aus = false;
    const s = fakeScanner({ ausfall: () => aus });
    expect(await s.pruefe(pdf(1))).toEqual({ ergebnis: "sauber" });
    expect(await s.pruefe(Buffer.concat([pdf(1), Buffer.from(EICAR)]))).toEqual({ ergebnis: "befund", signatur: "Eicar-Test-Signature" });
    aus = true;
    await expect(s.pruefe(pdf(1))).rejects.toThrow(/Ausfall/);
    expect(s.aufrufe).toBe(3);
    expect(EICAR).toHaveLength(68);
  });
});
describe("scannerKonfig", () => {
  it("ohne Host null, mit Host Standardport 3310, ungueltiger Port wirft", () => {
    expect(scannerKonfig({})).toBeNull();
    expect(scannerKonfig({ PLANORA_CLAMD_HOST: "clamav" })).toEqual({ host: "clamav", port: 3310 });
    expect(scannerKonfig({ PLANORA_CLAMD_HOST: "clamav", PLANORA_CLAMD_PORT: "4000" })).toEqual({ host: "clamav", port: 4000 });
    expect(() => scannerKonfig({ PLANORA_CLAMD_HOST: "clamav", PLANORA_CLAMD_PORT: "x" })).toThrow(/PLANORA_CLAMD_PORT/);
  });
});
describe("clamd-Adapter", () => {
  it("deuteAntwort", () => {
    expect(deuteAntwort("stream: OK")).toEqual({ ergebnis: "sauber" });
    expect(deuteAntwort("stream: Win.Test.EICAR_HDB-1 FOUND")).toEqual({ ergebnis: "befund", signatur: "Win.Test.EICAR_HDB-1" });
    expect(() => deuteAntwort("INSTREAM size limit exceeded. ERROR")).toThrow(/size limit/);
    expect(() => deuteAntwort("")).toThrow(/leere Antwort/);
  });
  it("INSTREAM in Bloecken, Antwort OK/FOUND, PING", async () => {
    let erhalten = Buffer.alloc(0);
    const c = await fakeClamd((d) => { erhalten = d; return d.includes(Buffer.from("BOESE")) ? "stream: Test.Boese FOUND" : "stream: OK"; });
    try {
      const s = clamdScanner({ host: "127.0.0.1", port: c.port });
      const gross = Buffer.alloc(200_000, 7);
      expect(await s.pruefe(gross)).toEqual({ ergebnis: "sauber" });
      expect(Buffer.compare(erhalten, gross)).toBe(0);
      expect(await s.pruefe(Buffer.from("xxBOESExx"))).toEqual({ ergebnis: "befund", signatur: "Test.Boese" });
      expect(await s.ping()).toBe(true);
    } finally { await c.schliesse(); }
  });
  it("nicht erreichbar -> wirft nach Wiederholungen; ping false", async () => {
    const c = await fakeClamd(() => "stream: OK"); const port = c.port; await c.schliesse();
    const s = clamdScanner({ host: "127.0.0.1", port, versuche: 2, pauseMs: 10 });
    await expect(s.pruefe(Buffer.from("x"))).rejects.toThrow();
    expect(await s.ping()).toBe(false);
  });
});
```

- [ ] **Step 2: Run** `npx.cmd vitest run test/dokumente-scanner.test.ts` — Expected: FAIL (Module fehlen).

- [ ] **Step 3: `app/src/dokumente/scanner.ts`**
```ts
/** Ergebnis der Virenpruefung; "Fehler gilt nie als sauber": Ausfall wirft. */
export type ScanErgebnis = { ergebnis: "sauber" } | { ergebnis: "befund"; signatur: string };
/** Port Virenpruefung (Spec Anlagenakte Abschnitt 3). Produktion: clamd (clamd.ts), Entwicklung/Tests: fakeScanner. */
export interface VirenScanner { pruefe(daten: Buffer): Promise<ScanErgebnis> }

// EICAR-Testzeichenkette aus zwei Teilen: die Quelldatei selbst darf keinen Virenscanner ausloesen.
export const EICAR = ["X5O!P%@AP[4\\PZX54(P^)7CC)7}$", "EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"].join("");

/** Meldet sauber, lehnt jede Datei mit der EICAR-Zeichenkette ab; `ausfall` simuliert einen nicht erreichbaren Scanner. */
export function fakeScanner(o: { ausfall?: () => boolean; verzoegerungMs?: number } = {}): VirenScanner & { aufrufe: number } {
  const s = {
    aufrufe: 0,
    async pruefe(daten: Buffer): Promise<ScanErgebnis> {
      s.aufrufe++;
      if (o.verzoegerungMs) await new Promise((r) => setTimeout(r, o.verzoegerungMs));
      if (o.ausfall?.()) throw new Error("Fake-Scanner: Ausfall");
      return daten.includes(EICAR) ? { ergebnis: "befund", signatur: "Eicar-Test-Signature" } : { ergebnis: "sauber" };
    },
  };
  return s;
}

/** clamd-Adresse aus der Umgebung; ohne PLANORA_CLAMD_HOST null (Entwicklung: Fake; Produktion bricht in start/api.ts ab). */
export function scannerKonfig(env: NodeJS.ProcessEnv): { host: string; port: number } | null {
  const host = env.PLANORA_CLAMD_HOST?.trim();
  if (!host) return null;
  const port = Number(env.PLANORA_CLAMD_PORT?.trim() || "3310");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PLANORA_CLAMD_PORT ungueltig");
  return { host, port };
}
```

- [ ] **Step 4: `app/src/dokumente/clamd.ts`**
```ts
import { connect, type Socket } from "node:net";
import type { ScanErgebnis, VirenScanner } from "./scanner.js";

export interface ClamdOptionen { host: string; port: number; timeoutMs?: number; versuche?: number; pauseMs?: number }
const BLOCK = 64 * 1024;
const VERBINDUNG = new Set(["ECONNREFUSED", "ECONNRESET", "EHOSTUNREACH", "ENOTFOUND", "EAI_AGAIN"]);

/** Ein Befehl an clamd (Befehle mit z-Praefix, Antwort endet mit NUL). */
function sprich(o: ClamdOptionen, sende: (s: Socket) => void): Promise<string> {
  return new Promise((ok, fehler) => {
    const s = connect({ host: o.host, port: o.port });
    const teile: Buffer[] = [];
    let fertig = false;
    s.setTimeout(o.timeoutMs ?? 120_000, () => s.destroy(new Error("clamd: Zeitueberschreitung")));
    s.once("connect", () => sende(s));
    s.on("data", (d: Buffer) => { teile.push(d); if (d.includes(0)) { fertig = true; s.end(); } });
    s.once("error", fehler);
    s.once("close", (mitFehler) => {
      if (mitFehler) return; // error wurde bereits gemeldet
      if (fertig || teile.length) ok(Buffer.concat(teile).toString("utf8").replace(/\0/g, "").trim());
      else fehler(new Error("clamd: Verbindung ohne Antwort beendet"));
    });
  });
}

async function mitWiederholung<T>(o: ClamdOptionen, f: () => Promise<T>): Promise<T> {
  const versuche = o.versuche ?? 3;
  for (let i = 1; ; i++) {
    try { return await f(); }
    catch (e) {
      if (i >= versuche || !VERBINDUNG.has((e as NodeJS.ErrnoException).code ?? "")) throw e;
      await new Promise((r) => setTimeout(r, (o.pauseMs ?? 2000) * i));
    }
  }
}

export function deuteAntwort(antwort: string): ScanErgebnis {
  if (antwort === "stream: OK") return { ergebnis: "sauber" };
  const m = /^stream: (.+) FOUND$/.exec(antwort);
  if (m) return { ergebnis: "befund", signatur: m[1] };
  throw new Error(`clamd: ${antwort.slice(0, 200) || "leere Antwort"}`);
}

/** Produktionsadapter: clamd INSTREAM per TCP (Container clamav im Compose-Paket). */
export function clamdScanner(o: ClamdOptionen): VirenScanner & { ping(): Promise<boolean> } {
  return {
    pruefe: (daten) => mitWiederholung(o, async () => deuteAntwort(await sprich(o, (s) => {
      s.write("zINSTREAM\0");
      for (let i = 0; i < daten.length; i += BLOCK) {
        const teil = daten.subarray(i, i + BLOCK);
        const laenge = Buffer.alloc(4); laenge.writeUInt32BE(teil.length);
        s.write(laenge); s.write(teil);
      }
      s.write(Buffer.alloc(4));
    }))),
    async ping() {
      try { return (await sprich({ ...o, timeoutMs: 5000 }, (s) => s.write("zPING\0"))) === "PONG"; } catch { return false; }
    },
  };
}
```

- [ ] **Step 5: Run** — Expected: PASS.

- [ ] **Step 6: Failing test** `app/test/dokumente-pruefer.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { frischeDb } from "./hilfe.js";
import { pdf } from "./hilfe-dateien.js";
import { dateiAblage, type Ablage } from "../src/ablage/ablage.js";
import { legeDokumentAn } from "../src/dokumente/speicher.js";
import { EICAR, fakeScanner, type VirenScanner } from "../src/dokumente/scanner.js";
import { erzeugePruefer, raeumeAbgelehnteAuf, SCAN_FEHLER_TEXT } from "../src/dokumente/pruefer.js";

let db: Awaited<ReturnType<typeof frischeDb>>;
let ablage: Ablage, quarantaene: Ablage;
let L: string, G: string, G2: string, B: string;
const q = (sql: string, p: unknown[] = []) => db.pool.query(sql, p);
const zeile = async (id: string) => (await q("select * from dokument where id=$1", [id])).rows[0];
async function neuesDokument(daten: Buffer, gid = () => G) {
  const x = await quarantaene.schreibeNeu(Readable.from(daten));
  return (await legeDokumentAn(db.pool, { gebaeudeId: gid(), liegenschaftId: L, dateiname: "x.pdf", schluessel: x.schluessel, sha256: x.sha256, groesse: x.groesse,
    seiten: 1, von: randomUUID(), status: "aus", scanStatus: "quarantaene" })).id;
}

beforeAll(async () => {
  db = await frischeDb();
  const wurzel = mkdtempSync(join(tmpdir(), "pruefer-"));
  ablage = dateiAblage(wurzel, { pool: db.pool });
  quarantaene = dateiAblage(join(wurzel, "quarantaene"));
  L = (await q("insert into liegenschaft(name) values ('L') returning id")).rows[0].id;
  const geb = async (name: string) => (await q("insert into gebaeude(liegenschaft_id, name, grundform, breite_m, tiefe_m, regelwerk_version) values ($1,$2,'quader',30,15,1) returning id", [L, name])).rows[0].id;
  G = await geb("G"); G2 = await geb("G2");
  const gs = (await q("insert into geschoss(liegenschaft_id, gebaeude_id, code, reihenfolge, hoehe_m) values ($1,$2,'EG',0,3.2) returning id", [L, G])).rows[0].id;
  B = (await q("insert into bauteil(liegenschaft_id, gebaeude_id, katalog_id, geschoss_id, status, reihenfolge) values ($1,$2,'heizung.verteiler',$3,'bestaetigt',0) returning id", [L, G, gs])).rows[0].id;
});
afterAll(async () => { await db.ende(); });

describe("Pruefer", () => {
  it("sauber: in die Ablage uebernommen, Referenz gesetzt, Quarantaene-Kopie weg", async () => {
    const p = erzeugePruefer(db.pool, ablage, quarantaene, fakeScanner());
    const id = await neuesDokument(pdf(1, "% sauber"));
    p.starte(id); await p.warteLeer();
    const d = await zeile(id);
    expect([d.scan_status, d.scan_grund, d.gescannt_am !== null]).toEqual(["sauber", null, true]);
    expect((await q("select 1 from datei_referenz where objekt=$1", [`dokument:${id}`])).rowCount).toBe(1);
    expect([await ablage.existiert(d.schluessel), await quarantaene.existiert(d.schluessel)]).toEqual([true, false]);
  });
  it("Befund: abgelehnt mit Signatur, Verknuepfungen weg, Audit, keine Referenz, Kopie bleibt", async () => {
    const p = erzeugePruefer(db.pool, ablage, quarantaene, fakeScanner());
    const id = await neuesDokument(Buffer.concat([pdf(1, "% eicar"), Buffer.from(EICAR)]));
    await q("insert into dokument_bauteil(dokument_id, bauteil_id) values ($1,$2)", [id, B]);
    p.starte(id); await p.warteLeer();
    const d = await zeile(id);
    expect([d.scan_status, d.scan_grund]).toEqual(["abgelehnt", "Eicar-Test-Signature"]);
    expect((await q("select 1 from dokument_bauteil where dokument_id=$1", [id])).rowCount).toBe(0);
    expect((await q("select 1 from audit_eintrag where art='dokument.abgelehnt' and daten->>'dokumentId'=$1", [id])).rowCount).toBe(1);
    expect((await q("select 1 from datei_referenz where objekt=$1", [`dokument:${id}`])).rowCount).toBe(0);
    expect(await quarantaene.existiert(d.schluessel)).toBe(true);
  });
  it("Ausfall oder fehlende Quarantaene-Datei: scan_fehler mit festem Text", async () => {
    const p = erzeugePruefer(db.pool, ablage, quarantaene, fakeScanner({ ausfall: () => true }));
    const id = await neuesDokument(pdf(1, "% ausfall"));
    p.starte(id); await p.warteLeer();
    expect([(await zeile(id)).scan_status, (await zeile(id)).scan_grund]).toEqual(["scan_fehler", SCAN_FEHLER_TEXT]);
    const id2 = await neuesDokument(pdf(1, "% fehlt"));
    await quarantaene.entferne((await zeile(id2)).schluessel);
    const p2 = erzeugePruefer(db.pool, ablage, quarantaene, fakeScanner());
    p2.starte(id2); await p2.warteLeer();
    expect((await zeile(id2)).scan_status).toBe("scan_fehler");
  });
  it("hoechstens 2 gleichzeitig", async () => {
    let offen = 0, max = 0;
    const basis = fakeScanner({ verzoegerungMs: 50 });
    const zaehlend: VirenScanner = { async pruefe(d) { offen++; max = Math.max(max, offen); try { return await basis.pruefe(d); } finally { offen--; } } };
    const p = erzeugePruefer(db.pool, ablage, quarantaene, zaehlend);
    const ids = [await neuesDokument(pdf(1, "% g1")), await neuesDokument(pdf(1, "% g2")), await neuesDokument(pdf(1, "% g3"))];
    ids.forEach((id) => p.starte(id)); await p.warteLeer();
    expect(max).toBe(2);
    for (const id of ids) expect((await zeile(id)).scan_status).toBe("sauber");
  });
  it("Neustart: reiheNeuEin prueft alle Quarantaene-Dokumente", async () => {
    const ids = [await neuesDokument(pdf(1, "% n1")), await neuesDokument(pdf(1, "% n2"))];
    const p = erzeugePruefer(db.pool, ablage, quarantaene, fakeScanner());
    expect(await p.reiheNeuEin()).toBe(2);
    await p.warteLeer();
    for (const id of ids) expect((await zeile(id)).scan_status).toBe("sauber");
  });
  it("gleicher Inhalt in zwei Gebaeuden: Kopie bleibt bis zum letzten Scan", async () => {
    const daten = pdf(1, "% zwei");
    const a = await neuesDokument(daten), b = await neuesDokument(daten, () => G2);
    const p = erzeugePruefer(db.pool, ablage, quarantaene, fakeScanner());
    p.starte(a); await p.warteLeer();
    expect(await quarantaene.existiert((await zeile(b)).schluessel)).toBe(true);
    p.starte(b); await p.warteLeer();
    expect(await quarantaene.existiert((await zeile(b)).schluessel)).toBe(false);
  });
  it("Bereinigung: abgelehnt aelter als 7 Tage -> Zeile und Kopie weg", async () => {
    const alt = await neuesDokument(pdf(1, "% alt")), jung = await neuesDokument(pdf(1, "% jung"));
    await q("update dokument set scan_status='abgelehnt', scan_grund='X', gescannt_am=now() - interval '8 days' where id=$1", [alt]);
    await q("update dokument set scan_status='abgelehnt', scan_grund='X', gescannt_am=now() - interval '6 days' where id=$1", [jung]);
    const schluessel = (await zeile(alt)).schluessel;
    expect(await raeumeAbgelehnteAuf(db.pool, quarantaene)).toBe(1);
    expect([await zeile(alt), (await zeile(jung)).scan_status]).toEqual([undefined, "abgelehnt"]);
    expect(await quarantaene.existiert(schluessel)).toBe(false);
  });
});
```

- [ ] **Step 7: Run** `npx.cmd vitest run test/dokumente-pruefer.test.ts` — Expected: FAIL (Modul fehlt).

- [ ] **Step 8: `app/src/dokumente/pruefer.ts`**
```ts
import type pg from "pg";
import { Readable } from "node:stream";
import { speichereUndReferenziere, type Ablage } from "../ablage/ablage.js";
import { auditEreignis } from "../audit/audit.js";
import type { VirenScanner } from "./scanner.js";
import { gibReferenzFrei } from "./speicher.js";

/** Fester Text in der DB; rohe Scanner-Meldungen nur im Log. */
export const SCAN_FEHLER_TEXT = "Virenprüfung nicht erreichbar.";
export interface Pruefer { starte(id: string): void; warteLeer(): Promise<void>; reiheNeuEin(): Promise<number> }

/** Signaturname fuer DB und Anzeige: ohne Steuerzeichen, hoechstens 300 Zeichen. */
export const bereinigeSignatur = (s: string) => s.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, 300) || "Befund";

/** Loescht die Quarantaene-Kopie, wenn kein ungeprueftes oder abgelehntes Dokument sie noch braucht (best effort). */
export async function raeumeQuarantaeneKopie(pool: Pick<pg.Pool, "query">, quarantaene: Ablage, schluessel: string) {
  const noch = await pool.query("select 1 from dokument where schluessel=$1 and scan_status <> 'sauber' limit 1", [schluessel]);
  if (!noch.rowCount) await quarantaene.entferne(schluessel).catch(() => {});
}

/** Abgelehnte Dateien bleiben 7 Tage [A] ohne Vorschau und Download; danach Zeile und Kopie weg (Audit bleibt). */
export async function raeumeAbgelehnteAuf(pool: pg.Pool, quarantaene: Ablage, tage = 7): Promise<number> {
  const r = (await pool.query("delete from dokument where scan_status='abgelehnt' and gescannt_am < now() - make_interval(days => $1) returning schluessel", [tage])).rows;
  for (const { schluessel } of r) await raeumeQuarantaeneKopie(pool, quarantaene, schluessel);
  return r.length;
}

export function erzeugePruefer(pool: pg.Pool, ablage: Ablage, quarantaene: Ablage, scanner: VirenScanner, o: { gleichzeitig?: number } = {}): Pruefer {
  const max = o.gleichzeitig ?? 2;
  const warteschlange: string[] = [];
  const eingereiht = new Set<string>();
  let laufend = 0; let leer: (() => void)[] = [];
  const setzeFehler = (id: string) => pool.query(
    "update dokument set scan_status='scan_fehler', scan_grund=$2, gescannt_am=now() where id=$1 and scan_status='quarantaene'", [id, SCAN_FEHLER_TEXT]);
  const inTx = async (f: (c: pg.PoolClient) => Promise<void>) => {
    const c = await pool.connect();
    try { await c.query("begin"); await f(c); await c.query("commit"); }
    catch (e) { await c.query("rollback").catch(() => {}); throw e; }
    finally { c.release(); }
  };

  async function pruefe(id: string) {
    const d = (await pool.query("select gebaeude_id, schluessel, sha256 from dokument where id=$1 and scan_status='quarantaene'", [id])).rows[0];
    if (!d) return;
    let daten: Buffer;
    try {
      const teile: Buffer[] = [];
      for await (const t of quarantaene.lese(d.schluessel)) teile.push(t as Buffer);
      daten = Buffer.concat(teile);
    } catch { await setzeFehler(id); return; }
    let erg;
    try { erg = await scanner.pruefe(daten); }
    catch (e) {
      console.error(`dokumente: Virenpruefung fehlgeschlagen: ${e instanceof Error ? e.message.slice(0, 200) : "unbekannt"}`);
      await setzeFehler(id); return;
    }
    if (erg.ergebnis === "befund") {
      const signatur = bereinigeSignatur(erg.signatur);
      await inTx(async (c) => {
        const r = await c.query("update dokument set scan_status='abgelehnt', scan_grund=$2, gescannt_am=now() where id=$1 and scan_status='quarantaene' returning id", [id, signatur]);
        if (!r.rowCount) return;
        await c.query("delete from dokument_bauteil where dokument_id=$1", [id]);
        await auditEreignis(c, null, "dokument.abgelehnt", { dokumentId: id, gebaeudeId: d.gebaeude_id, signatur });
      });
      return;
    }
    const objekt = `dokument:${id}`;
    const gespeichert = await speichereUndReferenziere(pool, ablage, Readable.from(daten), objekt);
    let uebernommen = false;
    await inTx(async (c) => {
      // Zeile sperren: parallel geloescht -> Referenz freigeben; schon sauber (zweiter Pruefer) -> Referenz gehoert dem Dokument.
      const s = (await c.query("select scan_status from dokument where id=$1 for update", [id])).rows[0]?.scan_status;
      if (s === "quarantaene" && gespeichert.sha256 === d.sha256) {
        await c.query("update dokument set scan_status='sauber', scan_grund=null, gescannt_am=now() where id=$1", [id]);
        uebernommen = true;
      } else if (s !== "sauber") await gibReferenzFrei(c, gespeichert.schluessel, objekt);
    });
    if (gespeichert.sha256 !== d.sha256) await setzeFehler(id);
    if (uebernommen) await raeumeQuarantaeneKopie(pool, quarantaene, d.schluessel);
  }

  function verfolge(id: string) {
    laufend++;
    void pruefe(id).catch(async (e) => {
      console.error(`dokumente: Pruefung abgebrochen: ${e instanceof Error ? e.message.slice(0, 200) : "unbekannt"}`);
      await setzeFehler(id).catch(() => {});
    }).finally(() => {
      laufend--; eingereiht.delete(id); weiter();
      if (!laufend && !warteschlange.length) { leer.forEach((f) => f()); leer = []; }
    });
  }
  function weiter() { while (laufend < max && warteschlange.length) verfolge(warteschlange.shift()!); }
  const starte = (id: string) => { if (eingereiht.has(id)) return; eingereiht.add(id); warteschlange.push(id); weiter(); };
  return {
    starte,
    warteLeer: () => (!laufend && !warteschlange.length ? Promise.resolve() : new Promise<void>((r) => leer.push(r))),
    async reiheNeuEin() {
      const r = await pool.query("select id from dokument where scan_status='quarantaene' order by hochgeladen_am, id");
      for (const x of r.rows) starte(x.id);
      return r.rowCount ?? 0;
    },
  };
}
```

- [ ] **Step 9: Run** — Expected: PASS.

- [ ] **Step 10: Routen auf Quarantaene umstellen** (`app/src/dokumente/routen.ts`):
  - Signatur: `export function registriereDokumentRouten(app: FastifyInstance, pool: pg.Pool, o: { pruefer: Pruefer; quarantaene: Ablage })` (Imports `type Pruefer`, `raeumeQuarantaeneKopie` aus `./pruefer.js`, `type Ablage` aus `../ablage/ablage.js`; `speichereUndReferenziere` und `gibReferenzFrei` entfallen hier).
  - Im Upload den Block ab `// Uebergang bis Task 3` bis vor `return reply.code(201)` ersetzen durch:
```ts
      // Spec 4.3: Bytes zuerst nur in die Quarantaene; Ablage und Datei-Referenz erst nach sauberem Scan (pruefer.ts).
      const x = await o.quarantaene.schreibeNeu(Readable.from(daten));
      try {
        await inTx("begin", async (c) => {
          await c.query(`insert into dokument(id, gebaeude_id, liegenschaft_id, dateiname, schluessel, sha256, groesse, seiten, hochgeladen_von, auslesen_status, art, mime, kategorie, scan_status)
            values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'aus',$10,$11,$12,'quarantaene')`,
            [id, req.params.id, g.liegenschaft_id, name, x.schluessel, x.sha256, x.groesse, seiten, k.benutzerId, t.typ.art, t.typ.mime, kategorie]);
          await auditEreignis(c, k.auditId, "dokument.abgelegt", { gebaeudeId: req.params.id, dokumentId: id, groesse: x.groesse, art: t.typ.art });
        });
      } catch (e) {
        const dup = await bestehendes(req.params.id, sha);
        if (dup) return reply.code(200).send(dup); // paralleler Upload gleichen Inhalts; die Kopie gehoert ihm
        await raeumeQuarantaeneKopie(pool, o.quarantaene, x.schluessel);
        throw e;
      }
      o.pruefer.starte(id);
```
  (`const objekt` entfaellt im Upload.)
  - Loeschen: 
```ts
      const weg = await inTx("begin", async (c) => {
        const r = await loescheDokument(c, req.params.id);
        await auditEreignis(c, k.auditId, "dokument.geloescht", { gebaeudeId: z.gebaeudeId, dokumentId: req.params.id });
        return r;
      });
      if (weg && weg.scanStatus !== "sauber") await raeumeQuarantaeneKopie(pool, o.quarantaene, weg.schluessel);
      return reply.code(204).send();
```
  - Neue Route:
```ts
    scope.post<{ Params: { id: string } }>("/api/dokumente/:id/erneut-pruefen", { schema: { params: ID_PARAMS } }, async (req, reply) => {
      const k = req.kontext!;
      const z = await mitClient((c) => zugriffDokument(c, k.benutzerId, req.params.id, true));
      if (z.code !== 200) return verweigert(reply, z.code as 403 | 404);
      const ok = await inTx("begin", async (c) => {
        const r = await c.query("update dokument set scan_status='quarantaene', scan_grund=null where id=$1 and scan_status='scan_fehler' returning id", [req.params.id]);
        if (r.rowCount) await auditEreignis(c, k.auditId, "dokument.erneut_pruefen", { gebaeudeId: z.gebaeudeId, dokumentId: req.params.id });
        return !!r.rowCount;
      });
      if (!ok) return reply.code(409).send({ fehler: "nicht_scan_fehler" });
      o.pruefer.starte(req.params.id);
      return reply.code(202).send(await zeile(z.gebaeudeId, req.params.id));
    });
```

- [ ] **Step 11: Verdrahtung `app/src/server.ts`**
```ts
import { join } from "node:path";
import { registriereDokumentRouten } from "./dokumente/routen.js";
import { erzeugePruefer, raeumeAbgelehnteAuf } from "./dokumente/pruefer.js";
import { clamdScanner } from "./dokumente/clamd.js";
import { fakeScanner, scannerKonfig, type VirenScanner } from "./dokumente/scanner.js";
```
`ServerOptionen` um `/** Tests injizieren einen Fake; sonst clamd aus PLANORA_CLAMD_HOST, ohne Konfiguration Fake (Produktion erzwingt die Konfiguration in start/api.ts) */ virenScanner?: VirenScanner` erweitern. Den Aufruf aus Task 1 ersetzen durch:
```ts
  // Anlagenakte (E46): Quarantaene + Virenpruefung im Hintergrund (max. 2), Neustart reiht offene Pruefungen neu ein.
  const quarantaene = dateiAblage(join(o.ablageWurzel, "quarantaene"));
  const clamd = scannerKonfig(process.env);
  const scanner = o.virenScanner ?? (clamd ? clamdScanner(clamd) : fakeScanner());
  const pruefer = erzeugePruefer(o.pool, app.ablage, quarantaene, scanner);
  void pruefer.reiheNeuEin().catch(() => {}); // DB evtl. nicht erreichbar (Wartung): Start nicht blockieren
  const bereinige = () => void raeumeAbgelehnteAuf(o.pool, quarantaene).catch(() => {});
  bereinige();
  const bereinigungsTakt = setInterval(bereinige, 24 * 60 * 60 * 1000);
  bereinigungsTakt.unref();
  app.addHook("onClose", async () => {
    clearInterval(bereinigungsTakt);
    await Promise.race([pruefer.warteLeer(), new Promise((r) => setTimeout(r, 5000).unref())]);
  });
  registriereDokumentRouten(app, o.pool, { pruefer, quarantaene });
```

- [ ] **Step 12: Produktion erzwingt clamd** – `app/src/start/api.ts` vor `baueServer`:
```ts
  // Spec Anlagenakte Abschnitt 3: in Produktion ist die Virenpruefung Pflicht; ohne clamd-Adresse kein Start [A].
  if (!scannerKonfig(process.env)) throw new Error("PLANORA_CLAMD_HOST fehlt: Virenpruefung ist Pflicht");
```
(`import { scannerKonfig } from "../dokumente/scanner.js";`). In `app/entwicklung/start.ts` nach dem `console.log` der Logins eine Zeile ergaenzen: `console.log(process.env.PLANORA_CLAMD_HOST ? "Virenprüfung: clamd " + process.env.PLANORA_CLAMD_HOST : "Virenprüfung: Fake-Scanner (EICAR wird abgelehnt)");`

- [ ] **Step 13: API-Tests nachziehen** (`app/test/dokumente-api.test.ts`):
  - Import `import { fakeScanner } from "../src/dokumente/scanner.js";` und `import { EICAR } from "../src/dokumente/scanner.js";`; oben `let ausfall = false; const scanner = fakeScanner({ ausfall: () => ausfall });`; im `beforeAll` `baueServer({ …, virenScanner: scanner })`.
  - Im ersten Test nach dem 201: `expect(r.json().scanStatus).toBe("quarantaene");`.
  - Neuer Block:
```ts
describe("Dokumente-API: Virenpruefung", () => {
  const roh = async (status: string, grund: string | null = null) => (await db.pool.query(
    `insert into dokument(gebaeude_id, liegenschaft_id, dateiname, schluessel, sha256, groesse, seiten, hochgeladen_von, scan_status, scan_grund)
     values ($1,$2,'r.pdf','k',$3,10,1,$4,$5,$6) returning id`, [G, L1, String(Math.random()), L1, status, grund])).rows[0].id as string;
  it("nicht sauber liefert nie Bytes, auch nicht an den Admin", async () => {
    for (const s of ["quarantaene", "abgelehnt", "scan_fehler"]) {
      const id = await roh(s, s === "quarantaene" ? null : "X");
      for (const k of [kBearb, kAdmin]) {
        const r = await anfrage("GET", `/api/dokumente/${id}/datei`, k);
        expect([r.statusCode, r.json()]).toEqual([409, { fehler: "nicht_sauber" }]);
      }
    }
  });
  it("EICAR in einer PDF-Huelle -> abgelehnt mit Signatur", async () => {
    const r = await ablegen(kBearb, Buffer.concat([pdf(1, "% eicar"), Buffer.from(EICAR)]), "eicar.pdf");
    expect(r.statusCode).toBe(201);
    expect(await warteScan(r.json().id)).toMatchObject({ scanStatus: "abgelehnt", scanGrund: "Eicar-Test-Signature" });
  });
  it("Ausfall -> scan_fehler; erneut pruefen nur mit Schreibrecht; danach sauber", async () => {
    ausfall = true;
    const id = (await ablegen(kBearb, pdf(1, "% ausfall"))).json().id;
    expect((await warteScan(id)).scanStatus).toBe("scan_fehler");
    ausfall = false;
    expect((await anfrage("POST", `/api/dokumente/${id}/erneut-pruefen`, kLeser, {})).statusCode).toBe(403);
    const r = await anfrage("POST", `/api/dokumente/${id}/erneut-pruefen`, kBearb, {});
    expect([r.statusCode, r.json().scanStatus]).toEqual([202, "quarantaene"]);
    expect((await warteScan(id)).scanStatus).toBe("sauber");
    expect((await anfrage("POST", `/api/dokumente/${id}/erneut-pruefen`, kBearb, {})).json()).toEqual({ fehler: "nicht_scan_fehler" });
  });
  it("Loeschen in Quarantaene: Zeile weg, kein Fehler", async () => {
    const id = await roh("scan_fehler", "X");
    expect((await anfrage("DELETE", `/api/dokumente/${id}`, kBearb)).statusCode).toBe(204);
  });
});
```
  Hinweis: `roh` setzt `hochgeladen_von` auf eine beliebige UUID (Spalte ohne Fremdschluessel).

- [ ] **Step 14: Preisdokument-Tests nachziehen** (`app/test/preisdokument-api.test.ts`): Alle Server dieser Datei teilen eine Ablage-Wurzel (`const WURZEL = mkdtempSync(join(tmpdir(), "ablage-"));` und in `baueServer`/`bauApp` `ablageWurzel: WURZEL`), damit ein Pruefer die Quarantaene des anderen findet. Helfer ergaenzen und vor jedem `neu-lesen` nach einem Upload aufrufen (Tests "Ablegen liest nicht automatisch …" und "neu-lesen waehrend 'liest'"):
```ts
const warteSauber = async (a: FastifyInstance, id: string) => {
  for (let i = 0; i < 600; i++) {
    const d = (await a.inject({ method: "GET", url: `/api/dokumente/gebaeude/${G}`, headers: { cookie: kBearb } })).json().dokumente.find((x: any) => x.id === id);
    if (d?.scanStatus === "sauber") return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("nicht sauber: " + id);
};
```

- [ ] **Step 15: Run** `npx.cmd vitest run test/dokumente-scanner.test.ts test/dokumente-pruefer.test.ts test/dokumente-api.test.ts test/preisdokument-api.test.ts test/server.test.ts`, danach die ganze Suite `npx.cmd vitest run` und `npm.cmd run pruefe:typen` — Expected: PASS.

- [ ] **Step 16: Commit**
```bash
git add app/src/dokumente app/src/server.ts app/src/start/api.ts app/entwicklung/start.ts app/test/dokumente-*.test.ts app/test/preisdokument-api.test.ts
git commit -m "Anlagenakte T3: Quarantaene, VirenScanner mit Fake und clamd, Pruefer mit Neustart und Bereinigung" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Verknuepfen, Kategorie aendern, Loeschen, Preise lesen nur per Knopf bei sauberem PDF

**Files:**
- Modify: `app/src/dokumente/schema.ts`, `app/src/dokumente/speicher.ts`, `app/src/dokumente/routen.ts`, `app/src/preisdokument/pdf.ts`, `app/src/preisdokument/routen.ts`, `app/src/preisdokument/laeufer.ts`, `app/src/preisdokument/speicher.ts`, `docs/superpowers/specs/2026-11-22-preis-aus-dokument-design.md` (Nachtrag)
- Test: `app/test/dokumente-api.test.ts`, `app/test/preisdokument-api.test.ts`, `app/test/preisdokument-laeufer.test.ts`, `app/test/preisdokument-pdf.test.ts`

**Interfaces:**
- Consumes: Routen und Speicher aus Task 1–3.
- Produces:
```ts
// dokumente/speicher.ts
export function pruefeBauteile(c, gebaeudeId: string, ids: string[]): Promise<string[]>   // FachFehler 400 bauteil_unbekannt
export function setzeVerknuepfungen(c, dokumentId: string, ids: string[]): Promise<void>
// preisdokument/pdf.ts
export function lesbar(d: { art: string; scanStatus: string; seiten: number | null; groesse: number }): "kein_pdf" | "nicht_sauber" | "zu_gross" | "zu_viele_seiten" | null
// preisdokument/speicher.ts: DokumentZeile erhaelt scanStatus: ScanStatus
```
- Routen: `PUT /api/dokumente/:id/bauteile` Body `{ bauteilIds: string[] }` (ersetzt die Menge) -> `200 AblageZeile`, `409 nicht_sauber`, `400 bauteil_unbekannt`; `PUT /api/dokumente/:id/kategorie` Body `{ kategorie }` -> `200 AblageZeile`, `409 abgelehnt`; Upload-Query `bauteile=<uuid>[,<uuid>…]` verknuepft direkt; `POST /api/preisdokument/dokumente/:id/neu-lesen` -> zusaetzlich `409 kein_pdf | nicht_sauber | zu_gross | zu_viele_seiten`.

Hinweis [A] (Spec-Widerspruch 4.1 vs. 4.5): Ablegen aus der Anlagenkarte "gleich mit dem Bauteil verknuepft" waehrend 4.5 "Verknuepfen nur bei sauber" sagt. Aufloesung: Die Upload-Query `bauteile` verknuepft sofort (auch in Quarantaene); bei Befund entfernt der Pruefer die Verknuepfungen (Task 3). Die Detailansicht (`PUT …/bauteile`) verlangt `sauber`. Hinweis [A]: Kategorie ist ausser bei `abgelehnt` aenderbar. Hinweis: Das Recht `dokument.loeschen` (nur Admin, `src/rechte/rechte.ts`) bleibt ungenutzt; die Spec verlangt Loeschen mit `fach.aendern`. Hinweis [A]: Lesen bleibt auf 32 MB und 100 Seiten begrenzt (Grenzen der Lese-API aus Preis aus Dokument); die Route heisst weiter `neu-lesen`, der Knopf im Web "Preise lesen".

- [ ] **Step 1: Failing tests** in `app/test/dokumente-api.test.ts`:
```ts
describe("Dokumente-API: Verknuepfen und Kategorie", () => {
  let D: string, B_FREMD: string;
  beforeAll(async () => {
    D = (await ablegen(kBearb, pdf(2, "% verkn"), "Pumpe.pdf")).json().id;
    await warteScan(D);
    const G2 = (await anfrage("POST", `/api/struktur/liegenschaften/${L1}/gebaeude`, kBetr, { ...HUELLE, name: "Haus 2" })).json().id;
    const gs = (await db.pool.query("select id from geschoss where gebaeude_id=$1 order by reihenfolge limit 1", [G2])).rows[0].id;
    B_FREMD = (await db.pool.query("insert into bauteil(liegenschaft_id, gebaeude_id, katalog_id, geschoss_id, status, reihenfolge) values ($1,$2,'heizung.verteiler',$3,'bestaetigt',0) returning id", [L1, G2, gs])).rows[0].id;
  });
  it("setzen, ersetzen, leeren; Leser 403; fremdes Bauteil 400", async () => {
    const put = (ids: string[], k = kBearb) => anfrage("PUT", `/api/dokumente/${D}/bauteile`, k, { bauteilIds: ids });
    expect((await put([B1, B2])).json().bauteilIds.sort()).toEqual([B1, B2].sort());
    expect((await put([B2])).json().bauteilIds).toEqual([B2]);
    expect((await liste()).json().dokumente.find((d: any) => d.id === D).bauteilIds).toEqual([B2]);
    expect((await put([B1], kLeser)).statusCode).toBe(403);
    const f = await put([B_FREMD]);
    expect([f.statusCode, f.json().fehler[0].code]).toEqual([400, "bauteil_unbekannt"]);
    expect((await put([])).json().bauteilIds).toEqual([]);
    expect((await anfrage("PUT", `/api/dokumente/${D}/bauteile`, kBearb, { bauteilIds: ["x"] })).statusCode).toBe(400);
  });
  it("nur bei sauber; Ablegen mit ?bauteile verknuepft sofort", async () => {
    ausfall = true;
    const r = await ablegen(kBearb, pdf(1, "% sofort"), "Sofort.pdf", `?bauteile=${B1},${B2}`);
    expect(r.json().bauteilIds.sort()).toEqual([B1, B2].sort());
    await warteScan(r.json().id);
    ausfall = false;
    const p = await anfrage("PUT", `/api/dokumente/${r.json().id}/bauteile`, kBearb, { bauteilIds: [B1] });
    expect([p.statusCode, p.json().fehler[0].code]).toEqual([409, "nicht_sauber"]);
    expect((await ablegen(kBearb, pdf(1, "% fremd2"), "F.pdf", `?bauteile=${B_FREMD}`)).statusCode).toBe(400);
  });
  it("Bauteil geloescht -> Verknuepfung weg", async () => {
    // eigenes Wegwerf-Bauteil, damit B1/B2 fuer die uebrigen Tests bleiben
    const tmp = (await db.pool.query("insert into bauteil(liegenschaft_id, gebaeude_id, katalog_id, geschoss_id, status, reihenfolge) values ($1,$2,'heizung.verteiler',(select id from geschoss where gebaeude_id=$2 order by reihenfolge limit 1),'bestaetigt',99) returning id", [L1, G])).rows[0].id;
    expect((await anfrage("PUT", `/api/dokumente/${D}/bauteile`, kBearb, { bauteilIds: [tmp] })).json().bauteilIds).toEqual([tmp]);
    await db.pool.query("delete from bauteil where id=$1", [tmp]);
    expect((await liste()).json().dokumente.find((d: any) => d.id === D).bauteilIds).toEqual([]);
  });
  it("Kategorie aendern; ungueltig 400; abgelehnt 409", async () => {
    const r = await anfrage("PUT", `/api/dokumente/${D}/kategorie`, kBearb, { kategorie: "datenblatt" });
    expect([r.statusCode, r.json().kategorie]).toEqual([200, "datenblatt"]);
    expect((await anfrage("PUT", `/api/dokumente/${D}/kategorie`, kBearb, { kategorie: "rechnung" })).statusCode).toBe(400);
    expect((await anfrage("PUT", `/api/dokumente/${D}/kategorie`, kLeser, { kategorie: "plan" })).statusCode).toBe(403);
    const ab = (await ablegen(kBearb, Buffer.concat([pdf(1, "% ab"), Buffer.from(EICAR)]), "a.pdf")).json().id;
    await warteScan(ab);
    expect((await anfrage("PUT", `/api/dokumente/${ab}/kategorie`, kBearb, { kategorie: "plan" })).json()).toEqual({ fehler: "abgelehnt" });
  });
  it("Loeschen: Verknuepfungen weg, uebernommener Preis behaelt Quelle dokument", async () => {
    const id = (await ablegen(kBearb, pdf(1, "% preis"), "Offerte.pdf")).json().id;
    await warteScan(id);
    await anfrage("PUT", `/api/dokumente/${id}/bauteile`, kBearb, { bauteilIds: [B1] });
    const v = (await db.pool.query(`insert into preis_vorschlag(dokument_id, reihenfolge, position, seite, zitat, ersatzpreis, rechenweg, katalog_id, bauteil_ids, sicherheit, status)
      values ($1,0,'HK',1,'z',250,'r','heizung.heizkoerper',$2,'hoch','uebernommen') returning id`, [id, [B1]])).rows[0].id;
    await db.pool.query(`insert into bauteil_akte(bauteil_id, liegenschaft_id, stueckpreis, quelle_preis, preis_vorschlag_id) values ($1,$2,250,'dokument',$3)
      on conflict (bauteil_id) do update set stueckpreis=250, quelle_preis='dokument', preis_vorschlag_id=$3`, [B1, L1, v]);
    expect((await anfrage("DELETE", `/api/dokumente/${id}`, kBearb)).statusCode).toBe(204);
    expect((await db.pool.query("select 1 from dokument_bauteil where dokument_id=$1", [id])).rowCount).toBe(0);
    expect((await db.pool.query("select stueckpreis, quelle_preis, preis_vorschlag_id from bauteil_akte where bauteil_id=$1", [B1])).rows[0])
      .toEqual({ stueckpreis: "250.00", quelle_preis: "dokument", preis_vorschlag_id: null });
  });
});
```
- [ ] **Step 2: Run** — Expected: FAIL (Routen fehlen).

- [ ] **Step 3: Schemas** (`app/src/dokumente/schema.ts`) – `ABLEGEN_QUERY` erweitern und Bodies ergaenzen:
```ts
const UUID_MUSTER = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$";
export const ABLEGEN_QUERY = { type: "object", additionalProperties: false, properties: {
  kategorie: { type: "string", enum: [...KATEGORIEN] },
  bauteile: { type: "string", maxLength: 18_500, pattern: "^[0-9a-fA-F-]{36}(,[0-9a-fA-F-]{36})*$" },
} } as const;
export const BAUTEILE_SCHEMA = { type: "object", additionalProperties: false, required: ["bauteilIds"],
  properties: { bauteilIds: { type: "array", maxItems: 500, items: { type: "string", pattern: UUID_MUSTER } } } } as const;
export const KATEGORIE_SCHEMA = { type: "object", additionalProperties: false, required: ["kategorie"],
  properties: { kategorie: { type: "string", enum: [...KATEGORIEN] } } } as const;
```

- [ ] **Step 4: Speicher** (`app/src/dokumente/speicher.ts`):
```ts
import { FachFehler } from "../welt/speicher.js";
/** Normalisiert IDs; alle muessen zum Gebaeude gehoeren (sonst 400 bauteil_unbekannt). */
export async function pruefeBauteile(c: Q, gebaeudeId: string, ids: string[]): Promise<string[]> {
  const eindeutig = [...new Set(ids.map((x) => x.toLowerCase()))];
  if (!eindeutig.length) return [];
  const da = (await c.query("select id from bauteil where gebaeude_id=$1 and id = any($2::uuid[])", [gebaeudeId, eindeutig])).rows.length;
  if (da !== eindeutig.length) throw new FachFehler([{ pfad: "bauteilIds", code: "bauteil_unbekannt", meldung: "Bauteil gehoert nicht zu diesem Gebaeude" }], 400);
  return eindeutig;
}
/** Ersetzt die verknuepften Bauteile des Dokuments durch `ids` (bereits geprueft). */
export async function setzeVerknuepfungen(c: Q, dokumentId: string, ids: string[]) {
  await c.query("delete from dokument_bauteil where dokument_id=$1 and not (bauteil_id = any($2::uuid[]))", [dokumentId, ids]);
  for (const b of ids) await c.query("insert into dokument_bauteil(dokument_id, bauteil_id) values ($1,$2) on conflict do nothing", [dokumentId, b]);
}
```

- [ ] **Step 5: Routen** (`app/src/dokumente/routen.ts`, Imports `FachFehler` aus `../welt/speicher.js`, `BAUTEILE_SCHEMA`, `KATEGORIE_SCHEMA`, `pruefeBauteile`, `setzeVerknuepfungen`):
  - Upload: Query-Typ `{ kategorie?: Kategorie; bauteile?: string }`; vor `o.quarantaene.schreibeNeu` pruefen:
```ts
      let verknuepfen: string[] = [];
      try { verknuepfen = await mitClient((c) => pruefeBauteile(c, req.params.id, req.query.bauteile ? req.query.bauteile.split(",") : [])); }
      catch (e) { if (e instanceof FachFehler) return reply.code(e.status).send({ fehler: e.fehler }); throw e; }
```
    und in der Insert-Transaktion nach dem `insert`: `await setzeVerknuepfungen(c, id, verknuepfen);`.
  - Neue Routen:
```ts
    const fachlich = async <T>(reply: FastifyReply, f: () => Promise<T>) => {
      try { return await f(); } catch (e) { if (e instanceof FachFehler) return reply.code(e.status).send({ fehler: e.fehler }); throw e; }
    };
    scope.put<{ Params: { id: string }; Body: { bauteilIds: string[] } }>("/api/dokumente/:id/bauteile",
      { schema: { params: ID_PARAMS, body: BAUTEILE_SCHEMA } }, async (req, reply) => {
        const k = req.kontext!;
        const z = await mitClient((c) => zugriffDokument(c, k.benutzerId, req.params.id, true));
        if (z.code !== 200) return verweigert(reply, z.code as 403 | 404);
        return fachlich(reply, () => inTx("begin", async (c) => {
          const s = (await c.query("select scan_status from dokument where id=$1 for update", [req.params.id])).rows[0];
          if (!s) throw new FachFehler([{ pfad: "dokument", code: "nicht_gefunden", meldung: "Dokument nicht gefunden" }], 404);
          if (s.scan_status !== "sauber") throw new FachFehler([{ pfad: "dokument", code: "nicht_sauber", meldung: "Erst nach der Virenprüfung verknüpfbar" }], 409);
          const ids = await pruefeBauteile(c, z.gebaeudeId, req.body.bauteilIds);
          await setzeVerknuepfungen(c, req.params.id, ids);
          await auditEreignis(c, k.auditId, "dokument.verknuepft", { gebaeudeId: z.gebaeudeId, dokumentId: req.params.id, anzahl: ids.length });
          return (await ladeAblage(c, z.gebaeudeId, req.params.id))[0];
        }));
      });
    scope.put<{ Params: { id: string }; Body: { kategorie: Kategorie } }>("/api/dokumente/:id/kategorie",
      { schema: { params: ID_PARAMS, body: KATEGORIE_SCHEMA } }, async (req, reply) => {
        const k = req.kontext!;
        const z = await mitClient((c) => zugriffDokument(c, k.benutzerId, req.params.id, true));
        if (z.code !== 200) return verweigert(reply, z.code as 403 | 404);
        const r = await inTx("begin", async (c) => {
          const u = await c.query("update dokument set kategorie=$2 where id=$1 and scan_status <> 'abgelehnt' returning id", [req.params.id, req.body.kategorie]);
          if (u.rowCount) await auditEreignis(c, k.auditId, "dokument.kategorie", { gebaeudeId: z.gebaeudeId, dokumentId: req.params.id, kategorie: req.body.kategorie });
          return u.rowCount ? (await ladeAblage(c, z.gebaeudeId, req.params.id))[0] : null;
        });
        return r ?? reply.code(409).send({ fehler: "abgelehnt" });
      });
```

- [ ] **Step 6: Run** dokumente-api — Expected: PASS.

- [ ] **Step 7: Failing tests Preise lesen** – in `app/test/preisdokument-pdf.test.ts`:
```ts
import { lesbar } from "../src/preisdokument/pdf.js";
describe("lesbar", () => {
  const ok = { art: "pdf", scanStatus: "sauber", seiten: 3, groesse: 1000 };
  it("nur sauberes PDF innerhalb der Lesegrenzen", () => {
    expect(lesbar(ok)).toBeNull();
    expect(lesbar({ ...ok, art: "office" })).toBe("kein_pdf");
    expect(lesbar({ ...ok, scanStatus: "quarantaene" })).toBe("nicht_sauber");
    expect(lesbar({ ...ok, groesse: 32 * 1024 * 1024 + 1 })).toBe("zu_gross");
    expect(lesbar({ ...ok, seiten: 101 })).toBe("zu_viele_seiten");
  });
});
```
  In `app/test/preisdokument-api.test.ts` (Block "mit Leseadapter"):
```ts
  it("Preise lesen nur bei sauberem PDF; Office 409 kein_pdf", async () => {
    const q = (await db.pool.query(`insert into dokument(gebaeude_id, liegenschaft_id, dateiname, schluessel, sha256, groesse, seiten, hochgeladen_von, scan_status)
      values ($1,(select liegenschaft_id from gebaeude where id=$1),'q.pdf','k',$2,10,1,$3,'quarantaene') returning id`, [G, randomUUID(), randomUUID()])).rows[0].id;
    expect((await gib(app2, "POST", `/api/preisdokument/dokumente/${q}/neu-lesen`, kBearb)).json()).toEqual({ fehler: "nicht_sauber" });
    const x = (await db.pool.query(`insert into dokument(gebaeude_id, liegenschaft_id, dateiname, schluessel, sha256, groesse, seiten, hochgeladen_von, scan_status, art, mime)
      values ($1,(select liegenschaft_id from gebaeude where id=$1),'k.xlsx','k',$2,10,null,$3,'sauber','office','application/vnd.ms-excel') returning id`, [G, randomUUID(), randomUUID()])).rows[0].id;
    expect((await gib(app2, "POST", `/api/preisdokument/dokumente/${x}/neu-lesen`, kBearb)).json()).toEqual({ fehler: "kein_pdf" });
    expect((await gib(app2, "GET", liste(), kBearb)).json().dokumente.some((d: any) => d.id === x)).toBe(false);
    expect((await gib(app2, "GET", liste(), kBearb)).json().dokumente.find((d: any) => d.id === q).scanStatus).toBe("quarantaene");
  });
```
  In `app/test/preisdokument-laeufer.test.ts`:
```ts
  it("nicht sauberes Dokument wird nie gelesen", async () => {
    const fake = fakeAdapter(() => ({ vorschlaege: [] }));
    const l = erzeugeLaeufer(db.pool, ablage, fake, { istAktiv: async () => true });
    const id = await dokument("% unsauber", "neu");
    await db.pool.query("update dokument set scan_status='quarantaene' where id=$1", [id]);
    l.starte(id); await l.warteLeer();
    expect([fake.aufrufe.length, (await zeile(id)).auslesen_status]).toEqual([0, "neu"]);
  });
```
  (Namen `ablage`, `dokument(zusatz, status)`, `zeile` an die vorhandenen Helfer der Datei anpassen; `dokument` ist dort die Funktion um `legeDokumentAn` in Zeile 35.)

- [ ] **Step 8: Run** — Expected: FAIL.

- [ ] **Step 9: Umsetzen**
  - `app/src/preisdokument/pdf.ts`:
```ts
/** Grund, warum ein Dokument nicht gelesen werden darf, sonst null (Spec Anlagenakte 4.9; Grenzen der Lese-API). */
export function lesbar(d: { art: string; scanStatus: string; seiten: number | null; groesse: number }): "kein_pdf" | "nicht_sauber" | "zu_gross" | "zu_viele_seiten" | null {
  if (d.art !== "pdf") return "kein_pdf";
  if (d.scanStatus !== "sauber") return "nicht_sauber";
  if (d.groesse > MAX_BYTES) return "zu_gross";
  if ((d.seiten ?? 0) > MAX_SEITEN) return "zu_viele_seiten";
  return null;
}
```
  - `app/src/preisdokument/routen.ts`, Route `neu-lesen`, direkt nach der Pruefung `auslesen_aus`:
```ts
      const dz = (await pool.query("select art, scan_status, seiten, groesse from dokument where id=$1", [req.params.id])).rows[0];
      const sperre = dz ? lesbar({ art: dz.art, scanStatus: dz.scan_status, seiten: dz.seiten, groesse: Number(dz.groesse) }) : "kein_pdf";
      if (sperre) return reply.code(409).send({ fehler: sperre });
```
  (`import { lesbar } from "./pdf.js";`)
  - `app/src/preisdokument/laeufer.ts`, in `lies` die erste Abfrage absichern: `… where id=$1 and auslesen_status in ('neu','abgebrochen','fehler') and art='pdf' and scan_status='sauber' returning …`.
  - `app/src/preisdokument/speicher.ts`: `DokumentZeile` um `scanStatus: ScanStatus` erweitern (`import type { ScanStatus } from "../dokumente/speicher.js";`), Abfrage in `ladeDokumente` um `scan_status` ergaenzen, Feld `scanStatus: r.scan_status` setzen.

- [ ] **Step 10: Spec-Nachtrag** – in `docs/superpowers/specs/2026-11-22-preis-aus-dokument-design.md` am Ende von Abschnitt 4 einfuegen: `**Nachtrag 23.11.2026 (E46, Spec Anlagenakte 4.9):** Kein automatisches Lesen mehr nach dem Ablegen. "Preise lesen" ist ein Knopf und nur bei sauberen PDFs (Virenprüfung) und eingeschalteter KI möglich; die Ablage gehört zum Kernmodul dokumente.`

- [ ] **Step 11: Run** `npx.cmd vitest run` (ganze Backend-Suite) und `npm.cmd run pruefe:typen` — Expected: PASS.

- [ ] **Step 12: Commit**
```bash
git add app/src/dokumente app/src/preisdokument app/test docs/superpowers/specs/2026-11-22-preis-aus-dokument-design.md
git commit -m "Anlagenakte T4: Verknuepfen, Kategorie, Loeschen, Preise lesen nur bei sauberem PDF" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: ClamAV fest im Compose-Paket, Docker-Test mit echtem clamd

**Files:**
- Modify: `betrieb/compose.yaml`, `betrieb/README.md`, `app/src/betrieb/release.ts`, `app/src/betrieb/install/install.ts`, `app/src/betrieb/update/umgebung.ts`, `app/src/betrieb/update/compose.ts`, `app/test-docker/paket-hilfe.ts`, `app/test-docker/paket.test.ts`, `app/test/release.test.ts`, `app/test/release-install.test.ts`, `app/test/update.test.ts`, `app/test/dossier.test.ts`
- Create: `app/test-docker/scan.test.ts`

**Interfaces:**
- Consumes: `clamdScanner`, `EICAR` (Task 3).
- Produces: Compose-Dienst `clamav` ohne Profil, `api` mit `PLANORA_CLAMD_HOST=clamav`, `PLANORA_CLAMD_PORT=3310`; Release-Manifest verlangt das `clamav`-Image.

Hinweis [A]: Bisher war `clamav` im Profil `scan` vorbereitet und im Bundle optional. Weil die api ohne clamd-Adresse nicht startet (Task 3) und `up --pull never` ein fehlendes Image nicht nachlaedt, wird das `clamav`-Image Pflicht im Release. Der Bundle-Bau der WSL-Abnahme (`betrieb/abnahme/`) muss das Image mitliefern; die WSL-Gesamtabnahme wird hier nicht wiederholt (bleibt offen, CLAUDE.md "Weiter offen"). `api` wartet nur auf `service_started`, nicht auf `healthy` (Signaturen laden ~1 min); Scans in dieser Zeit wiederholt der Adapter (Task 3). Die clamd-Konfiguration kommt als Compose-`configs`-Inhalt (kein zusaetzliches Bundle-File noetig).

- [ ] **Step 1: Image-Standardkonfiguration lesen** – in PowerShell: `& "C:\Program Files\Docker\Docker\resources\bin\docker.exe" run --rm --entrypoint cat clamav/clamav:1.5@sha256:45fe5149fbee5a46509c9848ef20d0c354b7b2323c9369f285939a37cf33422a /etc/clamav/clamd.conf | Select-String -NotMatch "^#"`. Die aktiven Zeilen (u. a. `LocalSocket`, `TCPSocket`, `User`, `PidFile`, `LogFile`, `Foreground`) notieren; die Doku `https://docs.clamav.net/manual/Installing/Docker.html` (web-fetch) zu `FRESHCLAM_CHECKS` und Konfiguration lesen. Abweichungen von den Werten in Step 2 dort uebernehmen.

- [ ] **Step 2: `betrieb/compose.yaml`** – Dienst `clamav` ersetzen:
```yaml
  # Virenpruefung (Spec Anlagenakte 2026-11-23, E46): clamd per TCP 3310 nur im Netz intern, kein veroeffentlichter Port.
  # Signaturen per freshclam ueber das Netz signaturen (abschaltbar, PO 6), einmal taeglich [A]. RAM 1–2 GB [A].
  clamav:
    image: ${PLANORA_IMAGE_CLAMAV:-clamav/clamav:1.5@sha256:45fe5149fbee5a46509c9848ef20d0c354b7b2323c9369f285939a37cf33422a}
    restart: unless-stopped
    environment:
      FRESHCLAM_CHECKS: "1"
    configs:
      - source: clamd_conf
        target: /etc/clamav/clamd.conf
    volumes:
      - clamav-signaturen:/var/lib/clamav
    mem_limit: 2g
    security_opt: ["no-new-privileges:true"]
    networks: [intern, signaturen]
```
  Im Dienst `api`: unter `depends_on` `clamav: { condition: service_started }`, unter `environment` `PLANORA_CLAMD_HOST: clamav` und `PLANORA_CLAMD_PORT: "3310"`. Unter `configs:` ergaenzen (Werte aus Step 1 uebernehmen, nur die drei Grenzen sind Planora-Vorgabe):
```yaml
  # clamd wie Image-Standard, Grenzen fuer Dateien bis 100 MB (Spec Anlagenakte); Grenzueberschreitung meldet clamd als Fehler -> scan_fehler.
  clamd_conf:
    content: |
      DatabaseDirectory /var/lib/clamav
      TemporaryDirectory /tmp
      PidFile /tmp/clamd.pid
      LocalSocket /tmp/clamd.sock
      TCPSocket 3310
      User clamav
      Foreground yes
      LogTime yes
      StreamMaxLength 101M
      MaxFileSize 101M
      MaxScanSize 400M
```
  Kommentar am Netz `signaturen` anpassen: `# nur clamav: Signatur-Updates, abschaltbar (PO 6)`.

- [ ] **Step 3: Release verlangt clamav** – `app/src/betrieb/release.ts`: `for (const dienst of ["app", "db", "proxy", "backup", "clamav"]) …`. `app/src/betrieb/install/install.ts` Zeile ~98–99: Kommentar und Filter `.filter((i) => i.dienst !== "clamav" || i.archiv)` entfernen (alle Images laden und pruefen). Gleich in `app/src/betrieb/update/umgebung.ts` (~Zeile 93). `app/src/betrieb/update/compose.ts`: Zeile `if (name === "clamav" && !image) continue; …` entfernen und `"clamav"` in die Pflichtdienst-Liste aufnehmen.

- [ ] **Step 4: Unit-Tests nachziehen** – in `app/test/release.test.ts` `["proxy", "backup"]` -> `["proxy", "backup", "clamav"]` (Zeile 19), `it.each([…, "clamav"])` (Zeile 25), erwartete Dienste `["app", "db", "proxy", "backup", "clamav"]` (Zeile 36); in `app/test/release-install.test.ts` (Zeile 154), `app/test/update.test.ts` (Zeile 11) und `app/test/dossier.test.ts` (Zeile 13) `["db", "proxy", "backup"]` -> `["db", "proxy", "backup", "clamav"]`. Run `npx.cmd vitest run test/release.test.ts test/release-install.test.ts test/update.test.ts test/dossier.test.ts test/compose-bindung.test.ts` — Expected: PASS (sonst weitere Fixtures mit fester Image-Liste per `grep -rn '"proxy", "backup"' app/test` finden und ergaenzen).

- [ ] **Step 5: Docker-Hilfe** – in `app/test-docker/paket-hilfe.ts`:
```ts
/** clamav-Referenz aus dem Standardwert in compose.yaml (eine Quelle der Wahrheit). */
export function clamavReferenz(): string {
  const m = /PLANORA_IMAGE_CLAMAV:-([^}]+)\}/.exec(readFileSync(join(BETRIEB, "compose.yaml"), "utf8"));
  if (!m) throw new Error("clamav-Image in compose.yaml nicht gefunden");
  return m[1];
}
/** `--pull never` laedt nichts nach: fehlende Fremd-Images vorher holen. */
export async function stelleImageBereit(referenz: string) {
  if ((await docker(["image", "inspect", referenz], { erlaubeFehler: true })).code !== 0) await docker(["pull", referenz], { timeoutMs: 900_000 });
}
```
  (`readFileSync` zu den `node:fs`-Imports.) In `starte()` vor `compose(["up", …])`: `await stelleImageBereit(clamavReferenz());`.

- [ ] **Step 6: Failing Docker-Test** `app/test-docker/scan.test.ts`:
```ts
// Echter clamd (Spec Anlagenakte Abschnitt 6): EICAR abgelehnt, sauberes PDF durch. Eigener Container, Port nur auf 127.0.0.1.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { DOCKER_TESTS, clamavReferenz, docker, stelleImageBereit } from "./paket-hilfe.js";
import { clamdScanner } from "../src/dokumente/clamd.js";
import { EICAR } from "../src/dokumente/scanner.js";

const NAME = "planora-scan-test", PORT = 13310;
const scanner = clamdScanner({ host: "127.0.0.1", port: PORT, versuche: 1 });

describe.skipIf(!DOCKER_TESTS)("ClamAV (Docker)", () => {
  beforeAll(async () => {
    const ref = clamavReferenz();
    await stelleImageBereit(ref);
    await docker(["rm", "-f", NAME], { erlaubeFehler: true });
    await docker(["run", "-d", "--name", NAME, "-p", `127.0.0.1:${PORT}:3310`, ref]);
    for (let i = 0; i < 300 && !(await scanner.ping()); i++) await new Promise((r) => setTimeout(r, 1000));
    expect(await scanner.ping()).toBe(true);
  });
  afterAll(async () => { await docker(["rm", "-f", NAME], { erlaubeFehler: true }); });

  it("EICAR -> Befund", async () => {
    const r = await scanner.pruefe(Buffer.from(EICAR));
    expect(r.ergebnis).toBe("befund");
    expect(r.ergebnis === "befund" && r.signatur).toMatch(/eicar/i);
  });
  it("sauberes PDF -> sauber", async () => {
    expect(await scanner.pruefe(Buffer.from("%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\n%%EOF"))).toEqual({ ergebnis: "sauber" });
  });
});
```
  In `app/test-docker/paket.test.ts` ergaenzen:
```ts
  it("Virenpruefung: clamav laeuft im Paket ohne Port, api erreicht clamd (PING)", async () => {
    const ps = (await inst.compose(["ps", "--format", "{{.Service}}|{{.Ports}}"])).stdout;
    expect(ps).toMatch(/^clamav\|$/m);
    const r = await inst.compose(["exec", "-T", "api", "node", "--input-type=module", "-e",
      `import {connect} from 'node:net';
       const ping=()=>new Promise((ok)=>{const s=connect(3310,'clamav');let t='';s.on('connect',()=>s.write('zPING\\0'));
         s.on('data',(d)=>{t+=d;s.end();});s.on('close',()=>ok(t.replace(/\\0/g,'')));s.on('error',()=>ok(''));});
       for(let i=0;i<300;i++){if(await ping()==='PONG'){console.log('PONG');process.exit(0);}await new Promise(r=>setTimeout(r,1000));}
       process.exit(1);`], { timeoutMs: 400_000 });
    expect(r.stdout.trim()).toBe("PONG");
  });
```

- [ ] **Step 7: Run** in `app/`: `npm.cmd run test:docker` (Docker Desktop muss laufen; Laufzeit > 10 min) — Expected: alle Docker-Tests PASS inkl. `scan.test.ts`. Laeuft Docker nicht: anhalten und PO melden, nicht ueberspringen.

- [ ] **Step 8: Doku** – `betrieb/README.md` Abschnitt "Virenprüfung" ergaenzen: Dienst `clamav` (immer aktiv), Netz `signaturen` fuer freshclam (abschaltbar; ohne Internet veralten Signaturen, [?] Siemens-Frageboegen: Update-Takt, On-Premise-Versorgung), RAM bis 2 GB, `PLANORA_CLAMD_HOST`/`PLANORA_CLAMD_PORT`, api startet ohne Adresse nicht, Pruefstatus `scan_fehler` + "Erneut prüfen".

- [ ] **Step 9: Commit**
```bash
git add betrieb/compose.yaml betrieb/README.md app/src/betrieb app/test app/test-docker
git commit -m "Anlagenakte T5: ClamAV fest im Compose-Paket, Release verlangt clamav, Docker-Test mit echtem clamd" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Bibliothek Heizung – Datenblatt-Felder, Lebensdauer-Quelle, Icon, neue Typen, Datenblatt-API

**Files:**
- Modify: `app/src/welt/regelwerk.ts`, `app/src/welt/katalog.v2.ts`, `app/src/welt/regelwerk.v2.ts`, `app/src/welt/routen.ts`, `app/src/lebensdauer/standard.ts`, `app/src/lebensdauer/speicher.ts`, `app/src/server.ts`, `app/test/m2b-api.test.ts`, `app/test/lebensdauer-speicher.test.ts`
- Create: `app/src/bestand/datenblatt.ts`, `app/src/bestand/routen.ts`, `app/test/bestand-datenblatt.test.ts`

**Interfaces:**
- Produces:
```ts
// welt/regelwerk.ts
export interface DatenblattFeld { schluessel: string; bezeichnung: string; einheit: string | null; art: "zahl" | "text" }
export interface KatalogEintrag { …bestehend…; datenblatt?: DatenblattFeld[]; lebensdauerQuelle?: { text: string; jahr: number }; icon?: string }
// bestand/datenblatt.ts
export type DatenblattWert = number | string;
export function pruefeDatenblatt(felder: DatenblattFeld[], werte: Record<string, unknown>):
  { ok: true; werte: Record<string, DatenblattWert> | null } | { ok: false; fehler: { pfad: string; code: string; meldung: string }[] }
// bestand/routen.ts
export function registriereBestandRouten(app: FastifyInstance, pool: pg.Pool): void
```
- Routen: `GET /api/bestand/bauteile/:id/datenblatt` -> `{ bauteilId, katalogId, felder: DatenblattFeld[], werte: Record<string, number | string>, darfAendern }`; `PUT /api/bestand/datenblatt` Body `{ bauteilIds: string[] (1..500), werte: Record<string, number | string | null> }` -> Antwort wie GET fuer `bauteilIds[0]`; 400 `feld_unbekannt` / `feld_typ` / `bauteil_gemischt`; 403/404 wie ueblich. `GET /api/katalog/v2` liefert zusaetzlich `datenblatt`, `lebensdauerQuelle`, `icon`.

Hinweis [A]: Datenblatt-Felder und Lebensdauer-Quellen sind fachlich nicht freigegeben (Spec 7). Quelle aller Heizungstypen vorlaeufig "Planora-Richtwert, angelehnt an VDI 2067 Blatt 1" (Jahr 2012); PO/Fachperson ersetzt sie. Hinweis [A]: Eine Anlagenkarte fasst Bauteile einer Typgruppe zusammen (gleicher Katalog, Hersteller, Typ); deshalb schreibt `PUT /api/bestand/datenblatt` dieselben Werte auf alle `bauteilIds` (gleicher Katalog-Typ und gleiches Gebaeude Pflicht). Hinweis [A]: Die neuen Typen erhalten `bereich: "zentrale"` und sind nur in Technikraeumen und am Geschoss-Standort erlaubt (Regelwerk v2, Version bleibt 2, additiv). Der Assistent bietet sie (noch) nicht an; fuer Szenarien setzt sie das Werkzeug in Task 9.

- [ ] **Step 1: Failing test** `app/test/bestand-datenblatt.test.ts` (rein + API):
```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { frischeDb } from "./hilfe.js";
import { baueServer } from "../src/server.js";
import { erzeugeSetupToken, loeseSetupTokenEin } from "../src/auth/setup.js";
import { pruefeDatenblatt } from "../src/bestand/datenblatt.js";
import { KATALOG_V2 } from "../src/welt/katalog.v2.js";
import { STANDARD_LEBENSDAUER } from "../src/lebensdauer/standard.js";

const PUMPE = KATALOG_V2.eintraege.find((e) => e.id === "heizung.umwaelzpumpe")!.datenblatt!;
describe("Katalog v2 Bibliothek", () => {
  it("jeder Typ hat Datenblatt, Quelle, Icon und Lebensdauer; neue Typen vorhanden", () => {
    for (const e of KATALOG_V2.eintraege) {
      expect(e.datenblatt?.length, e.id).toBeGreaterThan(0);
      expect(e.lebensdauerQuelle?.jahr, e.id).toBeGreaterThan(1990);
      expect(e.icon, e.id).toMatch(/^[a-z]+$/);
      expect(STANDARD_LEBENSDAUER[e.id], e.id).toBeGreaterThan(0);
      for (const f of e.datenblatt!) expect(f.schluessel).toMatch(/^[a-z][a-z0-9_]{0,39}$/);
    }
    expect(KATALOG_V2.eintraege.map((e) => e.id)).toEqual(expect.arrayContaining(["heizung.ausdehnungsgefaess", "heizung.sonstiges", "heizung.wmz"]));
  });
});
describe("pruefeDatenblatt", () => {
  it("Zahl und Text, leere Werte fallen weg", () => {
    expect(pruefeDatenblatt(PUMPE, { dn: 32, foerderhoehe_m: 6.5, leistung_w: null })).toEqual({ ok: true, werte: { dn: 32, foerderhoehe_m: 6.5 } });
    expect(pruefeDatenblatt(PUMPE, {})).toEqual({ ok: true, werte: null });
  });
  it("unbekannter Schluessel und falscher Typ", () => {
    expect(pruefeDatenblatt(PUMPE, { farbe: "rot" })).toMatchObject({ ok: false, fehler: [{ pfad: "werte/farbe", code: "feld_unbekannt" }] });
    expect(pruefeDatenblatt(PUMPE, { dn: "gross" })).toMatchObject({ ok: false, fehler: [{ code: "feld_typ" }] });
    expect(pruefeDatenblatt(PUMPE, { dn: Number.POSITIVE_INFINITY })).toMatchObject({ ok: false });
  });
});

const ORIGIN = "http://localhost:3996";
const pw = randomBytes(12).toString("base64url");
let db: Awaited<ReturnType<typeof frischeDb>>; let app: FastifyInstance;
let L1: string, L2: string, kBearb: string, kLeser: string, kFremd: string, G: string, P1: string, P2: string, V: string;
const anfrage = (method: "GET" | "PUT", url: string, cookie: string, body?: unknown) => app.inject({ method, url,
  headers: { cookie, origin: ORIGIN, "x-planora-request": "1", ...(body !== undefined ? { "content-type": "application/json" } : {}) },
  payload: body !== undefined ? JSON.stringify(body) : undefined });
async function konto(email: string, rolle: string, scopes: string[]) {
  const { benutzerId } = await loeseSetupTokenEin(db.pool, await erzeugeSetupToken(db.pool), email, email, pw);
  await db.pool.query("update rolle_zuordnung set rolle=$2 where benutzer_id=$1", [benutzerId, rolle]);
  for (const l of scopes) await db.pool.query("insert into rolle_liegenschaft(benutzer_id, liegenschaft_id) values ($1,$2)", [benutzerId, l]);
  const r = await app.inject({ method: "POST", url: "/api/auth/sign-in/email", headers: { "content-type": "application/json", origin: ORIGIN }, payload: JSON.stringify({ email, password: pw }) });
  return ([] as string[]).concat(r.headers["set-cookie"] ?? []).map((c) => c.split(";")[0]).join("; ");
}
beforeAll(async () => {
  db = await frischeDb();
  app = await baueServer({ pool: db.pool, stufe: 4, baseURL: ORIGIN, secret: randomBytes(32).toString("hex"), ablageWurzel: mkdtempSync(join(tmpdir(), "ablage-")) });
  L1 = (await db.pool.query("insert into liegenschaft(name) values ('L1') returning id")).rows[0].id;
  L2 = (await db.pool.query("insert into liegenschaft(name) values ('L2') returning id")).rows[0].id;
  kBearb = await konto("b@planora.invalid", "bearbeiter", [L1]); kLeser = await konto("l@planora.invalid", "leser", [L1]); kFremd = await konto("f@planora.invalid", "leser", [L2]);
  G = (await db.pool.query("insert into gebaeude(liegenschaft_id, name, grundform, breite_m, tiefe_m, regelwerk_version) values ($1,'G','quader',30,15,2) returning id", [L1])).rows[0].id;
  const gs = (await db.pool.query("insert into geschoss(liegenschaft_id, gebaeude_id, code, reihenfolge, hoehe_m) values ($1,$2,'UG1',0,3.2) returning id", [L1, G])).rows[0].id;
  const bt = async (k: string, i: number) => (await db.pool.query("insert into bauteil(liegenschaft_id, gebaeude_id, katalog_id, geschoss_id, status, reihenfolge) values ($1,$2,$3,$4,'bestaetigt',$5) returning id", [L1, G, k, gs, i])).rows[0].id;
  P1 = await bt("heizung.umwaelzpumpe", 0); P2 = await bt("heizung.umwaelzpumpe", 1); V = await bt("heizung.verteiler", 2);
});
afterAll(async () => { await app.close(); await db.ende(); });

describe("Datenblatt-API", () => {
  it("GET leer mit Feldern; PUT auf zwei Pumpen; Leser liest", async () => {
    const g = await anfrage("GET", `/api/bestand/bauteile/${P1}/datenblatt`, kBearb);
    expect(g.json()).toMatchObject({ bauteilId: P1, katalogId: "heizung.umwaelzpumpe", werte: {}, darfAendern: true });
    expect(g.json().felder.map((f: any) => f.schluessel)).toContain("foerderhoehe_m");
    const p = await anfrage("PUT", "/api/bestand/datenblatt", kBearb, { bauteilIds: [P1, P2], werte: { dn: 32, foerderhoehe_m: 6.5 } });
    expect([p.statusCode, p.json().werte]).toEqual([200, { dn: 32, foerderhoehe_m: 6.5 }]);
    expect((await anfrage("GET", `/api/bestand/bauteile/${P2}/datenblatt`, kLeser)).json()).toMatchObject({ werte: { dn: 32 }, darfAendern: false });
  });
  it("Fehler: unbekanntes Feld, gemischte Typen, Leser 403, Fremd 404", async () => {
    expect((await anfrage("PUT", "/api/bestand/datenblatt", kBearb, { bauteilIds: [P1], werte: { farbe: "rot" } })).json().fehler[0].code).toBe("feld_unbekannt");
    expect((await anfrage("PUT", "/api/bestand/datenblatt", kBearb, { bauteilIds: [P1, V], werte: {} })).json().fehler[0].code).toBe("bauteil_gemischt");
    expect((await anfrage("PUT", "/api/bestand/datenblatt", kLeser, { bauteilIds: [P1], werte: {} })).statusCode).toBe(403);
    expect((await anfrage("GET", `/api/bestand/bauteile/${P1}/datenblatt`, kFremd)).statusCode).toBe(404);
  });
  it("leeres Datenblatt loescht die Akte-Zeile, wenn sonst nichts erfasst ist", async () => {
    await anfrage("PUT", "/api/bestand/datenblatt", kBearb, { bauteilIds: [P1, P2], werte: {} });
    expect((await db.pool.query("select 1 from bauteil_akte where bauteil_id = any($1::uuid[])", [[P1, P2]])).rowCount).toBe(0);
  });
});
```

- [ ] **Step 2: Run** `npx.cmd vitest run test/bestand-datenblatt.test.ts` — Expected: FAIL.

- [ ] **Step 3: Typen** – `app/src/welt/regelwerk.ts`:
```ts
export interface DatenblattFeld { schluessel: string; bezeichnung: string; einheit: string | null; art: "zahl" | "text" }
export interface KatalogEintrag { id: string; name: string; bereich: "zentrale" | "verteilung" | "einheit" | "zubehoer"; heizArt: HeizArt | null; mengeMax: number;
  masse?: [number, number, number];
  /** Felder des Datenblatts (Bibliothek, Spec Anlagenakte 3) [A]. */ datenblatt?: DatenblattFeld[];
  /** Quelle der Standard-Lebensdauer (src/lebensdauer/standard.ts) [A]. */ lebensdauerQuelle?: { text: string; jahr: number };
  /** Icon-Schluessel fuer das Web (dashboard/daten.ts IconSchluessel). */ icon?: string }
```

- [ ] **Step 4: Katalog v2** – `app/src/welt/katalog.v2.ts` (Anzeige-Bezeichnungen sind UI-Texte, daher mit Umlauten):
```ts
import type { DatenblattFeld, Katalog } from "./regelwerk.js";

const z = (schluessel: string, bezeichnung: string, einheit: string | null): DatenblattFeld => ({ schluessel, bezeichnung, einheit, art: "zahl" });
const t = (schluessel: string, bezeichnung: string): DatenblattFeld => ({ schluessel, bezeichnung, einheit: null, art: "text" });
const DN = z("dn", "Nennweite", "DN");
/** [A] fachlich nicht freigegeben (Spec Anlagenakte 7). */
const QUELLE = { text: "Planora-Richtwert, angelehnt an VDI 2067 Blatt 1", jahr: 2012 };

/** Katalog v2: v1 plus Masse [Breite, Hoehe, Tiefe] in Metern (schematisch), Zubehoer und Bibliothek. IDs nie umbenennen (ADR 0011). */
export const KATALOG_V2: Katalog = {
  version: 2,
  eintraege: [
    { id: "heizung.waermepumpe", name: "Waermepumpe", bereich: "zentrale", heizArt: null, mengeMax: 10, masse: [1, 1.2, 0.6], icon: "waermepumpe", lebensdauerQuelle: QUELLE,
      datenblatt: [z("leistung_kw", "Heizleistung", "kW"), z("cop", "COP", null), t("kaeltemittel", "Kältemittel")] },
    { id: "heizung.gaskessel", name: "Gaskessel", bereich: "zentrale", heizArt: null, mengeMax: 10, masse: [0.6, 1.6, 0.6], icon: "kessel", lebensdauerQuelle: QUELLE,
      datenblatt: [z("leistung_kw", "Nennleistung", "kW"), z("nutzungsgrad_pct", "Normnutzungsgrad", "%")] },
    { id: "heizung.oelkessel", name: "Oelkessel", bereich: "zentrale", heizArt: null, mengeMax: 10, masse: [0.7, 1.4, 0.8], icon: "kessel", lebensdauerQuelle: QUELLE,
      datenblatt: [z("leistung_kw", "Nennleistung", "kW"), z("nutzungsgrad_pct", "Normnutzungsgrad", "%")] },
    { id: "heizung.fernwaerme_uebergabe", name: "Fernwaerme-Uebergabe", bereich: "zentrale", heizArt: null, mengeMax: 10, masse: [1, 1.4, 0.35], icon: "fernwaerme", lebensdauerQuelle: QUELLE,
      datenblatt: [z("leistung_kw", "Anschlussleistung", "kW"), z("vorlauf_c", "Vorlauf primär", "°C")] },
    { id: "heizung.speicher", name: "Speicher", bereich: "zentrale", heizArt: null, mengeMax: 10, masse: [0.9, 1.8, 0.9], icon: "speicher", lebensdauerQuelle: QUELLE,
      datenblatt: [z("volumen_l", "Volumen", "l"), z("max_temp_c", "Max. Betriebstemperatur", "°C")] },
    { id: "heizung.umwaelzpumpe", name: "Umwaelzpumpe", bereich: "zubehoer", heizArt: null, mengeMax: 50, masse: [0.35, 0.45, 0.3], icon: "pumpe", lebensdauerQuelle: QUELLE,
      datenblatt: [DN, z("foerderhoehe_m", "Förderhöhe", "m"), z("leistung_w", "Leistungsaufnahme", "W")] },
    { id: "heizung.verteiler", name: "Heizungsverteiler", bereich: "verteilung", heizArt: null, mengeMax: 20, masse: [1.2, 1, 0.3], icon: "verteiler", lebensdauerQuelle: QUELLE,
      datenblatt: [DN, z("abgaenge", "Abgänge", null)] },
    { id: "heizung.heizkoerper", name: "Heizkoerper", bereich: "einheit", heizArt: "hk", mengeMax: 500, masse: [1, 0.65, 0.12], icon: "heizkoerper", lebensdauerQuelle: QUELLE,
      datenblatt: [z("leistung_w", "Wärmeleistung", "W"), t("bauart", "Bauart")] },
    { id: "heizung.fbh_kreis", name: "FBH-Kreis", bereich: "einheit", heizArt: "fbh", mengeMax: 200, masse: [0.6, 0.8, 0.15], icon: "flaechenheizung", lebensdauerQuelle: QUELLE,
      datenblatt: [z("rohrlaenge_m", "Rohrlänge", "m"), t("rohr", "Rohrdimension")] },
    { id: "heizung.tabs_feld", name: "TABS-Feld", bereich: "einheit", heizArt: "tabs", mengeMax: 200, masse: [0.6, 0.8, 0.15], icon: "flaechenheizung", lebensdauerQuelle: QUELLE,
      datenblatt: [z("flaeche_m2", "Fläche", "m²")] },
    { id: "heizung.ventil_3weg", name: "3-Weg-Ventil", bereich: "zubehoer", heizArt: null, mengeMax: 50, masse: [0.2, 0.25, 0.2], icon: "ventil", lebensdauerQuelle: QUELLE,
      datenblatt: [DN, z("kvs", "kvs-Wert", "m³/h")] },
    { id: "heizung.ventil_2weg", name: "Durchgangsventil", bereich: "zubehoer", heizArt: null, mengeMax: 50, masse: [0.15, 0.25, 0.15], icon: "ventil", lebensdauerQuelle: QUELLE,
      datenblatt: [DN, z("kvs", "kvs-Wert", "m³/h")] },
    { id: "heizung.wmz", name: "Waermezaehler", bereich: "zubehoer", heizArt: null, mengeMax: 50, masse: [0.25, 0.2, 0.15], icon: "zaehler", lebensdauerQuelle: QUELLE,
      datenblatt: [DN, z("qp", "Nenndurchfluss qp", "m³/h")] },
    { id: "heizung.ausdehnungsgefaess", name: "Ausdehnungsgefaess", bereich: "zentrale", heizArt: null, mengeMax: 10, masse: [0.45, 0.7, 0.45], icon: "ausdehnung", lebensdauerQuelle: QUELLE,
      datenblatt: [z("volumen_l", "Volumen", "l"), z("vordruck_bar", "Vordruck", "bar")] },
    { id: "heizung.sonstiges", name: "Sonstiges", bereich: "zentrale", heizArt: null, mengeMax: 50, masse: [0.5, 0.5, 0.4], icon: "anlage",
      lebensdauerQuelle: { text: "Planora-Ersatzwert", jahr: 2026 }, datenblatt: [t("beschreibung", "Beschreibung")] },
  ],
};
```
  `app/src/lebensdauer/standard.ts`: `"heizung.ausdehnungsgefaess": 15, "heizung.sonstiges": 20` ergaenzen ([A]).

- [ ] **Step 5: Regelwerk v2** – `app/src/welt/regelwerk.v2.ts`:
```ts
import { STANDORT_GESCHOSS, type RegelwerkV2 } from "./regelwerk.js";
/** Neue Bibliothekstypen (E46) nur in der Technik und am Geschoss-Standort [A]. */
const TECHNIK_NEU = ["heizung.ausdehnungsgefaess", "heizung.sonstiges"];
// in REGELWERK_V2:
  erlaubt: Object.fromEntries(Object.entries(REGELWERK_V1.erlaubt).map(([art, liste]) => {
    const mitZubehoer = art === "kern" ? liste : [...liste, ...ZUBEHOER.filter((z) => !liste.includes(z))];
    return [art, art === "technik" || art === STANDORT_GESCHOSS ? [...mitZubehoer, ...TECHNIK_NEU] : mitZubehoer];
  })),
```
  `app/src/welt/routen.ts` `/api/katalog/v2`: `eintraege: KATALOG_V2.eintraege.map(({ id, name, bereich, masse, datenblatt, lebensdauerQuelle, icon }) => ({ id, name, bereich, masse, datenblatt, lebensdauerQuelle, icon }))`. `app/test/m2b-api.test.ts`: `toHaveLength(15)` und die wmz-Erwartung auf `toMatchObject({ id: "heizung.wmz", name: "Waermezaehler", bereich: "zubehoer", masse: [0.25, 0.2, 0.15], icon: "zaehler" })`.

- [ ] **Step 6: `app/src/bestand/datenblatt.ts`**
```ts
import type { DatenblattFeld } from "../welt/regelwerk.js";
export type DatenblattWert = number | string;
type Fehler = { pfad: string; code: string; meldung: string };
const MAX_ZAHL = 1e9, MAX_TEXT = 200;

/** Prueft Werte gegen die Katalog-Felder: unbekannte Schluessel und falsche Typen sind Fehler; null/leer faellt weg. */
export function pruefeDatenblatt(felder: DatenblattFeld[], werte: Record<string, unknown>):
  { ok: true; werte: Record<string, DatenblattWert> | null } | { ok: false; fehler: Fehler[] } {
  const je = new Map(felder.map((f) => [f.schluessel, f]));
  const aus: Record<string, DatenblattWert> = {}; const fehler: Fehler[] = [];
  for (const [k, v] of Object.entries(werte)) {
    const f = je.get(k);
    if (!f) { fehler.push({ pfad: `werte/${k}`, code: "feld_unbekannt", meldung: "Feld gibt es fuer diesen Typ nicht" }); continue; }
    if (v === null || (typeof v === "string" && !v.trim())) continue;
    if (f.art === "zahl" && typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= MAX_ZAHL) aus[k] = v;
    else if (f.art === "text" && typeof v === "string" && v.trim().length <= MAX_TEXT) aus[k] = v.trim();
    else fehler.push({ pfad: `werte/${k}`, code: "feld_typ", meldung: f.art === "zahl" ? "Zahl erwartet" : `Text bis ${MAX_TEXT} Zeichen erwartet` });
  }
  if (fehler.length) return { ok: false, fehler };
  return { ok: true, werte: Object.keys(aus).length ? aus : null };
}
```

- [ ] **Step 7: `app/src/bestand/routen.ts`**
```ts
import type { FastifyInstance, FastifyReply } from "fastify";
import type pg from "pg";
import { pruefe } from "../rechte/rechte.js";
import { auditEreignis } from "../audit/audit.js";
import { ID_PARAMS } from "../welt/schema.js";
import { KATALOG_V2 } from "../welt/katalog.v2.js";
import { pruefeDatenblatt } from "./datenblatt.js";

const UUID_MUSTER = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$";
const WERT = { anyOf: [{ type: "number" }, { type: "string", maxLength: 200 }, { type: "null" }] };
const DATENBLATT_SCHEMA = { type: "object", additionalProperties: false, required: ["bauteilIds", "werte"], properties: {
  bauteilIds: { type: "array", minItems: 1, maxItems: 500, items: { type: "string", pattern: UUID_MUSTER } },
  werte: { type: "object", maxProperties: 50, additionalProperties: WERT } } } as const;

export function registriereBestandRouten(app: FastifyInstance, pool: pg.Pool) {
  const mitClient = async <T>(f: (c: pg.PoolClient) => Promise<T>) => { const c = await pool.connect(); try { return await f(c); } finally { c.release(); } };
  const inTx = <T>(art: string, f: (c: pg.PoolClient) => Promise<T>) => mitClient(async (c) => {
    await c.query(art);
    try { const r = await f(c); await c.query("commit"); return r; } catch (e) { await c.query("rollback"); throw e; }
  });
  const felderVon = (katalogId: string) => KATALOG_V2.eintraege.find((e) => e.id === katalogId)?.datenblatt ?? [];
  const verweigert = (reply: FastifyReply, code: 403 | 404) => reply.code(code).send({ fehler: code === 404 ? "nicht gefunden" : "keine Berechtigung" });
  async function zugriff(c: pg.ClientBase, benutzerId: string, liegenschaftId: string | undefined, schreiben: boolean): Promise<200 | 403 | 404> {
    if (!liegenschaftId || !(await pruefe(c, benutzerId, "fach.lesen", liegenschaftId))) return 404;
    if (schreiben && !(await pruefe(c, benutzerId, "fach.aendern", liegenschaftId))) return 403;
    return 200;
  }
  async function antwort(c: pg.ClientBase, benutzerId: string, bauteilId: string) {
    const b = (await c.query("select b.katalog_id, b.liegenschaft_id, a.datenblatt from bauteil b left join bauteil_akte a on a.bauteil_id=b.id where b.id=$1", [bauteilId])).rows[0];
    return { bauteilId, katalogId: b.katalog_id as string, felder: felderVon(b.katalog_id), werte: (b.datenblatt ?? {}) as Record<string, number | string>,
      darfAendern: (await zugriff(c, benutzerId, b.liegenschaft_id, true)) === 200 };
  }

  app.get<{ Params: { id: string } }>("/api/bestand/bauteile/:id/datenblatt", { schema: { params: ID_PARAMS } }, async (req, reply) =>
    inTx("begin isolation level repeatable read read only", async (c) => {
      const l = (await c.query("select liegenschaft_id from bauteil where id=$1", [req.params.id])).rows[0]?.liegenschaft_id;
      const z = await zugriff(c, req.kontext!.benutzerId, l, false);
      if (z !== 200) return verweigert(reply, z);
      return antwort(c, req.kontext!.benutzerId, req.params.id);
    }));

  app.put<{ Body: { bauteilIds: string[]; werte: Record<string, unknown> } }>("/api/bestand/datenblatt", { schema: { body: DATENBLATT_SCHEMA } }, async (req, reply) => {
    const k = req.kontext!;
    const ids = [...new Set(req.body.bauteilIds.map((x) => x.toLowerCase()))];
    return inTx("begin", async (c) => {
      const rows = (await c.query("select id, katalog_id, liegenschaft_id, gebaeude_id from bauteil where id = any($1::uuid[])", [ids])).rows;
      if (rows.length !== ids.length) return verweigert(reply, 404);
      for (const l of new Set(rows.map((r) => r.liegenschaft_id as string))) {
        const z = await zugriff(c, k.benutzerId, l, true);
        if (z !== 200) return verweigert(reply, z);
      }
      if (new Set(rows.map((r) => r.katalog_id)).size > 1 || new Set(rows.map((r) => r.gebaeude_id)).size > 1)
        return reply.code(400).send({ fehler: [{ pfad: "bauteilIds", code: "bauteil_gemischt", meldung: "Bauteile muessen gleichen Typ und gleiches Gebaeude haben" }] });
      const p = pruefeDatenblatt(felderVon(rows[0].katalog_id), req.body.werte);
      if (!p.ok) return reply.code(400).send({ fehler: p.fehler });
      for (const r of rows) {
        await c.query(`insert into bauteil_akte(bauteil_id, liegenschaft_id, datenblatt) values ($1,$2,$3)
          on conflict (bauteil_id) do update set datenblatt=excluded.datenblatt`, [r.id, r.liegenschaft_id, p.werte === null ? null : JSON.stringify(p.werte)]);
        await c.query(`delete from bauteil_akte where bauteil_id=$1 and zustand is null and lebensdauer_jahre is null and stueckpreis is null
          and notiz is null and datenblatt is null`, [r.id]);
      }
      await auditEreignis(c, k.auditId, "bestand.datenblatt", { gebaeudeId: rows[0].gebaeude_id, anzahl: rows.length, felder: Object.keys(p.werte ?? {}).length });
      return antwort(c, k.benutzerId, ids[0]);
    });
  });
}
```
  In `app/src/server.ts` nach `registriereDokumentRouten(…)`: `registriereBestandRouten(app, o.pool); // Datenblatt je Bauteil (Bibliothek, E46)` (Import ergaenzen).

- [ ] **Step 8: Lebensdauer schont das Datenblatt** – `app/src/lebensdauer/speicher.ts`, in `schreibeLebensdauer` die Zeile
`if (Object.values(neu).every((v) => v === null)) await c.query("delete from bauteil_akte where bauteil_id=$1", [id]);`
ersetzen durch:
```ts
    if (Object.values(neu).every((v) => v === null)) {
      // Datenblatt (Bestand) bleibt: Zeile nur loeschen, wenn auch kein Datenblatt erfasst ist.
      await c.query("delete from bauteil_akte where bauteil_id=$1 and datenblatt is null", [id]);
      await c.query("update bauteil_akte set zustand=null, lebensdauer_jahre=null, stueckpreis=null, quelle_preis=null, notiz=null, preis_vorschlag_id=null where bauteil_id=$1", [id]);
    }
```
  Test in `app/test/lebensdauer-speicher.test.ts` ergaenzen (vorhandene Helfer der Datei verwenden):
```ts
  it("Leeren der Lebensdauer behaelt das Datenblatt", async () => {
    await db.pool.query(`insert into bauteil_akte(bauteil_id, liegenschaft_id, zustand, datenblatt) values ($1,$2,'gut','{"dn":25}')
      on conflict (bauteil_id) do update set zustand='gut', datenblatt='{"dn":25}'`, [B1, L1]);
    const stand = (await db.pool.query("select stand from gebaeude where id=$1", [G1])).rows[0].stand;
    await mit((c) => schreibeLebensdauer(c, G1, { stand, bauteile: [{ id: B1, zustand: null, lebensdauerJahre: null, stueckpreis: null, notiz: null }] }));
    expect((await db.pool.query("select zustand, datenblatt from bauteil_akte where bauteil_id=$1", [B1])).rows[0]).toEqual({ zustand: null, datenblatt: { dn: 25 } });
  });
```
  (`B1`, `L1`, `G1`, `mit` an die Namen der Datei anpassen.)

- [ ] **Step 9: Run** `npx.cmd vitest run test/bestand-datenblatt.test.ts test/m2b-api.test.ts test/lebensdauer-*.test.ts test/welt-*.test.ts test/module-guard.test.ts` und danach die ganze Suite, `npm.cmd run pruefe:typen`, `npm.cmd run muster:welt` (ohne Fixture-Diff) — Expected: PASS. Schlaegt ein Regelwerk-Test mit fester `erlaubt`-Liste fehl, die Erwartung um die beiden neuen IDs ergaenzen.

- [ ] **Step 10: Commit**
```bash
git add app/src/welt app/src/lebensdauer app/src/bestand app/src/server.ts app/test
git commit -m "Anlagenakte T6: Bibliothek Heizung (Datenblatt, Quelle, Icon, neue Typen), Datenblatt-API" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Web – Typen, API, reine Funktionen (Ablage, Viewer, Datenblatt, Icons)

**Files:**
- Create: `app/web/src/dokumente/typen.ts`, `api.ts`, `ansicht.ts`, `ansicht.test.ts`; `app/web/src/viewer/seiten.ts`, `seiten.test.ts`; `app/web/src/bestand/datenblatt.ts`, `datenblatt.test.ts`
- Modify: `app/web/src/typen.ts` (KatalogEintrag), `app/web/src/preisdokument/typen.ts` (`scanStatus`), `app/web/src/dashboard/daten.ts` (NAMEN, ICONS, IconSchluessel), `app/web/src/karten/TwinObjekt.tsx` (nur `ANLAGEN_ICON`)

**Interfaces:**
- Consumes: Backend-Antworten aus Task 1–6.
- Produces:
```ts
// dokumente/typen.ts – Spiegel von app/src/dokumente/speicher.ts
export type Art = "pdf" | "bild" | "office"; export type Kategorie = "datenblatt"|"plan"|"offerte"|"foto"|"protokoll"|"sonstiges";
export type ScanStatus = "quarantaene" | "sauber" | "abgelehnt" | "scan_fehler";
export interface AblageZeile { id; dateiname; art: Art; mime; kategorie: Kategorie; groesse: number; seiten: number | null; hochgeladenAm; scanStatus: ScanStatus; scanGrund: string | null; gescanntAm: string | null; bauteilIds: string[] }
export interface AblageBauteil { id; katalogId; geschoss; ort; hersteller: string | null; typ: string | null }
export interface AblageAntwort { dokumente: AblageZeile[]; bauteile: AblageBauteil[]; darfAendern: boolean }
// dokumente/api.ts
export const ladeAblage: (gebaeudeId: string) => Promise<AblageAntwort>
export function legeAb(gebaeudeId: string, datei: File, o?: { kategorie?: Kategorie; bauteilIds?: string[] }): Promise<{ zeile: AblageZeile; neu: boolean }>
export const loesche: (id: string) => Promise<void>
export const setzeKategorie: (id: string, kategorie: Kategorie) => Promise<AblageZeile>
export const verknuepfe: (id: string, bauteilIds: string[]) => Promise<AblageZeile>
export const pruefeErneut: (id: string) => Promise<AblageZeile>
export const dateiUrl: (id: string, download?: boolean) => string
export function ladeBytes(id: string): Promise<ArrayBuffer>
// dokumente/ansicht.ts
export const MAX_BYTES; export const KATEGORIEN: { id: Kategorie; name: string }[]
export function kategorieName(k: Kategorie): string
export function scanAnzeige(d: Pick<AblageZeile, "scanStatus" | "scanGrund">): { text: string; art: "laeuft" | "ok" | "fehler" | "abgelehnt" }
export function groesseText(bytes: number): string
export function filtere(d: AblageZeile[], f: { kategorie: Kategorie | null; nurUnverknuepft: boolean }): AblageZeile[]
export function pruefungLaeuft(d: AblageZeile[]): boolean
export function oeffnenArt(d: Pick<AblageZeile, "scanStatus" | "art" | "mime">): "pdf" | "bild" | "herunterladen" | "gesperrt"
export function bauteilKandidaten(b: AblageBauteil[], f: { katalogId: string | null; geschoss: string | null; suche: string }, name: (katalogId: string) => string): AblageBauteil[]
export function datenblattVorschlag(d: AblageZeile, b: AblageBauteil[]): string[]
export function ablageFehlerText(code: string | null, status?: number): string
export function unterlagenFuer(d: AblageZeile[], bauteilIds: string[]): AblageZeile[]
export function vorpruefen<T extends { size: number }>(dateien: T[]): { ok: T[]; zuGross: T[] }
// viewer/seiten.ts
export function klemmeSeite(seite: number, anzahl: number): number
export const ZOOM_STUFEN: readonly number[]; export function naechsterZoom(z: number, richtung: 1 | -1): number
export function trefferSeiten(texte: string[], begriff: string): { seite: number; anzahl: number }[]
export function naechsterTreffer(treffer: { seite: number }[], aktuell: number, richtung: 1 | -1): number | null
// bestand/datenblatt.ts
export interface DatenblattFeld { schluessel; bezeichnung; einheit: string | null; art: "zahl" | "text" }
export interface DatenblattAntwort { bauteilId; katalogId; felder: DatenblattFeld[]; werte: Record<string, number | string>; darfAendern: boolean }
export const ladeDatenblatt: (bauteilId: string) => Promise<DatenblattAntwort>
export const speichereDatenblatt: (bauteilIds: string[], werte: Record<string, number | string | null>) => Promise<DatenblattAntwort>
export function werteAusEingabe(felder: DatenblattFeld[], eingabe: Record<string, string>): { werte: Record<string, number | string | null>; fehler: Record<string, string> }
export function wertText(f: DatenblattFeld, w: number | string | undefined): string
```

Hinweis [A]: "Bei Kategorie Datenblatt werden Bauteile des passenden Typs vorgeschlagen" – die Spec sagt nicht, woher der Typ kommt. Aufloesung: Vorschlag = alle noch nicht verknuepften Bauteile mit derselben Katalog-ID wie die bereits verknuepften (Datenblatt der Pumpe mit einer Pumpe verknuepft -> weitere Pumpen vorgeschlagen); ohne Verknuepfung kein Vorschlag, der FM filtert nach Typ. Hinweis [A]: HEIC kann Chromium nicht anzeigen; `oeffnenArt` liefert fuer `image/heic` "herunterladen" (Viewer zeigt den Hinweis "Vorschau für HEIC nicht verfügbar").

- [ ] **Step 1: Failing tests** `app/web/src/dokumente/ansicht.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { ablageFehlerText, bauteilKandidaten, datenblattVorschlag, filtere, groesseText, kategorieName, oeffnenArt, pruefungLaeuft, scanAnzeige, unterlagenFuer, vorpruefen, MAX_BYTES } from "./ansicht";
import type { AblageBauteil, AblageZeile } from "./typen";

const d = (x: Partial<AblageZeile> = {}): AblageZeile => ({ id: "d1", dateiname: "a.pdf", art: "pdf", mime: "application/pdf", kategorie: "sonstiges", groesse: 1000, seiten: 1,
  hochgeladenAm: "2026-11-23T10:00:00.000Z", scanStatus: "sauber", scanGrund: null, gescanntAm: null, bauteilIds: [], ...x });
const b = (id: string, katalogId: string, geschoss = "UG1", ort = "UG1 · Technik"): AblageBauteil => ({ id, katalogId, geschoss, ort, hersteller: null, typ: null });

describe("Ablage-Anzeige", () => {
  it("Scan-Status", () => {
    expect(scanAnzeige(d({ scanStatus: "quarantaene" }))).toEqual({ text: "wird geprüft …", art: "laeuft" });
    expect(scanAnzeige(d())).toEqual({ text: "geprüft", art: "ok" });
    expect(scanAnzeige(d({ scanStatus: "abgelehnt", scanGrund: "Eicar-Test-Signature" }))).toEqual({ text: "abgelehnt: Eicar-Test-Signature", art: "abgelehnt" });
    expect(scanAnzeige(d({ scanStatus: "scan_fehler", scanGrund: "x" }))).toEqual({ text: "Prüfung fehlgeschlagen", art: "fehler" });
  });
  it("Groesse und Kategorie", () => {
    expect([groesseText(820), groesseText(820 * 1024), groesseText(4.2 * 1024 * 1024)]).toEqual(["820 B", "820 KB", "4.2 MB"]);
    expect(kategorieName("datenblatt")).toBe("Datenblatt");
  });
  it("Filter und Polling", () => {
    const l = [d({ id: "a", kategorie: "foto" }), d({ id: "b", bauteilIds: ["x"] }), d({ id: "c", scanStatus: "quarantaene" })];
    expect(filtere(l, { kategorie: "foto", nurUnverknuepft: false }).map((x) => x.id)).toEqual(["a"]);
    expect(filtere(l, { kategorie: null, nurUnverknuepft: true }).map((x) => x.id)).toEqual(["a", "c"]);
    expect([pruefungLaeuft(l), pruefungLaeuft(l.slice(0, 2))]).toEqual([true, false]);
  });
  it("Oeffnen", () => {
    expect(oeffnenArt(d())).toBe("pdf");
    expect(oeffnenArt(d({ art: "bild", mime: "image/png" }))).toBe("bild");
    expect(oeffnenArt(d({ art: "bild", mime: "image/heic" }))).toBe("herunterladen");
    expect(oeffnenArt(d({ art: "office", mime: "application/msword" }))).toBe("herunterladen");
    expect(oeffnenArt(d({ scanStatus: "quarantaene" }))).toBe("gesperrt");
  });
  it("Kandidaten filtern nach Typ, Geschoss, Name; Datenblatt-Vorschlag", () => {
    const bt = [b("p1", "heizung.umwaelzpumpe"), b("p2", "heizung.umwaelzpumpe", "EG", "EG · Gastro"), b("v1", "heizung.verteiler")];
    const name = (k: string) => (k === "heizung.umwaelzpumpe" ? "Umwälzpumpe" : "Heizungsverteiler");
    expect(bauteilKandidaten(bt, { katalogId: "heizung.umwaelzpumpe", geschoss: null, suche: "" }, name).map((x) => x.id)).toEqual(["p1", "p2"]);
    expect(bauteilKandidaten(bt, { katalogId: null, geschoss: "EG", suche: "" }, name).map((x) => x.id)).toEqual(["p2"]);
    expect(bauteilKandidaten(bt, { katalogId: null, geschoss: null, suche: "verteil" }, name).map((x) => x.id)).toEqual(["v1"]);
    expect(datenblattVorschlag(d({ kategorie: "datenblatt", bauteilIds: ["p1"] }), bt)).toEqual(["p2"]);
    expect(datenblattVorschlag(d({ kategorie: "offerte", bauteilIds: ["p1"] }), bt)).toEqual([]);
    expect(unterlagenFuer([d({ id: "a", bauteilIds: ["p1"] }), d({ id: "b" })], ["p1", "p2"]).map((x) => x.id)).toEqual(["a"]);
  });
  it("Fehlertexte und Vorpruefung", () => {
    expect(ablageFehlerText("typ_unbekannt")).toBe("Dateityp nicht erlaubt. Erlaubt sind PDF, JPG, PNG, HEIC, Word, Excel und PowerPoint.");
    expect(ablageFehlerText("makro")).toBe("Dateien mit Makros werden nicht abgelegt.");
    expect(ablageFehlerText(null, 413)).toBe("Datei grösser als 100 MB.");
    const v = vorpruefen([{ size: 10 }, { size: MAX_BYTES + 1 }]);
    expect([v.ok.length, v.zuGross.length]).toEqual([1, 1]);
  });
});
```
  `app/web/src/viewer/seiten.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { klemmeSeite, naechsterTreffer, naechsterZoom, trefferSeiten, ZOOM_STUFEN } from "./seiten";
describe("Viewer-Navigation", () => {
  it("Seite klemmen", () => { expect([klemmeSeite(0, 3), klemmeSeite(2, 3), klemmeSeite(9, 3), klemmeSeite(Number.NaN, 3)]).toEqual([1, 2, 3, 1]); });
  it("Zoom-Stufen", () => {
    expect(ZOOM_STUFEN).toContain(1);
    expect([naechsterZoom(1, 1), naechsterZoom(1, -1), naechsterZoom(3, 1), naechsterZoom(0.5, -1), naechsterZoom(1.1, 1)]).toEqual([1.25, 0.75, 3, 0.5, 1.25]);
  });
  it("Textsuche ohne Gross/Klein, ab 2 Zeichen", () => {
    const t = ["Umwälzpumpe Wilo", "nichts", "PUMPE pumpe"];
    expect(trefferSeiten(t, "pumpe")).toEqual([{ seite: 1, anzahl: 1 }, { seite: 3, anzahl: 2 }]);
    expect(trefferSeiten(t, "p")).toEqual([]);
    expect([naechsterTreffer([{ seite: 1 }, { seite: 3 }], 1, 1), naechsterTreffer([{ seite: 1 }, { seite: 3 }], 3, 1), naechsterTreffer([{ seite: 1 }, { seite: 3 }], 1, -1), naechsterTreffer([], 1, 1)]).toEqual([3, 1, 3, null]);
  });
});
```
  `app/web/src/bestand/datenblatt.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { werteAusEingabe, wertText, type DatenblattFeld } from "./datenblatt";
const F: DatenblattFeld[] = [{ schluessel: "dn", bezeichnung: "Nennweite", einheit: "DN", art: "zahl" }, { schluessel: "bauart", bezeichnung: "Bauart", einheit: null, art: "text" }];
describe("Datenblatt-Eingabe", () => {
  it("Zahl mit Komma oder Punkt, leer = null, Text getrimmt", () => {
    expect(werteAusEingabe(F, { dn: "32", bauart: " Nassläufer " })).toEqual({ werte: { dn: 32, bauart: "Nassläufer" }, fehler: {} });
    expect(werteAusEingabe(F, { dn: "6,5", bauart: "" })).toEqual({ werte: { dn: 6.5, bauart: null }, fehler: {} });
    expect(werteAusEingabe(F, { dn: "gross" }).fehler).toEqual({ dn: "Zahl eingeben" });
  });
  it("Anzeige", () => {
    expect([wertText(F[0], 32), wertText(F[1], "Nass"), wertText(F[0], undefined)]).toEqual(["DN 32", "Nass", "–"]);
  });
});
```

- [ ] **Step 2: Run** in `app/web/`: `npx.cmd vitest run src/dokumente src/viewer src/bestand` — Expected: FAIL.

- [ ] **Step 3: Implementieren**
  `app/web/src/dokumente/typen.ts`: Typen wie im Interface-Block (Kommentar `// Spiegel von app/src/dokumente/speicher.ts`).
  `app/web/src/dokumente/api.ts`:
```ts
import { ApiFehler, ersetzeJson, fehlerCodes, fehlerMeldungen, holeJson, loescheJson, sendeJson } from "../api";
import type { AblageAntwort, AblageZeile, Kategorie } from "./typen";
const BASIS = "/api/dokumente";
export const ladeAblage = (gebaeudeId: string) => holeJson<AblageAntwort>(`${BASIS}/gebaeude/${gebaeudeId}`);
/** Datei roh ablegen (ein Request, kein Multipart); 201 = neu, 200 = gleicher Inhalt schon abgelegt. */
export async function legeAb(gebaeudeId: string, datei: File, o: { kategorie?: Kategorie; bauteilIds?: string[] } = {}): Promise<{ zeile: AblageZeile; neu: boolean }> {
  const q = new URLSearchParams();
  if (o.kategorie) q.set("kategorie", o.kategorie);
  if (o.bauteilIds?.length) q.set("bauteile", o.bauteilIds.join(","));
  const r = await fetch(`${BASIS}/gebaeude/${gebaeudeId}${q.size ? `?${q}` : ""}`, {
    method: "POST", credentials: "same-origin",
    headers: { "content-type": "application/octet-stream", "x-dateiname": encodeURIComponent(datei.name), "x-planora-request": "1" },
    body: datei,
  });
  if (!r.ok) {
    let j: unknown = null;
    try { j = await r.json(); } catch { /* kein JSON, z. B. 413 */ }
    throw new ApiFehler(r.status, fehlerMeldungen(j), fehlerCodes(j));
  }
  return { zeile: (await r.json()) as AblageZeile, neu: r.status === 201 };
}
export const loesche = (id: string) => loescheJson<void>(`${BASIS}/${id}`);
export const setzeKategorie = (id: string, kategorie: Kategorie) => ersetzeJson<AblageZeile>(`${BASIS}/${id}/kategorie`, { kategorie });
export const verknuepfe = (id: string, bauteilIds: string[]) => ersetzeJson<AblageZeile>(`${BASIS}/${id}/bauteile`, { bauteilIds });
export const pruefeErneut = (id: string) => sendeJson<AblageZeile>(`${BASIS}/${id}/erneut-pruefen`, {});
export const dateiUrl = (id: string, download = false) => `${BASIS}/${id}/datei${download ? "?download=1" : ""}`;
/** Bytes fuer den Viewer (PDF.js laedt aus dem Speicher, nicht ueber eine URL). */
export async function ladeBytes(id: string): Promise<ArrayBuffer> {
  const r = await fetch(dateiUrl(id), { credentials: "same-origin" });
  if (!r.ok) throw new ApiFehler(r.status, [], []);
  return r.arrayBuffer();
}
```
  `app/web/src/dokumente/ansicht.ts`:
```ts
import type { AblageBauteil, AblageZeile, Kategorie } from "./typen";
export const MAX_BYTES = 100 * 1024 * 1024;
export const KATEGORIEN: { id: Kategorie; name: string }[] = [
  { id: "datenblatt", name: "Datenblatt" }, { id: "plan", name: "Plan" }, { id: "offerte", name: "Offerte" },
  { id: "foto", name: "Foto" }, { id: "protokoll", name: "Protokoll" }, { id: "sonstiges", name: "Sonstiges" },
];
export const kategorieName = (k: Kategorie) => KATEGORIEN.find((x) => x.id === k)?.name ?? k;
export function scanAnzeige(d: Pick<AblageZeile, "scanStatus" | "scanGrund">): { text: string; art: "laeuft" | "ok" | "fehler" | "abgelehnt" } {
  if (d.scanStatus === "quarantaene") return { text: "wird geprüft …", art: "laeuft" };
  if (d.scanStatus === "sauber") return { text: "geprüft", art: "ok" };
  if (d.scanStatus === "abgelehnt") return { text: `abgelehnt: ${d.scanGrund ?? "Befund"}`, art: "abgelehnt" };
  return { text: "Prüfung fehlgeschlagen", art: "fehler" };
}
const zahl = new Intl.NumberFormat("de-CH", { maximumFractionDigits: 1 });
export function groesseText(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${zahl.format(Math.round(bytes / 1024))} KB`;
  return `${zahl.format(bytes / (1024 * 1024))} MB`;
}
export const filtere = (d: AblageZeile[], f: { kategorie: Kategorie | null; nurUnverknuepft: boolean }) =>
  d.filter((x) => (!f.kategorie || x.kategorie === f.kategorie) && (!f.nurUnverknuepft || x.bauteilIds.length === 0));
export const pruefungLaeuft = (d: AblageZeile[]) => d.some((x) => x.scanStatus === "quarantaene");
export function oeffnenArt(d: Pick<AblageZeile, "scanStatus" | "art" | "mime">): "pdf" | "bild" | "herunterladen" | "gesperrt" {
  if (d.scanStatus !== "sauber") return "gesperrt";
  if (d.art === "pdf") return "pdf";
  if (d.art === "bild" && d.mime !== "image/heic") return "bild";
  return "herunterladen";
}
export function bauteilKandidaten(b: AblageBauteil[], f: { katalogId: string | null; geschoss: string | null; suche: string }, name: (katalogId: string) => string) {
  const s = f.suche.trim().toLocaleLowerCase("de-CH");
  return b.filter((x) => (!f.katalogId || x.katalogId === f.katalogId) && (!f.geschoss || x.geschoss === f.geschoss)
    && (!s || [name(x.katalogId), x.ort, x.hersteller ?? "", x.typ ?? ""].join(" ").toLocaleLowerCase("de-CH").includes(s)));
}
export function datenblattVorschlag(d: AblageZeile, b: AblageBauteil[]): string[] {
  if (d.kategorie !== "datenblatt") return [];
  const typen = new Set(b.filter((x) => d.bauteilIds.includes(x.id)).map((x) => x.katalogId));
  return b.filter((x) => typen.has(x.katalogId) && !d.bauteilIds.includes(x.id)).map((x) => x.id);
}
const FEHLER: Record<string, string> = {
  typ_unbekannt: "Dateityp nicht erlaubt. Erlaubt sind PDF, JPG, PNG, HEIC, Word, Excel und PowerPoint.",
  makro: "Dateien mit Makros werden nicht abgelegt.", zu_gross: "Datei grösser als 100 MB.", leer: "Datei ist leer.",
  nicht_sauber: "Datei ist noch nicht freigegeben.", bauteil_unbekannt: "Bauteil gehört nicht zu diesem Gebäude.",
};
export function ablageFehlerText(code: string | null, status?: number): string {
  if (code && FEHLER[code]) return FEHLER[code];
  if (status === 413) return FEHLER.zu_gross;
  if (status === 403) return "Keine Berechtigung zum Ablegen.";
  return "Ablegen fehlgeschlagen.";
}
export const unterlagenFuer = (d: AblageZeile[], bauteilIds: string[]) => d.filter((x) => x.bauteilIds.some((id) => bauteilIds.includes(id)));
export function vorpruefen<T extends { size: number }>(dateien: T[]) {
  return { ok: dateien.filter((f) => f.size <= MAX_BYTES), zuGross: dateien.filter((f) => f.size > MAX_BYTES) };
}
```
  `app/web/src/viewer/seiten.ts`:
```ts
export const klemmeSeite = (seite: number, anzahl: number) => (Number.isFinite(seite) ? Math.min(Math.max(1, Math.round(seite)), Math.max(1, anzahl)) : 1);
export const ZOOM_STUFEN = [0.5, 0.75, 1, 1.25, 1.5, 2, 3] as const;
export function naechsterZoom(z: number, richtung: 1 | -1): number {
  if (richtung === 1) return ZOOM_STUFEN.find((s) => s > z + 1e-6) ?? ZOOM_STUFEN[ZOOM_STUFEN.length - 1];
  return [...ZOOM_STUFEN].reverse().find((s) => s < z - 1e-6) ?? ZOOM_STUFEN[0];
}
export function trefferSeiten(texte: string[], begriff: string): { seite: number; anzahl: number }[] {
  const b = begriff.trim().toLocaleLowerCase("de-CH");
  if (b.length < 2) return [];
  return texte.map((t, i) => ({ seite: i + 1, anzahl: t.toLocaleLowerCase("de-CH").split(b).length - 1 })).filter((x) => x.anzahl > 0);
}
export function naechsterTreffer(treffer: { seite: number }[], aktuell: number, richtung: 1 | -1): number | null {
  if (!treffer.length) return null;
  const s = treffer.map((t) => t.seite);
  return richtung === 1 ? (s.find((x) => x > aktuell) ?? s[0]) : ([...s].reverse().find((x) => x < aktuell) ?? s[s.length - 1]);
}
```
  `app/web/src/bestand/datenblatt.ts`:
```ts
import { ersetzeJson, holeJson } from "../api";
export interface DatenblattFeld { schluessel: string; bezeichnung: string; einheit: string | null; art: "zahl" | "text" }
export interface DatenblattAntwort { bauteilId: string; katalogId: string; felder: DatenblattFeld[]; werte: Record<string, number | string>; darfAendern: boolean }
export const ladeDatenblatt = (bauteilId: string) => holeJson<DatenblattAntwort>(`/api/bestand/bauteile/${bauteilId}/datenblatt`);
export const speichereDatenblatt = (bauteilIds: string[], werte: Record<string, number | string | null>) =>
  ersetzeJson<DatenblattAntwort>("/api/bestand/datenblatt", { bauteilIds, werte });
/** Eingabe (Textfelder) -> Werte fuer PUT; Zahlen mit Komma oder Punkt, leer = null. */
export function werteAusEingabe(felder: DatenblattFeld[], eingabe: Record<string, string>) {
  const werte: Record<string, number | string | null> = {}; const fehler: Record<string, string> = {};
  for (const f of felder) {
    if (!(f.schluessel in eingabe)) continue;
    const roh = eingabe[f.schluessel].trim();
    if (!roh) { werte[f.schluessel] = null; continue; }
    if (f.art === "text") { werte[f.schluessel] = roh; continue; }
    const n = Number(roh.replace(",", ".").replace(/'/g, ""));
    if (Number.isFinite(n)) werte[f.schluessel] = n; else fehler[f.schluessel] = "Zahl eingeben";
  }
  return { werte, fehler };
}
export function wertText(f: DatenblattFeld, w: number | string | undefined): string {
  if (w === undefined || w === "") return "–";
  if (f.art === "text" || typeof w === "string") return String(w);
  const z = new Intl.NumberFormat("de-CH", { maximumFractionDigits: 2 }).format(w);
  return f.einheit === "DN" ? `DN ${z}` : f.einheit ? `${z} ${f.einheit}` : z;
}
```
  `app/web/src/typen.ts`: `KatalogEintrag` um `datenblatt?: DatenblattFeld[]; lebensdauerQuelle?: { text: string; jahr: number }; icon?: string` erweitern (Typ aus `./bestand/datenblatt` importieren). `app/web/src/preisdokument/typen.ts`: `DokumentZeile` um `scanStatus: "quarantaene" | "sauber" | "abgelehnt" | "scan_fehler"` erweitern.
  `app/web/src/dashboard/daten.ts`: in `NAMEN` `"heizung.ausdehnungsgefaess": "Ausdehnungsgefäss", "heizung.sonstiges": "Sonstiges"`; `IconSchluessel` um `"ventil" | "zaehler" | "ausdehnung"`; `ICONS` um `"heizung.ventil_3weg": "ventil", "heizung.ventil_2weg": "ventil", "heizung.wmz": "zaehler", "heizung.ausdehnungsgefaess": "ausdehnung", "heizung.sonstiges": "anlage"`. `app/web/src/karten/TwinObjekt.tsx`: `ANLAGEN_ICON` um `ventil: SlidersHorizontal, zaehler: Gauge, ausdehnung: Droplet` (Namen vorher in `node_modules/lucide-react/dist/lucide-react.d.ts` per grep bestaetigen; fehlt einer, den naechstpassenden aus dieser Datei waehlen und im Commit nennen).

- [ ] **Step 4: Run** in `app/web/`: `npx.cmd vitest run` und `npx.cmd tsc --noEmit -p .` — Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add app/web/src
git commit -m "Anlagenakte T7: Web-Typen, API und reine Funktionen fuer Ablage, Viewer, Datenblatt, Icons" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Web – Seite Dokumente, Viewer, Unterlagen und Datenblatt in der Anlagenkarte (planora-design, Stufe mittel)

**Files:**
- Create: `app/web/src/viewer/pdf.ts`, `app/web/src/viewer/Viewer.tsx`, `app/web/src/viewer/Viewer.css`, `app/web/werkzeug/pdfjs-assets.mjs`, `app/web/src/karten/TwinUnterlagen.tsx`, `app/web/src/karten/TwinDatenblatt.tsx`
- Modify: `app/web/package.json` (+ lock), `app/web/src/seiten/Dokumente.tsx`, `app/web/src/seiten/Dokumente.css`, `app/web/src/seiten/dokumenteAnsicht.ts` (`teileDateien` entfaellt), `app/web/src/seiten/dokumenteVerfuegbar.ts`, `app/web/src/App.tsx`, `app/web/src/seiten/Twin.tsx`, `app/web/src/karten/TwinObjekt.tsx`, `app/web/src/karten/TwinLebensdauer.tsx`, `app/web/src/karten/preisQuelle.ts`, `app/web/src/seiten/Erneuerungsplan.tsx`, `app/web/public/lizenzen.txt`, `.gitignore`

**Interfaces:**
- Consumes: alles aus Task 7; `LdStand` (Lebensdauer) fuer Preis-Fundstellen.
- Produces:
```ts
// viewer/pdf.ts
export function oeffnePdf(daten: ArrayBuffer): Promise<PDFDocumentProxy>
export function zeichneSeite(doc: PDFDocumentProxy, nr: number, canvas: HTMLCanvasElement, massstab: number): { fertig: Promise<void>; abbrechen(): void }
export function seitenTexte(doc: PDFDocumentProxy): Promise<string[]>
// viewer/Viewer.tsx
export function Viewer(p: { dokument: AblageZeile; seite?: number; onSchliessen: () => void }): JSX.Element
// App.tsx Zustand
{ art: "dokumente"; gebaeudeId; name; bauteilId?: string; herkunft: "twin" | "plan"; ansicht?: "alle" | "preise" }
```

Hinweis [A]: Die Seite "Dokumente" ist immer erreichbar (Kernmodul); der Umschalter "Preise prüfen (n)" erscheint nur, wenn `preisdokument` lesbar ist (`useDokumenteVerfuegbar`, umbenannt zu `usePreiseVerfuegbar`). Einstiege aus Erneuerung/Plan ("Preise aus Dokumenten lesen") oeffnen `ansicht: "preise"`, der Kopf-Einstieg im Twin `ansicht: "alle"`. "Öffnen" in einem neuen Tab entfaellt; Fundstellen "S. n ↗" oeffnen den Viewer auf Seite n.

- [ ] **Step 1: pdfjs-dist installieren** – in `app/web/`: `npm.cmd view pdfjs-dist version` (aktuelle Version notieren, mind. zwei Wochen alt; sonst die vorherige laut `npm.cmd view pdfjs-dist time --json`), dann `npm.cmd install pdfjs-dist@<version> --save-exact`. Lizenz Apache-2.0: Text aus `node_modules/pdfjs-dist/LICENSE` im Format der bestehenden Eintraege an `public/lizenzen.txt` anhaengen. In `node_modules/pdfjs-dist/types/src/display/api.d.ts` die Optionen von `getDocument` und `render` nachlesen (u. a. `isEvalSupported`, `enableXfa`, `cMapUrl`, `standardFontDataUrl`, `wasmUrl`/`useWasm`, `render({ canvasContext | canvas, viewport })`) und `pdf.ts` (Step 3) daran anpassen.

- [ ] **Step 2: Assets aus eigener Domain** – `app/web/werkzeug/pdfjs-assets.mjs`:
```js
// Kopiert cMaps, Standardschriften und (falls vorhanden) wasm von pdfjs-dist nach public/pdfjs/ (eigene Domain, CSP default-src 'self').
import { cpSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
const quelle = join(import.meta.dirname, "..", "node_modules", "pdfjs-dist");
const ziel = join(import.meta.dirname, "..", "public", "pdfjs");
rmSync(ziel, { recursive: true, force: true });
for (const ordner of ["cmaps", "standard_fonts", "wasm"]) if (existsSync(join(quelle, ordner))) cpSync(join(quelle, ordner), join(ziel, ordner), { recursive: true });
console.log("pdfjs-Assets nach public/pdfjs kopiert");
```
  `app/web/package.json` Scripts: `"dev": "node werkzeug/pdfjs-assets.mjs && vite"`, `"build": "node werkzeug/pdfjs-assets.mjs && tsc --noEmit -p tsconfig.json && vite build"`. `.gitignore`: `app/web/public/pdfjs/`.

- [ ] **Step 3: `app/web/src/viewer/pdf.ts`** (Optionen gemaess Step 1 bestaetigt):
```ts
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Worker aus eigener Domain (gebuendeltes Asset), kein CDN; CSP default-src 'self' deckt ihn ab.
GlobalWorkerOptions.workerSrc = workerUrl;

/** PDF aus Bytes oeffnen: keine Skripte (ADR 0022), kein eval (CSP ohne unsafe-eval), Hilfsdaten aus /pdfjs/. */
export function oeffnePdf(daten: ArrayBuffer): Promise<PDFDocumentProxy> {
  return getDocument({ data: new Uint8Array(daten), isEvalSupported: false, enableXfa: false,
    cMapUrl: "/pdfjs/cmaps/", cMapPacked: true, standardFontDataUrl: "/pdfjs/standard_fonts/" }).promise;
}

/** Zeichnet Seite nr in den Canvas (Geraetepixel scharf); abbrechen() beim Seitenwechsel. */
export function zeichneSeite(doc: PDFDocumentProxy, nr: number, canvas: HTMLCanvasElement, massstab: number) {
  let aufgabe: { cancel(): void; promise: Promise<void> } | null = null; let abgebrochen = false;
  const fertig = (async () => {
    const seite = await doc.getPage(nr);
    if (abgebrochen) return;
    const dpr = window.devicePixelRatio || 1;
    const vp = seite.getViewport({ scale: massstab * dpr });
    canvas.width = Math.floor(vp.width); canvas.height = Math.floor(vp.height);
    canvas.style.width = `${Math.floor(vp.width / dpr)}px`; canvas.style.height = `${Math.floor(vp.height / dpr)}px`;
    aufgabe = seite.render({ canvasContext: canvas.getContext("2d")!, canvas, viewport: vp });
    await aufgabe.promise.catch((e: unknown) => { if ((e as { name?: string })?.name !== "RenderingCancelledException") throw e; });
  })();
  return { fertig, abbrechen: () => { abgebrochen = true; aufgabe?.cancel(); } };
}

export async function seitenTexte(doc: PDFDocumentProxy): Promise<string[]> {
  const texte: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const t = await (await doc.getPage(i)).getTextContent();
    texte.push(t.items.map((x) => ("str" in x ? x.str : "")).join(" "));
  }
  return texte;
}
```

- [ ] **Step 4: Viewer-Grundgeruest** `app/web/src/viewer/Viewer.tsx` (Funktion; Gestaltung in Step 7 durch ui-ux-designer):
```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Minus, Plus, Search, X } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { AblageZeile } from "../dokumente/typen";
import { dateiUrl, ladeBytes } from "../dokumente/api";
import { kategorieName, oeffnenArt } from "../dokumente/ansicht";
import { klemmeSeite, naechsterTreffer, naechsterZoom, trefferSeiten } from "./seiten";
import "./Viewer.css";

interface Props { dokument: AblageZeile; seite?: number; onSchliessen: () => void }

/** Overlay-Viewer (Esc schliesst): PDF mit Seitenleiste, Seite n, Zoom, Textsuche; Bilder mit Zoom; Office nur Herunterladen. */
export function Viewer({ dokument, seite: start = 1, onSchliessen }: Props) {
  const art = oeffnenArt(dokument);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [seite, setSeite] = useState(start);
  const [zoom, setZoom] = useState(1);
  const [suche, setSuche] = useState("");
  const [texte, setTexte] = useState<string[] | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const treffer = useMemo(() => (texte ? trefferSeiten(texte, suche) : []), [texte, suche]);

  useEffect(() => { dialog.current?.focus(); }, []);
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onSchliessen(); }
      else if (doc && (e.key === "PageDown" || e.key === "ArrowRight")) setSeite((s) => klemmeSeite(s + 1, doc.numPages));
      else if (doc && (e.key === "PageUp" || e.key === "ArrowLeft")) setSeite((s) => klemmeSeite(s - 1, doc.numPages));
    };
    window.addEventListener("keydown", taste, true);
    return () => window.removeEventListener("keydown", taste, true);
  }, [doc, onSchliessen]);
  useEffect(() => {
    if (art !== "pdf") return;
    let aktiv = true; let offen: PDFDocumentProxy | null = null;
    ladeBytes(dokument.id).then(async (b) => { const { oeffnePdf } = await import("./pdf"); offen = await oeffnePdf(b);
      if (!aktiv) { void offen.destroy(); return; } setDoc(offen); setSeite((s) => klemmeSeite(s, offen!.numPages)); })
      .catch(() => { if (aktiv) setFehler("Dokument konnte nicht geöffnet werden."); });
    return () => { aktiv = false; void offen?.destroy(); };
  }, [art, dokument.id]);
  useEffect(() => {
    if (!doc || !canvas.current) return;
    let z: { abbrechen(): void } | null = null;
    void import("./pdf").then(({ zeichneSeite }) => { z = zeichneSeite(doc, seite, canvas.current!, zoom); });
    return () => z?.abbrechen();
  }, [doc, seite, zoom]);
  useEffect(() => {
    if (!doc || suche.trim().length < 2 || texte) return;
    void import("./pdf").then(({ seitenTexte }) => seitenTexte(doc)).then(setTexte, () => setTexte([]));
  }, [doc, suche, texte]);

  return (
    <div className="vw-grund" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onSchliessen(); }}>
      <div ref={dialog} className="vw" role="dialog" aria-modal="true" aria-labelledby="vw-titel" tabIndex={-1}>
        <header className="vw-kopf">
          <h2 id="vw-titel">{dokument.dateiname}<span>{kategorieName(dokument.kategorie)}</span></h2>
          {art === "pdf" && doc && <div className="vw-werkzeuge">
            <button type="button" onClick={() => setSeite((s) => klemmeSeite(s - 1, doc.numPages))} aria-label="Vorherige Seite"><ChevronLeft size={16} aria-hidden="true" /></button>
            <label className="vw-seite">Seite <input type="number" min={1} max={doc.numPages} value={seite} onChange={(e) => setSeite(klemmeSeite(Number(e.target.value), doc.numPages))} /> von {doc.numPages}</label>
            <button type="button" onClick={() => setSeite((s) => klemmeSeite(s + 1, doc.numPages))} aria-label="Nächste Seite"><ChevronRight size={16} aria-hidden="true" /></button>
            <button type="button" onClick={() => setZoom((z) => naechsterZoom(z, -1))} aria-label="Verkleinern"><Minus size={16} aria-hidden="true" /></button>
            <span className="vw-zoom">{Math.round(zoom * 100)} %</span>
            <button type="button" onClick={() => setZoom((z) => naechsterZoom(z, 1))} aria-label="Vergrössern"><Plus size={16} aria-hidden="true" /></button>
            <label className="vw-suche"><Search size={14} aria-hidden="true" /><input type="search" value={suche} placeholder="Im Dokument suchen"
              onChange={(e) => setSuche(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { const n = naechsterTreffer(treffer, seite, e.shiftKey ? -1 : 1); if (n) setSeite(n); } }} />
              {suche.trim().length >= 2 && <span>{texte ? `${treffer.reduce((n, t) => n + t.anzahl, 0)} Treffer` : "sucht …"}</span>}</label>
          </div>}
          <a className="vw-knopf" href={dateiUrl(dokument.id, true)} download><Download size={15} aria-hidden="true" />Herunterladen</a>
          <button type="button" className="vw-zu" onClick={onSchliessen} aria-label="Schliessen (Esc)"><X size={16} aria-hidden="true" /></button>
        </header>
        <div className="vw-inhalt">
          {art === "pdf" && doc && <nav className="vw-leiste" aria-label="Seiten">{Array.from({ length: doc.numPages }, (_, i) => i + 1).map((n) =>
            <button key={n} type="button" aria-current={n === seite ? "page" : undefined} className={treffer.some((t) => t.seite === n) ? "vw-treffer" : undefined} onClick={() => setSeite(n)}>{n}</button>)}</nav>}
          <div className="vw-flaeche">
            {art === "pdf" && (fehler ? <p role="alert">{fehler}</p> : doc ? <canvas ref={canvas} /> : <p role="status">Dokument wird geladen …</p>)}
            {art === "bild" && <img src={dateiUrl(dokument.id)} alt={dokument.dateiname} style={{ transform: `scale(${zoom})` }} />}
            {art === "herunterladen" && <p>{dokument.mime === "image/heic" ? "Vorschau für HEIC nicht verfügbar." : "Office-Dateien werden nicht in Planora angezeigt."} Bitte herunterladen.</p>}
            {art === "gesperrt" && <p role="alert">Datei ist noch nicht freigegeben.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
```
  Hinweis: `style={{ transform }}` setzt React per CSSOM (CSP-konform, wie der Bestand). Bild-Zoom-Knoepfe ergaenzt der Designer.

- [ ] **Step 5: Verdrahtung** (funktional, vor der Gestaltung):
  - `App.tsx`: Zustand `dokumente` um `ansicht?: "alle" | "preise"`; `onDokumente` aus Twin mit `ansicht: "alle"` (Kopf) bzw. `"preise"` (Erneuerung, Anlagenkarte "aus Dokument …"), aus Plan `"preise"`; `Dokumente` erhaelt `ansicht`.
  - `seiten/dokumenteVerfuegbar.ts`: Hook umbenennen zu `usePreiseVerfuegbar` (Verhalten gleich); Twin zeigt den Kopf-Einstieg "Dokumente" immer, Preis-Links nur bei `usePreiseVerfuegbar`.
  - `seiten/Twin.tsx`: `ladeAblage(gebaeudeId)` beim Laden und nach jeder Aenderung; Zustand `viewer: { dokument: AblageZeile; seite?: number } | null`; `TwinObjekt` erhaelt `unterlagen={unterlagenFuer(ablage.dokumente, karte.bauteilIds)}`, `darfAblegen={ablage.darfAendern}`, `onOeffnen={(d, seite) => setViewer({ dokument: d, seite })}`, `onAblegen={(dateien) => …legeAb(gebaeudeId, f, { bauteilIds: karte.bauteilIds })…}`, `katalog`; Esc schliesst zuerst den Viewer (Esc-Reihenfolge wie bestehende Karten, einstufig).
  - `karten/preisQuelle.ts` und `karten/TwinLebensdauer.tsx`, `seiten/Erneuerungsplan.tsx`: "S. n ↗" ruft `onOeffnen(dokumentId, seite)` statt `href` in neuem Tab; die Seite holt das `AblageZeile` aus `ladeAblage` und oeffnet `Viewer`. Ist das Dokument geloescht (`dokumentId: null`), bleibt der Text "Dokument (gelöscht)" ohne Link.
  - `karten/TwinUnterlagen.tsx` (neu): Abschnitt "Unterlagen (n)" mit Kategorie-Icon, Name, Scan-Zustand (`scanAnzeige`), Klick -> `onOeffnen` (bei `oeffnenArt` "herunterladen" Link `dateiUrl(id, true)`), "+ Ablegen" (verstecktes `input type=file multiple`, nur bei `darfAblegen`), Fehler ueber `ablageFehlerText`; Polling alle 2 s solange `pruefungLaeuft`.
  - `karten/TwinDatenblatt.tsx` (neu): laedt `ladeDatenblatt(karte.bauteilIds[0])`, zeigt Felder mit `wertText`, bei `darfAendern` "Bearbeiten" -> Eingabefelder, Speichern ueber `speichereDatenblatt(karte.bauteilIds, werteAusEingabe(…).werte)`; darunter "Richtwert Lebensdauer: Quelle <text> (<jahr>)" aus `katalog.eintraege[].lebensdauerQuelle`. Bei mehreren Bauteilen Hinweis "Gilt für alle n Bauteile dieser Gruppe."
  - `karten/TwinObjekt.tsx`: den Platzhalter-Block "Dokumente … folgt" durch `TwinUnterlagen` und `TwinDatenblatt` ersetzen; Kommentar "Dokumente sind noch nicht angebunden" entfernen.
  - `seiten/Dokumente.tsx`: Umschalter oben "Alle Dokumente | Preise prüfen (n)" (`n` = offene Vorschlaege; zweiter Zustand = heutige Preis-Ansicht inkl. "Alle sicheren übernehmen"). Zustand "Alle Dokumente": links Ablegeflaeche (alle erlaubten Typen, `vorpruefen`, Mehrfachauswahl), Liste mit Name, Kategorie, Datum, Groesse, Scan-Zustand ("wird geprüft …", sauber als stiller Punkt, "abgelehnt" rot mit Grund, "Prüfung fehlgeschlagen" mit "Erneut prüfen" bei Schreibrecht), Filter Kategorie und "nicht verknüpft"; rechts Detail: Vorschau (Bild klein, PDF erste Seite oder Symbol), Kategorie-Auswahl (`setzeKategorie`), verknuepfte Bauteile mit Entfernen und Hinzufuegen (Mehrfachauswahl gefiltert ueber `bauteilKandidaten` nach Typ, Geschoss, Name; bei Datenblatt `datenblattVorschlag` als "Vorgeschlagen"), Knoepfe "Öffnen" (Viewer), "Herunterladen", "Preise lesen" (nur `art === "pdf" && scanStatus === "sauber" && auslesen an`, ruft `liesNeu`), "Löschen" (Rueckfrage); darunter die Preis-Vorschlaege dieser Datei (aus der Preis-Uebersicht, gleiche Karten wie heute). Leser: keine Schreibknoepfe, keine Ablegeflaeche. Polling 2 s solange `pruefungLaeuft` oder `laeuftNoch`. `teileDateien` (nur PDF) entfaellt samt Test. Doppelte Datei: Meldung "Ist schon abgelegt." und Auswahl des bestehenden Dokuments.

- [ ] **Step 6: Funktion pruefen** – in `app/web/`: `npx.cmd vitest run`, `npx.cmd tsc --noEmit -p .`, `npm.cmd run build` — Expected: PASS. Dann Testinstanz `bash werkzeug/design/instanz.sh start --muster`, `http://localhost:3100/entwicklung/anmelden`, Muster 6 -> Dokumente: PDF ablegen, im Viewer oeffnen, Seite wechseln, suchen; Browser-Konsole: **keine CSP-Verletzung** (sonst anhalten, PO fragen). Instanz stoppen: `bash werkzeug/design/instanz.sh stop`.

- [ ] **Step 7: Designauftrag** – Skill `planora-design` (Stufe mittel) aufrufen; `ui-ux-designer` erhaelt Spec Abschnitt 5, diesen Task, die funktionierende Fassung aus Step 4–6 und Dateihoheit (`seiten/**`, `karten/**`, `viewer/**`, `ui/**`, `App.tsx`). Vorgaben woertlich aus der Spec (Seite, Viewer, Unterlagen, Datenblatt), Regel 20 (Twin-Szene unveraendert), Tokens aus `design/tokens.ts`, Bewegung nach `docs/design/prinzipien.md`. Danach `npx.cmd vitest run && npx.cmd tsc --noEmit -p . && npm.cmd run build` gruen.

- [ ] **Step 8: visual-critic** (max. 3 Runden) mit echten GPU-Screenshots 1440/1280/1920 (`node werkzeug/design/screenshot.mjs --szenario werkzeug/design/szenarien/anlagenakte.json --aus docs/design/kritiken/<datum>-anlagenakte-r<n>`). Szenario `werkzeug/design/szenarien/anlagenakte.json` anlegen (Dokumente leer, Liste mit allen Scan-Zustaenden, Detail mit Verknuepfung, Viewer PDF Seite 2, Viewer Bild, Anlagenkarte mit Unterlagen und Datenblatt, Leser-Ansicht). Testdaten: Task 10 Step 1–2 (Werkzeug `werkzeug/anlagenakte/`) vorziehen, falls noetig. Befunde ueber den ui-ux-designer beheben; Kritiken unter `docs/design/kritiken/<datum>-anlagenakte/`.

- [ ] **Step 9: Commit**
```bash
git add app/web .gitignore werkzeug/design/szenarien/anlagenakte.json docs/design/kritiken
git commit -m "Anlagenakte T8: Seite Dokumente, Viewer (pdfjs-dist), Unterlagen und Datenblatt in der Anlagenkarte" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: GLB-Modelle Ausdehnungsgefaess und Sonstiges, Waermezaehler pruefen (3d-designer)

**Files:**
- Modify: `docs/design/modelle/anlagen.py`, `docs/design/modelle/pruefen.py` (falls Sonderfall), `docs/design/modelle/README.md`, `app/web/src/szene3/technik.ts`, `app/web/src/szene3/technik.test.ts`
- Create: `app/web/public/modelle/heizung.ausdehnungsgefaess.glb`, `app/web/public/modelle/heizung.sonstiges.glb`, `docs/design/modelle/vorschau/heizung.{ausdehnungsgefaess,sonstiges}.png`, `werkzeug/design/anlagenakte-daten.mjs`

**Interfaces:**
- Consumes: Katalog-Masse aus Task 6 (`[0.45, 0.7, 0.45]`, `[0.5, 0.5, 0.4]`).
- Produces: `modellFuer("heizung.ausdehnungsgefaess" | "heizung.sonstiges")` liefert `/modelle/<id>.glb`; `ANSCHLUSS_STANDARD` fuer beide.

Hinweis [A] (Spec-Luecke): `heizung.wmz.glb` existiert bereits (Track C4, Teil in der senkrechten Leitung). Der 3d-designer prueft es nur im Stil der neuen Modelle; ein neues Modell entsteht nur bei Befund des visual-critic. Neue Modelle: Ausdehnungsgefaess (stehender Druckbehaelter, Ursprung Mitte Grundflaeche, `anschluss` oben am Anschlussstutzen), Sonstiges (neutrales Technikgehaeuse ohne Funktionsandeutung, damit es nicht als bestimmtes Geraet gelesen wird).

- [ ] **Step 1: Failing test** `app/web/src/szene3/technik.test.ts` ergaenzen:
```ts
it("neue Bibliothekstypen haben Modell und Anschluss", () => {
  for (const id of ["heizung.ausdehnungsgefaess", "heizung.sonstiges"]) {
    expect(modellFuer(id).pfad).toBe(`/modelle/${id}.glb`);
    expect(ANSCHLUSS_STANDARD[id]).toHaveLength(3);
  }
});
```
  Run `cd app/web && npx.cmd vitest run src/szene3/technik.test.ts` — Expected: FAIL.

- [ ] **Step 2: Designauftrag** – Skill `planora-design` (Stufe mittel), Agent `3d-designer` mit Vertrag aus `docs/design/modelle/README.md` (Materialien `gehaeuse`/`detail`/`dunkel`/`koo`, ein Mesh-Knoten plus Empty `anschluss`, Dreiecke < 8000, Datei < 200 kB, Bevel, keine roten Knoepfe). In `anlagen.py` Funktionen `ausdehnungsgefaess()` und `sonstiges()` und Eintraege in `MODELLE` mit den Zielmassen aus Task 6; bauen nur diese:
```powershell
& "C:/Program Files/Blender Foundation/Blender 5.1/blender.exe" --background --factory-startup --python docs/design/modelle/anlagen.py -- --nur heizung.ausdehnungsgefaess,heizung.sonstiges
python docs/design/modelle/pruefen.py
```
  Expected: `pruefen.py` Exit 0, alle Dateien bestanden; Pruefergebnis-Tabelle im README um die zwei Zeilen und das `anschluss`-Mass ergaenzen.

- [ ] **Step 3: Web-Zuordnung** – `app/web/src/szene3/technik.ts`: `MASSE` um `"heizung.ausdehnungsgefaess": [0.45, 0.7, 0.45], "heizung.sonstiges": [0.5, 0.5, 0.4]`; `ANSCHLUSS_STANDARD` um die vom Skript gemeldeten `anschluss`-Koordinaten. Run Test aus Step 1 — Expected: PASS.

- [ ] **Step 4: Szenario-Daten** – `werkzeug/design/anlagenakte-daten.mjs` (nur Entwicklung, Anmeldung wie `lebensdauer-daten.mjs`): liest `GET /api/struktur/gebaeude/<Muster 6>/beschreibung`, fuegt in die erste Einheit mit `art === "technik"` je ein Bauteil `{ katalogId: "heizung.ausdehnungsgefaess" | "heizung.sonstiges", standort: { einheitId: <id> }, menge: 1, status: "bestaetigt", versorgt: [] }` hinzu (Standortform gemaess `app/src/welt/schema.ts` BESCHREIBUNG), sendet `PUT … /beschreibung` und gibt die neuen Bauteil-IDs aus.

- [ ] **Step 5: visual-critic** mit GPU-Screenshots der Technikzentrale Muster 6 (1440/1280/1920, Nah- und Uebersichtszoom, inkl. Waermezaehler in der Gruppe); max. 3 Runden; Lessons Learned in `docs/design/lessons-learned.md` nachfuehren.

- [ ] **Step 6: Commit**
```bash
git add docs/design/modelle app/web/public/modelle app/web/src/szene3 werkzeug/design/anlagenakte-daten.mjs docs/design/kritiken docs/design/lessons-learned.md
git commit -m "Anlagenakte T9: GLB Ausdehnungsgefaess und Sonstiges, Waermezaehler geprueft" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Browser-Abnahme Muster 6, Doku, Stand

**Files:**
- Create: `werkzeug/anlagenakte/erzeuge.mjs`, `werkzeug/anlagenakte/eicar-ablegen.mjs`, `werkzeug/anlagenakte/README.md`, `docs/abnahme/2026-11-<tt>-anlagenakte/README.md` (+ Screenshots)
- Modify: `.gitignore`, `CLAUDE.md` (Abschnitt 0b), `docs/arbeitsjournal.md`

Hinweis [A] (Spec 6): Die Abnahme laeuft lokal mit dem Fake-Scanner (kein clamd im Entwicklungsstart); "EICAR abgelehnt" belegt die Pruefkette, der echte Befund ist durch `test:docker` (Task 5) belegt. Eine reine EICAR-Datei ist ASCII und wird schon an der Typpruefung abgelehnt (400 `typ_unbekannt`); fuer den Scan-Fall wird eine PDF-Huelle mit EICAR-Zeichenkette ueber die API abgelegt (nur im Speicher, nie auf Platte). Keine KI-Aufrufe: "Preise lesen" wird nur als sichtbarer/gesperrter Knopf geprueft.

- [ ] **Step 1: Abnahmedateien** `werkzeug/anlagenakte/erzeuge.mjs` – erzeugt nach `werkzeug/anlagenakte/dateien/` (git-ignoriert): `datenblatt-pumpe.pdf` (2 Seiten per Playwright `page.pdf`, Lader `ladePlaywright` aus `werkzeug/design/screenshot.mjs` kopieren; Seite 2 enthaelt "Förderhöhe 6.5 m"), `foto-zentrale.png` (Screenshot einer HTML-Seite), `kosten.xlsx` (gueltiges minimales SpreadsheetML: Teile `[Content_Types].xml`, `_rels/.rels`, `xl/workbook.xml`, `xl/_rels/workbook.xml.rels`, `xl/worksheets/sheet1.xml`, als ZIP mit gespeicherten Eintraegen und `zlib.crc32` aus `node:zlib`), und kopiert `werkzeug/preisdokument/pdf/o1-pumpen.pdf` (vorher `node werkzeug/preisdokument/erzeuge.mjs`). `.gitignore`: `werkzeug/anlagenakte/dateien/`.

- [ ] **Step 2: EICAR ueber die API** `werkzeug/anlagenakte/eicar-ablegen.mjs` – Anmeldung wie `werkzeug/design/lebensdauer-daten.mjs`, Gebaeude per Name (Standard "Muster 6 L-Form viele Gruppen"), Body = `%PDF-1.7` + Zeilenumbruch + EICAR aus zwei Teilen (`["X5O!P%@AP[4\\PZX54(P^)7CC)7}$", "EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"].join("")`), `POST /api/dokumente/gebaeude/<id>` mit `content-type: application/octet-stream`, `x-dateiname: eicar-test.pdf`, `x-planora-request: 1`, `origin`; gibt Status und ID aus.

- [ ] **Step 3: Browser-Abnahme** (Instanz `bash werkzeug/design/instanz.sh start --muster`, `node werkzeug/design/lebensdauer-daten.mjs`, `node werkzeug/design/anlagenakte-daten.mjs`, `http://localhost:3100/entwicklung/anmelden`, Muster 6, Klicks zaehlen):
  1. Seite Dokumente: Datenblatt-PDF, Foto, Excel, Offerte o1 per Drag & Drop/Knopf ablegen; `node werkzeug/anlagenakte/eicar-ablegen.mjs` -> EICAR "abgelehnt: Eicar-Test-Signature", Rest "geprüft".
  2. Datenblatt: Kategorie "Datenblatt", mit 2 Pumpen verknuepfen (Filter Typ Umwälzpumpe).
  3. Twin -> Anlagenkarte Pumpe -> "Unterlagen (1)" -> Datenblatt im Viewer -> Seite 2 anspringen, "Förderhöhe" suchen; Esc schliesst.
  4. Datenblatt-Abschnitt: DN 32, Förderhöhe 6.5 erfassen und speichern; zweite Pumpe zeigt die Werte.
  5. Excel herunterladen (Download startet, keine Vorschau).
  6. Offerte o1: "Preise lesen" sichtbar und ohne Schluessel gesperrt/Hinweis; Umschalter "Preise prüfen (n)".
  7. Foto loeschen (Rueckfrage); Offerte bleibt.
  8. Leser-Ansicht (eigenes Konto oder Rolle umstellen): sieht und oeffnet alles, keine Schreibknoepfe.
  Screenshots 1440/1280 in den Abnahmeordner; Klicks je Ablauf in der README-Tabelle.

- [ ] **Step 4: Volle Pruefung** – in `app/`: `npx.cmd vitest run`, `npm.cmd run pruefe:typen`, `npm.cmd run test:docker`; in `app/web/`: `npx.cmd vitest run`, `npx.cmd tsc --noEmit -p .`, `npm.cmd run build`. Zahlen (bestanden/gesamt) in die Abnahme-README.

- [ ] **Step 5: Abnahme-README** `docs/abnahme/<datum>-anlagenakte/README.md`: Ergebnis je Schritt, Klicks, Screenshots, Pruefstand, Kritik-Runden, offene Punkte (Siemens-Frageboegen Signaturversorgung [?], 7-Tage-Aufbewahrung [A], Datenblatt-Felder/Quellen nicht freigegeben [A], alte Office-Formate [A], HEIC ohne Vorschau, Assistent kennt die neuen Typen nicht, WSL-Gesamtabnahme mit clamav-Image offen), PO-Fragen.

- [ ] **Step 6: Stand festhalten** – `CLAUDE.md` Abschnitt 0b neuer Block "Anlagenakte umgesetzt (<datum>)" zuoberst (Commits, Pruefstand, Einstieg naechste Sitzung, offene Punkte, PO-Sichtung steht aus); `docs/arbeitsjournal.md` Eintrag (Gelerntes, Entscheide [A] aus diesem Plan).

- [ ] **Step 7: Commit**
```bash
git add werkzeug/anlagenakte .gitignore docs/abnahme CLAUDE.md docs/arbeitsjournal.md
git commit -m "Anlagenakte T10: Browser-Abnahme Muster 6, Doku, Stand" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Selbstpruefung (gegen die Spec)

| Spec | Task |
|---|---|
| 2 Modul `dokumente`, `preisdokument` haengt ab, kein Multipart | 1, 3 |
| 3 Migration 018 (art, mime, kategorie, scan_*, seiten, ≤ 100 MB, dokument_bauteil, Altbestand) | 1 |
| 3 Quarantaene, Uebernahme, 7 Tage | 3 |
| 3 Scanner-Port, clamd, Fake/EICAR, Konfiguration, Produktion Pflicht | 3, 5 |
| 3 Bibliothek (Datenblatt, Quelle, Icon, wmz/AG/Sonstiges, `bauteil_akte.datenblatt`) | 6, 7, 9 |
| 4.1 Ablegen Seite und Anlagenkarte, mehrere Dateien | 1, 4, 8 |
| 4.2 Groesse, Magic Bytes, Typen | 2 |
| 4.3 Quarantaene, Duplikat | 1, 3 |
| 4.4 Scan max. 2, Befund + Audit, scan_fehler + Erneut pruefen, Neustart | 3 |
| 4.5 Verknuepfen nur sauber, Filter, Datenblatt-Vorschlag | 4, 7, 8 |
| 4.6 Viewer, Seite n, Office attachment, nosniff | 1, 2, 8 |
| 4.7 Rechte, 404, nicht sauber keine Bytes | 1, 3 |
| 4.8 Loeschen | 1, 3, 4 |
| 4.9 Preise lesen nur Knopf, sauberes PDF | 1, 4, 8 |
| 5 Oberflaeche | 8 |
| 6 Tests, Docker, Gestaltung, Browser-Abnahme | 1–10 |
