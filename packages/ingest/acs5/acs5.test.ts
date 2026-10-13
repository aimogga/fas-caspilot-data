import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CensusTable } from '../census-table';
import { Acs5 } from './index';

const fixture = JSON.parse(
  readFileSync('tests/fixtures/acs5/utah-counties.json', 'utf8'),
) as unknown;
const HDR = ['NAME', 'B01003_001E', 'B11001_001E', 'B21001_002E', 'state', 'county'];
const table = (rows: string[][]): unknown => [HDR, ...rows];
const ut = (fips: string, pop: string, hh: string, vet: string): string[] => [
  `n${fips}`,
  pop,
  hh,
  vet,
  '49',
  fips.slice(2),
];

describe('unit: acs5 parser with recorded fixture', () => {
  const parsed = Acs5.parse(fixture);

  it('keeps fixture counties, marks N/A not_published', () => {
    expect(parsed.rejects).toEqual([]);
    const slc = parsed.rows.filter((r) => r.geo_fips === '49035');
    expect(slc.find((r) => r.indicator_code === 'total_population')?.value).toBe(1185000);
    expect(slc.find((r) => r.indicator_code === 'total_households')?.value).toBe(381000);
    expect(slc.find((r) => r.indicator_code === 'veteran_population')?.value).toBe(65000);
    expect(parsed.rows.length).toBe(29 * 3);
  });

  it('fetch reads CENSUS_API_KEY from env only', async () => {
    await expect(Acs5.fetch('2024', {}, async () => new Response('[]'))).rejects.toThrow(
      'CENSUS_API_KEY is not set',
    );
    let requested = '';
    const body = await Acs5.fetch('2023', { CENSUS_API_KEY: 'x' }, async (url) => {
      requested = String(url);
      return new Response(JSON.stringify([['B01003_001E'], ['10000']]), { status: 200 });
    });
    expect(body).toEqual([['B01003_001E'], ['10000']]);
    expect(requested).toContain('/2023/acs/acs5');
    expect(requested).toContain('key=x');
  });
});

it.each([
  ['non-numeric population', ut('49035', 'abc', '10000', '1000')],
  ['negative population', ut('49035', '-100', '10000', '1000')],
  ['negative households', ut('49035', '100000', '-10', '1000')],
  ['missing FIPS', ['n', '10000', '3000', '500', '', '']],
])('rejects %s', (_label, row) => {
  const parsed = Acs5.parse(table([row]));
  expect(parsed.rejects.length).toBeGreaterThan(0);
  expect(() => Acs5.requireComplete(parsed, '2023')).toThrow(/rejected|partial/);
});

it('fails closed when the response has fewer than 29 counties', () => {
  const partial = [HDR, ut('49035', '100000', '30000', '5000')];
  expect(() => Acs5.requireComplete(Acs5.parse(partial), '2023')).toThrow(/partial/);
});

it('n8n workflow is inactive and posts to the ingest handler', () => {
  const text = readFileSync('n8n/census-acs.json', 'utf8');
  const wf = JSON.parse(text) as { active: boolean; nodes: { type: string }[] };
  expect(wf.active).toBe(false);
  expect(wf.nodes.some((n) => n.type === 'n8n-nodes-base.scheduleTrigger')).toBe(true);
  expect(wf.nodes.some((n) => n.type === 'n8n-nodes-base.httpRequest')).toBe(true);
  expect(text).toContain('$env.FAS_INGEST_ACS_URL');
  expect(text).not.toMatch(/20\d{2}/);
});

it('CensusTable rejects a non-table payload', () => {
  expect(() => CensusTable.parse({})).toThrow(/census table/);
  expect(() => CensusTable.parse([['a'], [1, 2]])).toThrow(/width/);
});
