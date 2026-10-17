-- F-210c: need score params. `z_cap` clamps every input's z-score to [-z_cap, +z_cap] before weighting, so one extreme
-- small county cannot pull every other county's score; `cv_flag_pct` marks a component "Low reliability" when its
-- coefficient of variation, (MOE / 1.645) / value × 100, is above it. Existing rows keep the empty-object default, so their maths is unchanged.
-- RLS on need_score_config is unchanged: no new table, no new grants.
ALTER TABLE need_score_config ADD COLUMN params jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Created with approved_by NULL: approval stays a separate step (D-014). Same weights as v1-poverty-uninsured.
INSERT INTO need_score_config (version, weights, params, created_at)
VALUES (
  'v1.1-poverty-uninsured-capped',
  '{"poverty_rate": 0.5, "uninsured_rate": 0.5}',
  '{"z_cap": 3, "cv_flag_pct": 30}',
  '2026-10-17'
)
ON CONFLICT (version) DO NOTHING;
