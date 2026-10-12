import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CensusTable } from '../census-table';
import { Sahie } from './index';

const fixture = JSON.parse(readFileSync('tests/fixtures/sahie/utah-counties.json', 'utf8')) as unknown;
const HDR = ['NAME', 'GEOID', 'NUI_PT', 'NUI_MOE', 'PCTUI_PT', 'PCTUI_MOE', 'YEAR', 'AGECAT', 'SEXCAT', 'RACECAT', 'IPRCAT', 'state', 'county'];
const table = (rows: string[][]): unknown => [HDR, ...rows];
const ut = (fips: string, nui: string, pct: string, year = '2023'): string[] =>
  [`n${fips}`, fips, nui, '1', pct, '0.1', year, '0', '0', '0', '0', '49', fips.slice(2)];

describe('unit: sahie parser with recorded fixture', () => {
  const parsed = Sahie.parse(fixture);

  it('keeps fixture counties, marks N/A not_published, ignores AGECAT 1', () => {
    expect(parsed.rejects).toEqual([]);
    const slc = parsed.rows.filter((r) => r.geo_fips === '49035');
    expect(slc.find((r) => r.indicator_code === 'uninsured_count')?.value).toBe(95000);
    expect(slc.find((r) => r.indicator_code === 'uninsured_rate')?.value).toBe(9.2);
    expect(parsed.rows.some((r) => r.value === 50000 || r.geo_fips === '49009')).toBe(false);
    expect(parsed.rows.filter((r) => r.geo_fips === '49001').every((r) => r.unit === Sahie.NOT_PUBLISHED)).toBe(true);
  });

  it('fetch reads CENSUS_API_KEY from env only', async () => {
    await expect(Sahie.fetch('2024', {}, async () => new Response('[]'))).rejects.toThrow('CENSUS_API_KEY is not set');
    let requested = '';
    const body = await Sahie.fetch('2023', { CENSUS_API_KEY: 'x' }, async (url) => {
      requested = String(url);
      return new Response(JSON.stringify([['YEAR'], ['2023']]), { status: 200 });
    });
    expect(body).toEqual([['YEAR'], ['2023']]);
    expect(requested).toContain('time=2023');
    expect(requested).toContain('key=x');
  });
});

it.each([
  ['non-numeric count', ut('49035', 'abc', '9.2')],
  ['rate above 100', ut('49035', '10', '250')],
  ['rate below 0', ut('49035', '10', '-3')],
  ['negative count', ut('49035', '-5', '9.2')],
  ['missing FIPS', ['n', '', '10', '1', '9.2', '0.1', '2023', '0', '0', '0', '0', '', '']],
  ['missing year', ut('49035', '10', '9.2', '')],
])('rejects %s', (_label, row) => {
  const parsed = Sahie.parse(table([row]));
  expect(parsed.rejects.length).toBeGreaterThan(0);
  expect(() => Sahie.requireComplete(parsed)).toThrow(/rejected|partial/);
});

it('fails closed when the response has fewer than 29 counties', () => {
  expect(() => Sahie.requireComplete(Sahie.parse(fixture))).toThrow(/partial/);
});

it('n8n workflow is inactive and pending #89', () => {
  const text = readFileSync('n8n/census-sahie.json', 'utf8');
  const wf = JSON.parse(text) as { name: string; active: boolean; nodes: { type: string }[] };
  expect(wf.active).toBe(false);
  expect(wf.name).toContain('#89');
  expect(wf.nodes.some((n) => n.type === 'n8n-nodes-base.scheduleTrigger')).toBe(true);
  expect(text).not.toMatch(/2024|FAS_INGEST_SAHIE_URL/);
});

it('CensusTable rejects a non-table payload', () => {
  expect(() => CensusTable.parse({})).toThrow(/census table/);
  expect(() => CensusTable.parse([['a'], [1, 2]])).toThrow(/width/);
});
