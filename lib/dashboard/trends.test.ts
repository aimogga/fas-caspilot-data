import { describe, expect, it } from 'vitest';
import type { DashboardMetrics } from './metrics-query';
import { dashboardTrends } from './trends';
const w = <T>(v: T, n: number) => ({ n, rows: n, viewRows: n, asOf: 'Jul 2026', delta: null, ...v });
const q = (vals: (number | null)[]) => ['2025-Q4', '2026-Q1', '2026-Q2', '2026-Q3'].map((period, i) => ({ period, value: vals[i] ?? null }));
const x = {
  m1: w({ median: 23 }, 12), m2: w({ median: 9 }, 12), m3: w({ share: 0.15 }, 12), m5: w({ costPerCompleted: 1840 }, 12),
  trends: { m1: q([34, null, 27, 23]), m2: q([12, 10, null, 9]), m3: q([0.2, 0.18, 0.2, 0.15]), m5: q([1700, 1800, 1900, 1840]) }, trend: [], filtered: false,
} as unknown as DashboardMetrics;
describe('dashboardTrends', () => {
  it('builds M2, M3 and M5 pictures with quarter points, shares in whole percent, hidden stays null', () => {
    const t = dashboardTrends(x);
    expect(t.map((p) => [p.id, p.unit, p.n, p.asOf])).toEqual([['m2', ' days', 12, 'Jul 2026'], ['m3', '%', 12, 'Jul 2026'], ['m5', '$', 12, 'Jul 2026']]);
    expect(t[0]?.points).toEqual([{ label: 'Q4 ’25', value: 12 }, { label: 'Q1 ’26', value: 10 }, { label: 'Q2 ’26', value: null }, { label: 'Q3 ’26', value: 9 }]);
    expect(t[1]?.points.map((p) => p.value)).toEqual([20, 18, 20, 15]);
  });
  it('drops a picture whose metric failed, has n = 0 or has every quarter hidden; nothing without metrics', () => {
    const y = { ...x, m2: { error: true }, m3: w({ share: null }, 0), trends: { ...x.trends, m5: q([null, null, null, null]) } } as unknown as DashboardMetrics;
    expect(dashboardTrends(y)).toEqual([]);
    expect(dashboardTrends(null)).toEqual([]);
  });
});
