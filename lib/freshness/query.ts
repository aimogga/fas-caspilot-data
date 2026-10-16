import type { SupabaseClient } from '@supabase/supabase-js';
import { aggregate, Freshness, humanCadence, RANK, runDate, staleDays, topBarChip, type FreshnessIndicator, type FreshnessStatus, type TopBarChip } from './status';

export type SourceRow = { id: string; name: string; owner: string | null; cadence: string | null; status: string; last_success_at: string | null };
export type RunRow = { id: string; source_id: string; status: string; started_at: string; finished_at?: string | null; rows_loaded?: number | null };
/** The latest load attempt behind a row (DS-16a): the id reaches admins only; the dates and status word the Failed chip for everyone. */
export type RunDetail = { id: string; status: string; startedAt: string; finishedAt: string | null; rowsLoaded: number | null };
export type FreshnessPageRow = {
  name: string; owner: string | null; paused: boolean; latestVintage: string; lastSuccess: string; cadence: string; cadenceRaw: string | null;
  status: FreshnessStatus; staleDays: number | null; run: RunDetail | null;
};
export type FreshnessPageView = { rows: FreshnessPageRow[]; asOf: string | null; aggregate: FreshnessStatus | null; chip: TopBarChip | null; showRun: boolean };

export class FreshnessPage {
  /** Rows sorted Failed → Stale → Not published → Current, then name A–Z. The run id column is admin-only (DS-05). */
  static build(sources: SourceRow[], runs: RunRow[], indicators: FreshnessIndicator[], now: Date, role: string | null | undefined): FreshnessPageView {
    const rows = sources
      .map((s): FreshnessPageRow => {
        const latest = Freshness.latestRun(runs, s.id) as RunRow | null;
        const status = Freshness.status(s, latest, now);
        const vintage = indicators.filter((i) => i.source_id === s.id).map((i) => i.vintage).sort().pop();
        return {
          name: s.name, owner: s.owner, paused: s.status === 'paused', latestVintage: vintage ?? '—', lastSuccess: s.last_success_at ? runDate(s.last_success_at) : 'No load yet',
          cadence: humanCadence(s.cadence), cadenceRaw: s.cadence, status, staleDays: status === 'stale' ? staleDays(s, now) : null,
          run: latest ? { id: latest.id, status: latest.status, startedAt: latest.started_at, finishedAt: latest.finished_at ?? null, rowsLoaded: latest.rows_loaded ?? null } : null,
        };
      })
      .sort((a, b) => RANK[a.status] - RANK[b.status] || a.name.localeCompare(b.name));
    const latestSuccess = sources.map((s) => s.last_success_at).filter((d): d is string => !!d).sort().pop();
    return { rows, asOf: latestSuccess ? runDate(latestSuccess) : null, aggregate: aggregate(rows), chip: topBarChip(rows, sources, now), showRun: role === 'admin' };
  }

  static async load(client: SupabaseClient, now: Date, role: string | null | undefined): Promise<FreshnessPageView> {
    const [sources, runs, indicators] = await Promise.all([
      client.from('source_registry').select('id,name,owner,cadence,status,last_success_at'),
      client.from('ingest_run').select('id,source_id,status,started_at,finished_at,rows_loaded').order('started_at', { ascending: false }).limit(500),
      client.from('public_indicator').select('source_id,vintage').order('vintage', { ascending: false }).limit(2000),
    ]);
    for (const r of [sources, runs, indicators]) if (r.error) throw new Error(r.error.message);
    return FreshnessPage.build((sources.data ?? []) as SourceRow[], (runs.data ?? []) as RunRow[], (indicators.data ?? []) as FreshnessIndicator[], now, role);
  }
}
