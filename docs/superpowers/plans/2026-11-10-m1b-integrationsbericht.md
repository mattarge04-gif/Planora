# M1b Integrationsbericht, 2026-11-10

Die beauftragten Integrationsanschluesse sind implementiert und lokal geprueft. **M1 ist noch nicht technisch abnahmebereit**, weil reale Linux-/CH-S3-Abnahmen, gemeinsame Retention-Politik und menschliche Lizenzfreigaben ausstehen. Kein Push und kein Merge nach main.

## Commits und Umfang

| Commit | Inhalt |
|---|---|
| `9171869` | Originalzweig A zusammengefuehrt, Paket und Update |
| `746fe96` | Originalzweig B zusammengefuehrt, additive npm-Scripts/Lockfile und beide Notiz-Sektionen erhalten |
| `c226252` | Installation, externe Inventare, echtes Backup, Journal, Host-Reconcile, Timer, Worker-Sperre und Restore-Rueckweg |
| `e47eefe` | Admin-Anbindung und Lizenz-Dossier-Geruest |
| dieser Abschluss-Commit | kombinierte Docker-Abnahme, Dossier-Selbstpruefung, UTF-8/LF fuer Betriebsdateien und Betriebsdokumentation |

Die Originalzweige bleiben auf `382dbda` und `c2dfb29`, main auf `4af0a27`. Das Ausgangsarbeitsverzeichnis war sauber; keine fremde uncommittete Arbeit wurde veraendert. Keine lokale AGENTS.md im Projekt oder dessen Vorfahren gefunden. Normative Prioritaet: Spec Paragraph 15 vor 14 vor Rest.

Der Restore-Rueckweg verwendet eine neue Datenbank im vorhandenen Cluster und den separat bereitgestellten Offline-Key. Die vorhandene Datenbank wird erhalten. Der Import laeuft als Migrator mit der Eigentuemerrolle; Rollen-Provisionierung verwendet einen begrenzten temporaeren CREATEROLE-Login. Nach erfolgreichem Import werden nur dessen temporaere Grants entfernt, nicht die restaurierten Daten. Konten bleiben bis zur Host-Bestaetigung gesperrt; erst die Host-Token-Einloesung hebt die Worker-Sperre auf. Der Worker liest beide Flags gemeinsam und bleibt bei DB-Fehlern geschlossen.

Bei einem kompatiblen Image-Rueckweg bleiben die neuen Migrationen erhalten. Deshalb bleibt das passende, signierte Schema-/Recovery-Bundle erhalten; eine Folgesicherung wurde gegen dessen Restore-Manifestpruefung getestet. Eigenstaendige Restore-Aufrufe bekommen jeweils einen neuen Auftrag, Update-Wiederaufnahme verwendet die stabile Update-ID.

Die minimale Admin-Anbindung ist eine geschuetzte API fuer Benutzer-/Rollen-/Scope-/Journal-Sicht und die Bestaetigung weiterer Nicht-Admin-Konten. Eine komplette Admin-Oberflaeche wurde nicht gebaut. Das Lizenzwerkzeug erzeugt ungepruefte Release-/npm-Metadaten und eine Freigabe-Checkliste, keinen vollstaendigen Image-SBOM.

## Tatsaechliche Validierung

| Pruefung | Ergebnis |
|---|---|
| `cd app && npm.cmd test` | 234 bestanden, 23 Docker-Tests uebersprungen; 38.04 s |
| `npm.cmd run pruefe:typen` | bestanden; TypeScript umfasst src, normale Tests und Docker-Tests |
| Paket-Docker-Test | 13/13 bestanden; 87.34 s; Projekt `planora-paket-1110`, Ports 22880/22843 |
| Backup-/Restore-Docker-Test | 5/5 bestanden; 66.73 s; Projekt `planora-backup-1110`, DB-Port 26571 |
| Kombinierter Docker-Test | 5/5 bestanden; 198.19 s; Projekt `planora-integration-final1110-u`, Ports 21881/21844 |
| Letzte gezielte Restore-Pruefung nach Auftragsbindung | 1/1 bestanden, 4 andere Tests bewusst ausgewaehlt uebersprungen; 111.60 s |
| `bash -n betrieb/planora`, `git diff --check` | bestanden |

