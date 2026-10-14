/**
 * F-304 part 1: pure M1–M6 compute per docs/PRD.md §C3 (v1). No I/O; rows are injected (see types.ts for filters).
 * Shares, rates and percentiles are rounded to 4 decimals. Interpretations: `decision === 'approved'` is the only
 * approved value (the generator writes approved|denied); "program dollars" (M5) = Σ dollars_paid over all episodes.
 */
import type { ApplicationRow, AuthorizationRow, CaseRow, EpisodeRow, MetricFilters, MetricInput } from './types';

const DAY = 86_400_000;
export const r4 = (x: number): number => Math.round(x * 1e4) / 1e4;
const ratio = (num: number, den: number): number | null => (den ? r4(num / den) : null);
const days = (later: string, earlier: string): number => Math.round((Date.parse(later) - Date.parse(earlier)) / DAY);

/** Percentile by linear interpolation (NumPy default): rank = p·(n−1); value = x[⌊rank⌋] + frac·(x[⌈rank⌉] − x[⌊rank⌋]). */
export function percentile(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  const rank = p * (sorted.length - 1), lo = Math.floor(rank), hi = Math.ceil(rank);
  return r4(sorted[lo]! + (rank - lo) * (sorted[hi]! - sorted[lo]!));
}
const dist = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return { n: s.length, median: percentile(s, 0.5), p25: percentile(s, 0.25), p75: percentile(s, 0.75) };
};

const caseOk = (c: CaseRow, f: MetricFilters): boolean =>
  (!f.county || c.county_fips === f.county) && (!f.referral || c.referral_source === f.referral);
const inRange = (anchor: string | null, f: MetricFilters): boolean =>
  !f.from && !f.to ? true : !!anchor && (!f.from || anchor >= f.from) && (!f.to || anchor <= f.to);

type Ep = { e: EpisodeRow; z: AuthorizationRow; a: ApplicationRow; c: CaseRow; aff: boolean };
type Linked = { cases: CaseRow[]; apps: { a: ApplicationRow; c: CaseRow }[]; eps: Ep[]; allEps: Ep[]; firstByApp: Map<string, string>; firstByCase: Map<string, string> };

