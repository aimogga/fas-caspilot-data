import type { SupabaseClient } from '@supabase/supabase-js';
import { PublicIndicatorIngest } from '../../packages/ingest/public-indicator';
import { Saipe } from '../../packages/ingest/saipe';
import { SahieHttp, type SahieLoad } from './sahie-http';

export type SaipeRunOpts = {
  year?: string;
  now?: Date;
  env?: Record<string, string | undefined>;
  httpFetch?: typeof fetch;
  client?: SupabaseClient;
  load?: SahieLoad;
};

/** n8n entry: fetch → parse → requireComplete → load. Reuses SahieHttp token, body and db checks. */
export class SaipeHttp {
  static year(now: Date, requested?: string): string {
    if (requested !== undefined) {
      if (!/^\d{4}$/.test(requested)) {
        throw new Error('year must be YYYY');
      }
      return requested;
    }
    const offset = now.getUTCMonth() === 11 ? 1 : 2;
    return String(now.getUTCFullYear() - offset);
  }

  static async run(opts: SaipeRunOpts) {
    const env = opts.env ?? process.env;
    const year = SaipeHttp.year(opts.now ?? new Date(), opts.year);
    const json = await Saipe.fetch(year, env, opts.httpFetch);
    const rows = Saipe.requireComplete(Saipe.parse(json));
    const load = opts.load ?? PublicIndicatorIngest.load.bind(PublicIndicatorIngest);
    const client = opts.client ?? SahieHttp.db(env);
    return load(client, Saipe.SOURCE_NAME, Saipe.checksum(rows), rows);
  }

  static logFailure(stage: string, e: unknown, env: Record<string, string | undefined>): void {
    let message = e instanceof Error ? e.message : 'unknown error';
    for (const name of ['CENSUS_API_KEY', 'INGEST_TOKEN', 'SUPABASE_SERVICE_ROLE_KEY']) {
      const secret = env[name];
      if (secret) {
        message = message.split(secret).join('[redacted]');
      }
    }
    message = message.replace(/key=[^&\s]+/g, 'key=[redacted]');
    console.error('[ingest:saipe] failed', { source: Saipe.SOURCE_NAME, stage, message });
  }

  static async handle(
    request: Request,
    deps: {
      env?: Record<string, string | undefined>;
      now?: Date;
      run?: typeof SaipeHttp.run;
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
    } catch (e) {
      SaipeHttp.logFailure('request', e, env);
      return Response.json({ error: 'bad request' }, { status: 400 });
    }
    try {
      const run = deps.run ?? SaipeHttp.run.bind(SaipeHttp);
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
    } catch (e) {
      SaipeHttp.logFailure('run', e, env);
      return Response.json({ error: 'ingest failed' }, { status: 500 });
    }
  }
}
