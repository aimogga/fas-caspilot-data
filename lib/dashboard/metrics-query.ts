/** DS-07b/c (F-401): M1–M6 from the F-304 base views and O1 from outcome_measure (F-305). Filters go to SQL, rows are bucketed by quarter here, and lib/metrics/compute.ts
 * runs on a MetricInput rebuilt from the view rows (so numbers equal the engine's); suppression comes from lib/metrics/suppress.ts only. */
import type { SupabaseClient } from '@supabase/supabase-js';
import { Metrics } from '../metrics/compute';
import { Outcomes, type OutcomeRow } from '../metrics/outcomes';
import { suppressCount, suppressRate, suppressTable } from '../metrics/suppress';
import type { ApplicationRow, AuthorizationRow, CaseRow, EpisodeRow, MetricInput } from '../metrics/types';
import { NeedMapQuery } from '../need-map/query';
import { ALL, priorQuarter, type Filters } from './filters';
import { delta, type DeltaUnit, type TrendPoint } from './format';
export type M1Row = { case_id: string; court_order_date: string; first_session_date: string | null };
export type M2Row = { application_id: string; case_id: string; application_date: string | null; decision_date: string | null };
export type M3Row = { application_id: string; case_id: string; decision_date: string; started_within_window: boolean; non_start_reason: string | null };
export type EpRow = {
  episode_id: string; case_id: string; discharge_status: string | null; dollars_paid: number | null; anchor_date: string | null;
  income_band: string | null; provider_affiliated: boolean; rate: number | null; units: number | null;
};
/** One outcome_measure row; `case` is embedded only when a county/referral filter is on (PostgREST inner join). */
export type O1Row = OutcomeRow & { followup_date: string | null };
/** A view that failed to load is `null`: its card shows the per-card error and the others stay. `Loaded` carries that error marker. */
export type ViewRows = { m1: M1Row[] | null; m2: M2Row[] | null; m3: M3Row[] | null; eps: EpRow[] | null; o1: O1Row[] | null };
/** `rows`: view rows in the quarter, unless the engine result carries its own `rows` (M4 bands); `viewRows` is always the count. */
export type Wired = { rows: number; viewRows: number; n: number; asOf: string; delta: string | null };
export type Loaded<T> = (T & Wired) | { error: true };
/** Four-quarter series of one headline value per metric (`null` when hidden or absent), for sparklines. */
export type TrendValue = { period: string; value: number | null };
export type Trends = Record<'m1' | 'm2' | 'm3' | 'm5', TrendValue[]>;
export type DashboardMetrics = { [K in keyof typeof compute]: Loaded<ReturnType<(typeof compute)[K]>> } & { trend: TrendPoint[]; trends: Trends; filtered: boolean };
/** View name, selected columns and the date column the quarter range applies to (in SQL; `anchor` buckets the same column here). */
const VIEWS = {
  m1: ['m1_court_to_first_session', 'case_id,court_order_date,first_session_date', 'court_order_date'],
  m2: ['m2_application_to_decision', 'application_id,case_id,application_date,decision_date', 'application_date'],
  m3: ['m3_never_started', 'application_id,case_id,decision_date,started_within_window,non_start_reason', 'decision_date'],
  eps: ['m4_m5_m6_episodes', 'episode_id,case_id,discharge_status,dollars_paid,anchor_date,income_band,provider_affiliated,rate,units', 'anchor_date'],
  o1: ['outcome_measure', 'measure_code,baseline_score,followup_score,followup_date', 'followup_date'],
} as const;
const anchor = {
  m1: (r: M1Row) => r.court_order_date, m2: (r: M2Row) => r.application_date, m3: (r: M3Row) => r.decision_date,
  eps: (r: EpRow) => r.anchor_date, o1: (r: O1Row) => r.followup_date,
};
/** `2026-Q3` → inclusive ISO dates `2026-07-01`..`2026-09-30`. */
export function quarterRange(period: string): { from: string; to: string } {
  const [y, q] = period.split('-Q').map(Number) as [number, number], iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(new Date(Date.UTC(y, (q - 1) * 3, 1))), to: iso(new Date(Date.UTC(y, q * 3, 0))) };
}
export const quarterOf = (iso: string | null): string | null => (iso ? `${iso.slice(0, 4)}-Q${Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1}` : null);
export const lastQuarters = (period: string, n = 4): string[] => (n <= 1 ? [period] : [...lastQuarters(priorQuarter(period), n - 1), period]);
// View rows → MetricInput: one synthetic application → authorization → episode chain per row so the engine's join finds it.
const AFF = 'p-affiliated';
const kase = (id: string, court_order_date: string | null = null, income_band: string | null = null): CaseRow =>
  ({ id, referral_source: null, court_involved: court_order_date != null, court_order_date, referral_date: null, county_fips: null, income_band });
