import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { RecomputeHttp } from './recompute-http';

const TOKEN = 'not-a-secret-token';
const ENV = { INGEST_TOKEN: TOKEN, SUPABASE_SERVICE_ROLE_KEY: 'not-a-secret-key' };
const NOW = new Date('2026-10-14T09:00:00Z');
const WEIGHTS = { mission_fit: 0.3, eligibility_certainty: 0.2, evidence_readiness: 0.15, award_size_fit: 0.15, geography: 0.1, effort_vs_time: 0.1 };

function req(token?: string, body?: string): Request {
  const headers = new Headers();
  if (token !== undefined) headers.set('authorization', `Bearer ${token}`);
  return new Request('http://127.0.0.1/api/grants/recompute', { method: 'POST', headers, body });
}

/** Service-role stand-in: records every table touched; only `org` and `match_config` answer. */
function stubClient(orgs: string[], approved: boolean) {
  const calls: string[] = [];
  const config = { id: 'v0-draft', weights: WEIGHTS, params: {}, created_at: '2026-10-14', approved_by: approved ? 'admin' : null };
  const client = {
    from: (t: string) => {
      calls.push(t);
      return { select: async () => ({ data: t === 'org' ? orgs.map((id) => ({ id })) : t === 'match_config' ? [config] : [], error: null }) };
    },
  } as unknown as SupabaseClient;
  return { calls, client };
}

const neverClient = { from: () => { throw new Error('client must not be used'); } } as unknown as SupabaseClient;

afterEach(() => vi.restoreAllMocks());

describe('POST /api/grants/recompute auth fails closed', () => {
  it('returns 401 for a missing token, a wrong token, and an unset secret', async () => {
    expect((await RecomputeHttp.handle(req(), { env: ENV, client: neverClient })).status).toBe(401);
    expect((await RecomputeHttp.handle(req('other'), { env: ENV, client: neverClient })).status).toBe(401);
    expect((await RecomputeHttp.handle(req(TOKEN), { env: {}, client: neverClient })).status).toBe(401);
    const lower = new Request('http://127.0.0.1/api/grants/recompute', { method: 'POST', headers: { authorization: `bearer ${TOKEN}` } });
    expect((await RecomputeHttp.handle(lower, { env: ENV, client: neverClient })).status).toBe(401);
  });
});

describe('POST /api/grants/recompute body', () => {
  it('returns 400 for malformed JSON, a non-object body, and a non-string org_id without touching the database', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    for (const body of ['{', '[]', '"x"', '{"org_id":7}', '{"org_id":""}']) {
      const res = await RecomputeHttp.handle(req(TOKEN, body), { env: ENV, client: neverClient });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'bad request' });
    }
    expect(log).toHaveBeenCalledTimes(5);
  });

  it('reads an optional org_id', () => {
    expect(RecomputeHttp.readOrgId('')).toBeUndefined();
    expect(RecomputeHttp.readOrgId('{}')).toBeUndefined();
    expect(RecomputeHttp.readOrgId('{"org_id":"org-1"}')).toBe('org-1');
  });
});

describe('POST /api/grants/recompute results', () => {
  it('returns 200 with reason "no approved config" for every org and writes nothing', async () => {
    const stub = stubClient(['org-1', 'org-2'], false);
    const res = await RecomputeHttp.handle(req(TOKEN), { env: ENV, client: stub.client, now: NOW });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ results: [
      { org_id: 'org-1', scored: 0, config_id: null, reason: 'no approved config' },
      { org_id: 'org-2', scored: 0, config_id: null, reason: 'no approved config' },
    ] });
    expect(stub.calls).toEqual(['org', 'match_config', 'match_config']);
    expect(stub.calls).not.toContain('match_result');
  });

  it('returns 200 with the scored count for the org named in the body and no reason key', async () => {
    const seen: Array<{ orgId: string; now: Date }> = [];
    const res = await RecomputeHttp.handle(req(TOKEN, '{"org_id":"org-1"}'), {
      env: ENV, client: neverClient, now: NOW,
      recompute: async (_c, orgId, now) => { seen.push({ orgId, now }); return { scored: 2, configId: 'v0-synthetic-test' }; },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ results: [{ org_id: 'org-1', scored: 2, config_id: 'v0-synthetic-test' }] });
    expect(seen).toEqual([{ orgId: 'org-1', now: NOW }]);
  });

  it('returns a generic 500 and never logs the token or service key when recompute throws', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await RecomputeHttp.handle(req(TOKEN, '{"org_id":"org-1"}'), {
      env: ENV, client: neverClient,
      recompute: async () => { throw new Error(`upsert failed with ${TOKEN} and ${ENV.SUPABASE_SERVICE_ROLE_KEY}`); },
    });
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).toBe(JSON.stringify({ error: 'recompute failed' }));
    const logged = JSON.stringify(log.mock.calls);
    expect(logged).toContain('[redacted]');
    expect(logged).not.toContain(TOKEN);
    expect(logged).not.toContain(ENV.SUPABASE_SERVICE_ROLE_KEY);
  });

  it('returns 500 when the database is not configured instead of throwing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await RecomputeHttp.handle(req(TOKEN), { env: { INGEST_TOKEN: TOKEN } });
    expect(res.status).toBe(500);
  });
});

it('n8n grants-recompute-weekly is inactive, weekly, and reads URL and token from $env only', () => {
  const text = readFileSync('n8n/grants-recompute-weekly.json', 'utf8');
  const wf = JSON.parse(text) as { active: boolean; nodes: { type: string; parameters: { rule?: { interval: { expression: string }[] } } }[] };
  expect(wf.active).toBe(false);
  expect(wf.nodes.some((n) => n.type === 'n8n-nodes-base.httpRequest')).toBe(true);
  const schedule = wf.nodes.find((n) => n.type === 'n8n-nodes-base.scheduleTrigger');
  expect(schedule?.parameters.rule?.interval[0]?.expression).toMatch(/^\d+ \d+ \* \* [0-6]$/);
  expect(text).toContain('$env.FAS_GRANTS_RECOMPUTE_URL');
  expect(text).toContain('Bearer {{$env.INGEST_TOKEN}}');
  expect(text).not.toMatch(/https?:\/\//);
  expect(text).not.toMatch(/Bearer [A-Za-z0-9]/);
});
