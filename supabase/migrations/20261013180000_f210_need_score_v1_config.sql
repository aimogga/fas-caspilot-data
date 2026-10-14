-- F-210: need score v1 config (D-026: SAIPE poverty 50 + SAHIE uninsured 50; weights are fractions of 1).
-- Created UNapproved: approval is a separate step (set approved_by), so the map keeps its current version until then.
-- Changing weights means a new row with a new version; this row is never edited. No new table, RLS unchanged.
INSERT INTO need_score_config (version, weights, created_at)
VALUES ('v1-poverty-uninsured', '{"poverty_rate": 0.5, "uninsured_rate": 0.5}', '2026-10-13')
ON CONFLICT (version) DO NOTHING;
