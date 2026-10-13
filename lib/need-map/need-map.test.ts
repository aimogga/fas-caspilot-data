import { describe, expect, it } from 'vitest';
import { NeedBins } from './bins';
import { NOT_PUBLISHED, NOT_YET, NeedMapQuery, type IndicatorRow, type NeedInput } from './query';
import { NeedRank } from './rank';

const ind = (fips: string, value: number | null, vintage = '2024', unit = 'percent'): IndicatorRow =>
  ({ source_id: 's1', indicator_code: 'uninsured_rate', geo_fips: fips, value, moe: 0.5, unit, vintage });
const input = (over: Partial<NeedInput> = {}): NeedInput => ({
  configs: [{ version: 'v1', created_at: '2026-10-01', approved_by: 'u1' }, { version: 'v2', created_at: '2026-10-02', approved_by: 'u1' }, { version: 'v3', created_at: '2026-10-03', approved_by: null }],
  scores: [{ version: 'v2', geo_fips: '49035', score: '1.5' }, { version: 'v2', geo_fips: '49049', score: -0.25 }, { version: 'v3', geo_fips: '49001', score: 9 }],
  indicators: [ind('49035', 50, '2023'), ind('49035', 9.2), ind('49001', null, '2024', 'not_published')],
  sources: [{ id: 's1', name: 'census-sahie', last_success_at: '2026-10-12T23:46:22Z' }, { id: 's9', name: 'unused', last_success_at: '2027-01-01T00:00:00Z' }],
  ...over,
});

describe('rank and bins', () => {
  it('ranks highest first, skips unscored counties, shares tied ranks', () => {
    const r = NeedRank.rank([{ fips: 'a', score: 1 }, { fips: 'b', score: 3 }, { fips: 'c', score: null }, { fips: 'd', score: 1 }]);
    expect([...r.entries()]).toEqual([['b', 1], ['a', 2], ['d', 2]]);
  });

  it('uses quantile bins over scored counties and fewer bins for few distinct values', () => {
    const rows = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score, i) => ({ fips: `f${i}`, score }));
    expect([...NeedBins.assign(rows).values()]).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
    const few = NeedBins.assign([{ fips: 'a', score: 1 }, { fips: 'b', score: 1 }, { fips: 'c', score: 2 }, { fips: 'd', score: null }]);
    expect([...few.entries()]).toEqual([['a', 1], ['b', 1], ['c', 2]]);
  });
});

describe('NeedMapQuery.build', () => {
  const data = NeedMapQuery.build(input());

  it('uses the newest approved version only and lists all 29 counties', () => {
    expect(data.version).toBe('v2');
    expect(data.rows).toHaveLength(29);
    expect(data.rows.slice(0, 2).map((r) => [r.name, r.rank, r.score, r.bin])).toEqual([
      ['Salt Lake County', '1 of 2', '+1.50', '2 of 2'],
      ['Utah County', '2 of 2', '-0.25', '1 of 2'],
    ]);
    expect(data.rows[2]).toMatchObject({ name: 'Beaver County', rank: NOT_PUBLISHED, score: NOT_PUBLISHED, status: NOT_PUBLISHED });
  });

  it('shows the latest vintage, Not published, and Not available yet for unloaded counties', () => {
    const cell = (fips: string) => data.rows.find((r) => r.fips === fips)?.cells.uninsured_rate;
    expect(cell('49035')).toBe('9.2% ± 0.5');
    expect(cell('49001')).toBe(NOT_PUBLISHED);
    expect(cell('49049')).toBe(NOT_YET);
    expect(NeedMapQuery.cell(ind('1', 95000, '2024', 'count'))).toBe('95,000 people ± 0.5');
    expect(NeedMapQuery.cell({ ...ind('1', 95000, '2024', 'count'), moe: null })).toBe('95,000 people');
    expect(NeedMapQuery.cell(ind('1', 5, '2024', 'not_published'))).toBe(NOT_PUBLISHED);
    expect(NeedMapQuery.cell({ ...ind('1', 0.1, '2024', 'rate'), moe: null })).toBe('0.1');
  });

  it('footer cites only used sources and their latest success month', () => {
    expect(data.footer).toBe('Public sources: census-sahie · Need score version v2 · as of Oct 2026');
  });

  it('says Not available yet everywhere when no version is approved', () => {
    const none = NeedMapQuery.build(input({ configs: [{ version: 'v3', created_at: '2026-10-03', approved_by: null }] }));
    expect(none.version).toBeNull();
    expect(none.hasData).toBe(true);
    expect(none.rows.every((r) => r.rank === NOT_YET && r.score === NOT_YET && r.bin === NOT_YET && r.status === NOT_YET)).toBe(true);
    expect(none.footer).toBe('Public sources: census-sahie · Need score version Not available yet · as of Oct 2026');
  });

  it('reports no data when nothing is loaded', () => {
    const empty = NeedMapQuery.build(input({ scores: [], indicators: [] }));
    expect(empty.hasData).toBe(false);
    expect(empty.footer).toBe(`Public sources: ${NOT_YET} · Need score version v2 · as of ${NOT_YET}`);
  });

  it('eyebrow is BOARD only for board viewers', () => {
    expect(NeedMapQuery.eyebrow('board_viewer')).toBe('BOARD');
    expect(NeedMapQuery.eyebrow('staff')).toBe('WORKSPACE');
  });
});

describe('NeedMapQuery.load', () => {
  const fake = (error: { message: string } | null) => ({
    from: () => ({ select: async () => ({ data: [], error }) }),
  }) as never;

  it('throws on any query error and builds otherwise', async () => {
    await expect(NeedMapQuery.load(fake({ message: 'denied' }))).rejects.toThrow('denied');
    expect((await NeedMapQuery.load(fake(null))).hasData).toBe(false);
  });
});
