#!/bin/bash
set -euo pipefail
umask 077
extern=${1:?Externes Nachweisverzeichnis fehlt}
skripte=${2:?Abnahmeskripte fehlen}
exec > >(tee /root/pb-nachweis/restore-lokal.log) 2>&1
date -Is
systemctl stop planora-betrieb@pb-1.service planora-sicherung@pb-1.timer
backup=$(node -p 'JSON.parse(require("fs").readFileSync(process.argv[1])).backupId' "$extern/bootstrap.json")
PLANORA_RECOVERY_DATEI=/root/pb-offline/recovery.key /opt/pb/bundle/planora restore --instanz pb-1 "$backup"
sleep 6
node "$skripte/probe.mjs" gesperrt "$extern"
node -e 'require("fs").writeFileSync("/root/pb-offline/passwort",require("crypto").randomBytes(24).toString("hex"),{mode:0o600})'
expect "$skripte/freigabe.exp"
node "$skripte/probe.mjs" freigegeben "$extern"
echo 'PASS: eigenstaendiger Restore, Datenhash, Konten-/Worker-Sperre und Host-Freigabe'
# Neue Sicherung fuer Totalverlust, getrennt vom ersten Restore-Auftrag.
node "$skripte/probe.mjs" tokens "$extern"
/opt/pb/bundle/planora journal --instanz pb-1 --einmal >/root/pb-offline/journal.log
/opt/pb/bundle/planora sichern --instanz pb-1 --anlass totalverlust-final >/root/pb-offline/backup-final.json
node --input-type=module - "$extern" <<'JS'
import {readFileSync,writeFileSync} from 'node:fs';
import {leseEnv} from '/opt/pb/bundle/werkzeug/betrieb/install/plan.js';
const dir=process.argv[2],b=JSON.parse(readFileSync(`${dir}/bootstrap.json`));
const r=JSON.parse(readFileSync('/root/pb-offline/backup-final.json','utf8').trim().split('\n').at(-1));
if(r.zustand!=='geprueft')throw Error('Backup nicht geprueft');
b.backupId=r.backupId;b.env=leseEnv('/etc/planora/pb-1/instanz.env');
writeFileSync(`${dir}/bootstrap.json`,JSON.stringify(b));
console.log(JSON.stringify({totalverlustBackup:r.backupId}));
JS
# Extern ueberleben nur das verschluesselte Ziel, oeffentliche Metadaten und der separate Offline-Key.
tar -C /srv -czf "$extern/backup-ziel.tar.gz" pb-ziel-1
cp /root/pb-offline/recovery.key "$extern/recovery.key"
date -Is
