import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COLUMNS, VaVetpop } from './index';

const fixture = JSON.parse(readFileSync('tests/fixtures/va_vetpop/utah-counties.json', 'utf8')) as unknown;
const row = (county: string, veterans: unknown, extra: Record<string, unknown> = {}) =>
  ({ state: 'UT', county, fiscal_year: '2023', veterans, ...extra });

describe('unit: VetPop parser with hand-written Socrata fixture', () => {
  const parsed = VaVetpop.parse(fixture);
  const by = (fips: string) => parsed.rows.find((r) => r.geo_fips === fips);
  it('yields 29 counties after fill, rounds to the nearest thousand (half up), keeps the latest year, drops other states', () => {
    expect(parsed.rejects).toEqual([]);
    expect(parsed.rows).toHaveLength(29);
    expect(by('49035')?.value).toBe(61000); // 61,234 → 61,000 and FY2022 row (59,999) ignored
    expect(by('49049')?.value).toBe(27000); // 26,500 → 27,000
    expect(by('49029')?.value).toBe(0); // 499 → 0 stays a published count
    expect(by('49009')).toEqual(expect.objectContaining({ value: null, unit: VaVetpop.NOT_PUBLISHED, vintage: '2023' }));
    expect(parsed.rows.every((r) => r.vintage === '2023' && r.indicator_code === 'veterans_count' && r.moe === null)).toBe(true);
    expect(parsed.rows.some((r) => r.geo_fips === '16001')).toBe(false);
    expect(VaVetpop.requireComplete(parsed)).toHaveLength(29);
  });

  it('derives FIPS from the county name when the dataset has no fips column', () => {
    const { rows, rejects } = VaVetpop.parse([row('Salt Lake County', '1500'), row('box elder', 2499)]);
    expect(rejects).toEqual([]);
    expect(rows.filter((r) => r.value === 2000).map((r) => r.geo_fips).sort()).toEqual(['49003', '49035']);
  });

  it('fails closed on an unknown schema, naming the keys it saw', () => {
    expect(() => VaVetpop.parse([{ foo: 1, bar: 'UT' }])).toThrow('VetPop: unknown columns bar,foo');
    expect(() => VaVetpop.parse([{ state: 'UT', fiscal_year: '2023', veterans: '1' }])).toThrow(/unknown columns/);
    expect(() => VaVetpop.parse([])).toThrow(/empty/);
    expect(() => VaVetpop.parse([row('Ada County', '1', { state: 'ID' })])).toThrow(/no Utah rows/);
    expect(() => VaVetpop.parse({ nope: 1 })).toThrow(/JSON array/);
  });

  it.each([
    ['negative count', row('Salt Lake County', '-5')],
    ['non-integer count', row('Salt Lake County', '12.5')],
    ['non-numeric count', row('Salt Lake County', 'abc')],
    ['unknown Utah county', row('Nowhere County', '5')],
    ['missing year', row('Salt Lake County', '5', { fiscal_year: '' })],
    ['duplicate county in the latest year', { ...row('Salt Lake County', '5') }],
  ])('rejects %s', (label, bad) => {
    const parsed = VaVetpop.parse([row('Weber County', '1000'), bad, ...(label.startsWith('duplicate') ? [bad] : [])]);
    expect(parsed.rejects.length).toBeGreaterThan(0);
    expect(() => VaVetpop.requireComplete(parsed)).toThrow(/rejected/);
  });

  it('builds the Socrata request from the configured keys and never echoes the URL in errors', async () => {
    const url = VaVetpop.requestUrl('2023');
    expect(url.origin + url.pathname).toBe('https://www.data.va.gov/resource/jrjd-qghv.json');
    expect(url.searchParams.get('$limit')).toBe('5000');
    expect(url.searchParams.get('$where')).toBe(`(${COLUMNS.state.map((k) => `${k}='UT' OR ${k}='Utah'`).join(' OR ')}) AND (fiscal_year='2023' OR year='2023' OR fy='2023')`);
    expect(VaVetpop.requestUrl().searchParams.get('$where')).not.toContain('AND');
    const err = await VaVetpop.fetch('2023', {}, async () => new Response('x', { status: 403 })).catch((e: Error) => e.message);
    expect(err).toBe('VetPop fetch failed: 403');
    await expect(VaVetpop.fetch(undefined, {}, async () => new Response('{}'))).rejects.toThrow('VetPop response must be a JSON array');
  });
});
