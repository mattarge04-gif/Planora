# M1-Abnahme Spur B, 2026-11-11

Fortschreibung nach dem ersten Auftrag: Im [Lizenznachtrag](2026-11-11-m1-lizenznachtrag-spur-b.md) sind **12 von 14** damaligen Zuordnungen geschlossen. Ein ISC-/MIT-Widerspruch in einer Deepmerge-Fixture und die Lizenz-/Liefermodell-Entscheidung fuer das private eigene `planora-app` bleiben mit Grund als `[?]` offen. Die folgenden 14er-Zahlen und `outcome failed` dokumentieren den historischen ersten Auftrag bis Commit `9502af7`; der Folgeauftrag bewertet menschliche Freigabe und echte VM ausdruecklich nicht als Fehler.

**Teilweise erfuellt:** Die lokal beauftragten Ersatznachweise fuer Punkt 1 und 7 sind bestanden. Fuer Punkt 5 liegen Image-SBOMs und eine umfangreiche Lizenzsammlung vor; 14 Quellpakete ohne eigene Lizenzdatei verhindern weiterhin die Behauptung einer vollstaendigen komponentengenauen Lizenztext-/Notice-Abdeckung. Die menschliche Lizenz-/Lieferfreigabe bleibt wie beauftragt offen. Deshalb wird der gesamte Worker-Auftrag mit `outcome failed` zurueckgemeldet, obwohl der automatisierte Prueflauf Exit 0 erreicht.

Eigener Worktree/Branch `mattarge04-gif/m1-abnahme-b`, Ausgangspunkt main `ae3f5b5`. Kein Push, kein Merge. Anwendungscode unveraendert.

## Commits

- `fbde35c` – M1-Abnahme B: Linux- und Totalverlustprobe nachweisen.
- `cbc25e1` – M1-Abnahme B: Image-SBOMs und Lizenztexte mit offenen Zuordnungen.
- Dieser Dokumentationscommit – Abschlussbericht und zusammengefasster Laufnachweis.

## Wiederholung und Protokolle

Einstieg und Voraussetzungen: [betrieb/abnahme/README.md](../../../betrieb/abnahme/README.md). Der gesamte Lauf wurde nach den Einzelproben nochmals ueber den Einstieg ausgefuehrt:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File betrieb/abnahme/abnahme.ps1 `
  -Arbeitsordner "$env:LOCALAPPDATA/Temp/planora-abnahme-b-replay"
```

Ergebnis: Exit 0, **375.9 s**, einschliesslich Bundle-/Rootfs-Bau aus Cache, frischer Installation, beiden Timern, lokalem Restore, Verwerfen der Distribution, Ersatzhost, Wiederherstellung, Lizenzsammlung und Dossier-Selbstpruefung. Die spaeter geaenderte Abschlussmeldung nennt nun ausdruecklich die Lizenztextluecken; das Ergebnis ist keine vollstaendige M1-Freigabe.

Protokolle unter [betrieb/abnahme/nachweise/2026-11-11](../../../betrieb/abnahme/nachweise/2026-11-11): nur Zeichenkodierung und nachgestellte Leerzeichen normalisiert. SBOMs, Texte, Metadaten, exakter Build-Lockfile und Pruefsummen sind im [committeten Dossier](../../../betrieb/abnahme/dossier-2026-11-11) enthalten. Image-Archive, unverschluesselte Host-Secrets und private Schluessel liegen nicht im Repo.

| Pruefung | Ergebnis | Dauer/Nachweis |
|---|---|---|
| `app`: `npm.cmd ci --no-audit --no-fund` | Exit 0, 156 Pakete installiert | 7.88 s |
| `app`: `npm.cmd test` | 250 bestanden, 24 uebersprungen; 30 Testdateien bestanden, 3 uebersprungen | 43.58 s |
| `app`: `npm.cmd run pruefe:typen` | Exit 0 | Nicht separat gemessen |
| `linux.sh` im Gesamtlauf | Zwei frische Installationen offline, beide HTTPS-Healths gesund, UID-/Bind-/Isolationspruefung bestanden | 10:41:24–10:42:57, 93 s; `linux.log` |
| `timer.sh` | 2/2 echte Timer-Ausloesungen, jeweils `Result=success`, `ExecMainStatus=0`; Lieferplan wieder aktiv | Ausloesungen 10:42:59 und 10:43:05; `timer.log` |
| `probe.mjs vorbereiten` | 1 Admin, 1 Liegenschaft, 1 referenzierte Datei, 1 Session, gepruefter echter Sicherungssatz | Im Gesamtlauf enthalten |
| `restore-probe.sh` | Daten-/Hash-Pruefung, Konten-/Worker-Sperre, TTY-Freigabe, neues Passwort/Login und neue Sicherung bestanden | 10:43:20–10:43:57, 37 s; `restore-lokal.log` |
| `totalverlust.sh` | Ersatzumgebung anfangs ohne Container/Volumes; Bootstrap, neuer Cluster, Restore, Daten, TTY-Freigabe, Login und systemd-Wiederanlauf bestanden | 10:44:12–10:45:23, 71 s; `totalverlust-host.log` |
| `dossier.mjs`, `upstream-lizenzen.py` | Vier Images gescannt; Lizenzdateien/Standardtexte gesammelt; 14 Fehlstellen gelistet | Im Gesamtlauf von 375.9 s enthalten |
| `pruefe-dossier.py` | 4 Images, 12 SBOM-Dateien, 1099 Paketvorkommen, 50 Standardtexte, 529 Upstream-Pakete | Exit 0; nach Normalisierung erneut bestanden |
| Dossier-Pruefsummen im Git-Index | 30/30 stimmen auch mit den tatsaechlich eingecheckten Bytes ueberein | Exit 0 |
| Bash-/Node-/PowerShell-Syntax und `git diff --check` | Bestanden | Vor Abschluss geprueft |

