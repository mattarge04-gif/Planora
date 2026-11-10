import pg from "pg";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { hashPasswort } from "../auth/auth.js";
import { sha } from "./backup/manifest.js";
import { geheimnis } from "./backup/umgebung.js";
export type Uebersicht={journal:{zustand:string;stand_seq:string|null;stand_zeit:string|null}|null;konten:{benutzerId:string;name:string;email:string;rolle:string|null;status:string;vorherStatus:string;sperreSeq:string|null;scopes:string[]}[]};
export async function freigabe(pool:pg.Pool,konsole:{zeige:(u:Uebersicht)=>void;bestaetige:(konto:Uebersicht["konten"][number])=>Promise<boolean>}){
  const u=(await pool.query("select freigabe_uebersicht() daten")).rows[0].daten as Uebersicht;
  if(!u.journal||!["bereit","freigegeben"].includes(u.journal.zustand))throw new Error("Restore nicht vollstaendig geprueft");
  konsole.zeige(u);const tokens:{benutzerId:string;token:string}[]=[];
  for(const konto of u.konten.filter((k)=>k.rolle==="admin"&&k.status==="zu_bestaetigen")){
    if(!await konsole.bestaetige(konto))continue;
    const token=randomBytes(24).toString("base64url");
    await pool.query("select freigabe_erzeugen($1,$2)",[konto.benutzerId,sha(token)]);
    tokens.push({benutzerId:konto.benutzerId,token});
  }return tokens;
}
/** Ausschliesslich Host-Konsole; SMTP-Reset ist ein anderer Pfad und aktiviert kein Konto. */
export async function loeseFreigabeTokenEin(pool:pg.Pool,token:string,passwort:string){
  if(passwort.length<12)throw new Error("Passwort muss mindestens 12 Zeichen haben");
  return(await pool.query("select freigabe_einloesen($1,$2) benutzer",[sha(token),await hashPasswort(passwort)])).rows[0].benutzer as string;
}
/** Aufrufer gibt die ID aus dem geprueften Sitzungskontext weiter; SQL prueft
 * aktive Adminrolle und abgeschlossene Host-Freigabe erneut in der Transaktion. */
export async function bestaetigeRestoreKonto(pool:pg.Pool,adminId:string,benutzerId:string){
  await pool.query("select restore_konto_bestaetigen($1,$2)",[adminId,benutzerId]);
}
async function geheimFragen(text:string){
  if(!process.stdin.isTTY||!process.stdout.isTTY)throw new Error("Freigabe-Einloesung verlangt eine lokale interaktive Konsole");
  process.stdout.write(text);process.stdin.setRawMode(true);process.stdin.resume();let wert="";
  return new Promise<string>((resolve,reject)=>{
    const ende=()=>{process.stdin.removeListener("data",lesen);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write("\n");};
    const lesen=(d:Buffer)=>{for(const c of d.toString()){if(c==="\r"||c==="\n"){ende();resolve(wert);return;}if(c==="\u0003"){ende();reject(new Error("Abgebrochen"));return;}if(c==="\u007f"||c==="\b")wert=wert.slice(0,-1);else if(c>=" ")wert+=c;}};
    process.stdin.on("data",lesen);
  });
}
export async function freigabeCli(args:string[]){
  const pool=new pg.Pool({connectionString:await geheimnis("PLANORA_BETRIEB_DB")});
  try{
    if(args.length===1&&args[0]==="--einloesen"){
      const token=await geheimFragen("Einmal-Token: "),passwort=await geheimFragen("Neues Passwort (mindestens 12 Zeichen): ");
      await loeseFreigabeTokenEin(pool,token,passwort);console.log("Admin freigegeben; Anmeldung mit neuem Passwort moeglich");
    }else if(args.length===0){
      if(!process.stdin.isTTY||!process.stdout.isTTY)throw new Error("Freigabe verlangt lokale interaktive Host-Konsole");
      const rl=createInterface({input:process.stdin,output:process.stdout});
      try{
        const tokens=await freigabe(pool,{zeige:(u)=>console.log(JSON.stringify(u,null,2)),bestaetige:async(k)=>(await rl.question(`Admin ${k.email} bestaetigen (vorher ${k.vorherStatus}, Sperrjournal ${k.sperreSeq??"keines"})? ja/NEIN: `))==="ja"});
        for(const t of tokens)console.log(JSON.stringify(t));
      }finally{rl.close();}
    }else throw new Error("Aufruf: freigabe [--einloesen]");
  }finally{await pool.end();}
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])freigabeCli(process.argv.slice(2)).catch(()=>{console.error("Freigabe fehlgeschlagen");process.exitCode=1;});
