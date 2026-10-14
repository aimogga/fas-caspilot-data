/** F-402 board dashboard data: the latest complete quarter, all counties, compared to the prior quarter. No filters, no URL params. Numbers come from
 * the same `MetricsQuery` as the team dashboard (same suppression), so the board never sees more than staff. */
import type { SupabaseClient } from '@supabase/supabase-js';
import { ALL, latestCompleteQuarter, type Filters } from '../dashboard/filters';
import { MetricsQuery, type DashboardMetrics, type ViewRows } from '../dashboard/metrics-query';
import type { FreshnessView } from '../dashboard/freshness';
import { DashboardQuery } from '../dashboard/query';
import { NOT_AVAILABLE } from '../dashboard/cards';

export type BoardData = { period: string; metrics: DashboardMetrics; freshness: FreshnessView | null; asOf: string };
export const boardFilters = (now: Date): Filters => ({ period: latestCompleteQuarter(now), county: ALL, referral: ALL, compare: 'prior' });
/** Latest `as of` month across the loaded cards (`Mon YYYY` strings); `Not available yet` when no card has a date. */
export function boardAsOf(m: DashboardMetrics): string {
  const dates = (['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'o1'] as const).map((k) => m[k]).filter((x) => !('error' in x) && x.asOf !== NOT_AVAILABLE).map((x) => (x as { asOf: string }).asOf);
  return dates.sort((a, b) => Date.parse(`1 ${a} UTC`) - Date.parse(`1 ${b} UTC`)).pop() ?? NOT_AVAILABLE;
}
export const BoardQuery = {
  /** Pure: view rows → board data for the quarter `now` falls after. */
  build(rows: ViewRows, now: Date, freshness: FreshnessView | null = null): BoardData {
    const f = boardFilters(now), metrics = MetricsQuery.build(rows, f);
    return { period: f.period, metrics, freshness, asOf: boardAsOf(metrics) };
  },
  /** Metrics and the freshness widget load side by side; a freshness failure only drops that widget. */
  async load(client: SupabaseClient, now: Date): Promise<BoardData> {
    const [metrics, dash] = await Promise.all([
      MetricsQuery.load(client, boardFilters(now)),
      DashboardQuery.load(client, now).catch((e: unknown) => { console.error('[board] freshness failed', { message: e instanceof Error ? e.message : 'unknown' }); return null; }),
    ]);
    return { period: boardFilters(now).period, metrics, freshness: dash?.freshness ?? null, asOf: boardAsOf(metrics) };
  },
};
