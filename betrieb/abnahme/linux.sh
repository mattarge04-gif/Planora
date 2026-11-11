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
# Erwartete Besitzer/Modi werden assertiert, nicht nur protokolliert.
pruefe_stat() { # pfad uid:gid modus
  local ist; ist=$(stat -c '%u:%g %a' "$1")
  echo "$1 $ist"
  [[ $ist == "$2 $3" ]] || { echo "FEHLER: $1 ist $ist, erwartet $2 $3"; return 1; }
}
pruefe_rechte() {
  local e="/etc/planora/pb-$1" s="/etc/planora/pb-$1/secrets" f
  pruefe_stat "$e" 0:0 700
  pruefe_stat "$s" 0:0 700
  for f in db_superuser_passwort db_app_passwort db_migrator_passwort db_backup_passwort db_betrieb_passwort auth_secret; do pruefe_stat "$s/$f" 0:0 600; done
  pruefe_stat "$s/db" 999:999 700
  for f in db_superuser_passwort db_app_passwort db_migrator_passwort db_backup_passwort db_betrieb_passwort; do pruefe_stat "$s/db/$f" 999:999 600; done
  pruefe_stat "$s/app" 1000:1000 700
  for f in db_app_passwort db_migrator_passwort db_betrieb_passwort auth_secret; do pruefe_stat "$s/app/$f" 1000:1000 600; done
  [[ $(find "$s" -mindepth 1 | wc -l) == 17 ]] || { echo "FEHLER: unerwartete Secret-Dateien"; find "$s"; return 1; }
  pruefe_stat "$e/backup" 1000:1000 700
  for f in inventar.json konfiguration.json restic_passwort empfaenger betrieb_db backup_db; do pruefe_stat "$e/backup/$f" 1000:1000 600; done
  pruefe_stat "$e/backup/backup.env" 0:0 600
  [[ $(find "$e/backup" -mindepth 1 | wc -l) == 7 ]] || { echo "FEHLER: unerwartete Backup-Dateien"; find "$e/backup"; return 1; }
  pruefe_stat "$e/instanz.env" 0:0 600
  pruefe_stat "/srv/pb-ziel-$1" 1000:1000 700
  # Gesamtes Sicherungsziel: nur UID 1000, nichts fuer Gruppe/andere zugreifbar.
  [[ -z $(find "/srv/pb-ziel-$1" \( ! -uid 1000 -o -perm /077 \) -print -quit) ]] || { echo "FEHLER: Sicherungsziel pb-$1 mit fremdem Besitzer oder offenen Rechten"; return 1; }
  [[ -d /srv/pb-ziel-$1/restic ]]
  echo "PASS: Besitzer/Modi pb-$1"
}
for n in 1 2; do
  ./planora install --instanz "pb-$n" --domain localhost --tls internal --schluessel /opt/pb/release.pub --http-port "$((18600+n*2))" --https-port "$((18601+n*2))" --backup-ziel "/srv/pb-ziel-$n" --recovery-empfaenger "$empfaenger" >"/root/pb-offline/install-$n.log" 2>&1 || { sed -E '/Token/,$d' "/root/pb-offline/install-$n.log"; exit 1; }
  systemctl is-active "planora-betrieb@pb-$n.service" "planora-sicherung@pb-$n.timer"
  systemctl is-enabled "planora-betrieb@pb-$n.service" "planora-sicherung@pb-$n.timer"
  systemctl start "planora-sicherung@pb-$n.service"
  [[ $(systemctl show -p Result --value "planora-sicherung@pb-$n.service") == success ]]
  curl --noproxy '*' -kfsS "https://localhost:$((18601+n*2))/api/health"; echo
  pruefe_rechte "$n"
done
node "$(dirname "$0")/isolation.mjs"
echo 'PASS: zwei parallele Instanzen, echte Linux-Bind-Mounts, systemd-Dienste und ausgeloeste Sicherungsdienste'
iptables -nvL OUTPUT
iptables -nvL FORWARD
date -Is
