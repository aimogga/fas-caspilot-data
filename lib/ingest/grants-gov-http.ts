import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_CONFIG, GrantsGov, type OpportunityRow, type SearchConfig } from '../../packages/ingest/grants_gov';
import { PublicIndicatorIngest } from '../../packages/ingest/public-indicator';
import { RateLimiter } from './rate-limit';
import { SahieHttp, type IngestHttpDeps, type SahieRunOpts } from './sahie-http';

export type GrantsGovRunOpts = Omit<SahieRunOpts, 'load'> & { config?: SearchConfig; limiter?: RateLimiter; load?: typeof OpportunityIngest.load };
const fail = (e: { error: { message: string } | null }, fallback: string) => { if (e.error) throw new Error(e.error.message || fallback); };

/** Opportunities land in `opportunity` keyed on (source, external_id); each run is an ingest_run and bumps last_success_at. */
export class OpportunityIngest {
  static async load(client: SupabaseClient, sourceName: string, checksum: string, rows: OpportunityRow[]) {
    const src = await client.from('source_registry').select('id').eq('name', sourceName).single();
    if (src.error || !src.data) throw new Error(`source ${sourceName} is not registered`);
    const sourceId = src.data.id as string;
    const started = await client.from('ingest_run').insert({ source_id: sourceId, status: 'running', checksum }).select('id').single();
    fail(started, 'ingest_run insert failed');
    const ingestRunId = started.data?.id as string;
    try {
      fail(await client.from('opportunity').upsert(rows.map((r) => ({ ...r, ingest_run_id: ingestRunId })), { onConflict: 'source,external_id' }), 'upsert failed');
      const now = new Date().toISOString();
      fail(await client.from('ingest_run').update({ status: 'ok', rows_loaded: rows.length, finished_at: now }).eq('id', ingestRunId), 'run update failed');
      await client.from('source_registry').update({ last_success_at: now }).eq('id', sourceId);
      return { ingestRunId, rowsLoaded: rows.length, sourceId };
    } catch (e) {
      const error = e instanceof Error ? e.message : 'load failed';
      await client.from('ingest_run').update({ status: 'error', error, finished_at: new Date().toISOString() }).eq('id', ingestRunId);
      if (e instanceof Error) Object.assign(e, { ingestRunId });
      throw e;
    }
  }
}

/** n8n entry (weekly, which also keeps the key active): search each theme → dedupe → upsert. Missing key → 503, recorded as a failed run. */
export class GrantsGovHttp {
  static async run(opts: GrantsGovRunOpts) {
    const [env, limiter] = [opts.env ?? process.env, opts.limiter ?? new RateLimiter()];
    const client = opts.client ?? SahieHttp.db(env);
    let rows: OpportunityRow[];
    try {
      const key = env.SIMPLER_GRANTS_API_KEY;
      if (!key) throw Object.assign(new Error('api key not configured'), { httpStatus: 503 });
      rows = await GrantsGov.search(opts.config ?? DEFAULT_CONFIG, key, () => limiter.take(), opts.httpFetch);
    } catch (e) {
      const record = opts.recordFailure ?? PublicIndicatorIngest.recordFailure.bind(PublicIndicatorIngest);
      const ingestRunId = await record(client, GrantsGov.SOURCE_NAME, SahieHttp.payload(GrantsGov.SOURCE_NAME, e, env).error).catch(() => null);
      if (e instanceof Error && ingestRunId) Object.assign(e, { ingestRunId });
      throw e;
    }
    return (opts.load ?? OpportunityIngest.load)(client, GrantsGov.SOURCE_NAME, GrantsGov.checksum(rows), rows);
  }
  static handle(request: Request, deps: IngestHttpDeps = {}): Promise<Response> {
    return SahieHttp.respond(request, GrantsGov.SOURCE_NAME, (o) => GrantsGovHttp.run({ ...o, load: undefined }), deps);
  }
}
