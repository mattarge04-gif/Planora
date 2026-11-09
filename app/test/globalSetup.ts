import EmbeddedPostgres from "embedded-postgres";
import { randomBytes } from "node:crypto";
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { TestProject } from "vitest/node";

let inst: EmbeddedPostgres;
export async function setup(project: TestProject) {
  // fileURLToPath statt URL.pathname: Repo-Pfad enthaelt Leerzeichen (%20) und unter Windows einen Laufwerksbuchstaben
  const dir = fileURLToPath(new URL("../.pgdata", import.meta.url));
  rmSync(dir, { recursive: true, force: true });
  const pw = randomBytes(18).toString("hex");
  const port = 54400;
  inst = new EmbeddedPostgres({ databaseDir: dir, user: "postgres", password: pw, port, persistent: false, onLog: () => {}, onError: () => {} });
  await inst.initialise(); await inst.start();
  project.provide("pg", { host: "localhost", port, user: "postgres", password: pw });
}
export async function teardown() { await inst?.stop(); }
declare module "vitest" { export interface ProvidedContext { pg: { host: string; port: number; user: string; password: string } } }
