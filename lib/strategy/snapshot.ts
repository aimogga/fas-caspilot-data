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
/** `extra`: ready facts from org_knowledge (#225), recipient_profile (#228) and award_abstract (#229) once their modules exist; their kinds must be registered resolvers. */
export type SnapshotInput = {
  opportunity: OpportunityRow; criteria: CriterionRow[]; indicators: IndicatorRow[]; similar: SimilarAward[]; summary: AwardSummary;
  metrics: DashboardMetrics | null; period: string; extra?: Fact[]; extraAbstracts?: { citation_id: string; text: string }[]; now: Date;
};

const num = (v: number | string | null | undefined): number | null => (v === null || v === undefined || v === '' ? null : Number(v));
export const must = <T>(r: { data: T | null; error: { message: string } | null }): T => { if (r.error || r.data === null) throw new Error(r.error?.message || 'not found'); return r.data; };
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

/** Newest-vintage public indicators as facts carrying source_id, vintage and ingest_run_id. Pure. */
export const indicatorFacts = (rows: IndicatorRow[]): Fact[] => NeedMapQuery.latest(rows).map((r) => ({
  citation_id: `public_indicator:${r.id}`, label: `${NeedMapQuery.label(r.indicator_code)}, county FIPS ${r.geo_fips}, ${r.period}`, values: { value: num(r.value), moe: num(r.moe) },
  source: { source_id: r.source_id, vintage: r.vintage, ingest_run_id: r.ingest_run_id, unit: r.unit },
}));

/** Public indicators for FAS service counties, read under the caller's RLS. */
export async function loadServiceIndicators(client: SupabaseClient): Promise<IndicatorRow[]> {
  const fips = (must(await client.from('fas_service_county').select('fips')) as { fips: string }[]).map((r) => r.fips);
  return must(await client.from('public_indicator').select('id,source_id,indicator_code,geo_fips,period,value,moe,unit,vintage,ingest_run_id').in('geo_fips', fips)) as IndicatorRow[];
}

/** Pure: copies only the whitelisted fields of each input into facts (never spreads a row), then checks privacy. */
export function assembleSnapshot(x: SnapshotInput): Snapshot {
  const o = x.opportunity, facts: Fact[] = [
    { citation_id: `opportunity:${o.id}`, label: `${o.title}${o.funder ? ` (${o.funder})` : ''}`, values: { award_floor: num(o.award_floor), award_ceiling: num(o.award_ceiling) },
      text: o.description ?? undefined, source: { close_date: o.close_date } },
    ...x.criteria.map((c) => ({ citation_id: `opportunity_criteria:${c.id}`, label: c.criterion, values: { weight_points: num(c.weight_points) }, text: c.text ?? undefined })),
    ...indicatorFacts(x.indicators),
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

/** Thin read layer under the caller's RLS: opportunity, criteria, FAS-county indicators, award history and the suppressed metrics. No client table is read here. */
export async function loadSnapshot(client: SupabaseClient, opportunityId: string, now: Date): Promise<Snapshot> {
  const opportunity = must(await client.from('opportunity').select('id,title,funder,description,award_floor,award_ceiling,close_date').eq('id', opportunityId).single()) as OpportunityRow;
  const criteria = must(await client.from('opportunity_criteria').select('id,criterion,weight_points,text').eq('opportunity_id', opportunityId)) as CriterionRow[];
  const indicators = await loadServiceIndicators(client);
  const { similar, summary } = await AwardHistoryQuery.forOpportunity(client, opportunityId, 10);
  const f = parseFilters({}, now);
  return assembleSnapshot({ opportunity, criteria, indicators, similar, summary, metrics: await MetricsQuery.load(client, f), period: f.period, now });
}
