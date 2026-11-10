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