/** Joins episode → authorization → application → case (orphans dropped), applies filters, indexes earliest first session. */
function link(input: MetricInput, f: MetricFilters): Linked {
  const cases = new Map(input.cases.map((c) => [c.id, c]));
  const apps = new Map(input.applications.map((a) => [a.id, a]));
  const auths = new Map(input.authorizations.map((z) => [z.id, z]));
  const aff = new Map(input.providers.map((p) => [p.id, p.provider_affiliated]));
  const all: Ep[] = input.episodes.flatMap((e) => {
    const z = auths.get(e.authorization_id), a = z && apps.get(z.application_id), c = a && cases.get(a.case_id);
    return z && a && c ? [{ e, z, a, c, aff: aff.get(z.provider_id ?? '') ?? false }] : [];
  });
  const firstByApp = new Map<string, string>(), firstByCase = new Map<string, string>();
  for (const { e, a, c } of all) {
    const fs = e.first_session_date;
    if (!fs) continue;
    if (fs < (firstByApp.get(a.id) ?? '~')) firstByApp.set(a.id, fs);
    if (fs < (firstByCase.get(c.id) ?? '~')) firstByCase.set(c.id, fs);
  }
  return {
    cases: input.cases.filter((c) => caseOk(c, f) && inRange(c.court_order_date ?? c.referral_date, f)),
    apps: input.applications.flatMap((a) => { const c = cases.get(a.case_id); return c && caseOk(c, f) && inRange(a.application_date, f) ? [{ a, c }] : []; }),
    eps: all.filter(({ e, c }) => caseOk(c, f) && inRange(e.last_session_date ?? e.first_session_date, f)),
    allEps: all, firstByApp, firstByCase,
  };
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const paid = (x: Ep) => x.e.dollars_paid ?? 0;
const done = (x: Ep) => x.e.discharge_status === 'completed';

export const Metrics = {
  /** M1: court order → first session (court-involved cases with both dates); stillWaitingShare = no first session ÷ court cases with an order date. */
  m1(input: MetricInput, f: MetricFilters = {}) {
    const L = link(input, f);
    const ordered = L.cases.filter((c) => c.court_involved && c.court_order_date);
    const started = ordered.filter((c) => L.firstByCase.has(c.id));
    return { ...dist(started.map((c) => days(L.firstByCase.get(c.id)!, c.court_order_date!))), stillWaitingShare: ratio(ordered.length - started.length, ordered.length) };
  },
  /** M2: application → decision, for applications with both dates. */
  m2(input: MetricInput, f: MetricFilters = {}) {
    return dist(link(input, f).apps.flatMap(({ a }) => (a.application_date && a.decision_date ? [days(a.decision_date, a.application_date)] : [])));
  },
  /** M3: approved (and decided) applications with no first session within `windowDays` of decision ÷ approved; reason = any of its episodes' non_start_reason ?? 'unknown'. */
  m3(input: MetricInput, f: MetricFilters = {}, windowDays = 60) {
    const L = link(input, f);
    const approved = L.apps.filter(({ a }) => a.decision === 'approved' && a.decision_date);
    const byReason: Record<string, number> = {};
    let neverStarted = 0;
    for (const { a } of approved) {
      const fs = L.firstByApp.get(a.id);
      if (fs && days(fs, a.decision_date!) <= windowDays) continue;
      neverStarted++;
      const reason = L.allEps.find((x) => x.a.id === a.id && x.e.non_start_reason)?.e.non_start_reason ?? 'unknown';
      byReason[reason] = (byReason[reason] ?? 0) + 1;
    }
    return { approved: approved.length, neverStarted, share: ratio(neverStarted, approved.length), byReason };
  },
  /** M4: completed ÷ closed (any non-null discharge_status) per income_band (null band → 'unknown'), bands A–Z, plus total. */
  m4(input: MetricInput, f: MetricFilters = {}) {
    const eps = link(input, f).eps;
    const bands = [...new Set(eps.map((x) => x.c.income_band ?? 'unknown'))].sort();
    const row = (band: string | null) => {
      const xs = band == null ? eps : eps.filter((x) => (x.c.income_band ?? 'unknown') === band);
      const completed = xs.filter(done).length, closed = xs.filter((x) => x.e.discharge_status != null).length;
      return { band: band ?? 'total', completed, closed, rate: ratio(completed, closed) };
    };
    return { rows: bands.map(row), total: row(null) };
  },
  /** M5: Σ dollars_paid on completed episodes ÷ completed; program dollars = Σ dollars_paid on all episodes ÷ completed. */
  m5(input: MetricInput, f: MetricFilters = {}) {
    const eps = link(input, f).eps, completedEpisodes = eps.filter(done).length;
    const dollarsCompleted = sum(eps.filter(done).map(paid)), programDollars = sum(eps.map(paid));
    return { completedEpisodes, dollarsCompleted, costPerCompleted: ratio(dollarsCompleted, completedEpisodes), programDollars, programPerCompleted: ratio(programDollars, completedEpisodes) };
  },
  /** M6: dollars to affiliated providers ÷ all dollars; per group avgRatePerUnit = Σ(rate·units) ÷ Σ units over the group's episodes' authorizations. */
  m6(input: MetricInput, f: MetricFilters = {}) {
    const eps = link(input, f).eps;
    const group = (g: 'affiliated' | 'other') => {
      const xs = eps.filter((x) => x.aff === (g === 'affiliated'));
      const units = sum(xs.map((x) => x.z.units ?? 0)), weighted = sum(xs.map((x) => (x.z.units ?? 0) * (x.z.rate ?? 0)));
      return { group: g, dollars: sum(xs.map(paid)), episodes: xs.length, avgRatePerUnit: ratio(weighted, units) };
    };
    const groups = [group('affiliated'), group('other')];
    const [affiliatedDollars, otherDollars] = [groups[0]!.dollars, groups[1]!.dollars];
    return { affiliatedDollars, otherDollars, affiliatedShare: ratio(affiliatedDollars, affiliatedDollars + otherDollars), groups };
  },
  all(input: MetricInput, f: MetricFilters = {}) {
    return { m1: Metrics.m1(input, f), m2: Metrics.m2(input, f), m3: Metrics.m3(input, f), m4: Metrics.m4(input, f), m5: Metrics.m5(input, f), m6: Metrics.m6(input, f) };
  },
};
