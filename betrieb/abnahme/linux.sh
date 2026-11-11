#!/bin/bash
# Laeuft ausschliesslich in der eigenen, frischen WSL-Distribution, nie auf einem Kundenhost.
set -euo pipefail
umask 077
[[ $(cat /proc/1/comm) == systemd && $(id -u) == 0 ]]
[[ -f /etc/wsl.conf && -d /opt/pb/bundle ]]
extern=${1:?Externes Nachweisverzeichnis fehlt}
mkdir -p /root/pb-nachweis
exec > >(tee /root/pb-nachweis/linux.log) 2>&1
date -Is
systemctl is-active docker
docker version --format '{{.Server.Version}}'
[[ $(docker ps -aq | wc -l) == 0 ]]
# Sperrt nur den eigenen Linux-Netznamespace, keine Windows-/Docker-Desktop-Regeln.
iface=$(ip route show default | awk 'NR==1 {print $5}')
[[ -n $iface ]]
[[ -z $(ip -6 route show default) ]] || { echo 'IPv6-Default-Route vorhanden: Offline-Profil verweigert'; exit 1; }
iptables -I OUTPUT 1 -o "$iface" -j REJECT
iptables -I FORWARD 1 -o "$iface" -j REJECT
trap 'iptables -D OUTPUT -o "$iface" -j REJECT; iptables -D FORWARD -o "$iface" -j REJECT' EXIT
if curl --noproxy '*' --connect-timeout 3 -s https://1.1.1.1 >/dev/null; then
  echo 'FEHLER: Netzwerk nicht blockiert'; exit 1
fi
echo 'PASS: externer Netzzugriff blockiert'
iptables -nvL OUTPUT
cd /opt/pb/bundle
chmod +x planora
docker load -i images/backup.tar >/dev/null
mkdir -p /root/pb-offline
if [[ ! -f /root/pb-offline/recovery.key ]]; then
  docker run --rm --name pb-age --user 0 --network none --entrypoint age-keygen -v /root/pb-offline:/ausgabe pb-backup:abnahme -o /ausgabe/recovery.key 2>/root/pb-offline/keygen.log
fi
empfaenger=$(docker run --rm --name pb-age --user 0 --network none --entrypoint age-keygen -v /root/pb-offline:/ausgabe:ro pb-backup:abnahme -y /ausgabe/recovery.key)
for n in 1 2; do
  ./planora install --instanz "pb-$n" --domain localhost --tls internal --schluessel /opt/pb/release.pub --http-port "$((18600+n*2))" --https-port "$((18601+n*2))" --backup-ziel "/srv/pb-ziel-$n" --recovery-empfaenger "$empfaenger" >"/root/pb-offline/install-$n.log" 2>&1 || { sed -E '/Token/,$d' "/root/pb-offline/install-$n.log"; exit 1; }
  systemctl is-active "planora-betrieb@pb-$n.service" "planora-sicherung@pb-$n.timer"
  systemctl is-enabled "planora-betrieb@pb-$n.service" "planora-sicherung@pb-$n.timer"
  systemctl start "planora-sicherung@pb-$n.service"
  [[ $(systemctl show -p Result --value "planora-sicherung@pb-$n.service") == success ]]
  curl --noproxy '*' -kfsS "https://localhost:$((18601+n*2))/api/health"
  stat -c '%n %u:%g %a' "/srv/pb-ziel-$n" "/etc/planora/pb-$n/backup" "/etc/planora/pb-$n/backup/inventar.json" "/etc/planora/pb-$n/secrets/db/db_app_passwort" "/etc/planora/pb-$n/secrets/app/db_app_passwort"
done
node --input-type=module <<'JS'
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const instanz=n=>JSON.parse(execFileSync('docker',['inspect',...['db','api','proxy'].map(d=>`planora-pb-${n}-${d}-1`)],{encoding:'utf8'}));
const a=instanz(1),b=instanz(2);
const volumes=xs=>xs.flatMap(x=>x.Mounts.filter(m=>m.Type==='volume').map(m=>m.Source));
const netze=xs=>xs.flatMap(x=>Object.keys(x.NetworkSettings.Networks));
assert(!volumes(a).some(v=>volumes(b).includes(v)));
assert(!netze(a).some(v=>netze(b).includes(v)));
for(const [n,xs] of [[1,a],[2,b]]) for(const x of xs) for(const m of x.Mounts.filter(m=>m.Destination.startsWith('/run/secrets'))) assert(m.Type==='bind'&&m.Source.startsWith(`/etc/planora/pb-${n}/secrets/`)&&!m.RW);
console.log('PASS: keine gemeinsamen Datenvolumes/Netze; Secret-Bind-Mounts getrennt und read-only');
JS
echo 'PASS: zwei parallele Instanzen, echte Linux-Bind-Mounts, systemd-Dienste und ausgeloeste Sicherungsdienste'
iptables -nvL OUTPUT
iptables -nvL FORWARD
date -Is
