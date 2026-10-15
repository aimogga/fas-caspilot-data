/** Plain-language comparison for the county panel: each percent indicator against the statewide median and the other counties, in words first.
 * Pure. Only indicators with a `percent` unit compare (counts scale with population); a county with no published value for an indicator skips it. */
import type { Column, CountyRow } from './query';

export type Compare = { code: string; label: string; value: number; median: number; higherThan: number; of: number; where: 'above' | 'below' | 'near' };
const NEAR = 0.5;
export const NeedCompare = {
  median(xs: number[]): number | null {
    const s = [...xs].sort((a, b) => a - b), n = s.length;
    return n === 0 ? null : n % 2 ? (s[(n - 1) / 2] as number) : ((s[n / 2 - 1] as number) + (s[n / 2] as number)) / 2;
  },
  /** One row per percent column the county has a value for; the median is over every county with a value, the rank over the others. */
  rows(county: CountyRow, counties: CountyRow[], columns: Column[]): Compare[] {
    return columns.flatMap((c) => {
      const value = county.values[c.code];
      if (c.unit !== 'percent' || value == null) return [];
      const all = counties.map((x) => x.values[c.code]).filter((v): v is number => v != null);
      const others = counties.filter((x) => x.fips !== county.fips).map((x) => x.values[c.code]).filter((v): v is number => v != null);
      const median = NeedCompare.median(all);
      if (median == null || others.length < 2) return [];
      const where = Math.abs(value - median) <= NEAR ? 'near' : value > median ? 'above' : 'below';
      return [{ code: c.code, label: c.label, value, median: Math.round(median * 10) / 10, higherThan: others.filter((v) => v < value).length, of: others.length, where }];
    });
  },
  /** `Salt Lake County has a higher uninsured rate than 20 of 28 other Utah counties, and a higher poverty rate than 12 of 28.` Leads with the indicator furthest above the pack. */
  sentence(county: CountyRow, rows: Compare[]): string {
    if (rows.length === 0) return `No rate indicators are published for ${county.name} yet.`;
    const top = [...rows].sort((a, b) => b.higherThan / b.of - a.higherThan / a.of).slice(0, 2);
    const what = (label: string) => (/rate$/i.test(label) ? label.toLowerCase() : `share of ${label.toLowerCase()}`);
    const part = (r: Compare, i: number) => `a higher ${what(r.label)} than ${r.higherThan} of ${r.of}${i === 0 ? ' other Utah counties' : ''}`;
    return `${county.name} has ${top.map(part).join(', and ')}.`;
  },
  /** `9.2%, above the state median of 8.1%` — the text equivalent of one comparison bar. */
  words(r: Compare): string {
    return `${r.value}%, ${r.where} the state median of ${r.median}%`;
  },
};
