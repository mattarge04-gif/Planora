# 0010 – Mandantentrennung: Row-Level-Security + zusammengesetzte Fremdschluessel

> **Status ab Welle 4: ersetzt durch ADR 0031 (E34–E37, 2026-11-09).**
> [F] E34: eine Instanz pro Kunde, RLS zurueckgestellt.
> [A] Instanzgrenze statt RLS: eigene DB, Volumes, Secrets, Netze und Backup-Ziele pro Kunde. Normale FKs, minimale DB-Rechte und App-Autorisierung bleiben; Details ADR 0031.
> Der folgende Text ist die bisherige Fassung und bleibt als Historie erhalten.

Status: vorgeschlagen · 2026-11-08 · Bezug: E5, E7, FA-01, FA-03

## Kontext
Mandantenfaehigkeit ab Tag 1 (E5), erzwungen per PostgreSQL-RLS (E7, 00-kontext). Bekannte Fallen: App-Rolle als Tabellenbesitzer oder mit `BYPASSRLS` umgeht RLS; Kontext ausserhalb einer Transaktion leckt ueber den Connection-Pool [F, Q55-Tech].

## Entscheid
1. **Rollen:** `planora_owner` (besitzt Tabellen, nur fuer Migrationen), `planora_migrator`, `planora_app` (API/Worker: kein Owner, `NOBYPASSRLS`), `planora_readonly_ops` (Betrieb, nur Metriken-Views, keine Fachdaten). Plattform-Zugriffe ueber Mandanten hinweg nur ueber eigene `SECURITY DEFINER`-Funktionen mit Audit (z.B. Mandantenliste, Kostenbericht).
2. **Jede Mandantentabelle:** `mandant_id uuid NOT NULL`, `ENABLE` + `FORCE ROW LEVEL SECURITY`, Policy `USING (mandant_id = app.mandant()) WITH CHECK (mandant_id = app.mandant())`.
3. **`app.mandant()`** liest `current_setting('app.mandant_id', true)`; ist der Wert leer oder NULL, **wirft die Funktion einen Fehler** (fail closed, laut statt still leer).
4. **Kontext nur per `SET LOCAL`** innerhalb einer Transaktion, ausschliesslich ueber den Wrapper `mitMandant(mandantId, userId, fn)` im Plattform-Kern. Direkter Pool-Zugriff ausserhalb des Wrappers ist per Lint verboten.
5. **Zusammengesetzte Schluessel:** Primaerschluessel `(id)`, zusaetzlich `UNIQUE (mandant_id, id)`; Fremdschluessel innerhalb des Mandanten immer `(mandant_id, x_id) REFERENCES t(mandant_id, id)`. Damit ist eine Querreferenz in einen anderen Mandanten **physisch unmoeglich**, auch bei einem Fehler in der App.
6. **Objektspeicher:** Schluessel beginnen mit `m/<mandant_id>/`; signierte URLs werden nur nach Pruefung des Dokument-Datensatzes (unter RLS) ausgestellt, Gueltigkeit 5 Minuten [A].
7. **Liegenschafts-Rechte** (FA-04) werden in der Anwendung (Modul `identitaet`) geprueft, nicht per RLS [A]. Grund: RLS bleibt einfach und beweisbar; die Liegenschaftspruefung ist eine zweite, getestete Schicht.
8. **Tests (CI, Pflicht):** (a) Katalogpruefung aller Tabellen auf Policy + FORCE; (b) pro Tabelle Lese-/Schreibversuch mit fremdem Mandanten → 0 Zeilen bzw. Fehler; (c) fehlender Kontext → Fehler; (d) Pool-Leak-Test: parallele Requests zweier Mandanten auf kleinem Pool, 0 Fremdzeilen; (e) API-Level-Test FA-01 (UI, API, Export, Suche).

## Alternativen
- Schema pro Mandant: starke Trennung, aber Migrationen x N, Pool pro Schema, schwer bei 100+ Mandanten [A].
- Datenbank pro Mandant: fuer Enterprise-On-Prem ohnehin gegeben; in SaaS zu teuer fuer V1. Option fuer einzelne regulierte Kunden spaeter (gleicher Code, eigene Instanz).
- Nur App-Filter (`WHERE mandant_id`): ein vergessener Filter = Leck → verworfen.

## Konsequenzen
- + Drei unabhaengige Schranken: RLS, zusammengesetzte FKs, App-Pruefung.
- − Jede Abfrage braucht eine Transaktion; geringe Mehrkosten [A].
- − Mandantenuebergreifende Plattform-Auswertungen nur ueber definierte Funktionen.
- Spike S4.
