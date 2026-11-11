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
