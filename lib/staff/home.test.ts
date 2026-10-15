import { describe, expect, it } from 'vitest';
import type { DashboardMetrics } from '@/lib/dashboard/metrics-query';
import { points, StaffHome } from './home';
const w = <T>(v: T, n: number, delta: string | null = null) => ({ n, rows: n, viewRows: n, asOf: 'Jul 2026', delta, ...v });
const q = (vals: (number | null)[]) => ['2025-Q4', '2026-Q1', '2026-Q2', '2026-Q3'].map((period, i) => ({ period, value: vals[i] ?? null }));
const x = {
  m1: w({ median: 23 }, 12, '↓ 4 days faster than Q2'), m2: w({ median: null }, 4), m3: { error: true }, m5: w({ costPerCompleted: 1840 }, 12),
  trends: { m1: q([34, null, 27, 23]), m2: q([null, null, null, null]), m3: q([0.2, 0.18, 0.2, 0.15]), m5: q([1700, 1800, 1900, 1840]) }, trend: [], filtered: false,
} as unknown as DashboardMetrics;
describe('StaffHome', () => {
  it('turns trend values into quarter points, shares in whole percent, hidden stays null', () => {
    expect(points(q([34, null]), ' days')).toEqual([{ label: 'Q4 ’25', value: 34 }, { label: 'Q1 ’26', value: null }, { label: 'Q2 ’26', value: null }, { label: 'Q3 ’26', value: null }]);
    expect(points(q([0.2, 0.18]), '%').slice(0, 2).map((p) => p.value)).toEqual([20, 18]);
  });
  it('builds four tiles: formatted value, delta, points, n and as-of; suppressed → null value; failed → error; none → empty', () => {
    const t = StaffHome.tiles(x);
    expect(t.map((a) => [a.id, a.value, a.delta, a.n, a.error])).toEqual([
      ['m1', '23 days', '↓ 4 days faster than Q2', 12, false], ['m2', null, null, 4, false], ['m3', null, null, 0, true], ['m5', '$1,840', null, 12, false]]);
    expect(t[0]?.points.map((p) => p.value)).toEqual([34, null, 27, 23]);
    expect(t[2]?.points.map((p) => p.value)).toEqual([20, 18, 20, 15]);
    expect(t.every((a) => a.goodWhen === 'down' && a.href === '/dashboard')).toBe(true);
    expect(StaffHome.tiles(null).map((a) => [a.value, a.points, a.asOf, a.error])).toEqual(Array(4).fill([null, [], 'Not available yet', false]));
  });
});
