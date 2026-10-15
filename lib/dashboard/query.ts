import type { SupabaseClient } from '@supabase/supabase-js';
import { NeedMapQuery } from '../need-map/query';
import { asOfNote, NOT_AVAILABLE } from './cards';
import { Freshness, type FreshnessIndicator, type FreshnessRun, type FreshnessSource, type FreshnessView } from './freshness';

export const STAGES = ['New', 'Reviewing', 'Pursuing', 'Submitted', 'Awarded', 'Declined', 'Passed'] as const;
export type Opportunity = { id: string; title: string; source: string; close_date: string | null; posted_date: string | null };
export type PipelineRow = { status: string; opportunity: Opportunity | Opportunity[] | null };
export type SourceRow = { name: string; last_success_at: string | null };
export type Stage = { name: string; count: string; manual: number };
export type CountyRow = { fips: string; name: string };
export type PipelineView = { stages: Stage[]; manualCount: number; deadline: string; footer: string; empty: boolean };
export type DashboardData = { counties: CountyRow[]; referrals: string[]; pipeline: PipelineView; freshness: FreshnessView };

const monthDay = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const opp = (r: PipelineRow): Opportunity | null => (Array.isArray(r.opportunity) ? r.opportunity[0] ?? null : r.opportunity);

export class DashboardQuery {
  /** Statuses match the seven stages case-insensitively; anything else (the seed's `watch`) is left out silently. */
  static pipeline(rows: PipelineRow[], sources: SourceRow[], now: Date): PipelineView {
    const kept = rows.map((r) => ({ status: r.status.trim().toLowerCase(), o: opp(r) })).filter((r) => STAGES.some((s) => s.toLowerCase() === r.status));
    const stages = STAGES.map((name) => {
      const inStage = kept.filter((r) => r.status === name.toLowerCase());
      return { name, count: String(inStage.length), manual: inStage.filter((r) => r.o?.source === 'foundation_manual').length };
    });
    const manualCount = stages.reduce((acc, s) => acc + s.manual, 0);
    const future = kept.map((r) => r.o).filter((o): o is Opportunity => !!o?.close_date && Date.parse(o.close_date) > now.getTime());
    const next = future.sort((a, b) => (a.close_date as string).localeCompare(b.close_date as string))[0];
    const deadline = next ? `Next deadline: ${next.title}, closes ${monthDay(next.close_date as string)}` : 'No upcoming deadline';
    const grant = sources.filter((s) => /grants|foundation/i.test(s.name) && s.last_success_at).map((s) => s.last_success_at as string).sort().pop();
    const posted = kept.map((r) => r.o?.posted_date ?? '').filter(Boolean).sort().pop();
    const asOf = grant ? NeedMapQuery.monthYear(grant) : posted ? NeedMapQuery.monthYear(posted) : NOT_AVAILABLE;
    const footer = `Grants.gov and foundation lists · ${asOfNote(asOf)}${manualCount ? ` · includes ${manualCount} manual entries` : ''}`;
    return { stages, manualCount, deadline, footer, empty: kept.length === 0 };
  }

  static async load(client: SupabaseClient, now: Date): Promise<DashboardData> {
    const [counties, cases, pipeline, sources, runs, indicators] = await Promise.all([
      client.from('geo_county').select('fips,name'),
      client.from('case').select('referral_source'),
      client.from('pipeline_status').select('status,opportunity(id,title,source,close_date,posted_date)'),
      client.from('source_registry').select('id,name,cadence,last_success_at'),
      client.from('ingest_run').select('source_id,status,started_at').order('started_at', { ascending: false }).limit(500),
      client.from('public_indicator').select('source_id,vintage').order('vintage', { ascending: false }).limit(2000),
    ]);
    for (const r of [counties, cases, pipeline, sources, runs, indicators]) if (r.error) throw new Error(r.error.message);
    const freshness = Freshness.view((sources.data ?? []) as FreshnessSource[], (runs.data ?? []) as FreshnessRun[], (indicators.data ?? []) as FreshnessIndicator[], now);
    const referrals = [...new Set((cases.data ?? []).map((c: { referral_source: string | null }) => c.referral_source ?? '').filter(Boolean))].sort();
    const countyRows = ((counties.data ?? []) as CountyRow[]).filter((c) => c.fips.startsWith('49')).sort((a, b) => a.name.localeCompare(b.name));
    return { counties: countyRows, referrals, pipeline: DashboardQuery.pipeline((pipeline.data ?? []) as PipelineRow[], (sources.data ?? []) as SourceRow[], now), freshness };
  }
}
