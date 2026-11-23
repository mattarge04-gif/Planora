-- Preis aus Dokument (Spec 2026-11-22, E44/E45, ADR 0033).
create table dokument(
  id uuid primary key default gen_random_uuid(),
  liegenschaft_id uuid not null,
  gebaeude_id uuid not null,
  dateiname text not null check (length(dateiname) between 1 and 255),
  schluessel text not null, -- Datei-Schutz ueber datei_referenz (GC), kein FK: bestehende Tests leeren datei per truncate
  sha256 text not null,
  groesse bigint not null check (groesse > 0),
  seiten int not null check (seiten between 1 and 100),
  hochgeladen_von uuid not null,
  hochgeladen_am timestamptz not null default now(),
  auslesen_status text not null default 'neu' check (auslesen_status in ('neu','liest','fertig','fehler','abgebrochen','aus')),
  auslesen_fehler text check (length(auslesen_fehler) <= 500),
  modell text,
  tokens_ein int, tokens_aus int,
  kosten_usd numeric(10,4),
  gelesen_am timestamptz,
  unique (gebaeude_id, sha256),
  foreign key (gebaeude_id, liegenschaft_id) references gebaeude(id, liegenschaft_id) on delete cascade
);
create table preis_vorschlag(
  id uuid primary key default gen_random_uuid(),
  dokument_id uuid not null references dokument(id) on delete cascade,
  reihenfolge int not null,
  position text not null check (length(position) <= 500),
  seite int not null check (seite >= 1),
  zitat text not null check (length(zitat) <= 1000),
  material_netto numeric(12,2),
  rabatt_text text check (length(rabatt_text) <= 200),
  montage_anteil numeric(12,2),
  ersatzpreis numeric(12,2) not null check (ersatzpreis >= 0),
  rechenweg text not null check (length(rechenweg) <= 300),
  katalog_id text check (length(katalog_id) <= 100),
  bauteil_ids uuid[] not null default '{}',
  sicherheit text not null check (sicherheit in ('hoch','mittel','tief')),
  status text not null default 'offen' check (status in ('offen','uebernommen','verworfen')),
  als_typpreis boolean not null default false,
  entschieden_von uuid, entschieden_am timestamptz
);
create index preis_vorschlag_dokument on preis_vorschlag(dokument_id, reihenfolge);
alter table bauteil_akte add column preis_vorschlag_id uuid references preis_vorschlag(id) on delete set null;
alter table lebensdauer_typ add column preis_vorschlag_id uuid references preis_vorschlag(id) on delete set null;
alter table bauteil_akte add constraint bauteil_akte_vorschlag_quelle check (preis_vorschlag_id is null or quelle_preis = 'dokument');
alter table lebensdauer_typ add constraint lebensdauer_typ_vorschlag_quelle check (preis_vorschlag_id is null or quelle_preis = 'dokument');
-- ADR 0030/0033: nach Restore bleibt KI aus, bis die Konfiguration geprueft ist.
create function preisdokument_restore_sperre() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.schluessel = 'restore_gesperrt' and new.wert::text in ('true', '"true"') then
    update modul_schalter set aktiv = false where modul_id = 'preisdokument';
  end if;
  return new;
end $$;
create trigger preisdokument_restore_sperre after insert or update on instanz_einstellung
  for each row execute function preisdokument_restore_sperre();
grant select, insert, update, delete on dokument, preis_vorschlag to planora_app;
-- Kostenbuch: jede Lesung zaehlt zum Monatsbudget, auch nach Neu lesen oder Loeschen des Dokuments.
create table preis_lesung(id uuid primary key default gen_random_uuid(), dokument_id uuid references dokument(id) on delete set null,
  modell text, tokens_ein int not null, tokens_aus int not null, kosten_usd numeric(10,4) not null, am timestamptz not null default now());
create index preis_lesung_am on preis_lesung(am);
grant select, insert on preis_lesung to planora_app;
