create table modul_schalter(modul_id text primary key, aktiv boolean not null, geaendert_am timestamptz not null default now(), geaendert_von uuid, manifest_version text);
grant select on modul_schalter to planora_app;

-- Schreibpfad der Laufzeitrolle nur ueber diese Funktionen (kein direktes DML).
-- Betreiber-, Liefer- und Abhaengigkeitspruefung bleiben in der App; die Funktionen
-- laufen in deren Transaktion, damit Kaskade und Audit atomar bleiben.
create function modul_schalter_sperren() returns void
  language sql security definer set search_path = public, pg_temp as
  $$ lock table modul_schalter in share row exclusive mode $$;
create function modul_ein(p_id text, p_von uuid, p_manifest text) returns void
  language sql security definer set search_path = public, pg_temp as
  $$ insert into modul_schalter(modul_id, aktiv, geaendert_von, manifest_version) values (p_id, true, p_von, p_manifest)
     on conflict (modul_id) do update set aktiv = true, geaendert_am = now(), geaendert_von = p_von, manifest_version = p_manifest $$;
create function modul_aus(p_id text, p_von uuid) returns void
  language sql security definer set search_path = public, pg_temp as
  $$ update modul_schalter set aktiv = false, geaendert_am = now(), geaendert_von = p_von where modul_id = p_id $$;
revoke all on function modul_schalter_sperren(), modul_ein(text, uuid, text), modul_aus(text, uuid) from public;
grant execute on function modul_schalter_sperren(), modul_ein(text, uuid, text), modul_aus(text, uuid) to planora_app;
