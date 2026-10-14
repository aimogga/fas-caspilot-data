import { describe, expect, it } from 'vitest';
import { generate } from '@/lib/synthetic/generate';
import { Metrics } from '@/lib/metrics/compute';
import type { Filters } from './filters';
import { compute, lastQuarters, MetricsQuery, quarterOf, quarterRange, toInput, type EpRow, type M1Row, type M3Row, type O1Row, type ViewRows } from './metrics-query';
type Rec = Record<string, unknown>;
const s = (v: unknown) => (v == null ? null : String(v)), str = (v: unknown) => s(v) as string, DAY = 86_400_000;
/** Mirrors the F-304 base views (supabase/migrations/20261013230000_f304_metric_views.sql) over the golden bundle. */
function viewRows(b: ReturnType<typeof generate>): { [K in keyof ViewRows]: NonNullable<ViewRows[K]> } {
  const auth = new Map(b.authorization.map((z: Rec) => [z.id, z])), caseByApp = new Map(b.application.map((a: Rec) => [a.id, a.case_id]));
  const band = new Map(b.case.map((c: Rec) => [c.id, c.income_band])), aff = new Map(b.provider.map((p: Rec) => [p.id, p.provider_affiliated]));
  const eps: Rec[] = b.delivery_episode.map((e: Rec) => { const z = auth.get(e.authorization_id) as Rec; return { ...e, z, application_id: z.application_id, case_id: caseByApp.get(z.application_id) }; });
  const min = (key: string, id: unknown, col: string) => eps.filter((e) => e[key] === id).map((e) => s(e[col])).filter((x): x is string => !!x).sort()[0] ?? null;
  return {
    m1: b.case.filter((c: Rec) => c.court_involved && c.court_order_date).map((c: Rec) => ({ case_id: str(c.id), court_order_date: str(c.court_order_date), first_session_date: min('case_id', c.id, 'first_session_date') })),
    m2: b.application.map((a: Rec) => ({ application_id: str(a.id), case_id: str(a.case_id), application_date: s(a.application_date), decision_date: s(a.decision_date) })),
    m3: b.application.filter((a: Rec) => a.decision === 'approved' && a.decision_date).map((a: Rec) => {
      const fs = min('application_id', a.id, 'first_session_date'), started = !!fs && (Date.parse(fs) - Date.parse(str(a.decision_date))) / DAY <= 60;
      return { application_id: str(a.id), case_id: str(a.case_id), decision_date: str(a.decision_date), started_within_window: started, non_start_reason: started ? null : min('application_id', a.id, 'non_start_reason') ?? 'unknown' };
    }),
    eps: eps.map((e) => ({ episode_id: str(e.id), case_id: str(e.case_id), discharge_status: s(e.discharge_status), dollars_paid: e.dollars_paid as number | null, anchor_date: s(e.last_session_date ?? e.first_session_date),
      income_band: s(band.get(e.case_id)), provider_affiliated: !!aff.get((e.z as Rec).provider_id), rate: (e.z as Rec).rate as number | null, units: (e.z as Rec).units as number | null })),
    o1: b.outcome_measure.map((o: Rec) => ({ measure_code: str(o.measure_code), baseline_score: o.baseline_score as number | null, followup_score: o.followup_score as number | null, followup_date: s(o.followup_date) })),
  };
}
const F = (over: Partial<Filters> = {}): Filters => ({ period: '2026-Q3', county: 'all', referral: 'all', compare: 'prior', ...over });
const ep = (n: number, band: string, completed: number, aff = true): EpRow[] => Array.from({ length: n }, (_, i): EpRow => ({
  episode_id: `${band}${i}`, case_id: `c-${band}`, discharge_status: i < completed ? 'completed' : 'dropped', dollars_paid: 100, anchor_date: '2026-08-01', income_band: band, provider_affiliated: aff, rate: aff ? 120 : 90, units: 2,
}));
const m1Rows = (n: number, order: string, wait: number): M1Row[] =>
  Array.from({ length: n }, (_, i) => ({ case_id: `${order}-${i}`, court_order_date: order, first_session_date: new Date(Date.parse(order) + wait * DAY).toISOString().slice(0, 10) }));
