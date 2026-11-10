import pg from "pg";
import { promises as fs } from "node:fs";
import { join, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { erfolgreich, prozess, type Prozess } from "../backup/prozess.js";
import type { Schluesselinventar } from "../backup/inventar.js";
import type { RestoreUmgebung } from "./restore.js";
/** Rollen-Provisionierung benoetigt CREATEROLE + ADMIN fuer pg_read_all_data,
 * keinen Superuser. Dump-Import laeuft separat als planora_migrator. */
export function datenbankUmgebung(o:{rollenDb:pg.PoolConfig;zielDb:pg.ClientConfig;konfigurationDatei:string;inventarDatei:string;lauf?:Prozess}) {
  const rollen=new pg.Pool(o.rollenDb);let betrieb:pg.Pool|undefined;
  const lauf=o.lauf??prozess;
  function ziel(inventar:Schluesselinventar,user:keyof Schluesselinventar["dbRollen"]){return{...o.zielDb,user,password:inventar.dbRollen[user]};}
  const umgebung:RestoreUmgebung={
    async pruefeFrischesZiel(){
      const r=await rollen.query("select rolsuper from pg_roles where rolname=current_user");
      if(r.rows[0].rolsuper)throw new Error("Restore verlangt eine begrenzte Rollenverwaltung, keinen Superuser");
      if((await rollen.query("select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p','v','m','S') limit 1")).rowCount)throw new Error("Restore-Zieldatenbank ist nicht frisch");
    },
    async rollen(inventar,rollenDatei){
      const exportiert=await fs.readFile(rollenDatei,"utf8");
      if(!exportiert.includes("CREATE ROLE planora_backup;")||!exportiert.includes("CREATE ROLE planora_betrieb;"))throw new Error("Betriebsrollen im Rollenexport fehlen");
      for(const [name,pw] of Object.entries(inventar.dbRollen)){
        // Nur diese vier Planora-Rollen rekonstruieren; keine fremden Clusterrollen
        // oder privilegierten Attribute aus dem Export auf den Zielhost uebertragen.
        if(!["planora_app","planora_backup","planora_betrieb","planora_migrator"].includes(name))throw new Error("Fremde Datenbankrolle im Inventar");
        if(!(await rollen.query("select 1 from pg_roles where rolname=$1",[name])).rowCount){
          await rollen.query((await rollen.query("select format('create role %I', $1::text) sql",[name])).rows[0].sql);
        }
        const attribute=(await rollen.query("select rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls from pg_roles where rolname=$1",[name])).rows[0];
        if(Object.values(attribute).some(Boolean))throw new Error("Vorhandene Planora-Rolle hat unerlaubte Privilegien");
        // CREATEROLE darf Superuser-/Replikationsattribute auch dann nicht setzen,
        // wenn deren Wert unveraendert false bliebe. Sichere Defaults oben pruefen.
        const sql=(await rollen.query("select format('alter role %I login password %L', $1::text,$2::text) sql",[name,pw])).rows[0].sql;
        await rollen.query(sql);
      }
      await rollen.query("grant pg_read_all_data to planora_backup; grant usage,create on schema public to planora_migrator");
      betrieb=new pg.Pool(ziel(inventar,"planora_betrieb"));
    },
    async importiere(inventar,m,ordner){
      const cfg=ziel(inventar,"planora_migrator"),c=new pg.Client(cfg);await c.connect();
      try{if((await c.query("select rolsuper from pg_roles where rolname=current_user")).rows[0].rolsuper)throw new Error("Migrator darf kein Superuser sein");}finally{await c.end();}
      const env={PGHOST:cfg.host,PGPORT:String(cfg.port??5432),PGDATABASE:cfg.database,PGUSER:cfg.user,PGPASSWORD:cfg.password as string,PGSSLMODE:o.zielDb.ssl?"require":"prefer"};
      const sqlDatei=join(ordner,"import.sql"),sperreDatei=join(ordner,"sperre.sql");
      await erfolgreich(lauf,{programm:"pg_restore",args:["--no-owner","--file",sqlDatei,join(ordner,"daten.dump")]});
      await fs.chmod(sqlDatei,0o600);
      await fs.writeFile(sperreDatei,`select public.restore_sperren('${m.instanzId}'::uuid,'${m.backupId}'::uuid,${m.journalSeq}::bigint);\n`,{mode:0o600,flag:"wx"});
      // Import und Kontosperre sind atomar sichtbar. Jeder SQL-Fehler rollt alles zurueck.
      await erfolgreich(lauf,{programm:"psql",args:["--no-password","--single-transaction","--set","ON_ERROR_STOP=1","--file",sqlDatei,"--file",sperreDatei],env});
    },
    async journal(e){if(!betrieb)throw new Error("Restore nicht importiert");await betrieb.query("select restore_journal($1,$2,$3,$4)",[e.seq,e.art,e.ziel,e.zeit]);},
    async bereit(stand){if(!betrieb)throw new Error("Restore nicht importiert");await betrieb.query("select restore_bereit($1,$2)",[stand.letzteQuittierteSeq,stand.zeit]);},
    async konfiguration(k,inventar){
      async function atomar(datei:string,daten:unknown){
        await fs.mkdir(dirname(datei),{recursive:true,mode:0o700});const temp=datei+"."+randomUUID()+".tmp";
        try{
          await fs.writeFile(temp,JSON.stringify(daten),{mode:0o600,flag:"wx"});
          const f=await fs.open(temp,"r+");try{await f.sync();}finally{await f.close();}
          await fs.link(temp,datei); // Kein stilles Ueberschreiben fremder Secrets.
        }finally{await fs.rm(temp,{force:true});}
      }
      await atomar(o.konfigurationDatei,k);await atomar(o.inventarDatei,inventar);
    },
  };
  return{umgebung,async ende(){await betrieb?.end();await rollen.end();}};
}
