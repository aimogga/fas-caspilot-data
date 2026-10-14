export const ALIAS: Record<string, string> = { uninsured: 'uninsured_rate' };
const LABELS: Record<string, string> = {
  uninsured_rate: 'Uninsured rate',
  poverty_rate: 'Poverty rate',
  child_poverty_rate: 'Child poverty rate',
  single_parent_pct: 'Single-parent households',
  no_vehicle_pct: 'No-vehicle households',
};
const SOURCES: Record<string, string> = { 'census-sahie': 'Census SAHIE', 'census-saipe': 'Census SAIPE', 'census-acs': 'Census ACS 5-year' };
export const UNLABELED = 'Unlabeled input';

export function indicatorCodes(key: string): string[] {
  return ALIAS[key] ? [key, ALIAS[key]] : [key];
}

export function inputLabel(key: string): { label: string; known: boolean } {
  const label = LABELS[key] ?? LABELS[ALIAS[key] ?? ''];
  return label ? { label, known: true } : { label: key, known: false };
}

export function sourceLabel(name: string): string {
  return SOURCES[name] ?? name;
}
