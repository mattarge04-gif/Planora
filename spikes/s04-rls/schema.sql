-- S4 Wegwerf-Schema nach ADR 0010 / 0015 / 03 Kap. 4.3 (Auszug). KEIN Produktivcode.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE ROLE planora_owner NOLOGIN;
CREATE ROLE planora_app LOGIN NOBYPASSRLS PASSWORD :'app_pw';
CREATE SCHEMA app AUTHORIZATION planora_owner;
SET ROLE planora_owner;

CREATE FUNCTION app.mandant() RETURNS uuid LANGUAGE plpgsql STABLE AS $$
DECLARE v text := current_setting('app.mandant_id', true);
BEGIN
  IF v IS NULL OR v = '' THEN RAISE EXCEPTION 'kein Mandantenkontext gesetzt' USING ERRCODE = '42501'; END IF;
  RETURN v::uuid;
END $$;

CREATE TABLE app.raum (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), mandant_id uuid NOT NULL, name text NOT NULL,
  version int NOT NULL DEFAULT 1, UNIQUE (mandant_id, id));
CREATE TABLE app.element (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), mandant_id uuid NOT NULL, raum_id uuid NOT NULL, name text NOT NULL,
  version int NOT NULL DEFAULT 1, UNIQUE (mandant_id, id),
  FOREIGN KEY (mandant_id, raum_id) REFERENCES app.raum (mandant_id, id));
CREATE TABLE app.angabe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), mandant_id uuid NOT NULL, element_id uuid NOT NULL, merkmal text NOT NULL,
  wert jsonb, status text NOT NULL DEFAULT 'vorgeschlagen', version int NOT NULL DEFAULT 1, UNIQUE (mandant_id, id),
  FOREIGN KEY (mandant_id, element_id) REFERENCES app.element (mandant_id, id));

-- Audit mit Hash-Kette pro Mandant (ADR 0015)
CREATE TABLE app.audit_eintrag (
  id bigserial PRIMARY KEY, mandant_id uuid NOT NULL, tabelle text, datensatz_id uuid, aktion text, alt jsonb, neu jsonb,
  zeitpunkt timestamptz NOT NULL DEFAULT clock_timestamp(), vorgaenger_hash text, hash text NOT NULL);
CREATE FUNCTION app.audit_trigger() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = app, public AS $$
DECLARE m uuid; vh text; e jsonb; h text;
BEGIN
  m := COALESCE(NEW.mandant_id, OLD.mandant_id);
  PERFORM pg_advisory_xact_lock(hashtextextended(m::text, 0));
  SELECT a.hash INTO vh FROM app.audit_eintrag a WHERE a.mandant_id = m ORDER BY a.id DESC LIMIT 1;
  e := jsonb_build_object('t', TG_TABLE_NAME, 'id', COALESCE(NEW.id, OLD.id), 'a', TG_OP, 'alt', to_jsonb(OLD), 'neu', to_jsonb(NEW));
  h := encode(digest(COALESCE(vh, '') || e::text, 'sha256'), 'hex');
  INSERT INTO app.audit_eintrag (mandant_id, tabelle, datensatz_id, aktion, alt, neu, vorgaenger_hash, hash)
    VALUES (m, TG_TABLE_NAME, COALESCE(NEW.id, OLD.id), TG_OP, to_jsonb(OLD), to_jsonb(NEW), vh, h);
  RETURN NULL;
END $$;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['raum','element','angabe','audit_eintrag'] LOOP
    EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE app.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY mandant_isolation ON app.%I USING (mandant_id = app.mandant()) WITH CHECK (mandant_id = app.mandant())', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['raum','element','angabe'] LOOP
    EXECUTE format('CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON app.%I FOR EACH ROW EXECUTE FUNCTION app.audit_trigger()', t);
  END LOOP;
END $$;

GRANT USAGE ON SCHEMA app TO planora_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON app.raum, app.element, app.angabe TO planora_app;
GRANT SELECT ON app.audit_eintrag TO planora_app;
GRANT EXECUTE ON FUNCTION app.mandant() TO planora_app;
RESET ROLE;
