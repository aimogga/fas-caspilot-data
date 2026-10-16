import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { SimilarAward } from '../grants/award-history';
import { LlmError, type generateJson, type LlmMeta } from '../llm';
import { RESOLVERS } from './citations';
import {
  analyzeWinners, APPLICATIONS_NOT_PUBLIC, extractCriteria, overlapScores, registerWinnerResolvers, tableExists, WINNER_RESOLVERS, type WinnerAnalysis, type WinnerInput,
} from './winners';

// Fictional NOFO excerpts and synthetic rows only; the adapter is mocked, so no network call is made.
const NOFO_A = `Synthetic Family Therapy Access Program (fictional NOFO)
Section 5. Evaluation Criteria
1. Need for the Project (20 points)
Describe the need for trauma-informed family therapy among court-involved families in rural counties. Limit: 500 words.
2. Project Design — 30 pts
Explain how counseling sessions reach families quickly. Narrative may not exceed 3 pages.
3. Organizational Capacity: 15 points
Total: 65 points
Applications are due March 1.`;
const NOFO_B = `Evaluation Criterion A – Statement of Need (Maximum 25 points)
Up to 750 words.
Evaluation Criterion B – Outcomes and Evaluation (Maximum 25 points)
500-word limit`;
const OPP = '10101010-1010-1010-1010-101010101010', AWARD = '30303030-3030-3030-3030-303030303030', PROF = '50505050-5050-5050-5050-505050505050';
const ABS = '60606060-6060-6060-6060-606060606060', K = '70707070-7070-7070-7070-707070707070', IND = '40404040-4040-4040-4040-404040404040';
const ABSTRACT = 'Trauma-informed family therapy for court-involved families in rural counties, delivered by licensed clinicians within two weeks of referral from the court.';
const winner: SimilarAward = { id: AWARD, source: 'usaspending', funder: 'HHS', recipient: 'Synthetic Recipient', recipient_state: 'UT', recipient_type: 'nonprofit', amount: 150000,
  fiscal_year: 2024, assistance_listing: '93.958', description: 'Synthetic award description kept out of the prompt.', score: 3, reason: 'same listing', source_ref: `award_history:${AWARD}` };
const input = (over: Partial<WinnerInput> = {}): WinnerInput => ({
  opportunity: { id: OPP, description: NOFO_A }, winners: [winner],
  profiles: [{ id: PROF, award_history_id: AWARD, recipient: 'Synthetic Recipient', ntee_code: 'F32', ruling_year: 1998, latest_tax_year: 2023, total_revenue: 2400000,
    total_expenses: 2100000, program_service_expenses: 1800000, contributions_share: 0.62, match_confidence: 'high' }],
  abstracts: [{ id: ABS, award_history_id: AWARD, source: 'usaspending_detail', status: 'published', text: ABSTRACT, word_count: 23, reason: null }],
  knowledge: [{ id: K, category: 'program', title: 'Families served', body: 'FAS paid for therapy for 140 families in 2025.', source: 'FAS annual report', as_of: '2025-12-31', version: 2 }],
  indicators: [{ id: IND, source_id: 'census-sahie', indicator_code: 'uninsured_rate', geo_fips: '49035', period: '2023', value: '12.4', moe: '0.8', unit: 'percent', vintage: '2023', ingest_run_id: 'run-1' }],
  now: new Date('2026-10-16T00:00:00Z'), ...over,
});
const good: WinnerAnalysis = {
  opportunity_id: OPP,
  patterns: [{ label: 'INFERENCE', statement: 'The winner whose abstract shares most terms with Need for the Project (0.583 overlap) won $150,000.', citation_ids: [`award_history:${AWARD}`] },
    { label: 'INFERENCE', statement: 'It is a mental health organization with $2.1 million in expenses.', citation_ids: [`recipient_profile:${PROF}`] }],
  fas_comparison: [{ label: 'INFERENCE', statement: 'FAS paid for therapy for 140 families where the uninsured rate is 12.4%.', citation_ids: [`org_knowledge:${K}@v2`, `public_indicator:${IND}`] }],
  unknowns: ['Whether reviewers weighed capacity heavily.'],
};
const META: LlmMeta = { provider: 'gemini', model: 'test-model', attempts: 1, input_tokens: 10, output_tokens: 20, latency_ms: 5 };
const mockGen = (out: unknown) => vi.fn(async () => { if (out instanceof Error) throw out; return { data: out, meta: META }; }) as unknown as typeof generateJson & ReturnType<typeof vi.fn>;
const pattern = (statement: string, citation_ids: string[]): WinnerAnalysis => ({ ...good, patterns: [{ label: 'INFERENCE', statement, citation_ids }] });
const problems = async (out: unknown) => (await analyzeWinners(input(), mockGen(out))).report.claims.flatMap((c) => c.problems);

