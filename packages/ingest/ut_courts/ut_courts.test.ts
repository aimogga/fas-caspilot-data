import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildXlsx, fixtureRows, type Cell } from '../../../tests/fixtures/ut_courts/build';
import { CODES, UtCourts } from './index';

const fixture = readFileSync('tests/fixtures/ut_courts/filings.xlsx');
const HDR: Cell[] = ['Fiscal Year', 'District', 'County', 'Court Type', 'Location', 'Category', 'Case Type', 'Filing Count'];
const wb = (rows: Cell[][], sheet = 'All') => Buffer.from(buildXlsx({ [sheet]: rows }));
const row = (fy: Cell, county: string, type: string, count: Cell): Cell[] => [fy, 'District 1', county, type, 'x', 'x', 'x', count];
const at = (rows: { geo_fips: string; indicator_code: string; vintage: string }[], fips: string, code: string, fy = 'FY2026') =>
  rows.find((r) => r.geo_fips === fips && r.indicator_code === code && r.vintage === fy) as { value: number | null; unit: string } | undefined;

describe('unit: Utah Courts filings parser with generated long-format fixture', () => {
  it('sums case types per FY × county × court type, fills 2 × 29 × 4 rows, and marks the unpublished county', async () => {
    const parsed = await UtCourts.parse(fixture);
    const filled = UtCourts.fill(parsed);
    expect([parsed.rejects, parsed.blanks, parsed.vintages]).toEqual([[], 1, ['FY2025', 'FY2026']]);
    expect([parsed.rows.length, filled.rows.length, CODES.length]).toEqual([(28 + 29) * 4, 2 * 29 * 4, 4]);
    expect(UtCourts.requireComplete(filled)).toBe(filled.rows);
    expect(at(parsed.rows, '49001', 'court_filings_district')).toMatchObject({ value: 87, unit: 'count' });
    expect([at(parsed.rows, '49001', 'court_filings_juvenile')?.value, at(parsed.rows, '49001', 'court_filings_justice')?.value]).toEqual([109, 131]);
    expect(at(parsed.rows, '49001', 'court_filings_total')).toMatchObject({ value: 327, period: 'FY2026', moe: null });
    expect(at(parsed.rows, '49001', 'court_filings_total', 'FY2025')?.value).toBe(246); // the blank Juvenile cell adds nothing
    expect(parsed.rows.some((r) => r.geo_fips === '49009' && r.vintage === 'FY2025')).toBe(false);
    for (const code of CODES) expect(at(filled.rows, '49009', code, 'FY2025')).toMatchObject({ value: null, unit: UtCourts.NOT_PUBLISHED });
    expect(at(filled.rows, '49009', 'court_filings_total')?.value).toBeGreaterThan(0);
  });

  it('fails closed before fill, on an unknown county or court type, on a bad count, and on a misplaced Statewide row', async () => {
    await expect(UtCourts.parse(fixture).then(UtCourts.requireComplete)).rejects.toThrow(/UT Courts FY2025 partial response: 28 counties/);
    const bad = await UtCourts.parse(wb([HDR, row(2026, 'Beaver', 'District', 1), row('FY2026', 'Bear Lake', 'District', 2), row(2026, 'Beaver', 'Tribal', 3),
      row(2026, 'Beaver', 'Justice', -1), row(2026, 'Beaver', 'Justice', 2.5), row(2026, 'Statewide', 'District', 4), row('2026Q1', 'Beaver', 'District', 5),
      row(2026, 'Statewide', 'Appellate', 9), row(2026, 'Beaver', 'Appellate', 7), row(2026, 'Salt Lake County', 'Juvenile', ''), [null, null, null, null, null, null, null, null]]));
    expect(bad.rejects).toEqual(['unknown county "Bear Lake"', 'unknown court type "Tribal"', 'FY2026 beaver count "-1" is not a count',
      'FY2026 beaver count "2.5" is not a count', 'FY2026 appellate/statewide row outside the Statewide pseudo-county', 'bad fiscal year "2026Q1"',
      'FY2026 appellate/statewide row outside the Statewide pseudo-county']);
    expect([bad.blanks, bad.rows.map((r) => r.geo_fips)]).toEqual([1, ['49001', '49001']]);
    expect(() => UtCourts.requireComplete(UtCourts.fill(bad))).toThrow(/rejected 7 rows/);
  });

  it('fails closed on a layout change: missing sheet, no county header, unknown columns, no fiscal years', async () => {
    await expect(UtCourts.parse(wb(fixtureRows(), 'Sheet1'))).rejects.toThrow(/no sheet matches/);
    await expect(UtCourts.parse(wb([['Title'], ['Year', 'Region', 'Filings']]))).rejects.toThrow(/^UT Courts: no header row names a county column$/);
    await expect(UtCourts.parse(wb([['Utah Courts'], [], ['Year', 'County', 'Filings']]))).rejects.toThrow(/^UT Courts: unknown columns Year, County, Filings$/);
    await expect(UtCourts.parse(wb([HDR])).then(UtCourts.requireComplete)).rejects.toThrow(/no fiscal years/);
  });

  it('fetch sends a browser User-Agent and fails closed on non-2xx without echoing the URL', async () => {
    await expect(UtCourts.fetch(async () => new Response('nope', { status: 406 }))).rejects.toThrow(/^UT Courts fetch failed: 406$/);
    const seen: [string, string | undefined][] = [];
    const buf = await UtCourts.fetch(async (url, init) => (seen.push([String(url), new Headers(init?.headers).get('user-agent') ?? undefined]), new Response(fixture)));
    expect(seen).toEqual([[UtCourts.DOWNLOAD_URL, UtCourts.USER_AGENT]]);
    expect(buf.equals(fixture)).toBe(true);
  });
});
