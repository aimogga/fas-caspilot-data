import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { LlmError, type generateJson, type LlmMeta } from '../llm';
import type { StrategyDraft } from '../strategy/schema';
import type { Snapshot } from '../strategy/snapshot';
import { createApplicationDraft, NOT_APPROVED, QUOTA_MESSAGE, startFromStrategy, writeSections } from './generate';
import { batchPlan, parseLimits, planSections } from './sections';
import { strFromU8, unzipSync } from 'fflate';
import { assertPacket } from '../packets/assert';
import { packetToDocx } from '../packets/docx';
import { applicationPacket, HEADER, NOT_APPROVED_EXPORT } from './docx';
import { applyEdit, approvalBlockers, reviewSection, UNCITED } from './review';
import type { Section } from './generate';

// Synthetic fixtures only; the adapter is mocked, so no network call is made.
const OPP = '10101010-1010-1010-1010-101010101010', IND = '40404040-4040-4040-4040-404040404040', C = (n: number) => `2020202${n}-2020-2020-2020-202020202020`;
const ABSTRACT = 'This project expands trauma informed family therapy for rural households referred by juvenile courts across three frontier counties';
const snapshot: Snapshot = {
  opportunity_id: OPP, built_at: '2026-10-15T00:00:00.000Z', abstracts: [{ citation_id: 'award_history:30303030-3030-3030-3030-303030303030', text: ABSTRACT }],
  facts: [
    { citation_id: `opportunity:${OPP}`, label: 'Synthetic Family Fund', values: { award_floor: 50000, award_ceiling: 300000 } },
    { citation_id: `opportunity_criteria:${C(1)}`, label: 'Need for the project', values: { weight_points: 20 }, text: 'Describe the need, not to exceed 50 words.' },
    { citation_id: `opportunity_criteria:${C(2)}`, label: 'Approach', values: { weight_points: 30 }, text: 'Describe the approach in no more than 2 pages.' },
    { citation_id: `opportunity_criteria:${C(3)}`, label: 'Budget', values: { weight_points: 10 }, text: 'Justify the budget.' },
    { citation_id: `public_indicator:${IND}`, label: 'Uninsured rate, county FIPS 49035, 2023', values: { value: 12.4, moe: 0.8 }, source: { source_id: 'census-sahie', vintage: '2023' } },
  ],
};
const crit = (criterion: string) => ({ criterion, fas_position: 'Need is high.', evidence: [], gaps: [], confidence: 'medium' as const });
const strategy: StrategyDraft = {
  opportunity_id: OPP, status: 'DRAFT', criteria_map: [crit('Need for the project (20 pts)'), crit('Approach'), crit('Budget')],
  suggested_ask: null, risks: [], narrative_outline: [], inferences: [],
};
const row = (status: string) => ({ id: 's1', org_id: 'org-1', opportunity_id: OPP, status, output: strategy, snapshot });
const sec = (key: string, body: string, citation_ids = [`public_indicator:${IND}`]) => ({ key, heading: key, criterion: key, body, citation_ids, assumptions: [] });
const OK = { s1: 'In our service county 12.4% of people have no health insurance.', s2: 'We pay licensed therapists directly.', s3: 'We keep costs low.' };
const all = (over: Partial<typeof OK> = {}) => ({ sections: Object.entries({ ...OK, ...over }).map(([k, b]) => sec(k, b)) });
const META: LlmMeta = { provider: 'gemini', model: 'test-model', attempts: 1, input_tokens: 10, output_tokens: 20, latency_ms: 5 };
const mockGen = (...outs: unknown[]) => vi.fn(async () => {
  const next = outs.shift();
  if (next instanceof Error) throw next;
  return { data: next, meta: META };
}) as unknown as typeof generateJson & ReturnType<typeof vi.fn>;

