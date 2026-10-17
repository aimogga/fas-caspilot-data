import { CensusTable, CENSUS_NOT_PUBLISHED, UTAH_COUNTY_FIPS } from '../census-table';
import type { IndicatorRow } from '../public-indicator';

/**
 * Socrata columns of dataset jrjd-qghv, checked live 2026-10-17 (#209): one row per county × fiscal year × age group × sex,
 * `date` is the fiscal-year end (`2026-09-30T00:00:00.000`), FY2023 base through FY2053 projections.
 */
export const COLUMNS = { state: 'state', fips: 'fips', date: 'date', ageGroup: 'age_group', sex: 'sex', value: 'veterans' } as const;
const CODE = 'veterans_count';
type Raw = Record<string, unknown>;

export type VetpopParse = { rows: IndicatorRow[]; rejects: string[] };

/** Living veterans per Utah county per fiscal year (FY2023, the VetPop2023 base, through the latest ended FY), summed over
 * age group × sex, rounded to the nearest thousand (DATA_SOURCES.md). One row per county per year; readers take the newest. Veterans per 1,000 is NOT computed here: the need score divides by geo_county.population_latest (PRD §C4). */
export class VaVetpop {
  static readonly SOURCE_NAME = 'va-vetpop';
  static readonly HOST = 'https://www.data.va.gov';
  static readonly DATASET = 'jrjd-qghv';
  static readonly NOT_PUBLISHED = CENSUS_NOT_PUBLISHED;
  /** VetPop2023's base year; earlier years are not in the model and later ones are kept as history (George, 2026-10-17). */
  static readonly FIRST_YEAR = '2023';

  /** The latest federal fiscal year that has ended (FY ends 30 September), so a run never loads a future projection. */
  static fiscalYear(now: Date): string {
    return String(now.getUTCMonth() >= 9 ? now.getUTCFullYear() : now.getUTCFullYear() - 1);
  }

  /** Utah rows for fiscal years `from`..`to` (29 counties × 8 age/sex cells = 232 a year), filtered server-side on the verified columns. */
  static requestUrl(from: string, to = from): URL {
    const fy = (y: string) => `'${y}-09-30T00:00:00.000'`;
    const q = new URLSearchParams({
      $select: Object.values(COLUMNS).join(','), $where: `state='Utah' AND date between ${fy(from)} and ${fy(to)}`, $order: 'date,fips', $limit: '5000',
    });
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

  static fetch(from: string, to = from, env: Record<string, string | undefined> = process.env, httpFetch = fetch): Promise<unknown> {
    return VaVetpop.fetchJson(VaVetpop.requestUrl(from, to), 'VetPop', httpFetch, env.SOCRATA_APP_TOKEN);
  }

  /** A schema without the value, fips or date column can never load zeros; the error names the keys seen. */
  static schema(first: Raw): void {
    const missing = [COLUMNS.fips, COLUMNS.date, COLUMNS.value].some((k) => !Object.prototype.hasOwnProperty.call(first, k));
    if (missing) throw new Error(`VetPop: unknown columns ${Object.keys(first).sort().join(',')}`);
  }

  /** Nearest thousand, half up: 12,345 → 12,000; 12,500 → 13,000. */
  static roundThousands = (n: number): number => Math.round(n / 1000) * 1000;

  /** Sums each county's age × sex cells per fiscal year (from FIRST_YEAR on); a repeated cell is a reject; every year is filled to 29 counties. */
  static parse(json: unknown): VetpopParse {
    if (!Array.isArray(json)) throw new Error('VetPop response must be a JSON array');
    if (json.length === 0) throw new Error('VetPop empty response');
    VaVetpop.schema(json[0] as Raw);
    const rejects: string[] = [];
    const seen: Array<{ geo_fips: string; year: string; cell: string; value: number | null }> = [];
    for (const row of json as Raw[]) {
      const st = String(row[COLUMNS.state] ?? '').trim().toLowerCase();
      if (st !== '' && st !== 'utah' && st !== 'ut') continue;
      const geo_fips = String(row[COLUMNS.fips] ?? '').replace(/\D/g, '');
      if (!UTAH_COUNTY_FIPS.has(geo_fips)) {
        if (geo_fips.startsWith('49') || !/^\d{5}$/.test(geo_fips)) rejects.push(`unknown county ${geo_fips || '(blank)'}`);
        continue;
      }
      const year = /^(\d{4})-\d{2}-\d{2}/.exec(String(row[COLUMNS.date] ?? '').trim())?.[1];
      if (!year) {
        rejects.push(`${geo_fips} missing year`);
        continue;
      }
      if (year < VaVetpop.FIRST_YEAR) continue;
      const raw = row[COLUMNS.value];
      const value = raw == null ? null : CensusTable.num(String(raw));
      const bad = value === undefined ? 'not numeric' : value != null && value < 0 ? '< 0' : value != null && !Number.isInteger(value) ? 'not an integer' : null;
      if (bad) rejects.push(`${geo_fips} ${CODE} ${bad}`);
      else seen.push({ geo_fips, year, cell: `${String(row[COLUMNS.ageGroup] ?? '')}|${String(row[COLUMNS.sex] ?? '')}`, value: value ?? null });
    }
    if (seen.length === 0 && rejects.length === 0) throw new Error('VetPop: no Utah rows');
    if (seen.length === 0) return { rows: [], rejects };
    const totals = new Map<string, { cells: Set<string>; value: number | null }>();
    for (const r of seen) {
      const key = `${r.year}:${r.geo_fips}`, t = totals.get(key) ?? { cells: new Set<string>(), value: 0 };
      if (t.cells.has(r.cell)) rejects.push(`${r.geo_fips} FY${r.year} duplicate row ${r.cell}`);
      t.cells.add(r.cell);
      t.value = t.value == null || r.value == null ? null : t.value + r.value;
      totals.set(key, t);
    }
    const years = [...new Set(seen.map((r) => r.year))].sort();
    const rows: IndicatorRow[] = years.flatMap((vintage) => [...UTAH_COUNTY_FIPS].map((geo_fips) => {
      const total = totals.get(`${vintage}:${geo_fips}`)?.value;
      const value = total == null ? null : VaVetpop.roundThousands(total);
      return { indicator_code: CODE, geo_fips, period: vintage, value, moe: null, unit: value == null ? VaVetpop.NOT_PUBLISHED : 'count', vintage };
    }));
    return { rows, rejects };
  }

  /** Every year asked for (`from`..`to`, when given) is present with each county once; no partial year ever loads. */
  static requireComplete(parsed: VetpopParse, from?: string, to = from): IndicatorRow[] {
    if (parsed.rejects.length > 0) throw new Error(`VetPop rejected ${parsed.rejects.length} rows`);
    const years = [...new Set(parsed.rows.map((r) => r.vintage))].sort();
    for (const y of years) CensusTable.requireCountyCoverage(parsed.rows.filter((r) => r.vintage === y), [], 1, `VetPop FY${y}`);
    const want = from && to ? Array.from({ length: Number(to) - Number(from) + 1 }, (_, i) => String(Number(from) + i)) : years;
    const missing = want.filter((y) => !years.includes(y));
    if (years.length === 0 || missing.length > 0) throw new Error(`VetPop missing fiscal years ${missing.join(',') || '(all)'}`);
    return parsed.rows;
  }

  static checksum = CensusTable.checksum;
}
