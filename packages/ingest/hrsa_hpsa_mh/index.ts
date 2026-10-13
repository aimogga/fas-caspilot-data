import { COUNTIES } from '../../../lib/synthetic/generate';
import { CensusTable, CENSUS_NOT_PUBLISHED, UTAH_COUNTY_FIPS } from '../census-table';
import { parseCsv } from '../csv';
import type { IndicatorRow } from '../public-indicator';

/** Header candidates, first present wins. The MH detail file is single-discipline, so `type` is optional. */
export const COLUMNS = {
  fips: ['Common State County FIPS Code', 'County FIPS Code', 'FIPS', 'Common County FIPS Code'],
  stateFips: ['State FIPS Code'],
  state: ['Primary State Abbreviation', 'State Abbreviation', 'Common State Abbreviation'],
  status: ['HPSA Status', 'HPSA Status Description'],
  score: ['HPSA Score'],
  population: ['HPSA Designation Population'],
  type: ['HPSA Discipline Class', 'HPSA Discipline Class Description'],
  withdrawn: ['Withdrawn Date', 'HPSA Withdrawn Date'],
} as const;

const CODES = ['mh_hpsa_designated', 'mh_hpsa_score_max', 'mh_hpsa_designated_population'] as const;
type Cols = Partial<Record<keyof typeof COLUMNS, string>>;
type Hpsa = { score: number | null; population: number | null };
type Row = Record<string, string>;

export type HpsaParse = { rows: IndicatorRow[]; rejects: string[]; vintage: string };

export class HrsaHpsaMh {
  static readonly SOURCE_NAME = 'hrsa-hpsa-mh';
  /** HRSA data-warehouse CSV export of the Mental Health HPSA detail table. UNVERIFIED (data.hrsa.gov was blocked while
   *  this was written): QA must confirm the exact file name and that its header matches COLUMNS (curl in the F-205 PR body). */
  static readonly DOWNLOAD_URL = 'https://data.hrsa.gov/DataDownload/DD_Files/BCD_HPSA_FCT_DET_MH.csv';
  static readonly NOT_PUBLISHED = CENSUS_NOT_PUBLISHED;

  /** Fail closed on non-2xx without echoing the URL. */
  static async fetch(httpFetch: typeof fetch = fetch): Promise<string> {
    const res = await httpFetch(HrsaHpsaMh.DOWNLOAD_URL);
    if (!res.ok) throw new Error(`HPSA fetch failed: ${res.status}`);
    return res.text();
  }

  static resolve(header: string[]): Cols {
    const cols: Cols = {};
    for (const key of Object.keys(COLUMNS) as (keyof typeof COLUMNS)[]) cols[key] = COLUMNS[key].find((h) => header.includes(h));
    if (!cols.fips || !cols.status) throw new Error(`HPSA: unknown columns ${header.join(', ')}`);
    return cols;
  }

  /** 5-digit FIPS, or state FIPS (2) + county FIPS (3) when the file splits them. */
  static fips(row: Row, cols: Cols): string | null {
    const raw = (row[cols.fips ?? ''] ?? '').replace(/\D/g, '');
    const state = (row[cols.stateFips ?? ''] ?? '').replace(/\D/g, '').padStart(2, '0');
    return /^\d{5}$/.test(raw) ? raw : raw.length === 3 && /^\d{2}$/.test(state) ? `${state}${raw}` : null;
  }

  /** `Designated` or `Proposed For Withdrawal` with no withdrawn date; `Withdrawn` is not a shortage designation. */
  static designated(row: Row, cols: Cols): boolean {
    const status = (row[cols.status ?? ''] ?? '').trim().toLowerCase();
    return (status === 'designated' || status === 'proposed for withdrawal') && (row[cols.withdrawn ?? ''] ?? '').trim() === '';
  }

  /** vintage = run date: HRSA refreshes the export daily and the file carries no vintage of its own. */
  static parse(text: string, now = new Date()): HpsaParse {
    const vintage = now.toISOString().slice(0, 10);
    const { header, records } = parseCsv(text);
    const cols = HrsaHpsaMh.resolve(header);
    const rejects: string[] = [];
    const byCounty = new Map<string, Hpsa[]>();
    for (const row of records) {
      const geo_fips = HrsaHpsaMh.fips(row, cols);
      if (!geo_fips) rejects.push('missing FIPS');
      if (!geo_fips || !UTAH_COUNTY_FIPS.has(geo_fips) || (cols.state && row[cols.state]?.trim().toUpperCase() !== 'UT')) continue;
      if ((cols.type && !/mental health/i.test(row[cols.type] ?? '')) || !HrsaHpsaMh.designated(row, cols)) continue;
      const score = CensusTable.num(row[cols.score ?? '']);
      const population = CensusTable.num(row[cols.population ?? '']);
      if (score === undefined || (score != null && (score < 0 || score > 26))) rejects.push(`${geo_fips} score out of range`);
      else if (population === undefined || (population != null && (population < 0 || !Number.isInteger(population)))) {
        rejects.push(`${geo_fips} population not a count`);
      } else byCounty.set(geo_fips, [...(byCounty.get(geo_fips) ?? []), { score, population }]);
    }
    const rows = [...byCounty].flatMap(([geo_fips, hpsas]) => HrsaHpsaMh.county(geo_fips, hpsas, vintage));
    return { rows, rejects, vintage };
  }

  /** One row per code: flag (1 if any designated MH HPSA touches the county), max score, summed designation population. */
  static county(geo_fips: string, hpsas: Hpsa[], vintage: string): IndicatorRow[] {
    const scores = hpsas.map((h) => h.score).filter((s): s is number => s != null);
    const pops = hpsas.map((h) => h.population).filter((p): p is number => p != null);
    const values = [hpsas.length ? 1 : 0, scores.length ? Math.max(...scores) : null, pops.length ? pops.reduce((a, b) => a + b, 0) : null];
    return CODES.map((indicator_code, i) => {
      const value = values[i] ?? null;
      const unit = value == null ? HrsaHpsaMh.NOT_PUBLISHED : indicator_code === 'mh_hpsa_score_max' ? 'score' : 'count';
      return { indicator_code, geo_fips, period: vintage, value, moe: null, unit, vintage };
    });
  }

  /** A county with no MH HPSA is a real 0 for the flag (not missing data); its score and population are not published. */
  static fill(parsed: HpsaParse): HpsaParse {
    const missing = COUNTIES.filter((c) => !parsed.rows.some((r) => r.geo_fips === c.fips)).flatMap((c) => HrsaHpsaMh.county(c.fips, [], parsed.vintage));
    return { ...parsed, rows: [...parsed.rows, ...missing] };
  }

  static requireComplete(parsed: HpsaParse): IndicatorRow[] {
    CensusTable.requireCountyCoverage(parsed.rows, parsed.rejects, CODES.length, 'HPSA');
    if (new Set(parsed.rows.map((r) => r.vintage)).size !== 1) throw new Error('HPSA mixed vintages');
    return parsed.rows;
  }

  static checksum = CensusTable.checksum;
}