describe('application writer (F-508g)', () => {
  it('parseLimits reads words, pages and characters, and never guesses', () => {
    expect(parseLimits('Narrative not to exceed 500 words.')).toEqual({ kind: 'words', value: 500, max_words: 500, max_chars: null });
    expect(parseLimits('Limit: 2 pages')).toEqual({ kind: 'pages', value: 2, max_words: 1000, max_chars: null });
    expect(parseLimits('2 pages', 400)).toMatchObject({ max_words: 800 });
    expect(parseLimits('Up to 5,000 characters including spaces')).toEqual({ kind: 'characters', value: 5000, max_words: null, max_chars: 5000 });
    expect(parseLimits('Describe the need.')).toEqual({ kind: 'none_stated' });
    expect(parseLimits(null)).toEqual({ kind: 'none_stated' });
  });

  it('plans one section per criteria_map entry under the funder heading, with points and limits', () => {
    const plan = planSections(strategy, snapshot);
    expect(plan.map((p) => [p.key, p.heading, p.points, p.limit.kind])).toEqual([['s1', 'Need for the project', 20, 'words'], ['s2', 'Approach', 30, 'pages'], ['s3', 'Budget', 10, 'none_stated']]);
  });

  it('batches into at most 3 calls and never one per section', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ ...planSections(strategy, snapshot)[2]!, key: `s${i + 1}` }));
    expect(batchPlan(many, 100_000)).toHaveLength(1);
    expect(batchPlan(many, 1000).map((b) => b.length)).toEqual([3, 3, 3]);
    expect(batchPlan(many, 1).length).toBe(3);
  });

  it('writes every section in one call when it fits, citing snapshot facts', async () => {
    const gen = mockGen(all());
    const r = await writeSections(strategy, snapshot, gen);
    expect(gen).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ status: 'DRAFT', validation_report: { ok: true, needs_edit: [] }, model_meta: { calls: 1, retried: false } });
    expect(r.status === 'DRAFT' && r.sections.map((s) => [s.heading, s.status])).toEqual([['Need for the project', 'ok'], ['Approach', 'ok'], ['Budget', 'ok']]);
  });

  it('regenerates an over-limit section once in a single batched retry, then marks it needs_edit', async () => {
    const long = Array.from({ length: 60 }, () => 'word').join(' ');
    const gen = mockGen(all({ s1: long }), { sections: [sec('s1', long)] });
    const r = await writeSections(strategy, snapshot, gen);
    expect(gen).toHaveBeenCalledTimes(2);
    expect((gen.mock.calls[1] as unknown as [{ prompt: string }])[0].prompt).toContain('s1 (Need for the project): 60 words is over the 50-word limit');
    if (r.status !== 'DRAFT') throw new Error('expected DRAFT');
    expect(r.sections.map((s) => s.status)).toEqual(['needs_edit', 'ok', 'ok']);
    expect(r).toMatchObject({ validation_report: { ok: false, needs_edit: ['s1'], rounds: { s1: 2, s2: 1 } }, model_meta: { calls: 2, retried: true } });
  });

  it('a fixed retry clears the section; an uncited number and copied abstract text are caught', async () => {
    const fixed = await writeSections(strategy, snapshot, mockGen(all({ s2: 'We served 900 families.' }), { sections: [sec('s2', 'We pay therapists.')] }));
    expect(fixed).toMatchObject({ validation_report: { ok: true }, model_meta: { calls: 2 } });
    const r = await writeSections(strategy, snapshot, mockGen(all({ s2: 'We served 900 families.', s3: ABSTRACT }), all({ s2: 'We served 900 families.', s3: ABSTRACT })));
    if (r.status !== 'DRAFT') throw new Error('expected DRAFT');
    expect(r.sections[1]!.reasons).toEqual(['900 has no matching cited value']);
    expect([r.sections[2]!.reasons[0], r.model_meta.calls]).toEqual([expect.stringMatching(/copies 12\+ words from award_history:/), 2]);
  });

  it('refuses a strategy that is not approved and reuses the stored snapshot as is', () => {
    expect(() => startFromStrategy(row('DRAFT'))).toThrow(NOT_APPROVED);
    expect(() => startFromStrategy(row('failed'))).toThrow(NOT_APPROVED);
    expect(startFromStrategy(row('approved')).snapshot).toBe(snapshot);
  });

  it('stops with the quota message and stores nothing when OpenRouter is out of quota and Gemini is down', async () => {
    const err = new LlmError([{ provider: 'gemini', status: 503 }, { provider: 'openrouter', status: 429 }]);
    expect(await writeSections(strategy, snapshot, mockGen(err))).toEqual({ status: 'quota', message: QUOTA_MESSAGE });
    const insert = vi.fn();
    const client = { from: (t: string) => (t === 'strategy_draft'
      ? { select: () => ({ eq: () => ({ single: async () => ({ data: row('approved'), error: null }) }) }) } : { insert }) } as unknown as SupabaseClient;
    expect(await createApplicationDraft(client, 's1', mockGen(err))).toEqual({ error: QUOTA_MESSAGE });
    expect(insert).not.toHaveBeenCalled();
  });
});

