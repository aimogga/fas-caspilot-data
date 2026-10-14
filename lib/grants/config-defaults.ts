// F-509/F-504b: the `v0-draft` (20261014041000_f504_match_config.sql) and `v1-draft` (20261014044500_f504b_match_config_v1.sql) seed rows as code,
// so the eval runs without a database. `lib/grants/eval.test.ts` asserts each equals its migration's JSON; change both together (and regenerate the golden).
import type { MatchConfig } from './score';

export const V0_DRAFT_WEIGHTS: Record<string, number> = { mission_fit: 0.3, eligibility_certainty: 0.2, evidence_readiness: 0.15, award_size_fit: 0.15, geography: 0.1, effort_vs_time: 0.1 };

export const V0_DRAFT_CONFIG: MatchConfig = { id: 'v0-draft', weights: V0_DRAFT_WEIGHTS, params: { prep_days: 30, themes_for_full_credit: 3, evidence_available: [] }, created_at: '2026-10-14', approved_by: null };

// F-504b: mission fit up (off-mission was the main false positive), eligibility certainty down (0.9–1.0 for every eligible row, so it barely discriminates).
export const V1_DRAFT_WEIGHTS: Record<string, number> = { mission_fit: 0.35, eligibility_certainty: 0.15, evidence_readiness: 0.15, award_size_fit: 0.15, geography: 0.1, effort_vs_time: 0.1 };

export const V1_DRAFT_PARAMS = { prep_days: 30, themes_for_full_credit: 3, evidence_available: [] as string[], floor_components: ['mission_fit', 'award_size_fit', 'effort_vs_time'], award_too_small_value: 0, min_days_to_close: 7, max_cost_share_pct: 25 };

export const V1_DRAFT_CONFIG: MatchConfig = { id: 'v1-draft', weights: V1_DRAFT_WEIGHTS, params: V1_DRAFT_PARAMS, created_at: '2026-10-14T04:45:00Z', approved_by: null };
