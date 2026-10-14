import { CADENCE_DAYS, Freshness, type FreshnessStatus } from '@/lib/dashboard/freshness';

/** DS-05 helpers. The D-021 stale rule itself lives in lib/dashboard/freshness.ts; this module only re-exports it. */
export { CADENCE_DAYS, Freshness };
export type { FreshnessIndicator, FreshnessRun, FreshnessSource, FreshnessStatus } from '@/lib/dashboard/freshness';

const DAY_MS = 86_400_000;
/** Aggregate priority: Failed > Stale > Not published > Current. */
export const RANK: Readonly<Record<FreshnessStatus, number>> = { failed: 0, stale: 1, not_published: 2, current: 3 };
const CADENCE_WORD: Readonly<Record<string, string>> = { monthly: 'Monthly', quarterly: 'Quarterly', annual: 'Annual', yearly: 'Yearly' };

/** Whole days since the last success (for `Stale · N days`); null when there has never been one. */
export function staleDays(source: { last_success_at: string | null }, now: Date): number | null {
  if (!source.last_success_at) return null;
  return Math.max(0, Math.floor((now.getTime() - Date.parse(source.last_success_at)) / DAY_MS));
}

/** Worst status across rows, or null when there are no rows. */
export function aggregate(rows: ReadonlyArray<{ status: FreshnessStatus }>): FreshnessStatus | null {
  return rows.reduce<FreshnessStatus | null>((worst, r) => (worst === null || RANK[r.status] < RANK[worst] ? r.status : worst), null);
}

export function humanCadence(cadence: string | null): string {
  const key = (cadence ?? '').trim().toLowerCase();
  if (!key) return '—';
  return CADENCE_WORD[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

/** Day-precision run date in UTC (`Oct 12, 2026`); `Never` for null. Public-source metadata only, so a day is allowed. */
export function runDate(iso: string | null): string {
  if (!iso) return 'Never';
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 'Never' : new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export type TopBarChip = { status: FreshnessStatus; label: string };
/** `today` / `1 day ago` / `N days ago` for the Current chip (public-source run metadata, so a day is allowed). */
export function relativeDays(days: number): string {
  return days <= 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`;
}

/** DS-05 top-bar copy by aggregate priority; null means the chip stays hidden (no sources). */
export function topBarChip(rows: ReadonlyArray<{ status: FreshnessStatus; staleDays: number | null }>, sources: ReadonlyArray<{ last_success_at: string | null }>, now: Date): TopBarChip | null {
  const status = aggregate(rows);
  if (status === null) return null;
  if (status === 'failed') return { status, label: 'Last run failed' };
  if (status === 'not_published') return { status, label: 'Not published' };
  if (status === 'stale') {
    const worst = Math.max(...rows.filter((r) => r.status === 'stale').map((r) => r.staleDays ?? 0));
    return { status, label: `Stale · ${worst} days` };
  }
  const ages = sources.map((s) => staleDays(s, now)).filter((d): d is number => d !== null);
  return { status, label: `Public data updated ${relativeDays(Math.min(...ages))}` };
}
