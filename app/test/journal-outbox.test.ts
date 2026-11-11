import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { frischeDb } from "./hilfe.js";
import { sendeJournal } from "../src/betrieb/journal/outbox.js";
import type { Ziel } from "../src/betrieb/backup/ziel.js";
import { setzeRolle } from "../src/rechte/rechte.js";
let db: Awaited<ReturnType<typeof frischeDb>>, pool:pg.Pool;
beforeAll(async () => {db=await frischeDb();pool=new pg.Pool({...db.cfg,options:"-c role=planora_betrieb"});});
afterAll(async () => {await pool.end();await db.ende();});
beforeEach(async () => {await db.pool.query("truncate loesch_journal; update journal_zaehler set seq=0");});
function umgebung() {
  const objekte=new Map<string,Buffer>(), reihenfolge:string[]=[], alarme:string[]=[];
  const ziel:Ziel={lese:async(k) => {if(!objekte.has(k))throw new Error("fehlt");return objekte.get(k)!;},liste:async(p)=>[...objekte.keys()].filter((k)=>k.startsWith(p+"/")),schreibe:async(k,d,fest)=>{reihenfolge.push(k);if(!fest||!objekte.has(k))objekte.set(k,d);return objekte.get(k)!;},loesche:async(k)=>{objekte.delete(k);}};
  // Simuliert zufaellige age-Ciphertexte: bei Retry duerfen andere Bytes nicht quittiert werden.
  const verschluesseln=async(d:Buffer) => Buffer.from(JSON.stringify({zufall:randomUUID(),daten:d.toString("base64")}));
  return {objekte,reihenfolge,alarme,o:{pool,ziel,verschluesseln,alarm:(s:string)=>alarme.push(s)}};
}
it("sendet einzeln in Reihenfolge, quittiert erst nach PUT und aktualisiert stand",async()=>{
  await db.pool.query("select journal_eintrag('konto.sperren','a'); select journal_eintrag('konto.sperren','b')");
  const u=umgebung(); const stand=await sendeJournal(u.o);
  expect(stand?.letzteQuittierteSeq).toBe("2");
  expect(u.reihenfolge.map((k)=>k.split("/").at(-1))).toEqual(["1.age","2.age","stand.age"]);
  expect((await db.pool.query("select count(*)::int n from loesch_journal where zustand='offen'")).rows[0].n).toBe(0);
  await sendeJournal(u.o); expect(u.reihenfolge).toHaveLength(4);
});
it("wiederholt nach PUT/Quittungs-Crash mit identischen Bytes ohne Recovery-Key",async()=>{
  await db.pool.query("select journal_eintrag('konto.sperren','a')");
  const u=umgebung(), original=u.o.ziel.schreibe;let absturz=true;
  u.o.ziel.schreibe=async(...args)=>{const r=await original(...args);if(absturz){absturz=false;throw new Error("Crash nach PUT");}return r;};
  await expect(sendeJournal(u.o)).rejects.toThrow(/Crash/);
  const vorher=[...u.objekte.values()][0];
  expect((await db.pool.query("select zustand from loesch_journal")).rows[0].zustand).toBe("offen");
  await sendeJournal(u.o);expect([...u.objekte.values()][0]).toEqual(vorher);
  expect((await db.pool.query("select zustand from loesch_journal")).rows[0].zustand).toBe("quittiert");
});
it("laesst bei Zielfehler Eintraege offen und alarmiert nach 15 Minuten",async()=>{
  await db.pool.query("select journal_eintrag('konto.sperren','a'); update loesch_journal set zeit=now()-interval '16 minutes'");
  const u=umgebung();u.o.ziel.schreibe=async()=>{throw new Error("Ziel aus");};
  await expect(sendeJournal(u.o)).rejects.toThrow(/Ziel aus/);expect(u.alarme).toHaveLength(2);
  expect(u.alarme[0]).toContain("15 Minuten");expect(u.alarme[1]).toContain("Stand");
  expect((await db.pool.query("select zustand from loesch_journal")).rows[0].zustand).toBe("offen");
});
it("verweigert ein fremdes Objekt am unveraenderlichen Zielpfad",async()=>{
  await db.pool.query("select journal_eintrag('konto.sperren','a')");
  const u=umgebung();u.o.ziel.schreibe=async()=>Buffer.from("fremd");
  await expect(sendeJournal(u.o)).rejects.toThrow(/Objektkonflikt/);
});
it("haelt Sicherheitsjournal und Zaehler bei Rollback lueckenlos",async()=>{
  const id=randomUUID();
  await db.pool.query(`insert into "user" values ($1,'Test',$2,true,null,now(),now())`,[id,id+"@test.ch"]);
  await db.pool.query("insert into konto_status values ($1,'aktiv',$2)",[id,randomUUID()]);
  const c=await db.pool.connect();
  try{await c.query("begin");await c.query("update konto_status set status='gesperrt' where benutzer_id=$1",[id]);await c.query("rollback");}finally{c.release();}
  expect((await db.pool.query("select seq from journal_zaehler")).rows[0].seq).toBe("0");
  await db.pool.query("update konto_status set status='gesperrt' where benutzer_id=$1",[id]);
  expect((await db.pool.query("select seq,art,ziel from loesch_journal")).rows).toEqual([{seq:"1",art:"konto.sperren",ziel:id}]);
});
it("journalisiert nur echte Rollen-/Scope-Entzuege am Transaktionsende",async()=>{
  const id=randomUUID(),audit=randomUUID(),scope1=randomUUID(),scope2=randomUUID();
  await db.pool.query(`insert into "user" values ($1,'Test',$2,true,null,now(),now())`,[id,id+"@test.ch"]);
  await db.pool.query("insert into konto_status values($1,'aktiv',$2)",[id,audit]);
  await db.pool.query("insert into rolle_zuordnung values($1,'bearbeiter')",[id]);
  for(const s of [scope1,scope2]){await db.pool.query("insert into liegenschaft values($1,'Test')",[s]);await db.pool.query("insert into rolle_liegenschaft values($1,$2)",[id,s]);}
  await setzeRolle(db.pool,id,"bearbeiter",[scope1,scope2],audit);
  await db.pool.query("update rolle_zuordnung set rolle=rolle where benutzer_id=$1",[id]);
  await db.pool.query("update rolle_liegenschaft set liegenschaft_id=liegenschaft_id where benutzer_id=$1",[id]);
  expect((await db.pool.query("select count(*)::int n from loesch_journal")).rows[0].n).toBe(0);
  await setzeRolle(db.pool,id,"bearbeiter",[scope2],audit);
  await setzeRolle(db.pool,id,"leser",[scope2],audit);
  const eintraege=(await db.pool.query("select art,ziel from loesch_journal order by seq")).rows;
  expect(eintraege.map((e)=>({art:e.art,ziel:JSON.parse(e.ziel)}))).toEqual([
    {art:"scope.entziehen",ziel:{benutzerId:id,liegenschaftId:scope1}},
    {art:"rolle.entziehen",ziel:{benutzerId:id,rolle:"bearbeiter"}},
  ]);
  const c=await db.pool.connect();try{
    await c.query("begin");await c.query("delete from rolle_zuordnung where benutzer_id=$1",[id]);await c.query("delete from rolle_liegenschaft where benutzer_id=$1",[id]);await c.query("rollback");
  }finally{c.release();}
  expect((await db.pool.query("select count(*)::int n from loesch_journal")).rows[0].n).toBe(2);
  await setzeRolle(db.pool,id,"admin",[scope2],audit); // Aufwertung verliert keine Rechte.
  expect((await db.pool.query("select seq from journal_zaehler")).rows[0].seq).toBe("2");
});
it.each(["PUT-Fehler","Konflikt"])("aktualisiert stand.age trotz %s nur bis zur letzten echten Quittung",async(fehler)=>{
  await db.pool.query("select journal_eintrag('konto.sperren','a');select journal_eintrag('konto.sperren','b')");
  const u=umgebung(),original=u.o.ziel.schreibe;
  u.o.ziel.schreibe=async(k,d,fest)=>{
    if(k.endsWith('/2.age')){if(fehler==="PUT-Fehler")throw new Error("PUT-Fehler");return Buffer.from("fremd");}
    return original(k,d,fest);
  };
  await expect(sendeJournal(u.o)).rejects.toThrow(fehler==="Konflikt"?/Objektkonflikt/:/PUT-Fehler/);
  const stand=[...u.objekte].find(([k])=>k.endsWith("/stand.age"))![1];
  const daten=JSON.parse(Buffer.from(JSON.parse(stand.toString()).daten,"base64").toString());
  expect(daten.letzteQuittierteSeq).toBe("1");expect(Number.isFinite(Date.parse(daten.zeit))).toBe(true);
  expect((await db.pool.query("select zustand from loesch_journal where seq=2")).rows[0].zustand).toBe("offen");
});
