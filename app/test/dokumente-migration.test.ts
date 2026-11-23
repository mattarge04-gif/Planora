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
/** Fuegt ein Dokument ein; Overrides ersetzen die Defaults je Spalte (sonst "column specified more than once"). */
const neu = (p: Record<string, unknown> = {}) => {
  const werte: Record<string, unknown> = { gebaeude_id: G, liegenschaft_id: L, dateiname: "n.pdf", schluessel: "k", sha256: randomUUID(),
    groesse: 10, seiten: 1, hochgeladen_von: randomUUID(), ...p };
  const spalten = Object.keys(werte);
  return q(`insert into dokument(${spalten.join(", ")}) values (${spalten.map((_, i) => `$${i + 1}`).join(",")}) returning *`, Object.values(werte));
};

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
