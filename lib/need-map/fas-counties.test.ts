import { describe, expect, it } from 'vitest';
import { FasCounties } from './fas-counties';

describe('FasCounties.fromRows', () => {
  it('keeps known Utah fips only and collapses duplicates', () => {
    const set = FasCounties.fromRows([{ fips: '49035' }, { fips: '49035' }, { fips: '49049' }, { fips: '99999' }, { fips: '' }]);
    expect([...set]).toEqual(['49035', '49049']);
  });

  it('accepts an empty list', () => {
    expect(FasCounties.fromRows([]).size).toBe(0);
  });

  it('checks fips against the county list it is given', () => {
    expect([...FasCounties.fromRows([{ fips: 'a' }, { fips: 'b' }, { fips: 'b' }], [{ fips: 'b' }])]).toEqual(['b']);
  });
});
