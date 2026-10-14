-- F-502: admin and staff may add foundation opportunities (role-scoped, org-independent; Grants.gov rows arrive via service role).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'opportunity' AND policyname = 'opportunity_ins') THEN
    CREATE POLICY opportunity_ins ON opportunity FOR INSERT TO authenticated WITH CHECK (app_role() IN ('admin','staff') AND source IN ('foundation_manual','foundation_csv'));
  END IF;
END $$;
