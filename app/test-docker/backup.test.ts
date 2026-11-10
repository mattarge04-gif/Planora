import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomBytes, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import pg from "pg";
import { createServer } from "node:net";
import { migriere } from "../src/db/migrator.js";
import { sha } from "../src/betrieb/backup/manifest.js";
import { erzeugeSetupToken, loeseSetupTokenEin } from "../src/auth/setup.js";
import { setzeKontoStatus } from "../src/auth/sitzung.js";
import { freigabe, loeseFreigabeTokenEin } from "../src/betrieb/freigabe.js";
import { baueAuth } from "../src/auth/auth.js";
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
async function werkzeug(...args:string[]) { return compose("run","--rm","--no-deps","--entrypoint",args[0],"restore",...args.slice(1)); }
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
  try {await pool?.end();if(projektAngelegt)await compose("--profile","betrieb","--profile","recovery","down","-v");if(ziel)await fs.rm(ziel,{recursive:true,force:true});}
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
it("reconciliert einen hart beendeten Backup-Container und startet danach erneut",async()=>{
  const blockierer=await pool.connect(),name=`${projekt}-crash`;let lauf:Promise<string>|undefined;
  try{
    await blockierer.query("begin;lock table liegenschaft in access exclusive mode");
    const vorher=(await pool.query("select id from backup_lauf")).rows.map((r)=>r.id);
    lauf=compose("run","--rm","--name",name,"backup","sichern","--anlass","crashtest");
    // Rejection sofort behandeln; ausgewertet wird sie nach dem gezielten Kill.
    const ausgang=lauf.then(()=>0,(e:unknown)=>(e as{code:number}).code);
    let wartet=false;
    for(let i=0;i<400;i++){
      if((await pool.query("select 1 from pg_stat_activity where application_name='pg_dump' and wait_event_type='Lock'")).rowCount){wartet=true;break;}
      await new Promise((r)=>setTimeout(r,50));
    }
    expect(wartet).toBe(true);
    const label=(await exec(docker,["inspect","--format",'{{index .Config.Labels "com.docker.compose.project"}}',name],{env})).stdout.trim();expect(label).toBe(projekt);
    await exec(docker,["kill",name],{env});expect(await ausgang).not.toBe(0);
    await blockierer.query("rollback");
    const abgestuerzt=(await pool.query("select id,zustand from backup_lauf where not(id=any($1::uuid[]))",[vorher])).rows;
    expect(abgestuerzt).toHaveLength(1);expect(abgestuerzt[0].zustand).toBe("laufend");
    await pool.query("update backup_lauf set heartbeat=now()-interval '11 minutes' where id=$1",[abgestuerzt[0].id]);
    const aktiv=(await exec(docker,["ps","-q","--filter",`label=com.docker.compose.project=${projekt}`,"--filter","label=com.docker.compose.service=backup"],{env})).stdout;
    expect(aktiv.trim()).toBe("");
    const r=JSON.parse((await compose("run","--rm","backup","reconcile","--container-laeuft","false")).trim().split("\n").at(-1)!);expect(r.fehlgeschlagen).toBe(1);
    expect(JSON.parse((await compose("run","--rm","backup","sichern","--anlass","wiederanlauf")).trim().split("\n").at(-1)!).zustand).toBe("geprueft");
  }finally{await blockierer.query("rollback");blockierer.release();await lauf?.catch(()=>{});}
});
it("ersetzt die VM, sperrt bei Restore-Fehlern und gibt nur bestaetigte Admins frei",async()=>{
  const inventar=JSON.parse(await fs.readFile(join(ziel,"inventar.json"),"utf8"));
  await pool.query("create role planora_migrator nologin");
  const passwort=randomBytes(18).toString("hex");
  const admin=(await loeseSetupTokenEin(pool,await erzeugeSetupToken(pool),"admin@planora.test","Admin",passwort)).benutzerId;
  const leser=(await loeseSetupTokenEin(pool,await erzeugeSetupToken(pool),"leser@planora.test","Leser",passwort)).benutzerId;
  await pool.query("update rolle_zuordnung set rolle='leser' where benutzer_id=$1",[leser]);
  await pool.query("insert into session(id,user_id,token,created_at,updated_at,expires_at) values($1,$2,$3,now(),now(),now()+interval '1 hour')",[randomUUID(),admin,randomBytes(24).toString("hex")]);
  await pool.query("insert into verification values($1,'test','test',now()+interval '1 hour',now(),now())",[randomUUID()]);
  await erzeugeSetupToken(pool);
  await pool.query("update account set access_token='test-oauth',refresh_token='test-oauth',id_token='test-oauth'");
  await werkzeug("node","dist/betrieb/journal/cli.js","--einmal");
  const r=JSON.parse((await compose("run","--rm","backup","sichern","--anlass","restoretest")).trim().split("\n").at(-1)!);
  const snapshots=JSON.parse(await werkzeug("restic","snapshots","--json","--tag",r.backupId));
  const manifest=JSON.parse(await werkzeug("restic","dump",snapshots[0].id,`/staging/${r.backupId}/manifest.json`));
  const audit=(await pool.query("select audit_id from konto_status where benutzer_id=$1",[admin])).rows[0].audit_id;
  await setzeKontoStatus(pool,leser,"gesperrt",audit);
  await werkzeug("node","dist/betrieb/journal/cli.js","--einmal");
  const seq=(await pool.query("select seq from journal_zaehler")).rows[0].seq;
  expect(BigInt(seq)).toBeGreaterThan(BigInt(manifest.journalSeq));
  await pool.end();await compose("--profile","betrieb","--profile","recovery","down","-v");await compose("up","-d","--wait","db");
  pool=new pg.Pool({host:"127.0.0.1",port:dbPort,user:"postgres",password:pw,database:"planora"});
  const recoveryPw=randomBytes(24).toString("hex");
  await pool.query(`create role planora_recovery login createrole password '${recoveryPw}'; grant pg_read_all_data to planora_recovery with admin option; alter database planora owner to planora_recovery`);
  Object.assign(env,{PLANORA_TEST_ROLLEN_DB:`postgres://planora_recovery:${recoveryPw}@db:5432/planora`});
  const restoreArgs=["restore",r.backupId,"--instanz-id",inventar.instanzId];
  const frisch=async()=>expect((await pool.query("select count(*)::int n from pg_tables where schemaname='public'")).rows[0].n).toBe(0);
  await expect(compose("run","--rm","backup","restore",r.backupId,"--instanz-id",randomUUID())).rejects.toMatchObject({code:1});await frisch();
  const inventarPfad=join(ziel,`inventar/${inventar.instanzId}/${r.backupId}.age`),inventarDaten=await fs.readFile(inventarPfad);
  try{await fs.unlink(inventarPfad);await expect(compose("run","--rm","backup",...restoreArgs)).rejects.toMatchObject({code:1});await frisch();}finally{await fs.writeFile(inventarPfad,inventarDaten);}
  const journalPfad=join(ziel,`journal/${inventar.instanzId}/${seq}.age`),journalDaten=await fs.readFile(journalPfad);
  try{await fs.unlink(journalPfad);await expect(compose("run","--rm","backup",...restoreArgs)).rejects.toMatchObject({code:1});await frisch();}finally{await fs.writeFile(journalPfad,journalDaten);}
  try{await fs.writeFile(journalPfad,"nicht lesbar");await expect(compose("run","--rm","backup",...restoreArgs)).rejects.toMatchObject({code:1});await frisch();}finally{await fs.writeFile(journalPfad,journalDaten);}
  // Prozessport des echten Restores: eine nach restic restore fehlende Datei
  // darf nie bis zum SQL-Import kommen (keine Produkt-Testschalter).
  const fehlt=manifest.dateien[0].schluessel;
  await expect(werkzeug("node","--input-type=module","-e",`import{restoreCli}from'./dist/betrieb/restore/cli.js';import{prozess}from'./dist/betrieb/backup/prozess.js';import{unlink}from'node:fs/promises';const lauf=async(a)=>{const x=await prozess(a);if(a.programm==='restic'&&a.args[0]==='restore')await unlink(a.args[a.args.indexOf('--target')+1]+'/dokumente/'+${JSON.stringify(fehlt)});return x};try{await restoreCli(${JSON.stringify(restoreArgs.slice(1))},lauf)}catch{process.exitCode=1}`)).rejects.toMatchObject({code:1});await frisch();
  const restauriert=JSON.parse((await compose("run","--rm","restore",...restoreArgs)).trim().split("\n").at(-1)!);
  expect(restauriert.zustand).toBe("gesperrt");
  expect((await pool.query("select distinct status from konto_status")).rows).toEqual([{status:"zu_bestaetigen"}]);
  for(const t of ["session","verification","setup_token"])expect((await pool.query(`select count(*)::int n from ${t}`)).rows[0].n).toBe(0);
  expect((await pool.query("select 1 from backup_lauf where zustand='laufend'")).rowCount).toBe(0);
  expect((await pool.query("select 1 from account where access_token is not null or refresh_token is not null or id_token is not null")).rowCount).toBe(0);
  expect((await pool.query("select sperre_seq from restore_konto where benutzer_id=$1",[leser])).rows[0].sperre_seq).toBe(seq);
  for(const d of manifest.dateien){const hash=(await werkzeug("node","--input-type=module","-e",`import{readFileSync}from'node:fs';import{createHash}from'node:crypto';console.log(createHash('sha256').update(readFileSync('/dokumente/'+${JSON.stringify(d.schluessel)})).digest('hex'));`)).trim();expect(hash).toBe(d.sha256);}
  const betrieb=new pg.Pool({host:"127.0.0.1",port:dbPort,user:"planora_betrieb",password:inventar.dbRollen.planora_betrieb,database:"planora"});
  const appPool=new pg.Pool({host:"127.0.0.1",port:dbPort,user:"planora_app",password:inventar.dbRollen.planora_app,database:"planora"});
  try{
    const auth=baueAuth(appPool,{baseURL:"http://localhost:3999",secret:inventar.appSecrets.auth});
    const login=(email:string,password:string)=>auth.handler(new Request("http://localhost:3999/api/auth/sign-in/email",{method:"POST",headers:{"content-type":"application/json",origin:"http://localhost:3999"},body:JSON.stringify({email,password})}));
    expect((await login("admin@planora.test",passwort)).status).toBe(401);
    expect((await login("leser@planora.test",passwort)).status).toBe(401);
    const tokens=await freigabe(betrieb,{zeige:(u)=>{expect(u.journal?.stand_seq).toBe(seq);expect(u.konten.find((k)=>k.benutzerId===leser)?.sperreSeq).toBe(seq);},bestaetige:async(k)=>k.benutzerId===admin});
    expect(tokens).toHaveLength(1);const neu=randomBytes(18).toString("hex");
    await loeseFreigabeTokenEin(betrieb,tokens[0].token,neu);
    expect((await login("admin@planora.test",neu)).status).toBe(200);
    expect((await login("leser@planora.test",passwort)).status).toBe(401);
  }finally{await appPool.end();await betrieb.end();}
});
});
