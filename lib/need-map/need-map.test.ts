import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ErrorState } from '@/components/layout';
import { NeedTable } from '@/components/need-map/NeedTable';
import { NeedBins } from './bins';
import { NOT_PUBLISHED, NOT_YET, NeedMapQuery, type IndicatorRow, type NeedInput } from './query';
import { NeedRank } from './rank';

const ind = (fips: string, value: number | null, vintage = '2024', unit = 'percent'): IndicatorRow =>
  ({ source_id: 's1', indicator_code: 'uninsured_rate', geo_fips: fips, value, moe: 0.5, unit, vintage });
const input = (over: Partial<NeedInput> = {}): NeedInput => ({
  configs: [{ version: 'v1', created_at: '2026-10-01', approved_by: 'u1' }, { version: 'v2', created_at: '2026-10-02', approved_by: 'u1' }, { version: 'v3', created_at: '2026-10-03', approved_by: null }],
  scores: [{ version: 'v2', geo_fips: '49035', score: '1.5' }, { version: 'v2', geo_fips: '49049', score: -0.25 }, { version: 'v3', geo_fips: '49001', score: 9 }],
  indicators: [ind('49035', 50, '2023'), ind('49035', 9.2), ind('49001', null, '2024', 'not_published')],
  sources: [{ id: 's1', name: 'census-sahie', last_success_at: '2026-10-12T23:46:22Z' }, { id: 's9', name: 'census-saipe', last_success_at: '2027-01-01T00:00:00Z' }],
  fas: ['49035', '49049', '49011', '49057', '49045'].map((fips) => ({ fips })),
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
      ['Utah County', '2 of 2', '−0.25', '1 of 2'],
    ]);
    expect(data.rows[2]).toMatchObject({ name: 'Beaver County', rank: NOT_PUBLISHED, score: NOT_PUBLISHED, status: NOT_PUBLISHED });
  });

  it('shows the latest vintage, Not published, and Not available yet for unloaded counties', () => {
    const cell = (fips: string) => data.rows.find((r) => r.fips === fips)?.cells.uninsured_rate;
    expect(cell('49035')).toBe('9.2% ± 0.5');
    expect(cell('49001')).toBe(NOT_PUBLISHED);
    expect(cell('49049')).toBe(NOT_YET);
    const count = (code: string): IndicatorRow => ({ ...ind('1', 2518, '2024', 'count'), indicator_code: code, moe: null });
    expect(NeedMapQuery.cell({ ...count('uninsured_count'), moe: 0.5 })).toBe('2,518 people ± 0.5');
    expect(NeedMapQuery.cell(count('total_households'))).toBe('2,518 households');
    expect(NeedMapQuery.cell(count('veteran_population'))).toBe('2,518 veterans');
    expect(NeedMapQuery.cell(count('new_code'))).toBe('2,518');
    expect([NeedMapQuery.label('total_households'), NeedMapQuery.label('total_population'), NeedMapQuery.label('new_code')]).toEqual(['Households', 'Population', 'New code']);
    expect(['child_poverty_rate', 'child_poverty_count', 'single_parent_pct', 'single_parent_households', 'no_vehicle_pct', 'no_vehicle_households'].map(NeedMapQuery.label))
      .toEqual(['Child poverty rate', 'In child poverty', 'Single-parent households', 'Single-parent households (count)', 'No-vehicle households', 'No-vehicle households (count)']);
    expect([NeedMapQuery.cell(count('child_poverty_count')), NeedMapQuery.cell(count('no_vehicle_households'))]).toEqual(['2,518 people', '2,518 households']);
    expect(NeedMapQuery.cell(ind('1', 5, '2024', 'not_published'))).toBe(NOT_PUBLISHED);
    expect(NeedMapQuery.cell({ ...ind('1', 0.1, '2024', 'rate'), moe: null })).toBe('0.1');
  });

  it('notes `<source> <vintage>` per column; the footer lists used sources once and their latest success month', () => {
    expect(data.columns).toEqual([{ code: 'uninsured_rate', label: 'Uninsured rate', note: 'Census SAHIE 2024' }]);
    expect(data.sources).toEqual([{ code: 'uninsured_rate', name: 'Census SAHIE', vintage: '2024', asOf: 'Oct 2026' }]);
    expect(data.footer).toBe('Public sources: Census SAHIE · Need score version v2 · as of Oct 2026 · Placeholder bins');
    expect(NeedMapQuery.columnSource({ ...ind('1', 1), source_id: 'nope' }, [])).toEqual({ code: 'uninsured_rate', name: 'Unknown source', vintage: '2024', asOf: NOT_YET });
    const two = NeedMapQuery.build(input({ indicators: [ind('49035', 9.2), { ...ind('49035', 5, '2023', 'count'), source_id: 's9', indicator_code: 'poverty_count' }] }));
    expect([two.columns[0].note, two.footer]).toEqual(['Census SAIPE 2023', 'Public sources: Census SAIPE, Census SAHIE · Need score version v2 · as of Jan 2027 · Placeholder bins']);
  });

  it('says Not available yet everywhere when no version is approved', () => {
    const none = NeedMapQuery.build(input({ configs: [{ version: 'v3', created_at: '2026-10-03', approved_by: null }] }));
    expect(none.version).toBeNull();
    expect(none.hasData).toBe(true);
    expect(none.rows.every((r) => r.rank === NOT_YET && r.score === NOT_YET && r.bin === NOT_YET && r.status === NOT_YET)).toBe(true);
    expect(none.footer).toBe('Public sources: Census SAHIE · Need score version Not available yet · as of Oct 2026 · Placeholder bins');
  });

  it('reports no data when nothing is loaded', () => {
    const empty = NeedMapQuery.build(input({ scores: [], indicators: [] }));
    expect(empty.hasData).toBe(false);
    expect(empty.footer).toBe(`Public sources: ${NOT_YET} · Need score version v2 · as of ${NOT_YET} · Placeholder bins`);
  });

  it('marks FAS counties, filters to them on request and keeps the statewide rank', () => {
    expect(data.rows.filter((r) => r.fas).map((r) => r.fips).sort()).toEqual(['49011', '49035', '49045', '49049', '49057']);
    const only = NeedMapQuery.build(input(), { fas: true });
    expect(only.rows.map((r) => [r.fips, r.rank])).toEqual([['49035', '1 of 2'], ['49049', '2 of 2'], ['49011', NOT_PUBLISHED], ['49045', NOT_PUBLISHED], ['49057', NOT_PUBLISHED]]);
    expect(only.hasData).toBe(true);
    expect(NeedMapQuery.build(input({ fas: [{ fips: '00000' }] })).rows.some((r) => r.fas)).toBe(false);
  });

  it('filter on with no FAS counties configured yields no rows', () => {
    const none = NeedMapQuery.build(input({ fas: [] }), { fas: true });
    expect(none.rows).toEqual([]);
    expect(none.hasData).toBe(true);
    expect(NeedMapQuery.build(input({ fas: [] })).rows).toHaveLength(29);
  });

  it('eyebrow is BOARD only for board viewers', () => {
    expect(NeedMapQuery.eyebrow('board_viewer')).toBe('BOARD');
    expect(NeedMapQuery.eyebrow('staff')).toBe('WORKSPACE');
  });
});

