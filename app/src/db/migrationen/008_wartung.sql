-- Wartungsflag (Spec §8 Schritt 1, §14.4): sperrt Mutationen in der API und die Job-Verarbeitung im Worker.
-- Lesen: planora_app (Grant auf instanz_einstellung seit 001) und planora_betrieb. Schreiben: nur planora_betrieb ueber setze_wartung.
insert into instanz_einstellung values ('wartung', 'false'::jsonb) on conflict (schluessel) do nothing;

-- Betriebsereignisse (Update, Wartung, Smoke) ins Audit: Art immer mit Praefix "betrieb.", keine audit_id (Host-Konsole).
create function betrieb_ereignis(p_art text, p_daten jsonb) returns bigint
  language sql security definer set search_path = public, pg_temp as
  $$ insert into audit_eintrag(audit_id, art, daten) values (null, 'betrieb.' || p_art, coalesce(p_daten, '{}'::jsonb)) returning id $$;

create function setze_wartung(p_aktiv boolean) returns void
  language sql security definer set search_path = public, pg_temp as
  $$ insert into instanz_einstellung(schluessel, wert) values ('wartung', to_jsonb(p_aktiv))
       on conflict (schluessel) do update set wert = excluded.wert;
     select betrieb_ereignis(case when p_aktiv then 'wartung.ein' else 'wartung.aus' end, '{}'::jsonb); $$;

revoke all on function betrieb_ereignis(text, jsonb), setze_wartung(boolean) from public;
grant execute on function betrieb_ereignis(text, jsonb), setze_wartung(boolean) to planora_betrieb;

-- Lesezugriffe des Betriebswerkzeugs (Update-Vorpruefung §8 Schritt 0): Wartungsflag/instanz_id, letzter gepruefter
-- Sicherungssatz, Schema-Stand.
grant select on instanz_einstellung, backup_lauf, migration_journal to planora_betrieb;
