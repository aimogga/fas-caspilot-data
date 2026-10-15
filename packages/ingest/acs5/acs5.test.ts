import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CensusTable } from '../census-table';
import { Acs5 } from './index';

const fixture = JSON.parse(
  readFileSync('tests/fixtures/acs5/utah-counties.json', 'utf8'),
) as unknown;
const HDR = ['NAME', 'B01003_001E', 'B11001_001E', 'B21001_002E', 'B11003_010E', 'B11003_016E', 'B08201_002E', 'state', 'county'];
const table = (rows: string[][]): unknown => [HDR, ...rows];
const ut = (fips: string, pop: string, hh: string, vet: string, sp = ['150', '400'], nv = '300'): string[] => [
  `n${fips}`,
  pop,
  hh,
  vet,
  ...sp,
  nv,
  '49',
  fips.slice(2),
];

describe('unit: acs5 parser with recorded fixture', () => {
  const parsed = Acs5.parse(fixture);

  it('parses fixture, validates checksum, requires API key', async () => {
    expect(parsed.rejects).toEqual([]);
    const slc = parsed.rows.filter((r) => r.geo_fips === '49035');
    expect(slc.find((r) => r.indicator_code === 'total_population')?.value).toBe(1185000);
    expect(slc.find((r) => r.indicator_code === 'total_households')?.value).toBe(381000);
    expect(slc.find((r) => r.indicator_code === 'veteran_population')?.value).toBe(65000);
    expect(slc.find((r) => r.indicator_code === 'single_parent_households')).toMatchObject({ value: 24765, unit: 'count', moe: null });
    expect(slc.find((r) => r.indicator_code === 'no_vehicle_households')).toMatchObject({ value: 15240, unit: 'count', moe: null });
    expect(slc.find((r) => r.indicator_code === 'single_parent_pct')).toMatchObject({ value: 6.5, unit: 'percent', moe: null });
    expect(slc.find((r) => r.indicator_code === 'no_vehicle_pct')).toMatchObject({ value: 4, unit: 'percent', moe: null });
    expect(slc.map((r) => r.indicator_code)).toEqual([...Acs5.CODES]);
    expect(parsed.rows.length).toBe(29 * 7);
    const rows = Acs5.requireComplete(Acs5.parse(fixture), '2023');
    expect(Acs5.checksum(rows)).toBe('453a3a54d210d73a3ba9898ee97a360fb647cbb1a5301fee1e8140bae6ec0e16');
    await expect(Acs5.fetch('2024', {}, async () => new Response('[]'))).rejects.toThrow('CENSUS_API_KEY is not set');
    let requested = '';
    const body = await Acs5.fetch('2023', { CENSUS_API_KEY: 'x' }, async (url) => {
      requested = String(url);
      return new Response(JSON.stringify([['B01003_001E'], ['10000']]), { status: 200 });
    });
    expect(body).toEqual([['B01003_001E'], ['10000']]);
    expect(requested).toContain('/2023/acs/acs5');
    expect(requested).toContain('get=NAME,B01003_001E,B11001_001E,B21001_002E,B11003_010E,B11003_016E,B08201_002E&');
    expect(requested).toContain('key=x');
  });
});

