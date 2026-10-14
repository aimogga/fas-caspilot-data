// F-509: the `v0-draft` seed row from `20261014041000_f504_match_config.sql`, as code, so the eval runs without a database.
// `lib/grants/eval.test.ts` asserts these weights equal the migration's JSON; change both together (and regenerate the golden).
import type { MatchConfig } from './score';

export const V0_DRAFT_WEIGHTS: Record<string, number> = { mission_fit: 0.3, eligibility_certainty: 0.2, evidence_readiness: 0.15, award_size_fit: 0.15, geography: 0.1, effort_vs_time: 0.1 };

export const V0_DRAFT_CONFIG: MatchConfig = { id: 'v0-draft', weights: V0_DRAFT_WEIGHTS, params: { prep_days: 30, themes_for_full_credit: 3, evidence_available: [] }, created_at: '2026-10-14', approved_by: null };
