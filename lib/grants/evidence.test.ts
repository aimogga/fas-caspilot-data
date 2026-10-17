import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { V1_DRAFT_CONFIG } from './config-defaults';
import { checkEligibility } from './eligibility';
import { EVIDENCE_SOURCES, loadedEvidence } from './evidence';
import { MatchQuery } from './match-query';
import { FAS_PROFILE_SYNTHETIC as org } from './profile';
import { scoreOpportunity } from './score';
import { sourceWords } from './terms';
import type { OpportunityInput } from './types';

const NOW = new Date('2026-10-14T12:00:00Z');
const base = (JSON.parse(readFileSync('tests/fixtures/grants/opportunities.json', 'utf8')) as { opportunities: OpportunityInput[] }).opportunities.find((o) => o.id === 'eligible')!;
const asks = { ...base, description: `${base.description} Applicants must report client outcomes and cost per family served.` };

/** A chainable fake: every builder call is recorded per table; awaiting it resolves to `result(table)`; `maybeSingle` and `upsert` resolve too. */
function fake(result: (table: string) => { data?: unknown; count?: number; error?: { message: string } | null }) {
  const calls: Record<string, unknown[][]> = {}, upserts: unknown[] = [];
  const from = (table: string) => {
    const q: Record<string, unknown> = {}, log = (calls[table] ??= []);
    for (const m of ['select', 'eq', 'not', 'gte', 'or', 'order', 'limit', 'in']) q[m] = (...a: unknown[]) => { log.push([m, ...a]); return q; };
    q.maybeSingle = async () => ({ error: null, ...result(table) });
    q.upsert = async (rows: unknown) => { upserts.push(rows); return { error: null }; };
    q.then = (ok: (r: unknown) => unknown) => Promise.resolve({ error: null, ...result(table) }).then(ok);
    return q;
  };
  return { client: { from } as never, calls, upserts };
}

describe('F-504e evidence readiness from FAS records', () => {
  it('counts usable records per kind for one org over the last 12 months and keeps kinds with at least 11; a failed count is left out', async () => {
    const counts: Record<string, number> = { outcome_measure: 14, m4_m5_m6_episodes: 10, m1_court_to_first_session: 0 };
    const { client, calls } = fake((t) => (t === 'm1_court_to_first_session' ? { error: { message: 'view missing' } } : { count: counts[t] }));
    expect(await loadedEvidence(client, 'org-1', NOW)).toEqual(['outcomes']);
    expect(calls.outcome_measure).toEqual([['select', 'followup_score', { count: 'exact', head: true }], ['eq', 'org_id', 'org-1'], ['not', 'followup_score', 'is', null], ['gte', 'followup_date', '2025-10-14']]);
    expect(Object.keys(EVIDENCE_SOURCES)).toEqual(['outcomes', 'cost', 'timeliness']);
  });
  it('the scorer credits loaded kinds, cites them as FAS records, and is unchanged without them', () => {
    const run = (params: object) => scoreOpportunity(asks, org, checkEligibility(asks, org, NOW), { ...V1_DRAFT_CONFIG, params: { ...V1_DRAFT_CONFIG.params, ...params } }, NOW).components.find((c) => c.key === 'evidence_readiness')!;
    const none = run({}), one = run({ evidence_loaded: ['outcomes', 'timeliness'] });
    expect([none.value, none.reason]).toEqual([0, 'Asks for outcomes, cost evidence; FAS has none of it loaded (0 of 2)']);
    expect([one.value, one.reason, one.source_refs]).toEqual([0.5, 'Asks for outcomes, cost evidence; FAS has outcomes loaded (1 of 2)', ['opportunity.description', 'match_config.params.evidence_available', 'fas_records.outcomes']]);
    expect(sourceWords('fas_records.outcomes')).toEqual({ label: 'FAS records · outcomes', plain: 'From the FAS records loaded in the app (at least 11 in the last 12 months): the outcomes field.' });
  });
  it('recompute reads the org’s loaded evidence and stores the credited evidence part in match_result', async () => {
    const approved = { ...V1_DRAFT_CONFIG, approved_by: 'u' };
    const { client, upserts } = fake((t) => ({
      match_config: { data: [approved] }, org: { data: { name: 'Synthetic FAS', ein: null, uei: null, state: 'UT', settings: { program_themes: ['therapy'], annual_budget_usd: 600000 } } },
      opportunity: { data: [{ ...asks, id: 'opp-1' }] }, outcome_measure: { count: 20 }, m4_m5_m6_episodes: { count: 30 }, m1_court_to_first_session: { count: 3 },
    }[t] ?? {}));
    expect(await MatchQuery.recompute(client, 'org-1', NOW)).toEqual({ scored: 1, configId: 'v1-draft' });
    const part = (upserts[0] as { components: { key: string; value: number; reason: string }[] }[])[0]!.components.find((c) => c.key === 'evidence_readiness');
    expect([part?.value, part?.reason]).toEqual([1, 'Asks for outcomes, cost evidence; FAS has outcomes, cost loaded (2 of 2)']);
  });
});
