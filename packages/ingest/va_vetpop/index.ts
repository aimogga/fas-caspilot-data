import { COUNTIES } from '../../../lib/synthetic/generate';
import { CensusTable, CENSUS_NOT_PUBLISHED, UTAH_COUNTY_FIPS } from '../census-table';
import type { IndicatorRow } from '../public-indicator';

/**
 * Candidate Socrata column names for dataset jrjd-qghv; the first key present on a row wins. The live schema is unverified:
 * QA confirms with `curl -s 'https://www.data.va.gov/resource/jrjd-qghv.json?$limit=1' | jq 'keys'` and trims these lists.
 */
export const COLUMNS = {
  state: ['state', 'state_name', 'stateabbr'],
  county: ['county', 'county_name'],
  fips: ['fips', 'county_fips', 'geoid'],
  year: ['fiscal_year', 'year', 'fy'],
  value: ['veterans', 'total_veterans', 'vetpop', 'value'],
} as const;
const CODE = 'veterans_count';
const UTAH = new Set(['ut', 'utah', '49']);
const BY_NAME = new Map(COUNTIES.map((c) => [c.name.toLowerCase(), c.fips]));
type Raw = Record<string, unknown>;
type Schema = { state: string | null; county: string | null; fips: string | null; year: string; value: string };

export type VetpopParse = { rows: IndicatorRow[]; rejects: string[] };

/** Living veterans per Utah county, latest fiscal year, rounded to the nearest thousand (DATA_SOURCES.md).
 * Veterans per 1,000 is NOT computed here: the need score divides by geo_county.population_latest (PRD §C4). */
export class VaVetpop {
  static readonly SOURCE_NAME = 'va-vetpop';
  static readonly HOST = 'https://www.data.va.gov';
  static readonly DATASET = 'jrjd-qghv';
  static readonly NOT_PUBLISHED = CENSUS_NOT_PUBLISHED;

  /**
   * Full-text `$q=Utah` instead of a `$where` on guessed column names: Socrata answers 400 for a `$where` that names
   * a column the dataset lacks, so the request itself must not depend on the unverified schema. State and fiscal
   * year are filtered client-side in parse() (`year` narrows to one fiscal year; omitted = dataset latest).
   */
  static requestUrl(year?: string): URL {
    const q = new URLSearchParams({ $select: '*', $q: year ? `Utah ${year}` : 'Utah', $limit: '5000' });
    return new URL(`${VaVetpop.HOST}/resource/${VaVetpop.DATASET}.json?${q}`);
  }

  /** GET a Socrata resource; fails closed on non-2xx or non-array without echoing the query string. */
  static async fetchJson(url: URL, label: string, httpFetch: typeof fetch = fetch, token?: string): Promise<unknown> {
    const res = await httpFetch(url, token ? { headers: { 'X-App-Token': token } } : undefined);
    if (!res.ok) throw new Error(`${label} fetch failed: ${res.status}`);
    const json: unknown = await res.json();
    if (!Array.isArray(json)) throw new Error(`${label} response must be a JSON array`);
    return json;
  }

  static fetch(year?: string, env: Record<string, string | undefined> = process.env, httpFetch = fetch): Promise<unknown> {
    return VaVetpop.fetchJson(VaVetpop.requestUrl(year), 'VetPop', httpFetch, env.SOCRATA_APP_TOKEN);
  }

  static pick(row: Raw, keys: readonly string[]): string | null {
    return keys.find((k) => Object.prototype.hasOwnProperty.call(row, k)) ?? null;
  }

  /** Resolve columns from the first row; a schema without a value or a geography column can never load zeros. */
  static schema(first: Raw): Schema {
    const [state, county, fips, year, value] = (['state', 'county', 'fips', 'year', 'value'] as const).map((k) => VaVetpop.pick(first, COLUMNS[k]));
    if (!value || !year || !(fips || (county && state))) {
      throw new Error(`VetPop: unknown columns ${Object.keys(first).sort().join(',')}`);
    }
    return { state, county, fips, year, value };
  }

  static fips(row: Raw, col: Schema): string | null {
    const geo = col.fips ? String(row[col.fips] ?? '').replace(/\D/g, '') : '';
    if (/^\d{5}$/.test(geo)) return geo;
    if (!col.state || !col.county) return null;
    const name = String(col.county ? row[col.county] ?? '' : '').trim().replace(/\s+county$/i, '').toLowerCase();
    return BY_NAME.get(name) ?? null;
  }

  /** Nearest thousand, half up: 12,345 → 12,000; 12,500 → 13,000. */
  static roundThousands = (n: number): number => Math.round(n / 1000) * 1000;

  static parse(json: unknown): VetpopParse {
    if (!Array.isArray(json)) throw new Error('VetPop response must be a JSON array');
    if (json.length === 0) throw new Error('VetPop empty response');
    const col = VaVetpop.schema(json[0] as Raw);
    const rejects: string[] = [];
    const seen: Array<{ geo_fips: string; year: string; value: number | null }> = [];
    for (const row of json as Raw[]) {
      const st = col.state ? String(row[col.state] ?? '').trim().toLowerCase() : null;
      if (st !== null && !UTAH.has(st)) continue;
      const geo_fips = VaVetpop.fips(row, col);
      if (!geo_fips) {
        if (st !== null) rejects.push(`unknown county ${String(row[col.county ?? ''] ?? '')}`);
        continue;
      }
      if (!UTAH_COUNTY_FIPS.has(geo_fips)) continue;
      const year = /^(?:FY)?(\d{4})/i.exec(String(row[col.year] ?? '').trim())?.[1];
      if (!year) {
        rejects.push(`${geo_fips} missing year`);
        continue;
      }
      const raw = row[col.value];
      const value = raw == null ? null : CensusTable.num(String(raw));
      const bad = value === undefined ? 'not numeric' : value != null && value < 0 ? '< 0' : value != null && !Number.isInteger(value) ? 'not an integer' : null;
      if (bad) rejects.push(`${geo_fips} ${CODE} ${bad}`);
      else seen.push({ geo_fips, year, value: value ?? null });
    }
    if (seen.length === 0 && rejects.length === 0) throw new Error('VetPop: no Utah rows');
    if (seen.length === 0) return { rows: [], rejects };
    const vintage = seen.map((r) => r.year).sort().at(-1) as string;
    const rows: IndicatorRow[] = [];
    for (const r of seen.filter((r) => r.year === vintage)) {
      if (rows.some((x) => x.geo_fips === r.geo_fips)) rejects.push(`${r.geo_fips} duplicate row`);
      const value = r.value == null ? null : VaVetpop.roundThousands(r.value);
      rows.push({ indicator_code: CODE, geo_fips: r.geo_fips, period: vintage, value, moe: null, unit: value == null ? VaVetpop.NOT_PUBLISHED : 'count', vintage });
    }
    for (const geo_fips of [...UTAH_COUNTY_FIPS].filter((f) => !rows.some((r) => r.geo_fips === f))) {
      rows.push({ indicator_code: CODE, geo_fips, period: vintage, value: null, moe: null, unit: VaVetpop.NOT_PUBLISHED, vintage });
    }
    return { rows, rejects };
  }

  static requireComplete(parsed: VetpopParse): IndicatorRow[] {
    CensusTable.requireCountyCoverage(parsed.rows, parsed.rejects, 1, 'VetPop');
    if (new Set(parsed.rows.map((r) => r.vintage)).size !== 1) throw new Error('VetPop mixed vintages');
    return parsed.rows;
  }

  static checksum = CensusTable.checksum;
}
