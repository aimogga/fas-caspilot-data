-- F-303: aggregate-only submissions. Forward-only additions to aggregate_submission (F-102 part 2): optional county
-- (all counties when null), creator, server-stamped created_at, value >= 0. INSERT stays org-scoped; created_by not spoofable.
ALTER TABLE aggregate_submission
  ADD COLUMN IF NOT EXISTS county_fips text REFERENCES geo_county(fips),
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'aggregate_submission_value_nonneg') THEN
    ALTER TABLE aggregate_submission ADD CONSTRAINT aggregate_submission_value_nonneg CHECK (value >= 0); END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'aggregate_submission' AND policyname = 'aggregate_submission_ins') THEN
    DROP POLICY aggregate_submission_ins ON aggregate_submission; END IF;
END $$;
DROP TRIGGER IF EXISTS aggregate_submission_stamp ON aggregate_submission;
CREATE TRIGGER aggregate_submission_stamp BEFORE INSERT ON aggregate_submission FOR EACH ROW EXECUTE FUNCTION stamp_now();
CREATE POLICY aggregate_submission_ins ON aggregate_submission FOR INSERT TO authenticated
  WITH CHECK (org_id = app_org_id() AND app_role() IN ('admin','staff') AND (created_by IS NULL OR created_by = auth.uid()));