Die bekannte pg-Deprecation-Warnung zu gleichzeitigen Queries trat im normalen Testlauf auf; kein Test scheiterte daran. Ueberlappende Einzel- und Gesamtlaufzahlen werden nicht addiert.

## Punkt 1: Frischer Linux-Ersatz

Neue WSL2-Distribution `planora-abnahme`, Debian-Rootfs mit systemd als PID 1, Node 24.22.2, eigener Docker 29.0.0, containerd-Image-Speicher und Compose 5.7.0. Die vier Pflichtimages werden vorher archiviert und in einem Wegwerf-Release mit Ed25519 signiert. Installation laedt die Archive und prueft die Image-Referenzen ohne Pull. Ausgehender IPv4-Verkehr ist waehrend beider Installationen am WSL-Interface gesperrt; der negative externe HTTPS-Aufruf trifft die REJECT-Regel. Keine IPv6-Default-Route vorhanden; das Skript verweigert dieses Offline-Profil andernfalls.

`planora-pb-1` und `planora-pb-2` haben getrennte Datenvolumes und Netze sowie Ports 18602/18603 und 18604/18605. Die unveraenderten Betriebswerkzeuge geben den Projektnamen `planora-` vor; diese Ressourcen existieren ausschliesslich im eigenen Daemon der reservierten Distribution. Aeussere Container/Image-Tags tragen `pb-`.

Echte Linux-Dateirechte: Backup-Ziel und Backup-Konfiguration UID/GID 1000, Verzeichnisse 0700, Inventar 0600; DB-Secret-Kopie UID/GID 999 und App-Secret-Kopie UID/GID 1000, beide 0600. Secret-Mounts sind nachweislich Bind-Mounts und read-only. Beide Betriebsdienste und Timer sind enabled/active. Temporaere Timer-Drop-ins loesen die echten Backup-Dienste aus und werden anschliessend entfernt.

[A] Ersatz statt VM: WSL teilt den Kernel und den Windows-/WSL-Lebenszyklus; keine Hypervisor-, reale VM-Netzwerk-, Kundenstorage- oder On-Premise-Abnahme. `kmod-static-nodes.service` ist im importierten Rootfs fehlgeschlagen, Docker und Planora-Dienste laufen. Die Abweichungen sind Teil dieses Nachweises und keine behauptete echte VM-Abnahme.

## Punkt 7: Totalverlust und frischer Ersatzhost

Nach Sicherung und erfolgreichem ersten Restore wird `wsl --unregister planora-abnahme` ausgefuehrt. Dadurch gehen saemtliche Datenbanken, Dokumente, Docker-Volumes, Host-Konfigurationen und Secrets dieser Distribution verloren. Ein neuer Import derselben leeren Rootfs hat keine Container/Volumes und einen anderen Docker-Daemon: vorher `36c5b477-1a0b-43f9-b3a1-927a50eccccc`, nachher `0f99e658-bba9-492c-a902-f189aee582dc`.

Ueberleben duerfen nur das signierte Offline-Bundle samt oeffentlichem Schluessel, oeffentliche Bootstrap-Metadaten, das extern archivierte verschluesselte Sicherungsziel und der separat bereitgestellte Recovery-Key. Das verschluesselte Inventar wird entschluesselt und auf Instanzbindung geprueft; daraus werden Secrets mit den erforderlichen UID-Rechten neu materialisiert. Der Cluster wird separat mit Minimalrollen/Basismigrationen provisioniert, danach erzeugt der vorhandene Host-Restore eine neue leere Zieldatenbank fuer den Import. Kein altes Volume und keine unverschluesselten alten Host-Secrets werden zurueckkopiert.

Nach Restore: Liegenschaft und referenzierte Datei vorhanden; Dateihash `cd03aef0712b048597f3fd4a88151ec92eb710f72e197cb386824aeed66140f7` korrekt; Sessions, Verifications und Setup-Tokens leer; Konto `zu_bestaetigen`, Worker `restore_gesperrt`. Expect bedient eine echte lokale PTY, bestaetigt ausdruecklich `ja`, liest den Freigabe-Token intern und loest ihn mit einem neuen zufaelligen Passwort ein. Danach Konto aktiv, Restore-Sperre aufgehoben und Anmeldung HTTP 200. systemd-Betriebsdienst und Timer starten erneut.

