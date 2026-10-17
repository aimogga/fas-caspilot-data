-- F-602b: clear the Supabase performance advisors (forward-only; rules and data unchanged).
-- 0003 auth_rls_initplan: these insert checks called auth.uid() once per row; (select auth.uid()) is evaluated once per statement.
ALTER POLICY aggregate_submission_ins ON public.aggregate_submission WITH CHECK (org_id = app_org_id() AND app_role() IN ('admin', 'staff')
  AND (created_by IS NULL OR created_by = (select auth.uid())));
ALTER POLICY application_draft_ins ON public.application_draft WITH CHECK (org_id = app_org_id() AND app_role() IN ('admin', 'staff')
  AND created_by = (select auth.uid()) AND status = 'DRAFT' AND approved_by IS NULL AND approved_at IS NULL
  AND EXISTS (SELECT 1 FROM strategy_draft s WHERE s.id = application_draft.strategy_draft_id AND s.org_id = application_draft.org_id
    AND s.opportunity_id = application_draft.opportunity_id AND s.status = 'approved'));
ALTER POLICY application_draft_edit_ins ON public.application_draft_edit WITH CHECK (org_id = app_org_id() AND app_role() IN ('admin', 'staff')
  AND editor = (select auth.uid())
  AND EXISTS (SELECT 1 FROM application_draft d WHERE d.id = application_draft_edit.application_draft_id AND d.org_id = application_draft_edit.org_id AND d.status = 'DRAFT'));
ALTER POLICY audit_log_ins ON public.audit_log WITH CHECK (org_id = app_org_id() AND app_role() IN ('admin', 'staff') AND actor = (select auth.uid()));
ALTER POLICY export_job_ins ON public.export_job WITH CHECK (org_id = app_org_id() AND app_role() IN ('admin', 'staff') AND created_by = (select auth.uid()));
ALTER POLICY strategy_draft_ins ON public.strategy_draft WITH CHECK (org_id = app_org_id() AND app_role() IN ('admin', 'staff')
  AND created_by = (select auth.uid()) AND status IN ('DRAFT', 'failed') AND approved_by IS NULL AND approved_at IS NULL);

-- 0001 unindexed_foreign_keys: one covering index per foreign key, in the key's column order (generated from pg_constraint).
CREATE INDEX IF NOT EXISTS aggregate_submission_county_fips_idx ON public.aggregate_submission (county_fips);
CREATE INDEX IF NOT EXISTS aggregate_submission_org_id_idx ON public.aggregate_submission (org_id);
CREATE INDEX IF NOT EXISTS application_case_id_org_id_idx ON public.application (case_id, org_id);
CREATE INDEX IF NOT EXISTS application_draft_edit_application_draft_id_org_id_idx ON public.application_draft_edit (application_draft_id, org_id);
CREATE INDEX IF NOT EXISTS application_draft_opportunity_id_idx ON public.application_draft (opportunity_id);
CREATE INDEX IF NOT EXISTS application_draft_org_id_idx ON public.application_draft (org_id);
CREATE INDEX IF NOT EXISTS application_draft_strategy_draft_id_idx ON public.application_draft (strategy_draft_id);
CREATE INDEX IF NOT EXISTS application_org_id_idx ON public.application (org_id);
CREATE INDEX IF NOT EXISTS application_upload_batch_id_org_id_idx ON public.application (upload_batch_id, org_id);
CREATE INDEX IF NOT EXISTS audit_log_org_id_idx ON public.audit_log (org_id);
CREATE INDEX IF NOT EXISTS authorization_application_id_org_id_idx ON public."authorization" (application_id, org_id);
CREATE INDEX IF NOT EXISTS authorization_org_id_idx ON public."authorization" (org_id);
CREATE INDEX IF NOT EXISTS authorization_provider_id_org_id_idx ON public."authorization" (provider_id, org_id);
CREATE INDEX IF NOT EXISTS authorization_upload_batch_id_org_id_idx ON public."authorization" (upload_batch_id, org_id);
CREATE INDEX IF NOT EXISTS award_abstract_ingest_run_id_idx ON public.award_abstract (ingest_run_id);
CREATE INDEX IF NOT EXISTS award_history_ingest_run_id_idx ON public.award_history (ingest_run_id);
CREATE INDEX IF NOT EXISTS case_county_fips_idx ON public."case" (county_fips);
CREATE INDEX IF NOT EXISTS case_org_id_idx ON public."case" (org_id);
CREATE INDEX IF NOT EXISTS case_upload_batch_id_org_id_idx ON public."case" (upload_batch_id, org_id);
CREATE INDEX IF NOT EXISTS delivery_episode_authorization_id_org_id_idx ON public.delivery_episode (authorization_id, org_id);
CREATE INDEX IF NOT EXISTS delivery_episode_org_id_idx ON public.delivery_episode (org_id);
CREATE INDEX IF NOT EXISTS delivery_episode_upload_batch_id_org_id_idx ON public.delivery_episode (upload_batch_id, org_id);
CREATE INDEX IF NOT EXISTS export_job_org_id_idx ON public.export_job (org_id);
CREATE INDEX IF NOT EXISTS ingest_run_source_id_idx ON public.ingest_run (source_id);
CREATE INDEX IF NOT EXISTS match_result_config_id_idx ON public.match_result (config_id);
CREATE INDEX IF NOT EXISTS match_result_opportunity_id_idx ON public.match_result (opportunity_id);
CREATE INDEX IF NOT EXISTS need_score_geo_fips_idx ON public.need_score (geo_fips);
CREATE INDEX IF NOT EXISTS opportunity_criteria_opportunity_id_idx ON public.opportunity_criteria (opportunity_id);
CREATE INDEX IF NOT EXISTS opportunity_ingest_run_id_idx ON public.opportunity (ingest_run_id);
CREATE INDEX IF NOT EXISTS org_knowledge_version_knowledge_id_org_id_idx ON public.org_knowledge_version (knowledge_id, org_id);
CREATE INDEX IF NOT EXISTS outcome_measure_case_id_org_id_idx ON public.outcome_measure (case_id, org_id);
CREATE INDEX IF NOT EXISTS outcome_measure_org_id_idx ON public.outcome_measure (org_id);
CREATE INDEX IF NOT EXISTS outcome_measure_upload_batch_id_org_id_idx ON public.outcome_measure (upload_batch_id, org_id);
CREATE INDEX IF NOT EXISTS pipeline_status_org_id_idx ON public.pipeline_status (org_id);
CREATE INDEX IF NOT EXISTS provider_org_id_idx ON public.provider (org_id);
CREATE INDEX IF NOT EXISTS public_indicator_geo_fips_idx ON public.public_indicator (geo_fips);
CREATE INDEX IF NOT EXISTS public_indicator_ingest_run_id_idx ON public.public_indicator (ingest_run_id);
CREATE INDEX IF NOT EXISTS recipient_profile_award_history_id_idx ON public.recipient_profile (award_history_id);
CREATE INDEX IF NOT EXISTS recipient_profile_ingest_run_id_idx ON public.recipient_profile (ingest_run_id);
CREATE INDEX IF NOT EXISTS strategy_draft_opportunity_id_idx ON public.strategy_draft (opportunity_id);
CREATE INDEX IF NOT EXISTS strategy_draft_org_id_idx ON public.strategy_draft (org_id);
CREATE INDEX IF NOT EXISTS upload_batch_org_id_idx ON public.upload_batch (org_id);
