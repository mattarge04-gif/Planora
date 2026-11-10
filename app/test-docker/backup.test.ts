import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import pg from "pg";
import { migriere } from "../src/db/migrator.js";
const exec=promisify(execFile);
const docker=process.env.PLANORA_DOCKER ?? (process.platform==="win32" ? "C:/Program Files/Docker/Docker/resources/bin/docker.exe" : "docker");
let ziel: string, pool: pg.Pool;
const pw=randomBytes(24).toString("hex"), betriebPw=randomBytes(24).toString("hex"), backupPw=randomBytes(24).toString("hex");
const env={...process.env,PLANORA_TEST_PW:pw,PLANORA_TEST_RESTIC_PW:randomBytes(24).toString("hex"),PLANORA_TEST_BETRIEB_DB:`postgres://planora_betrieb:${betriebPw}@db:5432/planora`,PLANORA_TEST_BACKUP_DB:`postgres://planora_backup:${backupPw}@db:5432/planora`,PLANORA_TEST_ZIEL:""};
async function compose(...args:string[]) { return (await exec(docker,["compose","-p","planora-b","-f",resolve("test-docker/backup-umgebung.yaml"),...args],{env,maxBuffer:16*1024*1024})).stdout; }
async function werkzeug(...args:string[]) { return compose("run","--rm","--no-deps","--entrypoint",args[0],"backup",...args.slice(1)); }
describe.runIf(process.env.PLANORA_DOCKER_TEST === "b")("Backup-Container", () => {
beforeAll(async () => {
  ziel=await fs.mkdtemp(join(tmpdir(),"planora-b-ziel-")); env.PLANORA_TEST_ZIEL=ziel;
  await compose("build","backup"); await compose("up","-d","--wait","db");
  const cfg={host:"127.0.0.1",port:25432,user:"postgres",password:pw,database:"planora"};
  await migriere(cfg); pool=new pg.Pool(cfg);
  // Passwoerter pro Testlauf zufaellig; keine festen Test-Secrets im Repository.
  await pool.query(`alter role planora_betrieb login password '${betriebPw}'; alter role planora_backup login password '${backupPw}'`);
  await werkzeug("restic","init");
});
afterAll(async () => { await pool?.end(); await compose("down","-v"); if (ziel) await fs.rm(ziel,{recursive:true,force:true}); });
it("sichert unter Minimalrollen einen echten pg_dump in restic",async () => {
  const ausgabe=await compose("run","--rm","backup","sichern","--anlass","test");
  const r=JSON.parse(ausgabe.trim().split("\n").at(-1)!);
  expect(r.zustand).toBe("geprueft");
  expect((await pool.query("select zustand from backup_lauf where id=$1",[r.backupId])).rows[0].zustand).toBe("geprueft");
  const snapshots=JSON.parse(await werkzeug("restic","snapshots","--json","--tag",r.backupId));
  expect(snapshots).toHaveLength(1);
  const rollen=await werkzeug("restic","dump",snapshots[0].id,`/staging/${r.backupId}/rollen.sql`);
  expect(rollen).not.toContain("PASSWORD");
});
});
