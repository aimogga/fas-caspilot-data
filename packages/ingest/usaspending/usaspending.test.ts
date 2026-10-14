import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_ALNS, UsaSpending, defaultConfig, fiscalYear, lastFiscalYears } from './index';
const fixture = JSON.parse(readFileSync('tests/fixtures/usaspending/search.json', 'utf8')) as { results: unknown[] };
const T = new Date('2026-10-14T00:00:00Z');
describe('unit: USAspending parser with hand-written (UNVERIFIED) v2 fixture', () => {
  it('maps every award_history column, derives the federal fiscal year, dedupes by external_id; checksum ignores raw', () => {
    const rows = UsaSpending.parse(fixture), [a, b, c, ...rest] = UsaSpending.dedupe(rows); expect([rows.length, rest]).toEqual([4, []]);
    expect(a).toEqual({ source: 'usaspending', external_id: 'ASST_NON_90CA1001_7501', recipient: 'Example Family Services Inc', amount: 450000, recipient_state: 'UT',
      funder: 'Department of Health and Human Services / Administration for Children and Families', recipient_type: 'organization', fiscal_year: 2024, assistance_listing: '93.590',
      description: 'COMMUNITY-BASED CHILD ABUSE PREVENTION: FAMILY THERAPY FOR COURT-REFERRED FAMILIES', raw: fixture.results[0] });
    expect(b).toEqual(expect.objectContaining({ amount: 1200000, recipient_state: 'UT', recipient_type: 'government', fiscal_year: 2025, assistance_listing: '93.243', description: null }));
    expect(c).toEqual(expect.objectContaining({ funder: 'Department of Health and Human Services', recipient_state: 'ID', recipient_type: 'higher_education', fiscal_year: 2025 }));
    expect([UsaSpending.checksum([a, b]), UsaSpending.checksum([a]) === UsaSpending.checksum([{ ...a, amount: 1 }])]).toEqual([UsaSpending.checksum([{ ...b, raw: { other: 1 } }, a]), false]);
  });
  it('fails closed on an unknown shape, naming the keys it saw; coerces bad scalars; truncates description to 500', () => {
    expect(() => UsaSpending.parse({ results: [{ foo: 1, bar: 2 }] })).toThrow('USAspending: unknown shape keys bar,foo');
    for (const r of [{ 'Award ID': 'x', 'Recipient Name': 'no amount' }, { 'Award ID': 'x', 'Award Amount': 1 }]) expect(() => UsaSpending.parse({ results: [r] })).toThrow(/unknown shape/);
    expect(() => UsaSpending.parse({ detail: 'Error' })).toThrow(/results array/); expect(UsaSpending.parse({ results: [] })).toEqual([]);
    const flat = UsaSpending.parse([{ 'Award ID': 7, 'Recipient Name': 'Demo University', 'Award Amount': '12.5', 'Start Date': 'soon', Description: 'x'.repeat(600) }])[0];
    expect(flat).toEqual(expect.objectContaining({ external_id: '7', amount: 12.5, fiscal_year: null, funder: null, recipient_state: null, assistance_listing: null, recipient_type: 'higher education' }));
    expect(flat.description).toHaveLength(500);
  });
  it('federal FY runs Oct–Sep; defaults: three completed FYs, Utah, FAS assistance listings, page 100; one grant-only body per ALN × FY, limit <= 100', () => {
    expect([fiscalYear('2024-09-30'), fiscalYear('2024-10-01'), lastFiscalYears(T), lastFiscalYears(new Date('2026-09-30T00:00:00Z'))]).toEqual([2024, 2025, [2026, 2025, 2024], [2025, 2024, 2023]]);
    expect(defaultConfig(T)).toEqual({ assistanceListings: DEFAULT_ALNS, states: ['UT'], fiscalYears: [2026, 2025, 2024], pageSize: 100 });
    const body = UsaSpending.searchBody({ ...defaultConfig(T), pageSize: 500 }, '93.590', 2025, 2);
    expect([DEFAULT_ALNS.includes('93.590'), body]).toEqual([true, expect.objectContaining({ subawards: false, page: 2, limit: 100, sort: 'Award Amount', order: 'desc' })]);
    expect(body.filters).toEqual({ award_type_codes: ['02', '03', '04', '05'], program_numbers: ['93.590'], time_period: [{ start_date: '2024-10-01', end_date: '2025-09-30' }],
      place_of_performance_locations: [{ country: 'USA', state: 'UT' }] });
    expect(() => UsaSpending.searchBody(defaultConfig(T), '93.590', 2025, 0)).toThrow(/page/);
  });
  it('search takes the limiter once per request, pages until hasNext=false or a short page, fails closed upstream', async () => {
    const calls: { url: string; body: { page: number; filters: { program_numbers: string[]; time_period: { end_date: string }[] } } }[] = [];
    const award = (i: number) => ({ generated_internal_id: `a${i}`, 'Recipient Name': `r${i}`, 'Award Amount': i });
    const httpFetch: typeof fetch = async (url, init) => {
      const body = JSON.parse(String(init?.body)), full = body.page === 1, last = body.filters.time_period[0].end_date === '2024-09-30'; calls.push({ url: String(url), body });
      return new Response(JSON.stringify({ results: full ? [award(0), award(1)] : [award(2)], page_metadata: { hasNext: full && !last } }), { status: 200 });
    };
    let takes = 0; const cfg = { assistanceListings: ['93.590', '93.243'], states: ['UT'], fiscalYears: [2025, 2024], pageSize: 2 }, rows = await UsaSpending.search(cfg, async () => { takes++; }, httpFetch);
    expect([rows.map((r) => r.external_id), takes, calls.length, calls[0].url]).toEqual([['a0', 'a1', 'a2'], 6, 6, UsaSpending.API]);
    expect(calls.map((c) => `${c.body.filters.program_numbers[0]}:${c.body.filters.time_period[0].end_date.slice(0, 4)}:${c.body.page}`))
      .toEqual(['93.590:2025:1', '93.590:2025:2', '93.590:2024:1', '93.243:2025:1', '93.243:2025:2', '93.243:2024:1']);
    await expect(UsaSpending.search(cfg, async () => {}, async () => new Response('x', { status: 429 }))).rejects.toThrow('USAspending search failed: 429');
    await expect(UsaSpending.search(cfg, async () => {}, async () => new Response('{"detail":"nope"}'))).rejects.toThrow(/results array/);
  });
});
