import pg from "pg";
import { inject } from "vitest";
import { randomBytes } from "node:crypto";
import { migriere } from "../src/db/migrator.js";

export async function frischeDb() {
  const basis = inject("pg");
  const name = "t_" + randomBytes(6).toString("hex");
  const admin = new pg.Client({ ...basis, database: "postgres" });
  await admin.connect(); await admin.query(`create database ${name}`); await admin.end();
  const cfg = { ...basis, database: name };
  await migriere(cfg);
  const pool = new pg.Pool(cfg);
  return { cfg, pool, async ende() { await pool.end(); } };
}
