# M1-Betrieb

Zielhost: Linux mit systemd, Docker/Compose und Node.js ab 24. Die Windows-Docker-Tests ersetzen die Abnahme auf einer frischen Linux-VM nicht.

## Bundle und Installation

Ein signiertes Offline-Bundle enthaelt `planora`, beide Compose-Dateien, `Caddyfile`, `wartung.html`, die drei `planora-*@`-systemd-Vorlagen, `release.json`, die Image-Archive und den kompilierten Baum `werkzeug/` aus `app/src`. Die Host-Einstiege verwenden nur Node-Standardmodule. Alle gelieferten Images, auch Backup, muessen im signierten Manifest stehen und vor Installation lokal geladen sein oder als Archiv mitgeliefert werden.

Den privaten age-Recovery-Key auf einem getrennten Offline-Medium erzeugen und versiegelt sichern. Nur dessen oeffentlichen Empfaenger an die Installation uebergeben:

```sh
./planora install --instanz kunde-a --domain planora.example.ch --tls acme \
  --acme-kontakt betrieb@example.ch --schluessel /sicher/release.pub \
  --backup-ziel /sicherung/kunde-a --recovery-empfaenger age1...
```

Das lokale Ziel muss neu oder leer sein. Fuer den ersten echten Sicherungssatz `./planora sichern --instanz kunde-a --anlass erstsicherung` ausfuehren. Der Host erzeugt Secrets, Inventar, Konfiguration und Backup-Umgebung ausserhalb des Bundles unter `/etc/planora/kunde-a/`. `auth_secret` der API entspricht exakt `appSecrets.auth` im Inventar. Der private Recovery-Key gehoert weder dorthin noch ins normale Backup-Image.

Auf Linux aktiviert Installation als root die systemd-Instanz `planora-betrieb@kunde-a.service` und `planora-sicherung@kunde-a.timer`. Der Betriebsdienst prueft den Engine-Status beim Start und stuendlich, einschliesslich One-off- und pausierter Backup-Container. Ohne nachgewiesenen Stillstand wird keine abgelaufene Backup-Lease freigegeben. Der Journal-Container sendet beim Start und jede Minute, der Timer sichert naechtlich. Die naechtliche Sicherung, die Retention, das Reconcile, Start, Restore, Update und die Zertifikatsrotation melden Fehler an den Betriebsalarm (siehe unten). Logs des Journal-Containers (`docker compose logs journal`) und systemd-Logs sind noch nicht angebunden [A]. Windows-Tests aktivieren keine Host-Timer.

```sh
./planora start --instanz kunde-a
./planora journal --instanz kunde-a --einmal
./planora reconcile --instanz kunde-a
./planora update --instanz kunde-a /opt/planora/releases/N
./planora update --instanz kunde-a --fortsetzen
```

## Betriebsalarm (Webhook, optional SMTP)

Der Host meldet Fehler der naechtlichen Sicherung, der Retention und des Backup-Reconcile. Ebenso meldet er Fehler bei Start, Restore, Update (`planora update`) und Zertifikatsrotation. Bereinigt das Reconcile abgebrochene Sicherungen, gibt es eine Warnung. Ein erfolgreicher Lauf erzeugt keinen Alarm. Die Konfiguration liegt ausserhalb des Bundles in `/etc/planora/<instanz>/alarm.json` (0600, keine Secrets):

```json
{
  "webhook": { "url": "https://alarm.kunde.ch/planora", "ca": "/etc/planora/<instanz>/alarm-ca.pem", "timeoutMs": 10000 },
  "smtp": { "host": "mail.planora.ch", "port": 587, "starttls": true, "absender": "alarm@planora.ch",
            "planoraAdresse": "kunde-a@planora.ch", "kontoEmpfaenger": "admins", "benutzer": "alarm" }
}
```

