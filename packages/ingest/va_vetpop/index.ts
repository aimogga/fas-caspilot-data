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

/** Living veterans per Utah county for one fiscal year, summed over age group × sex, rounded to the nearest thousand
 * (DATA_SOURCES.md). Veterans per 1,000 is NOT computed here: the need score divides by geo_county.population_latest (PRD §C4). */
export class VaVetpop {
  static readonly SOURCE_NAME = 'va-vetpop';
  static readonly HOST = 'https://www.data.va.gov';
  static readonly DATASET = 'jrjd-qghv';
  static readonly NOT_PUBLISHED = CENSUS_NOT_PUBLISHED;

  /** The latest federal fiscal year that has ended (FY ends 30 September), so a run never loads a future projection. */
  static fiscalYear(now: Date): string {
    return String(now.getUTCMonth() >= 9 ? now.getUTCFullYear() : now.getUTCFullYear() - 1);
  }

  /** One fiscal year of Utah rows (29 counties × 8 age/sex cells = 232), filtered server-side on the verified columns. */
  static requestUrl(year: string): URL {
    const q = new URLSearchParams({
      $select: Object.values(COLUMNS).join(','), $where: `state='Utah' AND date='${year}-09-30T00:00:00.000'`, $limit: '1000',
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

  static fetch(year: string, env: Record<string, string | undefined> = process.env, httpFetch = fetch): Promise<unknown> {
    return VaVetpop.fetchJson(VaVetpop.requestUrl(year), 'VetPop', httpFetch, env.SOCRATA_APP_TOKEN);
  }

  /** A schema without the value, fips or date column can never load zeros; the error names the keys seen. */
  static schema(first: Raw): void {
    const missing = [COLUMNS.fips, COLUMNS.date, COLUMNS.value].some((k) => !Object.prototype.hasOwnProperty.call(first, k));
    if (missing) throw new Error(`VetPop: unknown columns ${Object.keys(first).sort().join(',')}`);
  }

  /** Nearest thousand, half up: 12,345 → 12,000; 12,500 → 13,000. */
  static roundThousands = (n: number): number => Math.round(n / 1000) * 1000;

  /** Sums each county's age × sex cells for the latest fiscal year in the response; a repeated cell is a reject. */
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
      const raw = row[COLUMNS.value];
      const value = raw == null ? null : CensusTable.num(String(raw));
      const bad = value === undefined ? 'not numeric' : value != null && value < 0 ? '< 0' : value != null && !Number.isInteger(value) ? 'not an integer' : null;
      if (bad) rejects.push(`${geo_fips} ${CODE} ${bad}`);
      else seen.push({ geo_fips, year, cell: `${String(row[COLUMNS.ageGroup] ?? '')}|${String(row[COLUMNS.sex] ?? '')}`, value: value ?? null });
    }
    if (seen.length === 0 && rejects.length === 0) throw new Error('VetPop: no Utah rows');
    if (seen.length === 0) return { rows: [], rejects };
    const vintage = seen.map((r) => r.year).sort().at(-1) as string;
    const totals = new Map<string, { cells: Set<string>; value: number | null }>();
    for (const r of seen.filter((r) => r.year === vintage)) {
      const t = totals.get(r.geo_fips) ?? { cells: new Set<string>(), value: 0 };
      if (t.cells.has(r.cell)) rejects.push(`${r.geo_fips} duplicate row ${r.cell}`);
      t.cells.add(r.cell);
      t.value = t.value == null || r.value == null ? null : t.value + r.value;
      totals.set(r.geo_fips, t);
    }
    const rows: IndicatorRow[] = [...UTAH_COUNTY_FIPS].map((geo_fips) => {
      const total = totals.get(geo_fips)?.value;
      const value = total == null ? null : VaVetpop.roundThousands(total);
      return { indicator_code: CODE, geo_fips, period: vintage, value, moe: null, unit: value == null ? VaVetpop.NOT_PUBLISHED : 'count', vintage };
    });
    return { rows, rejects };
  }

  static requireComplete(parsed: VetpopParse): IndicatorRow[] {
    CensusTable.requireCountyCoverage(parsed.rows, parsed.rejects, 1, 'VetPop');
    if (new Set(parsed.rows.map((r) => r.vintage)).size !== 1) throw new Error('VetPop mixed vintages');
    return parsed.rows;
  }

  static checksum = CensusTable.checksum;
}
