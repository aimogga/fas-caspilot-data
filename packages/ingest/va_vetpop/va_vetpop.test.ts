import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { VaVetpop } from './index';

const fixture = JSON.parse(readFileSync('tests/fixtures/va_vetpop/utah-counties.json', 'utf8')) as unknown;
const row = (fips: string, veterans: unknown, extra: Record<string, unknown> = {}) =>
  ({ date: '2023-09-30T00:00:00.000', fips, county_state: 'X, UT', state: 'Utah', age_group: '17 to 44', sex: 'Male', veterans, ...extra });

describe('unit: VetPop parser with a fixture in the live jrjd-qghv shape', () => {
  const parsed = VaVetpop.parse(fixture);
  const by = (fips: string) => parsed.rows.find((r) => r.geo_fips === fips);
  it('sums age × sex cells per county, fills to 29, rounds to the nearest thousand (half up), drops years before FY2023 and other states', () => {
    expect(parsed.rejects).toEqual([]);
    expect(parsed.rows).toHaveLength(29);
    expect(by('49035')?.value).toBe(61000); // 61,234 over two cells → 61,000; the FY2022 cells (59,999) predate VetPop2023's base
    expect(by('49049')?.value).toBe(27000); // 26,500 → 27,000
    expect(by('49029')?.value).toBe(0); // 499 → 0 stays a published count
    expect(by('49009')).toEqual(expect.objectContaining({ value: null, unit: VaVetpop.NOT_PUBLISHED, vintage: '2023' }));
    expect(parsed.rows.every((r) => r.vintage === '2023' && r.indicator_code === 'veterans_count' && r.moe === null)).toBe(true);
    expect(parsed.rows.some((r) => r.geo_fips === '16001')).toBe(false);
    expect(VaVetpop.requireComplete(parsed)).toHaveLength(29);
  });

  it('keeps one full county set per fiscal year (George: FY2023 onward) and fails closed when a year asked for is missing', () => {
    const year = (fy: string, v: string) => ['49035', '49057'].map((fips) => row(fips, v, { date: `${fy}-09-30T00:00:00.000` }));
    const p = VaVetpop.parse([...year('2023', '1500'), ...year('2024', '2500'), ...year('2026', '700')]);
    const at = (fy: string, fips: string) => p.rows.find((r) => r.vintage === fy && r.geo_fips === fips);
    expect([p.rows.length, at('2023', '49035')?.value, at('2024', '49057')?.value, at('2026', '49035')?.value]).toEqual([87, 2000, 3000, 1000]);
    expect(p.rows.every((r) => r.period === r.vintage)).toBe(true);
    expect(VaVetpop.requireComplete(p)).toHaveLength(87);
    expect(() => VaVetpop.requireComplete(p, '2023', '2026')).toThrow('VetPop missing fiscal years 2025');
    expect(VaVetpop.requireComplete(VaVetpop.parse(year('2025', '1')), '2025')).toHaveLength(29);
  });

  it('a null cell makes the county not published rather than a partial sum', () => {
    const { rows, rejects } = VaVetpop.parse([row('49035', '1500'), row('49035', null, { sex: 'Female' })]);
    expect([rejects, rows.find((r) => r.geo_fips === '49035')?.unit]).toEqual([[], VaVetpop.NOT_PUBLISHED]);
  });

  it('the default year is the latest fiscal year that has ended (FY ends 30 September), never a projection', () => {
    expect(VaVetpop.fiscalYear(new Date('2026-10-17T00:00:00Z'))).toBe('2026');
    expect(VaVetpop.fiscalYear(new Date('2026-09-30T23:00:00Z'))).toBe('2025');
  });

  it('fails closed on an unknown schema, naming the keys it saw', () => {
    expect(() => VaVetpop.parse([{ foo: 1, bar: 'UT' }])).toThrow('VetPop: unknown columns bar,foo');
    expect(() => VaVetpop.parse([{ state: 'UT', fiscal_year: '2023', veterans: '1' }])).toThrow(/unknown columns/);
    expect(() => VaVetpop.parse([])).toThrow(/empty/);
    expect(() => VaVetpop.parse([row('16001', '1', { state: 'Idaho' })])).toThrow(/no Utah rows/);
    expect(() => VaVetpop.parse({ nope: 1 })).toThrow(/JSON array/);
  });

  it.each([
    ['negative count', row('49035', '-5')],
    ['non-integer count', row('49035', '12.5')],
    ['non-numeric count', row('49035', 'abc')],
    ['unknown Utah county', row('49999', '5')],
    ['missing year', row('49035', '5', { date: '' })],
    ['duplicate age × sex cell in the latest year', row('49035', '5')],
  ])('rejects %s', (label, bad) => {
    const parsed = VaVetpop.parse([row('49057', '1000'), bad, ...(label.startsWith('duplicate') ? [bad] : [])]);
    expect(parsed.rejects.length).toBeGreaterThan(0);
    expect(() => VaVetpop.requireComplete(parsed)).toThrow(/rejected/);
  });

  it('requests a range of fiscal years of Utah rows on the verified columns and never echoes the URL in errors', async () => {
    const url = VaVetpop.requestUrl('2023', '2026');
    expect(url.origin + url.pathname).toBe('https://www.data.va.gov/resource/jrjd-qghv.json');
    expect([url.searchParams.get('$limit'), url.searchParams.get('$select')]).toEqual(['5000', 'state,fips,date,age_group,sex,veterans']);
    expect(url.searchParams.get('$where')).toBe("state='Utah' AND date between '2023-09-30T00:00:00.000' and '2026-09-30T00:00:00.000'");
    expect(VaVetpop.requestUrl('2025').searchParams.get('$where')).toContain("between '2025-09-30T00:00:00.000' and '2025-09-30T00:00:00.000'");
    const err = await VaVetpop.fetch('2023', '2023', {}, async () => new Response('x', { status: 403 })).catch((e: Error) => e.message);
    expect(err).toBe('VetPop fetch failed: 403');
    await expect(VaVetpop.fetch('2023', '2023', {}, async () => new Response('{}'))).rejects.toThrow('VetPop response must be a JSON array');
  });
});
