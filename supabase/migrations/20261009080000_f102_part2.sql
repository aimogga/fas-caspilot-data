-- F-102 part 2: 8 FAS tables, org-scoped RLS, same-org parent FKs
CREATE TABLE upload_batch (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid NOT NULL REFERENCES org(id),
  file_path text, mapping jsonb NOT NULL DEFAULT '{}'::jsonb, rows_ok integer, rows_error integer,
  error_report_path text, status text NOT NULL, created_by uuid, UNIQUE (id, org_id));
CREATE TABLE provider (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid NOT NULL REFERENCES org(id),
  name text NOT NULL, npi text, provider_affiliated boolean NOT NULL DEFAULT false, UNIQUE (id, org_id));
CREATE TABLE "case" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid NOT NULL REFERENCES org(id),
  referral_source text, court_involved boolean NOT NULL DEFAULT false, court_order_date date,
  referral_date date, county_fips text REFERENCES geo_county(fips), household_size integer,
  income_band text, prior_services jsonb NOT NULL DEFAULT '[]'::jsonb, upload_batch_id uuid,
  UNIQUE (id, org_id), FOREIGN KEY (upload_batch_id, org_id) REFERENCES upload_batch (id, org_id));
CREATE TABLE application (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid NOT NULL REFERENCES org(id),
  case_id uuid NOT NULL, application_date date, decision_date date, decision text,
  award_amount numeric, family_contribution numeric, UNIQUE (id, org_id),
  FOREIGN KEY (case_id, org_id) REFERENCES "case" (id, org_id));
CREATE TABLE "authorization" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid NOT NULL REFERENCES org(id),
  application_id uuid NOT NULL, service_type text, provider_id uuid, units numeric, rate numeric,
  total_authorized numeric, UNIQUE (id, org_id),
  FOREIGN KEY (application_id, org_id) REFERENCES application (id, org_id),
  FOREIGN KEY (provider_id, org_id) REFERENCES provider (id, org_id));
CREATE TABLE delivery_episode (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid NOT NULL REFERENCES org(id),
  authorization_id uuid NOT NULL, first_session_date date, last_session_date date,
  sessions_attended integer, no_shows integer, discharge_status text, non_start_reason text,
  dollars_paid numeric, UNIQUE (id, org_id),
  FOREIGN KEY (authorization_id, org_id) REFERENCES "authorization" (id, org_id));
CREATE TABLE outcome_measure (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid NOT NULL REFERENCES org(id),
  case_id uuid NOT NULL, measure_code text NOT NULL, baseline_score numeric, baseline_date date,
  followup_score numeric, followup_date date, UNIQUE (id, org_id),
  FOREIGN KEY (case_id, org_id) REFERENCES "case" (id, org_id));
CREATE TABLE aggregate_submission (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid NOT NULL REFERENCES org(id),
  period text NOT NULL, metric_code text NOT NULL, value numeric, n integer, notes text,
  UNIQUE (id, org_id));

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'case','application','authorization','provider','delivery_episode','outcome_measure','upload_batch','aggregate_submission'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (org_id = app_org_id() AND app_role() IN (''admin'',''staff''))', t||'_sel', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (org_id = app_org_id() AND app_role() IN (''admin'',''staff''))', t||'_ins', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (org_id = app_org_id() AND app_role() IN (''admin'',''staff'')) WITH CHECK (org_id = app_org_id() AND app_role() IN (''admin'',''staff''))', t||'_upd', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (org_id = app_org_id() AND app_role() = ''admin'')', t||'_del', t);
  END LOOP;
END $$;
