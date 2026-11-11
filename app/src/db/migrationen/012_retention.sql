-- M1-Abnahme Punkt 3: Aufbewahrung der Sicherungssaetze. Ein von der Retention entfernter Satz bleibt als Zeile mit
-- Zustand 'entfernt' sichtbar (Nachvollziehbarkeit), sein Inventar wird im Ziel geloescht. Nur ueber diese Funktionen.
alter table backup_lauf drop constraint backup_lauf_zustand_check;
alter table backup_lauf add constraint backup_lauf_zustand_check
  check (zustand in ('laufend','gesichert','geprueft','fehlgeschlagen','entfernt'));

create function backup_lauf_entfernt(p_id uuid) returns void
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_alt text;
begin
  select zustand into v_alt from public.backup_lauf where id=p_id for update;
  -- Unbekannte Saetze (z.B. aus einer anderen Zeitlinie vor einem Restore) bleiben ohne Zeile; nichts zu tun.
  if not found or v_alt='entfernt' then return; end if;
  if v_alt not in ('geprueft','fehlgeschlagen') then raise exception 'Laufender Sicherungssatz darf nicht entfernt werden'; end if;
  update public.backup_lauf set zustand='entfernt' where id=p_id;
  perform public.audit_schreiben(null, 'backup.entfernt', jsonb_build_object('backupId', p_id, 'vorher', v_alt));
end $$;

create function backup_retention_protokoll(p_daten jsonb) returns void
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if jsonb_typeof(p_daten) is distinct from 'object' then raise exception 'Ungueltiges Retention-Protokoll'; end if;
  perform public.audit_schreiben(null, 'backup.retention', p_daten);
end $$;

revoke all on function backup_lauf_entfernt(uuid), backup_retention_protokoll(jsonb) from public;
grant execute on function backup_lauf_entfernt(uuid), backup_retention_protokoll(jsonb) to planora_betrieb;

-- PP11a-N-3: Ein zwischen 'gesichert' und 'geprueft' hart beendeter Lauf (OOM, kill) blieb fuer immer 'gesichert' und
-- blockierte die Journal-Kuerzung. Der Heartbeat laeuft auch in 'gesichert' weiter (backup_lauf_heartbeat), also gilt
-- dieselbe Regel wie fuer 'laufend': nur bei nachweislich gestopptem Container und Heartbeat aelter als 10 Minuten.
create or replace function backup_reconcile(p_container_laeuft boolean) returns integer
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_anzahl integer;
begin
  -- Unbekannt (NULL) ist kein Nachweis fuer einen gestoppten Container.
  if p_container_laeuft is distinct from false then return 0; end if;
  with geaendert as (
    update public.backup_lauf set zustand='fehlgeschlagen'
     where zustand in ('laufend','gesichert') and heartbeat < clock_timestamp()-interval '10 minutes' returning id
  ) select count(*)::integer into v_anzahl from geaendert;
  if v_anzahl>0 then perform public.audit_schreiben(null, 'backup.reconcile', jsonb_build_object('anzahl',v_anzahl)); end if;
  return v_anzahl;
end $$;