describe('NeedMapQuery.load', () => {
  const fake = (error: { message: string } | null) => ({ from: () => ({ select: async () => ({ data: [], error }) }) }) as never;

  it('throws on any query error and builds otherwise', async () => {
    await expect(NeedMapQuery.load(fake({ message: 'denied' }))).rejects.toThrow('denied');
    expect((await NeedMapQuery.load(fake(null))).hasData).toBe(false);
  });
});

describe('NeedTable markup', () => {
  const html = renderToStaticMarkup(createElement(NeedTable, { data: NeedMapQuery.build(input()) }));
  it('wraps the table in a focusable labelled scroll region with a sticky County column', () => {
    expect(html).toMatch(/^<div role="region" tabindex="0" aria-label="County need table"[^>]*overflow-x-auto/);
    expect(html).toMatch(/<th scope="col" class="[^"]*md:sticky md:left-0[^"]*">County<\/th>/);
    expect(html).toMatch(/<th scope="row" class="[^"]*md:sticky md:left-0[^"]*"><a [^>]*>Salt Lake County<\/a><span data-slot="badge"/);
  });

  it('badges each FAS county and names it in the row label', () => {
    expect(html.match(/FAS county<\/span>/g)).toHaveLength(5);
    expect(html).toMatch(/<tr[^>]*aria-label="Salt Lake County, rank 1 of 2, need score \+1\.50, FAS county"/);
    expect(html).toMatch(/<tr[^>]*aria-label="Beaver County, not published"/);
    expect(html).not.toMatch(/<tr[^>]*aria-label="Beaver County[^"]*FAS county"/);
  });

  it('right-aligns number headers and cells at every width, notes `<source> <vintage>` per column and links county names', () => {
    expect(html).toMatch(/<th scope="col" aria-sort="ascending" class="[^"]*text-right tabular-nums">Rank<\/th>/);
    expect(html).toMatch(/<td class="[^"]*text-right tabular-nums"><span[^>]*>Rank: <\/span>1 of 2<\/td>/);
    expect(html).not.toContain('text-left tabular-nums');
    expect(html).toContain('Uninsured rate<span class="block text-xs font-normal text-muted-foreground">Census SAHIE 2024</span>');
    expect(html).toMatch(/<a [^>]*href="\?county=49035"[^>]*>Salt Lake County<\/a>/);
    const fasHtml = renderToStaticMarkup(createElement(NeedTable, { data: NeedMapQuery.build(input(), { fas: true }), fas: true }));
    expect(fasHtml).toMatch(/href="\?county=49035&amp;fas=1"/);
  });

  it('ErrorState renders its body inside the alert', () => {
    const err = renderToStaticMarkup(createElement(ErrorState, { message: 'm', referenceId: 'r' }, 'Body text'));
    expect(err).toMatch(/data-slot="error-state"[^]*<p>Body text<\/p>/);
  });
});
