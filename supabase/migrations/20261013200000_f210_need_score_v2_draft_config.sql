-- F-210: need score v2 draft config (D-026: SAIPE poverty 30, SAIPE child poverty 20, SAHIE uninsured 30,
-- ACS single-parent households 10, ACS no-vehicle households 10; D-025: stored as fractions of 1, shown as points of 100).
-- Created with approved_by NULL: the map and the methodology page ignore unapproved rows until approval sets approved_by.
-- Changing weights means a new row with a new version; this row is never edited. No new table, RLS unchanged.
INSERT INTO need_score_config (version, weights, created_at)
VALUES (
  'v2-draft-five-input',
  '{"poverty_rate": 0.3, "child_poverty_rate": 0.2, "uninsured_rate": 0.3, "single_parent_pct": 0.1, "no_vehicle_pct": 0.1}',
  '2026-10-13'
)
ON CONFLICT (version) DO NOTHING;
