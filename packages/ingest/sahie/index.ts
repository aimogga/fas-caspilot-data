import { CensusTable, CENSUS_NOT_PUBLISHED, UTAH_COUNTY_FIPS } from '../census-table';
import type { IndicatorRow } from '../public-indicator';

const CODES = ['uninsured_count', 'uninsured_rate'] as const;
const UNITS = { uninsured_count: 'count', uninsured_rate: 'percent' } as const;
const FIELDS = {
  uninsured_count: ['NUI_PT', 'NUI_MOE'],
  uninsured_rate: ['PCTUI_PT', 'PCTUI_MOE'],
} as const;
const FILTERS = { AGECAT: '0', SEXCAT: '0', RACECAT: '0', IPRCAT: '0' } as const;

export type SahieParse = { rows: IndicatorRow[]; rejects: string[] };

export class Sahie {
  static readonly SOURCE_NAME = 'census-sahie';
  static readonly ENDPOINT = 'https://api.census.gov/data/timeseries/healthins/sahie';
  static readonly NOT_PUBLISHED = CENSUS_NOT_PUBLISHED;

  static requestUrl(year: string, key: string): URL {
    const q = `get=NAME,GEOID,NUI_PT,NUI_MOE,PCTUI_PT,PCTUI_MOE,YEAR&for=county:*&in=state:49&time=${year}&AGECAT=0&SEXCAT=0&RACECAT=0&IPRCAT=0&key=${encodeURIComponent(key)}`;
    return new URL(`${Sahie.ENDPOINT}?${q}`);
  }

  static async fetch(
    year: string,
    env: Record<string, string | undefined> = process.env,
    httpFetch: typeof fetch = fetch,
  ): Promise<unknown> {
    return CensusTable.fetchJson((key) => Sahie.requestUrl(year, key), 'SAHIE', env, httpFetch);
  }

  static num(raw: string | undefined): number | null | undefined {
    return CensusTable.num(raw);
  }

  static fips(row: Record<string, string>): string | null {
    const geo = (row.GEOID ?? '').replace(/\D/g, '');
    if (/^49\d{3}$/.test(geo)) return geo;
    const county = (row.county ?? '').replace(/\D/g, '');
    const fips = `${(row.state ?? '').replace(/\D/g, '')}${county.padStart(3, '0')}`;
    return county.length > 0 && /^49\d{3}$/.test(fips) ? fips : null;
  }

  static kept(row: Record<string, string>): boolean {
    return Object.entries(FILTERS).every(([k, v]) => !(k in row) || row[k] === v);
  }

  static bad(
    code: (typeof CODES)[number],
    value: number | null | undefined,
    moe: number | null | undefined,
    fips: string,
  ): string | null {
    if (value === undefined) return `${fips} ${code} not numeric`;
    if (moe === undefined) return `${fips} ${code} moe not numeric`;
    if (value != null && code === 'uninsured_count' && value < 0) return `${fips} count < 0`;
    if (value != null && code === 'uninsured_rate' && (value < 0 || value > 100)) {
      return `${fips} rate out of range`;
    }
    return moe != null && moe < 0 ? `${fips} ${code} moe < 0` : null;
  }

  static parse(json: unknown): SahieParse {
    const rows: IndicatorRow[] = [];
    const rejects: string[] = [];
    for (const row of CensusTable.parse(json)) {
      if (!Sahie.kept(row)) continue;
      const geo_fips = Sahie.fips(row);
      const vintage = (row.YEAR ?? row.time ?? '').trim();
      if (!geo_fips) {
        rejects.push('missing FIPS');
        continue;
      }
      if (!vintage) {
        rejects.push(`${geo_fips} missing year`);
        continue;
      }
      if (!UTAH_COUNTY_FIPS.has(geo_fips)) continue;
      for (const code of CODES) {
        const value = Sahie.num(row[FIELDS[code][0]]);
        const moe = Sahie.num(row[FIELDS[code][1]]);
        const err = Sahie.bad(code, value, moe, geo_fips);
        if (err) {
          rejects.push(err);
          continue;
        }
        rows.push({
          indicator_code: code,
          geo_fips,
          period: vintage,
          value: value ?? null,
          moe: moe ?? null,
          unit: value == null ? Sahie.NOT_PUBLISHED : UNITS[code],
          vintage,
        });
      }
    }
    return { rows, rejects };
  }

  static requireComplete(parsed: SahieParse): IndicatorRow[] {
    CensusTable.requireCountyCoverage(parsed.rows, parsed.rejects, CODES.length, 'SAHIE');
    return parsed.rows;
  }

  static checksum(rows: IndicatorRow[]): string {
    return CensusTable.checksum(rows);
  }
}
