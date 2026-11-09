do $$ begin
  if not exists (select 1 from pg_roles where rolname='planora_app') then create role planora_app nologin; end if;
  if not exists (select 1 from pg_roles where rolname='planora_backup') then create role planora_backup nologin; end if;
  if not exists (select 1 from pg_roles where rolname='planora_betrieb') then create role planora_betrieb nologin; end if;
end $$;
grant usage on schema public to planora_app, planora_backup, planora_betrieb;
grant pg_read_all_data to planora_backup;
create table instanz_einstellung(schluessel text primary key, wert jsonb not null);
insert into instanz_einstellung values ('instanz_id', to_jsonb(gen_random_uuid()::text));
grant select on instanz_einstellung to planora_app;
