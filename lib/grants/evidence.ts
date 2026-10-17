// F-504e: which kinds of evidence FAS has loaded, read from its own records, so the fit score's evidence-readiness part reflects the data in the app
// instead of a hand-set list. A kind counts only when the last 12 months hold at least 11 usable records, the same line under which shared views
// hide a count (F-306): FAS can only cite evidence it is allowed to show.
import type { SupabaseClient } from '@supabase/supabase-js';
import { THRESHOLD } from '../metrics/suppress';

/** kind → [table or metric view, the column that makes a record usable, its date column]. Kinds match the scorer's EVIDENCE keys in score.ts. */
export const EVIDENCE_SOURCES: Record<'outcomes' | 'cost' | 'timeliness', [string, string, string]> = {
  outcomes: ['outcome_measure', 'followup_score', 'followup_date'],
  cost: ['m4_m5_m6_episodes', 'dollars_paid', 'anchor_date'],
  timeliness: ['m1_court_to_first_session', 'first_session_date', 'court_order_date'],
};
const YEAR_MS = 365 * 86_400_000;

/** Kinds with ≥ 11 usable records for the org in the 12 months before `now`. A failed count leaves that kind out (never claims evidence it cannot see). */
export async function loadedEvidence(client: SupabaseClient, orgId: string, now: Date): Promise<string[]> {
  const since = new Date(now.getTime() - YEAR_MS).toISOString().slice(0, 10);
  const counts = await Promise.all(Object.entries(EVIDENCE_SOURCES).map(async ([kind, [table, col, dateCol]]) => {
    const { count, error } = await client.from(table).select(col, { count: 'exact', head: true }).eq('org_id', orgId).not(col, 'is', null).gte(dateCol, since);
    if (error) console.error('[grants] evidence count failed', { table, message: error.message });
    return [kind, error ? 0 : count ?? 0] as const;
  }));
  return counts.filter(([, n]) => n >= THRESHOLD).map(([kind]) => kind);
}
