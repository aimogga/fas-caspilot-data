import { PublicIndicatorIngest } from '../../packages/ingest/public-indicator';
import { Acs5 } from '../../packages/ingest/acs5';
import { SahieHttp, type SahieRunOpts } from './sahie-http';

export type AcsRunOpts = SahieRunOpts;

/** n8n entry: fetch → parse → requireComplete → load. Reuses SahieHttp token, body and db checks. */
export class AcsHttp {
  static year(now: Date, requested?: string): string {
    if (requested !== undefined) return SahieHttp.year(now, requested);
    return String(now.getUTCFullYear() - (now.getUTCMonth() >= 10 ? 1 : 2));
  }

  static async run(opts: AcsRunOpts) {
    const env = opts.env ?? process.env;
    const year = AcsHttp.year(opts.now ?? new Date(), opts.year);
    const json = await Acs5.fetch(year, env, opts.httpFetch);
    const rows = Acs5.requireComplete(Acs5.parse(json), year);
    const load = opts.load ?? PublicIndicatorIngest.load.bind(PublicIndicatorIngest);
    const client = opts.client ?? SahieHttp.db(env);
    return load(client, Acs5.SOURCE_NAME, Acs5.checksum(rows), rows);
  }

  static logFailure(stage: string, e: unknown, env: Record<string, string | undefined>): void {
    let message = e instanceof Error ? e.message : 'unknown error';
    for (const name of ['CENSUS_API_KEY', 'INGEST_TOKEN', 'SUPABASE_SERVICE_ROLE_KEY']) {
      const secret = env[name];
      if (secret) message = message.split(secret).join('[redacted]');
    }
    message = message.replace(/key=[^&\s]+/g, 'key=[redacted]');
    console.error('[ingest:acs]', { source: Acs5.SOURCE_NAME, stage, message });
  }

  static async handle(
    request: Request,
    deps: Pick<AcsRunOpts, 'env' | 'now' | 'client' | 'httpFetch'> & { run?: typeof AcsHttp.run } = {},
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
      AcsHttp.logFailure('request', e, env);
      return Response.json({ error: 'bad request' }, { status: 400 });
    }
    try {
      const run = deps.run ?? AcsHttp.run.bind(AcsHttp);
      const result = await run({ year, now: deps.now, env, httpFetch: deps.httpFetch, client: deps.client });
      return Response.json({ ok: true, ingestRunId: result.ingestRunId, rowsLoaded: result.rowsLoaded });
    } catch (e) {
      AcsHttp.logFailure('run', e, env);
      return Response.json({ error: 'ingest failed' }, { status: 500 });
    }
  }
}
