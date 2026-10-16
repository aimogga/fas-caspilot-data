import type { SupabaseClient } from '@supabase/supabase-js';
import { parseFilters } from '../dashboard/filters';
import { MetricsQuery, type DashboardMetrics, type Loaded, type Wired } from '../dashboard/metrics-query';
import { AwardHistoryQuery, type AwardSummary, type SimilarAward } from '../grants/award-history';
import { THRESHOLD } from '../metrics/suppress';
import { NeedMapQuery } from '../need-map/query';
import { RESOLVERS } from './citations';

/** One citable item. `citation_id` is `<kind>:<ref>`; `values` are the only numbers a draft may use from it. */
export type Fact = { citation_id: string; label: string; values: Record<string, number | null>; text?: string; source?: Record<string, string | null> };
/** Input to a draft, stored with it. `abstracts` feed the copy guard only and are never sent to the model. */
export type Snapshot = { opportunity_id: string; built_at: string; facts: Fact[]; abstracts: { citation_id: string; text: string }[] };
export type OpportunityRow = { id: string; title: string; funder: string | null; description: string | null; award_floor: number | null; award_ceiling: number | null; close_date: string | null };
export type CriterionRow = { id: string; criterion: string; weight_points: number | null; text: string | null };
export type IndicatorRow = {
  id: string; source_id: string; indicator_code: string; geo_fips: string; period: string; value: number | string | null; moe: number | string | null; unit: string | null; vintage: string; ingest_run_id: string | null;
};
export type AbstractRow = { id: string; award_history_id: string; text: string };
/** Whitelisted Form 990 columns only: no officer names, compensation or EIN. */
export type RecipientProfileRow = {
  id: string; award_history_id: string | null; matched_name: string | null; state: string | null; ntee_code: string | null; ruling_year: number | null;
  total_revenue: number | string | null; program_service_expenses: number | string | null; match_confidence: string;
};
/** `extra`: ready facts of registered kinds (recipient_profile, later org_knowledge #225). `extraAbstracts`: award_abstract text for the copy guard only. */
export type SnapshotInput = {
  opportunity: OpportunityRow; criteria: CriterionRow[]; indicators: IndicatorRow[]; similar: SimilarAward[]; summary: AwardSummary;
  metrics: DashboardMetrics | null; period: string; extra?: Fact[]; extraAbstracts?: { citation_id: string; text: string }[]; now: Date;
};

const num = (v: number | string | null | undefined): number | null => (v === null || v === undefined || v === '' ? null : Number(v));
const ok = <T>(x: Loaded<T>): (T & Wired) | null => ('error' in x ? null : x);
/** FAS metrics come from the dashboard metrics layer, already suppressed (F-306); n is kept only at 11 or more. */
const METRICS: Record<string, [string, (m: DashboardMetrics) => { n: number; value: number | null } | null]> = {
  m1: ['Median days from court order to first session', (m) => { const x = ok(m.m1); return x && { n: x.n, value: x.median }; }],
  m2: ['Median days from application to decision', (m) => { const x = ok(m.m2); return x && { n: x.n, value: x.median }; }],
  m3: ['Share of approved families who never started', (m) => { const x = ok(m.m3); return x && { n: x.n, value: x.share }; }],
  m4: ['Completion rate, all income bands', (m) => { const x = ok(m.m4); return x && { n: x.n, value: x.total?.rate ?? null }; }],
  m5: ['Cost per completed episode (USD)', (m) => { const x = ok(m.m5); return x && { n: x.n, value: x.costPerCompleted }; }],
};
/** Keys that would mean a client-level row got in (docs/PRIVACY_AND_COMPLIANCE.md). */
const CLIENT_KEY = /^(case|client|application|authorization|episode|provider|upload_batch|outcome)(_id)?$|dob|birth|ssn|name_first|first_name|last_name|address|phone|email|court|substance|clinical|notes/i;

/** Throws when a snapshot holds a client-level key, an unregistered citation kind or a FAS count under 11. */
export function assertPrivate(s: Snapshot): Snapshot {
  const walk = (v: unknown, path: string): void => {
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) {
      if (CLIENT_KEY.test(k)) throw new Error(`snapshot privacy: client-level key ${path}.${k}`);
      walk(x, `${path}.${k}`);
    }
  };
  walk(s, 'snapshot');
  for (const f of s.facts) {
    if (!RESOLVERS.has(f.citation_id.split(':')[0] as string)) throw new Error(`snapshot privacy: unregistered kind ${f.citation_id}`);
    if (f.citation_id.startsWith('metric:') && f.values.n != null && f.values.n < THRESHOLD) throw new Error(`snapshot privacy: count under ${THRESHOLD} in ${f.citation_id}`);
  }
  return s;
}

