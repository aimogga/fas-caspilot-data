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
const UTAH = new Set(COUNTIES.map((c) => c.fips));

export type SahieParse = { rows: IndicatorRow[]; rejects: string[] };

export class Sahie {
  static readonly SOURCE_NAME = 'census-sahie';
  static readonly ENDPOINT = 'https://api.census.gov/data/timeseries/healthins/sahie';
  static readonly NOT_PUBLISHED = 'not_published';

  static requestUrl(year: string, key: string): URL {
    const q = `get=NAME,GEOID,NUI_PT,NUI_MOE,PCTUI_PT,PCTUI_MOE,YEAR&for=county:*&in=state:49&time=${year}&AGECAT=0&SEXCAT=0&RACECAT=0&IPRCAT=0&key=${encodeURIComponent(key)}`;
    return new URL(`${Sahie.ENDPOINT}?${q}`);
  }

  static async fetch(
    year: string,
    env: Record<string, string | undefined> = process.env,
    httpFetch: typeof fetch = fetch,
  ): Promise<unknown> {
    const key = env.CENSUS_API_KEY;
    if (!key) throw new Error('CENSUS_API_KEY is not set');
    const res = await httpFetch(Sahie.requestUrl(year, key));
    if (!res.ok) throw new Error(`SAHIE fetch failed: ${res.status}`);
    return res.json();
  }

  static num(raw: string | undefined): number | null | undefined {
    if (raw == null || raw === '' || raw === 'N/A') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
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
      if (!UTAH.has(geo_fips)) continue;
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
    if (parsed.rejects.length > 0) throw new Error(`SAHIE rejected ${parsed.rejects.length} rows`);
    const n = new Map<string, number>();
    for (const r of parsed.rows) n.set(r.geo_fips, (n.get(r.geo_fips) ?? 0) + 1);
    if ([...n.values()].some((c) => c !== 2) || n.size !== COUNTIES.length) {
      throw new Error(`SAHIE partial response: ${n.size} counties`);
    }
    return parsed.rows;
  }

  static checksum(rows: IndicatorRow[]): string {
    const key = (r: IndicatorRow) => `${r.geo_fips}:${r.indicator_code}`;
    const sorted = [...rows].sort((a, b) => key(a).localeCompare(key(b)));
    return createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
  }
}
