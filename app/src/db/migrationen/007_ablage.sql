create table datei(schluessel text primary key, sha256 text not null, groesse bigint not null, erstellt_am timestamptz not null default now());
create table datei_referenz(schluessel text references datei(schluessel), objekt text not null, primary key (schluessel, objekt));
create table journal_zaehler(id int primary key default 1 check (id=1), seq bigint not null);
insert into journal_zaehler values (1, 0);
create table loesch_journal(seq bigint primary key, art text not null, ziel text not null, zeit timestamptz not null default now(), zustand text not null default 'offen' check (zustand in ('offen','quittiert')));
create table backup_lauf(id uuid primary key, zustand text not null check (zustand in ('laufend','gesichert','geprueft','fehlgeschlagen')), start timestamptz not null default now(), heartbeat timestamptz);
create function journal_eintrag(p_art text, p_ziel text) returns bigint language sql security definer set search_path = public, pg_temp as
  $$ with z as (update journal_zaehler set seq = seq + 1 where id = 1 returning seq)
     insert into loesch_journal(seq, art, ziel) select seq, p_art, p_ziel from z returning seq $$;
grant select, insert on datei, datei_referenz to planora_app;
grant delete on datei_referenz to planora_app;
revoke all on function journal_eintrag(text, text) from public;
grant execute on function journal_eintrag(text, text) to planora_app;
grant select on loesch_journal to planora_app;

-- Auch kuenftige Schreiber muessen Backup-Start und Referenzen gegen GC serialisieren.
create function ablage_gc_schuetzen() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock_shared(7310002);
  return new;
end $$;
create trigger backup_gc_schutz before insert or update on backup_lauf
  for each row when (new.zustand = 'laufend') execute function ablage_gc_schuetzen();
create trigger referenz_gc_schutz before insert or update on datei_referenz
  for each row execute function ablage_gc_schuetzen();
