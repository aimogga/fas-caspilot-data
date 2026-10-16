/** Plain words for the team dashboard (DS-15a, D-040): what each M4 cell means and the data attributes one `ExplainLayer` reads off it, a sentence per filter and per
 * pipeline stage, the delta hint, the trend points and the M1 distribution line without codes. Pure. */
import type { ChartPoint } from '../charts/scale';
import { chip } from '../staff/home';
import { term, whyHidden, type Term } from '../trust/glossary';
import { STAGES } from './query';
import { bandLabel, num, pct, quarterPoints, type TrendPoint } from './format';
import type { M4Result } from './metrics-query';

export type CellData = { 'data-term': string; 'data-value'?: string; 'data-source'?: string; 'data-asof'?: string; 'data-hidden'?: string };
export type M4Kind = 'completed' | 'closed' | 'rate';
type M4Row = M4Result['rows'][number];
const FAS = 'FAS records';
export const HIDDEN_RATE = 'No rate is shown because the count behind it is hidden.';

/** M4 cell terms; the metric itself and the hidden reasons stay in the shared glossary. */
export const DASH_TERMS: Record<string, Term> = {
  m4_completed: { id: 'm4_completed', title: 'Completed', plain: 'How many families in this income band finished the planned course of therapy, among those whose therapy closed this quarter.', source: FAS },
  m4_closed: { id: 'm4_closed', title: 'Closed', plain: 'How many families in this income band had their therapy close this quarter, whether or not they finished it.', source: FAS },
  m4_rate: { id: 'm4_rate', title: 'Completion rate', plain: 'Completed divided by closed, for this income band. Higher is better.', source: FAS },
};
/** A dashboard term or a core glossary term. */
export const dashTerm = (id: string): Term => DASH_TERMS[id] ?? term(id);

/** The attributes for one M4 count or rate cell: the value in words when shown, the privacy sentence when the count is under 11, the rate's own sentence when its count is hidden. */
export function m4Cell(kind: M4Kind, row: Pick<M4Row, 'band' | 'completed' | 'closed' | 'rate'> & { suppressed?: boolean }, asOf: string): CellData {
  const raw = row[kind], band = row.band === 'total' ? 'across all bands' : `in the ${bandLabel(row.band)} band`;
  const shown = raw == null ? undefined : kind === 'rate' ? `${pct(raw)} ${band}` : `${num(raw)} ${band}`;
  const hidden = raw != null ? undefined : kind === 'rate' && !row.suppressed ? HIDDEN_RATE : whyHidden('suppressed');
  return { 'data-term': `m4_${kind}`, 'data-value': shown, 'data-source': FAS, 'data-asof': asOf, 'data-hidden': hidden };
}
/** The one cell of a complementary-hidden band. */
export const complementaryCell = (asOf: string): CellData => ({ 'data-term': 'complementary', 'data-source': FAS, 'data-asof': asOf, 'data-hidden': whyHidden('complementary') });

/** One sentence beside each filter label. */
export const FILTER_HINTS: Record<string, string> = {
  period: 'The three months the numbers cover. The newest complete quarter is chosen until you change it.',
  county: 'Limits every number to families in one Utah county. Counts under 11 families stay hidden.',
  referral: 'Who sent the family to FAS, as recorded on the case, such as a court or a school.',
  compare: 'Adds an arrow and words under each number saying how it moved against the quarter before.',
};

/** One sentence per pipeline stage, keyed by the stage names in `STAGES`. */
export const STAGE_WORDS: Record<(typeof STAGES)[number], string> = {
  New: 'Found in a grant list and not yet looked at.',
  Reviewing: 'Someone at FAS is reading it to see whether it fits.',
  Pursuing: 'FAS has decided to apply and is preparing the application.',
  Submitted: 'The application has gone to the funder and FAS is waiting to hear.',
  Awarded: 'The funder said yes.',
  Declined: 'The funder said no.',
  Passed: 'FAS chose not to apply.',
};
export const MANUAL_HINT = "Entered by hand by FAS staff from a foundation's own list, not found by the automatic search.";
/** The stage sentence plus the count in words: `… 3 opportunities are at this stage.` */
export function stageHint(name: string, count: string | number): string {
  const n = Number(count), words = n === 1 ? '1 opportunity is' : n === 0 ? 'No opportunities are' : `${n} opportunities are`;
  return `${STAGE_WORDS[name as keyof typeof STAGE_WORDS] ?? 'A stage of the grant pipeline.'} ${words} at this stage.`;
}

/** The hint under a delta line: the full prior quarter and which way is better (reuses the staff home chip words). */
export const deltaHint = (delta: string | null, goodWhen: 'up' | 'down', prior: string): string | undefined => chip(delta, goodWhen, prior)?.hint;

/** Chart points for the M1 trend hover: `Q3 ’26` labels, hidden quarters stay null. */
export const trendChartPoints = (points: TrendPoint[]): ChartPoint[] => quarterPoints(points.map((p) => ({ period: p.period, value: p.median })), ' days');

/** The M1 distribution line in words: quartiles, families and the share still waiting, with no `pct` code. */
export function m1Stats(v: { p25: number | null; p75: number | null; n: number; stillWaitingShare: number | null }): string {
  const parts = [
    v.p25 == null ? null : `A quarter of families waited ${num(v.p25)} days or less`, v.p75 == null ? null : `a quarter waited ${num(v.p75)} days or more`,
    `n = ${v.n}`, v.stillWaitingShare == null ? null : `Still waiting ${pct(v.stillWaitingShare)}`,
  ];
  return parts.filter(Boolean).join(' · ');
}
