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
    -- Am Transaktionsende den effektiven Endstand vergleichen. Reine
    -- Wiederholungen und Aufwertungen verlieren keine bisherigen Rechte.
    if not exists(select 1 from public.rolle_zuordnung r where r.benutzer_id=old.benutzer_id and
       (r.rolle=old.rolle or (old.rolle='leser' and r.rolle in ('bearbeiter','admin')) or (old.rolle='bearbeiter' and r.rolle='admin'))) then
      perform public.journal_eintrag('rolle.entziehen',jsonb_build_object('benutzerId',old.benutzer_id,'rolle',old.rolle)::text);
    end if;
  else
    -- setzeRolle loescht/erneuert Scopes auch bei unveraenderter Zuweisung.
    if not exists(select 1 from public.rolle_liegenschaft r where r.benutzer_id=old.benutzer_id and r.liegenschaft_id=old.liegenschaft_id) then
      perform public.journal_eintrag('scope.entziehen',jsonb_build_object('benutzerId',old.benutzer_id,'liegenschaftId',old.liegenschaft_id)::text);
    end if;
  end if;
  return null;
end $$;
revoke all on function sicherheits_journal() from public;
create trigger konto_sperrjournal after update of status on konto_status for each row execute function sicherheits_journal();
create constraint trigger rollen_entzugsjournal after update or delete on rolle_zuordnung
  deferrable initially deferred for each row execute function sicherheits_journal();
create constraint trigger scope_entzugsjournal after update or delete on rolle_liegenschaft
  deferrable initially deferred for each row execute function sicherheits_journal();

create table restore_zustand(id integer primary key check(id=1), instanz_id uuid not null, backup_id uuid not null,
  journal_seq bigint not null, stand_seq bigint, stand_zeit timestamptz,
  zustand text not null check(zustand in ('gesperrt','bereit','freigegeben')));
create table restore_konto(benutzer_id text primary key references "user"(id) on delete cascade,
  vorher_status text not null, sperre_seq bigint);
create table freigabe_token(hash text primary key, benutzer_id text not null references "user"(id) on delete cascade,
  gueltig_bis timestamptz not null, eingeloest boolean not null default false);

