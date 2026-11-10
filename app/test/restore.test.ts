import { it, expect, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { restore, type RestoreOptionen } from "../src/betrieb/restore/restore.js";
import { lokalesZiel } from "../src/betrieb/backup/ziel.js";
import { sichereInventar, type Schluesselinventar } from "../src/betrieb/backup/inventar.js";
import { sha, type Manifest } from "../src/betrieb/backup/manifest.js";
import { MANIFEST_VERSION } from "../src/module/manifest.js";
const ordner:string[]=[];afterEach(async()=>{for(const p of ordner.splice(0))await fs.rm(p,{recursive:true,force:true});});
async function umgebung(){
  const dir=await fs.mkdtemp(join(tmpdir(),"planora-restore-"));ordner.push(dir);
  const backupId=randomUUID(),instanzId=randomUUID(),satzPfad=`/staging/${backupId}`,ziel=lokalesZiel(join(dir,"ziel"));
  const pw=randomBytes(24).toString("hex"),i:Schluesselinventar={format:1,instanzId,restic:{repository:"test",passwort:pw},zielCredentials:{},appSecrets:{auth:pw},dbRollen:{planora_app:pw,planora_betrieb:pw,planora_backup:pw,planora_migrator:pw}};
  const enc=async(d:Buffer)=>Buffer.from(d.toString("base64")),dec=async(d:Buffer)=>Buffer.from(d.toString(),"base64");
  await sichereInventar(i,backupId,ziel,enc);
  const inhalt="Unveraenderliche Dokumentdatei",hash=sha(inhalt),schluessel=`sha256/${hash.slice(0,2)}/${hash.slice(2,4)}/${hash}`;
  const dateien=new Map<string,Buffer>([[`dokumente/${schluessel}`,Buffer.from(inhalt)],["daten.dump",Buffer.from("dump")],["rollen.sql",Buffer.from("rollen")],["konfiguration.json",Buffer.from(JSON.stringify({format:1,instanzId,release:"test",domain:"planora.test",tls:"internal",profil:"P1",zeitzone:"Europe/Zurich"}))]]);
  const manifest:Manifest={format:1,backupId,instanzId,release:"test",modulVersion:MANIFEST_VERSION,schema:[],journalSeq:"10",anlass:"test",satzPfad,dateien:[{schluessel,sha256:hash,groesse:Buffer.byteLength(inhalt)}],bestandteile:[...dateien].filter(([k])=>!k.startsWith("dokumente/")).map(([k,d])=>({schluessel:k,sha256:sha(d),groesse:d.length}))};
  await ziel.schreibe(`journal/${instanzId}/stand.age`,await enc(Buffer.from(JSON.stringify({instanzId,letzteQuittierteSeq:"11",zeit:new Date().toISOString()}))),false);
  await ziel.schreibe(`journal/${instanzId}/11.age`,await enc(Buffer.from(JSON.stringify({instanzId,seq:"11",art:"konto.sperren",ziel:"leser",zeit:new Date().toISOString()}))),true);
  const aufrufe:string[]=[];let importiert=false,bereit=false,defekt=false;
  const o:RestoreOptionen={backupId,instanzId,ziel,entschluesseln:dec,staging:join(dir,"staging"),dokumente:join(dir,"dokumente"),release:"test",schema:[],umgebung:{
    pruefeFrischesZiel:async()=>{aufrufe.push("zielpruefung");},rollen:async()=>{aufrufe.push("rollen");},importiere:async()=>{importiert=true;aufrufe.push("import+kontosperre");},journal:async(e)=>{aufrufe.push("journal:"+e.seq);},konfiguration:async()=>{aufrufe.push("konfiguration");},bereit:async()=>{bereit=true;aufrufe.push("bereit");},
  },lauf:async(a)=>{
    const manifestJson=JSON.stringify(manifest);
    if(a.args[0]==="snapshots")return{code:0,stdout:JSON.stringify([{id:"a".repeat(64),tags:[backupId],paths:[satzPfad]}])};
    if(a.args[0]==="dump")return{code:0,stdout:manifestJson};
    if(a.args[0]==="ls")return{code:0,stdout:[...dateien].map(([k,d])=>JSON.stringify({type:"file",path:`${satzPfad}/${k}`,size:d.length})).concat(JSON.stringify({type:"file",path:`${satzPfad}/manifest.json`,size:Buffer.byteLength(manifestJson)})).join("\n")};
    if(a.args[0]==="restore"){
      const p=a.args[a.args.indexOf("--target")+1];
      for(const[k,d]of dateien){const datei=join(p,k);await fs.mkdir(dirname(datei),{recursive:true});await fs.writeFile(datei,defekt&&k==="daten.dump"?"beschaedigt":d);}
      await fs.writeFile(join(p,"manifest.json"),manifestJson);
    }return{code:0,stdout:""};
  }};
  return{o,dir,manifest,dateien,schluessel,aufrufe,importiert:()=>importiert,bereit:()=>bereit,beschaedige:()=>{defekt=true;}};
}
it("prueft vollstaendig vor dem Import, restauriert Dateien und spielt das Journal nach",async()=>{
  const u=await umgebung();expect((await restore(u.o)).zustand).toBe("gesperrt");
  expect(u.aufrufe).toEqual(["zielpruefung","rollen","import+kontosperre","journal:11","konfiguration","bereit"]);
  expect(sha(await fs.readFile(join(u.o.dokumente,u.schluessel)))).toBe(u.manifest.dateien[0].sha256);
});
it.each(["instanz","inventar","release","hash","datei","luecke","unlesbar"])("verhindert jeden Import bei %s-Fehler",async(fehler)=>{
  const u=await umgebung();
  if(fehler==="instanz")u.o.instanzId=randomUUID();
  if(fehler==="inventar")await fs.unlink(join(u.dir,"ziel",`inventar/${u.o.instanzId}/${u.o.backupId}.age`));
  if(fehler==="release")u.o.release="fremd";
  if(fehler==="hash")u.beschaedige();
  if(fehler==="datei")u.dateien.delete(`dokumente/${u.schluessel}`);
  if(fehler==="luecke")await fs.unlink(join(u.dir,"ziel",`journal/${u.o.instanzId}/11.age`));
  if(fehler==="unlesbar")await u.o.ziel.schreibe(`journal/${u.o.instanzId}/11.age`,Buffer.from("kaputt"),false);
  await expect(restore(u.o)).rejects.toThrow();expect(u.importiert()).toBe(false);expect(u.bereit()).toBe(false);
});
it("bleibt nach einem Replay-Fehler mit gesperrten Konten stehen",async()=>{
  const u=await umgebung();u.o.umgebung.journal=async()=>{throw new Error("Unbekannte Art");};
  await expect(restore(u.o)).rejects.toThrow(/Unbekannte/);expect(u.importiert()).toBe(true);expect(u.bereit()).toBe(false);
});