describe('MetricsQuery (DS-07b, F-401)', () => {
  it('quarter range and bucketing are inclusive and exact', () => {
    expect([quarterRange('2026-Q3'), quarterRange('2026-Q1'), quarterRange('2025-Q4')]).toEqual([{ from: '2026-07-01', to: '2026-09-30' }, { from: '2026-01-01', to: '2026-03-31' }, { from: '2025-10-01', to: '2025-12-31' }]);
    expect([quarterOf('2026-06-30'), quarterOf('2026-07-01'), quarterOf('2026-09-30'), quarterOf('2026-10-01'), quarterOf(null)]).toEqual(['2026-Q2', '2026-Q3', '2026-Q3', '2026-Q4', null]);
    expect(lastQuarters('2026-Q1')).toEqual(['2025-Q2', '2025-Q3', '2025-Q4', '2026-Q1']);
  });
  it('rebuilt view rows reproduce the golden engine numbers (tests/golden/metrics.json, no filters); compute then suppresses n < 11', () => {
    const rows = viewRows(generate(20, 20));
    expect(Metrics.m1(toInput.m1(rows.m1))).toEqual({ n: 4, median: 39.5, p25: 35.75, p75: 43.25, stillWaitingShare: 0.5 });
    expect(Metrics.m2(toInput.m2(rows.m2))).toEqual({ n: 20, median: 7, p25: 7, p75: 7 });
    expect(Metrics.m3(toInput.m3(rows.m3))).toEqual({ approved: 17, neverStarted: 3, share: 0.1765, byReason: { moved: 1, declined: 1, waitlist: 1 } });
    expect(Metrics.m5(toInput.eps(rows.eps))).toMatchObject({ completedEpisodes: 10, costPerCompleted: 403.5, programPerCompleted: 479 });
    expect(Metrics.m4(toInput.eps(rows.eps))).toMatchObject({ rows: [{ band: 'a', completed: 3, closed: 4, rate: 0.75 }, { band: 'b' }, { band: 'c' }, { band: 'd', completed: 2, closed: 3, rate: 0.6667 }], total: { completed: 10, closed: 14, rate: 0.7143 } });
    expect(Metrics.m6(toInput.eps(rows.eps))).toMatchObject({ affiliatedShare: 0.3737, groups: [{ group: 'affiliated', dollars: 1790, episodes: 8, avgRatePerUnit: 101.5385 }, { group: 'other', dollars: 3000, episodes: 9, avgRatePerUnit: 103.3077 }] });
    expect(compute.m4(rows.eps)).toMatchObject({ n: 14, total: { completed: null, closed: null, rate: null }, includesHiddenBands: true, rows: [{ band: 'a', completed: null, rate: null, suppressed: true, complementary: false }, {}, {}, {}] });
    expect(compute.m6(rows.eps)).toEqual({ n: 17, affiliatedShare: null, groups: [{ group: 'affiliated', dollars: null, episodes: null, avgRatePerUnit: null }, { group: 'other', dollars: null, episodes: null, avgRatePerUnit: null }] });
    expect(compute.o1(rows.o1)).toEqual({ n: 8, measures: [expect.objectContaining({ code: 'PHQ-9', n: 4, meanChange: null, shareImproved: null, suppressed: true }), expect.objectContaining({ code: 'GAD-7', n: 4, suppressed: true })] });
    expect(compute.m1(rows.m1)).toEqual({ n: 4, median: null, p25: null, p75: null, stillWaitingShare: null });
    expect([compute.m3(rows.m3), compute.m5(rows.eps), compute.m2(rows.m2)]).toEqual([{ n: 17, share: null, topReason: null }, { n: 10, costPerCompleted: null, programPerCompleted: null }, { n: 20, median: 7 }]);
  });
  it('build buckets by quarter, suppresses n < 11, words the prior-quarter delta, summarises the trend and flags a failed view', () => {
    const rows: ViewRows = { m1: [...m1Rows(12, '2026-07-01', 23), ...m1Rows(12, '2026-06-30', 27), ...m1Rows(3, '2026-01-15', 40)], m2: [], m3: [], eps: null, o1: null };
    const out = MetricsQuery.build(rows, F());
    expect(out.m1).toEqual({ rows: 12, viewRows: 12, n: 12, median: 23, p25: 23, p75: 23, stillWaitingShare: null, asOf: 'Jul 2026', delta: '↓ 4 days faster than Q2' });
    expect(out.trend).toEqual([{ period: '2025-Q4', median: null }, { period: '2026-Q1', median: null }, { period: '2026-Q2', median: 27 }, { period: '2026-Q3', median: 23 }]);
    expect([out.m2, out.m5, out.filtered]).toEqual([{ rows: 0, viewRows: 0, n: 0, median: null, asOf: 'Not available yet', delta: null }, { error: true }, false]);
    expect(MetricsQuery.build(rows, F({ compare: 'none' })).m1).toMatchObject({ delta: null });
    expect(MetricsQuery.build(rows, F({ period: '2026-Q1', county: '49035' }))).toMatchObject({ m1: { rows: 3, n: 3, median: null, delta: null }, filtered: true });
  });
  it('M3 top reason and M5 cost are shown only once n ≥ 11', () => {
    const m3 = Array.from({ length: 24 }, (_, i): M3Row => ({ application_id: `a${i}`, case_id: `c${i}`, decision_date: '2026-08-01', started_within_window: i >= 12, non_start_reason: i >= 12 ? null : i < 7 ? 'waitlist' : 'moved' }));
    const eps = Array.from({ length: 11 }, (_, i): EpRow => ({ ...ep(1, 'a', 1)[0] as EpRow, episode_id: `e${i}`, case_id: `c${i}`, dollars_paid: 100 + i, anchor_date: '2026-09-15' }));
    const out = MetricsQuery.build({ m1: [], m2: [], m3, eps: [...eps, { ...eps[0] as EpRow, episode_id: 'x', case_id: 'cx', discharge_status: 'dropped', dollars_paid: 1200, anchor_date: '2026-09-01' }], o1: [] }, F({ compare: 'none' }));
    expect(out.m3).toMatchObject({ n: 24, share: 0.5, topReason: 'waitlist' });
    expect(out.m5).toMatchObject({ n: 11, costPerCompleted: 105, programPerCompleted: 214.0909, asOf: 'Sep 2026' });
    expect(MetricsQuery.build({ m1: [], m2: [], m3: m3.slice(2), eps: eps.slice(0, 10), o1: [] }, F())).toMatchObject({ m3: { n: 22, share: null, topReason: null }, m5: { n: 10, costPerCompleted: null, programPerCompleted: null } });
  });
  it('M4 hides the one small band and, complementarily, the next-smallest one while the total stays; M6 shows both rates once each group has 11 (DS-07c)', () => {
    const eps = [...ep(14, 'a', 12), ...ep(12, 'b', 11, false), ...ep(3, 'c', 2)];
    const m4 = compute.m4(eps);
    expect(m4).toMatchObject({ n: 29, includesHiddenBands: true, total: { completed: 25, closed: 29, rate: 0.8621 } });
    expect(m4.rows.map((r) => [r.band, r.completed, r.closed, r.rate, r.suppressed, r.complementary])).toEqual([['a', 12, 14, 0.8571, false, false], ['b', null, null, null, true, true], ['c', null, null, null, true, false]]);
    expect(compute.m4([...ep(14, 'a', 12), ...ep(12, 'b', 11)])).toMatchObject({ includesHiddenBands: false, rows: [{ band: 'a', rate: 0.8571 }, { band: 'b', rate: 0.9167 }] });
    expect(compute.m4([])).toEqual({ n: 0, rows: [], total: { band: 'total', completed: null, closed: null, rate: null }, includesHiddenBands: false });
    expect(compute.m6(eps)).toEqual({ n: 29, affiliatedShare: 0.5862, groups: [
      { group: 'affiliated', dollars: 1700, episodes: 17, avgRatePerUnit: 120 }, { group: 'other', dollars: 1200, episodes: 12, avgRatePerUnit: 90 }] });
    expect(compute.m6([...ep(17, 'a', 12), ...ep(3, 'b', 1, false)])).toMatchObject({ affiliatedShare: null, groups: [{ dollars: 1700, avgRatePerUnit: 120 }, { dollars: null, episodes: null, avgRatePerUnit: null }] });
    const o1 = Array.from({ length: 12 }, (_, i): O1Row => ({ measure_code: i < 11 ? 'PHQ-9' : 'GAD-7', baseline_score: 10, followup_score: i % 2 ? 6 : 10, followup_date: '2026-08-15' }));
    expect(MetricsQuery.build({ m1: [], m2: [], m3: [], eps, o1 }, F()).o1).toMatchObject({ rows: 12, viewRows: 12, n: 12, asOf: 'Aug 2026', delta: null, measures: [
      { code: 'PHQ-9', n: 11, meanChange: -1.8182, shareImproved: 0.4545, suppressed: false }, { code: 'GAD-7', n: 1, meanChange: null, shareImproved: null, suppressed: true }] });
  });
});
