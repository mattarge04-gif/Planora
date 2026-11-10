# M1b – Annahmen und Integrationsnotizen

## Spur B

- Basislinie 2026-11-10: `npm.cmd ci`, `npm.cmd test`: 101 Tests gruen (Plan nennt noch 98). Windows: `npm.cmd` umgeht die gesperrte PowerShell-Skriptausfuehrung.
- B2 [A]: Vollstaendige restic-Datenpruefung am ersten UTC-Monatstag, sonst 5 Prozent; entspricht der vorlaeufigen Prueffrequenz aus Spec §7.1. Staging wird je Lauf nach Erfolg oder Fehler entfernt (Dump ohne Klartext-Rollenpasswoerter).
- Integration ausserhalb Datei-Eigentum: `betrieb/planora` (Spur A) muss die Backup-/Restore-/Freigabe-CLI aufrufen. Backup-Einstieg: `node dist/betrieb/backup/cli.js sichern --anlass update`; Exit 0 und letzte stdout-Zeile gemaess Vertrag.
- B3 [A]: S3-Objektadapter (AWS SDK, Apache-2.0) verwendet HTTPS, bedingte PUTs und paginierte Listen; echter CH-Endpunkt ist mangels Credentials ungetestet. restic-S3 wird ueber RESTIC_REPOSITORY und externe AWS-Umgebungsvariablen konfiguriert.
- B3: Runtime-Image PostgreSQL 18 + Node 24, restic 0.19.1 (BSD-2-Clause), age 1.3.2 (BSD-3-Clause); Images per Registry-Digest und Downloads per SHA-256 fixiert. Dossier/Freigabe der mitgelieferten Lizenzen bleibt beim Lizenz-Owner.
- B3: `npm run test:docker:b` nutzt eigene Config und Port 25432, normale Tests ueberspringen Docker. Overlay verlangt ein digest-gepinntes Release-Image und externe Env-/Secret-/Zielpfade; der Installationsprozess (Spur A) muss Ziel und Staging fuer UID/GID 10001 vorbereiten.
- B4: Journal-Versand speichert den zufaelligen age-Ciphertext vor dem PUT in der Outbox-Zeile; Wiederholungen vergleichen die gespeicherten Bytes. Online ist ausschliesslich der oeffentliche Empfaenger noetig, der private Recovery-Key bleibt offline. DB-Trigger erfassen Kontosperren und Rollen-/Scope-Entzuege atomar auch ueber M1a-Aufrufer.
- B4: Host-Timer muss minuetlich `node dist/betrieb/journal/cli.js --einmal` aufrufen, alternativ `--dienst` als dauerhaften Containerprozess; Fehler werden wiederholt, offene Eintraege ab 15 Minuten alarmiert. Reconcile benoetigt den expliziten Host-Nachweis, dass kein Backup-Container laeuft; ohne Docker-Socket entscheidet die DB dies nicht selbst.
