import { describe, expect, it } from 'vitest';
import { KEY_MEASURES, measureGroups, ordinal, rankLine } from './panel';
import type { Column, CountyRow } from './query';

const row = (over: Partial<CountyRow> = {}): CountyRow => ({ fips: '49035', name: 'Salt Lake County', fas: true, rank: '3 of 26', score: '+1.20', bin: '5 of 5', status: 'Ranked', value: 1.2, binNo: 5, cells: {}, values: {}, ...over });
const bands = [1, 2, 3, 4, 5].map((binNo) => row({ fips: `4900${binNo}`, binNo }));
const col = (code: string, unit = 'percent'): Column => ({ code, label: code, note: '', unit });
const src = (code: string, name: string, vintage = '2023') => ({ code, name, vintage, asOf: 'Oct 2026' });

describe('county panel words (DS-20b)', () => {
  it('names the five scored rates in panel order', () => {
    expect(KEY_MEASURES).toEqual(['uninsured_rate', 'poverty_rate', 'child_poverty_rate', 'single_parent_pct', 'no_vehicle_pct']);
  });

  it('writes the rank as an ordinal from the stored rank, with the band name; rank 1 is "Highest need"', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st']);
    expect(rankLine(row(), bands)).toEqual({ ranked: true, place: '3rd highest need', rest: ' of 26 counties scored · Highest need band' });
    expect(rankLine(row({ rank: '1 of 26' }), bands).place).toBe('Highest need');
    expect(rankLine(row({ rank: '14 of 26', binNo: 3 }), bands).rest).toBe(' of 26 counties scored · Middle band');
  });

  it('gives an unscored county no rank, in words, with the existing reason', () => {
    expect(rankLine(row({ rank: 'Not published', score: 'Not published', status: 'Not published', binNo: null }), bands))
      .toEqual({ ranked: false, place: 'No need score, so no rank or band.', rest: 'The source did not publish this for this county in that release.' });
    expect(rankLine(row({ rank: 'Not available yet', status: 'Not available yet', binNo: null }), bands).rest).toBe('This number appears once the data behind it is set up.');
  });

  it('groups measures by source and release under a plain topic, known sources first, key rates first, then other rates, then counts', () => {
    const columns = [col('child_poverty_count', 'count'), col('child_poverty_rate'), col('no_vehicle_pct'), col('poverty_rate'), col('single_parent_pct'), col('total_population', 'count'), col('uninsured_rate'), col('veteran_rate'), col('x_rate')];
    const sources = [src('child_poverty_count', 'Census SAIPE'), src('child_poverty_rate', 'Census SAIPE'), src('no_vehicle_pct', 'Census ACS 5-year'), src('poverty_rate', 'Census SAIPE'),
      src('single_parent_pct', 'Census ACS 5-year'), src('total_population', 'Census ACS 5-year'), src('uninsured_rate', 'Census SAHIE'), src('veteran_rate', 'Census ACS 5-year'), src('x_rate', 'VA VetPop')];
    const groups = measureGroups(columns, sources);
    expect(groups.map((g) => [g.topic, `${g.source.name} ${g.source.vintage}`, g.columns.map((c) => c.code)])).toEqual([
      ['Health coverage', 'Census SAHIE 2023', ['uninsured_rate']],
      ['Poverty', 'Census SAIPE 2023', ['poverty_rate', 'child_poverty_rate', 'child_poverty_count']],
      ['Households and population', 'Census ACS 5-year 2023', ['single_parent_pct', 'no_vehicle_pct', 'veteran_rate', 'total_population']],
      ['VA VetPop', 'VA VetPop 2023', ['x_rate']]]);
    expect(measureGroups([col('a'), col('b')], [src('a', 'Census SAIPE', '2022'), src('b', 'Census SAIPE')]).map((g) => g.source.vintage)).toEqual(['2022', '2023']);
    expect(measureGroups([col('a')], [])[0]).toMatchObject({ topic: 'Unknown source', source: { name: 'Unknown source', vintage: 'Not published', asOf: 'Not available yet' } });
  });
});
