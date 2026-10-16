import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { LlmError, type generateJson, type LlmMeta } from '../llm';
import { buildItems, buildReport, CALL_CAP, leader, markdown, outputs, runBakeoff, scoreRun, SPACING_MS, type EvalItem, type ProviderSummary } from './bakeoff';
import type { DraftResult } from './generate';
import type { StrategyDraft } from './schema';
import type { Snapshot } from './snapshot';

// The adapter is mocked: no real API is called and no key is read beyond the fake env below.
const items = buildItems(JSON.parse(readFileSync('tests/eval/llm/opportunities.json', 'utf8')));
const ENV = { GEMINI_API_KEY: 'fake', OPENROUTER_API_KEY: 'fake' };
const meta = (provider: 'gemini' | 'openrouter'): LlmMeta => ({ provider, model: 'm', attempts: 1, input_tokens: 100, output_tokens: 40, latency_ms: 7 });
const ind = (s: Snapshot) => s.facts.find((f) => f.citation_id.startsWith('public_indicator:'))!;
/** A draft citing one stored indicator value; `wrong` swaps in a number that resolves to nothing. */
const draftFor = (s: Snapshot, wrong = false): StrategyDraft => ({
  opportunity_id: s.opportunity_id, status: 'DRAFT',
  criteria_map: [{ criterion: 'Need', fas_position: 'Need is documented.', gaps: [], confidence: 'medium',
    evidence: [{ claim: `Poverty rate ${wrong ? 99 : ind(s).values.value}% in the service county.`, citation_id: ind(s).citation_id }] }],
  suggested_ask: null, risks: ['Utah share is low.'], narrative_outline: ['Need'], inferences: ['Inference: rural reach matters here.', 'not labelled'],
});
type Opts = { forceProvider?: 'gemini' | 'openrouter' };
const mockGen = (answer: (snap: Snapshot, opts: Opts) => StrategyDraft | Error = (s) => draftFor(s)) => vi.fn(async (input: { prompt: string }, opts: Opts = {}) => {
  const id = /"opportunity_id":"([^"]+)"/.exec(input.prompt)![1], snap = items.find((i) => i.snapshot.opportunity_id === id)!.snapshot;
  const out = answer(snap, opts);
  if (out instanceof Error) throw out;
  return { data: out, meta: meta(opts.forceProvider!) };
}) as unknown as typeof generateJson & ReturnType<typeof vi.fn>;
const fakeTime = () => {
  let now = 0;
  return { clock: () => now, sleep: vi.fn(async (ms: number) => { now += ms; }), tick: (ms: number) => { now += ms; } };
};

