import { describe, expect, it } from 'vitest';
import { GLOSSARY } from '../trust/glossary';
import type { Column, CountyRow } from './query';
import { FAS_BADGE, NEED_TERMS, indicatorCell, moeWords, needTerm, scoreCell, splitMoe } from './terms';

const col: Column = { code: 'uninsured_rate', label: 'Uninsured rate', note: 'Census SAHIE 2024', unit: 'percent' };
const src = { code: 'uninsured_rate', name: 'Census SAHIE', vintage: '2024', asOf: 'Oct 2026' };
const row = (over: Partial<CountyRow> = {}): CountyRow => ({ fips: '49035', name: 'Salt Lake County', fas: true, rank: '1 of 26', score: '+1.74', bin: '5 of 5', status: 'Ranked', value: 1.74, binNo: 5,
  cells: { uninsured_rate: '9.2% ± 0.5', poverty_count: 'Not published' }, values: { uninsured_rate: 9.2, poverty_count: null }, ...over });

describe('DS-11a need-map terms', () => {
  it('every term has a title and at most two plain sentences of 220 characters, with no source code or product name', () => {
    for (const [id, t] of Object.entries(NEED_TERMS)) {
      expect([t.id, t.title.length > 0, t.plain.length > 0 && t.plain.length <= 220], id).toEqual([id, true, true]);
      expect(t.plain.split(/(?<=[.!?])\s+/).length, `${id} has more than 2 sentences`).toBeLessThanOrEqual(2);
      expect(t.plain, id).not.toMatch(/\bSAHIE\b|\bSAIPE\b|\bACS\b|\bMOE\b|\bFIPS\b|\bpct\b|CasePilot|N\/A/);
    }
  });
  it('needTerm finds need-map terms, falls back to the core glossary, and titles an unknown indicator with its column label', () => {
    expect([needTerm('ind:poverty_rate').title, needTerm('rank'), needTerm('ind:court_filings', 'Court filings').title]).toEqual(['Poverty rate', GLOSSARY.rank, 'Court filings']);
    expect(needTerm('ind:court_filings').title).toBe('court filings');
  });
  it('splits a margin of error and writes it in words', () => {
    expect([splitMoe('9.2% ± 0.5'), splitMoe('95,000 people')]).toEqual([{ value: '9.2%', moe: '0.5' }, { value: '95,000 people', moe: null }]);
    expect(moeWords('0.5')).toBe('Margin of error ± 0.5. The true value is likely within this much of the number shown, either way.');
  });
  it('cell data carries the term, value, source, as-of and the hidden reason only when hidden', () => {
    expect(indicatorCell(row(), col, src)).toEqual({ 'data-term': 'ind:uninsured_rate', 'data-value': '9.2% (margin of error ± 0.5)', 'data-source': 'Census SAHIE 2024', 'data-asof': 'Oct 2026', 'data-hidden': undefined });
    const np = indicatorCell(row(), { ...col, code: 'poverty_count', note: 'Census SAIPE 2023' });
    expect([np['data-value'], np['data-hidden'], indicatorCell(row(), { ...col, code: 'missing' })['data-hidden']]).toEqual(['Not published', 'The source did not publish this for this county in that release.', 'This number appears once the data behind it is set up.']);
    expect(scoreCell('rank', row(), 'v2')).toEqual({ 'data-term': 'rank', 'data-value': '1 of 26', 'data-source': 'Need score version v2', 'data-hidden': undefined });
    const unscored = scoreCell('need_score', row({ score: 'Not published' }), null);
    expect([unscored['data-source'], unscored['data-hidden']?.startsWith('The source did not publish')]).toEqual([undefined, true]);
    expect([scoreCell('status', row({ status: 'Not published' }), 'v2')['data-hidden'], FAS_BADGE['data-term']]).toEqual([undefined, 'fas_county']);
  });
});
