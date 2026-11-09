create table audit_person(audit_id uuid primary key, benutzer_id text unique);
create table audit_eintrag(id bigserial primary key, zeit timestamptz not null default now(), audit_id uuid, art text not null, daten jsonb not null default '{}');
revoke all on audit_eintrag from public;
grant select on audit_eintrag to planora_app;
create function audit_schreiben(p_audit_id uuid, p_art text, p_daten jsonb) returns bigint
  language sql security definer set search_path = public as
  $$ insert into audit_eintrag(audit_id, art, daten) values (p_audit_id, p_art, coalesce(p_daten,'{}')) returning id $$;
revoke all on function audit_schreiben(uuid, text, jsonb) from public;
grant execute on function audit_schreiben(uuid, text, jsonb) to planora_app;
grant select, insert, delete on audit_person to planora_app;
