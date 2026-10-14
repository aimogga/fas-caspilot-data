import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Saipe } from './index';

const fixture = JSON.parse(readFileSync('tests/fixtures/saipe/utah-counties.json', 'utf8')) as unknown;
const HDR = ['NAME', 'GEOID', 'SAEPOVALL_PT', 'SAEPOVALL_MOE', 'SAEPOVRTALL_PT', 'SAEPOVRTALL_MOE', 'SAEPOV0_17_PT', 'SAEPOV0_17_MOE', 'SAEPOVRT0_17_PT', 'SAEPOVRT0_17_MOE', 'YEAR', 'state', 'county'];
const ut = (fips: string, n: string, pct: string, year = '2023', kids = '40', kidPct = '12.5'): string[] =>
  [`n${fips}`, fips, n, '1', pct, '0.1', kids, '2', kidPct, '0.3', year, '49', fips.slice(2)];

describe('unit: saipe parser with recorded fixture', () => {
  const parsed = Saipe.parse(fixture);
  it('keeps Utah counties, marks N/A not_published, drops other states', () => {
    expect(parsed.rejects).toEqual([]);
    const slc = parsed.rows.filter((r) => r.geo_fips === '49035');
    expect(slc.find((r) => r.indicator_code === 'poverty_count')?.value).toBe(111111);
    expect(slc.find((r) => r.indicator_code === 'poverty_rate')?.moe).toBe(0.4);
    expect(parsed.rows.some((r) => r.geo_fips === '16001')).toBe(false);
    expect(slc.map((r) => r.indicator_code)).toEqual([...Saipe.CODES]);
    expect(slc.find((r) => r.indicator_code === 'child_poverty_count')).toMatchObject({ value: 33333, moe: 1111, unit: 'count' });
    expect(slc.find((r) => r.indicator_code === 'child_poverty_rate')).toMatchObject({ value: 9.9, moe: 0.6, unit: 'percent' });
    const beaver = parsed.rows.filter((r) => r.geo_fips === '49001');
    expect(beaver).toHaveLength(Saipe.CODES.length);
    expect(beaver.every((r) => r.unit === Saipe.NOT_PUBLISHED && r.value === null && r.moe === null)).toBe(true);
  });

  it('fetch reads CENSUS_API_KEY from env only', async () => {
    await expect(Saipe.fetch('2023', {}, async () => new Response('[]'))).rejects.toThrow('CENSUS_API_KEY is not set');
    let requested = '';
    await Saipe.fetch('2023', { CENSUS_API_KEY: 'x' }, async (url) => {
      requested = String(url);
      return new Response('[["YEAR"]]', { status: 200 });
    });
    expect(requested).toMatch(/\/timeseries\/poverty\/saipe\?.*time=2023.*key=x/);
    expect(requested).toContain('SAEPOV0_17_PT,SAEPOV0_17_MOE,SAEPOVRT0_17_PT,SAEPOVRT0_17_MOE,YEAR');
  });
});

it.each([
  ['non-numeric count', ut('49035', 'abc', '9.2')],
  ['rate above 100', ut('49035', '10', '250')],
  ['negative count', ut('49035', '-5', '9.2')],
  ['child rate above 100', ut('49035', '10', '9.2', '2023', '5', '150')],
  ['non-numeric child count', ut('49035', '10', '9.2', '2023', 'abc')],
  ['missing FIPS', ['n', '', '10', '1', '9.2', '0.1', '5', '1', '4.0', '0.2', '2023', '', '']],
  ['missing year', ut('49035', '10', '9.2', '')],
])('rejects %s', (_label, row) => {
  const parsed = Saipe.parse([HDR, row]);
  expect(parsed.rejects.length).toBeGreaterThan(0);
  expect(() => Saipe.requireComplete(parsed)).toThrow(/rejected/);
});

it('fails closed when the response has fewer than 29 counties', () => {
  expect(() => Saipe.requireComplete(Saipe.parse(fixture))).toThrow(/partial/);
});
