import { expect, it, vi } from "vitest";
import pg from "pg";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { frischeDb } from "./hilfe.js";
import { restoreVerbindung } from "../src/betrieb/restore/verbindung.js";
import { datenbankUmgebung } from "../src/betrieb/restore/datenbank.js";
import type { Manifest } from "../src/betrieb/backup/manifest.js";
import type { Schluesselinventar } from "../src/betrieb/backup/inventar.js";
import * as datenbank from "../src/betrieb/restore/datenbank.js";
import { restoreCli } from "../src/betrieb/restore/cli.js";

it.each(["require", "verify-full"])("verliert sslmode=%s am CLI-Uebergang nicht",async(modus)=>{
  const werte={PLANORA_RESTORE_DB:`postgres://planora_migrator@localhost/planora?sslmode=${modus}`,PLANORA_ROLLEN_DB:"postgres://recovery@localhost/planora",PLANORA_RESTORE_KONFIGURATION_PFAD:"/ausgabe/konfiguration.json",PLANORA_RESTORE_INVENTAR_PFAD:"/ausgabe/inventar.json"};
  const alt=Object.fromEntries(Object.keys(werte).map(k=>[k,process.env[k]]));
  const ende=new Error("TLS-Konfiguration erfasst");
  const factory=vi.spyOn(datenbank,"datenbankUmgebung").mockImplementation((o)=>{
    expect(o.pgEnv?.PGSSLMODE).toBe(modus);
    expect(o.zielDb.ssl).toMatchObject({rejectUnauthorized:modus==="verify-full"});
    throw ende;
  });
  try {
    Object.assign(process.env,werte);
    await expect(restoreCli(["11111111-1111-4111-8111-111111111111","--instanz-id","22222222-2222-4222-8222-222222222222"])).rejects.toBe(ende);
  }finally{factory.mockRestore();for(const[k,v]of Object.entries(alt)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
});

it.each(["require", "verify-full"])("erhaelt sslmode=%s bis zum psql-Import", async (modus) => {
  const v = restoreVerbindung(new URL(`postgres://planora_migrator@localhost/planora?sslmode=${modus}`));
  const dir = await mkdtemp(join(tmpdir(), "restore-tls-"));
  const client = vi.spyOn(pg, "Client").mockImplementation(function(cfg) {
    expect(cfg).toMatchObject({ ssl: v.zielDb.ssl });
    return { connect: async()=>{}, query: async()=>({rows:[{rolsuper:false}]}), end: async()=>{} } as unknown as pg.Client;
  });
  let psql = false;
  const db = datenbankUmgebung({ rollenDb: {}, ...v, konfigurationDatei: "ungenutzt", inventarDatei: "ungenutzt", lauf: async(a)=>{
    if(a.programm==="pg_restore") await writeFile(a.args[a.args.indexOf("--file")+1],"-- Testdump");
    if(a.programm==="psql") { psql=true; expect(a.env?.PGSSLMODE).toBe(modus); }
    return {code:0,stdout:""};
  }});
  try {
    await db.umgebung.importiere({dbRollen:{planora_migrator:"wegwerf"}} as Schluesselinventar,{instanzId:"11111111-1111-4111-8111-111111111111",backupId:"22222222-2222-4222-8222-222222222222",journalSeq:"0"} as Manifest,dir);
    expect(psql).toBe(true);
    expect(v.zielDb.ssl).toMatchObject({rejectUnauthorized:modus==="verify-full"});
  } finally { client.mockRestore(); await db.ende(); await rm(dir,{recursive:true,force:true}); }
});

it.each(["require", "verify-full"])("faellt bei sslmode=%s nicht auf eine unverschluesselte DB zurueck", async(modus)=>{
  const db=await frischeDb();
  const v=restoreVerbindung(new URL(`postgres://planora_migrator@${db.cfg.host}:${db.cfg.port}/${db.cfg.database}?sslmode=${modus}`));
  const c=new pg.Client({...db.cfg,ssl:v.zielDb.ssl,connectionTimeoutMillis:2000});
  try {
    expect((await db.pool.query("show ssl")).rows[0].ssl).toBe("off");
    await expect(c.connect()).rejects.toThrow(/SSL/);
  } finally { await c.end(); await db.ende(); }
});
