// F-505: n8n entry for the weekly grant digest. `GET /api/grants/digest?org_id=&days=` with the ingest bearer token returns one rendered
// digest per org (subject, text, html, rows). Sending is n8n's job and stays inactive until George activates it (george-before-send).
import type { SupabaseClient } from '@supabase/supabase-js';
import { IngestAlert } from '../../packages/ingest/ingest-alert';
import { SahieHttp } from '../ingest/sahie-http';
import { buildDigest, DEFAULT_DIGEST_DAYS, type Digest, type DigestRow } from './digest';
import { fromMatchFlags } from './eligibility';
import { MatchQuery } from './match-query';
import { RecomputeHttp } from './recompute-http';

export type DigestDeps = { env?: Record<string, string | undefined>; now?: Date; client?: SupabaseClient };
export type OrgDigest = { org_id: string; config_id: string | null; reason?: string } & Partial<Digest>;
type Row = { id: string; opportunity_id?: string; score: number | string | null; flags: unknown; computed_at: string; opportunity: { title: string; funder: string | null; close_date: string | null; posted_date: string | null } | null };
const SOURCE = 'grants-digest';
const MAX_DAYS = 90;

export class DigestHttp {
  /** `org_id` narrows to one org; `days` (1–90, default 7) is the window. Anything else is a 400. */
  static readQuery(url: URL): { orgId?: string; days: number } {
    const orgId = url.searchParams.get('org_id') ?? undefined, raw = url.searchParams.get('days');
    if (orgId !== undefined && orgId.length === 0) throw new Error('org_id');
    if (raw === null) return { orgId, days: DEFAULT_DIGEST_DAYS };
    const days = Number(raw);
    if (!/^\d+$/.test(raw) || days < 1 || days > MAX_DAYS) throw new Error('days');
    return { orgId, days };
  }

  static async rows(client: SupabaseClient, orgId: string, configId: string): Promise<DigestRow[]> {
    const { data, error } = await client.from('match_result').select('id,opportunity_id,score,flags,computed_at,opportunity(title,funder,close_date,posted_date)').eq('org_id', orgId).eq('config_id', configId);
    if (error) throw new Error(error.message);
    return ((data ?? []) as unknown as Row[]).filter((r) => r.opportunity).map((r) => {
      let eligibility = 'Unknown';
      try { eligibility = MatchQuery.eligibilityLabel(fromMatchFlags(r.flags)); } catch { /* malformed stored flags read as unknown */ }
      const o = r.opportunity as NonNullable<Row['opportunity']>;
      return { id: r.id, opportunityId: r.opportunity_id, title: o.title, funder: o.funder, closeDate: o.close_date, postedDate: o.posted_date, computedAt: r.computed_at, score: Number(r.score ?? 0), eligibility };
    });
  }

  /** `appUrl` (F-505b): the origin n8n called, so the email's links point at the same app. */
  static async run(q: { orgId?: string; days: number; appUrl?: string }, deps: DigestDeps): Promise<OrgDigest[]> {
    const env = deps.env ?? process.env, client = deps.client ?? SahieHttp.db(env), now = deps.now ?? new Date();
    const config = await MatchQuery.config(client);
    const out: OrgDigest[] = [];
    for (const id of await RecomputeHttp.orgIds(client, q.orgId)) {
      if (config === null) { out.push({ org_id: id, config_id: null, reason: 'no approved config' }); continue; }
      out.push({ org_id: id, config_id: config.id, ...buildDigest(await DigestHttp.rows(client, id, config.id), now, config.params, q.days, q.appUrl) });
    }
    return out;
  }

  /** auth → query → one digest per org. Failures log a redacted message and return a generic 500. */
  static async handle(request: Request, deps: DigestDeps = {}): Promise<Response> {
    const env = deps.env ?? process.env;
    if (!SahieHttp.tokenOk(request, env)) return Response.json({ error: 'unauthorized' }, { status: 401 });
    let q: { orgId?: string; days: number };
    try {
      q = DigestHttp.readQuery(new URL(request.url));
    } catch (e) {
      console.error('[grants] digest failed', { stage: 'request', message: IngestAlert.payload(SOURCE, e, env).error });
      return Response.json({ error: 'bad request' }, { status: 400 });
    }
    try {
      return Response.json({ digests: await DigestHttp.run({ ...q, appUrl: new URL(request.url).origin }, deps) });
    } catch (e) {
      console.error('[grants] digest failed', { stage: 'run', message: IngestAlert.payload(SOURCE, e, env).error });
      return Response.json({ error: 'digest failed' }, { status: 500 });
    }
  }
}
