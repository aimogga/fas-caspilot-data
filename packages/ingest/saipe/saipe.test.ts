import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Saipe } from './index';

const fixture = JSON.parse(readFileSync('tests/fixtures/saipe/utah-counties.json', 'utf8')) as unknown;
const HDR = ['NAME', 'GEOID', 'SAEPOVALL_PT', 'SAEPOVALL_MOE', 'SAEPOVRTALL_PT', 'SAEPOVRTALL_MOE', 'YEAR', 'state', 'county'];
const ut = (fips: string, n: string, pct: string, year = '2023'): string[] =>
  [`n${fips}`, fips, n, '1', pct, '0.1', year, '49', fips.slice(2)];

describe('unit: saipe parser with recorded fixture', () => {
  const parsed = Saipe.parse(fixture);

  it('keeps Utah counties, marks N/A not_published, drops other states', () => {
    expect(parsed.rejects).toEqual([]);
    const slc = parsed.rows.filter((r) => r.geo_fips === '49035');
    expect(slc.find((r) => r.indicator_code === 'poverty_count')?.value).toBe(111111);
    expect(slc.find((r) => r.indicator_code === 'poverty_rate')?.moe).toBe(0.4);
    expect(parsed.rows.some((r) => r.geo_fips === '16001')).toBe(false);
    expect(parsed.rows.filter((r) => r.geo_fips === '49001').every((r) => r.unit === Saipe.NOT_PUBLISHED)).toBe(true);
  });

  it('fetch reads CENSUS_API_KEY from env only', async () => {
    await expect(Saipe.fetch('2023', {}, async () => new Response('[]'))).rejects.toThrow('CENSUS_API_KEY is not set');
    let requested = '';
    await Saipe.fetch('2023', { CENSUS_API_KEY: 'x' }, async (url) => {
      requested = String(url);
      return new Response('[["YEAR"]]', { status: 200 });
    });
    expect(requested).toContain('/timeseries/poverty/saipe?');
    expect(requested).toContain('time=2023');
    expect(requested).toContain('key=x');
    await expect(Saipe.fetch('2023', { CENSUS_API_KEY: 'x' }, async () => new Response('', { status: 500 }))).rejects.toThrow('500');
  });
});

it.each([
  ['non-numeric count', ut('49035', 'abc', '9.2')],
  ['rate above 100', ut('49035', '10', '250')],
  ['negative count', ut('49035', '-5', '9.2')],
  ['missing FIPS', ['n', '', '10', '1', '9.2', '0.1', '2023', '', '']],
  ['missing year', ut('49035', '10', '9.2', '')],
])('rejects %s', (_label, row) => {
  const parsed = Saipe.parse([HDR, row]);
  expect(parsed.rejects.length).toBeGreaterThan(0);
  expect(() => Saipe.requireComplete(parsed)).toThrow(/rejected/);
});

it('fails closed when the response has fewer than 29 counties', () => {
  expect(() => Saipe.requireComplete(Saipe.parse(fixture))).toThrow(/partial/);
});

it('checksum is stable regardless of row order', () => {
  const rows = Saipe.parse(fixture).rows;
  expect(Saipe.checksum([...rows].reverse())).toBe(Saipe.checksum(rows));
});
