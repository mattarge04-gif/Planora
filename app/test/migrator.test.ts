import { describe, it, expect } from "vitest";
import pg from "pg";
import { inject } from "vitest";
import { randomBytes } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migriere } from "../src/db/migrator.js";

async function leereDb() {
  const basis = inject("pg"); const name = "m_" + randomBytes(6).toString("hex");
  const a = new pg.Client({ ...basis, database: "postgres" }); await a.connect(); await a.query(`create database ${name}`); await a.end();
  return { ...basis, database: name };
}

describe("migrator", () => {
  it("wendet jede Migration genau einmal an und fuehrt Journal", async () => {
    const cfg = await leereDb();
    const dir = mkdtempSync(join(tmpdir(), "mig-"));
    writeFileSync(join(dir, "001_a.sql"), "create table a(x int);");
    const r1 = await migriere(cfg, dir);
    const r2 = await migriere(cfg, dir);
    expect(r1.angewendet).toEqual(["001_a.sql"]);
    expect(r2.angewendet).toEqual([]);
  });
  it("bricht ab, wenn eine angewendete Migration veraendert wurde", async () => {
    const cfg = await leereDb();
    const dir = mkdtempSync(join(tmpdir(), "mig-"));
    writeFileSync(join(dir, "001_a.sql"), "create table a(x int);");
    await migriere(cfg, dir);
    writeFileSync(join(dir, "001_a.sql"), "create table a(y int);");
    await expect(migriere(cfg, dir)).rejects.toThrow(/Pruefsumme/);
  });
  it("zwei parallele Laeufe wenden nichts doppelt an (Advisory-Lock)", async () => {
    const cfg = await leereDb();
    const dir = mkdtempSync(join(tmpdir(), "mig-"));
    writeFileSync(join(dir, "001_a.sql"), "create table a(x int); select pg_sleep(0.5);");
    const [x, y] = await Promise.all([migriere(cfg, dir), migriere(cfg, dir)]);
    expect([...x.angewendet, ...y.angewendet]).toEqual(["001_a.sql"]);
  });
});
