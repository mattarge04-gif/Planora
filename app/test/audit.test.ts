import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { frischeDb } from "./hilfe.js";
import { neuerPool } from "../src/db/pool.js";
import { auditEreignis } from "../src/audit/audit.js";
import { randomUUID } from "node:crypto";

let db: Awaited<ReturnType<typeof frischeDb>>;
beforeAll(async () => { db = await frischeDb(); });
afterAll(async () => { await db.ende(); });

describe("audit", () => {
  it("planora_app schreibt ueber die Funktion, aber kann nicht aendern oder loeschen", async () => {
    const app = neuerPool(db.cfg, "planora_app");
    const c = await app.connect();
    try {
      await auditEreignis(c, randomUUID(), "test.ereignis", { a: 1 });
      expect((await db.pool.query("select count(*)::int n from audit_eintrag")).rows[0].n).toBe(1);
      await expect(c.query("update audit_eintrag set art='x'")).rejects.toThrow(/permission denied/);
      await expect(c.query("delete from audit_eintrag")).rejects.toThrow(/permission denied/);
      await expect(c.query("insert into audit_eintrag(art) values ('x')")).rejects.toThrow(/permission denied/);
    } finally { c.release(); await app.end(); }
  });
  it("Eintraege tragen nur die audit_id; Zuordnung ist separat loeschbar", async () => {
    const aid = randomUUID();
    await db.pool.query("insert into audit_person(audit_id, benutzer_id) values ($1,'u1')", [aid]);
    const c = await db.pool.connect();
    try { await auditEreignis(c, aid, "login.ok"); } finally { c.release(); }
    const spalten = (await db.pool.query("select column_name from information_schema.columns where table_name='audit_eintrag'")).rows.map((r) => r.column_name);
    expect(spalten).not.toContain("benutzer_id");
    await db.pool.query("delete from audit_person where audit_id=$1", [aid]);
    expect((await db.pool.query("select count(*)::int n from audit_eintrag where audit_id=$1", [aid])).rows[0].n).toBe(1);
  });
});
