// Ersatzhost aus signiertem Bundle, verschluesseltem Inventar und separatem Offline-Key.
import { mkdirSync, readFileSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { restauriereSecrets, schreibeEnv } from '/opt/pb/bundle/werkzeug/betrieb/install/plan.js';
import { backupKonfigurieren, lesbarFuerBackup } from '/opt/pb/bundle/werkzeug/betrieb/install/backup.js';
import { pruefeInventar } from '/opt/pb/bundle/werkzeug/betrieb/backup/inventar.js';
import { pruefeRelease } from '/opt/pb/bundle/werkzeug/betrieb/release.js';
import { writeFileSync } from 'node:fs';
const extern = process.argv[2], b = JSON.parse(readFileSync(`${extern}/bootstrap.json`));
const release = pruefeRelease(readFileSync('/opt/pb/bundle/release.json','utf8'),readFileSync('/opt/pb/release.pub','utf8'));
for (const img of release.images) {
  const id = execFileSync('docker',['image','inspect',img.referenz,'--format','{{.Id}}'],{encoding:'utf8'}).trim();
  if(id!==img.imageId)throw Error(`Falsches Ersatzhost-Image: ${img.dienst}`);
}
const inventarDatei = `/srv/pb-ziel-1/inventar/${b.konfiguration.instanzId}/${b.backupId}.age`;
const plain = execFileSync('docker',['run','--rm','--name','pb-inventar','--network','none','--user','0','--entrypoint','age','-v','/srv/pb-ziel-1:/ziel:ro','-v','/root/pb-offline:/offline:ro','pb-backup:abnahme','-d','-i','/offline/recovery.key',inventarDatei.replace('/srv/pb-ziel-1','/ziel')],{encoding:'utf8'});
const i = JSON.parse(plain); pruefeInventar(i);
if (i.instanzId !== b.konfiguration.instanzId) throw Error('Fremdes Inventar');
mkdirSync('/etc/planora/pb-1/backup',{recursive:true,mode:0o700});
mkdirSync('/var/lib/planora/pb-1',{recursive:true,mode:0o700});
restauriereSecrets('/etc/planora/pb-1/secrets',{auth_secret:i.appSecrets.auth,db_superuser_passwort:i.appSecrets.db_superuser_passwort,...Object.fromEntries(Object.entries(i.dbRollen).map(([name,pw])=>[`db_${name.replace('planora_','')}_passwort`,pw]))});
const env = {...b.env,PLANORA_DB_NAME:'planora'};
schreibeEnv('/etc/planora/pb-1/instanz.env',env);
copyFileSync('/opt/pb/release.pub','/etc/planora/pb-1/release.pub');
copyFileSync('/opt/pb/bundle/release.json','/etc/planora/pb-1/release.json');
for (const [name,wert] of Object.entries({restic_passwort:i.restic.passwort,konfiguration:JSON.stringify(b.konfiguration)})) {
  const p=`/etc/planora/pb-1/backup/${name==='konfiguration'?'konfiguration.json':name}`;
  writeFileSync(p,wert,{mode:0o600});lesbarFuerBackup(p);
}
const empfaenger=execFileSync('docker',['run','--rm','--name','pb-age','--user','0','--network','none','--entrypoint','age-keygen','-v','/root/pb-offline:/offline:ro','pb-backup:abnahme','-y','/offline/recovery.key'],{encoding:'utf8'}).trim();
writeFileSync('/etc/planora/pb-1/backup/empfaenger',empfaenger,{mode:0o600});
backupKonfigurieren('pb-1',i.instanzId);
lesbarFuerBackup('/etc/planora/pb-1/backup/empfaenger');
lesbarFuerBackup('/etc/planora/pb-1/backup',true);
console.log('PASS: Bootstrap nur aus verschluesseltem Inventar, separatem Key und oeffentlichen Metadaten');
