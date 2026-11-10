# M1b – Notizen der Spuren

Kennzeichnung: [F] Fakt · [A] Annahme · [?] offen.

## Spur A

### A1 Health + Wartungsflag
- [F] Basislinie vor Beginn: `cd app && npm test` → 101 Tests gruen (Plan nennt 98).
- [A] `/api/health` ist **keine registrierte Fastify-Route**, sondern wird im ersten `onRequest`-Hook per exaktem Pfadvergleich beantwortet. Grund: Modul-Guard (`FREIE_API_ROUTEN` in `module/manifest.ts`) und Sitzungsregeln (`auth/sitzung.ts`) verlangen fuer jede registrierte `/api`-Route Modul bzw. Sitzung; beide Dateien gehoeren nicht zu Spur A. Sauberer waere ein Eintrag `/api/health` in `FREIE_API_ROUTEN` plus Ausnahme in den Sitzungsregeln → **Wunsch an Koordinator** (ausserhalb Datei-Eigentum).
- [A] Waehrend der Wartung ist auch `POST /api/auth/sign-in/email` gesperrt (Plan: alle mutierenden Methoden ausser `sign-out`). Folge fuer §14.4 Schritt 6: Smoke-Login laeuft nicht ueber HTTP, sondern prozessintern (siehe A5).
- [A] 008 enthaelt zusaetzlich `betrieb_ereignis(art, daten)` (SECURITY DEFINER, nur `planora_betrieb`): schreibt Audit-Eintraege mit festem Praefix `betrieb.`; `setze_wartung` auditiert damit jeden Wechsel (§10: Update-Ereignisse auditiert). `planora_betrieb` erhaelt SELECT auf `instanz_einstellung`, `backup_lauf`, `migration_journal` (Update-Vorpruefung §8 Schritt 0). **Hinweis Spur B:** der SELECT-Grant auf `backup_lauf` fuer `planora_betrieb` steht damit schon in 008.
- [A] Fehlende Zeile `wartung` oder ein Wert ungleich JSON `false` gilt als Wartung aktiv (geschlossen).

### A2 Start-Einstiege + Dockerfile
- [F] `docker build -t planora-app:a2 app` gruen; Image **471 MB** (Basis `node:24.22.2-bookworm-slim` 333 MB, `node_modules` 110 MB). Laeuft als `uid=1000(node)`.
- [A] Build mit `tsc` nach `dist/` statt `tsx` zur Laufzeit: kein Compiler/esbuild im Startpfad, Typfehler brechen den Build. tsc wird mit Dateiliste und expliziten Flags aufgerufen (kein eigenes `tsconfig.build.json`, da ausserhalb Datei-Eigentum).
- [?] **Dev-Pakete im Laufzeit-Image:** `npm ci --omit=dev` laesst vitest/vite/rolldown/esbuild/tsx stehen (~50 MB), weil `better-auth` `vitest` als optionale Peer-Abhaengigkeit fuehrt (Lockfile `devOptional`). `--omit=optional` wuerde das native Argon2-Paket entfernen. Sie werden nicht ausgefuehrt, landen aber im SBOM (A6/A8). Loesungsvorschlag: npm-`overrides`/gezieltes Prune im Dockerfile – nicht umgesetzt (Risiko fehlender Module), Entscheid Koordinator.
- [A] Zusaetzlicher Einstieg `start/konsole.ts` (`setup-token`, `erstadmin`): laeuft als einmaliger Container mit der Eigentuemerrolle `planora_migrator`, **nicht** per `docker compose exec api` (Abweichung vom Plan-Wortlaut A3). Grund: `planora_app` hat kein Recht auf `setup_token` (004), und die sicherere Variante ist, der Laufzeitrolle dieses Recht nicht zu geben. Es gibt in M1a keine HTTP-Route zum Einloesen des Setup-Tokens; `erstadmin` loest es auf der Konsole ein (JSON auf stdin, Passwort nie als Argument).
- [A] `PLANORA_VERTRAUTE_PROXIES` (trustProxy): compose.yaml setzt die privaten Adressbereiche der Compose-Netze. `api` hat keinen veroeffentlichten Port; erreichbar ist es nur von Containern dieser Instanz.

