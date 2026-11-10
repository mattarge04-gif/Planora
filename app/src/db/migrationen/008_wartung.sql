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

-- Host-Konsole (Spec §5 Erstadmin, PP9-3): planora_betrieb darf Setup-Token anlegen und den Erstadmin einloesen, aber nur
-- ueber diese beiden Funktionen. Kein DML auf den Auth-Tabellen, kein DDL, kein Eigentuemer-Passwort in der Konsole.
create function setup_token_anlegen(p_hash text) returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_hash !~ '^[0-9a-f]{64}$' then raise exception 'setup_token: Hash ungueltig'; end if;
  insert into setup_token(hash, gueltig_bis) values (p_hash, now() + interval '15 minutes');
  perform betrieb_ereignis('setup.token', '{}'::jsonb);
end $$;

-- Loest ein gueltiges Token genau einmal ein und legt den ersten Admin an (gleiche Schritte wie loeseSetupTokenEin).
-- Das Passwort kommt bereits als Argon2id-Hash; Klartext erreicht die Datenbank nie.
create function erstadmin_anlegen(p_token_hash text, p_benutzer_id text, p_name text, p_email text, p_passwort_hash text, p_audit_id uuid) returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
declare v_jetzt timestamptz := now();
begin
  if p_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' or p_email <> lower(p_email) then raise exception 'Ungueltige E-Mail-Adresse'; end if;
  if p_passwort_hash !~ '^[$]argon2id[$]' then raise exception 'Passwort-Hash ungueltig'; end if;
  if coalesce(p_benutzer_id, '') = '' or coalesce(p_name, '') = '' or p_audit_id is null then raise exception 'Angaben unvollstaendig'; end if;
  update setup_token set eingeloest = true where hash = p_token_hash and not eingeloest and gueltig_bis > v_jetzt;
  if not found then raise exception 'Token ungueltig oder abgelaufen'; end if;
  insert into "user"(id, name, email, email_verified, created_at, updated_at) values (p_benutzer_id, p_name, p_email, true, v_jetzt, v_jetzt);
  insert into account(id, account_id, provider_id, user_id, password, created_at, updated_at)
    values (gen_random_uuid()::text, p_benutzer_id, 'credential', p_benutzer_id, p_passwort_hash, v_jetzt, v_jetzt);
  insert into konto_status(benutzer_id, status, audit_id) values (p_benutzer_id, 'aktiv', p_audit_id);
  insert into rolle_zuordnung(benutzer_id, rolle) values (p_benutzer_id, 'admin');
  insert into audit_person(audit_id, benutzer_id) values (p_audit_id, p_benutzer_id);
  perform audit_schreiben(p_audit_id, 'konto.erstadmin', '{}'::jsonb);
end $$;

revoke all on function setup_token_anlegen(text), erstadmin_anlegen(text, text, text, text, text, uuid) from public;
grant execute on function setup_token_anlegen(text), erstadmin_anlegen(text, text, text, text, text, uuid) to planora_betrieb;
