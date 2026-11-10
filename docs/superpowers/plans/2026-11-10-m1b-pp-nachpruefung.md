# Nachpruefung nachgereichter PP9-/PP10b-Befunde

Stand vor Nachpruefung: `ffb4615`. Alle vier genannten Fehler bestanden noch und sind im Abschlusscommit dieser Nachpruefung behoben. Ponytail bleibt im bereits gelesenen Modus full aktiv: vorhandene Funktionen weiterverwenden, kleine gemeinsame Hilfen, keine neue Dependency. Originalquelle und Installation stehen im Integrationsbericht.

| Befund | Bestaetigter Fehler | Korrektur und Regression |
|---|---|---|
| PP10b-2 | `freigabe_einloesen` setzte das Konto ohne aktuellen Statusvergleich auf aktiv; eine spaetere Sperre widerrief alte Host-Tokens nicht | Neue Migration `011_freigabe_widerruf.sql`, angewendete 009 bleibt unveraendert. Konto vor Token per FOR UPDATE sperren, Status `zu_bestaetigen` verlangen, Token erneut auf Gueltigkeit pruefen. Trigger widerruft ausstehende Tokens bei jeder expliziten Sperre. Regression prueft Widerruf und die Ablehnung selbst eines noch vorhandenen Tokens bei gesperrtem Konto, ohne Worker-Freigabe. |
| PP10b-4 | CLI baute die Ziel-URL ohne TLS-Parameter neu auf; psql erhielt nur eine boolesche Auswahl require/prefer | Gemeinsame explizite TLS-Konfiguration fuer pg und libpq, inklusive sslmode, CA und Client-Zertifikatspfaden. `require` erzwingt Verschluesselung, `verify-full` zusaetzlich Zertifikats-/Hostnamepruefung; unbekannte TLS-Parameter scheitern geschlossen. Tests erfassen die echte CLI-Uebergabe und den psql-Import-Parameter und beweisen, dass pg bei beiden Modi gegen eine DB ohne TLS ablehnt. Kein positiver realer TLS-Endpunkt-Nachweis behauptet. |
| PP9-6 | Manifest verlangte nur app; geerbte Shellvariablen konnten die Compose-Env-Datei uebersteuern | Pflichtimages app/db/proxy/backup und eindeutige bekannte Dienste verlangt. Installation und Update pruefen die effektiv gerenderte Compose-Konfiguration aller Profile gegen signierte Image-Referenzen. Docker-Prozesse und DB-Lock erhalten keine geerbten PLANORA-/COMPOSE-Overrides; POSIX-Wrapper entfernt geerbte Werte der verbindlichen Env-Datei und Compose-Overrides. Unit-Tests fuer fehlende/doppelte Images, manipuliertes effektives Worker-Image und echte Prozessumgebung; Docker-Regression mit manipulierten Image-/Compose-Variablen. |
| PP9-10 | Reine Zeichenkettennormalisierung erkannte lokale Punktsegment-/Symlink-Aliase nicht und normalisierte S3-Schluessel faelschlich ohne Gross/Klein | Lokale Identitaet ueber resolve und realpath des Ziels oder naechsten existierenden Vorfahren; Windows-Junctions, Symlinks und file-URLs werden erkannt. S3-URL/Endpoint werden normalisiert, Objektschluessel behalten ihre Gross-/Kleinschreibung. Negative Instanzkollisionstests fuer lokale Aliase und S3-URL-Aliase; unterschiedliche S3-Schluessel bleiben getrennt. |

Die bereits angesprochenen anderen Punkte bleiben zugeordnet: Admin-API in `e47eefe`; Worker prueft Wartung und Restore-Sperre und bleibt bei DB-Fehlern geschlossen in `c226252`; Installationsprofil liest mit der berechtigten Rolle `planora_app`, ebenfalls in `c226252`. Die neue Migration ergaenzt die Host-Freigabe, ohne die Admin-API oder Worker-Schranke zu umgehen.

## Tatsaechliche Pruefungen

- Acht gezielt betroffene Testdateien: **77/77 bestanden**, 9.92 s (`freigabe`, `restore-tls`, `release`, `release-install`, `update`, `dossier`, `backup-zielidentitaet`, `compose-bindung`).
- TLS-Datei nach zwei zusaetzlichen direkten CLI-Regressionen: **6/6 bestanden**, 4.39 s. Vier davon ueberlappen mit dem vorigen Lauf; keine Gesamtsumme daraus bilden.
- `npm.cmd run pruefe:typen`: bestanden, umfasst auch Docker-Tests.
- Kombinierter Docker-Test: **6/6 bestanden**, 200.71 s. Eigenes Projekt `planora-nachpruefung-1110-u`, Ports 23881/23844, echte App-/Backup-Images, signierte Manifeste, Installation, harter Dump-Abbruch/Reconcile, inkompatibler Restore mit Host-Sperre, kompatibler Rueckweg samt Folgesicherung und Update-Wiederaufnahme.
- `bash -n betrieb/planora` und `git diff --check`: bestanden.

Der erste kombinierte Lauf scheiterte vor dem Start: Compose blendete Profildienste beim normalen Konfigurationsrendering aus. Die neue Pruefung rendert jetzt explizit alle Profile, ohne diese zu starten; der anschliessende kombinierte Lauf bestand. Keine erneute ungezielte Vollpruefung.

M1 bleibt aus den im ersten Integrationsbericht dokumentierten Gruenden noch nicht technisch abnahmebereit: reale Linux-/CH-S3-Abnahmen, Retention-Politik und menschliche Lizenzfreigaben fehlen weiterhin. Main und Originalzweige bleiben unveraendert, kein Push. Nur eigene Testressourcen und Image-Tags werden entfernt; kein Prune und keine Produktions-Secrets im Repository.
