-- Lebensdauer/Ampel (Spec 2026-11-19, E43). Standard-Lebensdauer liegt im Code (src/lebensdauer/standard.ts);
-- hier stehen nur Kundenwerte. Keine Standardpreise (PO 19.11.).
create table gebaeude_erneuerung(
  gebaeude_id uuid primary key,
  liegenschaft_id uuid not null,
  heizung_baujahr int check (heizung_baujahr between 1800 and 2100),
  foreign key (gebaeude_id, liegenschaft_id) references gebaeude(id, liegenschaft_id) on delete cascade
);
create table bauteil_akte(
  bauteil_id uuid primary key,
  liegenschaft_id uuid not null,
  zustand text check (zustand in ('gut','mittel','schlecht','kritisch')),
  lebensdauer_jahre int check (lebensdauer_jahre between 1 and 150),
  stueckpreis numeric(12,2) check (stueckpreis >= 0),
  quelle_preis text check (quelle_preis in ('kunde','dokument')),
  notiz text check (length(notiz) <= 2000),
  check ((stueckpreis is null) = (quelle_preis is null)),
  foreign key (bauteil_id, liegenschaft_id) references bauteil(id, liegenschaft_id) on delete cascade
);
create table lebensdauer_typ(
  liegenschaft_id uuid not null references liegenschaft(id) on delete cascade,
  katalog_id text not null check (length(katalog_id) <= 100),
  l_mittel int check (l_mittel between 1 and 150),
  stueckpreis numeric(12,2) check (stueckpreis >= 0),
  quelle_preis text check (quelle_preis in ('kunde','dokument')),
  gelb_jahre int check (gelb_jahre between 0 and 20),
  check ((stueckpreis is null) = (quelle_preis is null)),
  primary key (liegenschaft_id, katalog_id)
);
grant select, insert, update, delete on gebaeude_erneuerung, bauteil_akte, lebensdauer_typ to planora_app;
