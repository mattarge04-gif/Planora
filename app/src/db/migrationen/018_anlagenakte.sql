-- Anlagenakte schlank (Spec 2026-11-23, E46): allgemeine Ablage, Virenpruefung, Verknuepfung mit Bauteilen, Datenblatt.
-- Altbestand aus 017 (nur Testdaten, vor dem Scan abgelegt): pdf / offerte / sauber [A]. Danach sichere Startwerte.
alter table dokument
  add column art text not null default 'pdf' check (art in ('pdf','bild','office')),
  add column mime text not null default 'application/pdf' check (length(mime) between 3 and 100),
  add column kategorie text not null default 'offerte' check (kategorie in ('datenblatt','plan','offerte','foto','protokoll','sonstiges')),
  add column scan_status text not null default 'sauber' check (scan_status in ('quarantaene','sauber','abgelehnt','scan_fehler')),
  add column scan_grund text check (length(scan_grund) <= 300),
  add column gescannt_am timestamptz;
alter table dokument
  alter column kategorie set default 'sonstiges',
  alter column scan_status set default 'quarantaene',
  alter column auslesen_status set default 'aus';
-- Die 100-Seiten-Grenze gilt nur beim Lesen (preisdokument), nicht fuer die Ablage.
alter table dokument
  alter column seiten drop not null,
  drop constraint dokument_seiten_check,
  add constraint dokument_seiten_check check (seiten is null or seiten >= 1),
  add constraint dokument_groesse_max check (groesse <= 104857600),
  add constraint dokument_auslesen_nur_pdf check (art = 'pdf' or auslesen_status = 'aus');
create index dokument_scan_offen on dokument(scan_status) where scan_status <> 'sauber';
create table dokument_bauteil(
  dokument_id uuid not null references dokument(id) on delete cascade,
  bauteil_id uuid not null references bauteil(id) on delete cascade,
  primary key (dokument_id, bauteil_id)
);
create index dokument_bauteil_bauteil on dokument_bauteil(bauteil_id);
-- Datenblatt-Werte je Bauteil; Schluessel prueft die App gegen Katalog v2 (src/bestand/datenblatt.ts).
alter table bauteil_akte add column datenblatt jsonb check (datenblatt is null or jsonb_typeof(datenblatt) = 'object');
grant select, insert, delete on dokument_bauteil to planora_app;
