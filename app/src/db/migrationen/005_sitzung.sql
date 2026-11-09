create table sitzung_aktivitaet(session_id text primary key references session(id) on delete cascade, zuletzt_aktiv timestamptz not null);
grant select, insert, update, delete on sitzung_aktivitaet to planora_app;
