import { execFileSync } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { request } from 'node:https';
import { leseEnv } from '/opt/pb/bundle/werkzeug/betrieb/install/plan.js';
const modus = process.argv[2], extern = process.argv[3];
const bundle = '/opt/pb/bundle';
const c = (...args) => execFileSync('docker',['compose','-p','planora-pb-1','--env-file','/etc/planora/pb-1/instanz.env','-f',`${bundle}/compose.yaml`,'-f',`${bundle}/compose.backup.yaml`,...args],{encoding:'utf8',maxBuffer:10*1024*1024,timeout:600000});
const db = sql => c('exec','-T','db','psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d',leseEnv('/etc/planora/pb-1/instanz.env').PLANORA_DB_NAME ?? 'planora','-At','-c',sql).trim();
const hash = createHash('sha256').update('Planora Totalverlust Abnahme B\n').digest('hex');
const schluessel = `sha256/${hash.slice(0,2)}/${hash.slice(2,4)}/${hash}`;
if (modus === 'vorbereiten') {
  const token = c('--profile','konsole','run','--pull','never','--rm','-T','konsole','setup-token').trim().split('\n').at(-1);
  const passwort = randomBytes(24).toString('hex');
  writeFileSync('/root/pb-offline/passwort', passwort, {mode:0o600});
  execFileSync('docker',['compose','-p','planora-pb-1','--env-file','/etc/planora/pb-1/instanz.env','-f',`${bundle}/compose.yaml`,'--profile','konsole','run','--pull','never','--rm','-T','konsole','erstadmin'],{input:JSON.stringify({token,email:'abnahme@planora.invalid',name:'Abnahme B',passwort}),stdio:['pipe','pipe','pipe']});
  db("insert into liegenschaft(id,name) values('33333333-3333-4333-8333-333333333333','Totalverlust B')");
  c('exec','-T','api','node','--input-type=module','-e',`import{mkdirSync,writeFileSync}from'node:fs';import{dirname}from'node:path';const p='/daten/dokumente/${schluessel}';mkdirSync(dirname(p),{recursive:true});writeFileSync(p,${JSON.stringify('Planora Totalverlust Abnahme B\n')});`);
  db(`insert into datei(schluessel,sha256,groesse) values('${schluessel}','${hash}',${Buffer.byteLength('Planora Totalverlust Abnahme B\n')}); insert into datei_referenz values('${schluessel}','abnahme-b')`);
  // Vorhandene Sessions werden mitgesichert und muessen beim Restore verschwinden.
  db('insert into session(id,user_id,token,created_at,updated_at,expires_at) select gen_random_uuid(),id,gen_random_uuid(),now(),now(),now()+interval \'1 hour\' from "user" limit 1');
  execFileSync(`${bundle}/planora`,['journal','--instanz','pb-1','--einmal'],{stdio:'pipe'});
  const r = JSON.parse(execFileSync(`${bundle}/planora`,['sichern','--instanz','pb-1','--anlass','totalverlust'],{encoding:'utf8',timeout:600000}).trim().split('\n').at(-1));
  assert.equal(r.zustand, 'geprueft');
  const env = leseEnv('/etc/planora/pb-1/instanz.env');
  const konfiguration = JSON.parse(readFileSync('/etc/planora/pb-1/backup/konfiguration.json'));
  writeFileSync(`${extern}/bootstrap.json`, JSON.stringify({env,konfiguration,backupId:r.backupId,schluessel,hash}));
  console.log(JSON.stringify({phase:modus,backupId:r.backupId,liegenschaften:1,dateien:1,admin:1,sessions:Number(db('select count(*) from session'))}));
} else {
  assert.equal(db("select name from liegenschaft where id='33333333-3333-4333-8333-333333333333'"),'Totalverlust B');
  assert.equal(db('select count(*) from session'),'0');
  assert.equal(db('select count(*) from verification'),'0');
  assert.equal(db('select count(*) from setup_token'),'0');
  assert.equal(db(`select sha256 from datei where schluessel='${schluessel}'`),hash);
  const inhalt = c('exec','-T','api','node','-e',`process.stdout.write(require('fs').readFileSync('/daten/dokumente/${schluessel}'))`);
  assert.equal(createHash('sha256').update(inhalt).digest('hex'),hash);
  assert.equal(db("select wert from instanz_einstellung where schluessel='restore_gesperrt'"),modus==='gesperrt'?'true':'false');
  assert.equal(db('select distinct status from konto_status'),modus==='gesperrt'?'zu_bestaetigen':'aktiv');
  if (modus==='gesperrt') {
    const logs = c('logs','--no-color','worker');
    assert.match(logs,/restore_gesperrt/);
  } else {
    const passwort = readFileSync('/root/pb-offline/passwort','utf8').trim();
    const response = await new Promise((ok,fehler)=>{
      const body = JSON.stringify({email:'abnahme@planora.invalid',password:passwort});
      const req = request('https://localhost:18603/api/auth/sign-in/email',{method:'POST',rejectUnauthorized:false,headers:{origin:'https://localhost:18603','content-type':'application/json','content-length':Buffer.byteLength(body)}},r=>{r.resume();r.on('end',()=>ok(r.statusCode));});
      req.on('error',fehler); req.end(body);
    });
    assert.equal(response,200);
  }
  console.log(JSON.stringify({phase:modus,liegenschaften:1,dateiHash:hash,sessions:0,verifications:0,setupTokens:0}));
}
