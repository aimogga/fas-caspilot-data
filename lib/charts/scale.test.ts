import { describe, expect, it } from 'vitest';
import { barSummary, compact, direction, fmt, linear, lineRuns, lineSummary, niceStep } from './scale';

describe('niceStep', () => {
  it('picks 1-2-5 steps', () => { expect(niceStep(10)).toBe(5); expect(niceStep(100, 4)).toBe(50); expect(niceStep(7, 4)).toBe(2); expect(niceStep(0)).toBe(1); });
});
describe('linear', () => {
  it('pads to nice ticks and maps onto the size', () => {
    const s = linear([3, 17, null], 100, { floor: 0 });
    expect(s.lo).toBe(0); expect(s.hi).toBe(20); expect(s.ticks).toEqual([0, 5, 10, 15, 20]); expect(s.at(10)).toBe(50);
  });
  it('handles a flat series and includes reference values', () => {
    const flat = linear([5, 5], 10); expect(flat.hi).toBeGreaterThan(flat.lo);
    expect(linear([30, 31], 10, { include: [21] }).lo).toBeLessThanOrEqual(21);
  });
  it('survives all-null input', () => { expect(linear([null, null], 10).ticks.length).toBeGreaterThan(1); });
});
describe('formatting', () => {
  it('compacts and keeps the true minus', () => {
    expect(compact(1284)).toBe('1.3K'); expect(compact(12900)).toBe('13K'); expect(compact(4_200_000)).toBe('4.2M'); expect(compact(950)).toBe('950'); expect(compact(-2500)).toBe('−2.5K');
    expect(fmt(-3)).toBe('−3'); expect(fmt(null)).toBe('Hidden'); expect(fmt(96, ' days')).toBe('96 days');
  });
});
describe('summaries', () => {
  const pts = [{ label: 'Utah', value: 31 }, { label: 'Salt Lake', value: 22 }, { label: 'Weber', value: 12 }, { label: 'Carbon', value: 11 }, { label: 'Other', value: null }];
  it('ranks bars in words and counts hidden groups', () => {
    expect(barSummary(pts, 'families')).toBe('Utah has the most families (31), then Salt Lake (22) and Weber (12). 1 of 5 groups hidden because the count is under 11.');
    expect(barSummary([{ label: 'A', value: null }], 'families')).toBe('All 1 families are hidden to protect privacy');
  });
  it('describes a line with direction words', () => {
    const q = ['Q3 24', 'Q4 24', 'Q1 25', 'Q2 25', 'Q3 25'].map((label, i) => ({ label, value: [34, 31, null, 27, 23][i] as number | null }));
    expect(lineSummary(q, 'Days to first session', ' days')).toBe('Days to first session fell from 34 days to 23 days over 5 periods (Q3 24 to Q3 25)');
    expect(lineSummary(q.slice(0, 1), 'x')).toMatch(/Not enough/);
    expect(lineSummary([{ label: 'a', value: 2 }, { label: 'b', value: 2 }], 'Rate')).toMatch(/unchanged at 2/);
  });
  it('judges direction by what counts as good', () => {
    expect(direction(23, 27, 'down')).toBe('better'); expect(direction(23, 27, 'up')).toBe('worse'); expect(direction(5, 5, 'up')).toBe('same'); expect(direction(null, 5, 'up')).toBeNull();
  });
});
describe('lineRuns', () => {
  it('breaks the polyline at hidden points', () => {
    const runs = lineRuns([{ label: 'a', value: 1 }, { label: 'b', value: null }, { label: 'c', value: 3 }, { label: 'd', value: 4 }], (i) => i * 10, (v) => v);
    expect(runs).toEqual([['0.0,1.0'], ['20.0,3.0', '30.0,4.0']]);
  });
});
