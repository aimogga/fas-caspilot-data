import { describe, expect, it } from 'vitest';
import { KEY_CODES, ORDER, header, isMissing, needMapHref, orderColumns, parseCols, plainCell, rankNumber } from './columns';
import { NOT_PUBLISHED, NOT_YET, type Column, type CountyRow } from './query';

const col = (code: string, unit = 'count'): Column => ({ code, label: code, note: 'Census ACS 5-year 2023', unit });
const row = (over: Partial<CountyRow> = {}): CountyRow => ({ fips: '49035', name: 'Salt Lake County', fas: true, rank: '1 of 26', score: '+1.74', bin: '5 of 5', status: 'Ranked', value: 1.74, binNo: 5,
  cells: { uninsured_rate: '9.2% ± 0.5', uninsured_count: '3,090 people ± 310', poverty_count: NOT_PUBLISHED }, values: { uninsured_rate: 9.2, uninsured_count: 3090, poverty_count: null }, ...over });

describe('DS-20c: table columns', () => {
  const loaded = ['veteran_population', 'zeta_rate', 'uninsured_count', 'no_vehicle_pct', 'alpha_count', 'poverty_rate', 'uninsured_rate', 'total_population'].map((c) => col(c, c.endsWith('pct') || c.endsWith('rate') ? 'percent' : 'count'));

  it('Key measures: the loaded scored rates only, in the score order', () => {
    expect(KEY_CODES).toEqual(['uninsured_rate', 'poverty_rate', 'child_poverty_rate', 'single_parent_pct', 'no_vehicle_pct']);
    expect(orderColumns(loaded, 'key').map((c) => c.code)).toEqual(['uninsured_rate', 'poverty_rate', 'no_vehicle_pct']);
    expect(orderColumns([col('total_population')], 'key')).toEqual([]);
  });

  it('All measures: every loaded column, rates first by topic, then counts, unknown codes last alphabetically', () => {
    expect(ORDER.slice(0, 5)).toEqual(KEY_CODES);
    expect(orderColumns(loaded, 'all').map((c) => c.code)).toEqual(['uninsured_rate', 'poverty_rate', 'no_vehicle_pct', 'uninsured_count', 'total_population', 'veteran_population', 'alpha_count', 'zeta_rate']);
    expect(orderColumns(loaded, 'all')).toHaveLength(loaded.length);
  });

  it('?cols=all is the only way to the full view', () => {
    expect([parseCols('all'), parseCols('key'), parseCols(undefined), parseCols(['all'])]).toEqual(['all', 'key', 'key', 'key']);
  });

  it('headers are short and carry the unit; an unknown percent column gets the % sign', () => {
    expect(['uninsured_rate', 'child_poverty_rate', 'uninsured_count', 'no_vehicle_households'].map((c) => header(col(c)))).toEqual(['Uninsured %', 'Child poverty %', 'Uninsured (people)', 'No-vehicle (households)']);
    expect([header({ ...col('new_rate', 'percent'), label: 'New rate' }), header({ ...col('new_count'), label: 'New count' })]).toEqual(['New rate %', 'New count']);
  });

  it('cells are one short line: the stored value without noun or margin; missing values keep their words', () => {
    expect(plainCell(row(), col('uninsured_rate', 'percent'))).toBe('9.2%');
    expect(plainCell(row(), col('uninsured_count'))).toBe('3,090');
    expect(plainCell(row(), col('poverty_count'))).toBe(NOT_PUBLISHED);
    expect(plainCell(row(), col('veteran_population'))).toBe(NOT_YET);
  });

  it('a missing value is flagged so the cell shows a dash, not a sentence', () => {
    expect([isMissing(row(), col('uninsured_count')), isMissing(row(), col('poverty_count')), isMissing(row(), col('veteran_population'))]).toEqual([false, true, true]);
  });

  it('court filings sit after the census measures in All, with short headers', () => {
    const codes = ['court_filings_total', 'veteran_population', 'court_filings_district', 'uninsured_rate'];
    expect(orderColumns(codes.map((c) => col(c)), 'all').map((c) => c.code)).toEqual(['uninsured_rate', 'veteran_population', 'court_filings_total', 'court_filings_district']);
    expect(orderColumns(codes.map((c) => col(c)), 'key').map((c) => c.code)).toEqual(['uninsured_rate']);
    expect(header(col('court_filings_district'))).toBe('Court filings (district)');
  });

  it('rank is the number alone, null when unranked', () => {
    expect([rankNumber(row()), rankNumber(row({ rank: '20 of 26' })), rankNumber(row({ rank: NOT_PUBLISHED, status: NOT_PUBLISHED }))]).toEqual(['1', '20', null]);
  });

  it('links keep the FAS filter and the selected county; cols=all only for the full view', () => {
    expect(needMapHref({})).toBe('/need-map');
    expect(needMapHref({ fas: true, county: '49035', cols: 'all' })).toBe('/need-map?county=49035&fas=1&cols=all');
    expect(needMapHref({ fas: true, county: '49035', cols: 'key' })).toBe('/need-map?county=49035&fas=1');
    expect(needMapHref({ county: null, cols: 'all' })).toBe('/need-map?cols=all');
  });
});
