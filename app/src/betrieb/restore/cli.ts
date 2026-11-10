import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { geheimnis, zielAusUmgebung } from "../backup/umgebung.js";
import { ageEntschluesseln } from "../journal/age.js";
import { sha } from "../backup/manifest.js";
import { restore } from "./restore.js";
import { datenbankUmgebung } from "./datenbank.js";
import type { Prozess } from "../backup/prozess.js";
export async function aktuellesSchema(){
  const dir=fileURLToPath(new URL("../../db/migrationen/",import.meta.url));
  const namen=(await readdir(dir)).filter((n)=>n.endsWith(".sql")).sort();
  return Promise.all(namen.map(async(name)=>({name,pruefsumme:sha(await readFile(join(dir,name)))})));
}
export async function restoreCli(args:string[],lauf?:Prozess){
  if(args.length!==3||args[1]!=="--instanz-id")throw new Error("Aufruf: restore <backup-id> --instanz-id <uuid>");
  const url=new URL(await geheimnis("PLANORA_RESTORE_DB"));
  if(decodeURIComponent(url.username)!=="planora_migrator")throw new Error("Restore-Import verlangt planora_migrator");
  const db=datenbankUmgebung({rollenDb:{connectionString:await geheimnis("PLANORA_ROLLEN_DB")},zielDb:{host:url.hostname,port:Number(url.port||5432),database:decodeURIComponent(url.pathname.slice(1)),...(process.env.PLANORA_RESTORE_OWNER === "planora_owner" ? {options:"-c role=planora_owner"} : {})},konfigurationDatei:await geheimnis("PLANORA_RESTORE_KONFIGURATION_PFAD"),inventarDatei:await geheimnis("PLANORA_RESTORE_INVENTAR_PFAD"),lauf});
  try{
    const r=await restore({backupId:args[0],instanzId:args[2],ziel:await zielAusUmgebung(),entschluesseln:ageEntschluesseln(await geheimnis("PLANORA_RECOVERY_KEY_PFAD")),staging:process.env.PLANORA_STAGING??"/staging",dokumente:process.env.PLANORA_DOKUMENTE??"/dokumente",release:await geheimnis("PLANORA_RELEASE"),schema:await aktuellesSchema(),umgebung:db.umgebung,lauf});
    console.log(JSON.stringify(r));
  }finally{await db.ende();}
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])restoreCli(process.argv.slice(2)).catch(()=>{console.error("Restore fehlgeschlagen; Freigabe bleibt gesperrt");process.exitCode=1;});
