// F-504: read the approved match_config, score open opportunities into match_result, and read them back for the panel.
import type { SupabaseClient } from '@supabase/supabase-js';
import { AwardHistoryQuery, type StoredAward, summarize } from './award-history';
import { checkEligibility, fromMatchFlags } from './eligibility';
import { loadOrgProfile } from './profile';
import { type Component, type MatchConfig, scoreOpportunity, toMatchResultRow } from './score';
import { awardRange } from './terms';
import type { Flag, OpportunityInput } from './types';

export type MatchFlags = { eligible: boolean | 'unknown'; flags: Flag[] };
/** `award` and `status` (DS-12a) read stored `opportunity.award_*` and `pipeline_status.status`; `status` is null when nobody has moved the opportunity. */
export type MatchItem = { id: string; opportunityId: string; title: string; funder: string; closes: string; award: string; status: string | null; score: number; eligibility: string; components: Component[]; flags: Flag[]; awards: AwardLine | null };
/** DS-12b: stored `award_history` rows on the opportunity's Assistance Listing, summarised; null when there is no listing or no rows (the line is then omitted). */
export type AwardLine = { count: number; median: number | null };
export type MatchList = { config: { id: string; draft: boolean } | null; asOf: string | null; rows: MatchItem[] };
type Opp = { title: string; funder: string | null; close_date: string | null; award_floor: number | string | null; award_ceiling: number | string | null; assistance_listing: string | null };
type ResultRow = { id: string; opportunity_id: string; score: number | string | null; components: unknown; flags: unknown; computed_at: string; opportunity: Opp | null };
const num = (v: number | string | null) => (v === null ? null : Number(v));
const OPP_COLS = 'id,source,title,funder,assistance_listing,posted_date,close_date,award_floor,award_ceiling,eligibility,description,raw';
const today = (now: Date) => now.toISOString().slice(0, 10); const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });

export class MatchQuery {
  /** Newest approved config only; drafts (approved_by null) never score or show. */
  static async config(client: SupabaseClient): Promise<MatchConfig | null> {
    const { data, error } = await client.from('match_config').select('id,weights,params,created_at,approved_by');
    if (error) throw new Error(error.message);
    return ((data ?? []) as MatchConfig[]).filter((c) => c.approved_by !== null).sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
  }

  static eligibilityLabel(f: MatchFlags): string {
    return f.eligible === false ? 'Not eligible' : f.eligible === 'unknown' ? 'Unknown' : f.flags.length ? `Flags: ${f.flags.length}` : 'Eligible';
  }

  /** Scores every open opportunity (close_date null or ≥ today) for the org against the approved config; writes nothing without one. */
  static async recompute(client: SupabaseClient, orgId: string, now: Date): Promise<{ scored: number; configId: string | null; reason?: string }> {
    const config = await MatchQuery.config(client);
    if (config === null) return { scored: 0, configId: null, reason: 'no approved config' };
    const org = await loadOrgProfile(client, orgId);
    if (org === null) return { scored: 0, configId: config.id, reason: 'org profile missing' };
    const opps = await client.from('opportunity').select(OPP_COLS).or(`close_date.is.null,close_date.gte.${today(now)}`);
    if (opps.error) throw new Error(opps.error.message);
    const rows = ((opps.data ?? []) as (OpportunityInput & { id: string })[]).map((o) => {
      const e = checkEligibility(o, org, now);
      return toMatchResultRow(orgId, o.id, scoreOpportunity(o, org, e, config, now), e, now);
    });
    const up = rows.length ? await client.from('match_result').upsert(rows, { onConflict: 'org_id,opportunity_id,config_id' }) : { error: null };
    if (up.error) throw new Error(up.error.message);
    return { scored: rows.length, configId: config.id };
  }

  /** Stored results for the approved config, open opportunities only, best score first. Nothing here is FAS client data. */
  static async list(client: SupabaseClient, orgId: string, now: Date): Promise<MatchList> {
    const config = await MatchQuery.config(client);
    if (config === null) return { config: null, asOf: null, rows: [] };
    const { data, error } = await client.from('match_result').select('id,opportunity_id,score,components,flags,computed_at,opportunity(title,funder,close_date,award_floor,award_ceiling,assistance_listing)').eq('org_id', orgId).eq('config_id', config.id);
    if (error) throw new Error(error.message);
    const pipe = await client.from('pipeline_status').select('opportunity_id,status').eq('org_id', orgId);
    if (pipe.error) throw new Error(pipe.error.message);
    const status = new Map(((pipe.data ?? []) as { opportunity_id: string; status: string }[]).map((p) => [p.opportunity_id, p.status]));
    const open = ((data ?? []) as unknown as ResultRow[]).filter((r) => r.opportunity && (r.opportunity.close_date === null || r.opportunity.close_date >= today(now)));
    const awards = await MatchQuery.awardLines(client, open.map((r) => r.opportunity?.assistance_listing ?? null));
    const rows = open.map((r): MatchItem => {
      let flags: MatchFlags = { eligible: 'unknown', flags: [] };
      try { flags = fromMatchFlags(r.flags); } catch { /* malformed stored flags read as unknown */ }
      const o = r.opportunity as NonNullable<ResultRow['opportunity']>;
      return { id: r.id, opportunityId: r.opportunity_id, title: o.title, funder: o.funder ?? 'Funder not recorded', closes: o.close_date ? `closes ${fmt(o.close_date, { month: 'short', day: 'numeric', year: 'numeric' })}` : 'no close date',
        award: awardRange(num(o.award_floor), num(o.award_ceiling)), status: status.get(r.opportunity_id) ?? null, score: Number(r.score ?? 0),
        eligibility: MatchQuery.eligibilityLabel(flags), components: Array.isArray(r.components) ? (r.components as Component[]) : [], flags: flags.flags, awards: awards.get(o.assistance_listing ?? '') ?? null };
    }).sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
    const newest = open.map((r) => r.computed_at).sort().at(-1);
    return { config: { id: config.id, draft: config.approved_by === null }, asOf: newest ? fmt(newest, { month: 'short', year: 'numeric' }) : null, rows };
  }

  /** One read of stored `award_history` rows for the listed Assistance Listings, summarised per listing (count, median) with the pure `summarize`. Listings with no rows are absent. */
  static async awardLines(client: SupabaseClient, listings: (string | null)[]): Promise<Map<string, AwardLine>> {
    const wanted = [...new Set(listings.filter((l): l is string => !!l))], out = new Map<string, AwardLine>();
    if (wanted.length === 0) return out;
    const { data, error } = await client.from('award_history').select(AwardHistoryQuery.COLUMNS).in('assistance_listing', wanted).limit(2000);
    if (error) throw new Error(error.message);
    const byListing = new Map<string, StoredAward[]>();
    for (const r of (data ?? []) as StoredAward[]) if (r.assistance_listing) byListing.set(r.assistance_listing, [...(byListing.get(r.assistance_listing) ?? []), { ...r, amount: r.amount === null ? null : Number(r.amount) }]);
    for (const [listing, rows] of byListing) { const { count, median } = summarize(rows); out.set(listing, { count, median }); }
    return out;
  }
}
