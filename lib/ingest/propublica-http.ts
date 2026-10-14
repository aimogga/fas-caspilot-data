import type { SupabaseClient } from '@supabase/supabase-js';
import { IngestAlert } from '../../packages/ingest/ingest-alert';
import { ProPublica, type FoundationRow, type FunderProfile } from '../../packages/ingest/propublica';
import { PublicIndicatorIngest } from '../../packages/ingest/public-indicator';
import { RateLimiter } from './rate-limit';
import { SahieHttp, type IngestHttpDeps } from './sahie-http';
// synthetic placeholders; real Utah funder list is George-gated
export const FUNDER_WATCHLIST = ['Example Family Foundation', 'Sample Community Trust', 'Demo Children Fund', 'Placeholder Mental Health Foundation', 'Test Valley Charitable Foundation'];
export type ProPublicaRunOpts = { env?: Record<string, string | undefined>; now?: Date; httpFetch?: typeof fetch; client?: SupabaseClient; funders?: string[]; limiter?: RateLimiter;
  load?: typeof FoundationHistoryIngest.load; recordFailure?: typeof PublicIndicatorIngest.recordFailure };
export type ProPublicaRunResult = { ingestRunId: string; rowsLoaded: number; sourceId: string; funders: number; notFound: string[] }; const fail = (e: { error: { message: string } | null }, fallback: string) => { if (e.error) throw new Error(e.error.message || fallback); };
/** Rows land in `award_history` keyed on (source, external_id); each run is an ingest_run and bumps last_success_at. Service role only (no client write policy). */
export class FoundationHistoryIngest {
  static async load(client: SupabaseClient, sourceName: string, checksum: string, rows: FoundationRow[]) {
    const src = await client.from('source_registry').select('id').eq('name', sourceName).single(), sourceId = src.data?.id as string;
    if (src.error || !sourceId) throw new Error(`source ${sourceName} is not registered`);
    const started = await client.from('ingest_run').insert({ source_id: sourceId, status: 'running', checksum }).select('id').single(), ingestRunId = started.data?.id as string;
    fail(started, 'ingest_run insert failed');
    try {
      if (rows.length) fail(await client.from('award_history').upsert(rows.map((r) => ({ ...r, ingest_run_id: ingestRunId })), { onConflict: 'source,external_id' }), 'upsert failed');
      const now = new Date().toISOString(); fail(await client.from('ingest_run').update({ status: 'ok', rows_loaded: rows.length, finished_at: now }).eq('id', ingestRunId), 'run update failed');
      await client.from('source_registry').update({ last_success_at: now }).eq('id', sourceId); return { ingestRunId, rowsLoaded: rows.length, sourceId };
    } catch (e) {
      await client.from('ingest_run').update({ status: 'error', error: e instanceof Error ? e.message : 'load failed', finished_at: new Date().toISOString() }).eq('id', ingestRunId);
      throw e instanceof Error ? Object.assign(e, { ingestRunId }) : e;
    }
  }
  /** Body funders (or the watchlist) plus every hand-entered `opportunity.funder` (foundation_manual / foundation_csv), deduped case-insensitively. */
  static async funderList(client: SupabaseClient, requested?: string[]): Promise<string[]> {
    const manual = await client.from('opportunity').select('funder').in('source', ['foundation_manual', 'foundation_csv']).not('funder', 'is', null), seen = new Set<string>(), out: string[] = [];
    fail(manual, 'opportunity read failed');
    for (const f of [...(requested ?? FUNDER_WATCHLIST), ...(manual.data ?? []).map((r) => (r as { funder: unknown }).funder).filter((f): f is string => typeof f === 'string')]) {
      const key = f.trim().toLowerCase(); if (key && !seen.has(key)) { seen.add(key); out.push(f.trim()); }
    }
    return out;
  }
}
/** n8n entry (quarterly): each funder → search (Utah, then national) → organization → one row per 990-PF year → upsert. Self-imposed 30/min limiter. */
export class ProPublicaHttp {
  /** `{ funders?: string[] }`; an empty body means the watchlist. */
  static readFunders(text: string): string[] | undefined {
    const f = text.length ? ((JSON.parse(text) ?? {}) as { funders?: unknown }).funders : undefined;
    if (f !== undefined && !(Array.isArray(f) && f.every((x) => typeof x === 'string'))) throw new Error('funders must be string[]'); return f as string[] | undefined;
  }
  static async run(opts: ProPublicaRunOpts): Promise<ProPublicaRunResult> {
    const [env, limiter] = [opts.env ?? process.env, opts.limiter ?? new RateLimiter({ perMinute: ProPublica.PER_MINUTE })], client = opts.client ?? SahieHttp.db(env);
    const rows: FoundationRow[] = [], notFound: string[] = []; let funders: string[];
    try {
      funders = await FoundationHistoryIngest.funderList(client, opts.funders);
      for (const f of funders) { const p: FunderProfile | null = await ProPublica.lookup(f, () => limiter.take(), opts.httpFetch); if (p) rows.push(...ProPublica.toAwardHistoryRows(p)); else notFound.push(f); }
    } catch (e) {
      const record = opts.recordFailure ?? PublicIndicatorIngest.recordFailure.bind(PublicIndicatorIngest);
      const ingestRunId = await record(client, ProPublica.SOURCE_NAME, SahieHttp.payload(ProPublica.SOURCE_NAME, e, env).error).catch(() => null);
      throw e instanceof Error && ingestRunId ? Object.assign(e, { ingestRunId }) : e;
    }
    const seen = new Set<string>(), unique = rows.filter((r) => !seen.has(r.external_id) && seen.add(r.external_id)); // two names can resolve to one EIN
    const loaded = await (opts.load ?? FoundationHistoryIngest.load)(client, ProPublica.SOURCE_NAME, ProPublica.checksum(unique), unique);
    return { ...loaded, funders: funders.length, notFound };
  }
  /** Same skeleton as SahieHttp.respond, with a `{ funders?: string[] }` body instead of `{ year }`. */
  static async handle(request: Request, deps: Omit<IngestHttpDeps, 'run'> & { run?: (o: ProPublicaRunOpts) => Promise<ProPublicaRunResult> } = {}): Promise<Response> {
    const env = deps.env ?? process.env, source = ProPublica.SOURCE_NAME, oops = (stage: string, e: unknown) => { const p = SahieHttp.payload(source, e, env); console.error('[ingest] failed', { source, stage, message: p.error }); return p; };
    if (!SahieHttp.tokenOk(request, env)) return Response.json({ error: 'unauthorized' }, { status: 401 });
    let funders: string[] | undefined;
    try { funders = ProPublicaHttp.readFunders(await request.text()); } catch (e) { oops('request', e); return Response.json({ error: 'bad request' }, { status: 400 }); }
    try {
      const r = await (deps.run ?? ProPublicaHttp.run)({ funders, now: deps.now, env, httpFetch: deps.httpFetch, client: deps.client });
      return Response.json({ ok: true, ingestRunId: r.ingestRunId, rowsLoaded: r.rowsLoaded, funders: r.funders, notFound: r.notFound });
    } catch (e) { await IngestAlert.notify(oops('run', e), env, deps.alertFetch); return Response.json({ error: 'ingest failed' }, { status: 500 }); }
  }
}
