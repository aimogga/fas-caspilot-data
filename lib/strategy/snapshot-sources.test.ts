import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { RESOLVERS, registerResolver, validateDraft } from './citations';
import { buildPrompt } from './generate';
import type { StrategyDraft } from './schema';
import { loadSnapshot } from './snapshot';

// Synthetic rows only; the Supabase client is faked, so no network call is made.
const OPP = '10101010-1010-1010-1010-101010101010', AWARD = '30303030-3030-3030-3030-303030303030';
const ABS = '50505050-5050-5050-5050-505050505050', PROF = '60606060-6060-6060-6060-606060606060';
const ABSTRACT = 'Our partners deliver weekly parenting circles and in home coaching for grandparents raising grandchildren in desert towns';
const TABLES: Record<string, Record<string, unknown>[]> = {
  opportunity: [{ id: OPP, title: 'Synthetic Fund', funder: 'HHS', description: 'Family therapy', award_floor: 50000, award_ceiling: 300000, close_date: '2027-03-01', assistance_listing: '93.958' }],
  award_history: [{ id: AWARD, source: 'usaspending', funder: 'HHS', recipient: 'Synthetic Recipient', recipient_state: 'UT', recipient_type: 'nonprofit', amount: 150000,
    fiscal_year: 2024, assistance_listing: '93.958', description: 'Short note.' }],
  award_abstract: [{ id: ABS, award_history_id: AWARD, text: ABSTRACT }],
  recipient_profile: [{ id: PROF, award_history_id: AWARD, matched_name: 'Synthetic Recipient Inc', state: 'UT', ntee_code: 'P30', ruling_year: 1998,
    total_revenue: '2400000', program_service_expenses: '2000000', match_confidence: 'high' }],
};
/** Every builder method chains; awaiting gives the table's rows, `.single()` the first. Records each table's filters. */
const fakeClient = () => {
  const calls: { table: string; ops: string[] }[] = [];
  const client = { from: (table: string) => {
    const ops: string[] = [], res = () => ({ data: TABLES[table] ?? [], error: null });
    calls.push({ table, ops });
    const b: Record<string, unknown> = new Proxy({}, { get: (_, k) => k === 'then' ? (ok: (v: unknown) => void) => ok(res())
      : k === 'single' ? async () => ({ data: (TABLES[table] ?? [])[0] ?? null, error: null })
      : (...a: unknown[]) => (ops.push(`${String(k)}(${a.map((x) => JSON.stringify(x)).join(',')})`), b) });
    return b;
  } };
  return { calls, client: client as unknown as SupabaseClient };
};

describe('strategy snapshot: award_abstract and recipient_profile (F-508e)', () => {
  it('loadSnapshot reads published abstracts and whitelisted profiles for the similar awards', async () => {
    const { calls, client } = fakeClient();
    const s = await loadSnapshot(client, OPP, new Date('2026-10-15T00:00:00Z'));
    expect(s.abstracts).toContainEqual({ citation_id: `award_abstract:${ABS}`, text: ABSTRACT });
    const prof = s.facts.find((f) => f.citation_id === `recipient_profile:${PROF}`);
    expect(prof?.values).toEqual({ ruling_year: 1998, total_revenue: 2400000, program_service_expenses: 2000000 });
    expect(calls.find((c) => c.table === 'award_abstract')?.ops).toEqual(['select("id,award_history_id,text")', 'eq("status","published")', `in("award_history_id",["${AWARD}"])`]);
    expect(calls.find((c) => c.table === 'recipient_profile')?.ops[0]).not.toMatch(/officer|compensation|ein/);
    expect(buildPrompt(s)).not.toContain('desert towns');
  });

  it('a draft copying 12 words from a stored award_abstract fails the copy guard; a recipient_profile citation resolves', async () => {
    const s = await loadSnapshot(fakeClient().client, OPP, new Date('2026-10-15T00:00:00Z'));
    const draft: StrategyDraft = {
      opportunity_id: OPP, status: 'DRAFT',
      criteria_map: [{ criterion: 'Capacity', fas_position: 'Peers in this program report about $2.4 million in revenue.',
        evidence: [{ claim: 'A past recipient reported $2,400,000 total revenue.', citation_id: `recipient_profile:${PROF}` }], gaps: [], confidence: 'low' }],
      suggested_ask: null, risks: [], narrative_outline: [], inferences: [],
    };
    const clean = validateDraft(draft, s);
    expect(clean).toMatchObject({ ok: true, copied: [] });
    const copied = validateDraft({ ...draft, narrative_outline: [`FAS will ${ABSTRACT.split(' ').slice(1, 13).join(' ')}.`] }, s);
    expect(copied.ok).toBe(false);
    expect(copied.copied).toEqual([expect.objectContaining({ path: 'narrative_outline[0]', citation_id: `award_abstract:${ABS}` })]);
  });

  it('registering award_abstract or recipient_profile again is harmless', () => {
    const before = RESOLVERS.get('recipient_profile');
    try {
      expect(() => registerResolver('recipient_profile', (ref) => /^[0-9a-f-]{36}$/i.test(ref))).not.toThrow();
      expect(RESOLVERS.get('recipient_profile')?.(PROF, { citation_id: '', label: '', values: {} })).toBe(true);
    } finally { RESOLVERS.set('recipient_profile', before!); }
  });
});
