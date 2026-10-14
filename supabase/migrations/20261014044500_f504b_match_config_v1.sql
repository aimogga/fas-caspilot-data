-- F-504b: v1-draft grant fit-score config (F-509 eval: v0-draft measured 60.9% precision; v1-draft clears the 70% bar). Weights are fractions of 1 (D-025).
-- New row, never UPDATE; v0-draft stays. Created UNapproved: George sets approved_by. Mirrored in lib/grants/config-defaults.ts (V1_DRAFT_*; eval test asserts parity).
-- params: floor_components cap the score at 0 when one of them genuinely scores 0 (off mission, award too small / floor too high / match above
-- max_cost_share_pct, fewer than min_days_to_close days left); "could not score" never caps.
INSERT INTO match_config (id, weights, params, created_at) VALUES ('v1-draft',
  '{"mission_fit":0.35,"eligibility_certainty":0.15,"evidence_readiness":0.15,"award_size_fit":0.15,"geography":0.10,"effort_vs_time":0.10}',
  '{"prep_days":30,"themes_for_full_credit":3,"evidence_available":[],"floor_components":["mission_fit","award_size_fit","effort_vs_time"],"award_too_small_value":0,"min_days_to_close":7,"max_cost_share_pct":25}',
  '2026-10-14T04:45:00Z') ON CONFLICT (id) DO NOTHING;