- `webhook` und `smtp` sind je optional, mindestens ein Kanal ist Pflicht. `ca` ist nur fuer eine interne PKI noetig. Ohne `alarm.json` landet der Alarm nur im lokalen Alarm-Journal und auf stderr (systemd-Journal).
- Secrets als Dateien: `secrets/alarm_hmac` ist fuer den Webhook Pflicht und hat mindestens 32 Zeichen, z.B. `openssl rand -hex 32`. `secrets/alarm_smtp_passwort` ist nur mit `benutzer` noetig. Beide mit Modus 0600 anlegen. Unbekannte Felder in `alarm.json` werden abgelehnt.
- Webhook: `POST` mit JSON `{format, id, instanz, host, art, schwere, text, zeit}`. Header `X-Planora-Ereignis`, `X-Planora-Zeit` (Unix-Sekunden) und `X-Planora-Signatur: v1=<hex>` mit `HMAC-SHA256(alarm_hmac, "<zeit>.<body>")`. Der Empfaenger prueft die Signatur zeitkonstant und lehnt Zeitstempel ausserhalb von +/-300 s ab. Nur HTTPS; nur 2xx gilt als zugestellt; keine Umleitungen. `id` ist bei Wiederholungen gleich und dient der Deduplizierung.
- SMTP: STARTTLS (587) oder implizites TLS (465). AUTH PLAIN nur ueber TLS. Ein unverschluesseltes Relay nur mit `starttls: false` auf einem anderen Port [A].
- SMTP-Empfaenger (PO-Entscheid 2026-11-11, Planora hostet Server, Domain und Mailserver):
  - Immer erhaelt die feste Planora-Kundenadresse `planoraAdresse` den Alarm. Sie ist je Instanz frei waehlbar, z.B. `<kunde>@<planora-domain>`, und dient zum Filtern nach Kunde.
  - Die E-Mail-Adressen der Kunden-Konten liest der Host bei jeder Zustellung ueber die DB-Funktion `alarm_empfaenger` (Betriebsrolle, kein Tabellenzugriff). Standard `kontoEmpfaenger: "admins"`: aktive Konten mit Admin-Rolle [A, damit normale Nutzer keine Betriebsalarme erhalten]. `"alle"` nimmt alle aktiven Konten, `"keine"` nur die festen Adressen. Gesperrte und noch zu bestaetigende Konten fallen heraus.
  - Optional kommen weitere feste Adressen in `empfaenger` dazu.
  - Ist die DB nicht erreichbar (Zeitlimit 15 s [A]), geht der Alarm an die zuletzt erfolgreich gelesene Liste in `alarm/empfaenger.json` und an die Planora-Kundenadresse. Ohne Cache geht er nur an die Planora-Kundenadresse. Der Ersatz steht als `empfaenger_ersatz` im Journal.
  - Zugangsdaten des Planora-Mailservers liegen in `secrets/alarm_smtp_passwort`. Der Webhook bleibt optional.
- Zustellung: Jeder Alarm wird zuerst unter `/var/lib/planora/<instanz>/alarm/offen/` abgelegt und in `alarm/journal.jsonl` protokolliert (`erzeugt`, `zugestellt`, `zustellfehler`). Ein Zustellfehler bleibt offen. Wiederholt wird mit 1, 2, 4 ... hoechstens 60 Minuten Abstand [A]: vom Betriebsdienst alle 5 Minuten und bei jedem Host-Befehl. Nur der fehlgeschlagene Kanal wird wiederholt. Es gibt kein Verfallsdatum [A].
- Jeder Eintrag speichert die beim Erzeugen konfigurierten Kanaele. Ist `alarm.json` oder ein Secret ungueltig, wird nichts zugestellt, quittiert oder geloescht (`zustellung_ausgesetzt` im Journal). Neue Alarme werden trotzdem gespoolt und erhalten ihre Kanaele bei der ersten gueltigen Zustellung. Wird ein erforderlicher Kanal aus der Konfiguration entfernt, bleibt der Alarm offen.
- Andauernde gleiche Stoerungen wie Reconcile, Sicherung, Retention oder Journal-Start werden zusammengefasst: Gemeldet wird einmal, danach je 24 Stunden eine Erinnerung [A]. Im Journal stehen sie als `aggregiert`. Nach Behebung folgt eine Warnung `Behoben: ...`. Der Spool haelt hoechstens 200 offene Alarme [A]; aeltere werden als `verworfen` journalisiert.
- Der Betriebsdienst endet bei Start- oder Reconcile-Fehlern nicht mehr. Er wiederholt alle 5 Minuten, bis der Start gelingt, danach reconciliert er stuendlich.
- Alarmtexte enthalten die erste Zeile der Fehlermeldung (hoechstens 300 Zeichen), nie Secret-Inhalte.

```sh
./planora alarm --instanz kunde-a --test          # Testalarm (Warnung) ueber alle Kanaele
./planora alarm --instanz kunde-a --wiederholen   # offene Alarme sofort zustellen
```

**PO-Entscheid 2026-11-11:** Der produktive Kanal ist SMTP ueber den Planora-Mailserver mit den oben beschriebenen Empfaengern. Offen sind nur die konkreten Werte je Instanz: Mailserver, Absender, Planora-Kundenadresse und Zugangsdaten. Bestehende Installationen brauchen die neue `planora-sicherung@.service`. Die Installation ersetzt eine abweichende Unit nicht; sie manuell nach `/etc/systemd/system/` kopieren und `systemctl daemon-reload` ausfuehren.

