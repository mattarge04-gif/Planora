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
