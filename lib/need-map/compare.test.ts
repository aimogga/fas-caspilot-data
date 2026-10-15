import { describe, expect, it } from 'vitest';
import { NeedCompare } from './compare';
import type { Column, CountyRow } from './query';
const columns: Column[] = [
  { code: 'uninsured_rate', label: 'Uninsured rate', note: 'Census SAHIE 2024', unit: 'percent' }, { code: 'poverty_rate', label: 'Poverty rate', note: 'Census SAIPE 2023', unit: 'percent' },
  { code: 'poverty_count', label: 'In poverty', note: 'Census SAIPE 2023', unit: 'count' }];
const county = (fips: string, name: string, values: Record<string, number | null>): CountyRow =>
  ({ fips, name, fas: false, rank: '1 of 5', score: '+1.00', bin: '5 of 5', status: 'Ranked', cells: {}, value: 1, binNo: 5, values });
const salt = county('49035', 'Salt Lake County', { uninsured_rate: 9.2, poverty_rate: 8, poverty_count: 90000 });
const counties = [salt, county('49011', 'Davis County', { uninsured_rate: 6, poverty_rate: 5, poverty_count: 10000 }), county('49049', 'Utah County', { uninsured_rate: 8, poverty_rate: 9, poverty_count: 50000 }),
  county('49057', 'Weber County', { uninsured_rate: 10, poverty_rate: 8.2, poverty_count: 20000 }), county('49007', 'Carbon County', { uninsured_rate: null, poverty_rate: 12, poverty_count: null })];
describe('NeedCompare', () => {
  it('takes the median of odd and even sets', () => {
    expect([NeedCompare.median([3, 1, 2]), NeedCompare.median([4, 1, 3, 2]), NeedCompare.median([])]).toEqual([2, 2.5, null]);
  });
  it('compares percent indicators only, against every county with a value and ranked among the others', () => {
    const rows = NeedCompare.rows(salt, counties, columns);
    expect(rows).toEqual([
      { code: 'uninsured_rate', label: 'Uninsured rate', value: 9.2, median: 8.6, higherThan: 2, of: 3, where: 'above' },
      { code: 'poverty_rate', label: 'Poverty rate', value: 8, median: 8.2, higherThan: 1, of: 4, where: 'near' }]);
    expect(NeedCompare.rows(counties[4]!, counties, columns).map((r) => [r.code, r.where])).toEqual([['poverty_rate', 'above']]);
    expect(NeedCompare.rows(county('49001', 'Beaver County', { uninsured_rate: null, poverty_rate: null }), counties, columns)).toEqual([]);
    expect(NeedCompare.rows(salt, counties.slice(0, 2), columns)).toEqual([]);
  });
  it('writes the sentence rank-first, leading with the indicator furthest above the pack, and the bar words', () => {
    const rows = NeedCompare.rows(salt, counties, columns);
    expect(NeedCompare.sentence(salt, rows)).toBe('Salt Lake County has a higher uninsured rate than 2 of 3 other Utah counties, and a higher poverty rate than 1 of 4.');
    expect(NeedCompare.sentence(salt, rows.slice(1))).toBe('Salt Lake County has a higher poverty rate than 1 of 4 other Utah counties.');
    expect(NeedCompare.sentence(salt, [])).toBe('No rate indicators are published for Salt Lake County yet.');
    expect(NeedCompare.sentence(salt, [{ ...rows[0]!, label: 'Single-parent households' }])).toBe('Salt Lake County has a higher share of single-parent households than 2 of 3 other Utah counties.');
    expect(rows.map(NeedCompare.words)).toEqual(['9.2%, above the state median of 8.6%', '8%, near the state median of 8.2%']);
  });
});
