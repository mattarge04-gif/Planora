-- M2a Welt-Kern (Spec docs/superpowers/specs/2026-11-11-m2a-welt-kern-design.md §4).
-- Jede Tabelle fuehrt liegenschaft_id; zusammengesetzte Fremdschluessel verhindern Verweise in fremde Liegenschaften.
create table gebaeude(
  id uuid primary key default gen_random_uuid(),
  liegenschaft_id uuid not null references liegenschaft(id) on delete cascade,
  name text not null check (length(name) between 1 and 200),
  grundform text not null check (grundform in ('quader','l_form','u_form')),
  breite_m double precision not null check (breite_m between 5 and 200),
  tiefe_m double precision not null check (tiefe_m between 5 and 200),
  regelwerk_version int not null,
  stand int not null default 0,
  unique (id, liegenschaft_id)
);
create index gebaeude_liegenschaft on gebaeude(liegenschaft_id);
create table geschoss(
  id uuid primary key default gen_random_uuid(),
  liegenschaft_id uuid not null,
  gebaeude_id uuid not null,
  code text not null,
  reihenfolge int not null,
  hoehe_m double precision not null check (hoehe_m between 2.4 and 6.0),
  unique (gebaeude_id, code),
  unique (id, liegenschaft_id),
  foreign key (gebaeude_id, liegenschaft_id) references gebaeude(id, liegenschaft_id) on delete cascade
);
create table einheit(
  id uuid primary key default gen_random_uuid(),
  liegenschaft_id uuid not null,
  geschoss_id uuid not null,
  bezeichnung text not null check (length(bezeichnung) between 1 and 200),
  art text not null,
  flaeche_m2 double precision check (flaeche_m2 > 0),
  reihenfolge int not null,
  layout_manuell jsonb,
  unique (id, liegenschaft_id),
  foreign key (geschoss_id, liegenschaft_id) references geschoss(id, liegenschaft_id) on delete cascade
);
create index einheit_geschoss on einheit(geschoss_id);
create table gebaeude_heizung_standard(
  gebaeude_id uuid not null,
  liegenschaft_id uuid not null,
  art text not null check (art in ('hk','fbh','tabs')),
  vorhanden text not null check (vorhanden in ('ja','nein','unbekannt')),
  primary key (gebaeude_id, art),
  foreign key (gebaeude_id, liegenschaft_id) references gebaeude(id, liegenschaft_id) on delete cascade
);
-- Nur Ausnahmen vom Gebaeudestandard
create table einheit_heizung(
  einheit_id uuid not null,
  liegenschaft_id uuid not null,
  art text not null check (art in ('hk','fbh','tabs')),
  vorhanden text not null check (vorhanden in ('ja','nein','unbekannt')),
  primary key (einheit_id, art),
  foreign key (einheit_id, liegenschaft_id) references einheit(id, liegenschaft_id) on delete cascade
);
create table bauteil(
  id uuid primary key default gen_random_uuid(),
  liegenschaft_id uuid not null,
  gebaeude_id uuid not null,
  katalog_id text not null,
  einheit_id uuid,
  geschoss_id uuid,
  menge int check (menge >= 0),
  status text not null check (status in ('vorgeschlagen','bestaetigt')),
  hersteller text check (length(hersteller) <= 200),
  typ text check (length(typ) <= 200),
  baujahr int check (baujahr between 1800 and 2100),
  reihenfolge int not null,
  position_manuell jsonb,
  check (num_nonnulls(einheit_id, geschoss_id) = 1),
  unique (id, liegenschaft_id),
  foreign key (gebaeude_id, liegenschaft_id) references gebaeude(id, liegenschaft_id) on delete cascade,
  foreign key (einheit_id, liegenschaft_id) references einheit(id, liegenschaft_id),
  foreign key (geschoss_id, liegenschaft_id) references geschoss(id, liegenschaft_id)
);
create index bauteil_gebaeude on bauteil(gebaeude_id);
create index bauteil_einheit on bauteil(einheit_id);
create index bauteil_geschoss on bauteil(geschoss_id);
create table versorgung(
  bauteil_id uuid not null,
  einheit_id uuid not null,
  liegenschaft_id uuid not null,
  primary key (bauteil_id, einheit_id),
  foreign key (bauteil_id, liegenschaft_id) references bauteil(id, liegenschaft_id) on delete cascade,
  foreign key (einheit_id, liegenschaft_id) references einheit(id, liegenschaft_id) on delete cascade
);
create index versorgung_einheit on versorgung(einheit_id);
grant select, insert, update, delete on gebaeude, geschoss, einheit, gebaeude_heizung_standard, einheit_heizung, bauteil, versorgung to planora_app;
