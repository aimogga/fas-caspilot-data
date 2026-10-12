import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COUNTIES } from '../../../lib/synthetic/generate';
import { CensusTable } from '../census-table';
import { Sahie } from './index';

const fixture = JSON.parse(readFileSync('tests/fixtures/sahie/utah-counties.json', 'utf8')) as unknown;

describe('unit: sahie parser with recorded fixture', () => {
  const parsed = Sahie.parse(fixture);
  const covered = Sahie.coverUtah(parsed);

  it('keeps under-65 all-income Utah counties from the fixture', () => {
    const slc = parsed.filter((r) => r.geo_fips === '49035');
    expect(slc).toHaveLength(2);
    expect(slc.find((r) => r.indicator_code === 'uninsured_count')?.value).toBe(95000);
    expect(slc.find((r) => r.indicator_code === 'uninsured_rate')?.value).toBe(9.2);
    expect(parsed.filter((r) => r.geo_fips === '49049')).toHaveLength(2);
    expect(parsed.some((r) => r.value === 50000)).toBe(false);
  });

  it('marks N/A and missing counties not_published and covers all 29', () => {
    const beaver = parsed.filter((r) => r.geo_fips === '49001');
    expect(beaver.every((r) => r.unit === Sahie.NOT_PUBLISHED && r.value == null)).toBe(true);
    expect(covered).toHaveLength(COUNTIES.length * 2);
    expect(new Set(covered.map((r) => r.geo_fips)).size).toBe(29);
    expect(COUNTIES.every((c) => covered.some((r) => r.geo_fips === c.fips))).toBe(true);
    const daggett = covered.filter((r) => r.geo_fips === '49009');
    expect(daggett).toHaveLength(2);
    expect(daggett.every((r) => r.unit === Sahie.NOT_PUBLISHED)).toBe(true);
  });

  it('fetch reads CENSUS_API_KEY and unit tests do not need a real key', async () => {
    await expect(Sahie.fetch('2024', {}, async () => new Response('[]'))).rejects.toThrow(
      'CENSUS_API_KEY is not set',
    );
    let requested = '';
    const table = await Sahie.fetch('2023', { CENSUS_API_KEY: 'x' }, async (url) => {
      requested = String(url);
      return new Response(JSON.stringify([['YEAR'], ['2023']]), { status: 200 });
    });
    expect(table).toEqual([['YEAR'], ['2023']]);
    expect(requested).toContain('time=2023');
    expect(requested).toContain('key=x');
  });
});

describe('n8n SAHIE workflow', () => {
  it('is exported inactive with a schedule that POSTs the ingest route', () => {
    const wf = JSON.parse(readFileSync('n8n/census-sahie.json', 'utf8')) as {
      active: boolean;
      nodes: { type: string; parameters: { url?: string } }[];
    };
    expect(wf.active).toBe(false);
    expect(wf.nodes.some((n) => n.type === 'n8n-nodes-base.scheduleTrigger')).toBe(true);
    const http = wf.nodes.find((n) => n.type === 'n8n-nodes-base.httpRequest');
    expect(http?.parameters.url).toContain('FAS_INGEST_SAHIE_URL');
  });
});

it('CensusTable rejects a non-table payload', () => {
  expect(() => CensusTable.parse({})).toThrow(/census table/);
  expect(() => CensusTable.parse([['a'], [1, 2]])).toThrow(/width/);
});
