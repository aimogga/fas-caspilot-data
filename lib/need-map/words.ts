/** Words for the map itself (DS-11b, D-040): band names, the legend in words, and the one hover card a county shows on pointer, focus and tap. Pure. */
import { whyHidden, type Term } from '../trust/glossary';
import { NeedCompare } from './compare';
import { NeedMapQuery, type Column, type CountyRow } from './query';

export type Band = { name: string; range: string; count: number };
export type HoverRow = [string, string | undefined];
export type HoverWords = { term: Term; rows: HoverRow[]; hidden?: string };
const NAMES: string[][] = [[], ['All scored'], ['Lower need', 'Higher need'], ['Lowest need', 'Middle', 'Highest need'], ['Lowest need', 'Lower need', 'Higher need', 'Highest need'], ['Lowest need', 'Lower need', 'Middle', 'Higher need', 'Highest need']];
const RELATIVE = 'Relative ranking, not absolute need.';
/** The one note under the legend strip (DS-20a): replaces the legend title suffix, the two legend lines and the footer suffix. Keeps "placeholder" visible (DESIGN need-map rule 4). */
export const LEGEND_NOTE = 'Relative ranking · placeholder bands until FAS sets the weights.';

/** The first `n` ranked rows, in rank order. `rows` already honours the FAS filter and is sorted by rank, so with `?fas=1` these are the top FAS counties. */
export const topCounties = (rows: CountyRow[], n = 5): CountyRow[] => rows.filter((r) => r.status === 'Ranked').slice(0, n);

/** Band `binNo` of `k` in words; `Band n` only when the data has more bands than we have names for. */
export const bandName = (binNo: number, k: number): string => NAMES[k]?.[binNo - 1] ?? `Band ${binNo}`;

/** One legend entry per band from the data: its name, its score range (U+2212 for negatives) and how many counties sit in it. */
export function legendBands(counties: CountyRow[]): Band[] {
  const k = Math.max(0, ...counties.map((c) => c.binNo ?? 0));
  return Array.from({ length: k }, (_, i) => {
    const values = counties.flatMap((c) => (c.binNo === i + 1 && c.value !== null ? [c.value] : []));
    const range = values.length ? `${NeedMapQuery.signed(Math.min(...values))} to ${NeedMapQuery.signed(Math.max(...values))}` : 'no values';
    return { name: bandName(i + 1, k), range, count: values.length };
  });
}

/** The legend swatch hint: the range, the count and what a band is. */
export const bandHint = (band: Band, binNo: number, k: number): string =>
  `Need scores ${band.range}, ${band.count} ${band.count === 1 ? 'county' : 'counties'}. Band ${binNo} of ${k}: equal-count placeholder bands until FAS sets the final weights.`;

/** The county card: name as the title, one sentence that says what the rank means, then rank, score, band, FAS county, the measure it stands out on, and the source. Nothing not stored. */
export function hoverWords(county: CountyRow, counties: CountyRow[], columns: Column[], version: string | null): HoverWords {
  const k = Math.max(0, ...counties.map((c) => c.binNo ?? 0)), [rank, scored] = county.rank.split(' of ').map(Number);
  const ranked = county.binNo !== null && rank !== undefined && scored !== undefined && !Number.isNaN(rank);
  const plain = ranked ? `A higher need score than ${scored - rank} of the ${scored - 1} other counties scored. ${RELATIVE}` : 'No need score, so no rank or band. Its public measures are in the county panel.';
  const top = [...NeedCompare.rows(county, counties, columns)].sort((a, b) => b.higherThan / b.of - a.higherThan / a.of)[0];
  const rows: HoverRow[] = [
    ['Rank', ranked ? county.rank : undefined], ['Need score', ranked ? county.score : undefined], ['Band', ranked ? `${bandName(county.binNo as number, k)} (${county.bin})` : undefined],
    ['FAS county', county.fas ? 'Yes, FAS funds therapy here' : undefined], ['Stands out on', top ? `${top.label}, ${NeedCompare.words(top)}` : undefined], ['Source', version ? `Need score version ${version}` : undefined],
  ];
  return { term: { id: `county:${county.fips}`, title: county.name, plain }, rows, hidden: ranked ? undefined : whyHidden(county.status === 'Not published' ? 'not_published' : 'not_available') };
}
