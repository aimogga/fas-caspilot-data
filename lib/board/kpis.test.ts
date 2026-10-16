import { describe, expect, it } from 'vitest';
import type { DashboardMetrics } from '@/lib/dashboard/metrics-query';
import { quarterWords } from '@/lib/dashboard/format';
import { boardKpis, compareHint, compareWords } from './kpis';
const w = <T>(v: T, n: number, delta: string | null = null) => ({ n, rows: n, viewRows: n, asOf: 'Sep 2026', delta, ...v });
const metrics = (m1: object, m4: object, m5: object) => ({ m1, m4, m5, trend: [], trends: {}, filtered: false }) as unknown as DashboardMetrics;
const x = metrics(w({ median: 23 }, 64, '↓ 4 days faster than Q2'), w({ total: { completed: 65, closed: 92, rate: 0.7065 }, includesHiddenBands: true }, 92, '↑ 3 pts higher than Q2'), w({ costPerCompleted: 1840 }, 33, 'No change from Q2'));

describe('board KPI row (DS-13a)', () => {
  it('quarterWords names the quarter in months and a year, with an en dash; invalid input passes through', () => {
    expect([quarterWords('2026-Q3'), quarterWords('2026-Q1'), quarterWords('2025-Q4'), quarterWords('latest')]).toEqual(['July–September 2026', 'January–March 2026', 'October–December 2025', 'latest']);
  });
  it('words the three KPIs from stored values: median wait with its comparison, "65 of 92 who closed", cost per completed course', () => {
    const [m1, m4, m5] = boardKpis(x, '2026-Q3');
    expect(m1).toMatchObject({ state: 'value', label: 'Wait for a first session', value: '23', unit: 'days', detail: 'Median of 64 families: half waited less, half waited more', compare: '↓ 4 days faster than April–June 2026', n: 64, asOf: 'Sep 2026' });
    expect(m1?.valueText).toBe('23 days median wait from court order to first session, July–September 2026');
    expect(m4).toMatchObject({ state: 'value', value: '71%', unit: '%', detail: '65 of 92 who closed', compare: '↑ 3 points higher than April–June 2026', title: 'Completion rate by income band' });
    expect(m5).toMatchObject({ state: 'value', value: '$1,840', detail: 'Average across 33 completed courses', compare: 'Same as April–June 2026', n: 33 });
    expect(m5?.compareHint).toBe('April–June 2026 is the quarter before this one. The dollar figure is an average, so one costly course can move it.');
    expect(compareHint('m1', '↓ 4 days faster than Q2', '2026-Q2')).toBe('April–June 2026 is the quarter before this one. Lower is better for this number.');
    expect(compareHint('m4', null, '2026-Q2')).toMatch(/There is no number to compare with/);
    expect(compareWords(null, '2026-Q2')).toBe('Nothing to compare with April–June 2026');
  });
  it('states: failed view → error, no data → not available, n = 0 → words, 1 ≤ n < 11 → suppressed; nothing shown as a zero', () => {
    const y = metrics({ error: true }, w({ total: null, includesHiddenBands: true }, 7), w({ costPerCompleted: null }, 0));
    expect(boardKpis(y, '2026-Q3').map((k) => [k.state, k.value, k.detail, k.compare])).toEqual([['error', null, null, null], ['suppressed', null, null, null], ['no-data', null, null, null]]);
    expect(boardKpis(null, '2026-Q3').map((k) => [k.state, k.asOf, k.n])).toEqual([['not-available', 'Not available yet', 0], ['not-available', 'Not available yet', 0], ['not-available', 'Not available yet', 0]]);
    expect(boardKpis(y, '2026-Q3')[2]?.noData).toBe('No course of therapy was completed this quarter');
    for (const k of boardKpis(y, '2026-Q3')) expect(JSON.stringify(k)).not.toMatch(/"value":"0|\$0\b|NaN|undefined/);
  });
});