it('derives single_parent_pct and no_vehicle_pct from total_households (1 dp; null or 0 denominator → not_published)', () => {
  const r = Acs5.parse(table([ut('49035', '100000', '1000', '5000', ['100', '150'], '400')]));
  expect(r.rejects).toEqual([]);
  const by = (code: string) => r.rows.find((x) => x.indicator_code === code);
  expect(by('single_parent_households')).toMatchObject({ value: 250, unit: 'count' });
  expect(by('single_parent_pct')).toMatchObject({ value: 25, unit: 'percent', moe: null });
  expect(by('no_vehicle_pct')).toMatchObject({ value: 40, unit: 'percent', moe: null });
  expect(Acs5.pct(1, 3)).toBe(33.3);
  for (const hh of ['N/A', '0', '-']) {
    const p = Acs5.parse(table([ut('49035', '100000', hh, '5000')]));
    expect(p.rejects).toEqual([]);
    expect(p.rows.find((x) => x.indicator_code === 'single_parent_pct')).toMatchObject({ value: null, unit: 'not_published' });
    expect(p.rows.find((x) => x.indicator_code === 'no_vehicle_pct')).toMatchObject({ value: null, unit: 'not_published' });
  }
  const half = Acs5.parse(table([ut('49035', '100000', '1000', '5000', ['N/A', '150'])]));
  expect(half.rows.find((x) => x.indicator_code === 'single_parent_households')).toMatchObject({ value: null, unit: 'not_published' });
  expect(half.rows.find((x) => x.indicator_code === 'single_parent_pct')?.value).toBeNull();
  expect(Acs5.parse(table([ut('49035', '100000', '1000', '5000', ['x', '150'])])).rejects).toEqual(['49035 single_parent_households not numeric']);
});

it.each([
  ['non-numeric population', ut('49035', 'abc', '10000', '1000')],
  ['negative population', ut('49035', '-100', '10000', '1000')],
  ['negative households', ut('49035', '100000', '-10', '1000')],
  ['negative no-vehicle households', ut('49035', '100000', '10000', '1000', ['1', '2'], '-3')],
  ['missing FIPS', ['n', '10000', '3000', '500', '100', '200', '50', '', '']],
])('rejects %s', (_label, row) => {
  const parsed = Acs5.parse(table([row]));
  expect(parsed.rejects.length).toBeGreaterThan(0);
  expect(() => Acs5.requireComplete(parsed, '2023')).toThrow(/rejected/);
});

it('fails closed: partial response or incomplete county', () => {
  const partial = [HDR, ut('49035', '100000', '30000', '5000')];
  expect(() => Acs5.requireComplete(Acs5.parse(partial), '2023')).toThrow(/partial/);
  const p = Acs5.parse(fixture);
  const missingVar = { rows: p.rows.filter((r) => !(r.geo_fips === '49035' && r.indicator_code === 'veteran_population')), rejects: [] };
  expect(() => Acs5.requireComplete(missingVar, '2023')).toThrow(/partial/);
});

it('N/A values become not_published', () => {
  const withNA = [HDR, ut('49035', 'N/A', '10000', '5000')];
  const parsed = Acs5.parse(withNA);
  expect(parsed.rows.find((r) => r.indicator_code === 'total_population')?.unit).toBe('not_published');
  expect(parsed.rows.find((r) => r.indicator_code === 'total_households')?.unit).toBe('count');
});

it('n8n workflow inactive; CensusTable validates shape', () => {
  const text = readFileSync('n8n/census-acs.json', 'utf8');
  const wf = JSON.parse(text) as { active: boolean; nodes: { type: string }[] };
  expect(wf.active).toBe(false);
  expect(wf.nodes.some((n) => n.type === 'n8n-nodes-base.scheduleTrigger')).toBe(true);
  expect(wf.nodes.some((n) => n.type === 'n8n-nodes-base.httpRequest')).toBe(true);
  expect(text).toContain('https://fas-caspilot-data.vercel.app/api/ingest/acs');
  expect(text).not.toMatch(/20\d{2}/);
  expect(() => CensusTable.parse({})).toThrow(/census table/);
  expect(() => CensusTable.parse([['a'], [1, 2]])).toThrow(/width/);
});

it('ACS "-" parses to null (not_published)', () => {
  expect(Acs5.num('-')).toBeNull();
  const r = Acs5.parse(table([['Salt Lake County, Utah', '-', '10', '5', '1', '2', '3', '49', '035']]));
  expect(r.rejects).toEqual([]);
  expect(r.rows.find((x) => x.indicator_code === 'total_population')).toMatchObject({ value: null, unit: 'not_published' });
});
