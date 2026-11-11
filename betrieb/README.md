# M1-Betrieb

Zielhost: Linux mit systemd, Docker/Compose und Node.js ab 24. Die Windows-Docker-Tests ersetzen die Abnahme auf einer frischen Linux-VM nicht.

Fuer die lokale M1-Abnahme gibt es eine wiederholbare [WSL2-Probe mit eigenem Docker und systemd](abnahme/README.md), einschliesslich Offline-Installation, Timer-Ausloesung, separatem Ersatzhost nach Totalverlust und Image-/Lizenzdossier. [A] WSL2 ist ein lokaler Ersatz fuer die fehlende VM; die dort dokumentierten Grenzen und die menschlichen Freigaben bleiben bestehen.

## Bundle und Installation

Ein signiertes Offline-Bundle enthaelt `planora`, beide Compose-Dateien, `Caddyfile`, `wartung.html`, die drei `planora-*@`-systemd-Vorlagen, `release.json`, die Image-Archive und den kompilierten Baum `werkzeug/` aus `app/src`. Die Host-Einstiege verwenden nur Node-Standardmodule. Alle gelieferten Images, auch Backup, muessen im signierten Manifest stehen und vor Installation lokal geladen sein oder als Archiv mitgeliefert werden.

Den privaten age-Recovery-Key auf einem getrennten Offline-Medium erzeugen und versiegelt sichern. Nur dessen oeffentlichen Empfaenger an die Installation uebergeben:

```sh
./planora install --instanz kunde-a --domain planora.example.ch --tls acme \
  --acme-kontakt betrieb@example.ch --schluessel /sicher/release.pub \
  --backup-ziel /sicherung/kunde-a --recovery-empfaenger age1...
```

Das lokale Ziel muss neu oder leer sein. Fuer den ersten echten Sicherungssatz `./planora sichern --instanz kunde-a --anlass erstsicherung` ausfuehren. Der Host erzeugt Secrets, Inventar, Konfiguration und Backup-Umgebung ausserhalb des Bundles unter `/etc/planora/kunde-a/`. `auth_secret` der API entspricht exakt `appSecrets.auth` im Inventar. Der private Recovery-Key gehoert weder dorthin noch ins normale Backup-Image.

Auf Linux aktiviert Installation als root die systemd-Instanz `planora-betrieb@kunde-a.service` und `planora-sicherung@kunde-a.timer`. Der Betriebsdienst prueft den Engine-Status beim Start und stuendlich, einschliesslich One-off- und pausierter Backup-Container. Ohne nachgewiesenen Stillstand wird keine abgelaufene Backup-Lease freigegeben. Der Journal-Container sendet beim Start und jede Minute, der Timer sichert naechtlich. Fehlgeschlagene Befehle und systemd-/Container-Logs muessen an die Betriebsalarmierung angeschlossen werden; externer Alarmkanal ist kundenspezifisch. Windows-Tests aktivieren keine Host-Timer.

```sh
./planora start --instanz kunde-a
./planora journal --instanz kunde-a --einmal
./planora reconcile --instanz kunde-a
./planora update --instanz kunde-a /opt/planora/releases/N
./planora update --instanz kunde-a --fortsetzen
```

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

Offen bleiben frische Linux-VM samt Bind-Mount-/systemd-Pruefung, reale CH-S3-Konfiguration und Abnahme, gemeinsame Retention der Saetze/Inventare, menschliche Lizenzfreigabe und organisatorische Host-Freigabe im On-Premise-Fall. Das lokal verdrahtete Installationsprofil verwendet ein Dateisystemziel; der vorhandene S3-Adapter erfordert separate externe Konfiguration und reale Zielnachweise.