-- Wird zusammen mit dem Dump in EINER Importtransaktion ausgefuehrt: kein
-- restauriertes Konto ist vor der Sperre von anderen Verbindungen sichtbar.
create function restore_sperren(p_instanz uuid,p_backup uuid,p_seq bigint) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if (select wert #>> '{}' from public.instanz_einstellung where schluessel='instanz_id') is distinct from p_instanz::text then raise exception 'Fremde Restore-Instanz'; end if;
  delete from public.freigabe_token; delete from public.restore_konto; delete from public.restore_zustand;
  insert into public.restore_zustand values(1,p_instanz,p_backup,p_seq,null,null,'gesperrt');
  insert into public.restore_konto(benutzer_id,vorher_status) select benutzer_id,status from public.konto_status;
  update public.konto_status set status='zu_bestaetigen';
  delete from public.session; delete from public.verification; delete from public.setup_token;
  update public.account set access_token=null,refresh_token=null,id_token=null;
  update public.backup_lauf set zustand='fehlgeschlagen' where zustand='laufend';
  update public.modul_schalter set aktiv=false where modul_id='ki';
  insert into public.instanz_einstellung values('restore_gesperrt','true') on conflict(schluessel) do update set wert='true';
  perform public.audit_schreiben(null,'restore.gesperrt',jsonb_build_object('backupId',p_backup,'journalSeq',p_seq));
end $$;

create function restore_journal(p_seq bigint,p_art text,p_ziel text,p_zeit timestamptz) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_seq bigint; v_zaehler bigint; v_ziel jsonb;
begin
  select journal_seq into v_seq from public.restore_zustand where id=1 and zustand='gesperrt' for update;
  if v_seq is null or p_seq<>v_seq+1 then raise exception 'Journal-Luecke oder Restore nicht gesperrt'; end if;
  select seq into v_zaehler from public.journal_zaehler where id=1 for update;
  case p_art
    when 'konto.sperren' then update public.restore_konto set sperre_seq=p_seq where benutzer_id=p_ziel;
    when 'rolle.entziehen' then
      v_ziel:=p_ziel::jsonb;
      if v_ziel->>'benutzerId' is null or v_ziel->>'rolle' is null or v_ziel->>'rolle' not in ('admin','bearbeiter','leser','betreiber') then raise exception 'Ungueltiger Rollen-Eintrag'; end if;
      delete from public.rolle_zuordnung where benutzer_id=v_ziel->>'benutzerId' and rolle=v_ziel->>'rolle';
    when 'scope.entziehen' then
      v_ziel:=p_ziel::jsonb;
      if v_ziel->>'benutzerId' is null or v_ziel->>'liegenschaftId' is null then raise exception 'Ungueltiger Scope-Eintrag'; end if;
      delete from public.rolle_liegenschaft where benutzer_id=v_ziel->>'benutzerId' and liegenschaft_id=(v_ziel->>'liegenschaftId')::uuid;
    when 'datei.loeschen' then
      if p_ziel !~ '^sha256/[0-9a-f]{2}/[0-9a-f]{2}/[0-9a-f]{64}$' then raise exception 'Ungueltiger Dateieintrag'; end if;
      delete from public.datei_referenz where schluessel=p_ziel;
    else raise exception 'Unbekannte Journal-Art';
  end case;
  set constraints rollen_entzugsjournal,scope_entzugsjournal immediate;
  -- Replay kann selbst Sicherheits-Trigger ausloesen. Unter dem Zaehlerlock
  -- deren lokale Duplikate entfernen und den originalen externen Eintrag erhalten.
  delete from public.loesch_journal where seq>v_zaehler;
  insert into public.loesch_journal(seq,art,ziel,zeit,zustand) values(p_seq,p_art,p_ziel,p_zeit,'quittiert');
  update public.journal_zaehler set seq=p_seq where id=1;
  set constraints rollen_entzugsjournal,scope_entzugsjournal deferred;
  update public.restore_zustand set journal_seq=p_seq where id=1;
  perform public.audit_schreiben(null,'restore.journal',jsonb_build_object('seq',p_seq,'art',p_art));
end $$;

create function restore_bereit(p_stand bigint,p_zeit timestamptz) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  update public.restore_zustand set zustand='bereit',stand_seq=p_stand,stand_zeit=p_zeit
   where id=1 and zustand='gesperrt' and journal_seq>=p_stand;
  if not found then raise exception 'Restore unvollstaendig'; end if;
  perform public.audit_schreiben(null,'restore.bereit',jsonb_build_object('standSeq',p_stand));
end $$;

create function freigabe_uebersicht() returns jsonb
language sql security definer set search_path=pg_catalog,public as $$
  select jsonb_build_object('journal',(select jsonb_build_object('instanz_id',r.instanz_id,'backup_id',r.backup_id,
    'journal_seq',r.journal_seq::text,'stand_seq',r.stand_seq::text,'stand_zeit',r.stand_zeit,'zustand',r.zustand) from public.restore_zustand r where id=1),
    'konten',coalesce((select jsonb_agg(jsonb_build_object('benutzerId',u.id,'name',u.name,'email',u.email,'rolle',r.rolle,
      'status',k.status,'vorherStatus',rk.vorher_status,'sperreSeq',rk.sperre_seq::text,
      'scopes',(select coalesce(jsonb_agg(liegenschaft_id),'[]') from public.rolle_liegenschaft l where l.benutzer_id=u.id)) order by u.id)
     from public."user" u join public.konto_status k on k.benutzer_id=u.id
     left join public.rolle_zuordnung r on r.benutzer_id=u.id left join public.restore_konto rk on rk.benutzer_id=u.id),'[]'))
$$;
create function freigabe_erzeugen(p_benutzer text,p_hash text) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_audit uuid;
begin
  perform 1 from public.restore_zustand where id=1 and zustand in ('bereit','freigegeben') for update;
  if not found then raise exception 'Restore nicht bereit'; end if;
  select k.audit_id into v_audit from public.konto_status k join public.rolle_zuordnung r on r.benutzer_id=k.benutzer_id
   where k.benutzer_id=p_benutzer and k.status='zu_bestaetigen' and r.rolle='admin' for update of k;
  if not found or p_hash !~ '^[0-9a-f]{64}$' then raise exception 'Admin nicht zur Freigabe zugelassen'; end if;
  delete from public.freigabe_token where benutzer_id=p_benutzer;
  insert into public.freigabe_token(hash,benutzer_id,gueltig_bis) values(p_hash,p_benutzer,clock_timestamp()+interval '15 minutes');
  perform public.audit_schreiben(v_audit,'restore.admin_bestaetigt','{}');
end $$;
create function freigabe_einloesen(p_hash text,p_passwort_hash text) returns text
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_benutzer text; v_audit uuid;
begin
  perform 1 from public.restore_zustand where id=1 and zustand in ('bereit','freigegeben') for update;
  if not found then raise exception 'Restore nicht bereit'; end if;
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
revoke all on function restore_sperren(uuid,uuid,bigint),restore_journal(bigint,text,text,timestamptz),restore_bereit(bigint,timestamptz),
  freigabe_uebersicht(),freigabe_erzeugen(text,text),freigabe_einloesen(text,text) from public;
grant execute on function restore_sperren(uuid,uuid,bigint),restore_journal(bigint,text,text,timestamptz),restore_bereit(bigint,timestamptz),
  freigabe_uebersicht(),freigabe_erzeugen(text,text),freigabe_einloesen(text,text) to planora_betrieb;

create function restore_konto_bestaetigen(p_admin text,p_benutzer text) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_audit uuid; v_ziel uuid;
begin
  perform 1 from public.restore_zustand where id=1 and zustand='freigegeben' for share;
  if not found then raise exception 'Host-Freigabe fehlt'; end if;
  select k.audit_id into v_audit from public.konto_status k join public.rolle_zuordnung r on r.benutzer_id=k.benutzer_id
   where k.benutzer_id=p_admin and k.status='aktiv' and r.rolle='admin' for share of k;
  if not found then raise exception 'Aktiver Admin erforderlich'; end if;
  if exists(select 1 from public.rolle_zuordnung where benutzer_id=p_benutzer and rolle='admin') then raise exception 'Admin nur ueber Host-Konsole freigeben'; end if;
  update public.konto_status set status='aktiv' where benutzer_id=p_benutzer and status='zu_bestaetigen' returning audit_id into v_ziel;
  if not found then raise exception 'Konto nicht zur Bestaetigung vorgemerkt'; end if;
  perform public.audit_schreiben(v_audit,'restore.konto_bestaetigt',jsonb_build_object('zielAuditId',v_ziel));
end $$;
revoke all on function restore_konto_bestaetigen(text,text) from public;
grant execute on function restore_konto_bestaetigen(text,text) to planora_app;
