/** DS-13a board KPI row: three numbers a board member reads first (M1 wait, M4 finished therapy, M5 cost), worded from the same suppressed
 * `DashboardMetrics` as the pictures and cards. Pure; nothing is estimated. A hidden value stays hidden, n = 0 reads as words, never a zero. */
import { METRIC_CARDS, NOT_AVAILABLE } from '../dashboard/cards';
import { priorQuarter } from '../dashboard/filters';
import { money, num, pct, quarterWords } from '../dashboard/format';
import type { DashboardMetrics, Loaded, Wired } from '../dashboard/metrics-query';

export type BoardKpiId = 'm1' | 'm4' | 'm5';
export type BoardKpiState = 'value' | 'suppressed' | 'no-data' | 'not-available' | 'error';
export type BoardKpi = {
  id: BoardKpiId; label: string; title: string; state: BoardKpiState; value: string | null; unit: string; valueText: string | null;
  detail: string | null; compare: string | null; compareHint: string | null; n: number; asOf: string; noData: string;
};
type M = Wired & Record<string, unknown>;
type Spec = { id: BoardKpiId; label: string; unit: string; noun: string; noData: string; pick: (m: M) => number | null; fmt: (x: number | null) => string | null; detail: (m: M) => string | null };
const total = (m: M) => m.total as { completed: number | null; closed: number | null; rate: number | null } | null;
const SPEC: Spec[] = [
  { id: 'm1', label: 'Wait for a first session', unit: 'days', noun: 'median wait from court order to first session', noData: 'No court-ordered case reached a first session this quarter',
    pick: (m) => m.median as number | null, fmt: num, detail: (m) => `Median of ${num(m.n)} families: half waited less, half waited more` },
  { id: 'm4', label: 'Finished therapy', unit: '%', noun: 'of families whose therapy closed finished the planned course', noData: 'No closed cases this quarter',
    pick: (m) => total(m)?.rate ?? null, fmt: pct, detail: (m) => { const t = total(m); return t?.completed == null || t.closed == null ? null : `${num(t.completed)} of ${num(t.closed)} who closed`; } },
  { id: 'm5', label: 'Cost per completed course', unit: '', noun: 'average cost of one completed course of therapy', noData: 'No course of therapy was completed this quarter',
    pick: (m) => m.costPerCompleted as number | null, fmt: money, detail: (m) => `Average across ${num(m.n)} completed courses` },
];
/** `↓ 4 days faster than Q2` → `↓ 4 days faster than April–June 2026`; `No change from Q2` → `Same as April–June 2026`; null → `Nothing to compare with April–June 2026`. */
export function compareWords(delta: string | null, prior: string): string {
  const q = quarterWords(prior);
  if (!delta) return `Nothing to compare with ${q}`;
  if (delta.startsWith('No change')) return `Same as ${q}`;
  return delta.replace(/ than Q[1-4]$/, ` than ${q}`).replace(/\bpts\b/, 'points');
}
/** The hint behind the comparison line: which quarter, and which way is better. Cost has no "better" direction the board agreed on, so it only names the quarter. */
export function compareHint(id: BoardKpiId, delta: string | null, prior: string): string {
  const q = quarterWords(prior), which = `${q} is the quarter before this one.`;
  if (!delta) return `${which} There is no number to compare with: too few families then, or no data.`;
  return id === 'm5' ? `${which} The dollar figure is an average, so one costly course can move it.` : `${which} ${id === 'm1' ? 'Lower' : 'Higher'} is better for this number.`;
}
/** Three KPIs. A failed view is `error`, no data at all is `not-available`, n = 0 is `no-data`; only 1 ≤ n < 11 is `suppressed`. */
export function boardKpis(x: DashboardMetrics | null, period: string): BoardKpi[] {
  const prior = priorQuarter(period), when = quarterWords(period);
  return SPEC.map((s) => {
    const m = x?.[s.id] as Loaded<M> | undefined, ok = !!m && !('error' in m), v = ok ? s.pick(m) : null, value = s.fmt(v);
    const state: BoardKpiState = !m ? 'not-available' : !ok ? 'error' : m.n === 0 ? 'no-data' : v == null ? 'suppressed' : 'value';
    const live = ok && state === 'value';
    return {
      id: s.id, label: s.label, title: METRIC_CARDS.find((c) => c.id === s.id)?.title ?? s.id, state, value: live ? value : null, unit: s.unit,
      valueText: live ? `${value}${s.unit === 'days' ? ' days' : ''} ${s.noun}, ${when}` : null, detail: live ? s.detail(m) : null,
      compare: live ? compareWords(m.delta, prior) : null, compareHint: live ? compareHint(s.id, m.delta, prior) : null,
      n: ok ? m.n : 0, asOf: ok ? m.asOf : NOT_AVAILABLE, noData: s.noData,
    };
  });
}
