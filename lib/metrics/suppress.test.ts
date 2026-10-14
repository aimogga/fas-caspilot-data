import { describe, expect, it } from 'vitest';
import { suppressCount, suppressRate, suppressTable, THRESHOLD } from './suppress';

const bands = (...closed: number[]) => closed.map((n, i) => ({ band: 'abc'[i]!, closed: n, rate: 0.5 }));

describe('unit: suppression edge cases', () => {
  it('hides counts below 11 (0 and 10), shows 11', () => {
    expect(THRESHOLD).toBe(11);
    expect([suppressCount(10), suppressCount(0), suppressCount(11)]).toEqual([
      { value: null, suppressed: true }, { value: null, suppressed: true }, { value: 11, suppressed: false }]);
  });
  it('hides a rate when either side is below 11', () => {
    expect(suppressRate(10, 50)).toEqual({ value: null, suppressed: true });
    expect(suppressRate(50, 10)).toEqual({ value: null, suppressed: true });
    expect(suppressRate(11, 44)).toEqual({ value: 0.25, suppressed: false });
  });
  it('complementary: one hidden band with a shown total also hides the next-smallest band and its rate', () => {
    const out = suppressTable(bands(40, 8, 30), { countKeys: ['closed'], rateKeys: ['rate'], total: { band: 'total', closed: 78, rate: 0.5 } });
    expect(out.rows).toEqual([
      { band: 'a', closed: 40, rate: 0.5, suppressed: false, complementary: false },
      { band: 'b', closed: null, rate: null, suppressed: true, complementary: false },
      { band: 'c', closed: null, rate: null, suppressed: true, complementary: true }]);
    expect(out).toMatchObject({ totalShown: true, includesHiddenBands: true, total: { closed: 78 } });
  });
  it('two bands already hidden: no extra suppression', () => {
    const out = suppressTable(bands(40, 8, 3), { countKeys: ['closed'], total: { closed: 51 } });
    expect(out.rows.map((r) => [r.closed, r.complementary])).toEqual([[40, false], [null, false], [null, false]]);
  });
  it('no total (or a hidden total): no complementary suppression; nothing hidden when all bands are large', () => {
    expect(suppressTable(bands(40, 8, 30), { countKeys: ['closed'] }).rows.map((r) => r.closed)).toEqual([40, null, 30]);
    const small = suppressTable(bands(40, 8, 30), { countKeys: ['closed'], rateKeys: ['rate'], total: { closed: 10, rate: 1 } });
    expect(small.rows.map((r) => r.closed)).toEqual([40, null, 30]);
    expect(small).toMatchObject({ totalShown: false, total: { closed: null, rate: null } });
    expect(suppressTable(bands(11, 12, 13), { countKeys: ['closed'], total: { closed: 36 } })).toMatchObject({ includesHiddenBands: false, totalShown: true });
  });
});
