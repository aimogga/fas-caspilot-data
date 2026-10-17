// F-303 on the Team dashboard: the period totals FAS typed in as totals (`aggregate_submission`), for the dashboard's quarter and county.
// They are never mixed into M1–M6 (those are built from records); counts under 11 are hidden (F-306). Pure apart from `load`.
import type { SupabaseClient } from '@supabase/supabase-js';
import { AGGREGATE_METRICS, formatValue, type MetricCode } from '../intake/aggregate';
import { suppressCount } from '../metrics/suppress';
import { NeedMapQuery } from '../need-map/query';
import { NOT_AVAILABLE } from './cards';
import { ALL } from './filters';

export type AggregateRow = { metric_code: string; value: number | string | null; county_fips: string | null; created_at: string };
/** One metric: how many entries were added up, the total in words (null when hidden), and whether it was hidden for being under 11. */
export type AggregateLine = { code: MetricCode; label: string; entries: number; shown: string | null; suppressed: boolean };
export type AggregateTotals = { lines: AggregateLine[]; entries: number; asOf: string };

/** `county` is a FIPS code or `all`. A county view keeps that county's totals only; org-wide totals (no county) count under All counties. */
export function aggregateTotals(rows: AggregateRow[], county: string): AggregateTotals {
  const mine = county === ALL ? rows : rows.filter((r) => r.county_fips === county);
  const lines = AGGREGATE_METRICS.flatMap((m): AggregateLine[] => {
    const rs = mine.filter((r) => r.metric_code === m.code);
    if (!rs.length) return [];
    const total = rs.reduce((sum, r) => sum + Number(r.value ?? 0), 0);
    const cell = m.kind === 'count' ? suppressCount(total) : { value: total, suppressed: false };
    return [{ code: m.code, label: m.label, entries: rs.length, shown: cell.suppressed ? null : formatValue(m.code, cell.value), suppressed: cell.suppressed }];
  });
  const newest = mine.map((r) => r.created_at).sort().at(-1);
  return { lines, entries: lines.reduce((n, l) => n + l.entries, 0), asOf: newest ? NeedMapQuery.monthYear(newest) : NOT_AVAILABLE };
}

export class AggregatesQuery {
  /** The caller's org's totals for one quarter (RLS: admin and staff only). Null on a read error, so the card says so instead of showing nothing. */
  static async load(client: SupabaseClient, period: string): Promise<AggregateRow[] | null> {
    const { data, error } = await client.from('aggregate_submission').select('metric_code,value,county_fips,created_at').eq('period', period);
    if (error) {
      console.error('[dashboard] aggregate totals failed', { message: error.message });
      return null;
    }
    return (data ?? []) as AggregateRow[];
  }
}
