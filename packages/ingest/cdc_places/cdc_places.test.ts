import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COUNTIES } from '../../../lib/synthetic/generate';
import type { IndicatorRow } from '../public-indicator';
import { CdcPlaces } from './index';

const fixture = JSON.parse(readFileSync('tests/fixtures/cdc_places/utah-counties.json', 'utf8')) as Record<string, unknown>[];
const ut = (fips: string, measureid: string, data_value: unknown, lo: unknown = '10.0', hi: unknown = '14.0', year = '2023') =>
  ({ year, locationid: fips, measureid, data_value, low_confidence_limit: lo, high_confidence_limit: hi, data_value_type: CdcPlaces.VALUE_TYPE });
const find = (rows: IndicatorRow[], fips: string, code = 'mental_distress_rate') => rows.find((r) => r.geo_fips === fips && r.indicator_code === code);

describe('unit: cdc_places parser with recorded fixture', () => {
  const parsed = CdcPlaces.parse(fixture);
  it('keeps age-adjusted Utah rows only, moe is half the CI width, null value is not_published', () => {
    expect(parsed.rejects).toEqual([]);
    expect([parsed.rows.length, parsed.rows.some((r) => r.geo_fips === '16001')]).toEqual([57, false]);
    expect(find(parsed.rows, '49001')).toMatchObject({ value: 12.3, unit: 'percent', vintage: '2023', period: '2023' });
    expect(find(parsed.rows, '49001')?.moe).toBeCloseTo(1.4, 10);
    expect(find(parsed.rows, '49031')).toMatchObject({ value: null, moe: null, unit: CdcPlaces.NOT_PUBLISHED });
    const crude = { ...ut('49001', 'MHLTH', '99'), data_value_type: 'Crude prevalence' };
    expect(CdcPlaces.parse([crude, ut('49001', 'OBESITY', '30'), 'junk']).rows).toEqual([]);
  });

  it('fill adds explicit not_published rows so all 29 counties × 2 codes are present', () => {
    const rows = CdcPlaces.requireComplete(CdcPlaces.fill(parsed));
    expect(rows).toHaveLength(COUNTIES.length * 2);
    expect(find(rows, '49009', 'depression_rate'))
      .toEqual({ indicator_code: 'depression_rate', geo_fips: '49009', period: '2023', value: null, moe: null, unit: CdcPlaces.NOT_PUBLISHED, vintage: '2023' });
    expect(rows.filter((r) => r.unit === CdcPlaces.NOT_PUBLISHED)).toHaveLength(2);
    expect(CdcPlaces.checksum(rows)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('fails closed on a missing county when fill is bypassed, on mixed vintages, and on an empty response', () => {
    expect(() => CdcPlaces.requireComplete(parsed)).toThrow(/partial/);
    const mixed = CdcPlaces.parse([...fixture, ut('49009', 'DEPRESSION', '21.0', '20.0', '22.0', '2022')]);
    expect(() => CdcPlaces.requireComplete(CdcPlaces.fill(mixed))).toThrow(/mixed vintages|partial/);
    expect(() => CdcPlaces.requireComplete(CdcPlaces.fill({ rows: [], rejects: [] }))).toThrow(/0 counties/);
  });

  it('request URL filters Utah, both measures and age-adjusted; token comes from env and never leaks into errors', async () => {
    const url = CdcPlaces.requestUrl('2023', {});
    expect(url.origin + url.pathname).toBe('https://data.cdc.gov/resource/swc5-untb.json');
    expect(url.searchParams.get('$where')).toBe(`stateabbr='UT' AND measureid in('MHLTH','DEPRESSION') AND data_value_type='Age-adjusted prevalence' AND year='2023'`);
    expect([url.searchParams.get('$limit'), url.searchParams.get('$$app_token')]).toEqual(['1000', null]);
    const env = { SOCRATA_APP_TOKEN: 'not-a-secret' };
    expect(CdcPlaces.requestUrl(undefined, env).searchParams.get('$$app_token')).toBe('not-a-secret');
    for (const res of [new Response('x', { status: 403 }), new Response('{"a":1}', { status: 200 })]) {
      const err = await CdcPlaces.fetch('2023', env, async () => res).catch((e: Error) => e.message);
      expect(err).toMatch(/^PLACES/);
      expect(err).not.toContain('not-a-secret');
    }
    expect(await CdcPlaces.fetch('2023', env, async () => new Response('[]'))).toEqual([]);
  });
});

it.each([
  ['non-numeric value', ut('49035', 'MHLTH', 'abc')],
  ['rate above 100', ut('49035', 'MHLTH', '250')],
  ['negative rate', ut('49035', 'MHLTH', '-5')],
  ['non-numeric CI', ut('49035', 'MHLTH', '12', 'x')],
  ['missing year', ut('49035', 'MHLTH', '12', '10', '14', '')],
])('rejects %s', (_label, row) => {
  const parsed = CdcPlaces.parse([row]);
  expect(parsed.rejects.length).toBeGreaterThan(0);
  expect(() => CdcPlaces.requireComplete(CdcPlaces.fill(parsed))).toThrow(/rejected/);
});
