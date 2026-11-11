#!/bin/bash
set -euo pipefail
umask 077
extern=${1:?Externes Sicherungsverzeichnis fehlt}
skripte=${2:?Abnahmeskripte fehlen}
mkdir -p /root/pb-nachweis /root/pb-offline /opt/pb
exec > >(tee "$extern/totalverlust.log") 2>&1
date -Is
[[ $(cat /proc/1/comm) == systemd ]]
systemctl is-active docker
[[ -z $(docker ps -aq) && -z $(docker volume ls -q) ]]
echo 'PASS: Ersatzumgebung hat keine Container und keine Volumes'
docker info --format 'Ersatz-Daemon: {{.ID}}'
cp -r "$extern/bundle" /opt/pb/
chmod -R a+rX /opt/pb/bundle
cp "$extern/release.pub" /opt/pb/
cp "$extern/recovery.key" /root/pb-offline/recovery.key
chmod +x /opt/pb/bundle/planora
iface=$(ip route show default | awk 'NR==1 {print $5}')
[[ -n $iface ]]
[[ -z $(ip -6 route show default) ]] || { echo 'IPv6-Default-Route vorhanden: Offline-Profil verweigert'; exit 1; }
iptables -I OUTPUT 1 -o "$iface" -j REJECT
iptables -I FORWARD 1 -o "$iface" -j REJECT
trap 'iptables -D OUTPUT -o "$iface" -j REJECT; iptables -D FORWARD -o "$iface" -j REJECT' EXIT
for dienst in app backup db proxy; do docker load -i "/opt/pb/bundle/images/$dienst.tar" >/dev/null; done
mkdir -p /srv
tar -C /srv -xzf "$extern/backup-ziel.tar.gz"
node "$skripte/bootstrap.mjs" "$extern"
compose=(docker compose -p planora-pb-1 --env-file /etc/planora/pb-1/instanz.env -f /opt/pb/bundle/compose.yaml -f /opt/pb/bundle/compose.backup.yaml)
# Vertrag: separat provisionierter Cluster samt Minimalrollen, danach bestehender Host-Restore.
"${compose[@]}" up -d --pull never --wait --wait-timeout 300 >/root/pb-offline/provisionierung.log 2>&1
backup=$(node -p 'JSON.parse(require("fs").readFileSync(process.argv[1])).backupId' "$extern/bootstrap.json")
PLANORA_RECOVERY_DATEI=/root/pb-offline/recovery.key /opt/pb/bundle/planora restore --instanz pb-1 "$backup"
sleep 6
node "$skripte/probe.mjs" gesperrt "$extern"
node -e 'require("fs").writeFileSync("/root/pb-offline/passwort",require("crypto").randomBytes(24).toString("hex"),{mode:0o600})'
expect "$skripte/freigabe.exp"
node "$skripte/probe.mjs" freigegeben "$extern"
[[ -z $(find /var/lib/planora/pb-1 -name recovery.key) ]]
for name in planora-betrieb@.service planora-sicherung@.service planora-sicherung@.timer; do cp "/opt/pb/bundle/$name" /etc/systemd/system/; done
systemctl daemon-reload
systemctl enable --now planora-betrieb@pb-1.service planora-sicherung@pb-1.timer
systemctl is-active planora-betrieb@pb-1.service planora-sicherung@pb-1.timer
echo 'PASS: Totalverlust der Distribution, frischer Cluster, Datenpruefung, Host-Freigabe und Wiederanlauf'
date -Is
