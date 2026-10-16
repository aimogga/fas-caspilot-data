/** Which measures the county table shows and in what order (DS-20c, George's decision 2): the five scored rates by default, every loaded measure under `?cols=all`. Pure. */
import { NOT_YET, type Column, type CountyRow } from './query';

export type ColumnMode = 'key' | 'all';
/** The five rates that make up the need score (DESIGN need score rule 3), in table order. */
export const KEY_CODES: readonly string[] = ['uninsured_rate', 'poverty_rate', 'child_poverty_rate', 'single_parent_pct', 'no_vehicle_pct'];
/** Topic order for "All measures": the rates first, then the counts by the same topics, then the county totals. */
export const ORDER: readonly string[] = [...KEY_CODES, 'uninsured_count', 'poverty_count', 'child_poverty_count', 'single_parent_households', 'no_vehicle_households', 'total_population', 'total_households', 'veteran_population', 'court_filings_total', 'court_filings_district', 'court_filings_justice', 'court_filings_juvenile'];
/** Short headers with the unit in them, so cells carry the number only (house rule 1). */
const HEADERS: Record<string, string> = {
  uninsured_rate: 'Uninsured\u00a0%', poverty_rate: 'Poverty\u00a0%', child_poverty_rate: 'Child poverty\u00a0%', single_parent_pct: 'Single-parent\u00a0%', no_vehicle_pct: 'No-vehicle\u00a0%',
  uninsured_count: 'Uninsured (people)', poverty_count: 'In poverty (people)', child_poverty_count: 'Children in poverty', single_parent_households: 'Single-parent (households)',
  no_vehicle_households: 'No-vehicle (households)', total_population: 'Population', total_households: 'Households', veteran_population: 'Veterans',
  court_filings_total: 'Court filings (total)', court_filings_district: 'Court filings (district)', court_filings_justice: 'Court filings (justice)', court_filings_juvenile: 'Court filings (juvenile)',
};

export const parseCols = (value: unknown): ColumnMode => (value === 'all' ? 'all' : 'key');

/** `key`: the scored rates that are loaded, in `KEY_CODES` order. `all`: every loaded column in `ORDER`, unknown codes last alphabetically. */
export function orderColumns(columns: Column[], mode: ColumnMode): Column[] {
  const at = (c: Column) => ORDER.indexOf(c.code);
  const known = columns.filter((c) => (mode === 'key' ? KEY_CODES.includes(c.code) : at(c) >= 0)).sort((a, b) => at(a) - at(b));
  return mode === 'key' ? known : [...known, ...columns.filter((c) => at(c) < 0).sort((a, b) => a.code.localeCompare(b.code))];
}

export const header = (c: Column): string => HEADERS[c.code] ?? (c.unit === 'percent' ? `${c.label}\u00a0%` : c.label);

/** The stored value as one short line: `12.3%` or `3,090`, no noun and no margin (both live in the cell's explain card). Words for missing values are unchanged. */
export function plainCell(row: CountyRow, c: Column): string {
  const n = row.values[c.code];
  if (n === null || n === undefined) return row.cells[c.code] ?? NOT_YET;
  return c.unit === 'percent' ? `${n}%` : n.toLocaleString('en-US');
}

/** True when the county has no stored value for this measure (not loaded or not published): the cell shows a dash, the words live in the explain card and for screen readers. */
export const isMissing = (row: CountyRow, c: Column): boolean => row.values[c.code] === null || row.values[c.code] === undefined;

/** The rank number alone (`1`); the header says "Rank of N". `null` when the county has no rank. */
export const rankNumber = (row: CountyRow): string | null => (row.status === 'Ranked' ? row.rank.split(' of ')[0] ?? null : null);

/** A `/need-map` link that keeps the FAS filter and the selected county; `cols=all` only for the full view. */
export function needMapHref(opts: { fas?: boolean; county?: string | null; cols?: ColumnMode }): string {
  const q = new URLSearchParams();
  if (opts.county) q.set('county', opts.county);
  if (opts.fas) q.set('fas', '1');
  if (opts.cols === 'all') q.set('cols', 'all');
  const s = q.toString();
  return s ? `/need-map?${s}` : '/need-map';
}
