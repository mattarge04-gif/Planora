// Gemeinsame Wegwerf-Backup-Umgebung der M1-Abnahme-Tests (Retention, Alarm). Kein Test, nur Werkzeug.
// Nutzt test-docker/backup-umgebung.yaml unter eigenem Projektnamen; Secrets je Lauf zufaellig, nie im Repo.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomBytes } from "node:crypto";
import { existsSync, promises as fs } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import pg from "pg";
import { migriere } from "../src/db/migrator.js";

const exec = promisify(execFile);
const DOCKER_WINDOWS = "C:/Program Files/Docker/Docker/resources/bin/docker.exe";
export const DOCKER = process.env.PLANORA_DOCKER ?? (process.platform === "win32" && existsSync(DOCKER_WINDOWS) ? DOCKER_WINDOWS : "docker");
export const COMPOSE_DATEI = resolve("test-docker/backup-umgebung.yaml");
export const letzte = (t: string) => JSON.parse(t.trim().split("\n").at(-1)!);
export const dockerAus = async (args: string[], env?: NodeJS.ProcessEnv) => (await exec(DOCKER, args, { env: env ?? process.env, maxBuffer: 32 * 1024 * 1024 })).stdout;

export async function backupUmgebung(projekt: string, dbPort: number) {
  if (!/^pa-[a-z0-9-]+$/.test(projekt) || !Number.isInteger(dbPort) || dbPort < 1024) throw new Error("Ungueltige Testisolation");
  const pw = randomBytes(24).toString("hex"), betriebPw = randomBytes(24).toString("hex"), backupPw = randomBytes(24).toString("hex");
  const env: NodeJS.ProcessEnv = { ...process.env, PLANORA_TEST_PROJEKT: projekt, PLANORA_TEST_DBPORT: String(dbPort), PLANORA_TEST_PW: pw, PLANORA_TEST_RESTIC_PW: randomBytes(24).toString("hex"),
    PLANORA_TEST_BETRIEB_DB: `postgres://planora_betrieb:${betriebPw}@db:5432/planora`, PLANORA_TEST_BACKUP_DB: `postgres://planora_backup:${backupPw}@db:5432/planora`, PLANORA_TEST_ZIEL: "", PLANORA_TEST_RECOVERY_EMPFAENGER: "" };
  const compose = (...args: string[]) => dockerAus(["compose", "-p", projekt, "-f", COMPOSE_DATEI, ...args], env);
  const werkzeug = (...args: string[]) => compose("run", "--rm", "--no-deps", "--entrypoint", args[0], "restore", ...args.slice(1));
  for (const args of [["ps", "-aq"], ["volume", "ls", "-q"], ["network", "ls", "-q"]]) {
    if ((await dockerAus([...args, "--filter", `label=com.docker.compose.project=${projekt}`], env)).trim()) throw new Error(`Compose-Projekt ${projekt} bereits belegt; nichts veraendert`);
  }
  const probe = createServer();
  await new Promise<void>((ok, f) => { probe.once("error", f); probe.listen({ host: "127.0.0.1", port: dbPort, exclusive: true }, ok); });
  await new Promise<void>((ok) => probe.close(() => ok()));
  const ziel = await fs.mkdtemp(join(tmpdir(), `${projekt}-ziel-`)); env.PLANORA_TEST_ZIEL = ziel;
  const u = {
    projekt, env, ziel, compose, werkzeug, instanzId: "", pool: undefined as unknown as pg.Pool, pw,
    /** Env-Datei fuer das Host-Werkzeug (dockerAusfuehrer erbt keine PLANORA_-Variablen). */
    async envDatei(datei: string) {
      await fs.writeFile(datei, Object.entries(env).filter(([k]) => k.startsWith("PLANORA_TEST_")).map(([k, v]) => `${k}=${v}`).join("\n") + "\n", { mode: 0o600 });
      return { projekt, envDatei: datei, composeDateien: [COMPOSE_DATEI] };
    },
    async aufraeumen() {
      await u.pool?.end().catch(() => {});
      await compose("--profile", "betrieb", "--profile", "recovery", "down", "-v").catch(() => {});
      await dockerAus(["image", "rm", `${projekt}-backup:test`], env).catch(() => {});
      await fs.rm(ziel, { recursive: true, force: true });
    },
  };
  try {
    await compose("build", "backup"); await compose("up", "-d", "--wait", "db");
    const cfg = { host: "127.0.0.1", port: dbPort, user: "postgres", password: pw, database: "planora" };
    // Healthcheck ueber den Socket meldet schon den Init-Server; Docker Desktop nimmt TCP an, bevor Postgres lauscht.
    for (let n = 0; ; n++) {
      const c = new pg.Client(cfg);
      try { await c.connect(); await c.query("select 1"); break; } catch (e) { if (n >= 60) throw e; await new Promise((r) => setTimeout(r, 1000)); } finally { await c.end().catch(() => {}); }
    }
    await migriere(cfg); u.pool = new pg.Pool(cfg);
    u.instanzId = (await u.pool.query("select wert from instanz_einstellung where schluessel='instanz_id'")).rows[0].wert;
    await fs.writeFile(join(ziel, "konfiguration.json"), JSON.stringify({ format: 1, instanzId: u.instanzId, release: "m1-test", domain: "planora.test", tls: "internal", profil: "P1", zeitzone: "Europe/Zurich" }), { mode: 0o600 });
    await u.pool.query(`alter role planora_betrieb login password '${betriebPw}'; alter role planora_backup login password '${backupPw}'`);
    await werkzeug("restic", "init");
    await werkzeug("age-keygen", "-o", "/ziel/recovery.key");
    env.PLANORA_TEST_RECOVERY_EMPFAENGER = (await werkzeug("age-keygen", "-y", "/ziel/recovery.key")).trim();
    await fs.writeFile(join(ziel, "inventar.json"), JSON.stringify({ format: 1, instanzId: u.instanzId, restic: { repository: "/ziel/restic", passwort: env.PLANORA_TEST_RESTIC_PW }, zielCredentials: {}, appSecrets: { auth: randomBytes(32).toString("hex") },
      dbRollen: { planora_app: randomBytes(24).toString("hex"), planora_betrieb: betriebPw, planora_backup: backupPw, planora_migrator: randomBytes(24).toString("hex") } }), { mode: 0o600 });
  } catch (e) { await u.aufraeumen(); throw e; }
  return u;
}
export type BackupUmgebung = Awaited<ReturnType<typeof backupUmgebung>>;
