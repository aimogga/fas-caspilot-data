import { describe, expect, it } from 'vitest';
import { pickerOptions } from './picker';
import type { CountyRow } from './query';

const row = (fips: string, name: string, status = 'Ranked'): CountyRow => ({ fips, name, fas: false, rank: '1 of 2', score: '+1.00', bin: '1 of 1', status, value: 1, binNo: 1, cells: {}, values: {} });

describe('pickerOptions (DS-22)', () => {
  it('lists counties alphabetically with the FIPS code as value and no rank text', () => {
    expect(pickerOptions([row('49033', 'Rich County'), row('49001', 'Beaver County'), row('49035', 'Salt Lake County')])).toEqual([
      { value: '49001', label: 'Beaver County' }, { value: '49033', label: 'Rich County' }, { value: '49035', label: 'Salt Lake County' }]);
  });
  it('adds "(no score)" to a county that is not ranked, and lists only the rows it is given', () => {
    const options = pickerOptions([row('49009', 'Daggett County', 'Not published'), row('49005', 'Cache County')]);
    expect(options.map((o) => o.label)).toEqual(['Cache County', 'Daggett County (no score)']);
    expect(pickerOptions([])).toEqual([]);
  });
});
