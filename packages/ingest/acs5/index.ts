import { createHash } from 'node:crypto';
import { COUNTIES } from '../../../lib/synthetic/generate';
import { CensusTable } from '../census-table';
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
const UTAH = new Set(COUNTIES.map((c) => c.fips));

export type Acs5Parse = { rows: IndicatorRow[]; rejects: string[] };

export class Acs5 {
  static readonly SOURCE_NAME = 'census-acs';
  static readonly NOT_PUBLISHED = 'not_published';

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
    const key = env.CENSUS_API_KEY;
    if (!key) throw new Error('CENSUS_API_KEY is not set');
    const res = await httpFetch(Acs5.requestUrl(year, key));
    if (!res.ok) throw new Error(`ACS fetch failed: ${res.status}`);
    return res.json();
  }

  static num(raw: string | undefined): number | null | undefined {
    if (raw == null || raw === '' || raw === 'N/A' || raw === '-') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
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
      if (!UTAH.has(geo_fips)) continue;
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
    if (parsed.rejects.length > 0) throw new Error(`ACS rejected ${parsed.rejects.length} rows`);
    const n = new Map<string, number>();
    for (const r of parsed.rows) n.set(r.geo_fips, (n.get(r.geo_fips) ?? 0) + 1);
    if ([...n.values()].some((c) => c !== 3) || n.size !== COUNTIES.length) {
      throw new Error(`ACS partial response: ${n.size} counties`);
    }
    if (new Set(parsed.rows.map((r) => r.period).filter(Boolean)).size > 1) {
      throw new Error('ACS mixed vintages');
    }
    return parsed.rows.map((r) => ({ ...r, period: year, vintage: year }));
  }

  static checksum(rows: IndicatorRow[]): string {
    const key = (r: IndicatorRow) => `${r.geo_fips}:${r.indicator_code}`;
    const sorted = [...rows].sort((a, b) => key(a).localeCompare(key(b)));
    return createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
  }
}
