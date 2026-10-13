import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COUNTIES } from '../../../lib/synthetic/generate';
import { Acs5 } from './index';

const fixture = JSON.parse(readFileSync('tests/fixtures/acs5/utah-counties.json', 'utf8')) as unknown;
const HDR = ['NAME', ...Acs5.VARIABLES, 'state', 'county'];
const row = (county: string, pop = '100', hh = '2.5', vet = '10'): string[] =>
  ['n', pop, '-555555555', hh, '0.1', vet, '5', '49', county];
const full = (): string[][] => COUNTIES.map((c) => row(c.fips.slice(2)));

describe('unit: acs5 parser with recorded fixture', () => {
  const parsed = Acs5.parse(fixture, '2024');

  it('keeps Utah counties, marks annotations not_published, drops other states', () => {
    expect(parsed.rejects).toEqual([]);
    const slc = parsed.rows.filter((r) => r.geo_fips === '49035');
    expect(slc.find((r) => r.indicator_code === 'population_total')).toMatchObject({ value: 1180000, moe: null, vintage: '2024' });
    expect(slc.find((r) => r.indicator_code === 'avg_household_size')?.value).toBe(2.9);
    expect(slc.find((r) => r.indicator_code === 'veterans_count')?.value).toBe(52000);
    const beaverHh = parsed.rows.find((r) => r.geo_fips === '49001' && r.indicator_code === 'avg_household_size');
    expect(beaverHh).toMatchObject({ value: null, unit: Acs5.NOT_PUBLISHED });
    expect(parsed.rows.some((r) => r.geo_fips === '32007')).toBe(false);
  });

  it('requests only the F-204 variables and reads CENSUS_API_KEY from env', async () => {
    await expect(Acs5.fetch('2024', {}, async () => new Response('[]'))).rejects.toThrow('CENSUS_API_KEY is not set');
    let url = '';
    await Acs5.fetch('2024', { CENSUS_API_KEY: 'k' }, async (u) => {
      url = String(u);
      return new Response('[]');
    });
    expect(url).toContain('/data/2024/acs/acs5?get=NAME,B01003_001E,B01003_001M,B25010_001E,B25010_001M,B21001_002E,B21001_002M&');
    expect(url).toContain('key=k');
  });
});

it('accepts all 29 counties and is order-independent in its checksum', () => {
  const rows = Acs5.requireComplete(Acs5.parse([HDR, ...full()], '2024'));
  expect(rows).toHaveLength(29 * 3);
  const flipped = Acs5.requireComplete(Acs5.parse([HDR, ...full().reverse()], '2024'));
  expect(Acs5.checksum(flipped)).toBe(Acs5.checksum(rows));
});

it.each([
  ['non-numeric value', row('035', 'abc')],
  ['negative value', row('035', '-5')],
  ['missing FIPS', row('')],
])('rejects %s', (_label, bad) => {
  const parsed = Acs5.parse([HDR, ...full().slice(1), bad], '2024');
  expect(parsed.rejects.length).toBeGreaterThan(0);
  expect(() => Acs5.requireComplete(parsed)).toThrow(/rejected/);
});

it('fails closed on missing columns or fewer than 29 counties', () => {
  expect(() => Acs5.requireComplete(Acs5.parse(fixture, '2024'))).toThrow(/partial/);
  const noVet = [HDR.slice(0, 5).concat(['state', 'county']), ...full().map((r) => r.slice(0, 5).concat(r.slice(7)))];
  expect(() => Acs5.requireComplete(Acs5.parse(noVet, '2024'))).toThrow(/rejected/);
});

it('n8n workflow is inactive and reads only $env', () => {
  const text = readFileSync('n8n/census-acs5.json', 'utf8');
  const wf = JSON.parse(text) as { active: boolean };
  expect(wf.active).toBe(false);
  expect(text).toContain('$env.FAS_INGEST_ACS5_URL');
  expect(text).not.toMatch(/https?:\/\/|20\d{2}/);
});
