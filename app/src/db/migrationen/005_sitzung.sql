create table sitzung_aktivitaet(session_id text primary key references session(id) on delete cascade, zuletzt_aktiv timestamptz not null);
grant select, insert, update, delete on sitzung_aktivitaet to planora_app;

-- Absolute Sitzungsdauer 12 h ab Anlage, unabhaengig von Better-Auth-Pfaden (rememberMe:false = 86400 s, Refresh) (PP7-2)
create function session_regeln() returns trigger language plpgsql as $$
begin
  new.expires_at := least(new.expires_at, new.created_at + interval '43200 seconds');
  return new;
end $$;
create trigger session_regeln before insert or update on session for each row execute function session_regeln();
