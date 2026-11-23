import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { frischeDb } from "./hilfe.js";
import { dateiAblage, speichereUndReferenziere } from "../src/ablage/ablage.js";
import { erzeugeLaeufer } from "../src/preisdokument/laeufer.js";
import { legeDokumentAn } from "../src/preisdokument/speicher.js";
import { fakeAdapter } from "../src/preisdokument/fake.js";

// Regression: KI-Antworten enthalten Zeichen ausserhalb von WIN1252 (Minus U+2212, Emoji). Der eingebettete Windows-Cluster
// war WIN1252 und lehnte den Insert ab; Cluster sind jetzt UTF8 (initdbFlags in globalSetup.ts und entwicklung/start.ts).
const TEXT = "Preis − 10 % → € 1’200.00 😀 ü";
let db: Awaited<ReturnType<typeof frischeDb>>;
let G: string, L: string;
beforeAll(async () => {
  db = await frischeDb();
  const q = async (s: string, p: unknown[]) => (await db.pool.query(s, p)).rows[0].id as string;
  L = await q("insert into liegenschaft(name) values ('L') returning id", []);
  G = await q("insert into gebaeude(liegenschaft_id,name,grundform,breite_m,tiefe_m,regelwerk_version) values ($1,'H','quader',30,15,2) returning id", [L]);
});
afterAll(async () => { await db.ende(); });

describe("Zeichensatz", () => {
  it("Datenbank ist UTF8", async () => {
    expect((await db.pool.query("select pg_encoding_to_char(encoding) e from pg_database where datname=current_database()")).rows[0].e).toBe("UTF8");
  });
  it("Vorschlag mit Minus, Euro, Apostroph und Emoji wird gespeichert und unveraendert gelesen", async () => {
    const a = dateiAblage(mkdtempSync(join(tmpdir(), "ablage-")));
    const d = await speichereUndReferenziere(db.pool, a, Readable.from(Buffer.from(`%PDF-1.7\n${randomBytes(8).toString("hex")}\n%%EOF`)), `dokument:${randomUUID()}`);
    const { id } = await legeDokumentAn(db.pool, { gebaeudeId: G, liegenschaftId: L, dateiname: "o.pdf", schluessel: d.schluessel, sha256: d.sha256, groesse: d.groesse, seiten: 1, von: randomUUID(), status: "neu" });
    const l = erzeugeLaeufer(db.pool, a, fakeAdapter(() => ({ vorschlaege: [{ position: TEXT, seite: 1, zitat: TEXT, materialNetto: null, rabattText: TEXT,
      montageAnteil: null, ersatzpreis: 10, rechenweg: TEXT, katalogId: null, bauteilIds: [], sicherheit: "tief" }] })));
    l.starte(id); await l.warteLeer();
    expect((await db.pool.query("select auslesen_status s from dokument where id=$1", [id])).rows[0].s).toBe("fertig");
    const r = (await db.pool.query("select position, zitat, rabatt_text, rechenweg from preis_vorschlag where dokument_id=$1", [id])).rows[0];
    expect(r).toEqual({ position: TEXT, zitat: TEXT, rabatt_text: TEXT, rechenweg: TEXT });
  });
});
