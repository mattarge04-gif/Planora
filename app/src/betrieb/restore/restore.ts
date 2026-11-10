import { promises as fs, createReadStream } from "node:fs";
import { join, resolve } from "node:path";
import { dateiAblage } from "../../ablage/ablage.js";
import { MANIFEST_VERSION } from "../../module/manifest.js";
import { istUuid, ladeInventar, type Schluesselinventar } from "../backup/inventar.js";
import { pruefeDatei, pruefeDateischluessel, quelldatei, sha, snapshotAbgleichen, type Manifest } from "../backup/manifest.js";
import { erfolgreich, prozess, type Prozess } from "../backup/prozess.js";
import { pruefeKonfiguration, type Instanzkonfiguration } from "../backup/konfiguration.js";
import type { Ziel } from "../backup/ziel.js";
import type { Entschluesseln } from "../journal/age.js";
import type { JournalEintrag, JournalStand } from "../journal/outbox.js";
import { ladeJournal } from "./journal.js";
export type RestoreUmgebung={
  pruefeFrischesZiel():Promise<void>;
  rollen(inventar:Schluesselinventar,rollenDatei:string):Promise<void>;
  importiere(inventar:Schluesselinventar,manifest:Manifest,ordner:string):Promise<void>;
  journal(e:JournalEintrag):Promise<void>;
  bereit(stand:JournalStand):Promise<void>;
  konfiguration(k:Instanzkonfiguration,inventar:Schluesselinventar):Promise<void>;
};
export type RestoreOptionen={backupId:string;instanzId:string;ziel:Ziel;entschluesseln:Entschluesseln;staging:string;dokumente:string;
  release:string;schema:Manifest["schema"];umgebung:RestoreUmgebung;lauf?:Prozess};
export function pruefeRestoreManifest(m:Manifest,o:Pick<RestoreOptionen,"backupId"|"instanzId"|"release"|"schema">,satzPfad:string){
  if(m.format!==1 || m.backupId!==o.backupId || m.instanzId!==o.instanzId || m.release!==o.release || m.modulVersion!==MANIFEST_VERSION || m.satzPfad!==satzPfad || !/^\d+$/.test(m.journalSeq) || JSON.stringify(m.schema)!==JSON.stringify(o.schema))throw new Error("Manifest/Release/Schema passt nicht zum Restore-Ziel");
  if(!Array.isArray(m.dateien)||!Array.isArray(m.bestandteile))throw new Error("Manifest unvollstaendig");
  const gesehen=new Set<string>();
  for(const d of m.dateien){pruefeDateischluessel(d);if(gesehen.has(d.schluessel))throw new Error("Doppelte Manifest-Datei");gesehen.add(d.schluessel);}
  const teile=m.bestandteile.map((d)=>d.schluessel).sort();
  if(JSON.stringify(teile)!==JSON.stringify(["daten.dump","konfiguration.json","rollen.sql"]))throw new Error("Sicherungsbestandteile unvollstaendig");
  for(const d of m.bestandteile)if(!/^[a-f0-9]{64}$/.test(d.sha256)||!Number.isSafeInteger(d.groesse)||d.groesse<0)throw new Error("Ungueltiger Bestandteil");
}
export async function restore(o:RestoreOptionen){
  if(!istUuid(o.backupId)||!istUuid(o.instanzId))throw new Error("Ungueltige Restore-ID");
  // Noch kein Ziel-Datenimport, bevor Inventar, Instanz, Release, Hashes und Journal geprueft sind.
  const inventar=await ladeInventar(o.instanzId,o.backupId,o.ziel,o.entschluesseln);
  const env={RESTIC_REPOSITORY:inventar.restic.repository,RESTIC_PASSWORD:inventar.restic.passwort,RESTIC_PASSWORD_FILE:undefined,RESTIC_REPOSITORY_FILE:undefined,...inventar.zielCredentials};
  const lauf=o.lauf??prozess;
  const tool=(args:string[])=>erfolgreich(lauf,{programm:"restic",args,env});
  const snapshots=JSON.parse(await tool(["snapshots","--json","--tag",o.backupId]));
  if(!Array.isArray(snapshots)||snapshots.length!==1||!snapshots[0].tags?.includes(o.backupId)||!/^[0-9a-f]{64}$/.test(snapshots[0].id)||snapshots[0].paths?.length!==1)throw new Error("Sicherungssatz nicht eindeutig");
  const snapshot=snapshots[0],satzPfad=snapshot.paths[0] as string;
  if(!satzPfad.startsWith("/")||satzPfad.split("/").some((t)=>t===".."||t===".")||!satzPfad.endsWith("/"+o.backupId))throw new Error("Ungueltiger Snapshot-Pfad");
  const manifestJson=await tool(["dump",snapshot.id,`${satzPfad}/manifest.json`]);
  const manifest=JSON.parse(manifestJson) as Manifest;pruefeRestoreManifest(manifest,o,satzPfad);
  snapshotAbgleichen(await tool(["ls","--json",snapshot.id]),manifest);
  const journal=await ladeJournal(o.ziel,o.entschluesseln,o.instanzId,manifest.journalSeq);
  await o.umgebung.pruefeFrischesZiel();
  const ordner=resolve(o.staging,`restore-${o.backupId}`);let angelegt=false;
  try{
    await fs.mkdir(resolve(o.staging),{recursive:true,mode:0o700});await fs.mkdir(ordner,{mode:0o700});angelegt=true;
    await tool(["restore",`${snapshot.id}:${satzPfad}`,"--target",ordner,"--verify"]);
    if(sha(await fs.readFile(join(ordner,"manifest.json")))!==sha(manifestJson))throw new Error("Manifest beim Restore veraendert");
    for(const d of manifest.bestandteile)await pruefeDatei(join(ordner,d.schluessel),d);
    if(manifest.dateien.length && !(await fs.lstat(join(ordner,"dokumente"))).isDirectory())throw new Error("Dokumentwurzel fehlt");
    for(const d of manifest.dateien)await pruefeDatei(await quelldatei(join(ordner,"dokumente"),d),d);
    const konfiguration=JSON.parse(await fs.readFile(join(ordner,"konfiguration.json"),"utf8"));pruefeKonfiguration(konfiguration);
    if(konfiguration.instanzId!==o.instanzId||konfiguration.release!==o.release)throw new Error("Fremde Instanzkonfiguration");
    await o.umgebung.rollen(inventar,join(ordner,"rollen.sql"));
    await o.umgebung.importiere(inventar,manifest,ordner);
    const ablage=dateiAblage(o.dokumente);
    for(const d of manifest.dateien){
      const geschrieben=await ablage.schreibeNeu(createReadStream(await quelldatei(join(ordner,"dokumente"),d)));
      if(geschrieben.schluessel!==d.schluessel)throw new Error("Dokument-Hash nach Restore falsch");
      await pruefeDatei(await quelldatei(o.dokumente,d),d);
    }
    for(const e of journal.eintraege)await o.umgebung.journal(e);
    await o.umgebung.konfiguration(konfiguration,inventar);
    await o.umgebung.bereit(journal.stand);
    return{backupId:o.backupId,zustand:"gesperrt" as const,journalSeq:journal.eintraege.at(-1)?.seq??manifest.journalSeq};
  }finally{if(angelegt)await fs.rm(ordner,{recursive:true,force:true});}
}
