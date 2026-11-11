# Lokale M1-Abnahme B

Die Skripte pruefen Punkt 1 und 7 mit einer neu importierten WSL2-Distribution `planora-abnahme` und erzeugen das Image-/Lizenzdossier fuer Punkt 5. Sie sind ausschliesslich fuer Wegwerf-Abnahmen vorgesehen. Anwendung und bestehende Betriebswerkzeuge werden unveraendert verwendet.

## Ausfuehrung

Voraussetzungen: Windows mit WSL2 und Docker Desktop, Node.js ab 24, Python 3, freier Platz fuer zwei Rootfs-/Image-Saetze und freie Ports 18602 bis 18605. Das Arbeitsverzeichnis muss neu sein und ausserhalb des Repos liegen. Download/Bau erfolgt vor der Netzsperre; fuer die Lizenzsammlung ist danach wieder Internet noetig.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File betrieb/abnahme/abnahme.ps1 `
  -Arbeitsordner "$env:LOCALAPPDATA/Temp/planora-abnahme-neuer-lauf"
```

Die Ausfuehrungsrichtlinie gilt nur fuer diesen gestarteten Prozess. Das Skript verweigert eine bereits vorhandene Distribution namens `planora-abnahme`. Es meldet ausschliesslich seine selbst angelegte Distribution beim simulierten Totalverlust und nach erfolgreichem Restore ab; bei Fehlern bleibt der Stand zur Untersuchung erhalten. Andere Distributionen und vorhandene Docker-Projekte werden nicht verwaltet. Aeussere Docker-Container und Image-Tags beginnen mit `pb-`; die unveraenderten Betriebswerkzeuge erzeugen innerhalb der eigenen Distribution `planora-pb-1` und `planora-pb-2`.

Der erzeugte Wegwerf-Recovery-Key liegt separat vom verschluesselten Sicherungsziel im externen Arbeitsverzeichnis. Das ist eine automatisierte Probe, kein echtes versiegeltes Offline-Medium. Arbeitsverzeichnis und Key niemals ins Repo oder in die Lieferung uebernehmen.

## Nachweise und Teilskripte

| Skript | Nachweis |
|---|---|
| `Dockerfile.linux` | Debian, systemd PID 1, Node 24, eigener Docker 29.0.0 mit containerd-Image-Speicher, Compose 5.7.0 |
| `bundle.mjs` | Vier selbst archivierte Pflichtimages, signiertes Wegwerf-Manifest und oeffentlicher Vertrauensanker |
| `linux.sh`, `isolation.mjs` | Blockierter externer Netzwerkzugriff, zwei Offline-Installationen, HTTPS-Health; erwartete Besitzer/Modi aller Secret-, Backup- und Zieldateien werden assertiert (Abweichung bricht ab). Je Instanz exakt die laufenden Dienste db/api/worker/proxy/journal mit exakter Mount-Anzahl, -Zielen und -Quellen; keine gemeinsamen Volumes, Netze oder beschreibbaren Binds, gemeinsam nur die read-only Bundle-Dateien |
| `timer.sh` | Temporaeres Timer-Drop-in, echte Timer-Ausloesung, erfolgreicher Backup-Service; anschliessend wieder naechtlicher Lieferplan |
| `probe.mjs`, `restore-probe.sh`, `freigabe.exp` | Admin, Liegenschaft und referenzierte Datei; vor beiden Sicherungen je mindestens eine Session, Verification und offenes Setup-Token mit positiver Ausgangszahl, nach beiden Restores alle drei Tabellen leer; echter Snapshot/Restore, Hash, leere Token-/Session-Tabellen, Konten-/Worker-Sperre, TTY-Freigabe und Login mit neuem Passwort |
| `totalverlust.sh`, `bootstrap.mjs` | Leere Ersatzumgebung, Inventar entschluesseln, Host-Secrets neu materialisieren, Cluster separat provisionieren, bestehender Host-Restore, Datenpruefung/Freigabe und systemd-Wiederanlauf |
| `dossier.mjs`, `lizenzen.py`, `archiv-identitaet.mjs` | Netzlose Syft-Scans des gelieferten Image-Archivs als Syft/SPDX/CycloneDX; Lizenz-Rootfs ebenfalls aus dem geladenen Lieferarchiv: signierte Image-ID muss einziger Index-Eintrag und inhaltsgepruefter Blob des Archivs sein, Container wird ueber diese ID (nicht ueber einen Tag) erzeugt und `{{.Image}}` gegen sie geprueft. Vorhandene Lizenzdateien und Notices |
| `upstream-lizenzen.py` | Lizenzdateien exakter npm-/Go-Quellpakete, Git-Commit-Fallback und SPDX-Standardtexte; Fehlstellen bleiben explizit gelistet |
| `lizenz-luecken.py` | Nachweisbare README-, Elternpaket-, Quellcommit- und Debian-copyright-Zuordnungen fuer die 14 bekannten Fehlstellen; nicht belegbare Restpunkte als `[?]` |
| `pruefe-dossier.py` | Ohne Option rein lesend: Gesamtpruefsummen ohne fehlende/zusaetzliche Dateien, SBOM-Hashes, jedes referenzierte Mitglied von `upstream-lizenzen.tar.gz` und der vier `*.lizenzen.tar.gz` gegen den gespeicherten Hash, abgeleitete Dateien gegen Neuberechnung. `--erzeugen` schreibt Zuordnung, `OFFENE-TEXTE.md`, `FREIGABE.md` und `SHA256SUMS.json` neu und prueft danach lesend |
| `test_pruefe_dossier.py` | Negativtests an einer Kopie: manipulierte Archivmitglieder (auch nach neu erzeugten Summen), veraenderte, zusaetzliche und abgeleitete Dateien werden erkannt |

