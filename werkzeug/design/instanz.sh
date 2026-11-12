#!/usr/bin/env bash
# Eigene Planora-Testinstanz fuer Design-Screenshots (nur Entwicklung, Wegwerfdaten).
# Port 3100 / Postgres 54600, damit der Server des PO (3000) unberuehrt bleibt.
#   bash werkzeug/design/instanz.sh start [--ohne-build]
#   bash werkzeug/design/instanz.sh stop
set -euo pipefail
hier="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
wurzel="$(cd "$hier/../.." && pwd)"
lauf="$hier/.lauf"
port="${PLANORA_DESIGN_PORT:-3100}"
pgport="${PLANORA_DESIGN_PG_PORT:-54600}"

stoppen() {
  powershell.exe -NoProfile -Command "
    \$p = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess;
    if (\$p) { taskkill.exe /PID \$p /T /F | Out-Null };
    Start-Sleep -Seconds 2;
    Get-CimInstance Win32_Process -Filter \"Name='postgres.exe'\" | Where-Object { \$_.CommandLine -like '*-p $pgport*' } | ForEach-Object { taskkill.exe /PID \$_.ProcessId /T /F | Out-Null };
    Start-Sleep -Seconds 1;
    # verwaiste Postgres-Hilfsprozesse (Elternprozess beendet) halten sonst den Port fest
    Get-CimInstance Win32_Process -Filter \"Name='postgres.exe'\" | Where-Object { \$_.CommandLine -like '*--forkchild*' -and -not (Get-Process -Id \$_.ParentProcessId -ErrorAction SilentlyContinue) } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }
  " >/dev/null 2>&1 || true
  echo "Instanz gestoppt (Port $port / $pgport)."
}

case "${1:-}" in
  start)
    mkdir -p "$lauf"
    stoppen >/dev/null
    if [ "${2:-}" != "--ohne-build" ]; then npm --prefix "$wurzel/app/web" run build >"$lauf/build.log" 2>&1 || { echo "Build fehlgeschlagen, siehe $lauf/build.log"; exit 1; }; fi
    # Vollstaendig abkoppeln (eigener Prozess via PowerShell), damit der Aufrufer nicht auf die Instanz wartet
    # und ein Abbruch des Aufrufers die eingebettete Datenbank nicht mitbeendet.
    powershell.exe -NoProfile -Command "
      \$env:PLANORA_PORT='$port'; \$env:PLANORA_PG_PORT='$pgport';
      Start-Process -WindowStyle Hidden -WorkingDirectory '$(cygpath -w "$wurzel/app")' -FilePath 'cmd.exe' -ArgumentList '/c','npx tsx entwicklung/start.ts > \"$(cygpath -w "$lauf/instanz.log")\" 2>&1'
    " >/dev/null
    for _ in $(seq 1 120); do
      grep -q "Login:" "$lauf/instanz.log" 2>/dev/null && break
      grep -qE "triggerUncaught|Error" "$lauf/instanz.log" 2>/dev/null && { echo "Start fehlgeschlagen:"; tail -20 "$lauf/instanz.log"; exit 1; }
      sleep 1
    done
    grep -q "Login:" "$lauf/instanz.log" || { echo "Zeitueberschreitung beim Start"; exit 1; }
    echo "Instanz laeuft: http://localhost:$port (Passwort im Log $lauf/instanz.log, liest screenshot.mjs automatisch)"
    ;;
  stop) stoppen ;;
  *) echo "Aufruf: instanz.sh start [--ohne-build] | stop"; exit 2 ;;
esac
