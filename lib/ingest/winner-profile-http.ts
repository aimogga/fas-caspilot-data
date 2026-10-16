import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { IngestAlert } from '../../packages/ingest/ingest-alert';
import { ProPublica } from '../../packages/ingest/propublica';
import { PublicIndicatorIngest } from '../../packages/ingest/public-indicator';
import { AwardHistoryQuery } from '../grants/award-history';
import { isFresh, matchRecipient, recipientKey, toProfileRow, type AwardRecipient, type RecipientProfileRow, type StoredRecipientProfile } from '../grants/winner-profile';
import { FoundationHistoryIngest } from './propublica-http';
import { RateLimiter } from './rate-limit';
import { SahieHttp, type IngestHttpDeps } from './sahie-http';
export type WinnerRunOpts = { opportunityId: string; env?: Record<string, string | undefined>; now?: Date; httpFetch?: typeof fetch; client?: SupabaseClient; limiter?: RateLimiter;
  load?: (c: SupabaseClient, s: string, sum: string, rows: RecipientProfileRow[], t: { table: string; onConflict: string }) => Promise<{ ingestRunId: string }>;
  recordFailure?: typeof PublicIndicatorIngest.recordFailure };
export type WinnerRunResult = { ingestRunId: string | null; fetched: number; cached: number; profiles: StoredRecipientProfile[] };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, TARGET = { table: 'recipient_profile', onConflict: 'recipient_key' };
const fail = (e: { error: { message: string } | null }) => { if (e.error) throw new Error(e.error.message || 'recipient_profile read failed'); };
/** On request, for one opportunity: its top 5 similar awards → recipients without a profile fetched in the last 30 days → ProPublica search in the recipient's state
 * (national when the state search has no candidate) → organization → one `recipient_profile` row per recipient key. Same ingest_run, last_success_at and 30/min limiter as F-507. */
export class WinnerProfileHttp {
  static readonly COLUMNS = 'id,award_history_id,recipient_key,recipient,ein,matched_name,state,ntee_code,ruling_year,latest_tax_year,total_revenue,total_expenses,program_service_expenses,contributions_share,match_method,match_confidence,source_url,fetched_at,ingest_run_id';
  static async read(client: SupabaseClient, keys: string[]): Promise<StoredRecipientProfile[]> {
    const r = await client.from('recipient_profile').select(WinnerProfileHttp.COLUMNS).in('recipient_key', keys); fail(r); return (r.data ?? []) as unknown as StoredRecipientProfile[];
  }
  static async fetchOne(a: AwardRecipient, take: () => Promise<void>, now: Date, httpFetch: typeof fetch = fetch): Promise<RecipientProfileRow> {
    const get = async (url: string): Promise<unknown> => { await take(); const res = await httpFetch(url); if (!res.ok) throw new Error(`ProPublica request failed: ${res.status}`); return res.json(); };
    let cands = ProPublica.parseSearch(await get(ProPublica.searchUrl(a.recipient, a.recipient_state)));
    if (a.recipient_state && matchRecipient(a.recipient, a.recipient_state, cands).confidence === 'none') cands = ProPublica.parseSearch(await get(ProPublica.searchUrl(a.recipient, null)));
    const m = matchRecipient(a.recipient, a.recipient_state, cands);
    return toProfileRow(a, m, m.candidate ? ProPublica.parseOrganization(await get(ProPublica.orgUrl(m.candidate.ein))) : null, now);
  }
  static async run(o: WinnerRunOpts): Promise<WinnerRunResult> {
    const env = o.env ?? process.env, now = o.now ?? new Date(), client = o.client ?? SahieHttp.db(env), limiter = o.limiter ?? new RateLimiter({ perMinute: ProPublica.PER_MINUTE });
    const { similar } = await AwardHistoryQuery.forOpportunity(client, o.opportunityId, 5), seen = new Set<string>();
    const awards = similar.filter((a) => { const k = recipientKey(a.recipient, a.recipient_state); return !seen.has(k) && !!seen.add(k); }), keys = [...seen];
    const fresh = new Set((await WinnerProfileHttp.read(client, keys)).filter((p) => isFresh(p.fetched_at, now)).map((p) => p.recipient_key)), rows: RecipientProfileRow[] = [];
    try { for (const a of awards) if (!fresh.has(recipientKey(a.recipient, a.recipient_state))) rows.push(await WinnerProfileHttp.fetchOne(a, () => limiter.take(), now, o.httpFetch)); } catch (e) {
      const id = await (o.recordFailure ?? PublicIndicatorIngest.recordFailure.bind(PublicIndicatorIngest))(client, ProPublica.SOURCE_NAME, SahieHttp.payload(ProPublica.SOURCE_NAME, e, env).error).catch(() => null);
      throw e instanceof Error && id ? Object.assign(e, { ingestRunId: id }) : e;
    }
    const sum = createHash('sha256').update(JSON.stringify(rows.map((r) => ({ ...r, fetched_at: undefined })))).digest('hex');
    const run = rows.length ? await (o.load ?? FoundationHistoryIngest.load)(client, ProPublica.SOURCE_NAME, sum, rows, TARGET) : null;
    return { ingestRunId: run?.ingestRunId ?? null, fetched: rows.length, cached: fresh.size, profiles: keys.length ? await WinnerProfileHttp.read(client, keys) : [] };
  }
  /** `{ opportunity_id: uuid }`, bearer INGEST_TOKEN; same responses and alert as the other ingest routes. */
  static async handle(request: Request, deps: Omit<IngestHttpDeps, 'run'> & { run?: (o: WinnerRunOpts) => Promise<WinnerRunResult> } = {}): Promise<Response> {
    const env = deps.env ?? process.env, source = ProPublica.SOURCE_NAME;
    if (!SahieHttp.tokenOk(request, env)) return Response.json({ error: 'unauthorized' }, { status: 401 });
    const id = await request.json().then((b: { opportunity_id?: unknown }) => b?.opportunity_id, () => null);
    if (typeof id !== 'string' || !UUID.test(id)) return Response.json({ error: 'bad request' }, { status: 400 });
    try {
      const r = await (deps.run ?? WinnerProfileHttp.run)({ opportunityId: id, now: deps.now, env, httpFetch: deps.httpFetch, client: deps.client });
      return Response.json({ ok: true, ingestRunId: r.ingestRunId, fetched: r.fetched, cached: r.cached, profiles: r.profiles.length });
    } catch (e) {
      const p = SahieHttp.payload(source, e, env); console.error('[ingest] failed', { source, stage: 'winner-profiles', message: p.error });
      await IngestAlert.notify(p, env, deps.alertFetch); return Response.json({ error: 'ingest failed' }, { status: 500 });
    }
  }
}
