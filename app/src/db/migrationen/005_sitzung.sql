create table sitzung_aktivitaet(session_id text primary key references session(id) on delete cascade, zuletzt_aktiv timestamptz not null);
grant select, insert, update, delete on sitzung_aktivitaet to planora_app;

-- Absolute Sitzungsdauer 12 h ab Anlage, unabhaengig von Better-Auth-Pfaden (rememberMe:false = 86400 s, Refresh) (PP7-2)
-- Neue Sitzung nur fuer aktives Konto, geprueft unter geteiltem Konto-Lock: setzeKontoStatus nimmt FOR UPDATE, damit
-- serialisieren Sperre und Sitzungsanlage; eine vor der Sperre begonnene Anlage wird danach entzogen (PP7-4)
create function session_regeln() returns trigger language plpgsql as $$
declare v_status text;
begin
  new.expires_at := least(new.expires_at, new.created_at + interval '43200 seconds');
  if tg_op = 'INSERT' then
    select status into v_status from konto_status where benutzer_id = new.user_id for share;
    if v_status is distinct from 'aktiv' then
      raise exception 'konto_nicht_aktiv' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger session_regeln before insert or update on session for each row execute function session_regeln();
