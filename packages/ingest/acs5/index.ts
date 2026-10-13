import { CensusTable, CENSUS_NOT_PUBLISHED, UTAH_COUNTY_FIPS } from '../census-table';
import type { IndicatorRow } from '../public-indicator';

const CODES = ['total_population', 'total_households', 'veteran_population'] as const;
const UNITS = {
  total_population: 'count',
  total_households: 'count',
  veteran_population: 'count',
} as const;
const VARIABLES = {
  total_population: 'B01003_001E',
  total_households: 'B11001_001E',
  veteran_population: 'B21001_002E',
} as const;

export type Acs5Parse = { rows: IndicatorRow[]; rejects: string[] };

export class Acs5 {
  static readonly SOURCE_NAME = 'census-acs';
  static readonly NOT_PUBLISHED = CENSUS_NOT_PUBLISHED;

  static requestUrl(year: string, key: string): URL {
    const vars = Object.values(VARIABLES).join(',');
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

  static fips(row: Record<string, string>): string | null {
    const county = (row.county ?? '').replace(/\D/g, '');
    const fips = `${(row.state ?? '').replace(/\D/g, '')}${county.padStart(3, '0')}`;
    return county.length > 0 && /^49\d{3}$/.test(fips) ? fips : null;
  }

  static bad(
    code: (typeof CODES)[number],
    value: number | null | undefined,
    fips: string,
  ): string | null {
    if (value === undefined) return `${fips} ${code} not numeric`;
    if (value != null && value < 0) return `${fips} ${code} < 0`;
    return null;
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
      for (const code of CODES) {
        const value = Acs5.num(row[VARIABLES[code]]);
        const err = Acs5.bad(code, value, geo_fips);
        if (err) {
          rejects.push(err);
          continue;
        }
        rows.push({
          indicator_code: code,
          geo_fips,
          period: '',
          value: value ?? null,
          moe: null,
          unit: value == null ? Acs5.NOT_PUBLISHED : UNITS[code],
          vintage: '',
        });
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
