import { describe, expect, it } from 'vitest';
import { NeedMapQuery, type NeedInput } from '@/lib/need-map/query';
import { boardCounties, ordinal } from './counties';
const input = (over: Partial<NeedInput> = {}): NeedInput => ({
  configs: [{ version: 'v2', created_at: '2026-10-02', approved_by: 'u1' }],
  scores: [{ version: 'v2', geo_fips: '49035', score: '1.5' }, { version: 'v2', geo_fips: '49049', score: -0.25 }, { version: 'v2', geo_fips: '49011', score: 0.4 }],
  indicators: [{ source_id: 's1', indicator_code: 'uninsured_rate', geo_fips: '49035', value: 9.2, moe: null, unit: 'percent', vintage: '2024' }],
  sources: [{ id: 's1', name: 'census-sahie', last_success_at: '2026-10-12T23:46:22Z' }],
  fas: ['49035', '49049', '49011', '49057'].map((fips) => ({ fips })), ...over,
});
describe('board counties (DS-13b)', () => {
  it('words the finding and support from stored ranks; an unscored FAS county reads Not published, never a number', () => {
    const c = boardCounties(NeedMapQuery.build(input()));
    expect(c.state).toBe('value');
    expect(c.rows.map((r) => [r.name, r.rank, r.of, r.score])).toEqual([['Salt Lake County', 1, 3, '+1.50'], ['Davis County', 2, 3, '+0.40'], ['Utah County', 3, 3, '−0.25'], ['Weber County', null, 0, 'Not published']]);
    expect(c.finding).toBe('Salt Lake County has the highest need of the 4 counties we serve, ranked 1st of 3 statewide.');
    expect(c.support).toBe('3 of 4 rank among the 10 highest-need counties in Utah; 1 not published. Relative ranking, not absolute need.');
    expect([c.source, c.asOf, c.version, c.rows[3]?.hidden]).toEqual(['Census SAHIE 2024', 'Oct 2026', 'v2', 'The source did not publish this for this county in that release.']);
    expect([ordinal(1), ordinal(2), ordinal(3), ordinal(4), ordinal(11), ordinal(12), ordinal(13), ordinal(21), ordinal(22)]).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd']);
  });
  it('is not available without an approved score version or a loaded table, and names the empty county list', () => {
    expect(boardCounties(null)).toMatchObject({ state: 'not-available', finding: 'County need is not available yet.', version: null, source: 'Not available yet', asOf: 'Not available yet' });
    expect(boardCounties(NeedMapQuery.build(input({ configs: [] })))).toMatchObject({ state: 'not-available', support: 'This number appears once the data behind it is set up.' });
    expect(boardCounties(NeedMapQuery.build(input({ fas: [] })))).toMatchObject({ state: 'no-counties', finding: 'No service counties are recorded yet.', rows: [] });
  });
});