Die Probe erhaelt nur Bundle, oeffentliche Bootstrap-Metadaten, verschluesseltes externes Sicherungsziel und separaten Offline-Key ueber den Totalverlust hinweg. Kein altes pgdata-, Dokumente- oder Staging-Volume und keine unverschluesselten Host-Secrets werden uebernommen. Der Ersatzcluster startet zunaechst mit den minimalen Planora-Rollen und frisch angewendeten Basismigrationen, bevor der vorhandene Host-Restore eine frische Zieldatenbank anlegt.

## Grenzen

- [A] WSL ist der vereinbarte lokale Ersatz: gemeinsamer WSL-Kernel und Windows-/WSL-Lebenszyklus statt unabhaengiger VM, kein Hypervisor-/Storage-/VM-Netzwerktest. Eine echte VM-/On-Premise-Abnahme wird dadurch nicht behauptet.
- [A] systemd meldet im importierten Rootfs `kmod-static-nodes.service` als fehlgeschlagen; die Planora-Dienste und Docker sind davon unabhaengig aktiv. Ein vollstaendig fehlerfreier allgemeiner VM-Boot wird nicht behauptet.
- [A] Die Netzsperre prueft den ausgehenden IPv4-Verkehr am WSL-Interface; die Skripte verweigern eine vorhandene IPv6-Default-Route. Diese Rootfs-Probe verwendet IPv4-Netze. Kein allgemeiner Nachweis fuer produktive Firewall-Regeln oder IPv6.
- [A] containerd-Image-Speicher und Compose 5.7.0 sind Voraussetzungen dieses nachgewiesenen Profils. Der klassische Image-Speicher und Compose 2.40.3 wurden nach ihren jeweiligen Fehlversuchen geparkt. Keine Freigabe aller laut allgemeiner Mindestversion denkbaren Kombinationen.
- [A] Timer werden fuer die Probe mit `OnActiveSec=2s` und ohne Zufallsverzoegerung ausgeloest; die reale Nachtzeit wird nicht abgewartet. Der originale Timerplan wird anschliessend wiederhergestellt.
- [A] Die lokale TTY-Freigabe wird mit Expect und einem Wegwerf-Admin automatisiert. Betreiberidentitaet, organisatorische Host-Freigabe und menschliche Liefer-/Lizenzfreigabe bleiben menschliche Aufgaben.
- SBOM-Vollstaendigkeit entspricht dem Scannerumfang des ausgelieferten Dateisystems, nicht einem mathematischen Beweis fuer unerkannte eingebettete Komponenten. Lizenztexte ersetzen keine komponentenbezogene Notice-/Copyright-Pruefung; siehe `FREIGABE.md` im Dossier.

Der [Kurzbericht](../../docs/superpowers/plans/2026-11-11-m1-abnahme-spur-b.md) nennt die tatsaechlich ausgefuehrten Laeufe, Fehler und Ergebnisse.

Der [Lizenznachtrag](../../docs/superpowers/plans/2026-11-11-m1-lizenznachtrag-spur-b.md) schliesst 12 der 14 zuvor offenen Zuordnungen. Ein ISC-/MIT-Widerspruch in einer mitgelieferten Deepmerge-Fixture und das private eigene `planora-app` bleiben mit Grund als `[?]` offen. Menschliche Freigabe und echte VM-Abnahme bleiben separate Aufgaben. Das Einstiegsskript fuehrt den Nachtrag vor der Dossier-Selbstpruefung automatisch aus; ein vorhandenes Dossier kann ohne neue Images oder WSL-Umgebung ergaenzt werden:

```powershell
python betrieb/abnahme/lizenz-luecken.py betrieb/abnahme/dossier-2026-11-11
python betrieb/abnahme/pruefe-dossier.py --erzeugen betrieb/abnahme/dossier-2026-11-11
```

Nur pruefen, ohne etwas zu schreiben, und Negativtests:

```powershell
python betrieb/abnahme/pruefe-dossier.py betrieb/abnahme/dossier-2026-11-11
python -I betrieb/abnahme/test_pruefe_dossier.py
```
