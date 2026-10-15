import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DigestHttp } from './digest-http';

const TOKEN = 'not-a-secret';
const ENV = { INGEST_TOKEN: TOKEN, SUPABASE_SERVICE_ROLE_KEY: 'dummy_secret_here' };
const NOW = new Date('2026-10-19T09:30:00Z');
const WEIGHTS = { mission_fit: 0.3, eligibility_certainty: 0.2, evidence_readiness: 0.15, award_size_fit: 0.15, geography: 0.1, effort_vs_time: 0.1 };

function req(token?: string, query = ''): Request {
  const headers = new Headers();
  if (token !== undefined) headers.set('authorization', `Bearer ${token}`);
  return new Request(`http://127.0.0.1/api/grants/digest${query}`, { method: 'GET', headers });
}

/** Service-role stand-in: `org`, `match_config` and `match_result` answer; every table touched is recorded. */
function stubClient(orgs: string[], approved: boolean, results: unknown[] = []) {
  const calls: string[] = [];
  const config = { id: 'v0-synthetic-test', weights: WEIGHTS, params: { digest_threshold: 65 }, created_at: '2026-10-14', approved_by: approved ? 'admin' : null };
  const answer = (t: string) => ({ data: t === 'org' ? orgs.map((id) => ({ id })) : t === 'match_config' ? [config] : t === 'match_result' ? results : [], error: null });
  const client = {
    from: (t: string) => {
      calls.push(t);
      const chain = { select: () => chain, eq: () => chain, then: (res: (v: unknown) => unknown) => Promise.resolve(answer(t)).then(res) };
      return chain;
    },
  } as unknown as SupabaseClient;
  return { calls, client };
}
const neverClient = { from: () => { throw new Error('client must not be used'); } } as unknown as SupabaseClient;
const result = (id: string, score: number, posted: string | null, close: string | null = '2026-12-01') => ({
  id, score, flags: { eligible: true, flags: [] }, computed_at: '2026-10-19T09:00:00Z', opportunity: { title: `Opp ${id}`, funder: 'Funder', close_date: close, posted_date: posted },
});

afterEach(() => vi.restoreAllMocks());

describe('GET /api/grants/digest auth and query fail closed', () => {
  it('returns 401 for a missing token, a wrong token, and an unset secret', async () => {
    expect((await DigestHttp.handle(req(), { env: ENV, client: neverClient })).status).toBe(401);
    expect((await DigestHttp.handle(req('other'), { env: ENV, client: neverClient })).status).toBe(401);
    expect((await DigestHttp.handle(req(TOKEN), { env: {}, client: neverClient })).status).toBe(401);
  });
  it('returns 400 for a bad days or empty org_id', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    for (const q of ['?days=0', '?days=91', '?days=x', '?days=-1', '?days=1.5', '?org_id=']) {
      const res = await DigestHttp.handle(req(TOKEN, q), { env: ENV, client: neverClient });
      expect([q, res.status]).toEqual([q, 400]);
    }
    expect(DigestHttp.readQuery(new URL('http://x/?days=30&org_id=o1'))).toEqual({ orgId: 'o1', days: 30 });
    expect(DigestHttp.readQuery(new URL('http://x/'))).toEqual({ orgId: undefined, days: 7 });
  });
});

