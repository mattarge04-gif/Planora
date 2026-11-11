#!/bin/bash
set -euo pipefail
for n in 1 2; do
  unit="planora-sicherung@pb-$n"
  vorher=$(systemctl show -p LastTriggerUSecMonotonic --value "$unit.timer")
  mkdir -p "/etc/systemd/system/$unit.timer.d"
  printf '[Timer]\nOnCalendar=\nOnActiveSec=2s\nAccuracySec=1s\nRandomizedDelaySec=0\n' > "/etc/systemd/system/$unit.timer.d/abnahme.conf"
  systemctl daemon-reload
  systemctl restart "$unit.timer"
  fertig=false
  for i in {1..60}; do
    trigger=$(systemctl show -p LastTriggerUSecMonotonic --value "$unit.timer")
    status=$(systemctl show -p ActiveState --value "$unit.service")
    if [[ $trigger != "$vorher" && $trigger != 0 && $status == inactive ]]; then fertig=true; break; fi
    sleep 1
  done
  [[ $fertig == true ]]
  [[ $(systemctl show -p Result --value "$unit.service") == success ]]
  systemctl show -p LastTriggerUSec -p NextElapseUSecRealtime "$unit.timer"
  systemctl show -p Result -p ExecMainStatus "$unit.service"
  # Nur die eigene temporaere Timer-Konfiguration entfernen, danach Lieferplan aktivieren.
  rm "/etc/systemd/system/$unit.timer.d/abnahme.conf"
  rmdir "/etc/systemd/system/$unit.timer.d"
  systemctl daemon-reload
  systemctl restart "$unit.timer"
  systemctl is-active "$unit.timer"
  echo "PASS: Timer pb-$n hat den echten Backup-Dienst erfolgreich ausgeloest"
done
