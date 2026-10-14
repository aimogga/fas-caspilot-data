import { describe, expect, it } from 'vitest';
import { indicatorCodes, inputLabel, sourceLabel, UNLABELED } from './labels';

describe('F-210 methodology labels', () => {
  it('maps weight keys and sources to display labels; unknown keys stay raw and flagged', () => {
    expect([inputLabel('uninsured'), inputLabel('uninsured_rate')]).toEqual([{ label: 'Uninsured rate', known: true }, { label: 'Uninsured rate', known: true }]);
    expect(['poverty_rate', 'child_poverty_rate', 'single_parent_pct', 'no_vehicle_pct'].map((k) => inputLabel(k).label)).toEqual(['Poverty rate', 'Child poverty rate', 'Single-parent households', 'No-vehicle households']);
    expect(inputLabel('mystery_key')).toEqual({ label: 'mystery_key', known: false });
    expect(UNLABELED).toBe('Unlabeled input');
    expect([indicatorCodes('uninsured'), indicatorCodes('poverty_rate')]).toEqual([['uninsured', 'uninsured_rate'], ['poverty_rate']]);
    expect(['census-sahie', 'census-saipe', 'census-acs', 'other'].map(sourceLabel)).toEqual(['Census SAHIE', 'Census SAIPE', 'Census ACS 5-year', 'other']);
  });
});