beforeAll(() => registerWinnerResolvers(async () => true));
afterAll(() => Object.keys(WINNER_RESOLVERS).forEach((k) => RESOLVERS.delete(k)));

describe('winner analysis (F-508d)', () => {
  it('extracts headings, points, word and page limits with line references from fixture NOFOs', () => {
    const a = extractCriteria(NOFO_A, 'opportunity:o1.description');
    expect(a.note).toBeNull();
    expect(a.criteria.map(({ key, heading, points, word_limit, page_limit, location }) => ({ key, heading, points, word_limit, page_limit, location }))).toEqual([
      { key: 'C1', heading: 'Need for the Project', points: 20, word_limit: 500, page_limit: null, location: { ref: 'opportunity:o1.description#L3', line: 3 } },
      { key: 'C2', heading: 'Project Design', points: 30, word_limit: null, page_limit: 3, location: { ref: 'opportunity:o1.description#L5', line: 5 } },
      { key: 'C3', heading: 'Organizational Capacity', points: 15, word_limit: null, page_limit: null, location: { ref: 'opportunity:o1.description#L7', line: 7 } },
    ]);
    expect(a.criteria[2]!.text).toBe(''); // the Total line closes the list; the due date is not criterion text
    const b = extractCriteria(NOFO_B, 'r');
    expect(b.criteria.map((c) => [c.heading, c.points, c.word_limit])).toEqual([['Statement of Need', 25, 750], ['Outcomes and Evaluation', 25, 500]]);
  });

  it('says so when no criteria can be found', () => {
    for (const t of [null, '', 'Applications are due March 1. Funding supports family therapy.']) expect(extractCriteria(t, 'r')).toEqual({ criteria: [], note: expect.stringMatching(/No evaluation criteria/) });
  });

  it('overlap score is deterministic, from abstract and profile terms only', () => {
    const { criteria } = extractCriteria(NOFO_A, 'r'), x = input();
    const o = overlapScores(x.winners, criteria, x.profiles, x.abstracts);
    expect(o.map((v) => [v.criterion, v.score])).toEqual([['C1', 0.583], ['C2', 0.2], ['C3', 0]]);
    expect(o[0]!.shared).toEqual(['counties', 'court-involved', 'families', 'family', 'rural', 'therapy', 'trauma-informed']);
    expect(o[1]!.shared).toEqual(['counseling', 'families']); // "counseling" comes from the NTEE F profile, not the abstract
    expect(overlapScores(x.winners, criteria, [{ ...x.profiles[0]!, match_confidence: 'none' }], [])).toEqual(o.map((v) => ({ ...v, score: 0, shared: [] })));
    expect(overlapScores(x.winners, criteria, x.profiles, x.abstracts)).toEqual(o);
  });

  it('one generateJson call turns stored facts into labeled INFERENCE; unknowns always say applications are not public', async () => {
    const gen = mockGen(good), r = await analyzeWinners(input(), gen);
    expect(gen).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ status: 'INFERENCE', report: { ok: true }, model_meta: [META] });
    expect(r.output?.unknowns).toEqual([APPLICATIONS_NOT_PUBLIC, 'Whether reviewers weighed capacity heavily.']);
    const { prompt, system } = gen.mock.calls[0]![0];
    expect(system).toMatch(/INFERENCE/);
    expect(prompt).toContain('"overlap_C1":0.583');
    expect(prompt).not.toMatch(/licensed clinicians|kept out of the prompt|20 points/);
    const none = await analyzeWinners(input({ opportunity: { id: OPP, description: null } }), mockGen({ ...good, patterns: [], unknowns: [APPLICATIONS_NOT_PUBLIC] }));
    expect(none.output?.unknowns).toEqual([APPLICATIONS_NOT_PUBLIC, expect.stringMatching(/No evaluation criteria/)]);
  });

  it('rejects uncited numbers, disallowed or unknown citations and numbers in unknowns', async () => {
    expect(await problems(pattern('Winners averaged 99% overlap.', [`award_history:${AWARD}`]))).toEqual(['99 has no matching cited value']);
    expect(await problems(pattern('The ceiling is $300,000.', [`opportunity:${OPP}`]))).toEqual([`opportunity:${OPP} is not an allowed citation kind`, '300000 has no matching cited value']);
    expect(await problems(pattern('A pattern.', ['award_history:nope']))).toEqual(['award_history:nope is not in the snapshot']);
    expect(await problems(pattern('A pattern.', [`org_knowledge:${K}`]))).toEqual([`org_knowledge:${K} is not in the snapshot`]);
    expect(await problems({ ...good, unknowns: ['Maybe 3 reviewers.'] })).toEqual(['3 has no matching cited value']);
    expect((await analyzeWinners(input(), mockGen(pattern('Winners won $150,000.', [`award_history:${AWARD}`])))).status).toBe('INFERENCE');
  });

  it('rejects an unlabeled statement, an adapter failure and copied abstract text', async () => {
    const unlabeled = { ...good, patterns: [{ ...good.patterns[0]!, label: 'FACT' }] };
    expect(await analyzeWinners(input(), mockGen(unlabeled))).toMatchObject({ status: 'rejected', output: null, report: { error: 'invalid_schema' } });
    expect(await analyzeWinners(input(), mockGen({ ...good, patterns: [{ ...good.patterns[0]!, citation_ids: [] }] }))).toMatchObject({ status: 'rejected' });
    const down = new LlmError([{ provider: 'gemini', status: 429 }, { provider: 'openrouter', status: 'timeout' }]);
    expect(await analyzeWinners(input(), mockGen(down))).toMatchObject({ status: 'rejected', report: { error: down.attempts } });
    const copy = await analyzeWinners(input(), mockGen(pattern(`It ran ${ABSTRACT.split(' ').slice(3, 15).join(' ')}.`, [`award_abstract:${ABS}`])));
    expect(copy).toMatchObject({ status: 'rejected', report: { copied: [expect.objectContaining({ citation_id: `award_abstract:${ABS}` })] } });
  });

  it('registers each resolver only when its table exists', async () => {
    try {
      Object.keys(WINNER_RESOLVERS).forEach((k) => RESOLVERS.delete(k));
      expect(await registerWinnerResolvers(async (t) => t !== 'org_knowledge_version')).toEqual(['recipient_profile', 'award_abstract']);
      await expect(analyzeWinners(input(), mockGen(good))).rejects.toThrow(/unregistered kind org_knowledge/);
      const client = (code: string | null) => ({ from: () => ({ select: () => ({ limit: async () => ({ error: code && { code } }) }) }) }) as unknown as SupabaseClient;
      expect(await tableExists(client('PGRST205'))('recipient_profile')).toBe(false);
      expect(await tableExists(client('42501'))('recipient_profile')).toBe(true);
      expect(await tableExists(client(null))('recipient_profile')).toBe(true);
    } finally { await registerWinnerResolvers(async () => true); }
  });
});