describe('GET /api/grants/digest results', () => {
  it('reports "no approved config" per org and reads no match rows', async () => {
    const stub = stubClient(['org-1', 'org-2'], false);
    const res = await DigestHttp.handle(req(TOKEN), { env: ENV, client: stub.client, now: NOW });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ digests: [{ org_id: 'org-1', config_id: null, reason: 'no approved config' }, { org_id: 'org-2', config_id: null, reason: 'no approved config' }] });
    expect(stub.calls).not.toContain('match_result');
  });
  it('renders one digest per org from stored match rows: threshold from params, new and open only, no reason key', async () => {
    const stub = stubClient(['org-1'], true, [result('a', 70, '2026-10-15'), result('b', 64, '2026-10-15'), result('c', 90, '2026-10-01'), result('d', 80, '2026-10-16', '2026-10-18')]);
    const res = await DigestHttp.handle(req(TOKEN, '?org_id=org-1'), { env: ENV, client: stub.client, now: NOW });
    expect(res.status).toBe(200);
    const body = await res.json() as { digests: { org_id: string; config_id: string; count: number; threshold: number; since: string; subject: string; rows: { id: string }[]; html: string; text: string; reason?: string }[] };
    const d = body.digests[0]!;
    expect([d.org_id, d.config_id, d.count, d.threshold, d.since, d.reason]).toEqual(['org-1', 'v0-synthetic-test', 1, 65, '2026-10-12', undefined]);
    expect(d.rows.map((r) => r.id)).toEqual(['a']);
    expect(d.subject).toBe('FAS Evidence · 1 new grant match this week');
    expect(d.text).toContain('Opp a · Funder · closes Dec 1, 2026 · fit 70 · Eligible');
    expect(stub.calls).toEqual(['match_config', 'match_result']);
  });
  it('returns a generic 500 and never logs the token or service key when the read throws', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const client = { from: () => { throw new Error(`read failed with ${TOKEN} and ${ENV.SUPABASE_SERVICE_ROLE_KEY}`); } } as unknown as SupabaseClient;
    const res = await DigestHttp.handle(req(TOKEN), { env: ENV, client });
    expect([res.status, await res.text()]).toEqual([500, JSON.stringify({ error: 'digest failed' })]);
    const logged = JSON.stringify(log.mock.calls);
    expect(logged).toContain('[redacted]');
    expect(logged).not.toContain(TOKEN);
    expect(logged).not.toContain(ENV.SUPABASE_SERVICE_ROLE_KEY);
  });
  it('returns 500 when the database is not configured instead of throwing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect((await DigestHttp.handle(req(TOKEN), { env: { INGEST_TOKEN: TOKEN } })).status).toBe(500);
  });
});

it('n8n grants-digest-weekly is inactive, weekly, emails only when count > 0, sends from and to the FAS mailbox via the n8n SMTP credential, no $env', () => {
  const text = readFileSync('n8n/grants-digest-weekly.json', 'utf8');
  const wf = JSON.parse(text) as { active: boolean; nodes: { type: string; parameters: { rule?: { interval: { expression: string }[] }; fromEmail?: string; toEmail?: string } }[]; connections: Record<string, { main: unknown[][] }> };
  expect(wf.active).toBe(false);
  expect(wf.nodes.map((n) => n.type)).toEqual(['n8n-nodes-base.scheduleTrigger', 'n8n-nodes-base.httpRequest', 'n8n-nodes-base.splitOut', 'n8n-nodes-base.if', 'n8n-nodes-base.emailSend']);
  expect(wf.nodes[0]?.parameters.rule?.interval[0]?.expression).toMatch(/^\d+ \d+ \* \* [0-6]$/);
  const email = wf.nodes[4]?.parameters;
  expect([email?.fromEmail, email?.toEmail]).toEqual(['george@casepilot.io', 'george@casepilot.io']);
  expect(text).toContain('"smtp":{"id":"Cm0vSkudxS23Diz1","name":"FAS digest mail"}');
  expect(wf.connections['Any new matches?']?.main).toEqual([[{ node: 'Send digest email', type: 'main', index: 0 }], []]);
  expect(text).toContain('https://fas-caspilot-data.vercel.app/api/grants/digest');
  expect(text).toContain('"httpHeaderAuth":{"id":"hJd3gjSOX9o2ITvB","name":"FAS ingest token"}');
  expect(text).not.toMatch(/\$env\./);
  expect(text).not.toMatch(/Bearer [A-Za-z0-9]/);
  expect(text.match(/[\w.]+@[a-z0-9-]+\.[a-z]{2,}/gi)).toEqual(['george@casepilot.io', 'george@casepilot.io']);
});