describe('bake-off fixture (F-508i)', () => {
  it('has 5 public opportunities, 3 federal and 2 Utah or foundation, each with source URL, fetch date and a private snapshot', () => {
    expect(items).toHaveLength(5);
    expect(items.filter((i) => i.kind === 'federal')).toHaveLength(3);
    expect(items.filter((i) => i.kind !== 'federal')).toHaveLength(2);
    for (const i of items) {
      expect(i.source_url).toMatch(/^https:\/\//);
      expect(i.fetched_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(i.snapshot.facts.some((f) => f.citation_id.startsWith('opportunity_criteria:'))).toBe(true);
      expect(i.snapshot.facts.some((f) => f.citation_id.startsWith('metric:'))).toBe(true);
    }
  });
});

describe('runBakeoff (F-508i)', () => {
  it('runs every opportunity once per provider, forced, sequentially, at most one call every 4 s', async () => {
    const gen = mockGen(), t = fakeTime();
    const runs = await runBakeoff(items, { generate: gen, env: ENV, ...t });
    expect(runs.map((r) => `${r.provider}:${r.skipped}`)).toEqual([...Array(5).fill('gemini:false'), ...Array(5).fill('openrouter:false')]);
    expect(gen.mock.calls.map(([, o]) => o.forceProvider)).toEqual([...Array(5).fill('gemini'), ...Array(5).fill('openrouter')]);
    expect(t.sleep).toHaveBeenCalledTimes(9);
    expect(t.sleep.mock.calls.every(([ms]) => ms === SPACING_MS)).toBe(true);
  });

  it('caps total calls at 20 even when every draft needs a second round, and skips the rest as call_cap', async () => {
    const gen = mockGen((s) => draftFor(s, true)), t = fakeTime();
    const runs = await runBakeoff(items, { generate: gen, env: ENV, ...t, cap: 6 });
    expect(gen).toHaveBeenCalledTimes(6);
    expect(runs.filter((r) => r.skipped).map((r) => r.skipped && r.reason)).toEqual(Array(7).fill('call_cap'));
    const full = await runBakeoff(items, { generate: mockGen((s) => draftFor(s, true)), env: ENV, ...fakeTime() });
    expect(full.every((r) => !r.skipped && r.status === 'failed')).toBe(true); // 5 x 2 rounds x 2 providers fits the cap exactly
    expect(CALL_CAP).toBe(20);
  });

  it('skips a provider with a missing key without calling it, and stops a provider on a quota answer', async () => {
    const gen = mockGen((s, o) => (o.forceProvider === 'gemini' && s === items[1]!.snapshot ? new LlmError([{ provider: 'gemini', status: 429 }]) : draftFor(s)));
    const runs = await runBakeoff(items, { generate: gen, env: { GEMINI_API_KEY: 'fake' }, ...fakeTime() });
    expect(runs.map((r) => (r.skipped ? r.reason : 'ran'))).toEqual(['ran', 'quota', 'quota', 'quota', 'quota', ...Array(5).fill('missing_key')]);
    expect(gen.mock.calls.every(([, o]) => o.forceProvider === 'gemini')).toBe(true);
  });

  it('an OpenRouter guard refusal stops that provider like a quota answer', async () => {
    const gen = mockGen((s, o) => (o.forceProvider === 'openrouter' ? new LlmError([{ provider: 'openrouter', status: 'openrouter_quota_exhausted' }]) : draftFor(s)));
    const runs = await runBakeoff(items, { generate: gen, env: ENV, ...fakeTime() });
    expect(runs.slice(5).map((r) => (r.skipped ? r.reason : 'ran'))).toEqual(Array(5).fill('quota'));
    expect(gen.mock.calls.filter(([, o]) => o.forceProvider === 'openrouter')).toHaveLength(1);
  });
});

describe('scoring and report (F-508i)', () => {
  const s = items[0]!.snapshot;
  const result = (output: StrategyDraft | null, report: DraftResult['citation_report']): DraftResult => ({ status: 'DRAFT', output, citation_report: report, model_meta: [meta('gemini'), meta('gemini')] });

  it('citation accuracy = numbers resolving / numbers present; copy hits, inferences, latency and tokens', () => {
    const claims = [
      { path: 'a', text: '', citation_ids: [], numbers: [1, 2, 3], problems: ['3 has no matching cited value'] },
      { path: 'b', text: '', citation_ids: [], numbers: [4], problems: ['x is not in the snapshot', '4 has no matching cited value'] },
    ];
    const d = draftFor(s);
    d.criteria_map[0]!.fas_position = 'Inference: demand is rising.';
    const sc = scoreRun(result(d, { ok: false, claims, copied: [{ path: 'r', citation_id: 'c', words: 'w' }], rounds: 2 }));
    expect(sc).toMatchObject({ schema_valid: true, numbers_present: 4, numbers_resolving: 2, citation_accuracy: 0.5, copy_hits: 1,
      inferences_separated: 1, inferences_misplaced: 1, latency_ms: 14, input_tokens: 200, output_tokens: 80, rounds: 2 });
    expect(scoreRun(result(null, { ok: false, claims: [], copied: [] }))).toMatchObject({ schema_valid: false, citation_accuracy: null });
  });

  it('the leader is the higher citation accuracy; a tie or no data goes to the rubric', () => {
    const sum = (citation_accuracy: number | null) => ({ citation_accuracy }) as ProviderSummary;
    expect(leader({ gemini: sum(0.9), openrouter: sum(0.8) })).toBe('gemini');
    expect(leader({ gemini: sum(0.7), openrouter: sum(0.8) })).toBe('openrouter');
    expect(leader({ gemini: sum(0.8), openrouter: sum(0.8) })).toBeNull();
    expect(leader({ gemini: sum(null), openrouter: sum(0.8) })).toBeNull();
  });

  it('writes the JSON report, a markdown table per provider and one draft file per completed run', async () => {
    const gen = mockGen((snap, o) => draftFor(snap, o.forceProvider === 'openrouter' && snap === items[0]!.snapshot));
    const runs = await runBakeoff(items, { generate: gen, env: { ...ENV }, ...fakeTime() });
    const r = buildReport(runs, items as EvalItem[], '2026-10-16');
    expect(r).toMatchObject({ feature: 'F-508i', call_cap: 20, spacing_ms: 4000, automatic_leader: 'gemini', providers: { gemini: { runs: 5, citation_accuracy: 1, drafts_ok: 5 } } });
    expect(r.providers.openrouter).toMatchObject({ runs: 5, drafts_ok: 4, numbers_present: 5, numbers_resolving: 4 }); // the failed run is scored on its final round;
    expect(r.opportunities[0]).toEqual({ key: items[0]!.key, kind: 'federal', source_url: items[0]!.source_url, fetched_at: items[0]!.fetched_at });
    expect(r.runs[0]).toMatchObject({ draft: `llm-bakeoff-2026-10-16/gemini-${items[0]!.key}.json` });
    const md = markdown(r);
    expect(md).toContain('| gemini | 5 | 0 | 5/5 | 5 | 100.0% (5/5) |');
    expect(md).toContain('| openrouter | 5 | 0 | 5/5 | 4 | 80.0% (4/5) |');
    expect(md).toContain('Automatic leader: gemini');
    const files = outputs(r, runs).map((f) => f.path);
    expect(files.slice(0, 2)).toEqual(['llm-bakeoff-2026-10-16.json', 'llm-bakeoff-2026-10-16.md']);
    expect(files).toHaveLength(12);
  });
});
