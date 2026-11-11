// M1-Abnahme Punkt 3: Retention gegen echtes restic/age/Postgres. Eigenes Projekt pa-backup, DB-Port 18405
// (PLANORA_TEST_RETENTION_PROJEKT / PLANORA_TEST_RETENTION_DBPORT). Saetze werden echt erzeugt; ihre Zeitstempel
// setzt `restic rewrite --new-time`, damit Tages-/Wochen-/Monatsbereiche ohne Wartezeit pruefbar sind.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
const docker = process.env.PLANORA_DOCKER ?? (process.platform === "win32" && existsSync(DOCKER_WINDOWS) ? DOCKER_WINDOWS : "docker");
const projekt = process.env.PLANORA_TEST_RETENTION_PROJEKT ?? "pa-backup";
const dbPort = Number(process.env.PLANORA_TEST_RETENTION_DBPORT ?? "18405");
const aktiv = process.env.PLANORA_DOCKER_TESTS === "1" || process.env.PLANORA_DOCKER_TEST === "b";

const pw = randomBytes(24).toString("hex"), betriebPw = randomBytes(24).toString("hex"), backupPw = randomBytes(24).toString("hex");
const env: NodeJS.ProcessEnv = { ...process.env, PLANORA_TEST_PROJEKT: projekt, PLANORA_TEST_DBPORT: String(dbPort), PLANORA_TEST_PW: pw, PLANORA_TEST_RESTIC_PW: randomBytes(24).toString("hex"),
  PLANORA_TEST_BETRIEB_DB: `postgres://planora_betrieb:${betriebPw}@db:5432/planora`, PLANORA_TEST_BACKUP_DB: `postgres://planora_backup:${backupPw}@db:5432/planora`, PLANORA_TEST_ZIEL: "", PLANORA_TEST_RECOVERY_EMPFAENGER: "" };
let ziel = "", pool: pg.Pool, angelegt = false, instanzId = "";
const compose = async (...args: string[]) => (await exec(docker, ["compose", "-p", projekt, "-f", resolve("test-docker/backup-umgebung.yaml"), ...args], { env, maxBuffer: 32 * 1024 * 1024 })).stdout;
const werkzeug = (...args: string[]) => compose("run", "--rm", "--no-deps", "--entrypoint", args[0], "restore", ...args.slice(1));
const letzte = (t: string) => JSON.parse(t.trim().split("\n").at(-1)!);
const POLITIK = ["-e", "PLANORA_RETENTION_TAEGLICH=2", "-e", "PLANORA_RETENTION_WOECHENTLICH=1", "-e", "PLANORA_RETENTION_MONATLICH=2"];

type Satz = { backupId: string; journalSeq: string; zeit: string };
const saetze: Satz[] = [];

