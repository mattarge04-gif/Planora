-- Stufe 1 Interview-Assistent (Spec docs/superpowers/specs/2026-11-12-stufe1-interview-design.md §4).
-- Regelwerk v2: Gebaeudemasse ergeben sich aus dem Inhalt, daher nur bei v1 Pflicht.
alter table gebaeude drop constraint if exists gebaeude_grundform_check;
alter table gebaeude add constraint gebaeude_grundform_check check (grundform in ('quader','quadrat','l_form','u_form'));
alter table gebaeude alter column breite_m drop not null, alter column tiefe_m drop not null;
alter table gebaeude add constraint gebaeude_masse_v1 check (regelwerk_version <> 1 or (breite_m is not null and tiefe_m is not null));

create table gruppe(
  id uuid primary key default gen_random_uuid(),
  liegenschaft_id uuid not null,
  gebaeude_id uuid not null,
  verteiler_bauteil_id uuid not null,
  nummer int not null check (nummer between 1 and 99),
  bezeichnung text not null check (length(bezeichnung) between 1 and 200),
  art text not null check (art in ('ungeregelt','beimisch','drossel','einspritz','umlenk')),
  reihenfolge int not null,
  unique (id, liegenschaft_id),
  unique (verteiler_bauteil_id, nummer),
  foreign key (gebaeude_id, liegenschaft_id) references gebaeude(id, liegenschaft_id) on delete cascade,
  foreign key (verteiler_bauteil_id, liegenschaft_id) references bauteil(id, liegenschaft_id) on delete cascade
);
create index gruppe_gebaeude on gruppe(gebaeude_id);
create table gruppe_verbraucher(
  gruppe_id uuid not null,
  bauteil_id uuid not null unique,
  liegenschaft_id uuid not null,
  primary key (gruppe_id, bauteil_id),
  foreign key (gruppe_id, liegenschaft_id) references gruppe(id, liegenschaft_id) on delete cascade,
  foreign key (bauteil_id, liegenschaft_id) references bauteil(id, liegenschaft_id) on delete cascade
);
alter table bauteil add column gruppe_id uuid, add column vor_bauteil_id uuid,
  add constraint bauteil_ort_exklusiv check (num_nonnulls(gruppe_id, vor_bauteil_id) <= 1),
  add constraint bauteil_gruppe_fk foreign key (gruppe_id, liegenschaft_id) references gruppe(id, liegenschaft_id) on delete set null (gruppe_id),
  add constraint bauteil_vor_fk foreign key (vor_bauteil_id, liegenschaft_id) references bauteil(id, liegenschaft_id) on delete set null (vor_bauteil_id);
create table entwurf(
  gebaeude_id uuid primary key,
  liegenschaft_id uuid not null,
  stand int not null default 0,
  daten jsonb not null check (pg_column_size(daten) <= 1048576),
  geaendert_am timestamptz not null default now(),
  foreign key (gebaeude_id, liegenschaft_id) references gebaeude(id, liegenschaft_id) on delete cascade
);
grant select, insert, update, delete on gruppe, gruppe_verbraucher, entwurf to planora_app;
