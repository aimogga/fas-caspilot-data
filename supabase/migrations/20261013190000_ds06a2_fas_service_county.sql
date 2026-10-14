-- DS-06a2: FAS service-county list for the need map (config/seed; synthetic until FAS provides the real list).
-- Deny-by-default RLS; read-only for app roles, same DO-block pattern as F-102 part 1.
CREATE TABLE fas_service_county (
  fips text PRIMARY KEY REFERENCES geo_county(fips), added_at timestamptz NOT NULL DEFAULT now());
REVOKE TRUNCATE, TRIGGER ON fas_service_county FROM anon, authenticated;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['fas_service_county'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (app_role() IN (''admin'',''staff'',''board_viewer''))', t||'_sel', t);
  END LOOP;
END $$;
