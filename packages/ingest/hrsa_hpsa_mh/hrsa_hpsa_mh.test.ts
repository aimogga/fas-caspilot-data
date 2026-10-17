import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HrsaHpsaMh } from './index';

const fixture = readFileSync('tests/fixtures/hrsa_hpsa_mh/utah.csv', 'utf8');
const NOW = new Date('2026-10-13T12:00:00Z');
const HDR = 'HPSA Name,HPSA Status,HPSA Score,HPSA Designation Population,Common State County FIPS Code';
const csv = (...rows: string[]) => [HDR, ...rows].join('\n');
const at = (rows: { geo_fips: string; indicator_code: string }[], fips: string, code: string) =>
  rows.find((r) => r.geo_fips === fips && r.indicator_code === code) as { value: number | null; unit: string } | undefined;

describe('unit: HRSA MH HPSA parser with hand-written fixture', () => {
  const parsed = HrsaHpsaMh.parse(fixture, NOW);
  const filled = HrsaHpsaMh.fill(parsed);

  it('parses 7 designated counties, fills to 29 × 3 rows with a single run-date vintage', () => {
    expect(parsed.rejects).toEqual([]);
    expect([parsed.rows.length, filled.rows.length]).toEqual([21, 87]);
    expect(filled.rows.every((r) => r.vintage === '2026-10-13' && r.period === '2026-10-13')).toBe(true);
    expect(HrsaHpsaMh.requireComplete(filled)).toBe(filled.rows);
  });

  it('flags, max score and population sum per county; a multi-county HPSA counts once per county it touches', () => {
    expect(at(parsed.rows, '49007', 'mh_hpsa_designated')).toMatchObject({ value: 1, unit: 'count' });
    expect(at(parsed.rows, '49007', 'mh_hpsa_score_max')).toMatchObject({ value: 14, unit: 'score' });
    expect(at(parsed.rows, '49007', 'mh_hpsa_designated_population')?.value).toBe(25000);
    expect([at(parsed.rows, '49015', 'mh_hpsa_designated_population')?.value, at(parsed.rows, '49019', 'mh_hpsa_score_max')?.value]).toEqual([20000, 14]);
    expect(at(parsed.rows, '49057', 'mh_hpsa_designated')?.value).toBe(1); // Proposed For Withdrawal still designated
  });

  it('excludes Withdrawn HPSAs, non-Utah rows and other disciplines; filled counties are a real 0', () => {
    expect(at(parsed.rows, '49035', 'mh_hpsa_score_max')?.value).toBe(20); // the Withdrawn 12 / 30000 HPSA is ignored
    expect(at(parsed.rows, '49035', 'mh_hpsa_designated_population')?.value).toBe(150000);
    expect(parsed.rows.some((r) => r.geo_fips === '16001' || r.geo_fips === '49009')).toBe(false);
    expect(at(filled.rows, '49009', 'mh_hpsa_designated')).toMatchObject({ value: 0, unit: 'count' });
    expect(at(filled.rows, '49009', 'mh_hpsa_score_max')).toMatchObject({ value: null, unit: HrsaHpsaMh.NOT_PUBLISHED });
    expect(at(filled.rows, '49009', 'mh_hpsa_designated_population')).toMatchObject({ value: null, unit: HrsaHpsaMh.NOT_PUBLISHED });
  });

  it('fails closed without fill and on an unknown header, listing the headers seen', () => {
    expect(() => HrsaHpsaMh.requireComplete(parsed)).toThrow(/HPSA partial response: 7 counties/);
    expect(() => HrsaHpsaMh.parse('Foo,Bar\n1,2', NOW)).toThrow(/^HPSA: unknown columns Foo, Bar$/);
    expect(() => HrsaHpsaMh.parse('HPSA Status,Primary State Abbreviation\nDesignated,UT', NOW)).toThrow(/unknown columns/);
  });

  it('builds a 5-digit FIPS from state + 3-digit county, honours withdrawn dates, rejects bad score or population', () => {
    const hdr = 'HPSA Status,State FIPS Code,County FIPS Code,HPSA Score,HPSA Designation Population,Withdrawn Date';
    const p = HrsaHpsaMh.parse(`${hdr}\nDesignated,49,035,10,500,\nDesignated,49,049,8,900,2024-01-01`, NOW);
    expect(p.rows.map((r) => r.geo_fips)).toEqual(['49035', '49035', '49035']);
    expect(HrsaHpsaMh.parse(csv('A,Designated,27,10,49035'), NOW).rejects).toEqual(['49035 score out of range']);
    for (const pop of ['12.5', '-1']) expect(HrsaHpsaMh.parse(csv(`A,Designated,10,${pop},49035`), NOW).rejects).toEqual(['49035 population not a count']);
    expect(HrsaHpsaMh.parse(csv('A,Designated,10,5,'), NOW).rejects).toEqual(['missing FIPS']);
    expect(() => HrsaHpsaMh.requireComplete(HrsaHpsaMh.fill(HrsaHpsaMh.parse(csv('A,Designated,27,10,49035'), NOW)))).toThrow(/rejected 1/);
  });

  it('live export shape (#207): a trailing comma on the header, other states\' facility rows with FIPS XXXXX; a Utah row without FIPS still rejects', () => {
    const hdr = 'HPSA Status,HPSA Score,HPSA Designation Population,Primary State Abbreviation,Common State County FIPS Code,';
    const p = HrsaHpsaMh.parse(`${hdr}\r\nDesignated,10,500,UT,49035\r\nWithdrawn,0,0,TX,XXXXX\r\nProposed For Withdrawal,3,9,CT,XXXXX\r\n`, NOW);
    expect([p.rows.map((r) => r.geo_fips), p.rejects]).toEqual([['49035', '49035', '49035'], []]);
    expect(HrsaHpsaMh.parse(`${hdr}\nDesignated,10,500,UT,XXXXX\n`, NOW).rejects).toEqual(['missing FIPS']);
  });

  it('fetch fails closed on non-2xx without echoing the URL', async () => {
    await expect(HrsaHpsaMh.fetch(async () => new Response('nope', { status: 403 }))).rejects.toThrow(/^HPSA fetch failed: 403$/);
    const seen: string[] = [];
    expect(await HrsaHpsaMh.fetch(async (url) => (seen.push(String(url)), new Response('x', { status: 200 })))).toBe('x');
    expect(seen).toEqual([HrsaHpsaMh.DOWNLOAD_URL]);
  });
});