[A] TTY-Bedienung und Wegwerf-Admin sind automatisiert. Identitaetspruefung und organisatorische Host-Freigabe eines echten Betreibers bleiben menschliche Aufgaben. Der Recovery-Key liegt fuer die Probe separat im externen Arbeitsverzeichnis, nicht auf einem tatsaechlich versiegelten Offline-Medium.

## Punkt 5: Dossier und verbleibende Luecke

Syft ist per Digest gepinnt; Scans laufen mit `--network none` direkt gegen die gelieferten Image-Archive. Je Image gibt es SPDX-, CycloneDX- und vollstaendige Syft-JSON-Ausgaben, komprimiert. Signatur, Image-IDs, Archiv-SHA256, Dateipruefsummen und Build-Lockfile sind dokumentiert.

| Pflichtimage | Paketvorkommen | Lizenz-/Notice-Dateien im gelieferten Rootfs |
|---|---:|---:|
| App | 354 | 342 |
| Backup | 413 | 295 |
| PostgreSQL | 151 | 144 |
| Caddy | 181 | 0 |

1099 sind Paketvorkommen ueber vier Images, keine 1099 verschiedenen Komponenten. Zusaetzlich werden 529 unterschiedliche npm-/Go-Quellpakete anhand ihrer Version beziehungsweise ihres Registry-Git-Commits untersucht; 515 liefern eigene Lizenzdateien, 14 bleiben offen. 50 referenzierte SPDX-Standardtexte sind vorhanden. Fuer Caddy, restic und gosu werden die dokumentierten Upstream-Release-Lizenztexte gesammelt, wenn die binaeren Hauptmodule keinen aufloesbaren kanonischen Modulpfad/Version tragen [A].

Die 14 Fehlstellen stehen einzeln mit Version und Grund in [OFFENE-TEXTE.md](../../../betrieb/abnahme/dossier-2026-11-11/OFFENE-TEXTE.md), Quellen/Pruefsummen in `upstream-nachweis.json`, Zuordnungen in `lizenz-zuordnung.json`. Darunter sind native Teilpakete, Pakete ohne mitgelieferte Lizenzdatei sowie das private Planora-Paket und eine mitgelieferte Fixture-Komponente. Scanner-Metadaten ohne eindeutigen SPDX-Ausdruck bleiben zusaetzlich in `nachweis.json` sichtbar. **Eine vollstaendige komponentengenaue Text-/Notice-Abdeckung wird nicht behauptet.** Weitere automatische Quellsuchen sind geparkt; zustandiger Lizenz-Owner muss Zuordnung und fehlende Texte klaeren. Keine menschliche oder juristische Lieferfreigabe.

## Fehlversuche, Grenzen und Restzustand

- Rootfs-Bau anfangs mit falschem containerd-Dateipfad: nach Korrektur auf das digest-gepinnte Docker-29.0.0-Dind-Image erfolgreich; kein Endlos-Retry.
- Klassischer Image-Speicher erkennt die vom Docker-Desktop-Bundle erzeugten Referenzen nicht; Compose 2.40.3 scheitert bei `--wait` fuer den Worker ohne Healthcheck. Beide Profile geparkt; nur containerd-Speicher/Compose 5.7.0 nachgewiesen [A]. Keine universelle Freigabe aller allgemeinen Mindestversionen.
- Erster Keygen-Aufruf ohne passende UID scheiterte; nur fuer Wegwerf-Keygen wird nun explizit UID 0 verwendet. Laufender Backup-/Restore-Dienst bleibt UID 1000.
- Erste Timer-Probe wartete kuerzer als `RandomizedDelaySec=300`; temporaeres Drop-in setzt fuer den Nachweis auch die Zufallsverzoegerung auf 0. Originalplan danach wiederhergestellt [A].
- Ein erster lokaler Host-Restore brach mit der generischen Host-Fehlermeldung ab; DB-Sperre/Wartung separat erfolgreich geprueft, neuer Restore-Aufruf und anschliessender Gesamtlauf erfolgreich. Keine unbelegte Ursache behauptet.
- Erster Ersatzhost scheiterte an durch `umask 077` nicht lesbarem oeffentlichem Caddyfile; Bundle-Rechte korrigiert, Ersatzumgebung erneut komplett verworfen/importiert und erfolgreich geprueft.
- Eigene Distribution am Ende abgemeldet; abschliessend nur `docker-desktop` in der WSL-Liste. Keine anderen Distributionen verwaltet, kein Docker-Prune, keine fremden Projekte/Volumes geloescht. Eigene `pb-`-Image-Tags und externe Wegwerf-Nachweise bleiben lokal erhalten.
- Weiter offen: 14 technische Lizenztext-/Notice-Zuordnungen, menschliche Lizenz-/Lieferfreigabe und echte VM-/Betreiberabnahme. Kunden-CA, Retention-Freigabe, externer Alarmkanal und gegebenenfalls CH-S3 liegen ausserhalb Spur B und werden hier nicht geschlossen.
