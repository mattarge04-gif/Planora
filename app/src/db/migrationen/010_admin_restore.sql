-- App-Admins sehen Konten, Rollen, Scopes und Journal-Lage; Host-Freigabe bleibt separat.
create function restore_admin_uebersicht(p_admin text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if not exists(select 1 from public.konto_status k join public.rolle_zuordnung r on r.benutzer_id=k.benutzer_id
    where k.benutzer_id=p_admin and k.status='aktiv' and r.rolle='admin') then
    raise exception 'Aktiver Admin erforderlich';
  end if;
  return public.freigabe_uebersicht() || jsonb_build_object('journalAusstehend',
    (select count(*) from public.loesch_journal where zustand='offen'));
end $$;
revoke all on function restore_admin_uebersicht(text) from public;
grant execute on function restore_admin_uebersicht(text) to planora_app;
