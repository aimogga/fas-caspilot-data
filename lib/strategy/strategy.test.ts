import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { DashboardMetrics } from '../dashboard/metrics-query';
import { LlmError, type generateJson, type LlmMeta } from '../llm';
import { numbersIn, registerResolver, RESOLVERS, validateDraft } from './citations';
import { buildPrompt, generateDraft, saveDraft } from './generate';
import type { StrategyDraft } from './schema';
import { assembleSnapshot, assertPrivate, type SnapshotInput } from './snapshot';

// Synthetic fixtures only; the adapter is mocked, so no network call is made.
const OPP = '10101010-1010-1010-1010-101010101010', CRIT = '20202020-2020-2020-2020-202020202020', IND = '40404040-4040-4040-4040-404040404040';
const AWARD = '30303030-3030-3030-3030-303030303030';
const ABSTRACT = 'This project expands trauma informed family therapy for rural households referred by juvenile courts across three frontier counties';
const wired = { rows: 40, viewRows: 40, asOf: 'Sep 2026', delta: null };
const metrics = {
  m1: { ...wired, n: 40, median: 18, p25: 9, p75: 30, stillWaitingShare: 0.1 }, m2: { error: true }, m3: { ...wired, n: 5, share: null, topReason: null },
  m4: { ...wired, n: 30, rows: [], total: { band: 'all', completed: 21, closed: 30, rate: 0.7 }, includesHiddenBands: false }, m5: { ...wired, n: 21, costPerCompleted: 1450, programPerCompleted: 1300 },
} as unknown as DashboardMetrics;
const input = (over: Partial<SnapshotInput> = {}): SnapshotInput => ({
  opportunity: { id: OPP, title: 'Synthetic Family Fund', funder: 'Synthetic Foundation', description: 'Therapy access', award_floor: 50000, award_ceiling: 300000, close_date: '2027-03-01' },
  criteria: [{ id: CRIT, criterion: 'Need for the project', weight_points: 20, text: 'Describe the need.' }],
  indicators: [{ id: IND, source_id: 'census-sahie', indicator_code: 'uninsured_rate', geo_fips: '49035', period: '2023', value: '12.4', moe: '0.8', unit: 'percent', vintage: '2023', ingest_run_id: 'run-1' }],
  similar: [{ id: AWARD, source: 'usaspending', funder: 'HHS', recipient: 'Synthetic Recipient', recipient_state: 'UT', recipient_type: 'nonprofit', amount: 150000, fiscal_year: 2024,
    assistance_listing: '93.958', description: ABSTRACT, score: 3, reason: 'Synthetic Recipient won $150,000 in FY2024: same funder.', source_ref: `award_history:${AWARD}` }],
  summary: { count: 12, median: 150000, min: 50000, max: 300000, utah_share: 0.25, recipient_types: { nonprofit: 12 } },
  metrics, period: '2026-Q3', now: new Date('2026-10-15T00:00:00Z'), ...over,
});
const snap = assembleSnapshot(input());
const good: StrategyDraft = {
  opportunity_id: OPP, status: 'DRAFT',
  criteria_map: [{
    criterion: 'Need for the project (20 pts)', fas_position: 'The uninsured rate is 12.4% and families wait a median 18 days for a first session.',
    evidence: [{ claim: 'Uninsured rate of 12.4% in the service county.', citation_id: `public_indicator:${IND}` }, { claim: 'Median 18 days from court order to first session.', citation_id: 'metric:m1:2026-Q3' }],
    gaps: ['No outcome trend yet.'], confidence: 'medium',
  }],
  suggested_ask: { low: 50000, high: 150000, basis_citation_ids: [`award_history_summary:${OPP}`] },
  risks: ['Few Utah awards.'], narrative_outline: ['Need', 'Approach'], inferences: ['Inference: reviewers may favour 3 rural counties.'],
};
const withClaim = (claim: string): StrategyDraft => ({ ...good, criteria_map: [{ ...good.criteria_map[0]!, fas_position: 'Need is high.', evidence: [{ claim, citation_id: `public_indicator:${IND}` }] }] });
const META: LlmMeta = { provider: 'gemini', model: 'test-model', attempts: 1, input_tokens: 10, output_tokens: 20, latency_ms: 5 };
const mockGen = (...outs: unknown[]) => vi.fn(async () => {
  const next = outs.shift();
  if (next instanceof Error) throw next;
  return { data: next, meta: META };
}) as unknown as typeof generateJson & ReturnType<typeof vi.fn>;
const fakeClient = () => {
  const rows: Record<string, unknown>[] = [];
  const client = { from: () => ({ insert: (row: Record<string, unknown>) => (rows.push(row), { select: () => ({ single: async () => ({ data: { id: 'd1', status: row.status }, error: null }) }) }) }) };
  return { rows, client: client as unknown as SupabaseClient };
};

