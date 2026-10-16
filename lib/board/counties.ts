/** DS-13b "Need in the counties we serve": the FAS service counties with their statewide need rank, worded from `NeedMapQuery` data (same ranks and
 * "Not published" rules as the need map). Pure; a missing score version is `not-available`, a county without a score reads "Not published", never a number. */
import { NOT_AVAILABLE } from '../dashboard/cards';
import type { CountyRow, NeedTableData } from '../need-map/query';
import { whyHidden } from '../trust/glossary';

export type BoardCounty = { fips: string; name: string; rank: number | null; of: number; score: string; status: string; hidden: string | null };
export type BoardCounties = { state: 'value' | 'not-available' | 'no-counties'; rows: BoardCounty[]; finding: string; support: string | null; source: string; asOf: string; version: string | null };
const SUFFIX = ['th', 'st', 'nd', 'rd'];
/** `1st`, `2nd`, `3rd`, `4th`, `11th`, `12th`, `13th`, `21st`. */
export const ordinal = (n: number): string => { const v = n % 100; return `${n}${SUFFIX[(v - 20) % 10] ?? SUFFIX[v] ?? SUFFIX[0]}`; };
const TOP = 10;
/** `4 of 26` → rank 4 of 26; anything else (Not published, Not available yet) → null. */
export const parseRank = (rank: string): { rank: number; of: number } | null => { const m = /^(\d+) of (\d+)$/.exec(rank); return m ? { rank: Number(m[1]), of: Number(m[2]) } : null; };
export const countyRow = (c: CountyRow): BoardCounty => {
  const r = parseRank(c.rank), hidden = c.status === 'Ranked' ? null : c.status === 'Not published' ? whyHidden('not_published') : whyHidden('not_available');
  return { fips: c.fips, name: c.name, rank: r?.rank ?? null, of: r?.of ?? 0, score: c.score, status: c.status, hidden };
};
/** Newest `Mon YYYY` among the column sources (`Not available yet` when none has a date). */
export const latestAsOf = (dates: string[]): string =>
  dates.filter((d) => d !== NOT_AVAILABLE).sort((a, b) => Date.parse(`1 ${a} UTC`) - Date.parse(`1 ${b} UTC`)).pop() ?? NOT_AVAILABLE;
/** The section's rows, finding and support sentences. `null` data (failed load) is worded as not available; the page shows the error beside it. */
export function boardCounties(d: NeedTableData | null): BoardCounties {
  const rows = (d?.counties ?? []).filter((c) => c.fas).map(countyRow), source = [...new Set((d?.sources ?? []).map((s) => `${s.name} ${s.vintage}`))].join(', ') || NOT_AVAILABLE;
  const base = { rows, source, asOf: latestAsOf((d?.sources ?? []).map((s) => s.asOf)), version: d?.version ?? null };
  if (!d || !d.version || !d.hasData) return { ...base, state: 'not-available', finding: 'County need is not available yet.', support: whyHidden('not_available') };
  if (!rows.length) return { ...base, state: 'no-counties', finding: 'No service counties are recorded yet.', support: 'The counties FAS serves appear here once they are entered.' };
  const ranked = rows.filter((r) => r.rank != null), top = ranked[0], hidden = rows.length - ranked.length, inTop = ranked.filter((r) => (r.rank as number) <= TOP).length;
  const finding = top ? `${top.name} has the highest need of the ${rows.length} ${rows.length === 1 ? 'county' : 'counties'} we serve, ranked ${ordinal(top.rank as number)} of ${top.of} statewide.`
    : `None of the ${rows.length} counties we serve has a published need score.`;
  const support = top ? `${inTop} of ${rows.length} rank among the ${TOP} highest-need counties in Utah${hidden ? `; ${hidden} not published` : ''}. Relative ranking, not absolute need.` : whyHidden('not_published');
  return { ...base, state: 'value', finding, support };
}
