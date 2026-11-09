# S13 M1-Kern: Login, Modul-Guard, Dispatch-Sperre

Stand 2026-11-09 · Programmierer (Claude) · Wegwerf-Spike, kein Produktivcode.
Kennzeichnung: [F] gemessen/belegt · [A] Annahme · [?] offen.
Prueft die riskantesten Annahmen aus `docs/superpowers/specs/2026-11-09-m1-server-paket-design.md` (§4, §4.1, §5) und `docs/architektur/09-recherche-m1.md` §1. T3 wurde auf Wunsch des Koordinators gegen **Spec V2** (Commit `d5e18e9`, §4.1) getestet und dem alten Design gegenuebergestellt.

## Ziel

| T | Annahme | Spec |
|---|---|---|
| T1 | Better Auth + Fastify + Drizzle mit DB-Sessions ohne Cookie-Cache und Argon2id; Widerruf sofort wirksam; Origin/CSRF-Schutz | §5, 09 §1 |
| T2 | Modul-Guard liest ohne Cache pro Anfrage aus `modul_schalter`; Kosten tragbar; deaktivierte Route 404 | §4 |
| T3 | Abschalten waehrend paralleler externer Aufrufe: 0 Requests und 0 uebernommene Ergebnisse nach Abschalt-Commit | §4.1, A5 |
| T4 | pg-boss Drain (optional) | **nicht durchgefuehrt** (Zeitbudget) |

## Vorgehen und Versionen [F]

- Kein Docker. PostgreSQL **18.6** aus `embedded-postgres` 18.6.0-beta.19 (Muster aus `s04-rls`), je Test eigene Instanz in `.pgdata-tN` (nach dem Lauf geloescht). Passwoerter/Secrets pro Lauf zufaellig, nirgends gespeichert.
- Node v24.x (Windows 11, x64). Exakte Pins in `package.json`/`package-lock.json`: `better-auth` 1.7.18, `fastify` 5.12.8, `drizzle-orm` 0.45.4, `@node-rs/argon2` 2.2.2, `pg` 8.23.1.
- Alles auf einer Entwicklermaschine, localhost; Zahlen sind relativ, nicht Zielhardware.

```
cd spikes/s13-m1-kern && npm ci
node t1_auth.mjs
node t2_guard.mjs 2000 20
node t3_dispatch.mjs 50 20 5     # Hauptlauf (Spec V2: max. 5 parallel)
node t3_dispatch.mjs 50 20 20    # Vergleich mit 20 parallelen Aufrufen
```

Rohdaten: `ergebnis.json` (Schluessel `t1`, `t2`, `t3`, `t3_parallel20`).

## T1 Login (Better Auth) – **bestanden**

