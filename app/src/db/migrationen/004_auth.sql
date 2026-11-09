create table "user" (id text primary key, name text not null, email text not null unique, email_verified boolean not null, image text, created_at timestamptz not null, updated_at timestamptz not null);
create table session (id text primary key, expires_at timestamptz not null, token text not null unique, created_at timestamptz not null, updated_at timestamptz not null, ip_address text, user_agent text, user_id text not null references "user"(id) on delete cascade);
create index on session(user_id);
create table account (id text primary key, account_id text not null, provider_id text not null, user_id text not null references "user"(id) on delete cascade, access_token text, refresh_token text, id_token text, access_token_expires_at timestamptz, refresh_token_expires_at timestamptz, scope text, password text, created_at timestamptz not null, updated_at timestamptz not null);
create table verification (id text primary key, identifier text not null, value text not null, expires_at timestamptz not null, created_at timestamptz, updated_at timestamptz);
-- Rate-Limit-Zaehler von Better Auth (rateLimit.storage = database, Spec §5)
create table rate_limit (id text primary key, key text not null unique, count integer not null, last_request bigint not null);
create table konto_status(benutzer_id text primary key references "user"(id) on delete cascade, status text not null check (status in ('aktiv','gesperrt','zu_bestaetigen')), audit_id uuid not null unique);
create table setup_token(hash text primary key, gueltig_bis timestamptz not null, eingeloest boolean not null default false);
grant select, insert, update, delete on "user", session, account, verification, rate_limit, konto_status to planora_app;

-- Fehlversuchssperre je Konto und je Client-IP: 10 Fehlversuche / 15 min -> 15 min gesperrt (Spec §5, PP7-5).
-- Reservierung vor der Passwortpruefung (atomar, Zeilensperren in fester Reihenfolge); Erfolg gibt die Reservierung zurueck.
create table anmelde_fehlversuch(schluessel text primary key, anzahl integer not null default 0, fenster_start timestamptz not null default now(), gesperrt_bis timestamptz);
grant select, insert, update, delete on anmelde_fehlversuch to planora_app;

-- Rueckgabe 0 = Versuch erlaubt (reserviert), sonst Wartezeit in Sekunden
create function anmeldung_reservieren(p_schluessel text[]) returns integer language plpgsql as $$
declare v_schluessel text[] := array(select distinct x from unnest(p_schluessel) x order by x);
        v_warte integer;
begin
  insert into anmelde_fehlversuch(schluessel) select x from unnest(v_schluessel) x order by x on conflict do nothing;
  perform 1 from anmelde_fehlversuch where schluessel = any(v_schluessel) order by schluessel for update;
  update anmelde_fehlversuch set anzahl = 0, fenster_start = now(), gesperrt_bis = null
   where schluessel = any(v_schluessel)
     and ((gesperrt_bis is not null and gesperrt_bis <= now()) or (gesperrt_bis is null and fenster_start <= now() - interval '15 minutes'));
  select max(ceil(extract(epoch from case when gesperrt_bis is not null then gesperrt_bis else fenster_start + interval '15 minutes' end - now())))::int
    into v_warte from anmelde_fehlversuch
   where schluessel = any(v_schluessel) and (gesperrt_bis > now() or anzahl >= 10);
  if v_warte is not null then return greatest(v_warte, 1); end if;
  update anmelde_fehlversuch set anzahl = anzahl + 1 where schluessel = any(v_schluessel);
  return 0;
end $$;

create function anmeldung_abschliessen(p_schluessel text[], p_erfolg boolean) returns void language plpgsql as $$
begin
  perform 1 from anmelde_fehlversuch where schluessel = any(p_schluessel) order by schluessel for update;
  if p_erfolg then
    update anmelde_fehlversuch set anzahl = greatest(anzahl - 1, 0) where schluessel = any(p_schluessel);
  else
    update anmelde_fehlversuch set gesperrt_bis = now() + interval '15 minutes'
     where schluessel = any(p_schluessel) and anzahl >= 10 and gesperrt_bis is null;
  end if;
end $$;
grant execute on function anmeldung_reservieren(text[]), anmeldung_abschliessen(text[], boolean) to planora_app;
