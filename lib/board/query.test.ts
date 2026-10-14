import { describe, expect, it } from 'vitest';
import { generate } from '@/lib/synthetic/generate';
import type { M2Row, O1Row } from '@/lib/dashboard/metrics-query';
import { boardAsOf, boardFilters, BoardQuery } from './query';
type Rec = Record<string, unknown>;
const s = (v: unknown) => (v == null ? null : String(v));
describe('BoardQuery (F-402)', () => {
  it('always uses the latest complete quarter, all counties, compare to prior', () => {
    expect(boardFilters(new Date('2026-10-14T03:00:00Z'))).toEqual({ period: '2026-Q3', county: 'all', referral: 'all', compare: 'prior' });
    expect(boardFilters(new Date('2026-01-02T00:00:00Z')).period).toBe('2025-Q4');
  });
  it('build reproduces the golden m2/o1 counts for 2024-Q3 (tests/golden/metrics.json rows span four quarters, so n < 11 and values hide) and picks the latest as-of', () => {
    const b = generate(20, 20);
    const m2: M2Row[] = b.application.map((a: Rec) => ({ application_id: String(a.id), case_id: String(a.case_id), application_date: s(a.application_date), decision_date: s(a.decision_date) }));
    const o1: O1Row[] = b.outcome_measure.map((o: Rec) => ({ measure_code: String(o.measure_code), baseline_score: o.baseline_score as number | null, followup_score: o.followup_score as number | null, followup_date: s(o.followup_date) }));
    const out = BoardQuery.build({ m1: null, m2, m3: null, eps: null, o1 }, new Date('2024-11-01T00:00:00Z'));
    expect(out.period).toBe('2024-Q3');
    expect(out.metrics.m2).toMatchObject({ rows: 7, n: 7, median: null, delta: null });
    expect(out.metrics.o1).toMatchObject({ rows: 2, n: 1 }); // 2 follow-ups dated in Q3; the engine drops one (null score or inactive instrument, F-305)
    expect([out.metrics.m1, out.asOf, out.freshness]).toEqual([{ error: true }, 'Dec 2024', null]);
  });
  it('as-of is the latest card month, or Not available yet when no card has a date', () => {
    const NA = 'Not available yet', w = (asOf: string) => ({ rows: 0, n: 0, asOf, delta: null });
    const x = (asOf: string[]) => ({ m1: w(asOf[0] ?? NA), m2: w(asOf[1] ?? NA), m3: { error: true }, m4: w(NA), m5: w(NA), m6: w(NA), o1: w(NA), trend: [], filtered: false });
    expect([boardAsOf(x(['Jul 2026', 'Dec 2025']) as never), boardAsOf(x(['Jan 2026', 'Mar 2026']) as never), boardAsOf(x([]) as never)]).toEqual(['Jul 2026', 'Mar 2026', 'Not available yet']);
  });
  it('load runs the metric views and the freshness query together and survives a freshness failure', async () => {
    const calls: string[] = [];
    const chain = (table: string) => {
      const c: Record<string, unknown> = { then: (res: (v: unknown) => void) => res(table === 'geo_county' ? { data: null, error: { message: 'boom' } } : { data: [], error: null }) };
      for (const k of ['select', 'gte', 'lte', 'eq', 'order', 'limit']) c[k] = () => c;
      return c;
    };
    const client = { from: (table: string) => { calls.push(table); return chain(table); } } as never;
    const out = await BoardQuery.load(client, new Date('2026-10-14T00:00:00Z'));
    expect(calls).toEqual(expect.arrayContaining(['m1_court_to_first_session', 'm4_m5_m6_episodes', 'outcome_measure', 'source_registry']));
    expect([out.period, out.freshness, out.asOf, out.metrics.m2]).toEqual(['2026-Q3', null, 'Not available yet', { rows: 0, n: 0, median: null, asOf: 'Not available yet', delta: null }]);
  });
});
