import { CensusTable, CENSUS_NOT_PUBLISHED, UTAH_COUNTY_FIPS } from '../census-table';
import type { IndicatorRow } from '../public-indicator';

const RAW = ['total_population', 'total_households', 'veteran_population', 'single_parent_households', 'no_vehicle_households'] as const;
const CODES = [...RAW, 'single_parent_pct', 'no_vehicle_pct'] as const;
type RawCode = (typeof RAW)[number];
type Code = (typeof CODES)[number];
type DerivedCode = Exclude<Code, RawCode>;
const UNITS: Record<Code, 'count' | 'percent'> = {
  total_population: 'count',
  total_households: 'count',
  veteran_population: 'count',
  single_parent_households: 'count',
  no_vehicle_households: 'count',
  single_parent_pct: 'percent',
  no_vehicle_pct: 'percent',
};
/** ACS cells per raw count; a multi-cell code is summed (B11003: male + female householder, no spouse present, own children < 18). */
const VARIABLES: Record<RawCode, readonly string[]> = {
  total_population: ['B01003_001E'],
  total_households: ['B11001_001E'],
  veteran_population: ['B21001_002E'],
  single_parent_households: ['B11003_010E', 'B11003_016E'],
  no_vehicle_households: ['B08201_002E'],
};
/** Derived percentages: count ÷ total_households (B11001_001E) × 100, 1 decimal, no MOE. */
const DERIVED: Record<DerivedCode, RawCode> = { single_parent_pct: 'single_parent_households', no_vehicle_pct: 'no_vehicle_households' };

export type Acs5Parse = { rows: IndicatorRow[]; rejects: string[] };

export class Acs5 {
  static readonly SOURCE_NAME = 'census-acs';
  static readonly NOT_PUBLISHED = CENSUS_NOT_PUBLISHED;
  static readonly CODES = CODES;

  static requestUrl(year: string, key: string): URL {
    const vars = Object.values(VARIABLES).flat().join(',');
    const q = `get=NAME,${vars}&for=county:*&in=state:49&key=${encodeURIComponent(key)}`;
    return new URL(`https://api.census.gov/data/${year}/acs/acs5?${q}`);
  }

  static async fetch(
    year: string,
    env: Record<string, string | undefined> = process.env,
    httpFetch: typeof fetch = fetch,
  ): Promise<unknown> {
    return CensusTable.fetchJson((key) => Acs5.requestUrl(year, key), 'ACS', env, httpFetch);
  }

  /** ACS treats "-" as null in addition to empty/N/A. */
  static num(raw: string | undefined): number | null | undefined {
    return CensusTable.num(raw, ['-']);
  }

  /** Sum of a code's cells: undefined when any cell is non-numeric, null when any cell is not published. */
  static sum(row: Record<string, string>, cells: readonly string[]): number | null | undefined {
    const values = cells.map((v) => Acs5.num(row[v]));
    if (values.some((n) => n === undefined)) return undefined;
    return values.some((n) => n === null) ? null : values.reduce<number>((total, n) => total + (n ?? 0), 0);
  }

  /** count ÷ denominator × 100 rounded to 1 decimal; null when either is null or the denominator is 0. */
  static pct(count: number | null | undefined, denominator: number | null | undefined): number | null {
    if (count == null || denominator == null || denominator === 0) return null;
    return Math.round((count / denominator) * 1000) / 10;
  }

  static fips(row: Record<string, string>): string | null {
    const county = (row.county ?? '').replace(/\D/g, '');
    const fips = `${(row.state ?? '').replace(/\D/g, '')}${county.padStart(3, '0')}`;
    return county.length > 0 && /^49\d{3}$/.test(fips) ? fips : null;
  }

  static bad(
    code: RawCode,
    value: number | null | undefined,
    fips: string,
  ): string | null {
    if (value === undefined) return `${fips} ${code} not numeric`;
    if (value != null && value < 0) return `${fips} ${code} < 0`;
    return null;
  }

  static row(code: Code, geo_fips: string, value: number | null): IndicatorRow {
    const unit = value == null ? Acs5.NOT_PUBLISHED : UNITS[code];
    return { indicator_code: code, geo_fips, period: '', value, moe: null, unit, vintage: '' };
  }

  static parse(json: unknown): Acs5Parse {
    const rows: IndicatorRow[] = [];
    const rejects: string[] = [];
    for (const row of CensusTable.parse(json)) {
      const geo_fips = Acs5.fips(row);
      if (!geo_fips) {
        rejects.push('missing FIPS');
        continue;
      }
      if (!UTAH_COUNTY_FIPS.has(geo_fips)) continue;
      const counts: Partial<Record<RawCode, number | null>> = {};
      for (const code of RAW) {
        const value = Acs5.sum(row, VARIABLES[code]);
        const err = Acs5.bad(code, value, geo_fips);
        if (err) {
          rejects.push(err);
          continue;
        }
        counts[code] = value ?? null;
        rows.push(Acs5.row(code, geo_fips, value ?? null));
      }
      for (const [code, from] of Object.entries(DERIVED) as [DerivedCode, RawCode][]) {
        rows.push(Acs5.row(code, geo_fips, Acs5.pct(counts[from], counts.total_households)));
      }
    }
    return { rows, rejects };
  }

  static requireComplete(parsed: Acs5Parse, year: string): IndicatorRow[] {
    CensusTable.requireCountyCoverage(parsed.rows, parsed.rejects, CODES.length, 'ACS');
    return parsed.rows.map((r) => ({ ...r, period: year, vintage: year }));
  }

  static checksum(rows: IndicatorRow[]): string {
    return CensusTable.checksum(rows);
  }
}
