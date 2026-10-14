import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { UsaSpending } from '../../packages/ingest/usaspending';
import { AwardHistoryQuery, keywords, similarAwards, summarize, type StoredAward } from './award-history';
const parsed = UsaSpending.dedupe(UsaSpending.parse(JSON.parse(readFileSync('tests/fixtures/usaspending/search.json', 'utf8'))));
const rows: StoredAward[] = parsed.map((r, i) => ({ ...r, id: `a${i}`, raw: undefined }));
const opp = { assistance_listing: '93.590', funder: 'Department of Health and Human Services', title: 'Community-Based Child Abuse Prevention: Family Counseling', description: 'Supports family therapy.' };
describe('unit: similarAwards ranks by listing, funder, then shared terms, with a citable reason per row', () => {
  it('orders ALN+funder+terms first, funder-only next (amount desc), drops unrelated awards, caps at n', () => {
    const got = similarAwards(rows, opp);
    expect(got.map((r) => [r.id, r.score, r.source_ref])).toEqual([['a0', 8, 'award_history:a0'], ['a1', 2, 'award_history:a1'], ['a2', 2, 'award_history:a2']]);
    expect(got[0].reason).toBe('Example Family Services Inc won $450,000 in FY2024: same Assistance Listing 93.590; same funder; shares the terms abuse, child, community-based.');
    expect(got[1].reason).toBe('Sample County Behavioral Health won $1,200,000 in FY2025: same funder.');
    expect([similarAwards(rows, opp, 1).length, similarAwards(rows, { assistance_listing: null, funder: null, title: 'Roads', description: null })]).toEqual([1, []]);
    expect(similarAwards(rows, { assistance_listing: null, funder: null, title: 'youth mental health', description: null })[0]).toEqual(expect.objectContaining({ id: 'a2', score: 3 }));
    expect([...keywords('The Family-Therapy grants for court-involved youth', null)]).toEqual(['family-therapy', 'court-involved', 'youth']);
  });
  it('golden: summary on fixture (count, median, range, recipient types, Utah share)', () => {
    expect(summarize(rows)).toEqual({ count: 3, median: 450000, min: 80000, max: 1200000, utah_share: 0.667, recipient_types: { organization: 1, government: 1, higher_education: 1 } });
    expect(summarize(rows.slice(0, 2))).toEqual(expect.objectContaining({ median: 825000, utah_share: 1 })); expect(summarize([])).toEqual({ count: 0, median: null, min: null, max: null, utah_share: null, recipient_types: {} });
  });
  it('forOpportunity reads the opportunity then awards on its listing with the caller client; errors surface', async () => {
    const calls: string[] = [], table = (name: string) => { const q: Record<string, unknown> = {}; const chain = (m: string) => (...a: unknown[]) => { calls.push(`${name}.${m}(${a.join(',')})`); return q; };
      for (const m of ['select', 'eq', 'ilike', 'order', 'limit']) q[m] = chain(m);
      q.single = async () => (calls.push(`${name}.single`), { data: opp, error: null });
      q.then = (res: (v: unknown) => void) => res({ data: rows.map((r) => ({ ...r, amount: String(r.amount) })), error: null }); return q; };
    const got = await AwardHistoryQuery.forOpportunity({ from: table } as unknown as SupabaseClient, 'opp-1', 2);
    expect(calls).toEqual(['opportunity.select(assistance_listing,funder,title,description)', 'opportunity.eq(id,opp-1)', 'opportunity.single',
      `award_history.select(${AwardHistoryQuery.COLUMNS})`, 'award_history.order(amount,[object Object])', 'award_history.limit(500)', 'award_history.eq(assistance_listing,93.590)']);
    expect([got.similar.map((r) => r.id), got.summary.count, got.similar[0].amount]).toEqual([['a0', 'a1'], 3, 450000]);
    const broken = { from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: null, error: { message: 'boom' } }) }) }) }) } as unknown as SupabaseClient;
    await expect(AwardHistoryQuery.forOpportunity(broken, 'x')).rejects.toThrow('boom');
  });
});