describe('strategy draft engine (F-508e)', () => {
  it('stores a valid draft as DRAFT with the snapshot, report and adapter meta', async () => {
    const r = await generateDraft(snap, mockGen(good));
    expect(r).toMatchObject({ status: 'DRAFT', output: good, citation_report: { ok: true, rounds: 1 }, model_meta: [META] });
    const { rows, client } = fakeClient();
    expect(await saveDraft(client, 'org-1', snap, r)).toEqual({ id: 'd1', status: 'DRAFT' });
    expect(rows[0]).toMatchObject({ org_id: 'org-1', opportunity_id: OPP, status: 'DRAFT', snapshot: snap, model_meta: [META] });
  });

  it('rejects an uncited number, regenerates once with the failure listed, then stores DRAFT', async () => {
    const gen = mockGen(withClaim('Uninsured rate of 99% in the county.'), good);
    const r = await generateDraft(snap, gen);
    expect(r).toMatchObject({ status: 'DRAFT', citation_report: { ok: true, rounds: 2 } });
    expect(gen.mock.calls[1][0].prompt).toContain('criteria_map[0].evidence[0].claim: 99 has no matching cited value');
  });

  it('stores failed with the citation report when the second draft also fails', async () => {
    const r = await generateDraft(snap, mockGen(withClaim('Rate is 99%.'), withClaim('Rate is 98%.')));
    expect(r.status).toBe('failed');
    expect(r.citation_report.ok).toBe(false);
    expect(r.citation_report.claims.flatMap((c) => c.problems)).toContain('98 has no matching cited value');
    const { rows, client } = fakeClient();
    expect((await saveDraft(client, 'org-1', snap, r)).status).toBe('failed');
    expect(rows[0]).toMatchObject({ status: 'failed', citation_report: { ok: false, rounds: 2 } });
  });

  it('a schema violation or an adapter failure is a failed round, never a usable draft', async () => {
    const bad = await generateDraft(snap, mockGen({ ...good, status: 'FINAL' }, { ...good, criteria_map: 'x' }));
    expect(bad).toMatchObject({ status: 'failed', output: null, citation_report: { error: 'invalid_schema' } });
    const down = new LlmError([{ provider: 'gemini', status: 'invalid_schema' }, { provider: 'openrouter', status: 429 }]);
    expect(await generateDraft(snap, mockGen(down, down))).toMatchObject({ status: 'failed', citation_report: { error: down.attempts } });
    expect((await generateDraft(snap, mockGen(down, good))).status).toBe('DRAFT');
  });

  it('a citation must be in the snapshot and resolve; suggested_ask numbers must match its basis', () => {
    const r = validateDraft({ ...withClaim('x'), suggested_ask: { low: 1, high: 150000, basis_citation_ids: [`award_history_summary:${OPP}`, 'award_history_summary:nope'] } }, snap);
    r.claims.push(validateDraft(withClaim('x'), { ...snap, facts: snap.facts.filter((f) => !f.citation_id.startsWith('public_indicator')) }).claims[1]!);
    expect(r.ok).toBe(false);
    expect(r.claims.flatMap((c) => c.problems)).toEqual(['award_history_summary:nope is not in the snapshot', '1 has no matching cited value', `public_indicator:${IND} is not in the snapshot`]);
  });

  it('copy guard: 12 consecutive words from a stored award description are rejected, 11 are not', () => {
    const words = ABSTRACT.split(' ');
    const twelve = validateDraft({ ...good, risks: [`We will ${words.slice(2, 14).join(' ')}.`] }, snap);
    expect(twelve.ok).toBe(false);
    expect(twelve.copied).toEqual([expect.objectContaining({ path: 'risks[0]', citation_id: `award_history:${AWARD}` })]);
    expect(validateDraft({ ...good, risks: [`We will ${words.slice(2, 13).join(' ')}.`] }, snap).ok).toBe(true);
    expect(buildPrompt(snap)).not.toContain('frontier counties');
  });

  it('inferences are kept separate: not validated as claims and returned as written', async () => {
    const r = await generateDraft(snap, mockGen(good));
    expect(r.output?.inferences).toEqual(['Inference: reviewers may favour 3 rural counties.']);
    expect(r.citation_report.claims.some((c) => c.path.startsWith('inferences'))).toBe(false);
  });

  it('snapshot privacy: client-level rows and counts under 11 never enter', () => {
    const smuggled = { ...input().indicators[0]!, case_id: 'c-1', first_name: 'Synthetic' };
    const s = assembleSnapshot(input({ indicators: [smuggled] }));
    expect(JSON.stringify(s)).not.toMatch(/case_id|first_name|c-1/);
    expect(s.facts.find((f) => f.citation_id === 'metric:m3:2026-Q3')?.values).toEqual({ value: null, n: null });
    expect(s.facts.find((f) => f.citation_id === 'metric:m1:2026-Q3')?.values).toEqual({ value: 18, n: 40 });
    expect(s.facts.some((f) => f.citation_id.startsWith('metric:m2'))).toBe(false);
    const extra = (fact: object) => () => assembleSnapshot(input({ extra: [fact as never] }));
    expect(extra({ citation_id: 'case:c-1', label: 'x', values: {} })).toThrow(/unregistered kind/);
    expect(extra({ citation_id: 'metric:m1:2026-Q2', label: 'x', values: { value: 3, n: 4 } })).toThrow(/under 11/);
    expect(extra({ citation_id: 'opportunity:x', label: 'x', values: {}, source: { application_id: 'a-1' } })).toThrow(/client-level key/);
    expect(() => assertPrivate({ ...s, abstracts: [{ citation_id: 'award_history:x', text: 't', notes: 'n' } as never] })).toThrow(/client-level key/);
  });

  it('a rate matches as a percent, but a count or amount 100 times its cited value does not', () => {
    const cite = (claim: string, citation_id: string) => validateDraft({ ...good, criteria_map: [{ ...good.criteria_map[0]!, fas_position: 'x', evidence: [{ claim, citation_id }] }] }, snap).ok;
    expect(cite('Completion rate is 70%.', 'metric:m4:2026-Q3')).toBe(true);
    expect(cite('We served 3,000 families.', 'metric:m4:2026-Q3')).toBe(false);
    expect(cite('Similar awards number 1,200.', `award_history_summary:${OPP}`)).toBe(false);
  });

  it('numbersIn finds money, percents and scaled numbers and skips years and codes', () => {
    expect(numbersIn('In FY2024 and 2025, M1 rose to 12.5% of $1,200 or 1.2 million (Q3).')).toEqual([12.5, 1200, 1.2e6]);
  });

  it('resolver registry: a kind resolves once its module registers it', () => {
    const fact = { citation_id: 'org_knowledge:k1', label: 'Approved fact', values: { value: 7 } };
    const draft = withClaim('We have 7 trained staff.');
    draft.criteria_map[0]!.evidence[0]!.citation_id = fact.citation_id;
    const s = { ...snap, facts: [...snap.facts, fact] };
    expect(validateDraft(draft, s).claims[1]!.problems).toEqual(['no resolver for org_knowledge', '7 has no matching cited value']);
    registerResolver('org_knowledge', () => true);
    try { expect(validateDraft(draft, s).ok).toBe(true); } finally { RESOLVERS.delete('org_knowledge'); }
  });
});
