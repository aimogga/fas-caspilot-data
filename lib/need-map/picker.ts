/** Options for the county picker (DS-22): counties A to Z, no rank text; a county without a need score says so. Pure. */
import type { CountyRow } from './query';

export type PickerOption = { value: string; label: string };
export const PICKER_LABEL = 'Choose a county';
export const PICKER_PLACEHOLDER = 'Select a county…';

/** `rows` already honours the FAS filter, so under `?fas=1` only FAS counties are listed; a selected county outside it (a map click) stays in the list so the menu can show it. */
export function pickerOptions(rows: CountyRow[], selected: CountyRow | null = null): PickerOption[] {
  const all = selected && !rows.some((r) => r.fips === selected.fips) ? [...rows, selected] : rows;
  return all.map((r) => ({ value: r.fips, label: r.status === 'Ranked' ? r.name : `${r.name} (no score)` })).sort((a, b) => a.label.localeCompare(b.label));
}
