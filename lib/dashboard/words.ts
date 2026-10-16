/** Plain words for the team dashboard (DS-15a/b, D-040): what each M4, M6 and O1 cell means and the data attributes one `ExplainLayer` reads off it, a sentence per filter
 * and per pipeline stage, the delta hint, the trend points and the M1 distribution line without codes. Pure. */
import type { ChartPoint } from '../charts/scale';
import { chip } from '../staff/home';
import { term, whyHidden, type Term } from '../trust/glossary';
import { STAGES } from './query';
import { GROUP_LABELS } from './cards';
import { bandLabel, money, num, pct, quarterPoints, signed, type TrendPoint } from './format';
import type { M4Result, M6Result, O1Result } from './metrics-query';

export type CellData = { 'data-term': string; 'data-value'?: string; 'data-source'?: string; 'data-asof'?: string; 'data-hidden'?: string };
export type M4Kind = 'completed' | 'closed' | 'rate';
export type M6Kind = 'rate' | 'dollars' | 'episodes';
export type O1Kind = 'mean' | 'improved' | 'n';
type M4Row = M4Result['rows'][number];
type M6Group = M6Result['groups'][number];
type O1Measure = Pick<O1Result['measures'][number], 'code' | 'label' | 'direction' | 'n' | 'meanChange' | 'shareImproved' | 'suppressed'>;
const FAS = 'FAS records';
export const HIDDEN_RATE = 'No rate is shown because the count behind it is hidden.';
const t = (id: string, title: string, plain: string): Term => ({ id, title, plain, source: FAS });

/** M4, M6 and O1 cell terms; the metrics themselves and the hidden reasons stay in the shared glossary. */
export const DASH_TERMS: Record<string, Term> = {
  m4_completed: t('m4_completed', 'Completed', 'How many families in this income band finished the planned course of therapy, among those whose therapy closed this quarter.'),
  m4_closed: t('m4_closed', 'Closed', 'How many families in this income band had their therapy close this quarter, whether or not they finished it.'),
  m4_rate: t('m4_rate', 'Completion rate', 'Completed divided by closed, for this income band. Higher is better.'),
  m6_share: t('m6_share', 'Share of therapy dollars', 'The share of everything FAS paid for therapy this quarter that went to this group of providers. The two groups add up to all of it.'),
  m6_rate: t('m6_rate', 'Average rate per hour', 'What this group of providers charged per hour of therapy on average, weighted by the units of therapy authorized this quarter.'),
  m6_dollars: t('m6_dollars', 'Dollars paid', 'The total FAS paid to this group of providers for therapy this quarter.'),
  m6_episodes: t('m6_episodes', 'Episodes', 'How many courses of therapy this group of providers delivered this quarter. One episode is one family\'s course of therapy.'),
  o1_mean: t('o1_mean', 'Mean change', 'The average change in survey score from the start of therapy to the end, in points. On a distress scale a negative number means families felt better.'),
  o1_improved: t('o1_improved', 'Share improved', 'The share of families whose score moved in the better direction between the start and the end of therapy.'),
  o1_n: t('o1_n', 'Scored pairs', 'How many families had both a start and an end score on this survey, so a change could be measured. Under 11 pairs, the whole row is hidden.'),
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

/** The lower-case group name in words (`affiliated providers`). */
const groupWords = (group: string): string => (GROUP_LABELS[group] ?? group).toLowerCase();
/** One segment of the M6 share bar (and its words above it): the share and the dollars behind it, or why the share is hidden (a group under 11 episodes hides its own figures;
 * the other group's share is hidden with it so the small group cannot be worked out). */
export function m6Segment(group: string, share: number | null, dollars: number | null, asOf: string): CellData {
  const shown = share == null ? undefined : `${pct(share)} of therapy dollars went to ${groupWords(group)}${dollars == null ? '' : ` (${money(dollars)})`}`;
  const hidden = share != null ? undefined : whyHidden(dollars == null ? 'suppressed' : 'complementary');
  return { 'data-term': 'm6_share', 'data-value': shown, 'data-source': FAS, 'data-asof': asOf, 'data-hidden': hidden };
}
/** One M6 table cell: the figure in words for its provider group, or the privacy sentence when the group is under 11 episodes. */
export function m6Cell(kind: M6Kind, g: M6Group, asOf: string): CellData {
  const who = groupWords(g.group), words = {
    rate: g.avgRatePerUnit == null ? undefined : `${money(g.avgRatePerUnit)} per hour for ${who}`,
    dollars: g.dollars == null ? undefined : `${money(g.dollars)} paid to ${who}`,
    episodes: g.episodes == null ? undefined : `${num(g.episodes)} ${g.episodes === 1 ? 'episode' : 'episodes'} with ${who}`,
  }[kind];
  return { 'data-term': `m6_${kind}`, 'data-value': words, 'data-source': FAS, 'data-asof': asOf, 'data-hidden': words == null ? whyHidden('suppressed') : undefined };
}
/** One O1 cell: the figure in words for its survey, with the direction said plainly; a row under 11 pairs carries the privacy sentence on every cell. */
export function o1Cell(kind: O1Kind, m: O1Measure, asOf: string): CellData {
  const survey = `the ${m.label} survey`, better = m.direction === 'lower_is_better' ? 'lower is better' : 'higher is better';
  const words = m.suppressed ? undefined : {
    mean: m.meanChange == null ? undefined : `${signed(m.meanChange)} points on ${survey} (${better})`,
    improved: m.shareImproved == null ? undefined : `${pct(m.shareImproved)} of families improved on ${survey}`,
    n: `${num(m.n)} families with a start and an end score on ${survey}`,
  }[kind];
  return { 'data-term': `o1_${kind}`, 'data-value': words, 'data-source': FAS, 'data-asof': asOf, 'data-hidden': words == null ? whyHidden('suppressed') : undefined };
}
/** The sentence beside the `View as table` toggle under every chart. */
export const TABLE_HINT = 'Shows the same numbers as the picture in a table, one row per bar or point, with hidden values marked.';

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