Nachweis: `app/test/alarm.test.ts` deckt Konfiguration, Signatur, Spool, Wiederholung und Mehrkanal ab, ebenso Webhook mit Test-CA, SMTP mit STARTTLS/AUTH und die Host-Anbindung. `app/test-docker/alarm.test.ts` nutzt einen Mock-Empfaenger im Container mit eigener HMAC-Pruefung und echte Sicherungen. Eine erfolgreiche Sicherung samt Retention erzeugt keinen Alarm. Eine Sicherung mit gestoppter DB erzeugt genau einen gueltig signierten Alarm. Eine gefaelschte Signatur wird abgewiesen. Zwei 503-Antworten werden journalisiert und wiederholt, bis die Zustellung gelingt.

## Aufbewahrung der Sicherungssaetze (Retention)

Nach jeder erfolgreichen naechtlichen Sicherung laeuft die Retention (systemd: `host-cli.js sichern`; manuell `planora aufbewahren --instanz <name>`). Standardpolitik **14 taeglich / 8 woechentlich / 12 monatlich**, vom PO am 2026-11-11 freigegeben. Anpassung in `/etc/planora/<instanz>/backup/backup.env`:

```sh
PLANORA_RETENTION_TAEGLICH=14     # mindestens 1
PLANORA_RETENTION_WOECHENTLICH=8  # 0 = keine Wochenstaende
PLANORA_RETENTION_MONATLICH=12    # 0 = keine Monatsstaende
```

Diese Zeilen bleiben bei Update und Restore erhalten. Regeln:

- Je Regel werden die juengsten N Kalendertage, ISO-Wochen und Monate mit mindestens einem Satz belegt. Massgebend ist die Zeitzone der Instanzkonfiguration (Europe/Zurich). Wie bei restic zaehlt ein Satz, der mehrere Regeln erfuellt, nur einmal.
- Vertreter eines Bereichs ist der juengste gepruefte Satz. Ein fehlgeschlagener Satz vertritt einen Bereich nur, wenn dieser keinen geprueften Satz hat [A]. Laufende, ungepruefte und in der DB unbekannte Saetze werden nie entfernt.
- Der juengste gepruefte Satz bleibt immer erhalten, auch wenn ein neuerer fehlgeschlagener Satz den Tagesbereich belegt.
- Reihenfolge: Markierung `retention/<instanz>/prune-offen` im Ziel setzen, `restic forget <ids>`, danach Inventar `inventar/<instanz>/<backup-id>.age` loeschen und `backup_lauf.zustand='entfernt'` setzen. Dann Journal-Objekte bis zur kleinsten Journal-Sequenz aller behaltenen Saetze loeschen, hoechstens bis zum vor Laufbeginn gelesenen Journal-Zaehler. Zuletzt `restic prune` und Markierung entfernen. Ein abgebrochenes prune holt der naechste Lauf nach.
- Laeuft gerade eine Sicherung oder ist eine ungeprueft (Zustand `laufend`/`gesichert`), kuerzt der Lauf das Journal nicht. Ihre Journal-Untergrenze steht noch nicht im Repository.
- Koordination mit Update/Restore: Sicherung und Retention nehmen dieselbe Dateisperre `/var/lib/planora/<instanz>/update.lock` wie Update und Restore. Laeuft eines davon, wird der Lauf ausgesetzt (Warnung, Exitcode 75). Ist ein Update offen (abgebrochen, Rueckweg ausstehend), entsteht keine neue Sicherung. Die Retention laeuft mit reserviertem Rueckweg-Satz (`aufbewahren --reserviert <id>`). `planora sichern` und `planora aufbewahren` laufen ebenfalls ueber das Host-Werkzeug mit Sperre und Alarm. Jeder Lauf gleicht abgeschlossene Saetze ohne Snapshot nach. Ein Abbruch hinterlaesst deshalb hoechstens ein Inventar, das der naechste Lauf entfernt.
- Ist ein Manifest eines behaltenen Satzes nicht lesbar, kuerzt der Lauf das Journal nicht. Ein `forget`-Fehler aendert weder Inventar noch Journal noch DB.
- Audit: `backup.entfernt` je Satz und `backup.retention` mit der Zusammenfassung je Lauf. Die DB-Tabelle `loesch_journal` wird nicht gekuerzt.

