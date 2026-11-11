// M1-Abnahme Punkt 3: Retention gegen echtes restic/age/Postgres. Eigenes Projekt pa-backup, DB-Port 18405
// (PLANORA_TEST_RETENTION_PROJEKT / PLANORA_TEST_RETENTION_DBPORT). Saetze werden echt erzeugt; ihre Zeitstempel
// setzt `restic rewrite --new-time`, damit Tages-/Wochen-/Monatsbereiche ohne Wartezeit pruefbar sind.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { existsSync, promises as fs } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { backupUmgebung, letzte, type BackupUmgebung } from "./backup-hilfe.js";

const projekt = process.env.PLANORA_TEST_RETENTION_PROJEKT ?? "pa-backup";
const dbPort = Number(process.env.PLANORA_TEST_RETENTION_DBPORT ?? "18405");
const aktiv = process.env.PLANORA_DOCKER_TESTS === "1" || process.env.PLANORA_DOCKER_TEST === "b";
const POLITIK = ["-e", "PLANORA_RETENTION_TAEGLICH=2", "-e", "PLANORA_RETENTION_WOECHENTLICH=1", "-e", "PLANORA_RETENTION_MONATLICH=2"];

type Satz = { backupId: string; journalSeq: string; zeit: string };
const saetze: Satz[] = [];

describe.runIf(aktiv)("Retention (Docker, echtes restic)", () => {
  let u: BackupUmgebung;
  beforeAll(async () => {
    u = await backupUmgebung(projekt, dbPort);
    // Fuenf echte Saetze, je mit einem neuen Journal-Eintrag davor; danach Zeitstempel setzen.
    const zeiten = ["2026-08-01 03:00:00", "2026-10-05 03:00:00", "2026-11-09 03:00:00", "2026-11-10 01:00:00", "2026-11-10 03:00:00"];
    for (const zeit of zeiten) {
      await u.pool.query("select journal_eintrag('konto.sperren',$1)", [`konto-${saetze.length}`]);
      await u.werkzeug("node", "dist/betrieb/journal/cli.js", "--einmal");
      const r = letzte(await u.compose("run", "--rm", "backup", "sichern", "--anlass", "retention"));
      expect(r.zustand).toBe("geprueft");
      const snap = JSON.parse(await u.werkzeug("restic", "snapshots", "--json", "--tag", r.backupId))[0];
      const manifest = JSON.parse(await u.werkzeug("restic", "dump", snap.id, `/staging/${r.backupId}/manifest.json`));
      await u.werkzeug("restic", "rewrite", "--forget", "--new-time", zeit, snap.id);
      saetze.push({ backupId: r.backupId, journalSeq: manifest.journalSeq, zeit });
    }
    // Ein weiterer Journal-Eintrag nach dem letzten Satz: muss beim Restore nachgespielt werden.
    await u.pool.query("select journal_eintrag('konto.sperren','nach-letztem-satz')");
    await u.werkzeug("node", "dist/betrieb/journal/cli.js", "--einmal");
  });
  afterAll(async () => { await u?.aufraeumen(); });

  const inventarDa = (id: string) => existsSync(join(u.ziel, `inventar/${u.instanzId}/${id}.age`));
  const journalSeqs = async () => (await fs.readdir(join(u.ziel, `journal/${u.instanzId}`))).filter((n) => /^\d+\.age$/.test(n)).map((n) => Number(n.slice(0, -4))).sort((a, b) => a - b);

  it("vergisst und prunt nach Politik 2/1/2; Inventar, DB und Journal folgen", async () => {
    const [s1, s2, s3, s4, s5] = saetze;
    const journalVorher = await journalSeqs();
    const r = letzte(await u.compose("run", "--rm", ...POLITIK, "backup", "aufbewahren"));
    expect(r.politik).toEqual({ taeglich: 2, woechentlich: 1, monatlich: 2 });
    expect([...r.behalten].sort()).toEqual([s2, s3, s5].map((s) => s.backupId).sort());
    expect([...r.entfernt].sort()).toEqual([s1, s4].map((s) => s.backupId).sort());
    const snaps = JSON.parse(await u.werkzeug("restic", "snapshots", "--json")) as { tags: string[] }[];
    expect(snaps.map((s) => s.tags[0]).sort()).toEqual([s2, s3, s5].map((s) => s.backupId).sort());
    for (const s of [s2, s3, s5]) expect(inventarDa(s.backupId)).toBe(true);
    for (const s of [s1, s4]) expect(inventarDa(s.backupId)).toBe(false);
    const zustaende = Object.fromEntries((await u.pool.query("select id::text,zustand from backup_lauf")).rows.map((x) => [x.id, x.zustand]));
    expect([s1, s2, s3, s4, s5].map((s) => zustaende[s.backupId])).toEqual(["entfernt", "geprueft", "geprueft", "entfernt", "geprueft"]);
    expect(r.journalBis).toBe(s2.journalSeq);
    expect(await journalSeqs()).toEqual(journalVorher.filter((n) => n > Number(s2.journalSeq)));
    expect(existsSync(join(u.ziel, `journal/${u.instanzId}/stand.age`))).toBe(true);
    expect((await u.pool.query("select count(*)::int n from audit_eintrag where art in ('backup.entfernt','backup.retention')")).rows[0].n).toBe(3);
    await u.werkzeug("restic", "check");
  });
  it("zweiter Lauf ist idempotent", async () => {
    const r = letzte(await u.compose("run", "--rm", ...POLITIK, "backup", "aufbewahren"));
    expect(r).toMatchObject({ entfernt: [], inventarGeloescht: 0, journalGeloescht: 0 });
  });
  it("entfernter Satz ist nicht mehr wiederherstellbar; aeltester behaltener Satz wird samt Journal restauriert", async () => {
    const [s1, s2] = saetze;
    const letzteSeq = (await u.pool.query("select seq::text from journal_zaehler")).rows[0].seq;
    await u.pool.end(); await u.compose("--profile", "betrieb", "--profile", "recovery", "down", "-v"); await u.compose("up", "-d", "--wait", "db");
    u.pool = new pg.Pool({ host: "127.0.0.1", port: dbPort, user: "postgres", password: u.pw, database: "planora" });
    const recoveryPw = randomBytes(24).toString("hex");
    await u.pool.query(`create role planora_recovery login createrole password '${recoveryPw}'; grant pg_read_all_data to planora_recovery with admin option; alter database planora owner to planora_recovery`);
    u.env.PLANORA_TEST_ROLLEN_DB = `postgres://planora_recovery:${recoveryPw}@db:5432/planora`;
    await expect(u.compose("run", "--rm", "restore", "restore", s1.backupId, "--instanz-id", u.instanzId)).rejects.toMatchObject({ code: 1 });
    expect((await u.pool.query("select count(*)::int n from pg_tables where schemaname='public'")).rows[0].n).toBe(0);
    const r = letzte(await u.compose("run", "--rm", "restore", "restore", s2.backupId, "--instanz-id", u.instanzId));
    expect(r).toMatchObject({ backupId: s2.backupId, zustand: "gesperrt", journalSeq: letzteSeq });
  });
});
