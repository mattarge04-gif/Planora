# M1-Abnahme Spur A, 2026-11-11

Branch `mattarge04-gif/m1-abnahme-a`, Basis `main` (`ae3f5b5`). Kein Push, kein Merge. Bearbeitet wurden die lokal nachweisbaren Abnahmepunkte 2, 3 und 4 aus [Fortsetzung](2026-11-11-fortsetzung.md#m1-abnahme-weiterhin-offen). Bedienung und Regeln stehen in [betrieb/README.md](../../../betrieb/README.md).

## Ergebnis

| Punkt | Stand | Commit |
|---|---|---|
| 2 Kunden-CA | umgesetzt und lokal nachgewiesen (positiv/negativ, Rotation) | `b277121` |
| 3 Retention | umgesetzt und lokal nachgewiesen; Politik 14/8/12 bleibt **[A] bis PO-Freigabe** | `7a27d60` |
| 4 Alarmkanal | Mechanismus umgesetzt und gegen Mock nachgewiesen; **produktiver Kanal ist PO-Entscheid** | `f4b0499` |

### Punkt 2: Kunden-CA

- `planora install --tls kundenzertifikat --tls-zertifikat <kette.pem> --tls-schluessel <key.pem>` prueft vor jeder Aenderung: Schluesselpaar, Domain (subjectAltName), Gueltigkeit, Kettenreihenfolge und unverschluesselten Schluessel. Unter 30 Tagen Restlaufzeit gibt es eine Warnung [A].
- Ablage unter `/etc/planora/<instanz>/tls/`, mit `PLANORA_TLS=/zertifikat/cert.pem /zertifikat/key.pem` und `PLANORA_TLS_VERZEICHNIS`. `compose.yaml` bindet das Verzeichnis nur lesend nach `/zertifikat`. Ohne Kunden-CA bleibt dort ein leeres benanntes Volume; die Compose-Dateiliste bleibt unveraendert.
- Rotation mit `planora zertifikat`: Pruefung zuerst, dann Sicherung `*.vorher`, atomarer Ersatz und Proxy-Neustart. Danach vergleicht der Befehl das ausgelieferte Zertifikat; bei Abweichung rollt er zurueck.
- Test-CA, fremde CA und Serverzertifikate erzeugt openssl zur Laufzeit in Temp-Verzeichnissen. Im Repo liegen keine Schluessel.

### Punkt 3: Retention

- `planora aufbewahren` laeuft nach erfolgreicher naechtlicher Sicherung. Die Politik ist ueber `PLANORA_RETENTION_TAEGLICH/WOECHENTLICH/MONATLICH` in `backup.env` konfigurierbar; der Standard ist der Vorschlag 14/8/12 **[A]**. Die Werte bleiben bei Update/Restore erhalten.
- Die Auswahl implementiert Planora selbst, nicht restic `--keep-*`. Grund: Jeder Satz hat einen eigenen Pfad und restic gruppiert standardmaessig nach Host und Pfad. Je Tag, ISO-Woche und Monat in der Instanz-Zeitzone vertritt der juengste gepruefte Satz den Bereich. Ein fehlgeschlagener Satz tut das nur, wenn der Bereich keinen geprueften hat [A]. Laufende, ungepruefte und unbekannte Saetze werden nie entfernt.
- Ablauf: `restic forget <ids>`, dann Inventar loeschen und `backup_lauf.zustand='entfernt'` setzen (Migration `012_retention.sql`). Danach Journal-Objekte bis zur kleinsten Journal-Sequenz aller behaltenen Saetze loeschen und `restic prune`. Jeder Lauf gleicht Saetze ohne Snapshot nach. Audit: `backup.entfernt` und `backup.retention`.
- Die DB-Tabelle `loesch_journal` wird bewusst nicht gekuerzt.

### Punkt 4: Alarmkanal

- `alarm.json` enthaelt keine Secrets; HMAC und SMTP-Passwort liegen als Dateien unter `secrets/`. Webhook nur ueber HTTPS, optional mit eigener CA. Signatur: `X-Planora-Signatur: v1=HMAC-SHA256(secret, "<zeit>.<body>")`, Toleranz +/-300 s. SMTP optional (STARTTLS/implizites TLS, AUTH PLAIN nur ueber TLS).
- Jeder Alarm geht zuerst in den Spool und ins Journal `alarm/journal.jsonl`. Zustellfehler bleiben offen und werden je Kanal wiederholt, mit 1 bis 60 Minuten Abstand [A]: vom Betriebsdienst alle 5 Minuten und bei jedem Host-Befehl.
- Angebunden sind: naechtliche Sicherung und Retention (systemd-Unit jetzt `host-cli.js sichern`), Reconcile (Fehler sowie Warnung bei bereinigten Abbruechen), Start, Restore, Update und Zertifikatsrotation. Dazu kommen `planora alarm --test|--wiederholen`.
- Der Betriebsdienst beendet sich bei einem Reconcile-Fehler nicht mehr; er alarmiert und laeuft weiter.

## Tatsaechliche Validierung

Linux-Container auf Docker Desktop/Windows. Docker-Projekte mit Praefix `pa-`, Ports ab 18400. Alle eigenen Container, Volumes, Netze und Test-Images sind nach den Laeufen entfernt.

| Pruefung | Ergebnis |
|---|---|
| `cd app && npm ci` | bestanden |
| `npm test` (Endstand) | 284 bestanden, 35 Docker-Tests uebersprungen (33 Dateien) |
| `npm run pruefe:typen` | bestanden |
| `bash -n betrieb/planora`, `git diff --check` | bestanden |
| Docker `test-docker/kundenzertifikat.test.ts` (pa-tls, 18400/18401) | 4/4 bestanden, 28 s |
| Docker `test-docker/backup-retention.test.ts` (pa-backup, 18405) | 3/3 bestanden, 83 s (nach Umbau auf gemeinsame Hilfe erneut) |
| Docker `test-docker/alarm.test.ts` (pa-alarm, 18406/18410) | 4/4 bestanden, 32 s |
| Docker `paket.test.ts` + `update.test.ts` (Regression; pa-paket, 18420 bis 18422) | 19/19 bestanden, 280 s |
| Docker `backup.test.ts` (Regression; pa-b-alt, 18407) | 5/5 bestanden, 67 s (Config `vitest.docker-b.config.ts`) |

Die Zahlen stammen aus getrennten Laeufen und werden nicht addiert. Im ersten Alarm-Docker-Lauf meldete die Testumgebung „Connection terminated unexpectedly“. Ursache: Der Socket-Healthcheck meldet den Init-Server, waehrend Docker Desktop TCP schon annimmt. Die Testhilfe wartet jetzt auf eine echte DB-Verbindung; der Wiederholungslauf war gruen.

## Offen und Annahmen

- [A] Retention 14/8/12 bis PO-Freigabe. Die Zeitzone ist die der Instanzkonfiguration. Fehlgeschlagene Saetze dienen nur als Ersatzvertreter.
- [?] PO-Entscheid zum produktiven Alarmkanal: Webhook-Ziel oder SMTP-Relay, Empfaenger, Eskalation/Pikett. Bisher sind nur Mechanismus und Mock nachgewiesen.
- [A] Wiederholungsabstand 1 bis 60 Minuten, kein Verfall offener Alarme. Logs des Journal-Containers und systemd-Logs sind nicht an den Alarm angebunden.
- Bestehende Installationen brauchen die neue Unit `planora-sicherung@.service`. Das Update-Werkzeug aktualisiert systemd-Units nicht; die Installation ersetzt abweichende Units nicht.
- [A] Zertifikatsablauf wird nur bei Installation und Rotation gewarnt, nicht laufend ueberwacht. Ein Wechsel zwischen `internal`/`acme` und Kunden-CA bei bestehender Instanz ist nicht automatisiert.
- SMTP ist nur gegen einen lokalen Mock geprueft (STARTTLS/AUTH), nicht gegen ein reales Relay. S3-`loesche` ist implementiert, aber wie der gesamte S3-Adapter ohne realen Nachweis.
- Nicht Teil von Spur A: frische Linux-VM, Lizenz/SBOM, CH-S3, VM-Totalverlust (Punkte 1, 5, 6, 7).
