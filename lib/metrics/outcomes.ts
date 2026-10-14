/** O1 Outcome change (F-305): mean follow-up − baseline and share improved per instrument. Pure; rows are injected. */
import { Instrument, INSTRUMENTS, type Direction } from './instruments';

export type OutcomeRow = {
  measure_code: string; baseline_score: number | string | null; followup_score: number | string | null;
  followup_date?: string | null;
};
export type OutcomeOpts = { measures?: string[]; includeInactive?: boolean; filters?: { from?: string; to?: string } };
export type MeasureResult = {
  code: string; label: string; direction: Direction; n: number; meanChange: number | null; shareImproved: number | null;
  improved: number; unchanged: number; worsened: number; suppressed?: boolean;
};
export type OutcomesResult = { measures: MeasureResult[]; excludedUnknown: number };

const round4 = (x: number): number => Math.round(x * 1e4) / 1e4;

function compute(rows: OutcomeRow[], opts: OutcomeOpts = {}): OutcomesResult {
  const { from, to } = opts.filters ?? {};
  const wanted = Object.values(INSTRUMENTS)
    .filter((i) => (opts.includeInactive || i.active) && (!opts.measures || opts.measures.includes(i.code)));
  let excludedUnknown = 0;
  const changes: Record<string, number[]> = Object.fromEntries(wanted.map((i) => [i.code, []]));
  for (const r of rows) {
    if (!Instrument.has(r.measure_code)) { excludedUnknown++; continue; }
    if (r.baseline_score == null || r.followup_score == null) continue;
    if ((from && (!r.followup_date || r.followup_date < from)) || (to && (!r.followup_date || r.followup_date > to))) continue;
    changes[r.measure_code]?.push(Number(r.followup_score) - Number(r.baseline_score));
  }
  const measures = wanted.map((i) => {
    const xs = changes[i.code] ?? [];
    const n = xs.length;
    const improved = xs.filter((c) => Instrument.isImprovement(i.code, c)).length;
    const unchanged = xs.filter((c) => c === 0).length;
    return {
      code: i.code, label: i.label, direction: i.direction, n,
      meanChange: n ? round4(xs.reduce((a, b) => a + b, 0) / n) : null,
      shareImproved: n ? round4(improved / n) : null,
      improved, unchanged, worsened: n - improved - unchanged,
    };
  });
  return { measures, excludedUnknown };
}

/** F-306: rates on counts under the threshold are hidden. Self-contained; the shared suppress module lives elsewhere. */
function suppressed(result: OutcomesResult, threshold = 11): OutcomesResult {
  return {
    ...result,
    measures: result.measures.map((m) =>
      m.n < threshold ? { ...m, meanChange: null, shareImproved: null, suppressed: true } : { ...m, suppressed: false }),
  };
}

export const Outcomes = { compute, suppressed };
