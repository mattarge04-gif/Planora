import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import pg from "pg";
import { createServer } from "node:net";
import { migriere } from "../src/db/migrator.js";
import { sha } from "../src/betrieb/backup/manifest.js";
const exec=promisify(execFile);
const docker=process.env.PLANORA_DOCKER ?? (process.platform==="win32" ? "C:/Program Files/Docker/Docker/resources/bin/docker.exe" : "docker");
let ziel: string, pool: pg.Pool;
const projekt=process.env.PLANORA_TEST_PROJEKT ?? "planora-b";
const dbPort=Number(process.env.PLANORA_TEST_DBPORT ?? "25432");
let projektAngelegt=false, sperre: Awaited<ReturnType<typeof fs.open>>|undefined;
const sperrPfad=join(tmpdir(),`planora-dockertest-${projekt}.lock`);
const pw=randomBytes(24).toString("hex"), betriebPw=randomBytes(24).toString("hex"), backupPw=randomBytes(24).toString("hex");
const env={...process.env,PLANORA_TEST_PW:pw,PLANORA_TEST_RESTIC_PW:randomBytes(24).toString("hex"),PLANORA_TEST_BETRIEB_DB:`postgres://planora_betrieb:${betriebPw}@db:5432/planora`,PLANORA_TEST_BACKUP_DB:`postgres://planora_backup:${backupPw}@db:5432/planora`,PLANORA_TEST_ZIEL:"",PLANORA_TEST_RECOVERY_EMPFAENGER:""};
async function compose(...args:string[]) { return (await exec(docker,["compose","-p",projekt,"-f",resolve("test-docker/backup-umgebung.yaml"),...args],{env,maxBuffer:16*1024*1024})).stdout; }
async function werkzeug(...args:string[]) { return compose("run","--rm","--no-deps","--entrypoint",args[0],"backup",...args.slice(1)); }
describe.runIf(process.env.PLANORA_DOCKER_TEST === "b")("Backup-Container", () => {
beforeAll(async () => {
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(projekt) || !Number.isInteger(dbPort) || dbPort<1024 || dbPort>65535) throw new Error("Ungueltige Testisolation");
  sperre=await fs.open(sperrPfad,"wx",0o600);
  for (const args of [["ps","-aq"],["volume","ls","-q"],["network","ls","-q"]]) {
    const r=await exec(docker,[...args,"--filter",`label=com.docker.compose.project=${projekt}`],{env});
    if (r.stdout.trim()) throw new Error("Compose-Projekt bereits belegt; keine Ressourcen veraendert");
  }
  const portProbe=createServer();
  await new Promise<void>((resolve,reject)=>{portProbe.once("error",reject);portProbe.listen({host:"127.0.0.1",port:dbPort,exclusive:true},resolve);});
  await new Promise<void>((resolve,reject)=>portProbe.close((e)=>e?reject(e):resolve()));
  ziel=await fs.mkdtemp(join(tmpdir(),"planora-b-ziel-")); env.PLANORA_TEST_ZIEL=ziel;
  await compose("build","backup"); projektAngelegt=true; await compose("up","-d","--wait","db");
  const cfg={host:"127.0.0.1",port:dbPort,user:"postgres",password:pw,database:"planora"};
  await migriere(cfg); pool=new pg.Pool(cfg);
  const instanzId=(await pool.query("select wert from instanz_einstellung where schluessel='instanz_id'")).rows[0].wert;
  await fs.writeFile(join(ziel,"konfiguration.json"),JSON.stringify({format:1,instanzId,release:"m1-test",domain:"planora.test",tls:"internal",profil:"P1",zeitzone:"Europe/Zurich",smtp:{host:"smtp.test",port:587,absender:"planora@example.test",starttls:true}}),{mode:0o600});
  // Passwoerter pro Testlauf zufaellig; keine festen Test-Secrets im Repository.
  await pool.query(`alter role planora_betrieb login password '${betriebPw}'; alter role planora_backup login password '${backupPw}'`);
  await werkzeug("restic","init");
  await werkzeug("age-keygen","-o","/ziel/recovery.key");
  env.PLANORA_TEST_RECOVERY_EMPFAENGER=(await werkzeug("age-keygen","-y","/ziel/recovery.key")).trim();
  await fs.writeFile(join(ziel,"inventar.json"),JSON.stringify({format:1,instanzId,restic:{repository:"/ziel/restic",passwort:env.PLANORA_TEST_RESTIC_PW},zielCredentials:{},appSecrets:{auth:randomBytes(32).toString("hex")},dbRollen:{planora_app:randomBytes(24).toString("hex"),planora_betrieb:betriebPw,planora_backup:backupPw,planora_migrator:randomBytes(24).toString("hex")}}),{mode:0o600});
});
afterAll(async () => {
  try {await pool?.end();if(projektAngelegt)await compose("--profile","betrieb","down","-v");if(ziel)await fs.rm(ziel,{recursive:true,force:true});}
  finally {if(sperre){await sperre.close();await fs.rm(sperrPfad,{force:true});}}
});
it("sichert unter Minimalrollen einen echten pg_dump in restic",async () => {
  const ausgabe=await compose("run","--rm","backup","sichern","--anlass","test");
  const r=JSON.parse(ausgabe.trim().split("\n").at(-1)!);
  expect(r.zustand).toBe("geprueft");
  expect((await pool.query("select zustand from backup_lauf where id=$1",[r.backupId])).rows[0].zustand).toBe("geprueft");
  const snapshots=JSON.parse(await werkzeug("restic","snapshots","--json","--tag",r.backupId));
  expect(snapshots).toHaveLength(1);
  const rollen=await werkzeug("restic","dump",snapshots[0].id,`/staging/${r.backupId}/rollen.sql`);
  expect(rollen).not.toContain("PASSWORD");
  const konfiguration=await werkzeug("restic","dump",snapshots[0].id,`/staging/${r.backupId}/konfiguration.json`);
  expect(JSON.parse(konfiguration)).toEqual(JSON.parse(await fs.readFile(join(ziel,"konfiguration.json"),"utf8")));
  const instanz=JSON.parse(konfiguration).instanzId;
  const inventar=JSON.parse(await werkzeug("age","-d","-i","/ziel/recovery.key",`/ziel/inventar/${instanz}/${r.backupId}.age`));
  expect(inventar.restic.passwort).toBe(env.PLANORA_TEST_RESTIC_PW);
  expect((await fs.readFile(join(ziel,`inventar/${instanz}/${r.backupId}.age`))).includes(Buffer.from(env.PLANORA_TEST_RESTIC_PW))).toBe(false);
});
it("verschluesselt das Journal mit age und quittiert einzeln im echten Ziel",async()=>{
  const seq=(await pool.query("select journal_eintrag('konto.sperren','test-konto') seq")).rows[0].seq;
  await werkzeug("node","dist/betrieb/journal/cli.js","--einmal");
  const instanz=(await pool.query("select wert from instanz_einstellung where schluessel='instanz_id'")).rows[0].wert;
  const datei=`/ziel/journal/${instanz}/${seq}.age`;
  const vor=await fs.readFile(join(ziel,`journal/${instanz}/${seq}.age`));
  expect(vor.includes(Buffer.from("test-konto"))).toBe(false);
  const eintrag=JSON.parse(await werkzeug("age","-d","-i","/ziel/recovery.key",datei));
  expect(eintrag.ziel).toBe("test-konto");
  await werkzeug("node","dist/betrieb/journal/cli.js","--einmal");
  expect(await fs.readFile(join(ziel,`journal/${instanz}/${seq}.age`))).toEqual(vor);
});
it("haelt reale Dateien und Referenzwechsel waehrend pg_dump im selben Snapshot",async()=>{
  const dateien=["Dateistand vor Snapshot","Dateistand nach Snapshot"].map((inhalt)=>{
    const hash=sha(inhalt);return{inhalt,schluessel:`sha256/${hash.slice(0,2)}/${hash.slice(2,4)}/${hash}`,sha256:hash,groesse:Buffer.byteLength(inhalt)};
  });
  for(const d of dateien){
    await werkzeug("node","--input-type=module","-e",`import {mkdir,writeFile} from 'node:fs/promises';import {dirname} from 'node:path';const p='/dokumente/'+${JSON.stringify(d.schluessel)};await mkdir(dirname(p),{recursive:true});await writeFile(p,${JSON.stringify(d.inhalt)});`);
    await pool.query("insert into datei(schluessel,sha256,groesse) values($1,$2,$3)",[d.schluessel,d.sha256,d.groesse]);
  }
  await pool.query("insert into datei_referenz values($1,'snapshot-test')",[dateien[0].schluessel]);
  const blockierer=await pool.connect();let backup:Promise<string>|undefined;
  try{
    await blockierer.query("begin; lock table liegenschaft in access exclusive mode");
    backup=compose("run","--rm","backup","sichern","--anlass","paralleltest");
    // pg_dump importiert den Snapshot vor dem Tabellenlock. Der Exporter ist hier noch offen.
    let wartet=false;
    for(let i=0;i<400;i++){
      const r=await pool.query("select 1 from pg_stat_activity where application_name='pg_dump' and wait_event_type='Lock'");
      if(r.rowCount){wartet=true;break;}await new Promise((r)=>setTimeout(r,50));
    }
    expect(wartet).toBe(true);
    await pool.query("update datei_referenz set schluessel=$1 where objekt='snapshot-test'",[dateien[1].schluessel]);
    await blockierer.query("commit");
    const r=JSON.parse((await backup).trim().split("\n").at(-1)!);
    const snapshots=JSON.parse(await werkzeug("restic","snapshots","--json","--tag",r.backupId));
    const manifest=JSON.parse(await werkzeug("restic","dump",snapshots[0].id,`/staging/${r.backupId}/manifest.json`));
    expect(manifest.dateien).toEqual([{schluessel:dateien[0].schluessel,sha256:dateien[0].sha256,groesse:dateien[0].groesse}]);
    const sql=await werkzeug("node","--input-type=module","-e",`import{execFileSync as run}from'node:child_process';import{writeFileSync}from'node:fs';writeFileSync('/tmp/stand.dump',run('restic',['dump',${JSON.stringify(snapshots[0].id)},${JSON.stringify(`/staging/${r.backupId}/daten.dump`)}]));process.stdout.write(run('pg_restore',['--data-only','--table=datei_referenz','--file=-','/tmp/stand.dump']));`);
    expect(sql).toContain(dateien[0].schluessel+"\tsnapshot-test");expect(sql).not.toContain(dateien[1].schluessel+"\tsnapshot-test");
  }finally{
    await blockierer.query("rollback");blockierer.release();await backup?.catch(()=>{});
  }
});
});
