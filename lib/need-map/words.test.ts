import { describe, expect, it } from 'vitest';
import { COUNTIES } from '../synthetic/generate';
import type { Column } from './query';
import { NeedMapQuery, type NeedInput } from './query';
import { LEGEND_NOTE, bandHint, bandName, hoverWords, legendBands, topCounties } from './words';

const UNPUBLISHED = ['49009', '49031', '49055'];
const seedScore = (fips: string): number => (fips === '49011' ? seedScore('49005') : ((Number(fips.slice(2)) * 7) % 29 - 14) / 10);
const columns: Column[] = [{ code: 'uninsured_rate', label: 'Uninsured rate', note: 'Census SAHIE 2024', unit: 'percent' }];
const input: NeedInput = {
  configs: [{ version: 'v2-synthetic', created_at: '2026-10-01', approved_by: 'u1' }],
  scores: COUNTIES.filter((c) => !UNPUBLISHED.includes(c.fips)).map((c) => ({ version: 'v2-synthetic', geo_fips: c.fips, score: seedScore(c.fips) })),
  indicators: COUNTIES.map((c, i) => ({ source_id: 's1', indicator_code: 'uninsured_rate', geo_fips: c.fips, value: 5 + (i % 7), moe: null, unit: 'percent', vintage: '2024' })),
  sources: [{ id: 's1', name: 'census-sahie', last_success_at: '2026-10-01T00:00:00Z' }],
  fas: ['49035', '49049', '49011', '49057', '49045'].map((fips) => ({ fips })),
};
const data = NeedMapQuery.build(input);
const find = (fips: string) => data.counties.find((c) => c.fips === fips)!;

describe('DS-11b map words', () => {
  it('names bands in words for 1 to 5 bands and writes the legend from the data', () => {
    expect([bandName(5, 5), bandName(1, 5), bandName(2, 2), bandName(6, 5)]).toEqual(['Highest need', 'Lowest need', 'Higher need', 'Band 6']);
    const bands = legendBands(data.counties);
    expect(bands.map((b) => b.name)).toEqual(['Lowest need', 'Lower need', 'Middle', 'Higher need', 'Highest need']);
    expect([bands[0], bands[4]]).toEqual([{ name: 'Lowest need', range: '−1.40 to −0.80', count: 7 }, { name: 'Highest need', range: '+1.00 to +1.40', count: 5 }]);
    expect(bandHint(bands[4]!, 5, 5)).toBe('Need scores +1.00 to +1.40, 5 counties. Band 5 of 5: equal-count placeholder bands until FAS sets the final weights.');
    expect(legendBands([])).toEqual([]);
  });
  it('writes the county card: title, one sentence about the rank, then rank, score, band, FAS, the standout measure and the source', () => {
    const davis = hoverWords(find('49011'), data.counties, columns, 'v2-synthetic');
    expect(davis.term).toEqual({ id: 'county:49011', title: 'Davis County', plain: 'A higher need score than 6 of the 25 other counties scored. Relative ranking, not absolute need.' });
    expect(davis.rows).toEqual([['Rank', '20 of 26'], ['Need score', '−0.80'], ['Band', 'Lowest need (1 of 5)'], ['FAS county', 'Yes, FAS funds therapy here'],
      ['Stands out on', 'Uninsured rate, 10%, above the state median of 8%'], ['Source', 'Need score version v2-synthetic']]);
    expect(davis.hidden).toBeUndefined();
    const rich = hoverWords(find('49033'), data.counties, columns, 'v2-synthetic');
    expect([rich.rows[0], rich.rows[3]]).toEqual([['Rank', '1 of 26'], ['FAS county', undefined]]);
  });
  it('explains a county with no score instead of inventing a rank', () => {
    const daggett = hoverWords(find('49009'), data.counties, columns, 'v2-synthetic');
    expect(daggett.term.plain).toBe('No need score, so no rank or band. Its public measures are still in the table.');
    expect(daggett.rows.slice(0, 3).map((r) => r[1])).toEqual([undefined, undefined, undefined]);
    expect(daggett.hidden).toBe('The source did not publish this for this county in that release.');
    expect(hoverWords(find('49009'), data.counties, [], null).rows.at(-1)).toEqual(['Source', undefined]);
  });
  it('DS-20a: topCounties is the first five ranked rows in rank order; with ?fas=1 the top FAS counties; unscored rows never count', () => {
    expect(topCounties(data.rows).map((c) => [c.rank, c.name])).toEqual([['1 of 26', 'Rich County'], ['2 of 26', 'San Juan County'], ['3 of 26', 'Sevier County'], ['4 of 26', 'Tooele County'], ['5 of 26', 'Utah County']]);
    expect(topCounties(NeedMapQuery.build(input, { fas: true }).rows).map((c) => c.name)).toEqual(['Tooele County', 'Utah County', 'Weber County', 'Salt Lake County', 'Davis County']);
    expect(topCounties(data.rows.filter((c) => c.status !== 'Ranked'))).toEqual([]);
    expect(topCounties(data.rows, 2)).toHaveLength(2);
    expect(LEGEND_NOTE).toBe('Relative ranking · placeholder bands until FAS sets the weights.');
  });
});
