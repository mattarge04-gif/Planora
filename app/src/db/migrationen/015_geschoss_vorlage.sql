-- Regelgeschoss-Vorlagen des Assistenten (Spec Heizungserfassung 4.1).
-- Hilfsdaten fuer die Erfassung; die Beschreibung (Einheiten, Bauteile, Gruppen) bleibt die Wahrheit.
create table geschoss_vorlage(
  gebaeude_id uuid primary key,
  liegenschaft_id uuid not null,
  daten jsonb not null check (pg_column_size(daten) <= 1048576),
  geaendert_am timestamptz not null default now(),
  foreign key (gebaeude_id, liegenschaft_id) references gebaeude(id, liegenschaft_id) on delete cascade
);
grant select, insert, update, delete on geschoss_vorlage to planora_app;
