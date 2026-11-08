# 0005 – ORM Drizzle; RLS, Trigger und Rechte als handgeschriebenes SQL

Status: vorgeschlagen · 2026-11-08 · Bezug: E7, FA-01, FA-06

## Kontext
Drizzle 0.45.4 (Apache-2.0) unterstuetzt RLS per `pgPolicy` [F, Q50/Q55-Tech], ist aber **vor 1.0** [F, 02 Kap. 6]. Prisma 7.10.1: RLS nur ueber Extensions/Transaktionen [A, 02].

## Entscheid
- **Drizzle ORM** fuer Schema-Typen und Abfragen, Version **exakt gepinnt** (kein `^`).
- **Sicherheitsrelevantes SQL wird von Hand geschrieben** und als eigene Migrationsdateien versioniert: RLS-Policies, `FORCE ROW LEVEL SECURITY`, GRANTs, Audit-Trigger, Hilfsfunktion `app.mandant()`. Diese Teile duerfen nicht von einem Generator-Update abhaengen.
- Migrationen: drizzle-kit erzeugt einen Vorschlag → Review → eingefrorene SQL-Datei. Ausfuehrung nur durch die Rolle `planora_migrator` im Prozess `migrator`. Regel expand/contract (03 Kap. 10).
- Ein CI-Test liest `pg_class`/`pg_policies` und **schlaegt fehl**, wenn eine Tabelle mit Spalte `mandant_id` keine aktive, erzwungene Policy hat.

## Alternativen
- Prisma 7: RLS-Integration umstaendlicher, verwirrende Release-Tags [F/A, 02].
- Kysely oder reines SQL: maximale Kontrolle, mehr Schreibaufwand. Bleibt Ausweichweg, falls Drizzle bricht; die Migrationen sind ohnehin SQL.

## Konsequenzen
- + Sicherheitskern unabhaengig vom ORM.
- − Zwei Quellen (TS-Schema, SQL-Policies) → die CI-Pruefung oben ist Pflicht.
- Spike S11: `pgPolicy` und Migrationen gegen Exoscale-PG.
