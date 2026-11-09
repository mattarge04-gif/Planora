create table liegenschaft(id uuid primary key default gen_random_uuid(), name text not null);
create table rolle_zuordnung(benutzer_id text primary key references "user"(id) on delete cascade, rolle text not null check (rolle in ('betreiber','admin','bearbeiter','leser')));
create table rolle_liegenschaft(benutzer_id text references "user"(id) on delete cascade, liegenschaft_id uuid references liegenschaft(id) on delete cascade, primary key (benutzer_id, liegenschaft_id));
grant select, insert, update, delete on liegenschaft, rolle_zuordnung, rolle_liegenschaft to planora_app;