/** Pure: copies only the whitelisted fields of each input into facts (never spreads a row), then checks privacy. */
export function assembleSnapshot(x: SnapshotInput): Snapshot {
  const o = x.opportunity, facts: Fact[] = [
    { citation_id: `opportunity:${o.id}`, label: `${o.title}${o.funder ? ` (${o.funder})` : ''}`, values: { award_floor: num(o.award_floor), award_ceiling: num(o.award_ceiling) },
      text: o.description ?? undefined, source: { close_date: o.close_date } },
    ...x.criteria.map((c) => ({ citation_id: `opportunity_criteria:${c.id}`, label: c.criterion, values: { weight_points: num(c.weight_points) }, text: c.text ?? undefined })),
    ...NeedMapQuery.latest(x.indicators).map((r) => ({
      citation_id: `public_indicator:${r.id}`, label: `${NeedMapQuery.label(r.indicator_code)}, county FIPS ${r.geo_fips}, ${r.period}`, values: { value: num(r.value), moe: num(r.moe) },
      source: { source_id: r.source_id, vintage: r.vintage, ingest_run_id: r.ingest_run_id, unit: r.unit },
    })),
    { citation_id: `award_history_summary:${o.id}`, label: 'Similar past awards (count, median, range, Utah share)',
      values: { count: x.summary.count, median: x.summary.median, min: x.summary.min, max: x.summary.max, utah_share: x.summary.utah_share } },
    ...x.similar.map((a) => ({ citation_id: a.source_ref, label: a.reason, values: { amount: a.amount, fiscal_year: a.fiscal_year } })),
    ...(x.metrics ? Object.entries(METRICS).flatMap(([code, [label, get]]) => {
      const m = get(x.metrics as DashboardMetrics), big = !!m && m.n >= THRESHOLD;
      return m ? [{ citation_id: `metric:${code}:${x.period}`, label: `FAS ${label}, ${x.period}`, values: { value: big ? m.value : null, n: big ? m.n : null } }] : [];
    }) : []),
    ...(x.extra ?? []),
  ];
  const abstracts = [...x.similar.filter((a) => a.description).map((a) => ({ citation_id: a.source_ref, text: a.description as string })), ...(x.extraAbstracts ?? [])];
  return assertPrivate({ opportunity_id: o.id, built_at: x.now.toISOString(), facts, abstracts });
}

/** Published abstracts of the similar awards: copy-guard input, never prompt text. */
export const abstractsOf = (rows: AbstractRow[]) => rows.filter((r) => r.text).map((r) => ({ citation_id: `award_abstract:${r.id}`, text: r.text }));
export const profileFacts = (rows: RecipientProfileRow[]): Fact[] => rows.map((r) => ({
  citation_id: `recipient_profile:${r.id}`, label: `Form 990 profile of ${r.matched_name ?? 'past recipient'}${r.state ? ` (${r.state})` : ''}`,
  values: { ruling_year: num(r.ruling_year), total_revenue: num(r.total_revenue), program_service_expenses: num(r.program_service_expenses) },
  source: { source_id: 'propublica_990', ntee_code: r.ntee_code, match_confidence: r.match_confidence },
}));

/** Thin read layer under the caller's RLS: opportunity, criteria, FAS-county indicators, award history and the suppressed metrics. No client table is read here. */
export async function loadSnapshot(client: SupabaseClient, opportunityId: string, now: Date): Promise<Snapshot> {
  const must = <T>(r: { data: T | null; error: { message: string } | null }): T => { if (r.error || r.data === null) throw new Error(r.error?.message || 'not found'); return r.data; };
  const opportunity = must(await client.from('opportunity').select('id,title,funder,description,award_floor,award_ceiling,close_date').eq('id', opportunityId).single()) as OpportunityRow;
  const criteria = must(await client.from('opportunity_criteria').select('id,criterion,weight_points,text').eq('opportunity_id', opportunityId)) as CriterionRow[];
  const fips = (must(await client.from('fas_service_county').select('fips')) as { fips: string }[]).map((r) => r.fips);
  const indicators = must(await client.from('public_indicator').select('id,source_id,indicator_code,geo_fips,period,value,moe,unit,vintage,ingest_run_id').in('geo_fips', fips)) as IndicatorRow[];
  const { similar, summary } = await AwardHistoryQuery.forOpportunity(client, opportunityId, 10);
  const ids = similar.map((a) => a.id);
  const abstracts = must(await client.from('award_abstract').select('id,award_history_id,text').eq('status', 'published').in('award_history_id', ids)) as AbstractRow[];
  const profiles = must(await client.from('recipient_profile')
    .select('id,award_history_id,matched_name,state,ntee_code,ruling_year,total_revenue,program_service_expenses,match_confidence')
    .neq('match_confidence', 'none').in('award_history_id', ids)) as RecipientProfileRow[];
  const f = parseFilters({}, now);
  return assembleSnapshot({ opportunity, criteria, indicators, similar, summary, metrics: await MetricsQuery.load(client, f), period: f.period, now,
    extra: profileFacts(profiles), extraAbstracts: abstractsOf(abstracts) });
}
