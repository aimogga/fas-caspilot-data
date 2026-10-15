/** Staff home (F-401 follow-on): four headline tiles, each a suppressed number with its four-quarter sparkline, from the same `MetricsQuery` as the dashboards. Pure builders; `load` fetches. */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChartPoint } from '../charts/scale';
import { boardFilters } from '../board/query';
import { days, money, pct, quarterShort } from '../dashboard/format';
import { MetricsQuery, type DashboardMetrics, type Loaded, type TrendValue, type Wired } from '../dashboard/metrics-query';

export type Tile = {
  id: 'm1' | 'm2' | 'm3' | 'm5'; title: string; noun: string; unit: string; goodWhen: 'up' | 'down'; href: string;
  value: string | null; delta: string | null; points: ChartPoint[]; n: number; asOf: string; error: boolean;
};
export type StaffHomeData = { period: string; metrics: DashboardMetrics };
const SPEC = [
  { id: 'm1', title: 'Days from court order to first session', noun: 'Days to first session', unit: ' days', goodWhen: 'down', fmt: days },
  { id: 'm2', title: 'Days from application to funding decision', noun: 'Days to a decision', unit: ' days', goodWhen: 'down', fmt: days },
  { id: 'm3', title: 'Approved but never started', noun: 'Share never started', unit: '%', goodWhen: 'down', fmt: pct },
  { id: 'm5', title: 'Cost per completed episode', noun: 'Dollars per completed episode', unit: '', goodWhen: 'down', fmt: money },
] as const;
const headline = (m: Loaded<Record<string, unknown>> | undefined): number | null => {
  if (!m || 'error' in m) return null;
  const v = (m as Record<string, unknown>)['median'] ?? (m as Record<string, unknown>)['share'] ?? (m as Record<string, unknown>)['costPerCompleted'];
  return typeof v === 'number' ? v : null;
};
/** Sparkline points: quarter labels, percent shares in whole points, hidden stays null. */
export const points = (series: TrendValue[], unit: string): ChartPoint[] =>
  series.map((t) => ({ label: `${quarterShort(t.period)} ’${t.period.slice(2, 4)}`, value: t.value == null ? null : unit === '%' ? Math.round(t.value * 100) : t.value }));
export const StaffHome = {
  tiles(x: DashboardMetrics | null): Tile[] {
    return SPEC.map((s) => {
      const m = x?.[s.id] as Loaded<Wired & Record<string, unknown>> | undefined, ok = !!m && !('error' in m);
      return {
        id: s.id, title: s.title, noun: s.noun, unit: s.unit, goodWhen: s.goodWhen, href: '/dashboard', error: !!m && 'error' in m,
        value: ok ? s.fmt(headline(m)) : null, delta: ok ? m.delta : null, points: x ? points(x.trends[s.id], s.unit) : [],
        n: ok ? m.n : 0, asOf: ok ? m.asOf : 'Not available yet',
      };
    });
  },
  async load(client: SupabaseClient, now: Date): Promise<StaffHomeData> {
    const f = boardFilters(now);
    return { period: f.period, metrics: await MetricsQuery.load(client, f) };
  },
};
