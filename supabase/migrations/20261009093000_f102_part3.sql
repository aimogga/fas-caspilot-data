-- F-102 part 3: grants, exports, audit; view invoker guard
CREATE TABLE opportunity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('grants_gov','foundation_manual','foundation_csv')),
  external_id text, title text NOT NULL, funder text, assistance_listing text,
  posted_date date, close_date date, award_floor numeric, award_ceiling numeric,
  eligibility jsonb NOT NULL DEFAULT '{}'::jsonb, description text, raw jsonb NOT NULL DEFAULT '{}'::jsonb);
CREATE TABLE opportunity_criteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), opportunity_id uuid NOT NULL REFERENCES opportunity(id),
  criterion text NOT NULL, weight_points numeric, "text" text, extracted_by text);
CREATE TABLE award_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('usaspending','irs_990pf')),
  funder text, recipient text, recipient_state text, amount numeric, fiscal_year integer,
  assistance_listing text, description text, raw jsonb NOT NULL DEFAULT '{}'::jsonb);
CREATE TABLE match_result (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid NOT NULL REFERENCES org(id),
  opportunity_id uuid NOT NULL REFERENCES opportunity(id), score numeric,
  components jsonb NOT NULL DEFAULT '{}'::jsonb, flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  model_version text, computed_at timestamptz NOT NULL DEFAULT now(), UNIQUE (id, org_id));
CREATE TABLE strategy_draft (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid NOT NULL REFERENCES org(id),
  opportunity_id uuid NOT NULL REFERENCES opportunity(id),
  inputs_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb, output jsonb, citations jsonb,
  status text NOT NULL CHECK (status IN ('draft','approved','rejected')),
  created_by uuid, approved_by uuid, UNIQUE (id, org_id));
CREATE TABLE pipeline_status (
  opportunity_id uuid NOT NULL REFERENCES opportunity(id), org_id uuid NOT NULL REFERENCES org(id),
  status text NOT NULL, owner text, notes text, PRIMARY KEY (opportunity_id, org_id));
CREATE TABLE export_job (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid NOT NULL REFERENCES org(id),
  type text NOT NULL, params jsonb NOT NULL DEFAULT '{}'::jsonb, file_path text,
  suppression_applied boolean NOT NULL DEFAULT false, created_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, org_id));
CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid NOT NULL REFERENCES org(id),
  actor uuid NOT NULL, action text NOT NULL, entity text, entity_id uuid,
  at timestamptz NOT NULL DEFAULT now(), details jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (id, org_id));

CREATE OR REPLACE FUNCTION rls_guard_violations() RETURNS TABLE(relname name)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $$ SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND (
    (c.relkind IN ('r','p') AND (NOT c.relrowsecurity OR NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid)))
    OR (c.relkind = 'v' AND NOT COALESCE(c.reloptions, ARRAY[]::text[]) @> ARRAY['security_invoker=true'])); $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['opportunity','opportunity_criteria','award_history'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (app_role() IN (''admin'',''staff''))', t||'_sel', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['match_result','strategy_draft','pipeline_status'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (org_id = app_org_id() AND app_role() IN (''admin'',''staff''))', t||'_sel', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (org_id = app_org_id() AND app_role() IN (''admin'',''staff''))', t||'_ins', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (org_id = app_org_id() AND app_role() IN (''admin'',''staff'')) WITH CHECK (org_id = app_org_id() AND app_role() IN (''admin'',''staff''))', t||'_upd', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (org_id = app_org_id() AND app_role() = ''admin'')', t||'_del', t);
  END LOOP;
END $$;

ALTER TABLE export_job ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_job FORCE ROW LEVEL SECURITY;
CREATE POLICY export_job_sel ON export_job FOR SELECT TO authenticated
  USING (org_id = app_org_id() AND app_role() IN ('admin','staff'));
CREATE POLICY export_job_ins ON export_job FOR INSERT TO authenticated
  WITH CHECK (org_id = app_org_id() AND app_role() IN ('admin','staff') AND created_by = auth.uid());

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;
CREATE POLICY audit_log_sel ON audit_log FOR SELECT TO authenticated
  USING (org_id = app_org_id() AND app_role() = 'admin');
CREATE POLICY audit_log_ins ON audit_log FOR INSERT TO authenticated
  WITH CHECK (org_id = app_org_id() AND app_role() IN ('admin','staff') AND actor = auth.uid());