### A3 Compose-Paket + Caddy
- [F] Gepinnte Images (Abruf 2026-11-10, `docker pull` + `docker images --digests`): `caddy:2.11.9-alpine@sha256:78bd3502…`, `postgres:18.6-bookworm@sha256:f1ea2a1a…`, `node:24.22.2-bookworm-slim@sha256:01d566e8…`, `clamav/clamav:1.5@sha256:45fe5149…` (nur per `docker buildx imagetools inspect` ermittelt, nicht gezogen/gestartet; genaue Patch-Version [?]).
- [F] Nachweis: `cd app && npm run test:docker` → `test-docker/paket.test.ts` 7/7 gruen (Docker 29.9.3, Compose v5.7.0).
- [A] DB-Init-Skript steht als Inline-`configs.db_rollen` in `compose.yaml` (keine eigene Datei im Datei-Eigentum). Es legt die vier Rollen mit LOGIN an, macht `planora_migrator` zum Eigentuemer der Datenbank und gibt ihm `pg_read_all_data WITH ADMIN` (noetig fuer `grant pg_read_all_data to planora_backup` in 001; ohne Superuser). Die Spec-Rolle `planora_owner` (§5) gibt es in M1a nicht: Eigentuemer ist, wer migriert → hier `planora_migrator` [?].
- [A] Drei Netze statt einem: `aussen` (nur proxy), `vorne` (proxy↔api, internal), `intern` (api/worker/migrator/db, internal). Der Proxy erreicht die DB nicht; api/worker haben keinen Weg nach aussen.
- [A] Wartungsschalter liegt in `caddy-data` (`/data/wartung/aktiv`), kein fuenftes Volume. Zusaetzliches Volume `clamav-signaturen` und Netz `signaturen` nur im Profil `scan`.
- [A] Caddy `admin off` (statt "Admin-API nicht nach aussen"): keine Admin-API, Konfigurationswechsel nur per Neustart. Healthcheck ueber einen Loopback-Listener `127.0.0.1:2019/bereit`.
- [A] TLS-Modus als ein Wert `PLANORA_TLS`: `internal` | ACME-Kontaktadresse | `<cert> <key>` (Kunden-CA, Bind-Mount per Override-Datei; ungetestet).
- [?] **Secret-Dateirechte auf Linux:** Compose-Datei-Secrets sind Bind-Mounts mit Host-Rechten. Bei Modus 600 muss der Eigentuemer die Container-UID sein (app-Secrets 1000 `node`, DB-Secrets 999 `postgres`). Auf Docker Desktop/Windows nicht pruefbar; `planora install` setzt die Eigentuemer (A4), Abnahme auf Linux-VM steht aus (A1, nicht in M1b).
- [A] Hilfsdatei `app/test-docker/paket-hilfe.ts` (kein Test) gehoert zu Spur A; Docker-Tests ueberspringen sich ohne `PLANORA_DOCKER_TESTS=1` selbst, weil `vitest.config.ts` (nicht Spur A) sonst auch `test-docker/` einsammelt. `npm test` zeigt sie als "skipped".
- [F] Docker Desktop zeigt als Client-IP die Gateway-Adresse des Netzes `aussen` (NAT); echte Client-IPs erst auf Linux-Host pruefbar.

### A4 Install-Skript + Release-Manifest
- [F] `release.json` = `{ release, schluesselId, signatur }`, Ed25519 (`node:crypto`) ueber die kanonische JSON-Form. Tests erzeugen Wegwerf-Schluessel; im Repo liegt kein Schluessel.
- [A] **Vertrauensanker:** der oeffentliche Release-Schluessel kommt bei `install` per `--schluessel` und liegt danach in `/etc/planora/<instanz>/release.pub`; `update` prueft nur gegen diese Datei, nie gegen einen Schluessel aus dem Bundle.
- [A] **Bundle-Aufbau:** `planora`, `compose.yaml`, `Caddyfile`, `wartung.html`, `release.json`, `images/*.tar`, `werkzeug/` (kompiliertes `app/src/betrieb`, nur `node:`-Module).
- [?] **Host braucht Node.js >= 24** fuer `planora install|update` (Logik in TypeScript, vom Plan gewuenscht; DB-Zugriffe laufen ueber `docker compose exec db psql`, deshalb kein `node_modules` auf dem Host). Alternative waere ein Werkzeug-Container mit Docker-Socket – bewusst nicht gewaehlt (Socket = Root auf dem Host). Entscheid PO/Koordinator.
- [A] Mindestversionen: Engine >= 29.0, Compose >= 2.24, frei >= 20 GiB (Abbruch); unter 100 GiB / 8 GiB RAM / 4 CPU / nicht Linux nur Warnung (Spec §13 laesst Mindestversionen offen).
- [A] Kollision (A2): gleicher Projektname, vorhandene Volumes `planora-<instanz>_*`, vorhandene Konfiguration, gleiches Backup-Ziel (`PLANORA_BACKUP_ZIEL` in `instanz.env`, normalisiert verglichen) oder gleiche Host-Ports einer anderen Instanz → Ablehnung vor jeder Aenderung. **Hinweis Spur B:** `--backup-ziel` wird nur gespeichert und verglichen; welches Format B erwartet, ist offen.
- [A] Profil P1 = keine Option aktiv; `install` prueft das nach dem Start in der DB und schreibt `betrieb.install` ins Audit.
- [F] Secrets: kanonisch `secrets/<name>`, Kopien `secrets/db/` (UID 999) und `secrets/app/` (UID 1000), alle 600; chown nur als root auf Linux.

