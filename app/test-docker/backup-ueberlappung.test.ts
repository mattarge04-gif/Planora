// PP11a-1: Retention darf das Journal nicht unter die Untergrenze einer noch laufenden Sicherung kuerzen.
// Sicherung A wird nach dem Export ihres Snapshots (Journal-Sequenz fest) angehalten; danach entstehen
// Journal-Eintraege und eine vollstaendige Sicherung B; die Retention laeuft. A wird fortgesetzt und muss sich
// samt Journal in eine frische DB restaurieren lassen. Projekt pa-ueberlapp, DB-Port 18408.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import pg from "pg";
import { backupUmgebung, dockerAus, letzte, type BackupUmgebung } from "./backup-hilfe.js";

const projekt = process.env.PLANORA_TEST_UEBERLAPP_PROJEKT ?? "pa-ueberlapp";
const dbPort = Number(process.env.PLANORA_TEST_UEBERLAPP_DBPORT ?? "18408");
const aktiv = process.env.PLANORA_DOCKER_TESTS === "1" || process.env.PLANORA_DOCKER_TEST === "b";
const POLITIK = ["-e", "PLANORA_RETENTION_TAEGLICH=1", "-e", "PLANORA_RETENTION_WOECHENTLICH=0", "-e", "PLANORA_RETENTION_MONATLICH=0"];
const A = `${projekt}-a`;

describe.runIf(aktiv)("Retention mit ueberlappender Sicherung (Docker)", () => {
  let u: BackupUmgebung;
  beforeAll(async () => { u = await backupUmgebung(projekt, dbPort); });
  afterAll(async () => { await dockerAus(["rm", "-f", A]).catch(() => {}); await u?.aufraeumen(); });

  it("laufende Sicherung A verhindert die Journal-Kuerzung; A wird spaeter vollstaendig restauriert", async () => {
    const journal = () => u.werkzeug("node", "dist/betrieb/journal/cli.js", "--einmal");
    await u.pool.query("select journal_eintrag('konto.sperren','vor-a')"); await journal();
    letzte(await u.compose("run", "--rm", "backup", "sichern", "--anlass", "s0"));
    // A blockieren, bis ihr pg_dump wartet (Snapshot und Journal-Sequenz sind dann fest), dann anhalten.
    const blocker = await u.pool.connect();
    let a: Promise<string> | undefined;
    try {
      await blocker.query("begin; lock table liegenschaft in access exclusive mode");
      a = u.compose("run", "--rm", "--name", A, "backup", "sichern", "--anlass", "a");
      a.catch(() => {});
      let wartet = false;
      for (let n = 0; n < 400 && !wartet; n++) {
        wartet = !!(await u.pool.query("select 1 from pg_stat_activity where application_name='pg_dump' and wait_event_type='Lock'")).rowCount;
        if (!wartet) await new Promise((r) => setTimeout(r, 50));
      }
      expect(wartet).toBe(true);
      await dockerAus(["pause", A]);
      await blocker.query("rollback");
    } finally { blocker.release(); }
    const idA = (await u.pool.query("select id::text from backup_lauf where zustand='laufend'")).rows[0].id as string;
    // Neue Journal-Eintraege und eine vollstaendige Sicherung B mit hoeherer Sequenz.
    for (const z of ["nach-a-1", "nach-a-2"]) await u.pool.query("select journal_eintrag('konto.sperren',$1)", [z]);
    await journal();
    const b = letzte(await u.compose("run", "--rm", "backup", "sichern", "--anlass", "b"));
    expect(b.zustand).toBe("geprueft");
    const r1 = letzte(await u.compose("run", "--rm", ...POLITIK, "backup", "aufbewahren"));
    expect(r1).toMatchObject({ offeneSaetze: 1, journalBis: null, journalGeloescht: 0 });
    // A fortsetzen und abschliessen.
    await dockerAus(["unpause", A]);
    expect(letzte(await a!)).toMatchObject({ backupId: idA, zustand: "geprueft" });
    const r2 = letzte(await u.compose("run", "--rm", ...POLITIK, "backup", "aufbewahren"));
    expect(r2.behalten).toContain(idA);
    expect(r2.journalBis).not.toBeNull();
    // Restore von A in eine frische DB: braucht alle Journal-Eintraege nach A's Sequenz.
    const letzteSeq = (await u.pool.query("select seq::text from journal_zaehler")).rows[0].seq;
    await u.pool.end(); await u.compose("--profile", "betrieb", "--profile", "recovery", "down", "-v"); await u.compose("up", "-d", "--wait", "db");
    u.pool = new pg.Pool({ host: "127.0.0.1", port: dbPort, user: "postgres", password: u.pw, database: "planora" });
    for (let n = 0; ; n++) { try { await u.pool.query("select 1"); break; } catch (e) { if (n > 60) throw e; await new Promise((r) => setTimeout(r, 1000)); } }
    const recoveryPw = randomBytes(24).toString("hex");
    await u.pool.query(`create role planora_recovery login createrole password '${recoveryPw}'; grant pg_read_all_data to planora_recovery with admin option; alter database planora owner to planora_recovery`);
    u.env.PLANORA_TEST_ROLLEN_DB = `postgres://planora_recovery:${recoveryPw}@db:5432/planora`;
    const r = letzte(await u.compose("run", "--rm", "restore", "restore", idA, "--instanz-id", u.instanzId));
    expect(r).toMatchObject({ backupId: idA, zustand: "gesperrt", journalSeq: letzteSeq });
  });
});
