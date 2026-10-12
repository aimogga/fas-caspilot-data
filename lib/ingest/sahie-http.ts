import { timingSafeEqual } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { PublicIndicatorIngest, type IndicatorRow } from '../../packages/ingest/public-indicator';
import { Sahie } from '../../packages/ingest/sahie';

export type SahieLoad = (
  client: SupabaseClient,
  sourceName: string,
  checksum: string,
  rows: IndicatorRow[],
) => Promise<{ ingestRunId: string; rowsLoaded: number; sourceId: string }>;

export type SahieRunOpts = {
  year?: string;
  now?: Date;
  env?: Record<string, string | undefined>;
  httpFetch?: typeof fetch;
  client?: SupabaseClient;
  load?: SahieLoad;
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

  static async run(opts: SahieRunOpts) {
    const env = opts.env ?? process.env;
    const year = SahieHttp.year(opts.now ?? new Date(), opts.year);
    const json = await Sahie.fetch(year, env, opts.httpFetch);
    const rows = Sahie.requireComplete(Sahie.parse(json));
    const load = opts.load ?? PublicIndicatorIngest.load.bind(PublicIndicatorIngest);
    const client = opts.client ?? SahieHttp.db(env);
    return load(client, Sahie.SOURCE_NAME, Sahie.checksum(rows), rows);
  }

  static async handle(
    request: Request,
    deps: {
      env?: Record<string, string | undefined>;
      now?: Date;
      run?: typeof SahieHttp.run;
      client?: SupabaseClient;
      httpFetch?: typeof fetch;
    } = {},
  ): Promise<Response> {
    const env = deps.env ?? process.env;
    if (!SahieHttp.tokenOk(request, env)) {
      return Response.json({ error: 'unauthorized' }, { status: 401 });
    }
    let year: string | undefined;
    try {
      const text = await request.text();
      year = text.length === 0 ? undefined : SahieHttp.readYear(JSON.parse(text) as unknown);
    } catch {
      return Response.json({ error: 'bad request' }, { status: 400 });
    }
    try {
      const run = deps.run ?? SahieHttp.run.bind(SahieHttp);
      const result = await run({
        year,
        now: deps.now,
        env,
        httpFetch: deps.httpFetch,
        client: deps.client,
      });
      return Response.json({
        ok: true,
        ingestRunId: result.ingestRunId,
        rowsLoaded: result.rowsLoaded,
      });
    } catch {
      return Response.json({ error: 'ingest failed' }, { status: 500 });
    }
  }
}
