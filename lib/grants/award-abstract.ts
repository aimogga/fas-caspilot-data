// F-506c: the public description of what each past winner proposed, for one opportunity's top 5 similar awards. Deterministic; stored for
// analysis only and never copied into FAS drafts (docs/GRANT_MATCHING.md guardrails). Service role writes; admin/staff read under RLS.
import type { SupabaseClient } from '@supabase/supabase-js';
import { OjpAwards, wordCount, type OjpParse } from '../../packages/ingest/ojp_awards';
import { UsaSpending, type AwardDetail } from '../../packages/ingest/usaspending';
import { IngestAlert } from '../../packages/ingest/ingest-alert';
import { PoliteFetcher } from '../ingest/polite-fetch';
import { SahieHttp } from '../ingest/sahie-http';
import { AwardHistoryQuery } from './award-history';

export type AbstractRow = { award_history_id: string; source: 'usaspending_detail' | 'ojp_award_page' | 'other'; status: 'published' | 'not_published' | 'fetch_failed';
  text: string | null; word_count: number | null; source_url: string | null; reason: string | null; ingest_run_id?: string; fetched_at?: string };
export type OjpOutcome = { url: string | null; parsed?: OjpParse; error?: string };
export const CACHE_DAYS = 30;
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const row = (award_history_id: string, source: AbstractRow['source'], source_url: string | null, r: { text?: string | null; reason?: string; failed?: boolean }): AbstractRow =>
  r.text ? { award_history_id, source, source_url, status: 'published', text: r.text, word_count: wordCount(r.text), reason: null }
    : { award_history_id, source, source_url, status: r.failed ? 'fetch_failed' : 'not_published', text: null, word_count: null, reason: r.reason ?? 'no public abstract' };

/** Pure: the USAspending description row, plus the OJP page row for DOJ/OJP awards or an `other` not_published row naming the agency. */
export function abstractRows(id: string, d: AwardDetail, ojp?: OjpOutcome): AbstractRow[] {
  const out = [row(id, 'usaspending_detail', d.source_url, { text: d.description, reason: 'USAspending award has no description' })];
  if (!OjpAwards.isOjp(d.agency, d.sub_agency)) {
    const who = [d.agency, d.sub_agency].filter(Boolean).join(' / ') || 'the awarding agency';
    return [...out, row(id, 'other', null, { reason: `No public abstract: ${who} award pages are not a supported source` })];
  }
  const p = ojp?.parsed, why = !ojp?.url ? 'award number format not recognised; no OJP page URL' : ojp.error;
  return [...out, row(id, 'ojp_award_page', ojp?.url ?? null, p?.status === 'published' ? { text: p.text } : p ? { reason: p.reason } : { reason: why ?? 'not fetched', failed: !!ojp?.url })];
}

/** OJP page → outcome. A sign-in redirect or a 404 is "not published"; a page the parser rejects or any other failure is fetch_failed (no junk stored). */
export async function fetchOjp(fetcher: PoliteFetcher, fain: string | null): Promise<OjpOutcome> {
  const url = OjpAwards.pageUrl(fain);
  if (!url) return { url };
  try {
    const res = await fetcher.get(url);
    if (/\/user\/login/.test(res.headers.get('location') ?? '')) return { url, parsed: { status: 'not_published', award_number: fain, reason: 'OJP award page requires sign-in; no public abstract' } };
    if (res.status === 404) return { url, parsed: { status: 'not_published', award_number: fain, reason: 'OJP has no page for this award' } };
    if (!res.ok) return { url, error: `OJP page fetch failed: ${res.status}` };
    return { url, parsed: OjpAwards.parse(await res.text()) };
  } catch (e) { return { url, error: msg(e) }; }
}

