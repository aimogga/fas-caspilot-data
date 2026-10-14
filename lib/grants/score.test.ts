import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkEligibility } from './eligibility';
import { MatchQuery } from './match-query';
import { FAS_PROFILE_SYNTHETIC as org } from './profile';
import { type MatchConfig, scoreOpportunity, toMatchResultRow, validateWeights } from './score';
import type { OpportunityInput } from './types';

const fixture = JSON.parse(readFileSync('tests/fixtures/grants/opportunities.json', 'utf8')) as { opportunities: OpportunityInput[] };
const golden = JSON.parse(readFileSync('tests/golden/match-scores.json', 'utf8')) as Record<string, { score: number; points: Record<string, number> }>;
const NOW = new Date('2026-10-14T12:00:00Z');
// GRANT_MATCHING.md v0 points 30/20/15/15/10/10 stored as fractions of 1 (D-025)
const W = { mission_fit: 0.3, eligibility_certainty: 0.2, evidence_readiness: 0.15, award_size_fit: 0.15, geography: 0.1, effort_vs_time: 0.1 };
const config: MatchConfig = { id: 'v0-test', weights: W, params: { prep_days: 30, themes_for_full_credit: 3, evidence_available: [] }, created_at: '2026-10-14', approved_by: 'u' };
const opp = (id: string) => fixture.opportunities.find((x) => x.id === id)!; const score = (id: string, cfg = config) => scoreOpportunity(opp(id), org, checkEligibility(opp(id), org, NOW), cfg, NOW);
const part = (id: string, key: string) => score(id).components.find((c) => c.key === key)!;

