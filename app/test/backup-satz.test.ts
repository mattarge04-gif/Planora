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
import type { Manifest } from "../src/betrieb/backup/manifest.js";
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
