-- F-102 part 1: helpers, 7 tables, deny-by-default RLS
CREATE OR REPLACE FUNCTION app_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT coalesce(auth.jwt() -> 'app_metadata' ->> 'role', ''); $$;

CREATE OR REPLACE FUNCTION app_org_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT nullif(auth.jwt() -> 'app_metadata' ->> 'org_id', '')::uuid; $$;

GRANT EXECUTE ON FUNCTION app_role() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_org_id() TO anon, authenticated;

CREATE TABLE geo_county (
  fips text PRIMARY KEY, name text NOT NULL, state text NOT NULL, population_latest integer);
CREATE TABLE source_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, owner text, url text,
  license text, commercial_ok boolean NOT NULL DEFAULT false, cadence text,
  status text NOT NULL CHECK (status IN ('active', 'paused')), last_success_at timestamptz);
CREATE TABLE ingest_run (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_id uuid NOT NULL REFERENCES source_registry(id),
  started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz, status text NOT NULL,
  rows_loaded integer, checksum text, error text);
CREATE TABLE public_indicator (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_id uuid NOT NULL REFERENCES source_registry(id),
  indicator_code text NOT NULL, geo_fips text NOT NULL REFERENCES geo_county(fips), period text NOT NULL,
  value numeric, moe numeric, unit text, vintage text NOT NULL, ingest_run_id uuid REFERENCES ingest_run(id),
  UNIQUE (source_id, indicator_code, geo_fips, period, vintage));
CREATE TABLE need_score_config (
  version text PRIMARY KEY, weights jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), approved_by uuid);
CREATE TABLE need_score (
  version text NOT NULL REFERENCES need_score_config(version), geo_fips text NOT NULL REFERENCES geo_county(fips),
  score numeric NOT NULL, components jsonb NOT NULL, PRIMARY KEY (version, geo_fips));
CREATE TABLE org (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, ein text, uei text, state text,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb);

CREATE FUNCTION rls_guard_violations() RETURNS TABLE(relname name)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $$ SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
    AND (NOT c.relrowsecurity OR NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid)); $$;
GRANT EXECUTE ON FUNCTION rls_guard_violations() TO anon, authenticated;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'geo_county','source_registry','ingest_run','public_indicator','need_score_config','need_score'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (app_role() IN (''admin'',''staff'',''board_viewer''))', t||'_sel', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL TO authenticated USING (app_role()=''admin'') WITH CHECK (app_role()=''admin'')', t||'_mut', t);
  END LOOP;
END $$;

ALTER TABLE org ENABLE ROW LEVEL SECURITY;
ALTER TABLE org FORCE ROW LEVEL SECURITY;
CREATE POLICY org_sel ON org FOR SELECT TO authenticated
  USING (app_role() = 'admin' OR id = app_org_id());
CREATE POLICY org_mut ON org FOR ALL TO authenticated
  USING (app_role() = 'admin') WITH CHECK (app_role() = 'admin');
