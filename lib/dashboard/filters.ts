export type Compare = 'prior' | 'none';
export type Filters = { period: string; county: string; referral: string; compare: Compare };
export type SearchParams = Record<string, string | string[] | undefined>;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PERIOD = /^(\d{4})-Q([1-4])$/;
export const ALL = 'all';
const pick = (params: SearchParams, key: string): string[] => ([] as string[]).concat(params[key] ?? []);

export function latestCompleteQuarter(now: Date): string {
  const q = Math.floor(now.getUTCMonth() / 3);
  return q === 0 ? `${now.getUTCFullYear() - 1}-Q4` : `${now.getUTCFullYear()}-Q${q}`;
}
export function priorQuarter(period: string): string {
  const m = PERIOD.exec(period);
  if (!m) return period;
  return m[2] === '1' ? `${Number(m[1]) - 1}-Q4` : `${m[1]}-Q${Number(m[2]) - 1}`;
}

/** `2026-Q3` → `Jul–Sep 2026 (Q3)` (en dash). Invalid input is returned unchanged. */
export function quarterLabel(period: string): string {
  const m = PERIOD.exec(period);
  if (!m) return period;
  const q = Number(m[2]);
  return `${MONTHS[(q - 1) * 3]}–${MONTHS[q * 3 - 1]} ${m[1]} (Q${q})`;
}
export function quarterOptions(now: Date, count = 8): string[] {
  const out = [latestCompleteQuarter(now)];
  while (out.length < count) out.push(priorQuarter(out[out.length - 1] as string));
  return out;
}

/** Defaults: latest complete quarter (UTC), all, all, prior; invalid values fall back. */
export function parseFilters(params: SearchParams, now: Date, counties: string[] = []): Filters {
  const [period, county, referral] = ['period', 'county', 'referral'].map((k) => (pick(params, k)[0] ?? ALL).trim());
  const compare = pick(params, 'compare');
  return {
    period: quarterOptions(now).includes(period as string) ? (period as string) : latestCompleteQuarter(now),
    county: counties.includes(county as string) ? (county as string) : ALL,
    referral: referral && referral.length <= 80 ? referral : ALL,
    compare: compare.includes('prior') || !compare.includes('none') ? 'prior' : 'none',
  };
}
export function activeCount(f: Filters, now: Date): number {
  return [f.period !== latestCompleteQuarter(now), f.county !== ALL, f.referral !== ALL, f.compare === 'none'].filter(Boolean).length;
}
export function describeFilters(f: Filters, countyName: string | null): string {
  return `${quarterLabel(f.period)} · ${countyName ? `${countyName} County` : 'All counties'} · ${f.referral === ALL ? 'All referral sources' : f.referral}`;
}
