import type { SupabaseClient } from '@supabase/supabase-js';
import { PublicIndicatorIngest } from '../../packages/ingest/public-indicator';
import { Acs5 } from '../../packages/ingest/acs5';
import { SahieHttp, type SahieLoad } from './sahie-http';

type Env = Record<string, string | undefined>;

export type Acs5RunOpts = {
  year?: string;
  now?: Date;
  env?: Env;
  httpFetch?: typeof fetch;
  client?: SupabaseClient;
  load?: SahieLoad;
};

const SECRET_ENV = ['CENSUS_API_KEY', 'INGEST_TOKEN', 'SUPABASE_SERVICE_ROLE_KEY'];

/** n8n entry for ACS 5-year: fetch → parse → requireComplete → load. Reuses SAHIE's fail-closed token auth. */
export class Acs5Http {
  /** ACS 5-year for year Y is released each December of Y+1; take Y-2 from February on. */
  static year(now: Date, requested?: string): string {
    if (requested !== undefined) {
      if (!/^\d{4}$/.test(requested)) {
        throw new Error('year must be YYYY');
      }
      return requested;
    }
    const offset = now.getUTCMonth() >= 1 ? 2 : 3;
    return String(now.getUTCFullYear() - offset);
  }

  static redact(message: string, env: Env): string {
    let out = message;
    for (const name of SECRET_ENV) {
      const v = env[name];
      if (v) {
        out = out.split(v).join('[redacted]');
      }
    }
    return out.replace(/key=[^&\s]+/g, 'key=[redacted]');
  }

  static async run(opts: Acs5RunOpts) {
    const env = opts.env ?? process.env;
    let stage = 'fetch';
    try {
      const year = Acs5Http.year(opts.now ?? new Date(), opts.year);
      const json = await Acs5.fetch(year, env, opts.httpFetch);
      stage = 'validate';
      const rows = Acs5.requireComplete(Acs5.parse(json, year));
      stage = 'load';
      const load = opts.load ?? PublicIndicatorIngest.load.bind(PublicIndicatorIngest);
      const client = opts.client ?? SahieHttp.db(env);
      return await load(client, Acs5.SOURCE_NAME, Acs5.checksum(rows), rows);
    } catch (e) {
      throw Object.assign(e instanceof Error ? e : new Error('ingest failed'), { stage });
    }
  }

  static async handle(
    request: Request,
    deps: { env?: Env; now?: Date; run?: typeof Acs5Http.run; client?: SupabaseClient; httpFetch?: typeof fetch } = {},
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
      const run = deps.run ?? Acs5Http.run.bind(Acs5Http);
      const result = await run({ year, now: deps.now, env, httpFetch: deps.httpFetch, client: deps.client });
      return Response.json({ ok: true, ingestRunId: result.ingestRunId, rowsLoaded: result.rowsLoaded });
    } catch (e) {
      const stage = (e as { stage?: string }).stage ?? 'unknown';
      const message = Acs5Http.redact(e instanceof Error ? e.message : String(e), env);
      console.error('[ingest] census-acs failed', { source: Acs5.SOURCE_NAME, stage, message });
      return Response.json({ error: 'ingest failed' }, { status: 500 });
    }
  }
}