Nachweis: `app/test/backup-retention.test.ts` (Auswahl, Kalender, Abbruch- und Fehlerfaelle) und `app/test-docker/backup-retention.test.ts`. Der Docker-Test erzeugt fuenf echte Saetze und setzt ihre Zeitstempel mit `restic rewrite --new-time`. Mit Politik 2/1/2 prueft er Snapshots, Inventar, DB-Zustand, Journal und `restic check`. Ein entfernter Satz ist nicht mehr restaurierbar. Der aelteste behaltene Satz wird samt nachfolgendem Journal in eine frische DB restauriert.

## TLS mit Kunden-Zertifikat (Kunden-CA)

Neben `--tls acme` und `--tls internal` kann die Instanz ein Zertifikat der Kunden-PKI verwenden. Die Kunden-IT stellt aus:

- `kette.pem`: Serverzertifikat zuerst, danach allfaellige Zwischenzertifikate. subjectAltName muss die Domain enthalten. Die Root-CA gehoert nicht in die Datei; die Clients vertrauen ihr ueber die Kunden-IT.
- `key.pem`: zugehoeriger privater Schluessel, unverschluesselt (PEM, PKCS#8 oder SEC1/PKCS#1). Caddy kann keine passwortgeschuetzten Schluessel laden.

```sh
./planora install --instanz kunde-a --domain planora.kunde.ch --tls kundenzertifikat \
  --tls-zertifikat /sicher/kette.pem --tls-schluessel /sicher/key.pem --schluessel /sicher/release.pub ...
```

Vor jeder Aenderung prueft die Installation: Schluessel passt zum Zertifikat, Domain im Zertifikat, Gueltigkeitszeitraum, Kettenreihenfolge. Unter 30 Tagen Restlaufzeit gibt sie eine Warnung aus [A]. Danach liegen Schluessel und Kette zusammen als ein Paar in `/etc/planora/<instanz>/tls/paar.pem` (0600, Eigentuemer Proxy-UID 1001). `instanz.env` erhaelt `PLANORA_TLS=/zertifikat/paar.pem /zertifikat/paar.pem` und `PLANORA_TLS_VERZEICHNIS`. Caddy liest Kette und Schluessel aus derselben Datei; so ersetzt ein einziges atomares Umbenennen das ganze Paar, und ein gemischtes Paar aus altem Schluessel und neuem Zertifikat kann nicht entstehen. Compose bindet dieses Verzeichnis nur lesend nach `/zertifikat` in den Proxy. Ohne Kunden-CA bleibt dort ein leeres Volume. Der Schluessel steht weder in `instanz.env` noch im Bundle noch im Backup-Inventar; die Kunden-IT bleibt fuer seine Sicherung zustaendig.

Rotation vor Ablauf:

```sh
./planora zertifikat --instanz kunde-a --tls-zertifikat /sicher/kette-neu.pem --tls-schluessel /sicher/key-neu.pem
```

Der Befehl prueft das neue Paar zuerst; ein ungueltiges Paar aendert nichts. Eine Sperre `tls/wechsel.lock` serialisiert Wechsel. Der Befehl sichert das bisherige Paar als `paar.pem.vorher`, ersetzt `paar.pem` atomar und startet nur den Proxy neu (rund 5 bis 15 Sekunden ohne HTTPS [A]). Caddy laeuft ohne Admin-API und liest die Datei nur beim Start. Jeder Fehler nach der Sicherung fuehrt zum Zurueckrollen: beim Ersatz, beim Neustart oder wenn der Proxy das neue Zertifikat nicht ausliefert. Der Befehl legt dann das bisherige Paar atomar zurueck und startet erneut. Scheitert auch dieser Neustart, nennt die Fehlermeldung beide Fehler. Die `*.vorher`-Datei nach bestaetigter Rotation durch den Betreiber entfernen. Ablaufueberwachung: Restlaufzeit in die Betriebsalarmierung aufnehmen [A]. Ein Wechsel zwischen `internal`/`acme` und Kunden-CA ist ein Neuinstallations- oder Wartungsschritt und wird hier nicht automatisiert.

Nachweis: `app/test-docker/kundenzertifikat.test.ts` erzeugt zur Laufzeit eine Test-Kunden-CA und eine fremde CA (openssl). Ein Client, der nur der Test-CA vertraut, erreicht `/api/health` mit dem erwarteten Zertifikat. Mit fremder CA oder nur dem System-Truststore wird die Verbindung abgelehnt. Die Rotation wird ueber den echten Proxy-Neustart geprueft.

## Rueckweg und Freigabe

Vor begonnener Update-Freigabe ist der Rueckweg laut signierter Matrix zulaessig. Bei inkompatiblem Schema:

```sh
PLANORA_RECOVERY_DATEI=/offline/identity.key ./planora update --instanz kunde-a --rueckweg
```

Bei einem kompatiblen Image-Rueckweg bleiben die bereits angewendeten Migrationen stehen. `PLANORA_RECOVERY_BUNDLE_DIR` und das passende Backup-Image bleiben deshalb beim signierten neuen Schema-Bundle; dessen Matrix muss das alte App-Release ausdruecklich erlauben. Diese Artefakte zusammen mit dem alten App-Bundle aufbewahren, damit die naechste Sicherung weiterhin wiederherstellbar ist.

Der Host legt eine neue Datenbank `planora_restore_<zufall>` im vorhandenen Cluster an. Die alte Datenbank wird erhalten; es gibt keinen impliziten DROP DATABASE. Inventar, Instanzbindung, signiertes altes Release, Schema, Dateihashes und lueckenloses Journal werden vor Freigabe geprueft. Der Import erfolgt als Migrator mit `SET ROLE planora_owner`, Rollenprovisionierung mit einem temporaeren begrenzten CREATEROLE-Login. Die Offline-Identity wird ausschliesslich fuer den Aufruf kopiert und gemountet; die Kopie wird im `finally` entfernt. Bei einem fehlgeschlagenen Import bleibt das Ziel fuer die Untersuchung erhalten und wird nie automatisch geloescht. Sein Recovery-Login wird im erreichbaren Cluster deaktiviert; bei nicht erreichbarer DB muss dessen Deaktivierung nach Wiederkehr geprueft werden. Ein neuer Versuch braucht nach Ursachenpruefung einen neuen Restore-Auftrag. Nach erfolgreich abgeschlossenem Import erlaubt die gespeicherte, an die Update-ID gebundene Auftragsdatei die Fortsetzung des Host-Wechsels. Eigenstaendige Restore-Aufrufe erhalten jeweils eine neue Auftrags-ID, auch wenn derselbe Sicherungssatz erneut gewaehlt wird.

Ein eigenstaendiger Restore eines Satzes desselben installierten Releases verwendet `PLANORA_RECOVERY_DATEI=... ./planora restore --instanz kunde-a <backup-id>`. Der aktuelle Cluster muss erreichbar sein; Ersatz einer verlorenen VM erfordert zuvor einen frischen provisionierten Cluster nach dem Vertrag in `m1b-notizen.md`. Das ist kein automatischer Disaster-Recovery-Bootstrap.

Nach jedem Restore sind alle Konten `zu_bestaetigen`, alle Sessions und Tokens entfernt und der Worker ueber `restore_gesperrt` blockiert. Wartung beenden ersetzt keine Freigabe:

```sh
./planora freigabe --instanz kunde-a
./planora freigabe --instanz kunde-a --einloesen
```

Beide Befehle verlangen eine lokale TTY; Tokens und Passwoerter niemals als Shellargument uebergeben. Erst die ausdrueckliche Admin-Bestaetigung und Einloesung mit neuem Passwort hebt die Worker-Sperre auf. Weitere Nicht-Admin-Konten bestaetigt der aktive Admin nach Sichtung von `GET /api/admin/benutzer` ueber `POST /api/admin/benutzer/:id/bestaetigen` mit Sitzung, Origin und `X-Planora-Request: 1`. Weitere Admins bleiben der Host-Konsole vorbehalten. Ein SMTP-Reset aktiviert kein restauriertes Konto.

Die erhaltene alte Datenbank und deaktivierte Recovery-Rollen nach einem Fehler werden erst nach gesonderter Betreiberentscheidung entfernt. Kein automatisches Cleanup bestehender Datenbanken.

## Lizenz-Dossier und offene Abnahmen

`node werkzeug/betrieb/dossier.js --bundle <bundle> --schluessel <pub> --lockfile <package-lock.json> --ausgabe <neuer-ordner>` erzeugt verifizierte Release-/npm-Metadaten und eine Freigabe-Checkliste. Dies ist ein Geruest, kein vollstaendiger Image-SBOM und keine juristische Freigabe. Ein exakter Lockfile des Builds gehoert zur Lieferdokumentation.

Offen bleiben frische Linux-VM samt Bind-Mount-/systemd-Pruefung, reale CH-S3-Konfiguration und Abnahme, konkrete SMTP-Werte je Instanz (Alarmkanal entschieden), menschliche Lizenzfreigabe und organisatorische Host-Freigabe im On-Premise-Fall. Das lokal verdrahtete Installationsprofil verwendet ein Dateisystemziel; der vorhandene S3-Adapter erfordert separate externe Konfiguration und reale Zielnachweise.
