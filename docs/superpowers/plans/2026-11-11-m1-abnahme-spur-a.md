# M1-Abnahme Spur A, 2026-11-11

Branch `mattarge04-gif/m1-abnahme-a`, Basis `main` (`ae3f5b5`). Kein Push, kein Merge. Bearbeitet wurden die lokal nachweisbaren Abnahmepunkte 2, 3 und 4 aus [Fortsetzung](2026-11-11-fortsetzung.md#m1-abnahme-weiterhin-offen). Bedienung und Regeln stehen in [betrieb/README.md](../../../betrieb/README.md).

## Ergebnis

| Punkt | Stand | Commit |
|---|---|---|
| 2 Kunden-CA | umgesetzt und lokal nachgewiesen (positiv/negativ, Rotation) | `b277121` |
| 3 Retention | umgesetzt und lokal nachgewiesen; Politik 14/8/12 **vom PO am 2026-11-11 freigegeben** | `7a27d60` |
| 4 Alarmkanal | umgesetzt; PO-Entscheid 2026-11-11: SMTP ueber den Planora-Mailserver an Planora-Kundenadresse + Konto-Adressen aus der DB | `f4b0499` |

### Punkt 2: Kunden-CA

- `planora install --tls kundenzertifikat --tls-zertifikat <kette.pem> --tls-schluessel <key.pem>` prueft vor jeder Aenderung: Schluesselpaar, Domain (subjectAltName), Gueltigkeit, Kettenreihenfolge und unverschluesselten Schluessel. Unter 30 Tagen Restlaufzeit gibt es eine Warnung [A].
- Ablage als ein Paar unter `/etc/planora/<instanz>/tls/paar.pem` (seit PP11a-5; vorher getrennt `cert.pem`/`key.pem`), mit `PLANORA_TLS=/zertifikat/paar.pem /zertifikat/paar.pem` und `PLANORA_TLS_VERZEICHNIS`. `compose.yaml` bindet das Verzeichnis nur lesend nach `/zertifikat`. Ohne Kunden-CA bleibt dort ein leeres benanntes Volume; die Compose-Dateiliste bleibt unveraendert.
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

- Retention 14/8/12: PO-Entscheid 2026-11-11. Die Zeitzone ist die der Instanzkonfiguration. Fehlgeschlagene Saetze dienen nur als Ersatzvertreter.
- Alarmkanal: PO-Entscheid 2026-11-11 umgesetzt (siehe Nachtrag PO-Entscheide). Frueher: Webhook-Ziel oder SMTP-Relay offen; bisher waren nur Mechanismus und Mock nachgewiesen.
- [A] Wiederholungsabstand 1 bis 60 Minuten, kein Verfall offener Alarme. Logs des Journal-Containers und systemd-Logs sind nicht an den Alarm angebunden.
- Bestehende Installationen brauchen die neue Unit `planora-sicherung@.service`. Das Update-Werkzeug aktualisiert systemd-Units nicht; die Installation ersetzt abweichende Units nicht.
- [A] Zertifikatsablauf wird nur bei Installation und Rotation gewarnt, nicht laufend ueberwacht. Ein Wechsel zwischen `internal`/`acme` und Kunden-CA bei bestehender Instanz ist nicht automatisiert.
- SMTP ist nur gegen einen lokalen Mock geprueft (STARTTLS/AUTH), nicht gegen ein reales Relay. S3-`loesche` ist implementiert, aber wie der gesamte S3-Adapter ohne realen Nachweis.
- Nicht Teil von Spur A: frische Linux-VM, Lizenz/SBOM, CH-S3, VM-Totalverlust (Punkte 1, 5, 6, 7).

## Nachtrag: Codex-Review PP11a (nicht OK) behoben

Jeder Befund hat einen gezielten Regressionstest. PP11a-9 betraf nur die Testumgebung (`npm.cmd` unter Windows); dort war kein Fix noetig, die Laeufe nutzen `npm.cmd`.

| Befund | Behebung | Regressionstest |
|---|---|---|
| PP11a-1 [hoch] Journal-Kuerzung trotz laufender Sicherung | Laufen Saetze (`laufend`/`gesichert`), wird das Journal nicht gekuerzt. Die Grenze liegt hoechstens beim Journal-Zaehler, der vor den Zustaenden gelesen wird; jede spaeter begonnene Sicherung hat eine Sequenz oberhalb davon. | Unit (laufend/gesichert, Zaehlergrenze). Docker `backup-ueberlappung.test.ts`: A angehalten, B gesichert, Retention, A fortgesetzt und samt Journal restauriert. Gegenprobe ohne Fix: Journal 1..3 geloescht, Test rot. |
| PP11a-2 [hoch] juengster gepruefter Satz nicht geschuetzt | Der juengste gepruefte Satz wird immer behalten. | Unit (Politik 1/0/0, neuerer fehlgeschlagener Satz) |
| PP11a-3 [hoch] Rueckweg-Satz offener Updates | Sicherung und Retention nehmen dieselbe Dateisperre wie Update/Restore; laeuft eines davon, wird der Lauf ausgesetzt. Bei offenem Update entsteht keine neue Sicherung, und die Retention laeuft mit `--reserviert <backupId>`. Die Sperrmeldung nennt den Zweck. | Unit (offenes/abgeschlossenes Update, lebende Sperre, Reservierung). Docker `update.test.ts`: abgebrochenes inkompatibles Update, naechtlicher Lauf mit Politik 1/0/0, danach erfolgreicher Rueckweg. |
| PP11a-4 [hoch] ungueltige Alarmkonfiguration quittiert Spool | Ohne gueltige Konfiguration wird nichts zugestellt oder geloescht. Jeder Eintrag speichert seine erforderlichen Kanaele; ein entfernter Kanal haelt den Alarm offen. | Unit (ungueltig, Kanalwechsel, Wiederherstellung) |
| PP11a-5 [mittel] gemischtes Paar und Rueckrollen | Kette und Schluessel liegen als ein Paar in `paar.pem` und werden mit einem atomaren rename gewechselt. Die Sperre `wechsel.lock` serialisiert Wechsel. Jeder Fehler nach der Sicherung rollt zurueck, auch beim Ersatz und beim Neustart. | Unit (werfender Neustart, auch beim Zurueckrollen; parallele Rotation). Docker Kunden-CA mit `paar.pem` gegen echtes Caddy. |
| PP11a-6 [mittel] manuelle Befehle ohne Alarm | `planora sichern` und `planora aufbewahren` laufen ueber `host-cli`, mit Sperre, Koordination und Alarm. | Unit `planora-einstieg.test.ts`: echtes Shell-Skript, Platzhalter-Werkzeug protokolliert die Argumente. |
| PP11a-7 [mittel] prune nach Abbruch nie nachgeholt | Persistente Markierung `retention/<instanz>/prune-offen` im Ziel; der naechste Lauf prunt auch ohne forget. | Unit (Abbruch im prune, Nachholen, danach kein prune mehr) |
| PP11a-8 [mittel] Dienst endet bei Reconcile-Fehler | Neue Funktion `betriebsDienst`: Fehler bei Start oder Reconcile werden abgefangen und alle 5 Minuten wiederholt, bis der Start gelingt, danach stuendlich. Gleiche Stoerungen werden aggregiert (Erinnerung nach 24 h [A], `Behoben`-Meldung). Der Spool ist auf 200 offene Alarme begrenzt [A]. | Unit (Dienst mit 4 Fehlrunden, Aggregation, Begrenzung). Docker Alarm: wiederholter Sicherungsfehler wird aggregiert, nicht erneut gesendet. |

Validierung nach den Fixes:

| Pruefung | Ergebnis |
|---|---|
| `npm.cmd test` | 298 bestanden, 37 Docker-Tests uebersprungen (34 Dateien) |
| `npm.cmd run pruefe:typen`, `bash -n betrieb/planora`, `git diff --check` | bestanden |
| Docker `backup-ueberlappung.test.ts` (pa-ueberlapp, 18408) | 1/1 bestanden, 55 s; Gegenprobe ohne Fix rot |
| Docker Kunden-CA + Alarm + Retention (pa-tls, pa-alarm, pa-backup) | 12/12 bestanden, 141 s |
| Docker `update.test.ts` + `paket.test.ts` (pa-paket) | 19/19 bestanden, 276 s (inkl. PP11a-3-Szenario) |

Hinweise: Durch PP11a-5 aendert sich der TLS-Wert auf `/zertifikat/paar.pem /zertifikat/paar.pem`. Das ist unkritisch, solange es keine Installation mit dem frueheren Branch-Stand gibt [A]. Haelt eine Sicherung die Update-Sperre, bricht ein gleichzeitig gestartetes Update mit der Meldung „Sperre durch laufende Sicherung“ ab und muss spaeter wiederholt werden.

## Nachtrag: Nachpruefung PP11a-N (OK mit Auflagen) behoben

| Befund | Behebung | Regressionstest |
|---|---|---|
| N-1 [mittel] Sicherung uebernimmt verwaiste Restore-Sperre | Der Restore setzt den Sperrzweck `Restore`. Die Sicherung uebernimmt nur verwaiste Sicherungssperren und die Sperre eines geordnet abgebrochenen Updates (Status `abgebrochen`/`migration_abgebrochen` in `update.json`). Bei aktiver Wartung wird nicht gesichert (Alarm `fehler`). Eine verwaiste fremde Sperre meldet `fehler`, ein laufender Vorgang nur `warnung`. | Unit: Wartung, tote Restore-Sperre, alte Update-Sperre ohne Zweck, geordnet abgebrochenes Update, Absturz mit Status `aktiv`. Docker: Alarm mit Wartungspruefung, Update/Rueckweg. |
| N-2 [mittel] verwaiste Sicherungssperre nach SIGTERM | SIGTERM/SIGINT geben die Sperre frei (Exitcode 143/130). Eine Sicherungssperre mit totem PID uebernehmen Update und Restore immer. | Unit: SIGTERM waehrend laufender Sicherung; Restore uebernimmt tote Sicherungssperre. |
| N-3 [mittel] haengender `gesichert`-Satz | `backup_reconcile` erfasst jetzt auch `gesichert` bei gestopptem Container und Heartbeat aelter als 10 Minuten (in Migration 012, nur auf diesem Branch). Bleibt die Journal-Kuerzung wegen offener Saetze aus, folgt eine Warnung (aggregiert, danach `Behoben`). | Unit gegen echtes Postgres: haengend vs. frischer Heartbeat. Unit Host: Warnung und Behoben. |
| N-4 [mittel] jedes offene Update stoppt die Sicherung | Ein Abbruch vor der Wartung (Schritt 0) blockiert nicht. Ab Schritt 1 wird die Sicherung ausgesetzt, mit Alarm `fehler` statt `warnung`. | Unit: Schritt 0 sichert, Schritt 1 blockiert. Docker `update.test.ts`: Schritt 6, Alarm `fehler`. |
| N-5 [niedrig] Erinnerung kollidiert mit Timer-Streuung | Erinnerung nach 20 h [A]. Eine geaenderte Fehlermeldung wird sofort neu gemeldet. | Unit |
| N-6 [niedrig] Ueberlauf unbemerkt, Journal waechst | Verworfene Alarme werden gezaehlt und bei der ersten erfolgreichen Zustellung als Sammelmeldung nachgereicht. `journal.jsonl` rotiert ab 5 MiB in eine Generation [A]. | Unit |
| N-7 [niedrig] Stoerungen ohne `behoben`, Datei ohne Sperre | `behoben` gilt auch fuer `update-offen`, `sicherung-gesperrt`, `wartung` und `journal-kuerzung`. `stoerungen.json` wird unter einer kurzen Dateisperre gelesen und geschrieben. | Unit (Behoben-Aufrufe, keine Sperrdatei zurueck) |
| N-8 [niedrig] `paar.pem`-Kompatibilitaet und Kommentare | Kommentare in Caddyfile, compose.yaml und Bericht nachgezogen. Der alte TLS-Wert wird im Backup weiterhin als `kundenzertifikat` erkannt. Die Rotation verlangt weiterhin `paar.pem` [A, keine Installation mit altem Layout]. | Unit `install-backup.test.ts` |
| Befund 8, Verdrahtung | `host-cli.ts` ist in `host-befehle.ts` (`hostBefehl`, Abhaengigkeiten injizierbar) und einen duennen Einstieg geteilt. | Unit `host-befehle.test.ts`: Dienst mit initialem Reconcile-Fehler, Sicherung/Retention ueber die Instanzpfade, Exitcode 75. |

## Nachtrag: PO-Entscheide 2026-11-11

1. **Retention 14 taeglich / 8 woechentlich / 12 monatlich ist freigegeben.** Die [A]-Markierung ist in Code, Test, Betriebsanleitung und Bericht entfernt.
2. **Alarmkanal:** Planora hostet Server, Domain und Mailserver; der Kunde hat keine IT. Kanal ist SMTP ueber den Planora-Mailserver; die Zugangsdaten liegen als Secret `alarm_smtp_passwort`. Der Webhook bleibt optional. Empfaenger je Alarm:
   - immer die feste Planora-Kundenadresse `smtp.planoraAdresse` der Instanz,
   - die E-Mail-Adressen der Kunden-Konten. Der Host liest sie bei jeder Zustellung ueber die neue DB-Funktion `alarm_empfaenger(p_alle)` (Migration 012, SECURITY DEFINER, nur Betriebsrolle). Standard `kontoEmpfaenger: "admins"` nimmt aktive Konten mit Admin-Rolle [A]; `"alle"` nimmt alle aktiven Konten. Gesperrte und zu bestaetigende Konten fallen heraus.
   - optional weitere feste Adressen in `smtp.empfaenger`.
   - DB-Ausfall (Zeitlimit 15 s [A]): Der Alarm geht an die zuletzt bekannte Liste aus `alarm/empfaenger.json` (nur bei gleichem Modus) und an die Planora-Kundenadresse; der Ersatz wird journalisiert. Ohne Cache geht er nur an die Planora-Kundenadresse.

   Tests: `alarm-empfaenger.test.ts` (Empfaengerermittlung, Modi, DB-Ausfall-Fallback mit und ohne Cache, Spool-Versand). `backup-migration.test.ts` gegen echtes Postgres: deaktiviertes und zu bestaetigendes Konto fallen heraus, Leser nur bei `alle`, kein Tabellenzugriff der Betriebsrolle.

Validierung nach N-Fixes und PO-Entscheiden:

| Pruefung | Ergebnis |
|---|---|
| `npm.cmd test` | 314 bestanden, 37 Docker-Tests uebersprungen (36 Dateien) |
| `npm.cmd run pruefe:typen`, `bash -n betrieb/planora`, `git diff --check` | bestanden |
| Docker Alarm (nach N-Fixes) | 5/5 |
| Docker `update.test.ts` (nach N-Fixes) | 6/6, 196 s |
| Docker Kunden-CA + Alarm + Retention + Ueberlappung (Endstand) | 13/13, 179 s |
| Docker `update.test.ts` + `paket.test.ts` (Endstand) | 19/19, 274 s; alle `pa-`-Ressourcen entfernt |

Offen: konkrete SMTP-Werte je Instanz (Mailserver, Absender, Planora-Kundenadresse); ein echter SMTP-Versand gegen den Planora-Mailserver ist noch nicht geprueft. Neue Annahmen [A]: Admin-Rolle als Standard-Empfaenger, Zeitlimit 15 s, Erinnerung 20 h, Journal-Rotation 5 MiB. Bewusst nicht umgesetzt: `restore_gesperrt` blockiert die Sicherung nicht, nur Wartung tut das. Nach einem Restore bis zur Freigabe ist die DB vollstaendig und soll gesichert werden.
