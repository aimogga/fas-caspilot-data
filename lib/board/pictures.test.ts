import { describe, expect, it } from 'vitest';
import type { DashboardMetrics } from '@/lib/dashboard/metrics-query';
import { boardPictures, points, rankHeadline } from './pictures';
const w = <T>(v: T, n: number) => ({ n, rows: n, viewRows: n, asOf: 'Jul 2026', delta: null, ...v });
const band = (band: string, completed: number | null, closed: number | null, rate: number | null, suppressed = false, complementary = false) => ({ band, completed, closed, rate, suppressed, complementary });
const m4 = w({ rows: [band('Under $30k', 18, 20, 0.9), band('$30k–$60k', null, null, null, true), band('Unknown', null, null, null, true, true)], total: band('total', 25, 29, 0.8621), includesHiddenBands: true }, 29);
const m6 = w({ affiliatedShare: 0.59, groups: [{ group: 'affiliated' as const, episodes: 17, dollars: 20000, avgRatePerUnit: 120 }, { group: 'other' as const, episodes: 12, dollars: 14000, avgRatePerUnit: 90 }] }, 29);
const o1 = w({ measures: [
  { code: 'PHQ-9', label: 'PHQ-9', direction: 'lower_is_better' as const, n: 12, meanChange: -1.5, shareImproved: 0.75, improved: 9, unchanged: 2, worsened: 1, suppressed: false },
  { code: 'GAD-7', label: 'GAD-7', direction: 'lower_is_better' as const, n: 3, meanChange: null, shareImproved: null, improved: 2, unchanged: 1, worsened: 0, suppressed: true },
  { code: 'PSC-17', label: 'PSC-17', direction: 'lower_is_better' as const, n: 0, meanChange: null, shareImproved: null, improved: 0, unchanged: 0, worsened: 0, suppressed: true }] }, 15);
const trend = [{ period: '2025-Q4', median: 34 }, { period: '2026-Q1', median: null }, { period: '2026-Q2', median: 27 }, { period: '2026-Q3', median: 23 }];
const all = { m1: w({ median: 23, p25: 10, p75: 40, stillWaitingShare: null }, 12), m2: { error: true }, m3: { error: true }, m5: { error: true }, m4, m6, o1, trend, filtered: false } as unknown as DashboardMetrics;
describe('board pictures (F-402)', () => {
  it('keeps hidden values null (never zero) and carries the reason as a note', () => {
    expect(points.wait(trend)).toEqual([{ label: 'Q4 ’25', value: 34 }, { label: 'Q1 ’26', value: null }, { label: 'Q2 ’26', value: 27 }, { label: 'Q3 ’26', value: 23 }]);
    expect(points.completion(m4)).toEqual([{ label: 'Under $30k', value: 90 }, { label: '$30k–$60k', value: null, note: 'Fewer than 11 cases' }, { label: 'Unknown', value: null, note: 'Hidden to protect another band' }]);
    expect(points.dollars(m6)).toEqual([{ label: 'Affiliated providers', value: 59 }, { label: 'Other providers', value: 41 }]);
    expect(points.dollars({ ...m6, affiliatedShare: null })).toEqual([{ label: 'Affiliated providers', value: null }, { label: 'Other providers', value: null }]);
    expect(points.outcomes(o1)).toEqual([{ label: 'PHQ-9', value: 75 }, { label: 'GAD-7', value: null, note: 'Fewer than 11 families' }]);
  });
  it('writes rank-first headlines in words, with the hidden count', () => {
    expect(rankHeadline(points.completion(m4), 'finished therapy most often', 'band')).toBe('Under $30k finished therapy most often (90%). 2 of 3 bands hidden to protect privacy.');
    expect(rankHeadline(points.dollars(m6), 'received the larger share of therapy dollars', 'group')).toBe('Affiliated providers received the larger share of therapy dollars (59%), then Other providers (41%).');
    expect(rankHeadline([{ label: 'A', value: null }], 'x', 'band')).toBe('All 1 bands are hidden to protect privacy.');
  });
  it('builds the four pictures in reading order with the all-bands reference and source footers', () => {
    const p = boardPictures(all);
    expect(p.map((x) => [x.id, x.kind, x.n, x.asOf])).toEqual([['wait', 'line', 12, 'Jul 2026'], ['completion', 'bar', 29, 'Jul 2026'], ['dollars', 'bar', 29, 'Jul 2026'], ['outcomes', 'bar', 15, 'Jul 2026']]);
    expect(p[1]?.reference).toEqual({ value: 86, label: 'All bands' });
    expect(p.slice(1).map((x) => [x.unit, x.include])).toEqual([['%', [100]], ['%', [100]], ['%', [100]]]);
    expect(p.every((x) => x.points.every((pt) => pt.value !== 0 || pt.label))).toBe(true);
  });
  it('drops a picture when its metric failed, is empty or has no scored measure; null metrics give none', () => {
    expect(boardPictures(null)).toEqual([]);
    const ids = boardPictures({ ...all, m1: { error: true }, m4: { ...m4, total: null, n: 0 }, o1: w({ measures: [{ ...o1.measures[2]! }] }, 0) }).map((x) => x.id);
    expect(ids).toEqual(['dollars']);
    expect(boardPictures({ ...all, m4: w({ ...m4, total: null }, 29) })[1]?.reference).toBeUndefined();
    expect(boardPictures({ ...all, trend: [trend[3]!] }).map((x) => x.id)).toEqual(['completion', 'dollars', 'outcomes']);
  });
});
