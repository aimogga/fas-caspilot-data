/** Team dashboard trend pictures (F-401 follow-on): the four-quarter line for M2, M3 and M5 under their cards, from the same suppressed `MetricsQuery` trends. Pure.
 * M1 keeps the trend inside its headline card. A picture exists only when its metric loaded with n > 0 and at least one quarter is known. */
import type { ChartPoint } from '../charts/scale';
import { quarterPoints } from './format';
import type { DashboardMetrics, Loaded, Wired } from './metrics-query';

export type TrendPicture = { id: 'm2' | 'm3' | 'm5'; kind: 'line'; eyebrow: string; noun: string; unit: string; valueHead: string; points: ChartPoint[]; n: number; asOf: string };
const SPEC = [
  { id: 'm2', eyebrow: 'Wait for a funding decision', noun: 'Days to a decision', unit: ' days', valueHead: 'Median days' },
  { id: 'm3', eyebrow: 'Approved but never started', noun: 'Share never started', unit: '%', valueHead: 'Share' },
  { id: 'm5', eyebrow: 'Cost per completed episode', noun: 'Dollars per completed episode', unit: '$', valueHead: 'Dollars' },
] as const;
const ok = (m: Loaded<Wired> | undefined): m is Wired => !!m && !('error' in m) && m.n > 0;
export function dashboardTrends(x: DashboardMetrics | null): TrendPicture[] {
  if (!x) return [];
  return SPEC.flatMap((s) => {
    const m = x[s.id] as Loaded<Wired> | undefined, pts = quarterPoints(x.trends[s.id] ?? [], s.unit);
    return ok(m) && pts.length > 1 && pts.some((p) => p.value != null) ? [{ ...s, kind: 'line' as const, points: pts, n: m.n, asOf: m.asOf }] : [];
  });
}
