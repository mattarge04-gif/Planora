-- Betrieb darf Zustandswechsel nur ueber diese geprueften Funktionen ausfuehren.
update backup_lauf set heartbeat = start where heartbeat is null;
alter table backup_lauf alter column heartbeat set default now();
alter table backup_lauf alter column heartbeat set not null;
grant select on backup_lauf, loesch_journal, journal_zaehler, instanz_einstellung to planora_betrieb;

create function backup_lauf_start(p_id uuid) returns void
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  -- Gleicher Lock wie GC und Referenzierung (007); bis zum Commit halten.
  perform pg_advisory_xact_lock_shared(7310002);
  insert into public.backup_lauf(id, zustand, heartbeat) values (p_id, 'laufend', clock_timestamp());
  perform public.audit_schreiben(null, 'backup.start', jsonb_build_object('backupId', p_id));
end $$;

create function backup_lauf_heartbeat(p_id uuid) returns void
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  update public.backup_lauf set heartbeat=clock_timestamp() where id=p_id and zustand in ('laufend','gesichert');
  if not found then raise exception 'Backup nicht aktiv'; end if;
end $$;

create function backup_lauf_setze(p_id uuid, p_zustand text) returns void
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_alt text;
begin
  select zustand into v_alt from public.backup_lauf where id=p_id for update;
  if not found then raise exception 'Backup unbekannt'; end if;
  if not ((v_alt='laufend' and p_zustand in ('gesichert','fehlgeschlagen'))
       or (v_alt='gesichert' and p_zustand in ('geprueft','fehlgeschlagen'))) then
    raise exception 'Ungueltiger Backup-Zustandswechsel: % -> %', v_alt, p_zustand;
  end if;
  update public.backup_lauf set zustand=p_zustand, heartbeat=clock_timestamp() where id=p_id;
  perform public.audit_schreiben(null, 'backup.' || p_zustand, jsonb_build_object('backupId', p_id));
end $$;

create function journal_quittiere(p_seq bigint) returns void
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  perform 1 from public.journal_zaehler where id=1 for update;
  if not exists (select 1 from public.loesch_journal where seq=p_seq) then raise exception 'Journal unbekannt'; end if;
  if exists (select 1 from public.loesch_journal where seq<p_seq and zustand='offen') then
    raise exception 'Journal-Reihenfolge verletzt';
  end if;
  update public.loesch_journal set zustand='quittiert' where seq=p_seq and zustand='offen';
  if found then perform public.audit_schreiben(null, 'journal.quittiert', jsonb_build_object('seq', p_seq)); end if;
end $$;

create function backup_reconcile(p_container_laeuft boolean) returns integer
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_anzahl integer;
begin
  -- Unbekannt (NULL) ist kein Nachweis fuer einen gestoppten Container.
  if p_container_laeuft is distinct from false then return 0; end if;
  with geaendert as (
    update public.backup_lauf set zustand='fehlgeschlagen'
     where zustand='laufend' and heartbeat < clock_timestamp()-interval '10 minutes' returning id
  ) select count(*)::integer into v_anzahl from geaendert;
  if v_anzahl>0 then perform public.audit_schreiben(null, 'backup.reconcile', jsonb_build_object('anzahl',v_anzahl)); end if;
  return v_anzahl;
end $$;

revoke all on function backup_lauf_start(uuid), backup_lauf_heartbeat(uuid), backup_lauf_setze(uuid,text),
  journal_quittiere(bigint), backup_reconcile(boolean) from public;
grant execute on function backup_lauf_start(uuid), backup_lauf_heartbeat(uuid), backup_lauf_setze(uuid,text),
  journal_quittiere(bigint), backup_reconcile(boolean) to planora_betrieb;

-- Verschluesseltes Versandmaterial bleibt fuer Retry identisch; der Online-Prozess
-- benoetigt nur den oeffentlichen Recovery-Empfaenger, niemals den privaten Key.
alter table loesch_journal add column versand_inhalt bytea;
create function journal_vorbereiten(p_seq bigint, p_inhalt bytea) returns bytea
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_inhalt bytea;
begin
  if octet_length(p_inhalt)=0 then raise exception 'Leeres Versandmaterial'; end if;
  update public.loesch_journal set versand_inhalt=coalesce(versand_inhalt,p_inhalt) where seq=p_seq returning versand_inhalt into v_inhalt;
  if not found then raise exception 'Journal unbekannt'; end if;
  return v_inhalt;
end $$;
revoke all on function journal_vorbereiten(bigint,bytea) from public;
grant execute on function journal_vorbereiten(bigint,bytea) to planora_betrieb;

-- Sicherheitsereignis und Outbox-Eintrag in derselben Transaktion, auch fuer
-- bestehende M1a-Aufrufer (keine getrennte, verlierbare Nachricht in der App).
create function sicherheits_journal() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if tg_table_name='konto_status' then
    if new.status='gesperrt' and old.status is distinct from new.status then
      perform public.journal_eintrag('konto.sperren',new.benutzer_id);
    end if;
  elsif tg_table_name='rolle_zuordnung' then
    perform public.journal_eintrag('rolle.entziehen',old.benutzer_id);
  else
    perform public.journal_eintrag('scope.entziehen',jsonb_build_object('benutzerId',old.benutzer_id,'liegenschaftId',old.liegenschaft_id)::text);
  end if;
  return null;
end $$;
revoke all on function sicherheits_journal() from public;
create trigger konto_sperrjournal after update of status on konto_status for each row execute function sicherheits_journal();
create trigger rollen_entzugsjournal after update or delete on rolle_zuordnung for each row execute function sicherheits_journal();
create trigger scope_entzugsjournal after update or delete on rolle_liegenschaft for each row execute function sicherheits_journal();
