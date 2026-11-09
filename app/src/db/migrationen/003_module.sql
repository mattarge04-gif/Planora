create table modul_schalter(modul_id text primary key, aktiv boolean not null, geaendert_am timestamptz not null default now(), geaendert_von uuid, manifest_version text);
grant select on modul_schalter to planora_app;
