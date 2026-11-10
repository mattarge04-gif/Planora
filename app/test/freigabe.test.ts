import { afterAll, expect, it } from "vitest";
import pg from "pg";
import { randomBytes, randomUUID } from "node:crypto";
import { frischeDb } from "./hilfe.js";
import { erzeugeSetupToken, loeseSetupTokenEin } from "../src/auth/setup.js";
import { bestaetigeRestoreKonto, freigabe, loeseFreigabeTokenEin } from "../src/betrieb/freigabe.js";
import { baueAuth } from "../src/auth/auth.js";
import { sha } from "../src/betrieb/backup/manifest.js";
const schliessen:(()=>Promise<void>)[]=[];
afterAll(async()=>{for(const f of schliessen)await f();});
async function umgebung(bereit=true){
  const db=await frischeDb(),betrieb=new pg.Pool({...db.cfg,options:"-c role=planora_betrieb"});
  schliessen.push(async()=>{await betrieb.end();await db.ende();});
  const pw=randomBytes(16).toString("hex"),admin=(await loeseSetupTokenEin(db.pool,await erzeugeSetupToken(db.pool),randomUUID()+"@test.ch","Admin",pw)).benutzerId;
  const leser=(await loeseSetupTokenEin(db.pool,await erzeugeSetupToken(db.pool),randomUUID()+"@test.ch","Leser",pw)).benutzerId;
  await db.pool.query("update rolle_zuordnung set rolle='leser' where benutzer_id=$1",[leser]);
  const seq=(await db.pool.query("select seq from journal_zaehler")).rows[0].seq;
  const instanz=(await db.pool.query("select wert from instanz_einstellung where schluessel='instanz_id'")).rows[0].wert;
  await betrieb.query("select restore_sperren($1,$2,$3)",[instanz,randomUUID(),seq]);
  if(bereit)await betrieb.query("select restore_bereit($1,now())",[seq]);
  return{db,betrieb,admin,leser,pw,seq,instanz};
}
it("sperrt alle Konten und erlaubt Freigabe erst nach vollstaendiger Pruefung",async()=>{
  const u=await umgebung(false);let gezeigt=false;
  await expect(freigabe(u.betrieb,{zeige:()=>{gezeigt=true;},bestaetige:async()=>true})).rejects.toThrow(/nicht vollstaendig/);
  expect(gezeigt).toBe(false);
  expect((await u.db.pool.query("select distinct status from konto_status")).rows).toEqual([{status:"zu_bestaetigen"}]);
  expect((await u.db.pool.query("select count(*)::int n from setup_token")).rows[0].n).toBe(0);
});
it("fragt je Admin, zeigt Scope/Journal-Lage und speichert nur Tokenhash mit 15 Minuten",async()=>{
  const u=await umgebung();let gefragt=0,gezeigt=false;
  expect(await freigabe(u.betrieb,{zeige:()=>{},bestaetige:async()=>false})).toEqual([]);
  const tokens=await freigabe(u.betrieb,{zeige:(v)=>{gezeigt=true;expect(v.konten).toHaveLength(2);expect(v.journal?.stand_seq).toBe(u.seq);},bestaetige:async(k)=>{gefragt++;expect(k.benutzerId).toBe(u.admin);return true;}});
  expect(gezeigt).toBe(true);expect(gefragt).toBe(1);expect(tokens).toHaveLength(1);
  const gespeichert=(await u.db.pool.query("select hash,extract(epoch from gueltig_bis-now())::int sekunden from freigabe_token")).rows[0];
  expect(gespeichert.hash).toBe(sha(tokens[0].token));expect(gespeichert.sekunden).toBeGreaterThan(890);expect(gespeichert.sekunden).toBeLessThanOrEqual(900);
  const neu=randomBytes(16).toString("hex");expect(await loeseFreigabeTokenEin(u.betrieb,tokens[0].token,neu)).toBe(u.admin);
  await expect(loeseFreigabeTokenEin(u.betrieb,tokens[0].token,neu)).rejects.toThrow(/Token/);
  expect((await u.db.pool.query("select status from konto_status where benutzer_id=$1",[u.leser])).rows[0].status).toBe("zu_bestaetigen");
  expect(JSON.stringify((await u.db.pool.query("select * from audit_eintrag")).rows)).not.toContain(tokens[0].token);
});
it("weist abgelaufene Tokens und App-Zugriff auf Host-Freigabe zurueck",async()=>{
  const u=await umgebung(),app=new pg.Pool({...u.db.cfg,options:"-c role=planora_app"});
  try{await expect(app.query("select freigabe_uebersicht()")).rejects.toThrow(/permission denied/);}finally{await app.end();}
  const [token]=await freigabe(u.betrieb,{zeige:()=>{},bestaetige:async()=>true});
  await u.db.pool.query("update freigabe_token set gueltig_bis=now()-interval '1 second'");
  await expect(loeseFreigabeTokenEin(u.betrieb,token.token,randomBytes(16).toString("hex"))).rejects.toThrow(/abgelaufen/);
});
it("SMTP-Passwortreset hebt die Restore-Sperre nicht auf",async()=>{
  const u=await umgebung();let resetUrl="";
  const auth=baueAuth(u.db.pool,{baseURL:"http://localhost:3999",secret:randomBytes(32).toString("hex"),sendeReset:async(_mail,url)=>{resetUrl=url;}});
  const email=(await u.db.pool.query('select email from "user" where id=$1',[u.admin])).rows[0].email;
  const post=(pfad:string,body:unknown)=>auth.handler(new Request(`http://localhost:3999/api/auth/${pfad}`,{method:"POST",headers:{"content-type":"application/json",origin:"http://localhost:3999"},body:JSON.stringify(body)}));
  expect((await post("request-password-reset",{email})).status).toBe(200);
  expect(resetUrl).not.toBe("");const token=new URL(resetUrl).pathname.split("/").at(-1)!;
  const neu=randomBytes(16).toString("hex");expect((await post("reset-password",{newPassword:neu,token})).status).toBe(200);
  expect((await post("sign-in/email",{email,password:neu})).status).toBe(401);
  expect((await u.db.pool.query("select status from konto_status where benutzer_id=$1",[u.admin])).rows[0].status).toBe("zu_bestaetigen");
});
it("spielt Sperren/Entzuege lueckenlos nach und laesst unbekannte Arten gesperrt",async()=>{
  const u=await umgebung(false);let seq=BigInt(u.seq);
  await expect(u.betrieb.query("select restore_journal($1,'konto.sperren',$2,now())",[(seq+2n).toString(),u.leser])).rejects.toThrow(/Luecke/);
  await u.betrieb.query("select restore_journal($1,'konto.sperren',$2,now())",[(++seq).toString(),u.leser]);
  await u.betrieb.query("select restore_journal($1,'rolle.entziehen',$2,now())",[(++seq).toString(),JSON.stringify({benutzerId:u.leser,rolle:"admin"})]);
  expect((await u.db.pool.query("select rolle from rolle_zuordnung where benutzer_id=$1",[u.leser])).rows[0].rolle).toBe("leser");
  await u.betrieb.query("select restore_journal($1,'rolle.entziehen',$2,now())",[(++seq).toString(),JSON.stringify({benutzerId:u.leser,rolle:"leser"})]);
  await expect(u.betrieb.query("select restore_journal($1,'unbekannt','x',now())",[(seq+1n).toString()])).rejects.toThrow(/Unbekannte/);
  expect((await u.db.pool.query("select zustand from restore_zustand")).rows[0].zustand).toBe("gesperrt");
  expect((await u.db.pool.query("select sperre_seq from restore_konto where benutzer_id=$1",[u.leser])).rows[0].sperre_seq).toBe((seq-2n).toString());
  expect((await u.db.pool.query("select 1 from rolle_zuordnung where benutzer_id=$1",[u.leser])).rowCount).toBe(0);
  expect((await u.db.pool.query("select seq from journal_zaehler")).rows[0].seq).toBe(seq.toString());
});
it("laesst weitere Konten erst durch einen aktivierten Admin bestaetigen",async()=>{
  const u=await umgebung(),app=new pg.Pool({...u.db.cfg,options:"-c role=planora_app"});
  try{
    await expect(bestaetigeRestoreKonto(app,u.admin,u.leser)).rejects.toThrow(/Host-Freigabe/);
    const[t]=await freigabe(u.betrieb,{zeige:()=>{},bestaetige:async()=>true});
    await loeseFreigabeTokenEin(u.betrieb,t.token,randomBytes(16).toString("hex"));
    await expect(bestaetigeRestoreKonto(app,u.leser,u.leser)).rejects.toThrow(/Admin/);
    await expect(bestaetigeRestoreKonto(app,u.admin,u.admin)).rejects.toThrow(/Host-Konsole/);
    await bestaetigeRestoreKonto(app,u.admin,u.leser);
    expect((await u.db.pool.query("select status from konto_status where benutzer_id=$1",[u.leser])).rows[0].status).toBe("aktiv");
  }finally{await app.end();}
});

