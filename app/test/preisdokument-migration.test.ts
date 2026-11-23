import { describe, it, expect, beforeAll } from "vitest";
import { frischeDb } from "./hilfe.js";
let db: Awaited<ReturnType<typeof frischeDb>>;
beforeAll(async () => { db = await frischeDb(); });
describe("Migration 017", () => {
  it("legt dokument und preis_vorschlag an", async () => {
    const t = (await db.pool.query("select table_name from information_schema.tables where table_name in ('dokument','preis_vorschlag') order by 1")).rows.map((r) => r.table_name);
    expect(t).toEqual(["dokument", "preis_vorschlag"]);
  });
  it("Quelle dokument verlangt Verweis, kunde verbietet ihn", async () => {
    const c = (await db.pool.query("select conname from pg_constraint where conname in ('bauteil_akte_vorschlag_quelle','lebensdauer_typ_vorschlag_quelle')")).rows;
    expect(c).toHaveLength(2);
  });
  it("Restore-Sperre schaltet preisdokument aus", async () => {
    await db.pool.query("insert into modul_schalter(modul_id, aktiv) values ('preisdokument', true) on conflict (modul_id) do update set aktiv=true");
    await db.pool.query("insert into instanz_einstellung values('restore_gesperrt','true'::jsonb) on conflict(schluessel) do update set wert='true'::jsonb");
    expect((await db.pool.query("select aktiv from modul_schalter where modul_id='preisdokument'")).rows[0].aktiv).toBe(false);
    await db.pool.query("delete from instanz_einstellung where schluessel='restore_gesperrt'");
  });
});