const chain = (key: string, case_id: string, e: Partial<EpisodeRow>, a: Partial<ApplicationRow> = {}, z: Partial<AuthorizationRow> = {}): { a: ApplicationRow; z: AuthorizationRow; e: EpisodeRow } => ({
  a: { id: `a-${key}`, case_id, application_date: null, decision_date: null, decision: null, award_amount: null, family_contribution: null, ...a },
  z: { id: `z-${key}`, application_id: `a-${key}`, provider_id: null, units: null, rate: null, total_authorized: null, ...z },
  e: { id: `e-${key}`, authorization_id: `z-${key}`, first_session_date: null, last_session_date: null, discharge_status: null, non_start_reason: null, dollars_paid: null, ...e },
});
const input = (rows: { case_id: string }[], chains: ReturnType<typeof chain>[], cases = [...new Set(rows.map((r) => r.case_id))].map((id) => kase(id))): MetricInput =>
  ({ cases, applications: chains.map((c) => c.a), authorizations: chains.map((c) => c.z), providers: [{ id: AFF, provider_affiliated: true }], episodes: chains.map((c) => c.e) });
export const toInput = {
  m1: (rows: M1Row[]) => input(rows, rows.filter((r) => r.first_session_date).map((r) => chain(r.case_id, r.case_id, { first_session_date: r.first_session_date })), rows.map((r) => kase(r.case_id, r.court_order_date))),
  m2: (rows: M2Row[]) => input(rows, rows.map((r) => chain(r.application_id, r.case_id, {}, { application_date: r.application_date, decision_date: r.decision_date }))),
  m3: (rows: M3Row[]) => input(rows, rows.map((r) =>
    chain(r.application_id, r.case_id, { first_session_date: r.started_within_window ? r.decision_date : null, non_start_reason: r.non_start_reason }, { decision: 'approved', decision_date: r.decision_date }))),
  eps: (rows: EpRow[]) => input(rows, rows.map((r) =>
    chain(r.episode_id, r.case_id, { discharge_status: r.discharge_status, dollars_paid: r.dollars_paid, last_session_date: r.anchor_date }, {}, { provider_id: r.provider_affiliated ? AFF : null, units: r.units, rate: r.rate })),
    [...new Map(rows.map((r) => [r.case_id, kase(r.case_id, null, r.income_band)])).values()]),
};
export type M4Band = { band: string; completed: number | null; closed: number | null; rate: number | null };
export type M4Result = ReturnType<typeof compute.m4>; export type M6Result = ReturnType<typeof compute.m6>; export type O1Result = ReturnType<typeof compute.o1>;
const hide = <T>(n: number, v: T): T | null => (suppressCount(n).suppressed ? null : v);
/** Engine results for exactly the rows given (no date bucketing) with F-306 suppression applied: n < 11 hides the values. */
export const compute = {
  m1(q: M1Row[]) {
    const r = Metrics.m1(toInput.m1(q)), waiting = suppressRate(q.length - r.n, q.length);
    return { n: r.n, median: hide(r.n, r.median), p25: hide(r.n, r.p25), p75: hide(r.n, r.p75), stillWaitingShare: waiting.suppressed ? null : r.stillWaitingShare };
  },
  m2(q: M2Row[]) { const r = Metrics.m2(toInput.m2(q)); return { n: r.n, median: hide(r.n, r.median) }; },
  m3(q: M3Row[]) {
    const r = Metrics.m3(toInput.m3(q)), share = suppressRate(r.neverStarted, r.approved);
    const top = Object.entries(r.byReason).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    return { n: r.approved, share: share.suppressed ? null : r.share, topReason: share.suppressed || !top ? null : top[0] };
  },
  m5(q: EpRow[]) { const r = Metrics.m5(toInput.eps(q)); return { n: r.completedEpisodes, costPerCompleted: hide(r.completedEpisodes, r.costPerCompleted), programPerCompleted: hide(r.completedEpisodes, r.programPerCompleted) }; },
  /** M4 band table with complementary suppression (F-306): hidden cells are null; n = closed episodes. */
  m4(q: EpRow[]) {
    const r = Metrics.m4(toInput.eps(q)), t = suppressTable(r.rows, { countKeys: ['completed', 'closed'], rateKeys: ['rate'], total: r.total });
    return { n: r.total.closed, rows: t.rows as (M4Band & { suppressed: boolean; complementary: boolean })[], total: t.total as M4Band | null, includesHiddenBands: t.includesHiddenBands };
  },
  /** M6: a group under 11 episodes hides its dollars and rate (as m6_dollars_by_provider_group_shared); the share goes with them. */
  m6(q: EpRow[]) {
    const r = Metrics.m6(toInput.eps(q)), groups = r.groups.map((g) => ({ ...g, episodes: hide(g.episodes, g.episodes), dollars: hide(g.episodes, g.dollars), avgRatePerUnit: hide(g.episodes, g.avgRatePerUnit) }));
    const shown = groups.every((g) => g.dollars != null);
    return { n: q.length, affiliatedShare: shown ? r.affiliatedShare : null, groups };
  },
  /** O1: active instruments only; rates hidden under 11 pairs (Outcomes.suppressed); n = scored pairs across measures. */
  o1(q: O1Row[]) { const r = Outcomes.suppressed(Outcomes.compute(q)); return { n: r.measures.reduce((a, m) => a + m.n, 0), measures: r.measures }; },
};
export class MetricsQuery {
  /** Pure: buckets each view's rows by quarter, computes the current (and prior, when comparing) quarter and the 4-quarter M1 trend. */
  static build(rows: ViewRows, f: Filters): DashboardMetrics {
    const prior = priorQuarter(f.period), bucket = <R>(xs: R[], at: (r: R) => string | null, q: string) => xs.filter((r) => quarterOf(at(r)) === q);
    const section = <R, V extends { n: number }>(xs: R[] | null, at: (r: R) => string | null, calc: (q: R[]) => V, value: (v: V) => number | null, unit: DeltaUnit): Loaded<V> => {
      if (!xs) return { error: true };
      const q = bucket(xs, at, f.period), cur = calc(q), latest = xs.map(at).filter((d): d is string => !!d).sort().pop();
      const d = f.compare === 'prior' ? delta(value(cur), value(calc(bucket(xs, at, prior))), unit, prior) : null;
      return { rows: q.length, ...cur, viewRows: q.length, asOf: latest ? NeedMapQuery.monthYear(latest) : 'Not available yet', delta: d };
    };
    const trend = rows.m1 ? lastQuarters(f.period).map((period) => ({ period, median: compute.m1(bucket(rows.m1 as M1Row[], anchor.m1, period)).median })) : [];
    const series = <R>(xs: R[] | null, at: (r: R) => string | null, value: (q: R[]) => number | null): TrendValue[] =>
      xs ? lastQuarters(f.period).map((period) => ({ period, value: value(bucket(xs, at, period)) })) : [];
    const trends: Trends = {
      m1: trend.map((t) => ({ period: t.period, value: t.median })), m2: series(rows.m2, anchor.m2, (q) => compute.m2(q).median),
      m3: series(rows.m3, anchor.m3, (q) => compute.m3(q).share), m5: series(rows.eps, anchor.eps, (q) => compute.m5(q).costPerCompleted),
    };
    return {
      m1: section(rows.m1, anchor.m1, compute.m1, (v) => v.median, 'days'), m2: section(rows.m2, anchor.m2, compute.m2, (v) => v.median, 'days'),
      m3: section(rows.m3, anchor.m3, compute.m3, (v) => v.share, 'pts'), m5: section(rows.eps, anchor.eps, compute.m5, (v) => v.costPerCompleted, 'money'),
      m4: section(rows.eps, anchor.eps, compute.m4, (v) => v.total?.rate ?? null, 'pts'), m6: section(rows.eps, anchor.eps, compute.m6, () => null, 'pts'),
      o1: section(rows.o1, anchor.o1, compute.o1, () => null, 'pts'),
      trend, trends, filtered: f.county !== ALL || f.referral !== ALL,
    };
  }
  /** County/referral and the date range go to SQL. Every view spans the four trend quarters (sparklines); `build` buckets the current and prior quarter from them. */
  static async load(client: SupabaseClient, f: Filters): Promise<DashboardMetrics> {
    const to = quarterRange(f.period).to, from = quarterRange(lastQuarters(f.period)[0] as string).from;
    const read = async <R>(key: keyof typeof VIEWS): Promise<R[] | null> => {
      const [view, cols, dateCol] = VIEWS[key];
      try {
        const filtered = f.county !== ALL || f.referral !== ALL, table = key === 'o1', col = (c: string) => (table ? `case.${c}` : c);
        let q = client.from(view).select(table && filtered ? `${cols},case!inner(county_fips,referral_source)` : cols)
          .gte(dateCol, from).lte(dateCol, to);
        if (f.county !== ALL) q = q.eq(col('county_fips'), f.county);
        if (f.referral !== ALL) q = q.eq(col('referral_source'), f.referral);
        const { data, error } = await q;
        if (error) throw new Error(error.message);
        return (data ?? []) as unknown as R[];
      } catch (e) { console.error('[dashboard] metric view failed', { view, message: e instanceof Error ? e.message : 'unknown' }); return null; }
    };
    const [m1, m2, m3, eps, o1] = await Promise.all([read<M1Row>('m1'), read<M2Row>('m2'), read<M3Row>('m3'), read<EpRow>('eps'), read<O1Row>('o1')]);
    return MetricsQuery.build({ m1, m2, m3, eps, o1 }, f);
  }
}