### PP9-Befunde (Stand nach Behebung)
- **PP9-1** [F] Getrennte Secret-Kopien je Leser-UID (`secrets/db/` 999, `secrets/app/` 1000), Compose mountet je Dienst die passende Quelle auf denselben Zielnamen. Nachweis im Docker-Test: `erzeugeSecrets` laeuft als root in einem Linux-Container auf einem Volume → Eigentuemer/Modus per `stat` geprueft, fremde UID kann nicht lesen; alle vier Rollen melden sich ueber TCP (scram) mit dem Passwort aus ihrer Datei an, falsches Passwort scheitert. [?] Start des ganzen Pakets mit echten Host-Bind-Mounts auf einer Linux-VM bleibt offen (hier nur Docker Desktop/Windows; Abnahme A1).
- **PP9-2** [F] Docker-Tests: Projekt/Ports per `PLANORA_TEST_PROJEKT`, `PLANORA_TEST_HTTPS_PORT`, `PLANORA_TEST_HTTP_PORT`; kein vorangestelltes `down -v`; Abbruch, wenn das Projekt existiert; Abbau nur des selbst Angelegten.
- **PP9-3** [F] `planora_owner` (NOLOGIN) besitzt Datenbank, Schema und alle Objekte. `planora_migrator` (LOGIN, NOINHERIT) ist die einzige Rolle mit `SET ROLE planora_owner`; `start/migrator.ts` wechselt per Verbindungsparameter `-c role=planora_owner`. Die Konsole nutzt `planora_betrieb` und nur `setup_token_anlegen` / `erstadmin_anlegen` (SECURITY DEFINER, in 008); im Konsolen-Container liegt nur `db_betrieb_passwort`. Damit sind die frueheren [A] "Konsole mit planora_migrator" und "Eigentuemer = planora_migrator" ersetzt. [A] Die Funktionen stehen in `008_wartung.sql`, weil nur diese Migration zu Spur A gehoert; `erstadmin_anlegen` bildet `loeseSetupTokenEin` (auth/setup.ts, nicht Spur A) in SQL nach – bei Aenderungen dort beide anpassen.
- **PP9-4** [F] Netz `vorne` hat ein eigenes /29 je Instanz mit festen Adressen (Gateway +1, Proxy +2, api +3); api vertraut nur `PLANORA_PROXY_IP`. `planora install` waehlt das erste freie /29 aus 172.31.240.0/20 (frei = kein vorhandenes Docker-Netz, keine andere Instanz laut `instanz.env`) oder prueft `--vorne-subnetz`. Docker-Test: Worker mit gefaelschtem `X-Forwarded-For` zaehlt mit seiner eigenen Adresse; ueber Caddy zaehlt weder die Proxy-Adresse noch ein Client-Header. Damit ist das fruehere [A] "private Bereiche als vertraute Proxies" ersetzt.
- **PP9-8** [F] Caddy laeuft als UID/GID 1001 ohne Capabilities (`cap_drop: ALL`, `ip_unprivileged_port_start=0`); ein einmaliger Dienst `proxy-init` (ohne Netz, nur `CHOWN`) uebergibt `caddy-data` an diese UID. TLS-Ausstellung (`tls internal`), Wartungsschalter und Neustart laufen im Docker-Test damit.
- **PP9-5** [F] `wartungsLage` hat eine eigene Zeitgrenze (3 s); `dbKonfig` setzt Verbindungs-, Statement- und Query-Timeouts (Migrator ohne Abfragegrenze); Worker bricht auch waehrend einer haengenden Abfrage ab; Stopp raeumt zeitbegrenzt auf. Docker-Test mit pausierter DB: Health/Mutation 503, `worker` und `api` enden mit Exit 0 innerhalb der Grace-Zeit.
- **PP9-8 Nachtrag** [F] `proxy-init` scheiterte beim zweiten `compose up` (root ohne DAC-Capability auf dem bereits uebergebenen Volume). Jetzt idempotent; durch den PP9-5-Test abgedeckt (zweites `up` im selben Projekt).

### Uebernahme Codex
- [F] PP9-6: alle Manifest-Referenzen verlangen festen Tag plus SHA-256-Digest; widerspruechliche Digest-Felder werden abgelehnt. Install prueft weiterhin nach docker load die Image-ID und schreibt exakt die gepruefte Digest-Referenz in instanz.env. Unit: `npm.cmd exec vitest run test/release.test.ts test/release-install.test.ts` ? 34/34.
- [A] Lokal gebaute Offline-Images verwenden den containerd-Image-Store (Docker 29), dessen RepoDigest der Image-ID entspricht; der Docker-Pakettest startet diese Referenz.

