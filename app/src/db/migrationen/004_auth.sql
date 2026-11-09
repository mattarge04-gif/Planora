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
