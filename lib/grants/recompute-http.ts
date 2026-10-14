// F-504c: n8n entry for the weekly fit-score recompute. Token auth is fail-closed; no FAS client data passes through here.
import type { SupabaseClient } from '@supabase/supabase-js';
import { IngestAlert } from '../../packages/ingest/ingest-alert';
import { SahieHttp } from '../ingest/sahie-http';
import { MatchQuery } from './match-query';

export type RecomputeResult = { org_id: string; scored: number; config_id: string | null; reason?: string };
export type RecomputeDeps = { env?: Record<string, string | undefined>; now?: Date; client?: SupabaseClient; recompute?: typeof MatchQuery.recompute };
const SOURCE = 'grants-recompute';

export class RecomputeHttp {
  /** Body is optional; `{ org_id }` narrows the run to one org. Anything else is a 400. */
  static readOrgId(text: string): string | undefined {
    if (text.length === 0) return undefined;
    const body = JSON.parse(text) as unknown;
    if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new Error('body');
    if (!('org_id' in body) || body.org_id === undefined) return undefined;
    if (typeof body.org_id !== 'string' || body.org_id.length === 0) throw new Error('org_id');
    return body.org_id;
  }

  /** One org when the body names it, otherwise every row in `org` (service role; RLS does not narrow this). */
  static async orgIds(client: SupabaseClient, orgId?: string): Promise<string[]> {
    if (orgId !== undefined) return [orgId];
    const { data, error } = await client.from('org').select('id');
    if (error) throw new Error(error.message);
    return ((data ?? []) as { id: string }[]).map((o) => o.id);
  }

  static async run(orgId: string | undefined, deps: RecomputeDeps): Promise<RecomputeResult[]> {
    const env = deps.env ?? process.env;
    const client = deps.client ?? SahieHttp.db(env);
    const now = deps.now ?? new Date();
    const recompute = deps.recompute ?? MatchQuery.recompute.bind(MatchQuery);
    const out: RecomputeResult[] = [];
    for (const id of await RecomputeHttp.orgIds(client, orgId)) {
      const r = await recompute(client, id, now);
      out.push({ org_id: id, scored: r.scored, config_id: r.configId, ...(r.reason ? { reason: r.reason } : {}) });
    }
    return out;
  }

  /** auth → body → recompute per org. Failures log a redacted message (env values scrubbed) and return a generic 500. */
  static async handle(request: Request, deps: RecomputeDeps = {}): Promise<Response> {
    const env = deps.env ?? process.env;
    if (!SahieHttp.tokenOk(request, env)) return Response.json({ error: 'unauthorized' }, { status: 401 });
    let orgId: string | undefined;
    try {
      orgId = RecomputeHttp.readOrgId(await request.text());
    } catch (e) {
      console.error('[grants] recompute failed', { stage: 'request', message: IngestAlert.payload(SOURCE, e, env).error });
      return Response.json({ error: 'bad request' }, { status: 400 });
    }
    try {
      return Response.json({ results: await RecomputeHttp.run(orgId, deps) });
    } catch (e) {
      console.error('[grants] recompute failed', { stage: 'run', message: IngestAlert.payload(SOURCE, e, env).error });
      return Response.json({ error: 'recompute failed' }, { status: 500 });
    }
  }
}