describe('scoreOpportunity', () => {
  it('matches the golden scores and points for every fixture, deterministically, with label, reason and source_refs on every component', () => {
    for (const o of fixture.opportunities) {
      const a = score(o.id!);
      expect({ score: a.score, points: Object.fromEntries(a.components.map((c) => [c.key, c.points])) }, o.id).toEqual(golden[o.id!]);
      expect(score(o.id!)).toEqual(a);
      for (const c of a.components) expect([c.value >= 0 && c.value <= 1, c.points, c.max, c.label.length > 2, c.reason.length > 10, c.source_refs.length > 0]).toEqual([true, Math.round(c.weight * c.value * 100), Math.round(c.weight * 100), true, true, true]);
    }
  });
  it('reasons and source_refs come only from the inputs', () => {
    expect(part('eligible', 'mission_fit')).toMatchObject({ label: 'Mission fit', points: 30, reason: 'Matched 4 of 5 configured themes: therapy (description), mental health (description), court-involved families (eligibility description), social services (funding categories)',
      source_refs: ['org.program_themes', 'opportunity.description', 'opportunity.eligibility.applicant_eligibility_description', 'opportunity.eligibility.funding_categories'] });
    expect([part('eligible', 'eligibility_certainty').reason, part('eligible', 'award_size_fit').reason]).toEqual(['10 of 10 eligibility checks passed, 0 flagged, 0 could not be checked', 'Award range $50,000–$200,000 fits a $600,000 annual budget']);
    expect(part('closes-soon', 'effort_vs_time')).toMatchObject({ points: 2, reason: '6 days to the 2026-10-20 close date, against 30 days of typical prep', source_refs: ['opportunity.close_date', 'match_config.params.prep_days'] });
    expect(part('national-cost-share', 'geography')).toMatchObject({ points: 5, reason: 'National program; Utah applicants are not named' });
    expect(part('missing-eligibility', 'effort_vs_time')).toMatchObject({ points: 0, reason: 'Could not score effort vs time: opportunity.close_date missing', source_refs: ['opportunity.close_date'] });
  });
  it('a blocker caps the score at 0 and explains why in its own component', () => {
    expect(score('state-only').score).toBe(0);
    expect(score('state-only').components.at(-1)).toEqual({ key: 'blocker_cap', label: 'Blocker', weight: 0, value: 0, points: 0, max: 0, reason: 'Score capped at 0: Only state governments may apply', source_refs: ['opportunity.eligibility.applicant_types'] });
    expect(score('floor-too-high').components.at(-1)?.reason).toBe('Score capped at 0: Only applicants in Colorado may apply');
  });
  it('F-504b params: floors cap genuine zeros (never "could not score"), min_days_to_close zeroes effort, max_cost_share_pct and award_too_small_value zero award fit; v0 params untouched', () => {
    const v1 = { ...config, id: 'v1-test', params: { ...config.params, floor_components: ['mission_fit', 'award_size_fit', 'effort_vs_time'], award_too_small_value: 0, min_days_to_close: 7, max_cost_share_pct: 25 } };
    const soon = score('closes-soon', v1); // 6 days < 7: effort 0, floored
    expect(soon.score).toBe(0); expect(soon.components.find((c) => c.key === 'effort_vs_time')).toMatchObject({ points: 0, reason: 'Only 6 days to the 2026-10-20 close date, under the 7-day minimum', source_refs: ['opportunity.close_date', 'match_config.params.prep_days', 'match_config.params.min_days_to_close'] });
    expect(soon.components.at(-1)).toMatchObject({ key: 'floor_cap', label: 'Floor', weight: 0, points: 0, max: 0, reason: 'Score capped at 0 (effort vs time scored 0): Only 6 days to the 2026-10-20 close date, under the 7-day minimum' });
    expect(soon.components.at(-1)?.source_refs).toContain('match_config.params.floor_components');
    expect(score('closes-soon', { ...v1, params: { ...v1.params, min_days_to_close: 6 } }).score).toBe(80); // boundary: 6 days is not under 6
    const missing = score('missing-eligibility', v1); // no close date: "could not score" effort stays 0 but never floors
    expect([missing.components.some((c) => c.key === 'floor_cap'), missing.score > 0]).toEqual([false, true]);
    const match = score('national-cost-share', { ...v1, params: { ...v1.params, max_cost_share_pct: 20 } }); // fixture asks a 25% match
    expect(match.components.find((c) => c.key === 'award_size_fit')).toMatchObject({ points: 0, reason: 'Requires cost share or match of 25%, above the 20% the matching rules allow', source_refs: ['opportunity.eligibility.is_cost_sharing', 'match_config.params.max_cost_share_pct'] });
    expect([match.score, score('national-cost-share', v1).components.find((c) => c.key === 'award_size_fit')?.points]).toEqual([0, 15]); // 25 is not above 25
    const tiny = { ...opp('eligible'), id: 'tiny', award_floor: null, award_ceiling: 5000 };
    const tinyScore = (cfg: MatchConfig) => scoreOpportunity(tiny, org, checkEligibility(tiny, org, NOW), cfg, NOW);
    expect([tinyScore(v1).score, tinyScore(v1).components.find((c) => c.key === 'award_size_fit')?.reason, tinyScore(config).components.find((c) => c.key === 'award_size_fit')?.points]).toEqual([0, 'Award ceiling $5,000 is below the $10,000 minimum worth applying for', 8]);
    for (const o of fixture.opportunities) expect(score(o.id!).components.map((c) => c.key)).not.toContain('floor_cap'); // v0 params never floor
  });
  it('weights must be known components summing to 1 (D-025); otherwise it throws', () => {
    expect(() => validateWeights({ ...W, geography: 0.2 })).toThrow(/must sum to 1/);
    expect(() => validateWeights({ mission_fit: 1, bogus: 0 })).toThrow(/unknown match component bogus/);
    expect(() => score('eligible', { ...config, weights: {} })).toThrow(/empty/);
    expect(score('eligible', { ...config, weights: { mission_fit: 1 } }).score).toBe(100);
  });
  it('toMatchResultRow shapes the match_result upsert with config_id, components and flags', () => {
    const row = toMatchResultRow('org-1', 'opp-1', score('closes-soon'), checkEligibility(opp('closes-soon'), org, NOW), NOW);
    expect(row).toMatchObject({ org_id: 'org-1', opportunity_id: 'opp-1', config_id: 'v0-test', model_version: 'v0-test', score: 80, computed_at: '2026-10-14T12:00:00.000Z' });
    expect([row.components.length, row.flags.eligible, row.flags.flags.map((f) => f.code)]).toEqual([6, true, ['close_date']]);
  });
  it('MatchQuery writes nothing and lists nothing when no config is approved (a newer draft does not count)', async () => {
    const calls: string[] = [];
    const client = { from: (t: string) => { calls.push(t); return { select: async () => ({ data: [{ ...config, id: 'v1-draft', approved_by: null }], error: null }) }; } } as never;
    expect(await MatchQuery.recompute(client, 'org-1', NOW)).toEqual({ scored: 0, configId: null, reason: 'no approved config' });
    expect(await MatchQuery.list(client, 'org-1', NOW)).toEqual({ config: null, asOf: null, rows: [] });
    expect(calls).toEqual(['match_config', 'match_config']);
  });
});
