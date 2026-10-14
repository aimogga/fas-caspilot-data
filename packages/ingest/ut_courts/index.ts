import { COUNTIES } from '../../../lib/synthetic/generate';
import { CensusTable, CENSUS_NOT_PUBLISHED } from '../census-table';
import type { IndicatorRow } from '../public-indicator';
import { sheetRows } from '../xlsx';

/** Header candidates, first present wins (case-insensitive). Layout seen 2026-10-08 (docs/research/ut_courts.md): one sheet `All`,
 *  long format `Fiscal Year | District | County | Court Type | Location | Category | Case Type | Filing Count`, FY2010–FY2026. */
export const COLUMNS = { year: ['Fiscal Year', 'FY'], county: ['County'], type: ['Court Type'], count: ['Filing Count', 'Filings', 'Count'] } as const;
/** County court types, each summed into `court_filings_total`. Appellate is filed under the `Statewide` pseudo-county and is not county data. */
const TYPES: Record<string, string> = { district: 'court_filings_district', juvenile: 'court_filings_juvenile', justice: 'court_filings_justice' };
export const CODES = ['court_filings_total', ...Object.values(TYPES)];
const FIPS_BY_NAME = new Map(COUNTIES.map((c) => [c.name.toLowerCase(), c.fips]));
type Col = keyof typeof COLUMNS;
export type UtCourtsParse = { rows: IndicatorRow[]; rejects: string[]; blanks: number; vintages: string[] };

export class UtCourts {
  static readonly SOURCE_NAME = 'ut_courts';
  /** AOC statewide filings workbook. URL and sheet layout VERIFIED-direct 2026-10-08 in docs/research/ut_courts.md, but utcourts.gov is
   *  blocked from this sandbox, so neither was re-fetched here: QA must run the curl in the F-207 PR body. Reuse terms are unconfirmed. */
  static readonly DOWNLOAD_URL = 'https://www.utcourts.gov/content/dam/stats/Yearly%20Filing%20Counts%202010-2026.xlsx';
  /** The box answers the default curl/undici User-Agent with 406 (research card §7). */
  static readonly USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) FAS-Evidence/1.0';
  static readonly SHEET = /^all$/i;
  static readonly NOT_PUBLISHED = CENSUS_NOT_PUBLISHED;
  /** Floor on published counties per FY: the AOC has published 29/29 every year, so fewer means a truncated download, not data. */
  static readonly MIN_PUBLISHED = 24;

  /** Fail closed on non-2xx without echoing the URL. */
  static async fetch(httpFetch: typeof fetch = fetch): Promise<Buffer> {
    const res = await httpFetch(UtCourts.DOWNLOAD_URL, { headers: { 'user-agent': UtCourts.USER_AGENT } });
    if (!res.ok) throw new Error(`UT Courts fetch failed: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  /** Header = first row with a cell matching /county/i; every COLUMNS key must resolve, else the layout changed and we stop. */
  static resolve(rows: string[][]): { header: number; col: Record<Col, number> } {
    const header = rows.findIndex((r) => r.some((c) => /county/i.test(c)));
    if (header < 0) throw new Error('UT Courts: no header row names a county column');
    const col = {} as Record<Col, number>;
    for (const key of Object.keys(COLUMNS) as Col[]) {
      col[key] = rows[header].findIndex((c) => COLUMNS[key].some((h) => h.toLowerCase() === c.toLowerCase()));
      if (col[key] < 0) throw new Error(`UT Courts: unknown columns ${rows[header].filter(Boolean).join(', ')}`);
    }
    return { header, col };
  }

  static fiscalYear = (raw: string): string | null => (/^(?:FY\s*)?(\d{4})$/i.exec(raw) ? `FY${raw.slice(-4)}` : null);

  /** Sums Filing Count per FY × county × court type (+ total). Blank counts (105 in the real file) are skipped and counted, not rejected. */
  static async parse(buffer: Buffer): Promise<UtCourtsParse> {
    const { rows } = await sheetRows(buffer, UtCourts.SHEET);
    const { header, col } = UtCourts.resolve(rows);
    const rejects: string[] = [];
    let blanks = 0;
    const sums = new Map<string, number>();
    for (const r of rows.slice(header + 1)) {
      if (r.every((c) => c === '')) continue;
      const cell = (k: Col) => r[col[k]] ?? '';
      const vintage = UtCourts.fiscalYear(cell('year')); // `2026` or `FY2026` → `FY2026`
      const name = cell('county').replace(/\s+county$/i, '').toLowerCase();
      const type = cell('type').toLowerCase();
      if (!vintage) rejects.push(`bad fiscal year "${cell('year')}"`);
      else if (name === 'statewide' || type === 'appellate') {
        if (name !== 'statewide' || type !== 'appellate') rejects.push(`${vintage} appellate/statewide row outside the Statewide pseudo-county`);
      } else if (!FIPS_BY_NAME.has(name)) rejects.push(`unknown county "${cell('county')}"`);
      else if (!TYPES[type]) rejects.push(`unknown court type "${cell('type')}"`);
      else {
        const n = CensusTable.num(cell('count'));
        if (n === null) blanks++;
        else if (n === undefined || n < 0 || !Number.isInteger(n)) rejects.push(`${vintage} ${name} count "${cell('count')}" is not a count`);
        else for (const code of [TYPES[type], CODES[0]]) {
          const key = `${vintage}|${FIPS_BY_NAME.get(name)}|${code}`;
          sums.set(key, (sums.get(key) ?? 0) + n);
        }
      }
    }
    const out = [...sums].map(([k, value]) => {
      const [vintage, geo_fips, indicator_code] = k.split('|');
      return { indicator_code, geo_fips, period: vintage, value, moe: null, unit: 'count', vintage };
    });
    return { rows: out, rejects, blanks, vintages: [...new Set(out.map((r) => r.vintage))].sort() };
  }

  /** Every FY × county × code is present: a county the courts published nothing for in a year is an explicit not_published row. */
  static fill(parsed: UtCourtsParse): UtCourtsParse {
    const have = new Set(parsed.rows.map((r) => `${r.vintage}|${r.geo_fips}|${r.indicator_code}`));
    const rows = [...parsed.rows];
    for (const vintage of parsed.vintages) for (const c of COUNTIES) for (const indicator_code of CODES) {
      if (!have.has(`${vintage}|${c.fips}|${indicator_code}`)) rows.push({ indicator_code, geo_fips: c.fips, period: vintage, value: null, moe: null, unit: UtCourts.NOT_PUBLISHED, vintage });
    }
    return { ...parsed, rows };
  }

  static requireComplete(parsed: UtCourtsParse): IndicatorRow[] {
    if (parsed.vintages.length === 0) throw new Error('UT Courts: no fiscal years found');
    for (const v of parsed.vintages) {
      const rows = parsed.rows.filter((r) => r.vintage === v);
      CensusTable.requireCountyCoverage(rows, parsed.rejects, CODES.length, `UT Courts ${v}`);
      const published = rows.filter((r) => r.indicator_code === CODES[0] && r.value != null).length;
      if (published < UtCourts.MIN_PUBLISHED) throw new Error(`UT Courts ${v}: only ${published} of ${COUNTIES.length} counties published`);
    }
    return parsed.rows;
  }

  static checksum = CensusTable.checksum;
}
