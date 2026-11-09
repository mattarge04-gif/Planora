# 0015 – Audit-Log per Datenbank-Trigger mit Hash-Kette

> **Status ab Welle 4: angepasst (E34–E37, 2026-11-09).**
> [A] Trigger, minimale Rechte und Hash-Kette bleiben, Kette instanzbezogen statt mandantenbezogen; keine Mandantenwechsel-Ereignisse.
> [A] Neu erfasst: Login, Rollen- und Modulschalter-Aenderung, Import, Instanz-Update. Grenzen gegen Host-/DB-Owner werden benannt (ADR 0031).
> Der folgende Text ist die bisherige Fassung und bleibt als Historie erhalten.

Status: vorgeschlagen · 2026-11-08 · Bezug: FA-06, NFR Nachvollziehbarkeit, ISO-27001-Naehe

## Kontext
FA-06: Fuer jede Aenderung an Elementen, Kennwerten, Bewertungen, Kosten sind wer, wann, alt, neu abrufbar; das Log ist nicht editierbar. Ein Audit in der Anwendung kann bei einem Programmierfehler fehlen.

## Entscheid
- Generischer **AFTER-Trigger** (INSERT/UPDATE/DELETE) auf allen fachlichen Mandantentabellen schreibt in `audit_eintrag`: `mandant_id`, `tabelle`, `datensatz_id`, `aktion`, `alt` (jsonb), `neu` (jsonb), `benutzer_id` (aus `app.user_id`), `korrelations_id` (aus `app.korrelations_id`), `zeitpunkt` (`clock_timestamp()`), `vorgaenger_hash`, `hash`.
- **Hash-Kette pro Mandant**: `hash = sha256(vorgaenger_hash || kanonischer Eintrag)`; Serialisierung pro Mandant ueber Advisory-Lock im Trigger [A, Last im Spike S4 mitmessen]. Taeglicher Job prueft die Kette und alarmiert bei Bruch.
- Rechte: `planora_app` hat auf `audit_eintrag` **nur SELECT** (RLS wie ueberall); Schreiben nur ueber den `SECURITY DEFINER`-Trigger. Kein UPDATE/DELETE fuer irgendeine App-Rolle.
- Fachliche Ereignisse ohne Tabellenaenderung (Login, Export, KI-Aufruf, Mandantenwechsel, Break-Glass-Zugriff) schreibt die Anwendung ueber dieselbe Funktion `audit.ereignis(...)`.
- Aufbewahrung: Audit lebt so lange wie der Mandant; bei Loeschung eines Benutzers wird `benutzer_id` durch ein Pseudonym ersetzt (Zuordnungstabelle wird geloescht), die Kette bleibt gueltig, weil sie ueber die Pseudonym-ID gerechnet wird [A].

## Alternativen
- Audit in der Anwendung: kann vergessen werden.
- pgaudit: protokolliert SQL, nicht Fachwerte alt/neu; fuer Betrieb ergaenzend moeglich, falls bei Exoscale verfuegbar [?].
- Externes WORM-Speicher-Log: Option fuer V2 (Export der Kette in Objektspeicher mit Object-Lock [?]).

## Konsequenzen
- + Kein Weg an der Protokollierung vorbei, ausser mit Owner-Rechten (nur Migrator, selbst auditiert ueber Migrationsprotokoll).
- − Schreiblast ca. verdoppelt; Massenaktionen (Sammelbestaetigung 100 Vorschlaege) erzeugen 100+ Eintraege [A, unkritisch].
