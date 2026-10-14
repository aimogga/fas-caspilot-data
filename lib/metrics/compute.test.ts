import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { generate } from '@/lib/synthetic/generate';
import { Metrics, percentile } from './compute';
import type { MetricFilters, MetricInput } from './types';

type Golden = { cases: { name: string; filters: MetricFilters; expect: ReturnType<typeof Metrics.all> }[] };
const golden = JSON.parse(readFileSync('tests/golden/metrics.json', 'utf8')) as Golden;

function fromBundle(b: ReturnType<typeof generate>): MetricInput {
  const as = <T>(x: unknown) => x as T;
  return { cases: as(b.case), applications: as(b.application), authorizations: as(b.authorization), providers: as(b.provider), episodes: as(b.delivery_episode) };
}
const fixture = fromBundle(generate(20, 20));

/** One court case with a 19-day wait, one approved application, one completed episode at an affiliated provider. */
const tiny = (over: Partial<MetricInput> = {}): MetricInput => ({
  cases: [{ id: 'c1', referral_source: 'court', court_involved: true, court_order_date: '2024-02-01', referral_date: '2024-02-03', county_fips: '49035', income_band: 'a' }],
  applications: [{ id: 'a1', case_id: 'c1', application_date: '2024-02-10', decision_date: '2024-02-14', decision: 'approved', award_amount: 100, family_contribution: 0 }],
  authorizations: [{ id: 'z1', application_id: 'a1', provider_id: 'p1', units: 4, rate: 25, total_authorized: 100 }],
  providers: [{ id: 'p1', provider_affiliated: true }],
  episodes: [{ id: 'e1', authorization_id: 'z1', first_session_date: '2024-02-20', last_session_date: '2024-03-20', discharge_status: 'completed', non_start_reason: null, dollars_paid: 100 }],
  ...over,
});

describe('golden: tests/golden/metrics.json', () => {
  for (const c of golden.cases) it(c.name, () => expect(Metrics.all(fixture, c.filters)).toEqual(c.expect));
});

describe('unit: edge cases', () => {
  it('interpolates percentiles linearly', () => {
    expect([percentile([1, 2, 3, 4], 0.25), percentile([1, 2, 3, 4], 0.75), percentile([5], 0.5), percentile([], 0.5)]).toEqual([1.75, 3.25, 5, null]);
  });
  it('empty input gives zero counts and null ratios', () => {
    const empty = Metrics.all({ cases: [], applications: [], authorizations: [], providers: [], episodes: [] });
    expect(empty.m1).toEqual({ n: 0, median: null, p25: null, p75: null, stillWaitingShare: null });
    expect(empty.m3).toEqual({ approved: 0, neverStarted: 0, share: null, byReason: {} });
    expect(empty.m4).toEqual({ rows: [], total: { band: 'total', completed: 0, closed: 0, rate: null } });
    expect(empty.m5.costPerCompleted).toBeNull(); expect(empty.m6.affiliatedShare).toBeNull(); expect(empty.m6.groups[1]!.avgRatePerUnit).toBeNull();
  });
  it('excludes rows with missing dates from M1/M2 but counts a court order without a session as still waiting', () => {
    const t = tiny({ episodes: [{ ...tiny().episodes[0]!, first_session_date: null, last_session_date: null, discharge_status: null }] });
    expect(Metrics.m1(t)).toEqual({ n: 0, median: null, p25: null, p75: null, stillWaitingShare: 1 });
    expect(Metrics.m2(tiny({ applications: [{ ...tiny().applications[0]!, decision_date: null }] })).n).toBe(0);
    expect(Metrics.m1(tiny())).toMatchObject({ n: 1, median: 19, stillWaitingShare: 0 });
  });
  it('zero denominators give null rates and M3 ignores unknown decision values', () => {
    expect(Metrics.m4(tiny({ episodes: [{ ...tiny().episodes[0]!, discharge_status: null }] })).rows[0]).toEqual({ band: 'a', completed: 0, closed: 0, rate: null });
    expect(Metrics.m3(tiny({ applications: [{ ...tiny().applications[0]!, decision: 'pending' }] }))).toEqual({ approved: 0, neverStarted: 0, share: null, byReason: {} });
    expect(Metrics.m3(tiny(), {}, 1)).toEqual({ approved: 1, neverStarted: 1, share: 1, byReason: { unknown: 1 } });
    const late = tiny({ episodes: [{ ...tiny().episodes[0]!, first_session_date: '2024-04-10' }] }); // 56 days after decision
    expect([Metrics.m3(late).neverStarted, Metrics.m3(late, {}, 30).neverStarted, Metrics.m3(tiny()).share]).toEqual([0, 1, 0]);
  });
  it('filters by county, referral source and anchor-date range', () => {
    expect(Metrics.m5(tiny(), { county: '49049' }).completedEpisodes).toBe(0);
    expect(Metrics.m5(tiny(), { referral: 'self' }).completedEpisodes).toBe(0);
    expect(Metrics.m5(tiny(), { county: '49035', referral: 'court' }).completedEpisodes).toBe(1);
    expect(Metrics.m5(tiny(), { from: '2024-03-20' }).completedEpisodes).toBe(1);
    expect(Metrics.m5(tiny(), { to: '2024-03-19' }).completedEpisodes).toBe(0);
    expect(Metrics.m1(tiny(), { from: '2024-02-02' }).n).toBe(0);
    expect(Metrics.m2(tiny(), { from: '2024-02-10', to: '2024-02-10' }).n).toBe(1);
  });
});