Die Zahlen sind getrennte Prueflaeufe; alte 179/150 werden nicht addiert. Docker Engine 29.9.3 auf Docker Desktop/Windows, Linux-Container. Der kombinierte Test baut echte App- und Backup-Images beider Releases, verwendet signierte Manifeste und den echten Installationsadapter. Er umfasst realen Dump/restic/age, initialen Journal-Stand, einen hart beendeten laufenden Dump mit nachgewiesenem Host-Reconcile, DB-Lock-Verlust, Update-Abbruch und Wiederaufnahme, inkompatiblen Restore in ein frisches Ziel sowie Konten- und Worker-Sperre bis Host-Freigabe. Der bisherige Backup-Stub ist entfernt. Der isolierte Backup-Test deckt zusaetzlich parallele Dateireferenzwechsel, Hash-Pruefung und die Restore-Negativfaelle ab.

Fruehe kombinierte Laeufe scheiterten. Behoben wurden falsches Recovery-Image, fehlendes Schema-CREATE-Recht, ein faelschlich auf die Betriebsrolle uebertragener SET-ROLE-Verbindungsparameter und temporaere Rollen-Grants. Die spaeteren erfolgreichen Laeufe ersetzen diese fehlgeschlagenen Zwischenstaende. Ein fehlerhafter zusaetzlicher Parallelstart mit demselben Projekt-/Image-Namen wurde beendet und seine Ressourcen entfernt; die Test-Dateisperre verhindert diese Kollision nun vor dem Build. Die normale Pruefung meldet weiterhin eine pg-Deprecation-Warnung zu gleichzeitigen Queries; kein Test scheitert daran.

## Ponytail

Originalquelle: [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail/tree/96608e078b2d5ea607c5c3b8b5a54d1c1fba6846/skills/ponytail). Installation mit dem offiziellen Codex-Skill-Installer nach erfolgloser Suche in Codex-/Claude-/Orca-Skill-Verzeichnissen. Installationsort:

`C:/Users/matta/AppData/Roaming/orca/codex-accounts/f4347bf7-17fe-4837-8e9f-24e187f248f4/home/skills/ponytail/SKILL.md`

SKILL.md SHA-256: `9badd22a32e19cb884e46dfa8d3aae82bb81dfa5484105b8b4f0262df823a509`. Die echte Datei wurde gelesen und im Modus full verwendet: vorhandene Restore-/Backup-/Freigabe-Module weiterverwenden, Host-Werkzeug nur mit Node-Standardbibliothek, keine neue Dependency und keine Abkuerzung der Sicherheitspruefungen. Die Installation bleibt fuer folgende Turns verfuegbar.

## Restliche Abnahme und Aufraeumen

- Frische Linux-VM: gesamter Start mit echten Host-Bind-Mounts, UID-/Dateirechten, systemd-Start und Timer. Die Vorlagen und automatische Aktivierung sind implementiert; hier auf Windows nicht ausgefuehrt.
- CH-S3: reale Credentials/Endpoint, Wiederherstellung und Betriebsfreigabe. Der vorhandene S3-Adapter bleibt ohne realen Nachweis; die verdrahtete Installation verwendet ein lokales Dateisystemziel.
- Gemeinsame Retention-Politik mit PO 4: bisherige konservative Aufbewahrung von Inventar/Journal beibehalten, keine unbestaetigte Loeschroutine ergaenzt.
- Vollstaendige Image-SBOMs, Lizenztexte und menschliche Lizenz-/Lieferfreigabe. Dossier-Geruest bleibt explizit UNGEPRUEFT.
- Organisatorische Host-Freigabe bei On-Premise sowie Anschluss an einen produktiven externen Alarmkanal. Die Tests belegen die Logs und lokalen Zustandswechsel.
- VM-Totalverlust: frischen Cluster nach dem vorhandenen Spur-B-Vertrag provisionieren; der neue Host-Rueckweg automatisiert den Fall mit noch vorhandenem Cluster, nicht die Bereitstellung einer Ersatz-VM.

Alle eigenen Compose-Container, Volumes, Netze und Test-Image-Tags wurden entfernt. Basis-Images, Build-Cache und fremde Projekte blieben erhalten; kein docker system prune. Keine Produktions-Secrets im Repository.

Die automatische Freigabepruefung lehnte den kombinierten Aufraeumbefehl mit rekursivem Loeschen von `C:/Users/matta/AppData/Local/Temp/planora-update-docker-fNzKsc` mit der Meldung `blocked by policy` ab. Das eigene Compose-Projekt wurde anschliessend separat erfolgreich abgebaut; das temporaere Verzeichnis mit Wegwerf-Testmaterial wurde stehen gelassen und die Loeschsperre nicht umgangen.
