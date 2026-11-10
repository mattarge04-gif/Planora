import { beforeAll, afterAll, afterEach, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import { Readable } from "node:stream";
import { frischeDb } from "./hilfe.js";
import { dateiAblage, speichereUndReferenziere } from "../src/ablage/ablage.js";
import { sichern } from "../src/betrieb/backup/satz.js";
import type { Prozess } from "../src/betrieb/backup/prozess.js";
import { snapshotAbgleichen, type Manifest } from "../src/betrieb/backup/manifest.js";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
let db: Awaited<ReturnType<typeof frischeDb>>, betrieb: pg.Pool;
const ordner: string[] = [];
beforeAll(async () => { db = await frischeDb(); betrieb = new pg.Pool({ ...db.cfg, options: "-c role=planora_betrieb" }); });
afterAll(async () => { await betrieb.end(); await db.ende(); });
afterEach(async () => { await db.pool.query("truncate datei_referenz,datei,backup_lauf"); for (const p of ordner.splice(0)) await fs.rm(p,{recursive:true,force:true}); });
async function umgebung(fehler?: string, manipulation = false) {
  const basis = await fs.mkdtemp(join(tmpdir(),"planora-satz-")); ordner.push(basis);
  const dokumente = join(basis,"dokumente"); await fs.mkdir(dokumente);
  const datei = await speichereUndReferenziere(db.pool,dateiAblage(dokumente),Readable.from(["alt"]),"fachlich");
  const aufrufe: string[] = []; let manifest: Manifest | undefined;
  const lauf: Prozess = async (a) => {
    const schritt = a.programm === "restic" ? a.args[0] : a.programm;
    aufrufe.push(schritt);
    if (schritt === fehler) return { code: 3, stdout: "" };
    if (schritt === "pg_dump") {
      // Der exportierte Snapshot ist noch importierbar und ignoriert parallele Mutationen.
      await db.pool.query("delete from datei_referenz");
      const c = new pg.Client(db.cfg); await c.connect();
      try {
        await c.query("begin isolation level repeatable read");
        const id = a.args.find((s) => s.startsWith("--snapshot="))!.slice(11);
        await c.query(`set transaction snapshot '${id}'`);
        expect((await c.query("select count(*)::int n from datei_referenz")).rows[0].n).toBe(1);
      } finally { await c.end(); }
    }
    if (a.programm.startsWith("pg_dump")) await fs.writeFile(a.args[a.args.indexOf("--file")+1],"dump-ohne-passwort");
    if (schritt === "backup") {
      manifest = JSON.parse(await fs.readFile(join(a.args.at(-1)!,"manifest.json"),"utf8"));
      return { code:0, stdout:JSON.stringify({message_type:"summary",snapshot_id:"a".repeat(64)}) };
    }
    if (schritt === "ls") {
      const m = manifest!;
      const dateien = [
        ...m.dateien.map((d) => ({type:"file",path:`${m.satzPfad}/dokumente/${d.schluessel}`,size:d.groesse})),
        ...m.bestandteile.map((d) => ({type:"file",path:`${m.satzPfad}/${d.schluessel}`,size:d.groesse})),
        {type:"file",path:`${m.satzPfad}/manifest.json`},
      ];
      if (manipulation) dateien.pop();
      return {code:0,stdout:dateien.map((d) => JSON.stringify(d)).join("\n")};
    }
    return { code:0,stdout:"" };
  };
  return { basis, datei, aufrufe, manifest: () => manifest, optionen: { betrieb, backupDb: {...db.cfg,options:"-c role=planora_backup"}, pgEnv:{},resticEnv:{},dokumente,staging:join(basis,"staging"),release:"m1-test",konfiguration:{},anlass:"test",lauf } };
}
it("sichert Manifest und Dump im gleichen Snapshot unter Minimalrollen", async () => {
  const u = await umgebung(); const r = await sichern(u.optionen);
  expect(r.zustand).toBe("geprueft");
  expect(u.aufrufe).toEqual(["pg_dump","pg_dumpall","backup","ls","check"]);
  expect(u.manifest()!.dateien).toEqual([u.datei]);
  expect((await db.pool.query("select zustand from backup_lauf where id=$1",[r.backupId])).rows[0].zustand).toBe("geprueft");
  expect(await fs.readdir(u.optionen.staging)).toEqual([]);
});
it.each(["pg_dump","pg_dumpall","backup","ls","check"])("prueft Exitcode von %s und meldet den Satz fehlgeschlagen", async (fehler) => {
  const u=await umgebung(fehler); await expect(sichern(u.optionen)).rejects.toThrow(/Exitcode 3/);
  expect((await db.pool.query("select zustand from backup_lauf")).rows[0].zustand).toBe("fehlgeschlagen");
});
it("verweigert unvollstaendigen restic-Inhalt", async () => {
  const u=await umgebung(undefined,true); await expect(sichern(u.optionen)).rejects.toThrow(/unvollstaendig/);
});
it("verweigert fehlende und veraenderte Manifest-Dateien", async () => {
  for (const fehlt of [true,false]) {
    const u=await umgebung(); const p=join(u.optionen.dokumente,u.datei.schluessel);
    if (fehlt) { await fs.chmod(p,0o600); await fs.unlink(p); } else { await fs.chmod(p,0o600); await fs.writeFile(p,"geaendert"); }
    await expect(sichern(u.optionen)).rejects.toThrow();
  }
});
it.each([["2026-11-01T00:00:00Z","--read-data"],["2026-11-02T00:00:00Z","--read-data-subset=5%"]])("liest am %s die vorgesehenen Repository-Daten",async(zeit,option)=>{
  const u=await umgebung();const original=u.optionen.lauf;let args:string[]=[];
  u.optionen.lauf=async(a)=>{if(a.programm==="restic"&&a.args[0]==="check")args=a.args;return original(a);};
  await sichern({...u.optionen,jetzt:()=>new Date(zeit)});
  expect(args).toEqual(["check",option]);
});
it("meldet Exporter-Verlust waehrend pg_dump fehlgeschlagen",async()=>{
  const u=await umgebung();const original=u.optionen.lauf;
  u.optionen.lauf=async(a)=>{
    if(a.programm==="pg_dump"){
      await db.pool.query("select pg_terminate_backend(pid) from pg_stat_activity where application_name='planora-test-exporter'");
      await new Promise((r)=>setTimeout(r,10));return{code:0,stdout:""};
    }return original(a);
  };
  await expect(sichern({...u.optionen,backupDb:{...u.optionen.backupDb,application_name:"planora-test-exporter"}})).rejects.toThrow();
  expect((await db.pool.query("select zustand from backup_lauf")).rows[0].zustand).toBe("fehlgeschlagen");
});
it("bricht bei Heartbeat-Verlust ab und kann danach neu starten",async()=>{
  const u=await umgebung();const original=u.optionen.lauf;
  u.optionen.lauf=async(a)=>{const r=await original(a);if(a.programm==="pg_dump")await new Promise((r)=>setTimeout(r,25));return r;};
  const kaputt={query:async(sql:string,werte:unknown[])=>{if(sql.includes("backup_lauf_heartbeat"))throw new Error("Steuerverbindung weg");return betrieb.query(sql,werte);}} as unknown as pg.Pool;
  await expect(sichern({...u.optionen,betrieb:kaputt,heartbeatMs:5})).rejects.toThrow(/Heartbeat/);
  const neu=await umgebung();expect((await sichern(neu.optionen)).zustand).toBe("geprueft");
});
it("wartet beim Registrieren auf den exklusiven GC-Lock",async()=>{
  const u=await umgebung(),c=await db.pool.connect();let lauf:Promise<unknown>|undefined;
  try{
    await c.query("select pg_advisory_lock(7310002)");lauf=sichern(u.optionen);
    let wartet=false;
    for(let i=0;i<100;i++){
      if((await db.pool.query("select 1 from pg_locks where locktype='advisory' and objid=7310002 and not granted")).rowCount){wartet=true;break;}
      await new Promise((r)=>setTimeout(r,5));
    }
    expect(wartet).toBe(true);expect(u.aufrufe).toEqual([]);
    expect((await db.pool.query("select count(*)::int n from backup_lauf")).rows[0].n).toBe(0);
  }finally{await c.query("select pg_advisory_unlock(7310002)");c.release();await lauf;}
});
it.each(["groesse","doppelt","zusaetzlich"])("verweigert restic-ls-Abweichung %s",async(art)=>{
  const u=await umgebung();await sichern(u.optionen);const m=u.manifest()!;
  const dateien=[...m.dateien.map((d)=>({type:"file",path:`${m.satzPfad}/dokumente/${d.schluessel}`,size:d.groesse})),...m.bestandteile.map((d)=>({type:"file",path:`${m.satzPfad}/${d.schluessel}`,size:d.groesse})),{type:"file",path:`${m.satzPfad}/manifest.json`,size:1}];
  if(art==="groesse")dateien[0].size++;else if(art==="doppelt")dateien.push(dateien[0]);else dateien.push({type:"file",path:"/fremd",size:1});
  expect(()=>snapshotAbgleichen(dateien.map((d)=>JSON.stringify(d)).join("\n"),m)).toThrow();
});
it("liefert bei CLI-Fehler Exit ungleich Null und kein Erfolgs-JSON",async()=>{
  try{await promisify(execFile)(process.execPath,["--import","tsx","src/betrieb/backup/cli.ts","ungueltig"]);throw new Error("CLI erfolgreich");}
  catch(e){const r=e as {code:number;stdout:string;stderr:string};expect(r.code).toBe(1);expect(r.stdout).not.toContain('"zustand":"geprueft"');expect(r.stderr).toContain("fehlgeschlagen");}
});
