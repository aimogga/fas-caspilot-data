import { createHash } from 'node:crypto';
import { COUNTIES } from '../../../lib/synthetic/generate';
import { CensusTable } from '../census-table';
import type { IndicatorRow } from '../public-indicator';

const CODES = ['population_total', 'avg_household_size', 'veterans_count'] as const;
type Code = (typeof CODES)[number];
const UNITS: Record<Code, string> = {
  population_total: 'count',
  avg_household_size: 'persons',
  veterans_count: 'count',
};
const FIELDS: Record<Code, readonly [string, string]> = {
  population_total: ['B01003_001E', 'B01003_001M'],
  avg_household_size: ['B25010_001E', 'B25010_001M'],
  veterans_count: ['B21001_002E', 'B21001_002M'],
};
const UTAH = new Set(COUNTIES.map((c) => c.fips));

export type Acs5Parse = { rows: IndicatorRow[]; rejects: string[] };

/** ACS 5-year county denominators: total population, household size, veterans. */
export class Acs5 {
  static readonly SOURCE_NAME = 'census-acs';
  static readonly NOT_PUBLISHED = 'not_published';
  static readonly VARIABLES = CODES.flatMap((c) => [...FIELDS[c]]);

  static requestUrl(year: string, key: string): URL {
    const get = ['NAME', ...Acs5.VARIABLES].join(',');
    const q = `get=${get}&for=county:*&in=state:49&key=${encodeURIComponent(key)}`;
    return new URL(`https://api.census.gov/data/${year}/acs/acs5?${q}`);
  }

  static async fetch(
    year: string,
    env: Record<string, string | undefined> = process.env,
    httpFetch: typeof fetch = fetch,
  ): Promise<unknown> {
    const key = env.CENSUS_API_KEY;
    if (!key) {
      throw new Error('CENSUS_API_KEY is not set');
    }
    const res = await httpFetch(Acs5.requestUrl(year, key));
    if (!res.ok) {
      throw new Error(`ACS fetch failed: ${res.status}`);
    }
    return res.json();
  }

  /** null = Census annotation (negative sentinel such as -666666666); undefined = not numeric. */
  static num(raw: string | undefined): number | null | undefined {
    if (raw == null || raw === '' || raw === 'null') {
      return null;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      return undefined;
    }
    return n <= -100000000 ? null : n;
  }

  static fips(row: Record<string, string>): string | null {
    const state = row.state ?? '';
    const county = row.county ?? '';
    if (!/^\d{2}$/.test(state) || !/^\d{3}$/.test(county)) {
      return null;
    }
    return `${state}${county}`;
  }

  static bad(code: Code, value: number | null | undefined, moe: number | null | undefined, fips: string): string | null {
    if (value === undefined) {
      return `${fips} ${code} not numeric`;
    }
    if (moe === undefined) {
      return `${fips} ${code} moe not numeric`;
    }
    if (value != null && value < 0) {
      return `${fips} ${code} < 0`;
    }
    return moe != null && moe < 0 ? `${fips} ${code} moe < 0` : null;
  }

  static parse(json: unknown, year: string): Acs5Parse {
    const rows: IndicatorRow[] = [];
    const rejects: string[] = [];
    const table = CensusTable.parse(json);
    const header = Array.isArray(json) ? (json[0] as string[]) : [];
    const absent = Acs5.VARIABLES.filter((v) => !header.includes(v));
    if (absent.length > 0) {
      rejects.push(`missing columns ${absent.join(',')}`);
    }
    for (const row of table) {
      const geo_fips = Acs5.fips(row);
      if (!geo_fips) {
        rejects.push('missing FIPS');
        continue;
      }
      if (!UTAH.has(geo_fips)) {
        continue;
      }
      for (const code of CODES) {
        const value = Acs5.num(row[FIELDS[code][0]]);
        const moe = Acs5.num(row[FIELDS[code][1]]);
        const err = Acs5.bad(code, value, moe, geo_fips);
        if (err) {
          rejects.push(err);
          continue;
        }
        rows.push({
          indicator_code: code,
          geo_fips,
          period: year,
          value: value ?? null,
          moe: moe ?? null,
          unit: value == null ? Acs5.NOT_PUBLISHED : UNITS[code],
          vintage: year,
        });
      }
    }
    return { rows, rejects };
  }

  static requireComplete(parsed: Acs5Parse): IndicatorRow[] {
    if (parsed.rejects.length > 0) {
      throw new Error(`ACS rejected ${parsed.rejects.length} rows`);
    }
    const n = new Map<string, number>();
    for (const r of parsed.rows) {
      n.set(r.geo_fips, (n.get(r.geo_fips) ?? 0) + 1);
    }
    if ([...n.values()].some((c) => c !== CODES.length) || n.size !== COUNTIES.length) {
      throw new Error(`ACS partial response: ${n.size} counties`);
    }
    return parsed.rows;
  }

  static checksum(rows: IndicatorRow[]): string {
    const key = (r: IndicatorRow) => `${r.geo_fips}:${r.indicator_code}`;
    const sorted = [...rows].sort((a, b) => key(a).localeCompare(key(b)));
    return createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
  }
}