export type AbstractDeps = { env?: Record<string, string | undefined>; client?: SupabaseClient; fetcher?: PoliteFetcher; now?: Date };
export class AwardAbstracts {
  /** Top 5 similar usaspending awards; those with a non-failed row younger than CACHE_DAYS are skipped. Each fetched award gets its rows upserted
   * on (award_history_id, source) under one ingest_run per source, and its period of performance written to award_history. */
  static async forOpportunity(client: SupabaseClient, opportunityId: string, deps: AbstractDeps = {}) {
    const [fetcher, now] = [deps.fetcher ?? new PoliteFetcher(), deps.now ?? new Date()];
    const ids = (await AwardHistoryQuery.forOpportunity(client, opportunityId, 5)).similar.filter((a) => a.source === 'usaspending').map((a) => a.id);
    const since = new Date(now.getTime() - CACHE_DAYS * 864e5).toISOString();
    const [awards, fresh] = await Promise.all([client.from('award_history').select('id,external_id').in('id', ids),
      client.from('award_abstract').select('award_history_id').in('award_history_id', ids).eq('source', 'usaspending_detail').neq('status', 'fetch_failed').gte('fetched_at', since)]);
    if (awards.error || fresh.error) throw new Error(awards.error?.message ?? fresh.error?.message);
    const cached = new Set((fresh.data ?? []).map((r) => r.award_history_id as string)), todo = (awards.data ?? []).filter((a) => !cached.has(a.id) && a.external_id);
    const runs = new Map<string, string>(), rows: AbstractRow[] = [];
    const run = async (name: string) => runs.get(name) ?? AwardAbstracts.startRun(client, name, opportunityId).then((id) => (runs.set(name, id), id));
    for (const a of todo) {
      let got: AbstractRow[];
      try {
        const res = await fetcher.get(UsaSpending.detailUrl(a.external_id as string));
        if (!res.ok) throw new Error(`USAspending award detail failed: ${res.status}`);
        const d = UsaSpending.parseDetail(await res.json());
        got = abstractRows(a.id, d, OjpAwards.isOjp(d.agency, d.sub_agency) ? await fetchOjp(fetcher, d.fain) : undefined);
        const upd = await client.from('award_history').update({ period_start: d.period_start, period_end: d.period_end }).eq('id', a.id);
        if (upd.error) throw new Error(upd.error.message);
      } catch (e) { got = [row(a.id, 'usaspending_detail', UsaSpending.detailUrl(a.external_id as string), { reason: msg(e), failed: true })]; }
      for (const r of got) rows.push({ ...r, ingest_run_id: await run(r.source === 'ojp_award_page' ? OjpAwards.SOURCE_NAME : UsaSpending.SOURCE_NAME), fetched_at: now.toISOString() });
    }
    if (rows.length) { const up = await client.from('award_abstract').upsert(rows, { onConflict: 'award_history_id,source' }); if (up.error) throw new Error(up.error.message); }
    for (const id of runs.values()) await client.from('ingest_run').update({ status: 'ok', finished_at: now.toISOString(), rows_loaded: rows.filter((r) => r.ingest_run_id === id).length }).eq('id', id);
    return { opportunity_id: opportunityId, fetched: todo.length, cached: cached.size, rows };
  }
  static async startRun(client: SupabaseClient, sourceName: string, opportunityId: string): Promise<string> {
    const src = await client.from('source_registry').select('id').eq('name', sourceName).single();
    if (src.error || !src.data) throw new Error(`source ${sourceName} is not registered`);
    const r = await client.from('ingest_run').insert({ source_id: src.data.id, status: 'running', checksum: `award_abstract:${opportunityId}` }).select('id').single();
    if (r.error || !r.data) throw new Error(r.error?.message ?? 'ingest_run insert failed');
    return r.data.id as string;
  }
  /** POST { opportunity_id } with the ingest token (n8n or the app server); service role inside. */
  static async handle(request: Request, deps: AbstractDeps = {}): Promise<Response> {
    const env = deps.env ?? process.env;
    if (!SahieHttp.tokenOk(request, env)) return Response.json({ error: 'unauthorized' }, { status: 401 });
    const body = (await request.json().catch(() => null)) as { opportunity_id?: unknown } | null;
    if (typeof body?.opportunity_id !== 'string' || !body.opportunity_id) return Response.json({ error: 'opportunity_id required' }, { status: 400 });
    try {
      return Response.json(await AwardAbstracts.forOpportunity(deps.client ?? SahieHttp.db(env), body.opportunity_id, deps));
    } catch (e) {
      console.error('[grants] award abstracts failed', { message: IngestAlert.payload('award-abstracts', e, env).error });
      return Response.json({ error: 'award abstracts failed' }, { status: 500 });
    }
  }
}
