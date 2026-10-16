-- F-506b: public Form 990 facts for past award recipients (ProPublica, source propublica_990). One row per recipient key (normalized name|state), refreshed after 30 days.
-- Organizations only: no officer names, no compensation, no raw filing JSON. RLS deny-by-default; admin/staff SELECT; service role writes (no client write policy).
CREATE TABLE recipient_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  award_history_id uuid REFERENCES award_history(id) ON DELETE SET NULL,
  recipient_key text NOT NULL UNIQUE, recipient text NOT NULL,
  ein text CHECK (ein ~ '^\d{9}$'), matched_name text, state text, ntee_code text, ruling_year integer, latest_tax_year integer,
  total_revenue numeric, total_expenses numeric, program_service_expenses numeric,
  contributions_share numeric CHECK (contributions_share BETWEEN 0 AND 1),
  match_method text NOT NULL CHECK (match_method IN ('exact_name_state', 'fuzzy_name_state', 'name_other_state', 'none')),
  match_confidence text NOT NULL CHECK (match_confidence IN ('high', 'medium', 'low', 'none')),
  source_url text, fetched_at timestamptz NOT NULL DEFAULT now(), ingest_run_id uuid REFERENCES ingest_run(id),
  CHECK ((match_confidence = 'none') = (ein IS NULL)));
ALTER TABLE recipient_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipient_profile FORCE ROW LEVEL SECURITY;
CREATE POLICY recipient_profile_sel ON recipient_profile FOR SELECT TO authenticated USING (app_role() IN ('admin', 'staff'));
REVOKE TRUNCATE, TRIGGER ON recipient_profile FROM anon, authenticated;