it("widerruft alte Host-Tokens bei erneuter Admin-Sperre und prueft den aktuellen Kontostatus",async()=>{
  const u=await umgebung();
  const[t]=await freigabe(u.betrieb,{zeige:()=>{},bestaetige:async()=>true});
  await u.db.pool.query("update konto_status set status='gesperrt' where benutzer_id=$1",[u.admin]);
  expect((await u.db.pool.query("select count(*)::int n from freigabe_token where benutzer_id=$1",[u.admin])).rows[0].n).toBe(0);
  await expect(loeseFreigabeTokenEin(u.betrieb,t.token,randomBytes(16).toString("hex"))).rejects.toThrow(/Token/);
  // Selbst ein noch vorhandenes Token darf den aktuellen Status nicht ueberstimmen.
  await u.db.pool.query("insert into freigabe_token(hash,benutzer_id,gueltig_bis) values($1,$2,now()+interval '15 minutes')",[sha(t.token),u.admin]);
  await expect(loeseFreigabeTokenEin(u.betrieb,t.token,randomBytes(16).toString("hex"))).rejects.toThrow(/Konto/);
  expect((await u.db.pool.query("select status from konto_status where benutzer_id=$1",[u.admin])).rows[0].status).toBe("gesperrt");
  expect((await u.db.pool.query("select wert from instanz_einstellung where schluessel='restore_gesperrt'")).rows[0].wert).toBe(true);
});
