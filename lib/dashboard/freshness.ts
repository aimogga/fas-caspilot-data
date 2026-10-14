import { NeedMapQuery } from '../need-map/query';

export type FreshnessStatus = 'current' | 'stale' | 'failed' | 'not_published';
export type FreshnessSource = { id: string; name: string; cadence: string | null; last_success_at: string | null };
export type FreshnessRun = { source_id: string; status: string; started_at: string };
export type FreshnessIndicator = { source_id: string; vintage: string };
export type FreshnessRow = { name: string; status: FreshnessStatus; latestVintage: string };
export type FreshnessView = { rows: FreshnessRow[]; asOf: string };

/** D-021: one update cycle overdue = stale. Days per cadence; anything else (or null) uses the annual cycle. */
export const CADENCE_DAYS: Readonly<Record<string, number>> = { monthly: 31, quarterly: 92, annual: 366, yearly: 366 };
export const DEFAULT_CYCLE_DAYS = 366;
export const MAX_ROWS = 4;
const DAY_MS = 86_400_000;
const OK_STATUSES = ['ok', 'success'];
const RANK: Record<FreshnessStatus, number> = { failed: 0, stale: 1, not_published: 2, current: 3 };

export class Freshness {
  static cycleDays(cadence: string | null): number {
    return CADENCE_DAYS[(cadence ?? '').trim().toLowerCase()] ?? DEFAULT_CYCLE_DAYS;
  }

  static status(source: FreshnessSource, latestRun: FreshnessRun | null, now: Date): FreshnessStatus {
    if (!source.last_success_at) return 'not_published';
    const success = Date.parse(source.last_success_at);
    if (latestRun && !OK_STATUSES.includes(latestRun.status.trim().toLowerCase()) && Date.parse(latestRun.started_at) > success) return 'failed';
    return now.getTime() - success > Freshness.cycleDays(source.cadence) * DAY_MS ? 'stale' : 'current';
  }

  static latestRun(runs: FreshnessRun[], sourceId: string): FreshnessRun | null {
    return runs.filter((r) => r.source_id === sourceId).sort((a, b) => b.started_at.localeCompare(a.started_at))[0] ?? null;
  }

  /** Up to MAX_ROWS rows, worst first (failed → stale → not published → current), then name A–Z. */
  static rows(sources: FreshnessSource[], runs: FreshnessRun[], indicators: FreshnessIndicator[], now: Date): FreshnessRow[] {
    return sources
      .map((s) => {
        const vintages = indicators.filter((i) => i.source_id === s.id).map((i) => i.vintage).sort();
        return { name: s.name, status: Freshness.status(s, Freshness.latestRun(runs, s.id), now), latestVintage: vintages.pop() ?? '—' };
      })
      .sort((a, b) => RANK[a.status] - RANK[b.status] || a.name.localeCompare(b.name))
      .slice(0, MAX_ROWS);
  }

  static view(sources: FreshnessSource[], runs: FreshnessRun[], indicators: FreshnessIndicator[], now: Date): FreshnessView {
    const rows = Freshness.rows(sources, runs, indicators, now);
    const listed = new Set(rows.map((r) => r.name));
    const latest = sources.filter((s) => listed.has(s.name) && s.last_success_at).map((s) => s.last_success_at as string).sort().pop();
    return { rows, asOf: latest ? NeedMapQuery.monthYear(latest) : 'Not available yet' };
  }
}
