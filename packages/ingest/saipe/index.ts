import { CensusTable, CENSUS_NOT_PUBLISHED, UTAH_COUNTY_FIPS } from '../census-table';
import { Sahie } from '../sahie';
import type { IndicatorRow } from '../public-indicator';

const CODES = ['poverty_count', 'poverty_rate', 'child_poverty_count', 'child_poverty_rate'] as const;
const UNITS = { poverty_count: 'count', poverty_rate: 'percent', child_poverty_count: 'count', child_poverty_rate: 'percent' } as const;
const FIELDS = {
  poverty_count: ['SAEPOVALL_PT', 'SAEPOVALL_MOE'],
  poverty_rate: ['SAEPOVRTALL_PT', 'SAEPOVRTALL_MOE'],
  child_poverty_count: ['SAEPOV0_17_PT', 'SAEPOV0_17_MOE'],
  child_poverty_rate: ['SAEPOVRT0_17_PT', 'SAEPOVRT0_17_MOE'],
} as const;

export type SaipeParse = { rows: IndicatorRow[]; rejects: string[] };

export class Saipe {
  static readonly SOURCE_NAME = 'census-saipe';
  static readonly ENDPOINT = 'https://api.census.gov/data/timeseries/poverty/saipe';
  static readonly NOT_PUBLISHED = CENSUS_NOT_PUBLISHED;
  static readonly CODES = CODES;

  static requestUrl(year: string, key: string): URL {
    const vars = 'SAEPOVALL_PT,SAEPOVALL_MOE,SAEPOVRTALL_PT,SAEPOVRTALL_MOE,SAEPOV0_17_PT,SAEPOV0_17_MOE,SAEPOVRT0_17_PT,SAEPOVRT0_17_MOE';
    const q = `get=NAME,GEOID,${vars},YEAR&for=county:*&in=state:49&time=${year}&key=${encodeURIComponent(key)}`;
    return new URL(`${Saipe.ENDPOINT}?${q}`);
  }

  static async fetch(year: string, env: Record<string, string | undefined> = process.env, httpFetch = fetch): Promise<unknown> {
    return CensusTable.fetchJson((key) => Saipe.requestUrl(year, key), 'SAIPE', env, httpFetch);
  }

  static fips(row: Record<string, string>): string | null {
    const geo = (row.GEOID ?? '').replace(/\D/g, '');
    if (/^\d{5}$/.test(geo)) return geo;
    const county = (row.county ?? '').replace(/\D/g, '');
    const fips = `${(row.state ?? '').replace(/\D/g, '')}${county.padStart(3, '0')}`;
    return county.length > 0 && /^\d{5}$/.test(fips) ? fips : null;
  }

  static bad(code: (typeof CODES)[number], value: number | null | undefined, moe: number | null | undefined, fips: string): string | null {
    if (value === undefined) return `${fips} ${code} not numeric`;
    if (moe === undefined) return `${fips} ${code} moe not numeric`;
    if (value != null && value < 0) return `${fips} ${code} < 0`;
    if (value != null && UNITS[code] === 'percent' && value > 100) return `${fips} ${code} out of range`;
    return moe != null && moe < 0 ? `${fips} ${code} moe < 0` : null;
  }

  static parse(json: unknown): SaipeParse {
    const rows: IndicatorRow[] = [];
    const rejects: string[] = [];
    for (const row of CensusTable.parse(json)) {
      const geo_fips = Saipe.fips(row);
      const vintage = (row.YEAR ?? row.time ?? '').trim();
      if (!geo_fips) {
        rejects.push('missing FIPS');
        continue;
      }
      if (!/^\d{4}$/.test(vintage)) {
        rejects.push(`${geo_fips} missing year`);
        continue;
      }
      if (!UTAH_COUNTY_FIPS.has(geo_fips)) continue;
      for (const code of CODES) {
        const value = Sahie.num(row[FIELDS[code][0]]);
        const moe = Sahie.num(row[FIELDS[code][1]]);
        const err = Saipe.bad(code, value, moe, geo_fips);
        if (err) {
          rejects.push(err);
          continue;
        }
        const unit = value == null ? Saipe.NOT_PUBLISHED : UNITS[code];
        rows.push({ indicator_code: code, geo_fips, period: vintage, value: value ?? null, moe: moe ?? null, unit, vintage });
      }
    }
    return { rows, rejects };
  }

  static requireComplete(parsed: SaipeParse): IndicatorRow[] {
    CensusTable.requireCountyCoverage(parsed.rows, parsed.rejects, CODES.length, 'SAIPE');
    if (new Set(parsed.rows.map((r) => r.vintage)).size !== 1) throw new Error('SAIPE mixed vintages');
    return parsed.rows;
  }

  static checksum(rows: IndicatorRow[]): string {
    return CensusTable.checksum(rows);
  }
}
