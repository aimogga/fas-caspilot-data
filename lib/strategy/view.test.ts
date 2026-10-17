import { describe, expect, it } from 'vitest';
import { RESOLVERS } from './citations';
import { fakeGenerate } from './fake';
import { generateDraft } from './generate';
import { citationFace, factValue, footerWords, reportLines, toView } from './view';
import type { Snapshot } from './snapshot';

// Synthetic only; the fake adapter parses the prompt and makes no network call.
const OPP = '10101010-1010-1010-1010-101010101012';
const snap: Snapshot = {
  opportunity_id: OPP, built_at: '2026-10-16T00:00:00Z', abstracts: [],
  facts: [
    { citation_id: `opportunity:${OPP}`, label: 'Family Therapy Access Grants (synthetic)', values: { award_floor: 50000, award_ceiling: 200000 } },
    { citation_id: 'public_indicator:40404040-4040-4040-4040-404040404040', label: 'Uninsured rate, county FIPS 49035, 2023', values: { value: 12.4, moe: null }, source: { source_id: 'census-sahie', vintage: '2023' } },
    { citation_id: 'metric:m3:2026-Q3', label: 'FAS share who never started, 2026-Q3', values: { value: null, n: null } },
  ],
};

describe('strategy draft screen helpers (F-508f)', () => {
  it('the e2e fake adapter yields a draft that passes the citation validator', async () => {
    const r = await generateDraft(snap, fakeGenerate);
    expect(r).toMatchObject({ status: 'DRAFT', citation_report: { ok: true }, model_meta: [{ model: 'e2e-fake' }] });
    expect(r.output?.suggested_ask).toEqual({ low: 50000, high: 200000, basis_citation_ids: [`opportunity:${OPP}`] });
  });

  it('a citation chip shows the source, as-of and value from the stored snapshot row', () => {
    expect(citationFace(snap.facts[1]!, snap.built_at)).toMatchObject({ word: 'County data', source: 'census-sahie', asOf: '2023', value: 'value 12.4', term: { title: 'Uninsured rate, county FIPS 49035, 2023' } });
    expect(citationFace(snap.facts[0]!, snap.built_at)).toMatchObject({ word: 'Opportunity', asOf: 'Oct 2026', value: 'award floor $50,000 · award ceiling $200,000' });
    expect([factValue(snap.facts[2]!), factValue({ citation_id: 'award_history_summary:x', label: 'x', values: { count: 12, median: 150000, utah_share: 0.25 } })]).toEqual(['Hidden: fewer than 11 families or not published', 'count 12 · median $150,000 · utah share 25%']);
  });

  it('every registered citation kind has its own chip word, never the generic Source', () => {
    for (const kind of RESOLVERS.keys()) expect(citationFace({ citation_id: `${kind}:x`, label: 'l', values: {} }, snap.built_at).word).not.toBe('Source');
  });

  it('a failed draft is never usable and its report reads in plain words', () => {
    const report = { ok: false, rounds: 2, copied: [{ path: 'risks[0]', citation_id: 'award_history:a', words: 'x' }], claims: [
      { path: 'criteria_map[0].evidence[1].claim', text: 't', citation_ids: [], numbers: [99], problems: ['99 has no matching cited value', 'public_indicator:z is not in the snapshot'] },
      { path: 'suggested_ask', text: 't', citation_ids: [], numbers: [], problems: ['award_history_summary:q does not resolve'] }] };
    const v = toView({ status: 'failed', output: { status: 'DRAFT' }, snapshot: snap, citation_report: report });
    expect(v).toEqual({ kind: 'failed', lines: [
      'Criterion 1, evidence 2: the number 99 does not match any source it cites.',
      'Criterion 1, evidence 2: it cites public_indicator:z, which was not in the data the draft was given.',
      'Suggested ask: it cites award_history_summary:q, which could not be traced to a stored row.',
      "risks 1: copies 12 or more words in a row from another organization's award description.",
      'Tried 2 times.',
    ] });
    expect(reportLines({ ok: false, claims: [], copied: [], rounds: 2, error: [{ provider: 'gemini', status: 429 }, { provider: 'openrouter', status: 'missing_key' }] }))
      .toEqual(['The drafting service did not answer (gemini: 429, openrouter: missing_key).', 'Tried 2 times.']);
    expect(toView({ status: 'DRAFT', output: {}, snapshot: {}, citation_report: {} })).toEqual({ kind: 'unreadable' });
  });

  it('footer names the model, the generation date and who approved', () => {
    const base = { model_meta: [{ provider: 'gemini', model: 'gemini-2.5-flash' }], created_at: '2026-10-16T18:00:00Z', status: 'approved' as const, approved_by: 'u1', approved_at: '2026-10-17T18:00:00Z' };
    expect(footerWords(base, 'u1')).toEqual({ model: 'Google Gemini · gemini-2.5-flash', generated: 'Generated Oct 16, 2026', review: 'Approved by you on Oct 17, 2026' });
    expect(footerWords({ ...base, approved_by: 'u2' }, 'u1').review).toBe('Approved by an admin on Oct 17, 2026'); expect(footerWords({ ...base, status: 'failed' }, 'u1').review).toBe('Failed drafts cannot be reviewed');
    expect(footerWords({ ...base, model_meta: null, status: 'DRAFT', approved_by: null, approved_at: null }, 'u1')).toMatchObject({ model: 'Model not recorded', review: 'Not reviewed yet: an admin approves or rejects' });
  });
});