describe.runIf(aktiv)("Retention (Docker, echtes restic)", () => {
  beforeAll(async () => {
    if (!/^pa-[a-z0-9-]+$/.test(projekt) || !Number.isInteger(dbPort) || dbPort < 1024) throw new Error("Ungueltige Testisolation");
    for (const args of [["ps", "-aq"], ["volume", "ls", "-q"], ["network", "ls", "-q"]]) {
      if ((await exec(docker, [...args, "--filter", `label=com.docker.compose.project=${projekt}`], { env })).stdout.trim()) throw new Error(`Compose-Projekt ${projekt} bereits belegt; nichts veraendert`);
    }
    const probe = createServer();
    await new Promise<void>((ok, f) => { probe.once("error", f); probe.listen({ host: "127.0.0.1", port: dbPort, exclusive: true }, ok); });
    await new Promise<void>((ok) => probe.close(() => ok()));
    ziel = await fs.mkdtemp(join(tmpdir(), `${projekt}-ziel-`)); env.PLANORA_TEST_ZIEL = ziel;
    angelegt = true;
    await compose("build", "backup"); await compose("up", "-d", "--wait", "db");
    const cfg = { host: "127.0.0.1", port: dbPort, user: "postgres", password: pw, database: "planora" };
    await migriere(cfg); pool = new pg.Pool(cfg);
    instanzId = (await pool.query("select wert from instanz_einstellung where schluessel='instanz_id'")).rows[0].wert;
    await fs.writeFile(join(ziel, "konfiguration.json"), JSON.stringify({ format: 1, instanzId, release: "m1-test", domain: "planora.test", tls: "internal", profil: "P1", zeitzone: "Europe/Zurich" }), { mode: 0o600 });
    await pool.query(`alter role planora_betrieb login password '${betriebPw}'; alter role planora_backup login password '${backupPw}'`);
    await werkzeug("restic", "init");
    await werkzeug("age-keygen", "-o", "/ziel/recovery.key");
    env.PLANORA_TEST_RECOVERY_EMPFAENGER = (await werkzeug("age-keygen", "-y", "/ziel/recovery.key")).trim();
    await fs.writeFile(join(ziel, "inventar.json"), JSON.stringify({ format: 1, instanzId, restic: { repository: "/ziel/restic", passwort: env.PLANORA_TEST_RESTIC_PW }, zielCredentials: {}, appSecrets: { auth: randomBytes(32).toString("hex") },
      dbRollen: { planora_app: randomBytes(24).toString("hex"), planora_betrieb: betriebPw, planora_backup: backupPw, planora_migrator: randomBytes(24).toString("hex") } }), { mode: 0o600 });
    // Fuenf echte Saetze, je mit einem neuen Journal-Eintrag davor; danach Zeitstempel setzen.
    const zeiten = ["2026-08-01 03:00:00", "2026-10-05 03:00:00", "2026-11-09 03:00:00", "2026-11-10 01:00:00", "2026-11-10 03:00:00"];
    for (const zeit of zeiten) {
      await pool.query("select journal_eintrag('konto.sperren',$1)", [`konto-${saetze.length}`]);
      await werkzeug("node", "dist/betrieb/journal/cli.js", "--einmal");
      const r = letzte(await compose("run", "--rm", "backup", "sichern", "--anlass", "retention"));
      expect(r.zustand).toBe("geprueft");
      const snap = JSON.parse(await werkzeug("restic", "snapshots", "--json", "--tag", r.backupId))[0];
      const manifest = JSON.parse(await werkzeug("restic", "dump", snap.id, `/staging/${r.backupId}/manifest.json`));
      await werkzeug("restic", "rewrite", "--forget", "--new-time", zeit, snap.id);
      saetze.push({ backupId: r.backupId, journalSeq: manifest.journalSeq, zeit });
    }
    // Ein weiterer Journal-Eintrag nach dem letzten Satz: muss beim Restore nachgespielt werden.
    await pool.query("select journal_eintrag('konto.sperren','nach-letztem-satz')");
    await werkzeug("node", "dist/betrieb/journal/cli.js", "--einmal");
  });
  afterAll(async () => {
    await pool?.end();
    if (angelegt) {
      await compose("--profile", "betrieb", "--profile", "recovery", "down", "-v").catch(() => {});
      await exec(docker, ["image", "rm", `${projekt}-backup:test`], { env }).catch(() => {});
    }
    if (ziel) await fs.rm(ziel, { recursive: true, force: true });
  });

  const inventarDa = (id: string) => existsSync(join(ziel, `inventar/${instanzId}/${id}.age`));
  const journalSeqs = async () => (await fs.readdir(join(ziel, `journal/${instanzId}`))).filter((n) => /^\d+\.age$/.test(n)).map((n) => Number(n.slice(0, -4))).sort((a, b) => a - b);

  it("vergisst und prunt nach Politik 2/1/2; Inventar, DB und Journal folgen", async () => {
    const [s1, s2, s3, s4, s5] = saetze;
    const journalVorher = await journalSeqs();
    const r = letzte(await compose("run", "--rm", ...POLITIK, "backup", "aufbewahren"));
    expect(r.politik).toEqual({ taeglich: 2, woechentlich: 1, monatlich: 2 });
    expect([...r.behalten].sort()).toEqual([s2, s3, s5].map((s) => s.backupId).sort());
    expect([...r.entfernt].sort()).toEqual([s1, s4].map((s) => s.backupId).sort());
    const snaps = JSON.parse(await werkzeug("restic", "snapshots", "--json")) as { tags: string[] }[];
    expect(snaps.map((s) => s.tags[0]).sort()).toEqual([s2, s3, s5].map((s) => s.backupId).sort());
    for (const s of [s2, s3, s5]) expect(inventarDa(s.backupId)).toBe(true);
    for (const s of [s1, s4]) expect(inventarDa(s.backupId)).toBe(false);
    const zustaende = Object.fromEntries((await pool.query("select id::text,zustand from backup_lauf")).rows.map((x) => [x.id, x.zustand]));
    expect([s1, s2, s3, s4, s5].map((s) => zustaende[s.backupId])).toEqual(["entfernt", "geprueft", "geprueft", "entfernt", "geprueft"]);
    expect(r.journalBis).toBe(s2.journalSeq);
    expect(await journalSeqs()).toEqual(journalVorher.filter((n) => n > Number(s2.journalSeq)));
    expect(existsSync(join(ziel, `journal/${instanzId}/stand.age`))).toBe(true);
    expect((await pool.query("select count(*)::int n from audit_eintrag where art in ('backup.entfernt','backup.retention')")).rows[0].n).toBe(3);
    await werkzeug("restic", "check");
  });
  it("zweiter Lauf ist idempotent", async () => {
    const r = letzte(await compose("run", "--rm", ...POLITIK, "backup", "aufbewahren"));
    expect(r).toMatchObject({ entfernt: [], inventarGeloescht: 0, journalGeloescht: 0 });
  });
  it("entfernter Satz ist nicht mehr wiederherstellbar; aeltester behaltener Satz wird samt Journal restauriert", async () => {
    const [s1, s2] = saetze;
    const letzteSeq = (await pool.query("select seq::text from journal_zaehler")).rows[0].seq;
    await pool.query("create role planora_migrator nologin").catch(() => {});
    await pool.end(); await compose("--profile", "betrieb", "--profile", "recovery", "down", "-v"); await compose("up", "-d", "--wait", "db");
    pool = new pg.Pool({ host: "127.0.0.1", port: dbPort, user: "postgres", password: pw, database: "planora" });
    const recoveryPw = randomBytes(24).toString("hex");
    await pool.query(`create role planora_recovery login createrole password '${recoveryPw}'; grant pg_read_all_data to planora_recovery with admin option; alter database planora owner to planora_recovery`);
    env.PLANORA_TEST_ROLLEN_DB = `postgres://planora_recovery:${recoveryPw}@db:5432/planora`;
    await expect(compose("run", "--rm", "restore", "restore", s1.backupId, "--instanz-id", instanzId)).rejects.toMatchObject({ code: 1 });
    expect((await pool.query("select count(*)::int n from pg_tables where schemaname='public'")).rows[0].n).toBe(0);
    const r = letzte(await compose("run", "--rm", "restore", "restore", s2.backupId, "--instanz-id", instanzId));
    expect(r).toMatchObject({ backupId: s2.backupId, zustand: "gesperrt", journalSeq: letzteSeq });
  });
});
