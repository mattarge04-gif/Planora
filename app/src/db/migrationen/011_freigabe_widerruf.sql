-- PP10b-2: Wiederholte Kontosperre darf keine alte Host-Freigabe ueberleben.
create or replace function freigabe_einloesen(p_hash text,p_passwort_hash text) returns text
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_benutzer text; v_audit uuid;
begin
  perform 1 from public.restore_zustand where id=1 and zustand in ('bereit','freigegeben') for update;
  if not found then raise exception 'Restore nicht bereit'; end if;
  select benutzer_id into v_benutzer from public.freigabe_token
   where hash=p_hash and not eingeloest and gueltig_bis>clock_timestamp();
  if not found then raise exception 'Token ungueltig oder abgelaufen'; end if;
  -- Konto vor Token sperren, wie die Kontosperre mit Token-Widerruf.
  perform 1 from public.konto_status where benutzer_id=v_benutzer and status='zu_bestaetigen' for update;
  if not found then raise exception 'Konto nicht zur Bestaetigung vorgemerkt'; end if;
  update public.freigabe_token set eingeloest=true where hash=p_hash and not eingeloest and gueltig_bis>clock_timestamp() returning benutzer_id into v_benutzer;
  if not found or p_passwort_hash not like '$argon2id$%' then raise exception 'Token ungueltig oder abgelaufen'; end if;
  if not exists(select 1 from public.rolle_zuordnung where benutzer_id=v_benutzer and rolle='admin') then raise exception 'Adminrolle entzogen'; end if;
  update public.account set password=p_passwort_hash,updated_at=clock_timestamp() where user_id=v_benutzer and provider_id='credential';
  if not found then raise exception 'Passwortkonto fehlt'; end if;
  update public.konto_status set status='aktiv' where benutzer_id=v_benutzer returning audit_id into v_audit;
  delete from public.session where user_id=v_benutzer;
  update public.restore_zustand set zustand='freigegeben' where id=1;
  update public.instanz_einstellung set wert='false' where schluessel='restore_gesperrt';
  perform public.audit_schreiben(v_audit,'restore.admin_aktiv','{}');
  return v_benutzer;
end $$;

create function freigabe_token_widerrufen() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if new.status='gesperrt' then
    delete from public.freigabe_token where benutzer_id=new.benutzer_id;
  end if;
  return new;
end $$;
revoke all on function freigabe_token_widerrufen() from public;
create trigger freigabe_widerruf after update of status on konto_status
 for each row execute function freigabe_token_widerrufen();
