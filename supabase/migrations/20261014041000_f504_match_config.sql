-- F-504: versioned grant fit-score config (GRANT_MATCHING.md "Fit score v0"). Weights are fractions of 1 (D-025), shown as points.
-- New weights = new row via migration (never UPDATE); approval sets approved_by (George-gated, like need-score v1). No app writes.
CREATE TABLE IF NOT EXISTS match_config (id text PRIMARY KEY, weights jsonb NOT NULL, params jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), approved_by uuid, approved_at timestamptz);
ALTER TABLE match_config ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
CREATE POLICY match_config_sel ON match_config FOR SELECT TO authenticated USING (true);
-- doc points 30/20/15/15/10/10 stored as 0.30/0.20/0.15/0.15/0.10/0.10; created UNapproved
INSERT INTO match_config (id, weights, params, created_at) VALUES ('v0-draft',
  '{"mission_fit":0.30,"eligibility_certainty":0.20,"evidence_readiness":0.15,"award_size_fit":0.15,"geography":0.10,"effort_vs_time":0.10}',
  '{"prep_days":30,"themes_for_full_credit":3,"evidence_available":[]}', '2026-10-14') ON CONFLICT (id) DO NOTHING;
-- stored results cite their config version; one row per org × opportunity × config
ALTER TABLE match_result ADD COLUMN IF NOT EXISTS config_id text REFERENCES match_config(id);
CREATE UNIQUE INDEX IF NOT EXISTS match_result_org_opp_config ON match_result (org_id, opportunity_id, config_id);