Aufbau: Better-Auth-Kerntabellen (`user`, `session`, `account`, `verification`) als Drizzle-Schema + handgeschriebenes DDL; `drizzleAdapter(db, { provider: "pg", transaction: true })`; `session.cookieCache.enabled=false`; eigene `password.hash/verify` mit `@node-rs/argon2` (Argon2id, m=19456 KiB, t=2, p=1); Fastify-Catch-all `/api/auth/*` → `auth.handler(Request)` nach [Fastify-Doku](https://better-auth.com/docs/integrations/fastify); geschuetzte Route `/api/ich` ruft pro Anfrage `auth.api.getSession`.

| Pruefung | Messwert [F] | Urteil |
|---|---|---|
| Registrierung, Login, falsches Passwort | 200 / 200 / 401; Hash `$argon2id$v=19$m=19456,t=2,p=1$` | bestanden |
| Argon2id-Dauer (OWASP-Minimum) | ≈ 4–6 ms je Hash (Entwicklermaschine) | Info |
| Widerruf per `DELETE FROM session WHERE user_id=…` in Transaktion | 2 Sessions: vorher 200/200, naechste Anfrage 401/401 | bestanden |
| Widerruf per Endpunkt `/revoke-sessions` | vorher 200/200, danach 401/401 | bestanden |
| Passwortwechsel `revokeOtherSessions: true` | alte Sessions 401/401, neue Session 200 | bestanden |
| Passwortwechsel **ohne** Flag (Default) | andere Session bleibt **200** | Befund |
| Fremder Origin mit Cookie / beim Login / Cross-Site-Navigation | 403 / 403 / 403 | bestanden |
| Kein Origin, mit Cookie | 403 | bestanden |
| Kein Origin, kein Cookie, keine Fetch-Metadaten (wie curl) | **200** | Befund (by design) |

Befunde (alle im Quelltext von better-auth 1.7.18 nachvollzogen, `dist/api/middlewares/origin-check.mjs`, `dist/context/create-context.mjs`, `dist/api/routes/update-user.mjs`):
1. **Origin-Pruefung ist in `NODE_ENV=test` per Default aus** (`skipOriginCheck = isTest()`, auch bei `TEST=true`). Tests muessen `advanced.disableOriginCheck: false` explizit setzen, sonst prueft die CI nichts. [F, create-context.mjs Zeile 211]
2. **Ohne Cookie und ohne Origin/Referer/Sec-Fetch-Header** wird nicht geprueft (Nicht-Browser-Clients). Fuer Login ist das unkritisch (kein Session-Kontext), erklaert aber, warum die Spec zusaetzlich `X-Planora-Request` fuer schreibende Planora-Routen braucht. Node-`fetch` setzt selbst `sec-fetch-mode: cors` → wird dann wie Browser geprueft (Testfalle).
3. `changePassword` widerruft andere Sessions **nur** mit `revokeOtherSessions: true`; Default ist aus. `revokeSessionsOnPasswordReset` gilt nur fuer den Reset-Flow ([Doku](https://better-auth.com/docs/authentication/email-password)).
4. API wie in 09 §1 beschrieben; keine Abweichung gefunden. Das Kernschema musste von Hand als Drizzle-Schema geschrieben werden (CLI-Generator nicht verwendet).

## T2 Modul-Guard ohne Cache – **bestanden**

Fastify-`onRequest`-Hook: URL-Praefix → Modul-ID aus Manifest, dann `select aktiv from modul_schalter where modul_id=$1` (Pool 10). 2000 Anfragen, 20 parallele Keep-Alive-Clients, Median aus 3 Runden nach Aufwaermen.

| Route | ohne Guard p50 / p95 | mit Guard p50 / p95 | Zuschlag p50 / p95 [F] |
|---|---|---|---|
| ohne DB-Arbeit | 1.09 / 1.87 ms | 1.66 / 2.59 ms | **0.57 / 0.72 ms** |
| 1 Fachabfrage | 1.51 / 2.02 ms | 2.01 / 3.13 ms | **0.50 / 1.11 ms** |

- Kriterium [A, im Spike gesetzt]: Zuschlag p95 ≤ 5 ms → erfuellt (max. 1.11 ms), 0 Fehler.
- Deaktiviertes Modul `zustand`: Direktaufruf **404**, auch mit Query, Trailing-Slash, `//`, Grossschreibung, `..`, `%2F`. Kontrolle ohne Guard: kanonische Route 200, die Varianten erreicht schon der Router nicht.
- Umschalten wirkt bei der naechsten Anfrage (aus → 404, ein → 200), kein Cache.

## T3 Dispatch-Race – **V2 bestanden, V1 nicht bestanden**

Fake-Provider als eigener Prozess (500 ms Antwortzeit, protokolliert Ankunft mit hochaufloesendem Zeitstempel und ob der Client abgebrochen hat). 20 Jobs je Lauf, Start gestaffelt 0–300 ms, Abschalten zufaellig bei 50–250 ms, 50 Wiederholungen je Variante. Verstoss = Request-Ankunft beim Provider nach Abschalt-Commit **oder** Ergebnis-Commit nach Abschalt-Commit.

| Variante | Beschreibung |
|---|---|
| `v1_spec` | Spec V1: pruefen → `laufend` committen → senden; Abschalten = UPDATE + NOTIFY |
| `v1_sperre_bis_gesendet` | wie V1, aber `FOR SHARE` bis die Anfrage auf dem Socket liegt |
| `v2` | Spec V2: `FOR SHARE` ueber den ganzen fetch, Ergebnis in derselben Transaktion; Abschalten (a) `abschaltung_angefordert` + NOTIFY, (b) Abbruch per NOTIFY und 1-s-Polling, (c) UPDATE wartet auf Share-Sperren |
| `v2_pause` | V2 + 300 ms Pause zwischen DB-Pruefung und fetch (A5) |
| `v2_ohne_listener` | V2 ohne LISTEN (A5: toter Listener), nur Polling |
| `v2_pause_ohne_listener` | beides |

Ergebnis [F] (50 × 20 Jobs):

| Variante | max. 5 parallel: Requests / Ergebnisse nach Commit | Laeufe mit Verstoss | Dauer bis Abschalt-Commit p50 / max | max. 20 parallel: Requests nach Commit |
|---|---|---|---|---|
| v1_spec | **2** / 0 | 2 / 50 | 1.2 / 4.1 ms | **10** (10 / 50 Laeufe) |
| v1_sperre_bis_gesendet | 0 / 0 | 0 | 1.1 / 2.3 ms | 0 (Vorlauf mit aelterem Code: 1 Verstoss in 5 Laeufen) |
| **v2** | **0 / 0** | 0 | 2.2 / 5.7 ms | 0 |
| **v2_pause** | **0 / 0** | 0 | 252 / 316 ms | 0 |
| **v2_ohne_listener** | **0 / 0** | 0 | 453 / 515 ms | 0 |
| **v2_pause_ohne_listener** | **0 / 0** | 0 | 735 / 828 ms | 0 |

Beobachtungen:
- **V1 hat die erwartete TOCTOU-Luecke**: Pruefung true, Abschalt-Commit, dann fetch → Request kommt nach dem Commit an (2 bzw. 10 Faelle). NOTIFY bricht nur ab, was schon laeuft.
- `v1_sperre_bis_gesendet` war im Hauptlauf sauber, im Vorlauf aber nicht: die Sperre faellt, bevor die Anfrage beim Provider angekommen ist. Keine verlaessliche Garantie → V2 (Sperre ueber den ganzen Aufruf) ist die richtige Wahl.
- **V2 mit Listener**: alle laufenden Aufrufe abgebrochen (`abgebrochen_modul_aus`), keine Ergebnisse uebernommen, Abschalten in wenigen ms.
- **V2 ohne Listener**: Garantie haelt, aber **es wird nichts abgebrochen**: 1-s-Polling ist langsamer als die 500-ms-Antwort, alle laufenden Aufrufe enden `erledigt` und ihr Ergebnis wird **vor** (c), aber **nach** (a) committet. Das Abschalten wartet so lange wie der laengste laufende Aufruf (hier ≤ 0.83 s; real bis Timeout 120 s + 1 s).
- **V2 mit Pause ohne Listener**: alle 242 Requests gingen **nach** der Abschalt-Anforderung (a) raus, weil nach der Pause nicht erneut geprueft wurde. Formal kein Verstoss (vor Commit c), fachlich unerwuenscht.
- Mit Listener und Pause: 0 Requests, da das Abort-Signal vor dem fetch geprueft wird.

## Urteil

| T | Kennzahl [F] | Urteil |
|---|---|---|
| T1 | Widerruf: naechste Anfrage 401 (4/4 Faelle); fremder Origin 403 (3/3); Argon2id-Hash nach OWASP | **bestanden** (3 Befunde) |
| T2 | Guard-Zuschlag p95 ≤ 1.11 ms bei 20 parallel; 404 bei Direktaufruf | **bestanden** |
| T3 | V2: 0 Requests / 0 Ergebnisse nach Abschalt-Commit in 6 × 50 Laeufen (je 5 und 20 parallel); V1: 2 bzw. 10 Verstoesse | **V2 bestanden**, V1 nicht bestanden |
| T4 | – | nicht durchgefuehrt |

## Grenzen

- Localhost, eine Maschine, embedded-postgres (Beta) statt Container; keine Netzlatenz zum Provider, kein TLS.
- Zeitstempel-Vergleich ueber zwei Prozesse auf derselben Maschine (`performance.timeOrigin + now()`); sub-ms-Ungenauigkeit moeglich, Vergleich zusaetzlich gegen Commit-Beginn ausgewertet (gleiches Bild).
- Better Auth: kein Rate-Limit, keine Session-Rotation/Leerlauf-Timeouts, kein Reset-Flow, kein TOTP getestet. Better-Auth-Tabellen ohne CLI-Generator.
- Guard nur als URL-Praefix-Match; Job-Guard (`pausiert_modul`) nicht getestet.
- Fake-Provider streamt nicht; ein echter Claude-Aufruf mit Streaming wurde nicht nachgebildet.

## Folgen fuer die Spec (nur Vorschlag, Spec nicht geaendert)

1. §5/A3: In Tests `advanced.disableOriginCheck: false` **explizit** setzen (sonst ist die Origin-Pruefung unter `NODE_ENV=test` aus) und einen Test, der das belegt.
2. §5: Passwortwechsel immer mit `revokeOtherSessions: true` aufrufen (bzw. serverseitig erzwingen); fuer Rollenwechsel/Sperre reicht ein `DELETE FROM session` in der Fach-Transaktion – nachgewiesen sofort wirksam.
3. §4: Guard ohne Cache ist leistungsmaessig unkritisch (< 1.2 ms p95); Cache nicht noetig. Guard besser an die Fastify-Plugin-Kapselung pro Modul binden statt an URL-Strings, damit Router-Optionen (`ignoreTrailingSlash`, `caseSensitive`) den Guard nicht umgehen koennen [A].
4. §4.1: V2 bestaetigt. Ergaenzen: **unmittelbar vor dem fetch und vor dem Ergebnis-Commit** in der Transaktion `abschaltung_angefordert` pruefen (bzw. Abort-Signal). Sonst gehen bei totem Listener nach der Anforderung noch Requests raus und Ergebnisse werden zwischen (a) und (c) uebernommen.
5. §4.1: Dauer bis Abschalt-Commit ist ohne Listener durch den laengsten laufenden Aufruf begrenzt (bis 120 s Timeout). Polling-Intervall ≤ 1 s reicht nur, wenn es kuerzer als typische Aufrufdauer ist; Betreiber-UI muss "Abschalten laeuft" anzeigen. Listener-Ausfall per Healthcheck melden.
6. §4.1 Ziffer 5: Max. 5 parallele Aufrufe halten 5 DB-Verbindungen fuer bis zu 120 s; Pool-Groesse der `worker` entsprechend dimensionieren (Dispatch-Pool getrennt vom uebrigen Pool) [A].
7. T4 (pg-boss Drain, 09 §6) bleibt offen.
