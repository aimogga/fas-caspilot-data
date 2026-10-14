import type { SupabaseClient } from '@supabase/supabase-js';
import { IngestAlert } from '../../packages/ingest/ingest-alert';
import { NeedScoreRecompute } from '../need-score/recompute';
import { SahieHttp } from './sahie-http';

export type NeedScoreHttpDeps = {
  env?: Record<string, string | undefined>;
  client?: SupabaseClient;
  run?: typeof NeedScoreRecompute.run;
  alertFetch?: typeof fetch;
};

/** n8n entry, called after the public-data ingests: bearer token (fail-closed), recompute, alert on failure. */
export class NeedScoreHttp {
  static readonly SOURCE_NAME = 'need-score';

  static async handle(request: Request, deps: NeedScoreHttpDeps = {}): Promise<Response> {
    const env = deps.env ?? process.env;
    if (!SahieHttp.tokenOk(request, env)) return Response.json({ error: 'unauthorized' }, { status: 401 });
    try {
      const result = await (deps.run ?? NeedScoreRecompute.run)(deps.client ?? SahieHttp.db(env));
      return Response.json({ ok: true, ...result });
    } catch (e) {
      const payload = SahieHttp.payload(NeedScoreHttp.SOURCE_NAME, e, env);
      console.error('[ingest] failed', { source: NeedScoreHttp.SOURCE_NAME, stage: 'run', message: payload.error });
      await IngestAlert.notify(payload, env, deps.alertFetch);
      return Response.json({ error: 'recompute failed' }, { status: 500 });
    }
  }
}
