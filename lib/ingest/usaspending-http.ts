import type { SupabaseClient } from '@supabase/supabase-js';
import { UsaSpending, defaultConfig, type AwardRow, type SearchConfig } from '../../packages/ingest/usaspending';
import { PublicIndicatorIngest } from '../../packages/ingest/public-indicator';
import { RateLimiter } from './rate-limit';
import { SahieHttp, type IngestHttpDeps, type SahieRunOpts } from './sahie-http';
export type UsaSpendingRunOpts = Omit<SahieRunOpts, 'load'> & { config?: SearchConfig; limiter?: RateLimiter; load?: typeof AwardHistoryIngest.load };
const fail = (e: { error: { message: string } | null }, fallback: string) => { if (e.error) throw new Error(e.error.message || fallback); };
/** Awards land in `award_history` keyed on (source, external_id); each run is an ingest_run and bumps last_success_at. Service role only (no client write policy). */
export class AwardHistoryIngest {
  static async load(client: SupabaseClient, sourceName: string, checksum: string, rows: AwardRow[]) {
    const src = await client.from('source_registry').select('id').eq('name', sourceName).single(), sourceId = src.data?.id as string;
    if (src.error || !sourceId) throw new Error(`source ${sourceName} is not registered`);
    const started = await client.from('ingest_run').insert({ source_id: sourceId, status: 'running', checksum }).select('id').single();
    fail(started, 'ingest_run insert failed'); const ingestRunId = started.data?.id as string;
    try {
      fail(await client.from('award_history').upsert(rows.map((r) => ({ ...r, ingest_run_id: ingestRunId })), { onConflict: 'source,external_id' }), 'upsert failed');
      const now = new Date().toISOString();
      fail(await client.from('ingest_run').update({ status: 'ok', rows_loaded: rows.length, finished_at: now }).eq('id', ingestRunId), 'run update failed');
      await client.from('source_registry').update({ last_success_at: now }).eq('id', sourceId);
      return { ingestRunId, rowsLoaded: rows.length, sourceId };
    } catch (e) {
      await client.from('ingest_run').update({ status: 'error', error: e instanceof Error ? e.message : 'load failed', finished_at: new Date().toISOString() }).eq('id', ingestRunId);
      throw e instanceof Error ? Object.assign(e, { ingestRunId }) : e;
    }
  }
}
/** n8n entry (monthly): each ALN × completed fiscal year → dedupe → upsert. No API key; a self-imposed 30/min limiter guards the public API. */
export class UsaSpendingHttp {
  static async run(opts: UsaSpendingRunOpts) {
    const [env, limiter] = [opts.env ?? process.env, opts.limiter ?? new RateLimiter({ perMinute: UsaSpending.PER_MINUTE })], client = opts.client ?? SahieHttp.db(env);
    let rows: AwardRow[];
    try {
      rows = await UsaSpending.search(opts.config ?? defaultConfig(opts.now), () => limiter.take(), opts.httpFetch);
    } catch (e) {
      const record = opts.recordFailure ?? PublicIndicatorIngest.recordFailure.bind(PublicIndicatorIngest);
      const ingestRunId = await record(client, UsaSpending.SOURCE_NAME, SahieHttp.payload(UsaSpending.SOURCE_NAME, e, env).error).catch(() => null);
      throw e instanceof Error && ingestRunId ? Object.assign(e, { ingestRunId }) : e;
    }
    return (opts.load ?? AwardHistoryIngest.load)(client, UsaSpending.SOURCE_NAME, UsaSpending.checksum(rows), rows);
  }
  static handle(request: Request, deps: IngestHttpDeps = {}): Promise<Response> {
    return SahieHttp.respond(request, UsaSpending.SOURCE_NAME, (o) => UsaSpendingHttp.run({ ...o, load: undefined }), deps);
  }
}
