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
    const sql = "insert into bauteil_akte(bauteil_id, liegenschaft_id, zustand, lebensdauer_jahre, stueckpreis, quelle_preis) values ($1,$2,$3,$4,$5,$6)";
    await expect(q(sql, [B1, L1, "super", null, null, null])).rejects.toThrow(/check/);
    await expect(q(sql, [B1, L1, null, 0, null, null])).rejects.toThrow(/check/);
    await expect(q(sql, [B1, L1, null, null, -1, "kunde"])).rejects.toThrow(/check/);
    await expect(q(sql, [B1, L2, null, null, null, null])).rejects.toThrow(/foreign key/);
    await expect(q(sql, [B1, L1, "schlecht", 25, 1200.5, "kunde"])).resolves.toBeDefined();
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
