param([Parameter(Mandatory=$true)][string]$Arbeitsordner)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$ziel = [IO.Path]::GetFullPath($Arbeitsordner)
if ($ziel.StartsWith($repo, [StringComparison]::OrdinalIgnoreCase) -or (Test-Path -LiteralPath $ziel)) {
    throw 'Neues Arbeitsverzeichnis ausserhalb des Repos angeben; vorhandene Nachweise bleiben erhalten.'
}
function Run([string]$Befehl, [string[]]$Argumente) {
    & $Befehl @Argumente
    if ($LASTEXITCODE -ne 0) { throw "$Befehl fehlgeschlagen (Exit $LASTEXITCODE)" }
}
function LinuxPfad([string]$Pfad) {
    if ($Pfad -notmatch '^([A-Za-z]):[\\/](.*)$') { throw 'Absoluter Windows-Laufwerkspfad erwartet' }
    return '/mnt/' + $Matches[1].ToLowerInvariant() + '/' + $Matches[2].Replace('\','/')
}
function Linux([string]$Skript, [string]$Log) {
    & wsl -d planora-abnahme --user root --exec bash (LinuxPfad (Join-Path $PSScriptRoot $Skript)) (LinuxPfad $ziel) (LinuxPfad $PSScriptRoot) | Tee-Object -FilePath (Join-Path $ziel $Log)
    if ($LASTEXITCODE -ne 0) { throw "$Skript fehlgeschlagen; Distribution und externe Nachweise fuer Untersuchung erhalten" }
}
$distros = (& wsl --list --quiet) -replace "`0", ''
if ($LASTEXITCODE -ne 0) { throw 'WSL nicht erreichbar' }
if ($distros.Trim() -contains 'planora-abnahme') { throw 'planora-abnahme existiert bereits; keine fremde Distribution veraendern' }
foreach ($name in @('pb-rootfs','pb-bundle','pb-age','pb-inventar')) {
    $belegt = & docker ps -aq --filter "name=^$name$"
    if ($LASTEXITCODE -ne 0 -or $belegt) { throw "Docker nicht erreichbar oder Container $name bereits belegt" }
}
New-Item -ItemType Directory -Path $ziel | Out-Null
$start = Get-Date
Push-Location $repo
try {
    Run docker @('build','-t','pb-linux:abnahme','-f','betrieb/abnahme/Dockerfile.linux','.')
    Run docker @('build','-t','pb-app:abnahme','--build-arg','PLANORA_RELEASE=pb-abnahme','app')
    Run docker @('build','-t','pb-backup:abnahme','-f','betrieb/backup/Dockerfile','.')
    Run node @('betrieb/abnahme/bundle.mjs',$ziel)
    Run docker @('create','--name','pb-rootfs','pb-linux:abnahme')
    try { Run docker @('export','--output',(Join-Path $ziel 'rootfs.tar'),'pb-rootfs') }
    finally { Run docker @('rm','pb-rootfs') }
    Run wsl @('--import','planora-abnahme',(Join-Path $ziel 'wsl'),(Join-Path $ziel 'rootfs.tar'),'--version','2')
    Run wsl @('-d','planora-abnahme','--user','root','--exec','mkdir','-p','/opt/pb')
    Run wsl @('-d','planora-abnahme','--user','root','--exec','cp','-r',(LinuxPfad (Join-Path $ziel 'bundle')),'/opt/pb/')
    Run wsl @('-d','planora-abnahme','--user','root','--exec','cp',(LinuxPfad (Join-Path $ziel 'release.pub')),'/opt/pb/')
    Linux 'linux.sh' 'linux.log'
    Linux 'timer.sh' 'timer.log'
    Run wsl @('-d','planora-abnahme','--user','root','--exec','node',(LinuxPfad (Join-Path $PSScriptRoot 'probe.mjs')),'vorbereiten',(LinuxPfad $ziel))
    Linux 'restore-probe.sh' 'restore-lokal.log'
    & wsl -d planora-abnahme --exec docker info --format '{{.ID}}' | Set-Content (Join-Path $ziel 'daemon-vorher.txt')
    if ($LASTEXITCODE -ne 0) { throw 'Daemon-Nachweis fehlt' }
    # Erst nach erfolgreicher Sicherung/Freigabe wird ausschliesslich die selbst angelegte Distribution verworfen.
    Run wsl @('--unregister','planora-abnahme')
    Run wsl @('--import','planora-abnahme',(Join-Path $ziel 'wsl'),(Join-Path $ziel 'rootfs.tar'),'--version','2')
    Linux 'totalverlust.sh' 'totalverlust-host.log'
    Run wsl @('--unregister','planora-abnahme')
    Run node @('betrieb/abnahme/dossier.mjs',$ziel,(Join-Path $ziel 'dossier'))
    Run python @('betrieb/abnahme/upstream-lizenzen.py',(Join-Path $ziel 'dossier'))
    Run python @('betrieb/abnahme/pruefe-dossier.py',(Join-Path $ziel 'dossier'))
    "Erfolgreich: Dauer $([math]::Round(((Get-Date)-$start).TotalSeconds,1)) s; Nachweise $ziel"
} finally { Pop-Location }
