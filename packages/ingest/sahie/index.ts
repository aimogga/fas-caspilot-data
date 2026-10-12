import { createHash } from 'node:crypto';
import { COUNTIES } from '../../../lib/synthetic/generate';
import { CensusTable } from '../census-table';
import type { IndicatorRow } from '../public-indicator';

const CODES = ['uninsured_count', 'uninsured_rate'] as const;
const UNITS = { uninsured_count: 'count', uninsured_rate: 'percent' } as const;
const FIELDS = {
  uninsured_count: ['NUI_PT', 'NUI_MOE'],
  uninsured_rate: ['PCTUI_PT', 'PCTUI_MOE'],
} as const;
const FILTERS = { AGECAT: '0', SEXCAT: '0', RACECAT: '0', IPRCAT: '0' } as const;

export class Sahie {
  static readonly SOURCE_NAME = 'census-sahie';
  static readonly ENDPOINT = 'https://api.census.gov/data/timeseries/healthins/sahie';
  static readonly NOT_PUBLISHED = 'not_published';
  static readonly DEFAULT_YEAR = '2024';

  static requestUrl(year: string, key: string): URL {
    const url = new URL(Sahie.ENDPOINT);
    url.searchParams.set('get', 'NAME,GEOID,NUI_PT,NUI_MOE,PCTUI_PT,PCTUI_MOE,YEAR');
    url.searchParams.set('for', 'county:*');
    url.searchParams.set('in', 'state:49');
    url.searchParams.set('time', year);
    for (const [k, v] of Object.entries(FILTERS)) {
      url.searchParams.set(k, v);
    }
    url.searchParams.set('key', key);
    return url;
  }

  static async fetch(
    year = Sahie.DEFAULT_YEAR,
    env: Record<string, string | undefined> = process.env,
    httpFetch: typeof fetch = fetch,
  ): Promise<unknown> {
    const key = env.CENSUS_API_KEY;
    if (!key) throw new Error('CENSUS_API_KEY is not set');
    const res = await httpFetch(Sahie.requestUrl(year, key));
    if (!res.ok) throw new Error(`SAHIE fetch failed: ${res.status}`);
    return res.json();
  }

  static num(raw: string | undefined): number | null {
    if (raw == null || raw === '' || raw === 'N/A') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  static fips(row: Record<string, string>): string | null {
    const geo = (row.GEOID ?? '').replace(/\D/g, '');
    if (/^49\d{3}$/.test(geo)) return geo;
    const county = (row.county ?? '').replace(/\D/g, '');
    const state = (row.state ?? '').replace(/\D/g, '');
    const fips = `${state}${county.padStart(3, '0')}`;
    if (county.length === 0) return null;
    return /^49\d{3}$/.test(fips) ? fips : null;
  }

  static kept(row: Record<string, string>): boolean {
    for (const [key, want] of Object.entries(FILTERS)) {
      if (key in row && row[key] !== want) return false;
    }
    return true;
  }

  static parse(json: unknown): IndicatorRow[] {
    const out: IndicatorRow[] = [];
    for (const row of CensusTable.parse(json)) {
      if (!Sahie.kept(row)) continue;
      const geo_fips = Sahie.fips(row);
      const vintage = row.YEAR ?? row.time;
      if (!geo_fips || !vintage) continue;
      for (const code of CODES) {
        const value = Sahie.num(row[FIELDS[code][0]]);
        out.push({
          indicator_code: code,
          geo_fips,
          period: vintage,
          value,
          moe: Sahie.num(row[FIELDS[code][1]]),
          unit: value == null ? Sahie.NOT_PUBLISHED : UNITS[code],
          vintage,
        });
      }
    }
    return out;
  }

  static coverUtah(rows: IndicatorRow[]): IndicatorRow[] {
    const vintage = rows[0]?.vintage;
    const period = rows[0]?.period;
    if (!vintage || !period) throw new Error('SAHIE rows need vintage and period');
    const seen = new Set(rows.map((r) => `${r.geo_fips}:${r.indicator_code}`));
    const out = [...rows];
    for (const c of COUNTIES) {
      for (const code of CODES) {
        if (seen.has(`${c.fips}:${code}`)) continue;
        out.push({
          indicator_code: code,
          geo_fips: c.fips,
          period,
          value: null,
          moe: null,
          unit: Sahie.NOT_PUBLISHED,
          vintage,
        });
      }
    }
    return out;
  }

  static checksum(rows: IndicatorRow[]): string {
    const sorted = [...rows].sort((a, b) => {
      return `${a.geo_fips}:${a.indicator_code}`.localeCompare(`${b.geo_fips}:${b.indicator_code}`);
    });
    return createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
  }
}