describe('application editor and Word export (F-508h)', () => {
  const words = (n: number) => Array.from({ length: n }, () => 'word').join(' ');
  const base = (): Section[] => planSections(strategy, snapshot).map((p) => ({ ...sec(p.key, OK[p.key as keyof typeof OK]), heading: p.heading, criterion: p.criterion, points: p.points, limit: p.limit, status: 'ok', reasons: [] }));
  const app = (status: 'DRAFT' | 'approved', sections = base()) => ({ title: 'Synthetic Family Fund', snapshot, draft: { id: 'a1', org_id: 'o', opportunity_id: OPP, strategy_draft_id: 's1', status, sections, approved_at: '2026-10-16T00:00:00Z', created_at: '' } });

  it('an edit that adds an uncited number warns and blocks approval; over-limit and needs_edit block too; a clean draft is approvable', () => {
    expect(approvalBlockers(base(), snapshot)).toEqual([]);
    const edited = applyEdit(base(), 's2', 'We pay licensed therapists directly for 900 families.', snapshot);
    expect([reviewSection(edited[1]!, snapshot).uncited, edited[1]!.status, UNCITED]).toEqual([[900], 'needs_edit', 'This number has no source. Add a source or remove it before approval.']);
    expect(approvalBlockers(edited, snapshot)).toEqual(['Approach still needs an edit.']);
    const long = applyEdit(base(), 's1', words(60), snapshot);
    expect(reviewSection(long[0]!, snapshot)).toMatchObject({ words: '60 of 50 words', over: ['60 words is over the 50-word limit'], blocked: true });
    expect(reviewSection(base()[2]!, snapshot).words).toBe('4 words · No limit stated');
    expect(applyEdit(edited, 's2', 'We pay therapists.', snapshot)[1]).toMatchObject({ status: 'ok', reasons: [] });
  });

  it('DOCX: refused unless approved; header on every page, sections under the funder headings, Sources and Assumptions appendices', async () => {
    const now = new Date('2026-10-16T00:00:00Z'); expect(() => applicationPacket(app('DRAFT'), now)).toThrow(NOT_APPROVED_EXPORT);
    const withAssumption = base().map((x, i) => (i === 2 ? { ...x, assumptions: ['A partner clinic hosts sessions.'] } : x));
    const p = applicationPacket(app('approved', withAssumption), now);
    expect(p.sections.map((x) => x.title)).toEqual(['Need for the project', 'Approach', 'Budget', 'Sources', 'Assumptions']);
    expect(p.sections[3]!.figures).toEqual([{ label: 'Uninsured rate, county FIPS 49035, 2023', value: `id public_indicator:${IND}`, kind: 'value', sourceLabel: 'census-sahie 2023', asOf: 'Oct 2026' }]);
    expect([p.sections[4]!.paragraphs, assertPacket(p)]).toEqual([['Budget: A partner clinic hosts sessions.'], []]);
    const files = unzipSync(await packetToDocx(p)), xml = (f: string) => strFromU8(files[f]!);
    expect(Object.keys(files).filter((f) => /word\/header\d\.xml/.test(f)).map(xml).join()).toContain(HEADER);
    for (const t of ['Need for the project', 'Sources', 'Assumptions', `id public_indicator:${IND}`, 'census-sahie 2023']) expect(xml('word/document.xml')).toContain(t);
  });
});
