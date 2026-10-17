-- F-504d: v1.1-draft grant fit-score config = v1-draft's weights and params plus the two fit-band edges (score ≥ band_strong is Strong fit,
-- ≥ band_look is Worth a look, else Pass). band_look equals the digest threshold (60), so the digest and the F-509 eval are unchanged.
-- New row, never UPDATE; v1-draft stays. Created UNapproved: approved_by is set after QA PASS (D-014). Mirrored in lib/grants/config-defaults.ts (V1_1_DRAFT_*).
INSERT INTO match_config (id, weights, params, created_at) VALUES ('v1.1-draft',
  '{"mission_fit":0.35,"eligibility_certainty":0.15,"evidence_readiness":0.15,"award_size_fit":0.15,"geography":0.10,"effort_vs_time":0.10}',
  '{"prep_days":30,"themes_for_full_credit":3,"evidence_available":[],"floor_components":["mission_fit","award_size_fit","effort_vs_time"],"award_too_small_value":0,"min_days_to_close":7,"max_cost_share_pct":25,"band_strong":75,"band_look":60}',
  '2026-10-17T00:00:30Z') ON CONFLICT (id) DO NOTHING;
