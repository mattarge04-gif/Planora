-- Schlaue Suche und Ordner-Ablage (Spec 2026-11-26, E48). pg_trgm und unaccent sind contrib-Extensions ("trusted"), kein pgvector.
create extension if not exists pg_trgm;
create extension if not exists unaccent;
-- unaccent() ist nur STABLE; generierte Spalte und Ausdrucksindex brauchen IMMUTABLE (festes Woerterbuch, Schema qualifiziert).
create function planora_unaccent(text) returns text language sql immutable parallel safe strict
  as $$ select public.unaccent('public.unaccent'::regdictionary, $1) $$;

-- Text-Status (Hintergrundjob) und Zuordnung der Ablage; "undefiniert" = keine Bauteil-Verknuepfung und kein Ort.
alter table dokument
  add column text_status text not null default 'offen' check (text_status in ('offen','fertig','ohne_text','fehler')),
  add column text_grund text check (length(text_grund) <= 300),
  add column ort_geschoss_id uuid references geschoss(id) on delete set null,
  add column ort_einheit_id uuid references einheit(id) on delete set null,
  add column allgemein boolean not null default false,
  add constraint dokument_ort_eins check (num_nonnulls(ort_geschoss_id, ort_einheit_id) + allgemein::int <= 1);
create index dokument_text_offen on dokument(text_status) where text_status = 'offen';

-- Abschnitte je Seite / Blatt / Absatzgruppe; nr 0 = Dateiname (Scans und Bilder sind so per Name findbar).
create table dokument_abschnitt(
  id uuid primary key default gen_random_uuid(),
  dokument_id uuid not null references dokument(id) on delete cascade,
  nr int not null check (nr >= 0),
  ort_art text not null check (ort_art in ('name','seite','blatt','absatz')),
  ort int not null check (ort >= 0),
  text text not null check (length(text) between 1 and 4000),
  tsv tsvector generated always as (to_tsvector('german', planora_unaccent(text))) stored,
  vektor real[],
  modell text,
  check ((vektor is null) = (modell is null)),
  unique (dokument_id, nr)
);
create index dokument_abschnitt_tsv on dokument_abschnitt using gin(tsv);
create index dokument_abschnitt_trgm on dokument_abschnitt using gin(planora_unaccent(text) gin_trgm_ops);
grant select, insert, update, delete on dokument_abschnitt to planora_app;

-- KI-Kostenbuch gemeinsam mit "Preis aus Dokument" (gleiches Monatsbudget); bestehende Zeilen sind Preis-Lesungen.
alter table preis_lesung add column zweck text not null default 'preis'
  check (zweck in ('preis','suche_vektor','suche_antwort','ablage_vorschlag'));
