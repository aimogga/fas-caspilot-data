/** DS-13b sources paragraph: the same source · period · n · as of words as the footers, written once as prose for the foot of the page and the print sheet. Pure. */
import { NOT_AVAILABLE } from '../dashboard/cards';
import type { DashboardMetrics } from '../dashboard/metrics-query';
import { quarterWords } from '../dashboard/format';
import type { BoardCounties } from './counties';

const NAMES: ['m1' | 'm2' | 'm3' | 'm4' | 'm5' | 'm6' | 'o1', string][] = [
  ['m1', 'first sessions after a court order'], ['m2', 'funding decisions'], ['m3', 'approved families'], ['m4', 'closed cases'], ['m5', 'completed courses of therapy'], ['m6', 'therapy episodes'], ['o1', 'follow-up scores'],
];
export const PRIVACY = 'Counts under 11 families are hidden to protect privacy, and a neighbouring value is hidden when a small count could be worked out from a total. Dates are shown by quarter.';
/** `FAS records for July–September 2026, as of Sep 2026: funding decisions (n = 19), closed cases (n = 38) …` plus the county need sources and the privacy rule. */
export function sourcesParagraph(x: DashboardMetrics | null, period: string, asOf: string, counties: BoardCounties): string {
  const counts = x ? NAMES.flatMap(([k, words]) => { const m = x[k]; return 'error' in m ? [] : [`${words} (n = ${m.n})`]; }) : [];
  const fas = counts.length ? `FAS records for ${quarterWords(period)}, ${asOf === NOT_AVAILABLE ? 'date not available yet' : `as of ${asOf}`}: ${counts.join(', ')}.` : 'FAS records for this quarter are not available yet.';
  const need = counties.version ? `County need: ${counties.source}, need score version ${counties.version}, ${counties.asOf === NOT_AVAILABLE ? 'date not available yet' : `as of ${counties.asOf}`}.` : 'County need: not available yet.';
  return `${fas} ${need} ${PRIVACY}`;
}