### Stand bei Abbruch (2026-11-10, PO-Stopp)

**Erledigt (Commit)**

| Punkt | Commit | Nachweis |
|---|---|---|
| A1 Health + Wartungsflag | 7195cb6 | Unit |
| A2 Start-Einstiege + Dockerfile | 3102026 | Build, Docker-Test |
| A3 Compose-Paket + Caddy | 02a5a31 | Docker-Test |
| A4 Release-Manifest + install | d3758cb | Unit (install nur mit Fake-Umgebung) |
| PP9-2 Test isoliert | b1527ce | Docker-Test |
| PP9-1 Secret-Kopien je UID | 526671f | Docker-Test (Linux-Container), [?] Linux-VM offen |
| PP9-3 planora_owner NOLOGIN, Konsole ohne DDL | e918313 | Unit + Docker-Test |
| PP9-4 nur Caddy-Adresse vertraut | d0d7f15 | Unit + Docker-Test |
| PP9-8 Caddy unprivilegiert | 83e7dd6, 4b2ba07 | Docker-Test |
| PP9-5 DB-Zeitgrenzen, sauberer Stopp | 1dbb00b | Unit + Docker-Test |

Letzter Teststand auf diesem Commit-Stand: `cd app && npm test` → 14 Dateien gruen, 157 Tests gruen, 12 uebersprungen (Docker-Tests ohne Flag). `cd app && npm run test:docker` → `paket.test.ts` 12/12 gruen (91 s). `npx tsc --noEmit -p .` ohne Befund.

**Offen**

- **PP9-6** (mittel) nicht begonnen: `release.ts`/`install` akzeptieren noch Referenzen ohne `@sha256:`. [F] Vorarbeit: mit dem containerd-Image-Store (Docker 29) gilt fuer lokal gebaute/geladene Images RepoDigest = Image-ID, `planora-app:<tag>@sha256:<id>` laesst sich starten; die Testhilfe `baueImage` liefert bereits solche Referenzen. Naechster Schritt: `pruefeForm` verlangt `@sha256:` in jeder Referenz, `install` lehnt reine Tags ab, Test dazu. [A] setzt den containerd-Image-Store auf dem Zielhost voraus.
- **PP9-7** (niedrig) nicht begonnen: Dev-Pakete im Laufzeit-Image. Idee: nach `npm ci --omit=dev` im Dockerfile `npm rm --no-save vitest tsx` und danach Laufzeit-Smoke (Login, Migration); sonst dokumentierte Dossier-Ausnahme.
- **PP9-Nachpruefung:** die Fixes PP9-1 bis PP9-5 und PP9-8 sind **nicht** vom Ueberwacher bestaetigt ("PP9-Fixes bereit" wurde wegen des Stopps nicht mehr gemeldet).
- **A5 Update-Zustandsmaschine nicht begonnen.** Es gibt nur `app/src/betrieb/update/docker.ts` (CLI-Hilfen, von install genutzt). `betrieb/planora update` verweist auf `werkzeug/betrieb/update/cli.js`, das es noch nicht gibt. Entwurf (nicht umgesetzt): Seiteneffekte hinter `Betriebsumgebung`; DB-Zugriffe des Host-Werkzeugs ueber `docker compose exec db psql`; Advisory-Lock ueber eine offen gehaltene psql-Sitzung; Smoke als `start/smoke.ts` im api-Container mit prozessinternem Login (Wartung sperrt den HTTP-Login); haengender Worker im Test per Compose-Override.
- **A6 Lizenz-Dossier** nicht begonnen. **PP10** entfaellt bis A5.
- **Backup-Reconcile-Verdrahtung** in `betrieb/planora` (Hinweis aus PP9b, Vertrag von Spur B) nicht begonnen.
- **Ungetestet:** `dockerInstallUmgebung` und `betrieb/planora` sind nie gegen echtes Docker gelaufen (install nur mit Fake; Skript nur `sh -n`). Geplant war der Echtlauf im Update-Docker-Test.
- Weiter offen aus frueheren Abschnitten: [?] Node >= 24 auf dem Host, [?] Start mit Host-Bind-Mounts auf einer Linux-VM, [A] `/api/health` im onRequest-Hook (Wunsch: Eintrag in `FREIE_API_ROUTEN`).

**Stash:** nichts. Arbeitsverzeichnis sauber, kein `pp9-wip`.

**Docker:** eigenes Projekt `planora-a` vollstaendig abgebaut (keine Container, Volumes, Netze); eigene Test-Images `planora-app:planora-a-1`, `:test-1`, `:a2` entfernt. Basis-Images (node, postgres, caddy) und alles von `planora-b*` unberuehrt.

**Naechster Schritt:** PP9-6 umsetzen, dann "PP9-Fixes bereit" mit Hash und Docker-Testbeweis an den Ueberwacher; danach A5.
