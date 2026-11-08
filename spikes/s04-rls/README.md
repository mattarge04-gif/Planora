# S4 Mandantentrennung: RLS, Pool-Leak, Audit-Hash-Kette

Stand 2026-11-08 · Test-Architekt (Welle 3) · Wegwerf-Spike, kein Produktivcode.
Kennzeichnung: [F] gemessen/belegt · [A] Annahme · [?] offen.

## Ziel

Nachweisen, dass das Muster aus ADR 0010 (RLS mit `FORCE`, fail-closed `app.mandant()`, `SET LOCAL` nur im Wrapper, zusammengesetzte FKs, App-Rolle ohne `BYPASSRLS`) unter paralleler Last kein Mandantenleck hat, und dass der Audit-Trigger mit Hash-Kette (ADR 0015) schnell genug ist.

## Vorgehen

- Kein Docker vorhanden. Stattdessen echtes **PostgreSQL 18.6** (Windows x64) aus dem npm-Paket `embedded-postgres` (18.6.0-beta.19), lokal in `s04-rls/node_modules`, Daten in `.pgdata` (wird nach dem Lauf geloescht). Treiber `pg` 8.23.1.
- `schema.sql`: Rollen `planora_owner` (besitzt alles) und `planora_app` (Login, `NOBYPASSRLS`); Tabellen `raum`, `element`, `angabe`, `audit_eintrag`; Policies; generischer Audit-Trigger mit Advisory-Lock pro Mandant und SHA-256-Kette.
- `rls_test.mjs`: 2 Mandanten mit je 50 Raeumen, 500 Elementen, 500 Angaben; Wrapper `mitMandant()` = `BEGIN; set_config('app.mandant_id', $1, true); …; COMMIT`. Passwoerter pro Lauf zufaellig, nirgends gespeichert.

```
cd spikes/s04-rls && npm ci && node rls_test.mjs 10000
```

## Ergebnis [F, gemessen 2026-11-08, PostgreSQL 18.6 lokal]

| Test (ADR 0010 / 0015) | Messwert | Ergebnis |
|---|---|---|
| (h) `planora_app` ohne BYPASSRLS, kein Superuser, besitzt keine Tabelle | false / false / 0 | bestanden |
| (a) Katalogpruefung RLS + FORCE + Policy; absichtlich vergessene Tabelle wird erkannt | vorher 0 Treffer, nachher `vergessen` | bestanden |
| (c) Abfrage ohne Mandantenkontext | Fehler "kein Mandantenkontext gesetzt" | bestanden |
| (b) A liest B / fuegt in B ein / aendert B | 0 Zeilen / RLS-Fehler / 0 Zeilen; eigene 500 sichtbar | bestanden |
| (FK) Element von A in Raum von B (als Owner) | FK-Verletzung 23503 | bestanden |
| **(d) Pool-Leak: 10'000 parallele Requests, Pool 10, abwechselnd A/B** | **0 Fremdzeilen, 0 Fehler**, 0,6 s (≈ 17'000 Req/s) | bestanden |
| (d') Negativkontrolle: Session-`SET` statt `SET LOCAL` | naechster Request **ohne** eigenen Kontext sieht 500 Zeilen von A | Leck nachgewiesen → Test erkennt das falsche Muster |
| Audit: Sammelbestaetigung 100 Angaben in 1 Transaktion | 17 ms (Ziel ≤ 2 s) | bestanden |
| Audit: 20 parallele Sammelbestaetigungen à 100 desselben Mandanten | 19 ms gesamt; Kette 1'550 Eintraege lueckenlos | bestanden |
| Audit: `planora_app` loescht `audit_eintrag` | "permission denied" | bestanden |

Rohdaten: `ergebnis.json`.

## Urteil gegen das Kriterium (03 Kap. 13.2, S4)

| Kriterium | Ergebnis | Urteil |
|---|---|---|
| Pool-Leak: 2 Mandanten, 10'000 parallele Requests, Pool 10 → 0 Fremdzeilen | 0 | **bestanden** |
| Fehlender Kontext → Fehler | ja | **bestanden** |
| `planora_app` ohne BYPASSRLS **auf Exoscale** | lokal ja; Exoscale/Aiven nicht geprueft | **offen** (Skript unveraendert gegen Exoscale-Staging laufen lassen, Rolle dort per SQL anlegen) |
| Audit-Trigger: Sammelbestaetigung 100 Angaben ≤ 2 s | 17 ms | **bestanden** |

**Gesamturteil S4: lokal bestanden; Exoscale-Teil offen.**

## Befunde fuer die Architektur

1. Die **Negativkontrolle zeigt das reale Risiko**: Ein einziges `set_config(..., false)` bzw. `SET` ohne `LOCAL` an einer Pool-Verbindung reicht fuer ein Leck. Fail-closed `app.mandant()` schuetzt nur, solange kein alter Wert an der Verbindung haengt. Empfehlung: zusaetzlich `DISCARD ALL` bzw. `RESET app.mandant_id` beim Zurueckgeben der Verbindung (pg-Pool `release`-Hook) und eine Lint-Regel gegen `SET` ohne `LOCAL`. Diese Negativkontrolle gehoert als Pflichttest in die CI.
2. Der Audit-Trigger braucht **Leserecht des Owners unter RLS**: Mit `FORCE` gilt die Policy auch fuer die `SECURITY DEFINER`-Funktion. Das funktioniert nur, weil der Kontext gesetzt ist. Plattform-Jobs ohne Mandantenkontext (z.B. taegliche Kettenpruefung) brauchen eine eigene Funktion pro Mandant.
3. Last ist unkritisch: Advisory-Lock pro Mandant serialisiert korrekt, ohne messbare Kosten bei 100er-Bloecken.

## Grenzen

- Lokales PostgreSQL 18.6 statt Managed PG auf Exoscale (Aiven); Netzlatenz, TLS und Provider-Rollenrechte nicht geprueft.
- Nur 3 Fachtabellen; keine Drizzle-Migrationen (S11), keine API-Ebene (Test (e) aus ADR 0010 "UI, API, Export, Suche" fehlt).
- `embedded-postgres` ist eine Beta-Version; nur fuer Spikes/CI-Ersatz, nicht fuer Betrieb.
