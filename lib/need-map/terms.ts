/** Plain words for the need map (DS-11a, D-040): what each column, score, rank, band and indicator means, and the data attributes one `ExplainLayer` reads off a table cell. Pure. */
import { term, whyHidden, type Term } from '../trust/glossary';
import { NOT_PUBLISHED, NOT_YET, type Column, type ColumnSource, type CountyRow } from './query';

const ind = (code: string, title: string, plain: string): [string, Term] => [`ind:${code}`, { id: `ind:${code}`, title, plain }];
/** Need-map terms. Indicator ids are `ind:<indicator_code>`; the core score, rank, band and FAS county terms live in the shared glossary. */
export const NEED_TERMS: Record<string, Term> = Object.fromEntries([
  ['status', { id: 'status', title: 'Status', plain: 'Ranked means this county has a need score in the current version. Not published means the score could not be built because an input is missing for this county.' }],
  
  ind('uninsured_rate', 'Uninsured rate', 'The share of people under 65 in this county with no health insurance, from the latest Census estimate. A higher share means more families who may struggle to pay for care.'),
  ind('uninsured_count', 'Uninsured', 'How many people under 65 in this county have no health insurance, from the latest Census estimate.'),
  ind('poverty_rate', 'Poverty rate', 'The share of people in this county living below the federal poverty line, from the latest Census estimate. Higher means more need.'),
  ind('poverty_count', 'In poverty', 'How many people in this county live below the federal poverty line, from the latest Census estimate.'),
  ind('child_poverty_rate', 'Child poverty rate', 'The share of children under 18 in this county living below the federal poverty line. Higher means more families likely to need help paying for therapy.'),
  ind('child_poverty_count', 'In child poverty', 'How many children under 18 in this county live below the federal poverty line.'),
  ind('single_parent_pct', 'Single-parent households', 'The share of households with children that have one parent at home, from the five-year Census survey.'),
  ind('single_parent_households', 'Single-parent households (count)', 'How many households with children have one parent at home, from the five-year Census survey.'),
  ind('no_vehicle_pct', 'No-vehicle households', 'The share of households in this county with no car, from the five-year Census survey. Getting to a therapist is harder without one.'),
  ind('no_vehicle_households', 'No-vehicle households (count)', 'How many households in this county have no car, from the five-year Census survey.'),
  ind('total_population', 'Population', 'How many people live in this county, from the latest Census estimate.'),
  ind('total_households', 'Households', 'How many households are in this county, from the latest Census estimate.'),
  ind('veteran_population', 'Veterans', 'How many veterans live in this county, from the latest federal estimate.'),
]);

/** A need-map term, a core glossary term, or a fallback titled with the column label so an unknown indicator still reads in words. */
export function needTerm(id: string, label?: string): Term {
  if (NEED_TERMS[id]) return NEED_TERMS[id];
  if (id.startsWith('ind:')) return { id, title: label ?? id.slice(4).replace(/_/g, ' '), plain: 'A public measure for this county. The source and release year are in the column note; the footer says when we last loaded it.' };
  return term(id);
}

/** `9.2% ± 0.5` → the value and its margin of error as separate strings; no `±` means no margin. */
export function splitMoe(cell: string): { value: string; moe: string | null } {
  const [value, moe] = cell.split(' ± ');
  return { value: value ?? cell, moe: moe ?? null };
}
/** One sentence for a `± x` suffix. */
const WITHIN = 'The true value is likely within this much of the number shown, either way.';
export const moeWords = (moe: string): string => `Margin of error ± ${moe}. ${WITHIN}`;

export type CellData = { 'data-term': string; 'data-value'?: string; 'data-source'?: string; 'data-asof'?: string; 'data-hidden'?: string };
const hiddenFor = (text: string): string | undefined => (text === NOT_PUBLISHED ? whyHidden('not_published') : text === NOT_YET ? whyHidden('not_available') : undefined);

/** Data attributes for the rank, score, band and status cells of a county row; the source is the need-score version. */
export function scoreCell(kind: 'rank' | 'need_score' | 'placeholder_bins' | 'status', row: CountyRow, version: string | null): CellData {
  const value = kind === 'rank' ? row.rank : kind === 'need_score' ? row.score : kind === 'placeholder_bins' ? row.bin : row.status;
  const source = version ? `Need score version ${version}` : undefined;
  return { 'data-term': kind, 'data-value': value, 'data-source': source, 'data-hidden': kind === 'status' ? undefined : hiddenFor(value) };
}

/** Data attributes for one indicator cell: the term, the value with its margin in words, the source and release, the as-of month, and why it is hidden. */
export function indicatorCell(row: CountyRow, column: Column, source?: ColumnSource): CellData {
  const text = row.cells[column.code] ?? NOT_YET, { value, moe } = splitMoe(text);
  return { 'data-term': `ind:${column.code}`, 'data-value': moe ? `${value} (margin of error ± ${moe})` : value, 'data-source': column.note, 'data-asof': source?.asOf, 'data-hidden': hiddenFor(text) };
}

/** The FAS county badge, wherever it appears. */
export const FAS_BADGE: CellData = { 'data-term': 'fas_county', 'data-source': 'FAS service county list' };
