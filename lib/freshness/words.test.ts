import { describe, expect, it } from 'vitest';
import type { FreshnessPageRow } from './query';
import { cadenceWords, footerWords, runWords, statusWords, summaryWords, vintageCard } from './words';

const row = (over: Partial<FreshnessPageRow>): FreshnessPageRow => ({
  name: 'census-sahie', owner: 'Census', paused: false, latestVintage: '2024', lastSuccess: 'Oct 12, 2026', cadence: 'Annual', cadenceRaw: 'annual',
  status: 'current', staleDays: null, run: null, ...over,
});
const run = { id: 'dddddddd-dddd-dddd-dddd-ddddddddddd3', status: 'failed', startedAt: '2026-10-12T08:00:00Z', finishedAt: '2026-10-12T08:01:00Z', rowsLoaded: 0 };

describe('DS-16a freshness words', () => {
  it('AC1: cadence words come from the stored word and the D-021 table; unknown or missing cadence names the yearly fallback', () => {
    expect(cadenceWords('monthly')).toEqual({ text: 'Monthly', hint: 'Monthly: a new load is expected every 31 days. The source counts as stale once its last good load is older than that.' });
    expect(cadenceWords(' Quarterly ').hint).toMatch(/^Quarterly: a new load is expected every 92 days/);
    expect(cadenceWords('weekly')).toEqual({ text: 'Weekly', hint: 'The source is recorded as "Weekly", which has no day count yet, so it counts as stale after the yearly cycle of 366 days.' });
    expect(cadenceWords(null)).toEqual({ text: 'Not recorded', hint: 'No cadence is recorded for this source, so it counts as stale after the yearly cycle of 366 days.' });
  });
  it('AC2: the vintage card words the value, the source in words, the as-of and the no-load reason', () => {
    expect(vintageCard(row({}))).toEqual({ text: 'Latest 2024', value: '2024', source: 'Census SAHIE', asOf: 'Oct 12, 2026', hidden: undefined });
    const none = vintageCard(row({ name: 'example-new-source', latestVintage: '—', lastSuccess: 'No load yet' }));
    expect(none).toMatchObject({ text: 'No load yet', value: 'No load yet', source: 'Example new source', asOf: undefined });
    expect(none.hidden).toMatch(/^Nothing from this source has been stored yet/);
  });
  it('AC3: the run cell words the date and status, and its card carries the full id, dates, status and rows loaded', () => {
    expect(runWords(null)).toEqual({ text: 'No load yet', rows: [] });
    expect(runWords(run)).toEqual({ text: 'Oct 12, 2026 · Failed', rows: [['Run id', run.id], ['Started', 'Oct 12, 2026'], ['Finished', 'Oct 12, 2026'], ['Status', 'Failed'], ['Rows loaded', '0']] });
    expect(runWords({ ...run, status: 'ok', finishedAt: null, rowsLoaded: null }).rows.slice(2)).toEqual([['Finished', 'Not finished'], ['Status', 'Succeeded'], ['Rows loaded', undefined]]);
  });
  it('AC4: status words are dated with one sentence each, and the summary counts every status in words', () => {
    expect(statusWords(row({}))).toEqual({ text: 'Current · loaded Oct 12, 2026', hint: 'The newest release is loaded. The last good load was Oct 12, 2026, inside the usual cycle of 366 days.' });
    expect(statusWords(row({ status: 'stale', staleDays: 60, cadenceRaw: 'monthly', lastSuccess: 'Aug 14, 2026' })))
      .toEqual({ text: 'Stale since Aug 14, 2026 · 60 days', hint: 'Overdue for a refresh: the last good load was Aug 14, 2026, 60 days ago, and this source usually updates every 31 days.' });
    expect(statusWords(row({ status: 'failed', run, lastSuccess: 'Oct 3, 2026' }))).toEqual({ text: 'Failed on Oct 12, 2026', hint: 'The last attempt on Oct 12, 2026 failed, so the last good load, Oct 3, 2026, is what the app shows.' });
    expect(statusWords(row({ status: 'failed' })).text).toBe('Failed');
    expect(statusWords(row({ status: 'not_published', lastSuccess: 'No load yet' })).text).toBe('Not published · no load yet');
    const rows = [row({ status: 'failed' }), row({ status: 'stale' }), row({ status: 'not_published' }), row({}), row({}), row({}), row({})];
    expect(summaryWords({ rows, aggregate: 'failed' })?.text).toBe('7 public sources: 1 failed, 1 stale, 1 with no load yet, 4 current.');
    expect(summaryWords({ rows: [row({})], aggregate: 'current' })?.text).toBe('1 public source: 1 current.');
    expect(summaryWords({ rows: [], aggregate: null })).toBeNull();
    expect(footerWords('Oct 12, 2026')).toBe('Public sources · as of Oct 12, 2026. A source is stale once its last good load is older than its usual cycle.');
    expect(footerWords(null)).toMatch(/^Public sources\. A source is stale/);
  });
});
