import { timingSafeEqual } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { IngestAlert } from '../../packages/ingest/ingest-alert';
import { PublicIndicatorIngest, type IndicatorRow } from '../../packages/ingest/public-indicator';
import { Sahie } from '../../packages/ingest/sahie';

export type SahieRunOpts = {
  year?: string;
  now?: Date;
  env?: Record<string, string | undefined>;
  httpFetch?: typeof fetch;
  client?: SupabaseClient;
  load?: typeof PublicIndicatorIngest.load;
  recordFailure?: typeof PublicIndicatorIngest.recordFailure;
};

type IngestSource = { SOURCE_NAME: string; checksum(rows: IndicatorRow[]): string };

export type IngestHttpDeps = Pick<SahieRunOpts, 'env' | 'now' | 'client' | 'httpFetch'> & {
  run?: (opts: SahieRunOpts) => Promise<{ ingestRunId: string; rowsLoaded: number }>;
  alertFetch?: typeof fetch;
};

/** n8n entry: fetch → parse → fill (requireComplete) → load. Token auth is fail-closed. */
export class SahieHttp {
  static tokenOk(request: Request, env: Record<string, string | undefined> = process.env): boolean {
    const expected = env.INGEST_TOKEN;
    if (typeof expected !== 'string' || expected.length === 0) {
      return false;
    }
    const raw = request.headers.get('authorization');
    if (raw == null || !raw.startsWith('Bearer ')) {
      return false;
    }
    const got = raw.slice('Bearer '.length);
    const a = Buffer.from(got);
    const b = Buffer.from(expected);
    if (a.length !== b.length) {
      return false;
    }
    return timingSafeEqual(a, b);
  }

  static year(now: Date, requested?: string): string {
    if (requested !== undefined) {
      if (!/^\d{4}$/.test(requested)) {
        throw new Error('year must be YYYY');
      }
      return requested;
    }
    const y = now.getUTCFullYear();
    const offset = now.getUTCMonth() >= 7 ? 2 : 3;
    return String(y - offset);
  }

  static readYear(body: unknown): string | undefined {
    if (body == null) {
      return undefined;
    }
    if (typeof body !== 'object' || Array.isArray(body)) {
      throw new Error('body');
    }
    if (!('year' in body) || body.year === undefined) {
      return undefined;
    }
    if (typeof body.year !== 'string' || !/^\d{4}$/.test(body.year)) {
      throw new Error('year');
    }
    return body.year;
  }

  static db(env: Record<string, string | undefined> = process.env): SupabaseClient {
    const url = env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL;
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('ingest database is not configured');
    }
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  /** Shared by every source: a fetch/parse/completeness failure is recorded as an error run before rethrowing. */
  static async ingest(
    source: IngestSource,
    opts: SahieRunOpts,
    fetchRows: (env: Record<string, string | undefined>) => Promise<IndicatorRow[]>,
  ) {
    const env = opts.env ?? process.env;
    const client = opts.client ?? SahieHttp.db(env);
    let rows: IndicatorRow[];
    try {
      rows = await fetchRows(env);
    } catch (e) {
      const record = opts.recordFailure ?? PublicIndicatorIngest.recordFailure.bind(PublicIndicatorIngest);
      const message = SahieHttp.payload(source.SOURCE_NAME, e, env).error;
      const ingestRunId = await record(client, source.SOURCE_NAME, message).catch(() => null);
      if (e instanceof Error && ingestRunId) Object.assign(e, { ingestRunId });
      throw e;
    }
    const load = opts.load ?? PublicIndicatorIngest.load.bind(PublicIndicatorIngest);
    return load(client, source.SOURCE_NAME, source.checksum(rows), rows);
  }

  static async run(opts: SahieRunOpts) {
    const year = SahieHttp.year(opts.now ?? new Date(), opts.year);
    return SahieHttp.ingest(Sahie, opts, async (env) =>
      Sahie.requireComplete(Sahie.parse(await Sahie.fetch(year, env, opts.httpFetch))));
  }

  /** IngestAlert payload plus the `key=` query-param redaction backstop (defense in depth). */
  static payload(source: string, e: unknown, env: Record<string, string | undefined>) {
    const p = IngestAlert.payload(source, e, env);
    return { ...p, error: p.error.replace(/key=[^&\s]+/g, 'key=[redacted]') };
  }

  /** Shared route skeleton: auth → body → run; on failure log redacted, alert, then 500. */
  static async respond(
    request: Request,
    source: string,
    run: NonNullable<IngestHttpDeps['run']>,
    deps: IngestHttpDeps = {},
  ): Promise<Response> {
    const env = deps.env ?? process.env;
    if (!SahieHttp.tokenOk(request, env)) {
      return Response.json({ error: 'unauthorized' }, { status: 401 });
    }
    let year: string | undefined;
    try {
      const text = await request.text();
      year = text.length === 0 ? undefined : SahieHttp.readYear(JSON.parse(text) as unknown);
    } catch (e) {
      console.error('[ingest] failed', { source, stage: 'request', message: SahieHttp.payload(source, e, env).error });
      return Response.json({ error: 'bad request' }, { status: 400 });
    }
    try {
      const result = await (deps.run ?? run)({ year, now: deps.now, env, httpFetch: deps.httpFetch, client: deps.client });
      return Response.json({ ok: true, ingestRunId: result.ingestRunId, rowsLoaded: result.rowsLoaded });
    } catch (e) {
      const payload = SahieHttp.payload(source, e, env);
      console.error('[ingest] failed', { source, stage: 'run', message: payload.error });
      await IngestAlert.notify(payload, env, deps.alertFetch);
      const status = e instanceof Error && 'httpStatus' in e && typeof e.httpStatus === 'number' ? e.httpStatus : 500;
      return Response.json({ error: status === 500 || !(e instanceof Error) ? 'ingest failed' : e.message }, { status });
    }
  }

  static handle(request: Request, deps: IngestHttpDeps = {}): Promise<Response> {
    return SahieHttp.respond(request, Sahie.SOURCE_NAME, SahieHttp.run.bind(SahieHttp), deps);
  }
}
